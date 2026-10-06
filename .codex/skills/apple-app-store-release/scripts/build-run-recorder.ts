import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

type BuildMode = 'cloud' | 'local';
type BuildOrigin = 'github-actions' | 'local';
type BuildStatus = 'started' | 'succeeded' | 'failed';

export type BuildRun = {
  id: string;
  runNumber: number;
  origin: BuildOrigin;
  mode: BuildMode;
  profile: string;
  status: BuildStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  statePath: string;
  logPath: string;
};

type BuildRunEvent = {
  event: 'run_started' | 'run_finished';
  at: string;
  runId: string;
  runNumber: number;
  origin: BuildOrigin;
  mode: BuildMode;
  profile: string;
  status: BuildStatus;
  exitCode: number | null;
};

type LockMetadata = {
  pid: number;
  hostname: string;
  token: string;
  startedAt: string;
};

type StartBuildRunInput = {
  workflowDir: string;
  mode: BuildMode;
  profile: string;
  githubRunNumber?: string;
};

type RunBuildInput = StartBuildRunInput & {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

const LOCK_WAIT_MS = 5_000;
const LOCK_POLL_MS = 100;

function assertWorkspacePath(targetPath: string): string {
  const absolutePath = path.resolve(targetPath);
  const projectRoot = path.resolve(__dirname, '../../../..');
  const relativePath = path.relative(projectRoot, absolutePath);
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('iOS build workflow storage must stay inside the project workspace.');
  }
  return absolutePath;
}

function parseGithubRunNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const runNumber = Number(value);
  if (!Number.isSafeInteger(runNumber) || runNumber < 1) {
    throw new Error('GITHUB_RUN_NUMBER must be a positive integer.');
  }
  return runNumber;
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporaryPath, filePath);
}

function appendEvent(workflowDir: string, event: BuildRunEvent): void {
  fs.appendFileSync(path.join(workflowDir, 'events.jsonl'), `${JSON.stringify(event)}\n`, 'utf8');
}

function appendHumanLog(logPath: string, line: string): void {
  fs.appendFileSync(logPath, `${line}\n`, 'utf8');
}

function readCounter(workflowDir: string): number {
  const counterPath = path.join(workflowDir, 'counter.json');
  if (!fs.existsSync(counterPath)) return 0;
  const parsed = JSON.parse(fs.readFileSync(counterPath, 'utf8')) as { lastRunNumber?: unknown };
  if (!Number.isSafeInteger(parsed.lastRunNumber) || Number(parsed.lastRunNumber) < 0) {
    throw new Error('The persisted iOS build run counter is invalid; refusing to overwrite it.');
  }
  return Number(parsed.lastRunNumber);
}

export function startBuildRun(input: StartBuildRunInput): BuildRun {
  const workflowDir = assertWorkspacePath(input.workflowDir);
  const githubRunNumber = parseGithubRunNumber(input.githubRunNumber);
  fs.mkdirSync(path.join(workflowDir, 'runs'), { recursive: true });

  const origin: BuildOrigin = githubRunNumber === null ? 'local' : 'github-actions';
  const runNumber = githubRunNumber ?? readCounter(workflowDir) + 1;
  const id = `${origin}-${String(runNumber).padStart(4, '0')}`;
  if (origin === 'local') {
    writeJsonAtomically(path.join(workflowDir, 'counter.json'), { lastRunNumber: runNumber });
  }
  const runDirectory = path.join(workflowDir, 'runs', id);
  fs.mkdirSync(runDirectory, { recursive: false });

  const startedAt = new Date().toISOString();
  const run: BuildRun = {
    id,
    runNumber,
    origin,
    mode: input.mode,
    profile: input.profile,
    status: 'started',
    startedAt,
    finishedAt: null,
    durationMs: null,
    exitCode: null,
    statePath: path.join(runDirectory, 'state.json'),
    logPath: path.join(runDirectory, 'build.log'),
  };

  fs.writeFileSync(run.logPath, `iOS build run ${run.id}\nStarted: ${startedAt}\n`, 'utf8');
  writeJsonAtomically(run.statePath, run);
  writeJsonAtomically(path.join(workflowDir, 'latest.json'), run);
  appendEvent(workflowDir, {
    event: 'run_started',
    at: startedAt,
    runId: run.id,
    runNumber: run.runNumber,
    origin: run.origin,
    mode: run.mode,
    profile: run.profile,
    status: run.status,
    exitCode: null,
  });
  return run;
}

