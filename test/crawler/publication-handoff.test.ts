import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  createPublicationHandoff,
  PUBLICATION_HANDOFF_MANIFEST,
  validatePublicationHandoff,
} from '../../tools/crawler/brochures/listing-only/publication-handoff';

const roots: string[] = [];
const binding = {
  repository: 'goldjunge91/fam',
  runId: '38116213100',
  commitSha: 'a'.repeat(40),
};

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function createSourceFiles(root: string): Promise<string> {
  const sourceDir = join(root, 'source');
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, 'all-stores-full.json'), JSON.stringify({ byZipCode: {} }));
  await writeFile(
    join(sourceDir, 'canonical-page-verification.json'),
    JSON.stringify({ inputFingerprint: 'c'.repeat(64) }),
  );
  await writeFile(join(sourceDir, 'canonical-brochures.json'), JSON.stringify({ brochures: [] }));
  return sourceDir;
}

async function createFixture(): Promise<{
  bundleDir: string;
  manifestSha256: string;
}> {
  const root = await mkdtemp(join(process.cwd(), '.test-publication-handoff-'));
  roots.push(root);
  const sourceDir = await createSourceFiles(root);
  const bundleDir = join(root, 'bundle');
  const result = await createPublicationHandoff({ sourceDir, bundleDir, binding });
  return { bundleDir, manifestSha256: result.manifestSha256 };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('publication handoff', () => {
  it('copies only the verified publisher inputs and validates their complete binding', async () => {
    const { bundleDir, manifestSha256 } = await createFixture();

    const result = await validatePublicationHandoff({ bundleDir, manifestSha256, binding });

    expect(result.manifest).toMatchObject({
      version: 1,
      ...binding,
      inputFingerprint: 'c'.repeat(64),
    });
    expect(result.manifest.files.map(({ name }) => name)).toEqual([
      'all-stores-full.json',
      'canonical-page-verification.json',
      'canonical-brochures.json',
    ]);
    expect(Object.keys(result.paths).sort()).toEqual([
      'all-stores-full.json',
      'canonical-brochures.json',
      'canonical-page-verification.json',
    ]);
  });

  it('rejects a wrong manifest digest or run, repository, and commit binding', async () => {
    const { bundleDir, manifestSha256 } = await createFixture();

    await expect(validatePublicationHandoff({
      bundleDir,
      manifestSha256: '0'.repeat(64),
      binding,
    })).rejects.toThrow('manifest SHA-256');

    for (const changedBinding of [
      { ...binding, runId: 'other-run' },
      { ...binding, repository: 'other/repository' },
      { ...binding, commitSha: 'b'.repeat(40) },
    ]) {
      await expect(validatePublicationHandoff({
        bundleDir,
        manifestSha256,
        binding: changedBinding,
      })).rejects.toThrow('binding');
    }
  });

  it('rejects changed, missing, and additionally named publisher inputs', async () => {
    const changed = await createFixture();
    await writeFile(join(changed.bundleDir, 'all-stores-full.json'), '{}', 'utf8');
    await expect(validatePublicationHandoff({ ...changed, binding })).rejects.toThrow('failed SHA-256');

    const missing = await createFixture();
    await unlink(join(missing.bundleDir, 'canonical-brochures.json'));
    await expect(validatePublicationHandoff({ ...missing, binding })).rejects.toThrow('canonical-brochures.json');

    const extra = await createFixture();
    const manifestPath = join(extra.bundleDir, PUBLICATION_HANDOFF_MANIFEST);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      files: Array<{ name: string; sha256: string; bytes: number }>;
    };
    manifest.files.push({ name: 'unverified.json', sha256: 'f'.repeat(64), bytes: 1 });
    const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(manifestPath, manifestBytes, 'utf8');

    await expect(validatePublicationHandoff({
      bundleDir: extra.bundleDir,
      manifestSha256: sha256(manifestBytes),
      binding,
    })).rejects.toThrow('exact publisher input allowlist');
  });
});
