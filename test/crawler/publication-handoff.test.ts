import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  createPublicationHandoff,
  validatePublicationHandoff,
} from '../../tools/crawler/brochures/listing-only/publication-handoff';

const roots: string[] = [];
const binding = {
  repository: 'goldjunge91/fam',
  runId: '38116213100',
  commitSha: 'a'.repeat(40),
};

async function createFixture(): Promise<{
  bundleDir: string;
  manifestSha256: string;
}> {
  const root = await mkdtemp(join(process.cwd(), '.test-publication-handoff-'));
  roots.push(root);
  const sourceDir = join(root, 'source');
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, 'all-stores-full.json'), JSON.stringify({ byZipCode: {} }));
  await writeFile(join(sourceDir, 'canonical-brochures.json'), JSON.stringify({ brochures: [] }));
  const bundleDir = join(root, 'bundle');
  const result = await createPublicationHandoff({ sourceDir, bundleDir, binding });
  return { bundleDir, manifestSha256: result.manifestSha256 };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('publication handoff', () => {
  it('copies and validates only the regional metadata inputs and workflow binding', async () => {
    const { bundleDir, manifestSha256 } = await createFixture();

    const result = await validatePublicationHandoff({ bundleDir, manifestSha256, binding });

    expect(result.manifest).toMatchObject({ version: 2, ...binding });
    expect(result.manifest.files.map(({ name }) => name)).toEqual([
      'all-stores-full.json',
      'canonical-brochures.json',
    ]);
    expect(Object.keys(result.paths).sort()).toEqual([
      'all-stores-full.json',
      'canonical-brochures.json',
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
      await expect(validatePublicationHandoff({ bundleDir, manifestSha256, binding: changedBinding }))
        .rejects.toThrow('binding');
    }
  });

  it('rejects changed, missing, and additional publisher inputs', async () => {
    const changed = await createFixture();
    await writeFile(join(changed.bundleDir, 'all-stores-full.json'), '{}', 'utf8');
    await expect(validatePublicationHandoff({ ...changed, binding })).rejects.toThrow('failed SHA-256');

    const missing = await createFixture();
    await unlink(join(missing.bundleDir, 'canonical-brochures.json'));
    await expect(validatePublicationHandoff({ ...missing, binding })).rejects.toThrow('exact metadata file allowlist');

    const extra = await createFixture();
    await writeFile(join(extra.bundleDir, 'unverified.json'), '{}', 'utf8');
    await expect(validatePublicationHandoff({ ...extra, binding })).rejects.toThrow('exact metadata file allowlist');

    expect(extra.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
