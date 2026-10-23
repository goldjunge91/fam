#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CommandStep } from '../build-picker-logic';
import { storeSteps } from '../build-picker-logic';
import {
  artifactInfoPlistPath,
  artifactOutputPath,
  type BuildMetadata,
  type BuildSpec,
  IOS_BUILD_USAGE,
  parseInfoPlistJson,
  parseIosBuildArgs,
  parseRemoteBuildVersion,
  remoteVersionCommand,
  resolveArtifactPath,
} from './ios-build-cli';
import { IosBuildLog } from './ios-build-logging';

const projectRoot = path.resolve(__dirname, '../..');

type CommandResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: string;
};

class BuildCommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'BuildCommandError';
    this.exitCode = exitCode;
  }
}

function formatCommand(step: CommandStep): string {
  const quote = (value: string): string => {
    if (/^[a-zA-Z0-9_./:=+-]+$/.test(value)) return value;
    return `'${value.replaceAll("'", "'\\''")}'`;
  };
  return [step.command, ...step.args].map(quote).join(' ');
}

async function runCommand(
  step: CommandStep,
  log: IosBuildLog,
  captureStdout = false,
): Promise<CommandResult> {
  log.write(`\n$ ${formatCommand(step)}\n`);
  const stdoutChunks: Buffer[] = [];
  const executionError: { value: Error | null } = { value: null };
  const child = spawn(step.command, step.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    if (captureStdout) stdoutChunks.push(chunk);
    log.appendChildOutput('stdout', chunk, process.stdout);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    log.appendChildOutput('stderr', chunk, process.stderr);
  });
  child.once('error', (error) => {
    executionError.value = error;
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once('close', (code, signal) => resolve({ code, signal }));
    },
  );

  if (executionError.value) {
    log.write(`Befehl konnte nicht gestartet werden: ${executionError.value.message}\n`);
    return { exitCode: 127, signal: null, stdout: Buffer.concat(stdoutChunks).toString('utf8') };
  }

  const exitCode =
    result.code ?? (result.signal ? 128 + (os.constants.signals[result.signal] ?? 1) : 1);
  log.write(
    result.signal
      ? `Befehl beendet durch ${result.signal} (Exit-Code ${exitCode}).\n`
      : `Befehl beendet (Exit-Code ${exitCode}).\n`,
  );

  return { exitCode, signal: result.signal, stdout: Buffer.concat(stdoutChunks).toString('utf8') };
}

function requireSuccess(result: CommandResult, step: CommandStep): void {
  if (result.exitCode === 0) return;
  throw new BuildCommandError(
    `Build-Schritt fehlgeschlagen (Exit-Code ${result.exitCode}): ${formatCommand(step)}`,
    result.exitCode,
  );
}

async function readRemoteBuildNumber(spec: BuildSpec, log: IosBuildLog): Promise<string> {
  const step = remoteVersionCommand(spec.buildProfile);
  const result = await runCommand(step, log, true);
  requireSuccess(result, step);
  const buildNumber = parseRemoteBuildVersion(result.stdout.trim());
  log.write(`EAS Remote-Buildnummer vor dem Build: ${buildNumber}\n`);
  return buildNumber;
}

async function readPlistMetadata(plistPath: string, log: IosBuildLog): Promise<BuildMetadata> {
  if (!fs.existsSync(plistPath)) {
    throw new Error(`Info.plist wurde nicht gefunden: ${plistPath}`);
  }

  const step: CommandStep = {
    command: 'plutil',
    args: ['-convert', 'json', '-o', '-', plistPath],
  };
  const result = await runCommand(step, log, true);
  requireSuccess(result, step);
  return parseInfoPlistJson(result.stdout.trim());
}