export function finishBuildRun(input: {
  workflowDir: string;
  runId: string;
  exitCode: number;
}): BuildRun {
  if (!Number.isInteger(input.exitCode)) throw new Error('Build exit code must be an integer.');
  const workflowDir = assertWorkspacePath(input.workflowDir);
  if (!/^(local|github-actions)-\d{4,}$/.test(input.runId)) {
    throw new Error('The requested iOS build run identifier is invalid.');
  }
  const runDirectory = path.join(workflowDir, 'runs', input.runId);
  const statePath = path.join(runDirectory, 'state.json');
  const run = JSON.parse(fs.readFileSync(statePath, 'utf8')) as BuildRun;
  if (run.status !== 'started') {
    throw new Error(`iOS build run ${input.runId} has already been finalized.`);
  }

  const finishedAt = new Date().toISOString();
  const finished: BuildRun = {
    ...run,
    status: input.exitCode === 0 ? 'succeeded' : 'failed',
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(run.startedAt)),
    exitCode: input.exitCode,
  };
  writeJsonAtomically(statePath, finished);
  writeJsonAtomically(path.join(workflowDir, 'latest.json'), finished);
  appendEvent(workflowDir, {
    event: 'run_finished',
    at: finishedAt,
    runId: finished.id,
    runNumber: finished.runNumber,
    origin: finished.origin,
    mode: finished.mode,
    profile: finished.profile,
    status: finished.status,
    exitCode: finished.exitCode,
  });
  appendHumanLog(finished.logPath, `Finished: ${finishedAt}\nStatus: ${finished.status}\nexitCode=${finished.exitCode}`);
  return finished;
}

