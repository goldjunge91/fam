import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { createRedactor } from '../../.codex/skills/apple-app-store-release/scripts/build-run-recorder';
import {
  type BuildMetadata,
  type BuildSpec,
  buildLogFileName,
  pendingBuildLogFileName,
} from './ios-build-cli';

export type BuildLogStatus = 'succeeded' | 'failed';

export interface BuildLogResult {
  absolutePath: string;
  relativePath: string;
}

export interface FinalizeBuildLogInput {
  status: BuildLogStatus;
  exitCode: number;
  durationMs: number;
  metadata?: BuildMetadata;
  artifactPath?: string;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function uniquePath(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const extension = path.extname(filePath);
  const stem = filePath.slice(0, -extension.length);
  let suffix = 2;
  while (fs.existsSync(`${stem}-${suffix}${extension}`)) suffix += 1;
  return `${stem}-${suffix}${extension}`;
}

export class IosBuildLog {
  private readonly projectRoot: string;
  private readonly logDirectory: string;
  private readonly startedAt: Date;
  private readonly spec: BuildSpec;
  private readonly stdoutDecoder = new StringDecoder('utf8');
  private readonly stderrDecoder = new StringDecoder('utf8');
  private readonly redactStdout: (chunk: string, final?: boolean) => string;
  private readonly redactStderr: (chunk: string, final?: boolean) => string;
  private readonly pendingPath: string;
  private stdoutTerminal: NodeJS.WritableStream | null = null;
  private stderrTerminal: NodeJS.WritableStream | null = null;
  private finalized = false;

  constructor(
    spec: BuildSpec,
    projectRoot: string,
    startedAt = new Date(),
    runId = `${Date.now()}-${process.pid}`,
    environment: NodeJS.ProcessEnv = process.env,
  ) {
    this.spec = spec;
    this.projectRoot = projectRoot;
    this.logDirectory = path.join(projectRoot, 'logs', 'builds');
    this.startedAt = startedAt;
    this.redactStdout = createRedactor(environment);
    this.redactStderr = createRedactor(environment);

    fs.mkdirSync(this.logDirectory, { recursive: true });
    this.pendingPath = uniquePath(
      path.join(this.logDirectory, pendingBuildLogFileName(spec, startedAt, runId)),
    );
    fs.writeFileSync(this.pendingPath, '', { flag: 'wx' });
  }

  get pendingRelativePath(): string {
    return toPosixPath(path.relative(this.projectRoot, this.pendingPath));
  }

  write(text: string): void {
    if (this.finalized) throw new Error('Das Build-Log ist bereits abgeschlossen.');
    if (text.length > 0) fs.appendFileSync(this.pendingPath, text, 'utf8');
  }

  appendChildOutput(
    channel: 'stdout' | 'stderr',
    chunk: Buffer,
    terminal: NodeJS.WritableStream,
  ): void {
    if (this.finalized) throw new Error('Das Build-Log ist bereits abgeschlossen.');

    const decoder = channel === 'stdout' ? this.stdoutDecoder : this.stderrDecoder;
    const redact = channel === 'stdout' ? this.redactStdout : this.redactStderr;
    if (channel === 'stdout') this.stdoutTerminal = terminal;
    else this.stderrTerminal = terminal;
    const safeText = redact(decoder.write(chunk));
    if (safeText.length === 0) return;

    terminal.write(safeText);
    this.write(safeText);
  }

  private flushChildOutput(): void {
    const stdout = this.redactStdout(this.stdoutDecoder.end(), true);
    const stderr = this.redactStderr(this.stderrDecoder.end(), true);
    if (stdout.length > 0) this.stdoutTerminal?.write(stdout);
    if (stderr.length > 0) this.stderrTerminal?.write(stderr);
    this.write(stdout);
    this.write(stderr);
  }

  finalize(input: FinalizeBuildLogInput): BuildLogResult {
    if (this.finalized) throw new Error('Das Build-Log ist bereits abgeschlossen.');
    this.flushChildOutput();

    this.write(`\nStatus: ${input.status}\n`);
    this.write(`Exit-Code: ${input.exitCode}\n`);
    this.write(`Dauer: ${input.durationMs}ms\n`);
    if (input.metadata) {
      this.write(`App-Version: ${input.metadata.appVersion}\n`);
      this.write(`Buildnummer: ${input.metadata.buildNumber}\n`);
      this.write(`Bundle-ID: ${input.metadata.bundleIdentifier}\n`);
    } else {
      this.write('App-Version: unknown\nBuildnummer: unknown\n');
    }
    if (input.artifactPath) this.write(`Artefakt: ${input.artifactPath}\n`);

    const finalName = buildLogFileName(this.spec, this.startedAt, input.metadata);
    const finalPath = uniquePath(path.join(this.logDirectory, finalName));
    fs.renameSync(this.pendingPath, finalPath);
    this.finalized = true;

    return {
      absolutePath: finalPath,
      relativePath: toPosixPath(path.relative(this.projectRoot, finalPath)),
    };
  }
}