async function captureBinaryCommand(step: CommandStep, log: IosBuildLog): Promise<Buffer> {
  log.write(`\n$ ${formatCommand(step)}\n`);
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  const executionError: { value: Error | null } = { value: null };
  const child = spawn(step.command, step.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  child.once('error', (error) => {
    executionError.value = error;
  });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => child.once('close', (code, signal) => resolve({ code, signal })),
  );

  const stderr = Buffer.concat(stderrChunks).toString('utf8');
  if (stderr.length > 0) log.write(stderr);
  if (executionError.value) {
    throw new BuildCommandError(
      `Befehl konnte nicht gestartet werden: ${executionError.value.message}`,
      127,
    );
  }
  if (result.code !== 0 || result.signal) {
    const exitCode = result.code ?? 1;
    throw new BuildCommandError(
      `Befehl fehlgeschlagen (Exit-Code ${exitCode}): ${formatCommand(step)}`,
      exitCode,
    );
  }
  log.write('Befehl beendet (Binärdaten erfasst, Exit-Code 0).\n');
  return Buffer.concat(stdoutChunks);
}

async function readIpaMetadata(
  ipaPath: string,
  runId: string,
  log: IosBuildLog,
): Promise<BuildMetadata> {
  const listStep: CommandStep = {
    command: 'unzip',
    args: ['-Z1', ipaPath],
  };
  const listResult = await runCommand(listStep, log, true);
  requireSuccess(listResult, listStep);
  const plistEntry = listResult.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(entry));
  if (!plistEntry) {
    throw new Error(`Keine App-Info.plist in der IPA gefunden: ${ipaPath}`);
  }

  const plistPath = path.join(projectRoot, 'build', 'local', 'metadata', runId, 'Info.plist');
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  const plistBytes = await captureBinaryCommand(
    { command: 'unzip', args: ['-p', ipaPath, plistEntry] },
    log,
  );
  fs.writeFileSync(plistPath, plistBytes);
  return readPlistMetadata(plistPath, log);
}

async function readArtifactMetadata(
  spec: BuildSpec,
  artifactPath: string,
  runId: string,
  log: IosBuildLog,
): Promise<BuildMetadata> {
  if (spec.artifactKind === 'ipa') return readIpaMetadata(artifactPath, runId, log);
  return readPlistMetadata(artifactInfoPlistPath(spec.artifactKind, artifactPath), log);
}

async function runLocalEasBuild(
  spec: BuildSpec,
  runId: string,
  log: IosBuildLog,
): Promise<{ artifactPath: string; metadata: BuildMetadata }> {
  const relativeOutputPath = artifactOutputPath(spec, runId);
  const outputPath = path.resolve(projectRoot, relativeOutputPath);
  const buildStep = {
    command: 'bash',
    args: [
      'scripts/eas-ios-build.sh',
      'local',
      spec.buildProfile,
      '--output',
      relativeOutputPath,
      '--non-interactive',
    ],
  } satisfies CommandStep;
  const buildResult = await runCommand(buildStep, log);
  requireSuccess(buildResult, buildStep);

  const searchRoot = path.dirname(outputPath);
  const artifactPath = resolveArtifactPath(spec.artifactKind, outputPath, searchRoot);
  const metadata = await readArtifactMetadata(spec, artifactPath, runId, log);
  return { artifactPath, metadata };
}

async function runXcodeTestFlight(
  runId: string,
  log: IosBuildLog,
): Promise<{ artifactPath: string; metadata: BuildMetadata }> {
  const relativeArchivePath = artifactOutputPath(
    {
      kind: 'testflight-xcode',
      buildProfile: 'preview-testflight',
      artifactKind: 'xcarchive',
      upload: 'xcode',
    },
    runId,
  );
  const relativeExportPath = `build/cache/ios/testflight/${runId}/export`;
  const steps = storeSteps({
    type: 'testflight',
    location: 'local',
    submit: 'xcode',
    envFile: '.env.preview',
    archivePath: relativeArchivePath,
    exportPath: relativeExportPath,
  });
  const archiveIndex = steps.findIndex((step) => step.args.includes('archive'));
  if (archiveIndex < 0) throw new Error('Xcode-Archivschritt wurde nicht gefunden.');

  for (const step of steps.slice(0, archiveIndex + 1)) {
    const result = await runCommand(step, log);
    requireSuccess(result, step);
  }

  const archivePath = resolveArtifactPath(
    'xcarchive',
    path.resolve(projectRoot, relativeArchivePath),
    path.dirname(path.resolve(projectRoot, relativeArchivePath)),
  );
  const metadata = await readArtifactMetadata(
    {
      kind: 'testflight-xcode',
      buildProfile: 'preview-testflight',
      artifactKind: 'xcarchive',
      upload: 'xcode',
    },
    archivePath,
    runId,
    log,
  );

  for (const step of steps.slice(archiveIndex + 1)) {
    const result = await runCommand(step, log);
    requireSuccess(result, step);
  }
  return { artifactPath: archivePath, metadata };
}

