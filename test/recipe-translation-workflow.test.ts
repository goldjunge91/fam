import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

type TestCatalog = {
  recipes: Array<{
    sortOrder: number;
    externalId: string;
    title: string;
    instructions: string;
    components: Array<{
      name: string;
      items: Array<{ ingredientName: string; quantity: number; unit: string }>;
    }>;
    steps: Array<{ text: string }>;
    images: Array<{ sourceUrl: string; altText: string }>;
  }>;
};

const repositoryRoot = path.resolve(__dirname, '..');
const workflowScript = path.join(repositoryRoot, 'scripts/recipe-translation-workflow.ts');

const sourceCatalog: TestCatalog = {
  recipes: [
    {
      sortOrder: 0,
      externalId: 'waivy:apple-pancakes',
      title: 'Apple Pancakes',
      instructions: 'Bake for 10 minutes.',
      components: [
        {
          name: 'Batter',
          items: [{ ingredientName: 'Flour', quantity: 1, unit: 'cup' }],
        },
      ],
      steps: [{ text: 'Cook until golden.' }],
      images: [{ sourceUrl: 'https://example.com/apple-pancakes.jpg', altText: 'Apple pancakes' }],
    },
  ],
};

const translatedCatalog: TestCatalog = {
  recipes: [
    {
      ...sourceCatalog.recipes[0],
      title: 'Apfelpfannkuchen',
      instructions: '10 Minuten backen.',
      components: [{
        name: 'Teig',
        items: [{ ingredientName: 'Mehl', quantity: 1, unit: 'cup' }],
      }],
      steps: [{ text: 'Kochen, bis alles goldbraun ist.' }],
      images: [{
        sourceUrl: 'https://example.com/apple-pancakes.jpg',
        altText: 'Apfelpfannkuchen',
      }],
    },
  ],
};

function runWorkflow(args: string[]) {
  return spawnSync('bun', [workflowScript, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function writeCatalog(filePath: string, catalog: TestCatalog): void {
  writeFileSync(filePath, `${JSON.stringify(catalog, null, 2)}\n`);
}

describe('recipe translation workflow', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'fam-recipe-translation-test-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('prepares, validates, reports, and merges a translated slice', () => {
    const candidatePath = path.join(temporaryDirectory, 'candidate.json');
    const sourcePath = path.join(temporaryDirectory, 'source.json');
    const outputPath = path.join(temporaryDirectory, 'translated.json');
    const workDir = path.join(temporaryDirectory, 'work');
    const jobDir = path.join(workDir, 'job-0000');
    const mergedPath = path.join(temporaryDirectory, 'merged.json');
    writeCatalog(candidatePath, sourceCatalog);
    writeCatalog(sourcePath, sourceCatalog);

    const prepared = runWorkflow([
      'prepare',
      '--candidate',
      candidatePath,
      '--source',
      sourcePath,
      '--from',
      '0',
      '--to',
      '0',
      '--job',
      'job-0000',
      '--workdir',
      workDir,
    ]);
    expect(prepared.status).toBe(0);

    writeCatalog(outputPath, translatedCatalog);
    const reportPath = path.join(jobDir, 'validation-report.json');
    const validated = runWorkflow([
      'validate',
      '--input',
      path.join(jobDir, 'candidate.json'),
      '--output',
      outputPath,
      '--source',
      path.join(jobDir, 'source.json'),
      '--report',
      reportPath,
    ]);
    expect(validated.status).toBe(0);
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toMatchObject({
      status: 'passed',
      recipeCount: 1,
      changedTextPathCount: 6,
    });

    const status = runWorkflow(['status', '--dir', workDir]);
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      passedRecipes: 1,
      passedReports: 1,
      failedReports: 0,
    });

    const merged = runWorkflow([
      'merge',
      '--base',
      candidatePath,
      '--slices',
      outputPath,
      '--reports',
      reportPath,
      '--output',
      mergedPath,
    ]);
    expect(merged.status).toBe(0);
    expect(JSON.parse(readFileSync(mergedPath, 'utf8')).recipes[0].title).toBe('Apfelpfannkuchen');
  });

  it('rejects changes to protected recipe data', () => {
    const inputPath = path.join(temporaryDirectory, 'input.json');
    const outputPath = path.join(temporaryDirectory, 'output.json');
    const sourcePath = path.join(temporaryDirectory, 'source.json');
    const reportPath = path.join(temporaryDirectory, 'report.json');
    const invalidOutput: TestCatalog = {
      recipes: [{
        ...translatedCatalog.recipes[0],
        externalId: 'waivy:changed-id',
        images: [{ sourceUrl: 'https://example.com/changed.jpg', altText: 'Apfelpfannkuchen' }],
      }],
    };
    writeCatalog(inputPath, sourceCatalog);
    writeCatalog(outputPath, invalidOutput);
    writeCatalog(sourcePath, sourceCatalog);

    const result = runWorkflow([
      'validate',
      '--input',
      inputPath,
      '--output',
      outputPath,
      '--source',
      sourcePath,
      '--report',
      reportPath,
    ]);
    expect(result.status).toBe(1);
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toMatchObject({
      status: 'failed',
      protectedDifferences: expect.arrayContaining([
        'recipes[sortOrder=0].externalId',
        'recipes[sortOrder=0].images[0].sourceUrl',
      ]),
    });
  });
});