function readLock(lockPath: string): LockMetadata | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('pid' in parsed) ||
      typeof parsed.pid !== 'number' ||
      !Number.isInteger(parsed.pid) ||
      parsed.pid < 1 ||
      !('hostname' in parsed) ||
      typeof parsed.hostname !== 'string' ||
      !('token' in parsed) ||
      typeof parsed.token !== 'string' ||
      !('startedAt' in parsed) ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null;
    }
    return parsed as LockMetadata;
  } catch {
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export async function acquireBuildRunLock(
  workflowDir: string,
  waitMs = LOCK_WAIT_MS,
): Promise<{ release: () => void }> {
  const checkedWorkflowDir = assertWorkspacePath(workflowDir);
  fs.mkdirSync(checkedWorkflowDir, { recursive: true });
  const lockPath = path.join(checkedWorkflowDir, 'build.lock');
  const hostname = os.hostname();
  const token = randomUUID();
  const deadline = Date.now() + Math.max(0, waitMs);

  while (true) {
    try {
      const descriptor = fs.openSync(lockPath, 'wx', 0o600);
      const metadata: LockMetadata = {
        pid: process.pid,
        hostname,
        token,
        startedAt: new Date().toISOString(),
      };
      try {
        fs.writeFileSync(descriptor, `${JSON.stringify(metadata)}\n`, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return {
        release: () => {
          const current = readLock(lockPath);
          if (current?.token === token) fs.unlinkSync(lockPath);
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    const current = readLock(lockPath);
    if (!current) {
      throw new Error('Cannot verify the existing iOS build lock; refusing to start a build.');
    }
    if (current.hostname !== hostname) {
      throw new Error('The existing iOS build lock belongs to another host and cannot be verified.');
    }
    if (!processIsAlive(current.pid)) {
      const latest = readLock(lockPath);
      if (latest?.token === current.token) fs.unlinkSync(lockPath);
      continue;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `iOS build lock contention: process ${current.pid} is still active after ${waitMs} ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(LOCK_POLL_MS, deadline - Date.now())));
  }
}

function createRedactor(environment: NodeJS.ProcessEnv): (chunk: string, final?: boolean) => string {
  const secrets = Object.entries(environment)
    .filter(([name, value]) => /TOKEN|KEY|PASSWORD|SECRET|PRIVATE/i.test(name) && value)
    .map(([, value]) => value as string)
    .sort((left, right) => right.length - left.length);
  const maxSecretLength = secrets[0]?.length ?? 1;
  let pending = '';

  return (chunk, final = false) => {
    pending += chunk;
    if (final) {
      const finalText = secrets.reduce(
        (text, secret) => text.split(secret).join('[REDACTED]'),
        pending,
      );
      pending = '';
      return finalText;
    }
    let safeLength = final ? pending.length : Math.max(0, pending.length - maxSecretLength + 1);
    for (const secret of secrets) {
      const index = pending.indexOf(secret);
      if (index >= 0 && index < safeLength) safeLength = index;
    }
    if (safeLength === 0) return '';
    const safeText = pending.slice(0, safeLength);
    pending = pending.slice(safeLength);
    return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), safeText);
  };
}

function appendChildOutput(
  chunk: Buffer,
  decoder: StringDecoder,
  redact: (chunk: string, final?: boolean) => string,
  logPath: string,
  output: NodeJS.WriteStream,
): void {
  const text = redact(decoder.write(chunk));
  if (text.length === 0) return;
  output.write(text);
  fs.appendFileSync(logPath, text, 'utf8');
}

export async function runRecordedBuild(input: RunBuildInput): Promise<number> {
  const workflowDir = assertWorkspacePath(input.workflowDir);
  const lock = await acquireBuildRunLock(workflowDir);
  let run: BuildRun;
  try {
    run = startBuildRun({
      workflowDir,
      mode: input.mode,
      profile: input.profile,
      githubRunNumber: input.githubRunNumber,
    });
  } catch (error) {
    lock.release();
    throw error;
  }

  process.stdout.write(
    `${JSON.stringify({
      event: 'run_started',
      runId: run.id,
      runNumber: run.runNumber,
      origin: run.origin,
      mode: run.mode,
      profile: run.profile,
      startedAt: run.startedAt,
    })}\nLifecycle log: ${run.logPath}\n`,
  );
  appendHumanLog(run.logPath, `Command: ${path.basename(input.command)}`);
  const environment = input.env ?? process.env;
  const redactStdout = createRedactor(environment);
  const redactStderr = createRedactor(environment);
  const stdoutDecoder = new StringDecoder('utf8');
  const stderrDecoder = new StringDecoder('utf8');
  let signal: NodeJS.Signals | null = null;

  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: environment,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const forwardInterrupt = (receivedSignal: NodeJS.Signals) => {
    signal = receivedSignal;
    child.kill(receivedSignal);
  };
  const signalHandlers = new Map<NodeJS.Signals, () => void>();
  for (const receivedSignal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    const handler = () => forwardInterrupt(receivedSignal);
    signalHandlers.set(receivedSignal, handler);
    process.on(receivedSignal, handler);
  }

  child.stdout?.on('data', (chunk: Buffer) =>
    appendChildOutput(chunk, stdoutDecoder, redactStdout, run.logPath, process.stdout),
  );
  child.stderr?.on('data', (chunk: Buffer) =>
    appendChildOutput(chunk, stderrDecoder, redactStderr, run.logPath, process.stderr),
  );

  const executionError: { value: Error | null } = { value: null };
  child.on('error', (error) => {
    executionError.value = error;
  });

  let exitCode: number;
  try {
    const [code] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
      child.once('close', (childCode, childSignal) => resolve([childCode, childSignal]));
    });
    exitCode = executionError.value
      ? 127
      : (code ?? (signal === null ? 1 : 128 + (os.constants.signals[signal] ?? 1)));
  } catch {
    exitCode = 1;
  } finally {
    for (const [receivedSignal, handler] of signalHandlers) process.off(receivedSignal, handler);
    const finalStdout = redactStdout(stdoutDecoder.end(), true);
    const finalStderr = redactStderr(stderrDecoder.end(), true);
    if (finalStdout) {
      process.stdout.write(finalStdout);
      fs.appendFileSync(run.logPath, finalStdout, 'utf8');
    }
    if (finalStderr) {
      process.stderr.write(finalStderr);
      fs.appendFileSync(run.logPath, finalStderr, 'utf8');
    }
  }

  try {
    const finished = finishBuildRun({ workflowDir, runId: run.id, exitCode });
    process.stdout.write(
      `${JSON.stringify({
        event: 'run_finished',
        runId: finished.id,
        runNumber: finished.runNumber,
        origin: finished.origin,
        mode: finished.mode,
        profile: finished.profile,
        status: finished.status,
        exitCode: finished.exitCode,
        finishedAt: finished.finishedAt,
        durationMs: finished.durationMs,
      })}\n`,
    );
  } finally {
    lock.release();
  }
  if (executionError.value) {
    process.stderr.write(`Build command failed to start: ${executionError.value.message}\n`);
  }
  return exitCode;
}
