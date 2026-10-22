import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, '.githooks', 'pre-push');
const TEST_TEMP_ROOT = path.join(REPO_ROOT, 'build', 'test-tmp', 'pre-push-hook');
const NULL_OID = '0000000000000000000000000000000000000000';

function createFakeBunDirectory(): string {
  fs.mkdirSync(TEST_TEMP_ROOT, { recursive: true });
  const directory = fs.mkdtempSync(path.join(TEST_TEMP_ROOT, 'bin-'));
  const bunPath = path.join(directory, 'bun');
  fs.writeFileSync(bunPath, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(bunPath, 0o755);
  return directory;
}

describe('pre-push hook', () => {
  it('accepts a pure branch deletion without diffing against the null OID', () => {
    const fakeBinDirectory = createFakeBunDirectory();

    try {
      const result = spawnSync('bash', [HOOK_PATH, 'origin', 'https://example.invalid/repo.git'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBinDirectory}:${process.env.PATH ?? ''}`,
        },
        input: `(delete) ${NULL_OID} refs/heads/old-branch 5593178aa55c8208cb2b88d52dda377a40b9e248\n`,
      });

      if (result.status !== 0) {
        throw new Error(
          `pre-push exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        );
      }
      expect(result.stdout).toContain('nur Ref-Loeschungen');
      expect(result.stderr).not.toContain('Invalid revision range');
    } finally {
      fs.rmSync(fakeBinDirectory, { recursive: true, force: true });
    }
  });
});
