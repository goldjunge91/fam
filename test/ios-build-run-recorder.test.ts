import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  acquireBuildRunLock,
  finishBuildRun,
  runRecordedBuild,
  startBuildRun,
} from '../.codex/skills/apple-app-store-release/scripts/build-run-recorder';

const projectRoot = path.resolve(__dirname, '..');
const testRoot = path.join(projectRoot, 'build', 'test-tmp');

describe('iOS build run recorder', () => {
  let workflowDir: string;

  beforeEach(() => {
    fs.mkdirSync(testRoot, { recursive: true });
    workflowDir = fs.mkdtempSync(path.join(testRoot, 'ios-build-run-'));
  });

  afterEach(() => {
    fs.rmSync(workflowDir, { recursive: true, force: true });
  });

  it('allocates a local sequence and persists per-run and latest state', () => {
    const firstRun = startBuildRun({
      workflowDir,
      mode: 'local',
      profile: 'preview-testflight-local',
    });
    const secondRun = startBuildRun({
      workflowDir,
      mode: 'cloud',
      profile: 'production',
    });

    expect(firstRun.runNumber).toBe(1);
    expect(secondRun.runNumber).toBe(2);
    expect(secondRun.id).toBe('local-0002');
    expect(JSON.parse(fs.readFileSync(secondRun.statePath, 'utf8'))).toMatchObject({
      id: 'local-0002',
      profile: 'production',
      mode: 'cloud',
      status: 'started',
      exitCode: null,
    });
    expect(JSON.parse(fs.readFileSync(path.join(workflowDir, 'latest.json'), 'utf8'))).toMatchObject({
      id: 'local-0002',
      runNumber: 2,
    });
  });

  it('uses the GitHub Actions workflow sequence without reading EAS build numbers', () => {
    const run = startBuildRun({
      workflowDir,
      mode: 'local',
      profile: 'preview-testflight',
      githubRunNumber: '42',
    });

    expect(run).toMatchObject({
      id: 'github-actions-0042',
      runNumber: 42,
      origin: 'github-actions',
    });
    expect(fs.existsSync(path.join(workflowDir, 'counter.json'))).toBe(false);
  });

  it('records the final result in JSON state, event history, latest state, and human log', () => {
    const run = startBuildRun({
      workflowDir,
      mode: 'local',
      profile: 'production-local',
    });

    const finished = finishBuildRun({ workflowDir, runId: run.id, exitCode: 17 });
    const events = fs
      .readFileSync(path.join(workflowDir, 'events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { event: string; exitCode?: number });

    expect(finished).toMatchObject({ status: 'failed', exitCode: 17 });
    expect(events).toEqual([
      expect.objectContaining({ event: 'run_started' }),
      expect.objectContaining({ event: 'run_finished', exitCode: 17 }),
    ]);
    expect(fs.readFileSync(run.logPath, 'utf8')).toContain('exitCode=17');
    expect(JSON.parse(fs.readFileSync(path.join(workflowDir, 'latest.json'), 'utf8'))).toMatchObject({
      status: 'failed',
      exitCode: 17,
    });
  });

  it('refuses an unverifiable legacy lock without allocating a run', async () => {
    fs.writeFileSync(path.join(workflowDir, 'build.lock'), 'legacy-lock-without-owner\n');

    await expect(acquireBuildRunLock(workflowDir)).rejects.toThrow(/cannot verify/i);
    expect(fs.existsSync(path.join(workflowDir, 'counter.json'))).toBe(false);
  });

  it('returns bounded contention while another process holds the run lock', async () => {
    const owner = await acquireBuildRunLock(workflowDir);

    await expect(acquireBuildRunLock(workflowDir, 0)).rejects.toThrow(/lock contention/i);
    owner.release();
  });

  it('captures build output, redacts environment secrets, and records the child exit code', async () => {
    const secret = 'do-not-store-this-token';
    const splitIndex = 11;
    const exitCode = await runRecordedBuild({
      workflowDir,
      mode: 'cloud',
      profile: 'preview-testflight',
      command: process.execPath,
      args: [
        '-e',
        `process.stdout.write('build ${secret.slice(0, splitIndex)}'); setTimeout(() => { process.stdout.write('${secret.slice(splitIndex)} finished\\n'); process.exit(9); }, 5);`,
      ],
      cwd: projectRoot,
      env: { ...process.env, FAM_TEST_SECRET: secret },
    });
    const latest = JSON.parse(fs.readFileSync(path.join(workflowDir, 'latest.json'), 'utf8')) as {
      status: string;
      exitCode: number;
      logPath: string;
    };
    const log = fs.readFileSync(latest.logPath, 'utf8');

    expect(exitCode).toBe(9);
    expect(latest).toMatchObject({ status: 'failed', exitCode: 9 });
    expect(log).toContain('[REDACTED]');
    expect(log).not.toContain(secret);
    expect(fs.existsSync(path.join(workflowDir, 'build.lock'))).toBe(false);
  });

  it('records a command that cannot start as a failed run and releases the lock', async () => {
    const exitCode = await runRecordedBuild({
      workflowDir,
      mode: 'local',
      profile: 'preview-testflight-local',
      command: path.join(workflowDir, 'missing-command'),
      args: [],
      cwd: projectRoot,
    });

    const latest = JSON.parse(fs.readFileSync(path.join(workflowDir, 'latest.json'), 'utf8')) as {
      status: string;
      exitCode: number;
    };
    expect(exitCode).toBe(127);
    expect(latest).toMatchObject({ status: 'failed', exitCode: 127 });
    expect(fs.existsSync(path.join(workflowDir, 'build.lock'))).toBe(false);
  });

  it('reclaims a lock whose recorded local process is no longer running', async () => {
    fs.writeFileSync(
      path.join(workflowDir, 'build.lock'),
      JSON.stringify({
        pid: 2_147_483_647,
        hostname: os.hostname(),
        token: 'stale',
        startedAt: new Date(0).toISOString(),
      }),
    );

    const lock = await acquireBuildRunLock(workflowDir);
    expect(fs.existsSync(path.join(workflowDir, 'build.lock'))).toBe(true);
    lock.release();
    expect(fs.existsSync(path.join(workflowDir, 'build.lock'))).toBe(false);
  });
});
