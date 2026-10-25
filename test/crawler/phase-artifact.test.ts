import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  createPhaseArtifact,
  validatePhaseArtifact,
} from '../../tools/crawler/brochures/listing-only/phase-artifact';

const binding = {
  repository: 'goldjunge91/fam',
  runId: '38116213100',
  commitSha: 'a'.repeat(40),
};
const roots: string[] = [];

async function createFixture() {
  const root = await mkdtemp(join(process.cwd(), '.test-phase-artifact-'));
  roots.push(root);
  const artifactDir = join(root, 'artifact');
  await mkdir(artifactDir);
  await writeFile(join(artifactDir, 'payload.json'), '{"ok":true}\n');
  const result = await createPhaseArtifact({
    artifactDir,
    phase: 'detail-pages',
    files: ['payload.json'],
    binding,
    predecessorManifestSha256: ['b'.repeat(64)],
  });
  return { artifactDir, manifestSha256: result.manifestSha256 };
}

async function createDetailFixture() {
  const root = await mkdtemp(join(process.cwd(), '.test-phase-artifact-detail-'));
  roots.push(root);
  const artifactDir = join(root, 'artifact');
  await mkdir(artifactDir);
  await writeFile(join(artifactDir, 'detail-pages.json'), '{"brn-a":8}\n');
  await writeFile(join(artifactDir, 'detail-page-metadata.json'), '{"brn-a":{"pages":[]}}\n');
  const result = await createPhaseArtifact({
    artifactDir,
    phase: 'detail-pages',
    files: ['detail-pages.json', 'detail-page-metadata.json'],
    binding,
    predecessorManifestSha256: ['b'.repeat(64)],
  });
  return { artifactDir, manifestSha256: result.manifestSha256 };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('phase artifacts', () => {
  it('binds a phase to the run, predecessor digest, exact file, and file digest', async () => {
    const fixture = await createFixture();

    const result = await validatePhaseArtifact({
      ...fixture,
      phase: 'detail-pages',
      files: ['payload.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    });

    expect(result.manifest).toMatchObject({
      version: 1,
      ...binding,
      phase: 'detail-pages',
      predecessorManifestSha256: ['b'.repeat(64)],
    });
  });

  it('binds and validates the exact two-file detail manifest', async () => {
    const fixture = await createDetailFixture();
    expect(fixture.manifestSha256).toMatch(/^[a-f0-9]{64}$/);

    const result = await validatePhaseArtifact({
      ...fixture,
      phase: 'detail-pages',
      files: ['detail-pages.json', 'detail-page-metadata.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    });

    expect(result.manifest.files.map(({ name }) => name)).toEqual([
      'detail-page-metadata.json',
      'detail-pages.json',
    ]);

    for (const file of ['detail-pages.json', 'detail-page-metadata.json']) {
      const changed = await createDetailFixture();
      await writeFile(join(changed.artifactDir, file), '{"changed":true}\n');
      await expect(validatePhaseArtifact({
        ...changed,
        phase: 'detail-pages',
        files: ['detail-pages.json', 'detail-page-metadata.json'],
        binding,
        predecessorManifestSha256: ['b'.repeat(64)],
      })).rejects.toThrow('SHA-256');
    }

    for (const manifestSha256 of [undefined, '']) {
      await expect(validatePhaseArtifact({
        ...fixture,
        manifestSha256,
        phase: 'detail-pages',
        files: ['detail-pages.json', 'detail-page-metadata.json'],
        binding,
        predecessorManifestSha256: ['b'.repeat(64)],
      })).rejects.toThrow('Expected phase artifact manifest SHA-256');
    }

    await expect(validatePhaseArtifact({
      ...fixture,
      phase: 'detail-pages',
      files: ['detail-pages.json', 'detail-page-metadata.json'],
      binding,
      predecessorManifestSha256: ['c'.repeat(64)],
    })).rejects.toThrow('predecessor manifest digest');
  });

  it('rejects a wrong run, commit, phase, or predecessor binding', async () => {
    const fixture = await createFixture();
    for (const changed of [
      { binding: { ...binding, runId: 'other-run' } },
      { binding: { ...binding, commitSha: 'c'.repeat(40) } },
      { phase: 'grouping' },
      { predecessorManifestSha256: ['d'.repeat(64)] },
    ]) {
      await expect(validatePhaseArtifact({
        ...fixture,
        phase: changed.phase ?? 'detail-pages',
        files: ['payload.json'],
        binding: changed.binding ?? binding,
        predecessorManifestSha256: changed.predecessorManifestSha256 ?? ['b'.repeat(64)],
      })).rejects.toThrow(/binding|belongs|predecessor/);
    }
  });

  it('rejects a changed file, missing file, extra file, and wrong manifest digest', async () => {
    const changed = await createFixture();
    await writeFile(join(changed.artifactDir, 'payload.json'), '{"ok":false}\n');
    await expect(validatePhaseArtifact({
      ...changed,
      phase: 'detail-pages',
      files: ['payload.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    })).rejects.toThrow('SHA-256');

    const missing = await createFixture();
    await rm(join(missing.artifactDir, 'payload.json'));
    await expect(validatePhaseArtifact({
      ...missing,
      phase: 'detail-pages',
      files: ['payload.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    })).rejects.toThrow('missing');

    const extra = await createFixture();
    await writeFile(join(extra.artifactDir, 'foreign.json'), '{}');
    await expect(validatePhaseArtifact({
      ...extra,
      phase: 'detail-pages',
      files: ['payload.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    })).rejects.toThrow('extra');

    const wrongDigest = await createFixture();
    await expect(validatePhaseArtifact({
      ...wrongDigest,
      manifestSha256: 'f'.repeat(64),
      phase: 'detail-pages',
      files: ['payload.json'],
      binding,
      predecessorManifestSha256: ['b'.repeat(64)],
    })).rejects.toThrow('manifest SHA-256');
  });

  it('rejects omitted and empty expected manifest digests', async () => {
    const fixture = await createFixture();
    for (const manifestSha256 of [undefined, '']) {
      await expect(validatePhaseArtifact({
        ...fixture,
        manifestSha256,
        phase: 'detail-pages',
        files: ['payload.json'],
        binding,
        predecessorManifestSha256: ['b'.repeat(64)],
      })).rejects.toThrow('Expected phase artifact manifest SHA-256');
    }
  });
});
