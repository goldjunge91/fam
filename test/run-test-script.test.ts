import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '..');
const logDirectory = path.join(repositoryRoot, 'test_logs');
const logPattern = /^test_\d+_\d{2}-\d{2}-\d{2}\.log$/;

function listLogFiles(): string[] {
  return fs.readdirSync(logDirectory).filter((entry) => logPattern.test(entry));
}

describe('scripts/run-test.ts', () => {
  it('starts dotenv and Jest from the repository root', () => {
    const logsBeforeRun = new Set(listLogFiles());
    const result = spawnSync('bun', ['scripts/run-test.ts', '--version'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    const createdLogs = listLogFiles().filter((entry) => !logsBeforeRun.has(entry));

    try {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(createdLogs).toHaveLength(1);

      const logContents = fs.readFileSync(path.join(logDirectory, createdLogs[0]), 'utf8');
      expect(logContents).toContain('Testlauf beendet (Exit-Code 0).');
    } finally {
      for (const logFile of createdLogs) {
        fs.rmSync(path.join(logDirectory, logFile));
      }
    }
  });
});