function relativeToProject(filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runIosBuild(spec: BuildSpec): Promise<number> {
  const startedAt = new Date();
  const runId = `${startedAt.getFullYear()}${String(startedAt.getMonth() + 1).padStart(2, '0')}${String(
    startedAt.getDate(),
  ).padStart(2, '0')}-${String(startedAt.getHours()).padStart(2, '0')}${String(
    startedAt.getMinutes(),
  ).padStart(2, '0')}${String(startedAt.getSeconds()).padStart(2, '0')}-${process.pid}`;
  const log = new IosBuildLog(spec, projectRoot, startedAt, runId);
  log.write(`fam iOS Build: ${spec.kind}\n`);
  log.write(`Start: ${startedAt.toISOString()}\n`);
  log.write(`EAS-Profil: ${spec.buildProfile}\n`);
  log.write(`Upload: ${spec.upload}\n`);
  log.write(`Vorläufiges Log: ${log.pendingRelativePath}\n`);

  let exitCode = 1;
  let metadata: BuildMetadata | undefined;
  let artifactPath: string | undefined;
  try {
    await readRemoteBuildNumber(spec, log);

    if (spec.kind === 'testflight-xcode') {
      const result = await runXcodeTestFlight(runId, log);
      artifactPath = result.artifactPath;
      metadata = result.metadata;
    } else {
      const result = await runLocalEasBuild(spec, runId, log);
      artifactPath = result.artifactPath;
      metadata = result.metadata;

      if (spec.upload === 'eas' && spec.submitProfile) {
        const submitStep: CommandStep = {
          command: 'bun',
          args: [
            'x',
            'eas-cli',
            'submit',
            '--platform',
            'ios',
            '--profile',
            spec.submitProfile,
            '--path',
            relativeToProject(artifactPath),
            '--non-interactive',
          ],
        };
        const submitResult = await runCommand(submitStep, log);
        requireSuccess(submitResult, submitStep);
      }
    }

    log.write(`App-Version: ${metadata.appVersion}\n`);
    log.write(`Buildnummer: ${metadata.buildNumber}\n`);
    log.write(`Bundle-ID: ${metadata.bundleIdentifier}\n`);
    log.write(`Artefakt: ${relativeToProject(artifactPath)}\n`);
    exitCode = 0;
  } catch (error) {
    exitCode = error instanceof BuildCommandError ? error.exitCode : 1;
    log.write(`\nFehler: ${errorMessage(error)}\n`);
  }

  const durationMs = Date.now() - startedAt.getTime();
  const finalLog = log.finalize({
    status: exitCode === 0 ? 'succeeded' : 'failed',
    exitCode,
    durationMs,
    metadata,
    artifactPath: artifactPath ? relativeToProject(artifactPath) : undefined,
  });
  process.stdout.write(`\nBuild ${exitCode === 0 ? 'fertig' : 'fehlgeschlagen'}.\n`);
  if (artifactPath) process.stdout.write(`Artefakt: ${relativeToProject(artifactPath)}\n`);
  process.stdout.write(`Logdatei: ${finalLog.relativePath}\n`);
  process.stdout.write(`Exit-Code: ${exitCode}\n`);
  return exitCode;
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseIosBuildArgs>;
  try {
    parsed = parseIosBuildArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = error instanceof BuildCommandError ? error.exitCode : 2;
    return;
  }

  if (parsed.kind === 'help') {
    process.stdout.write(`${IOS_BUILD_USAGE}\n`);
    return;
  }

  process.exitCode = await runIosBuild(parsed.spec);
}

if (process.argv[1]?.endsWith('scripts/ios-build/ios-build.ts')) {
  await main();
}
