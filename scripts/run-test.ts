#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../test_logs');
process.chdir(projectRoot);

function formatDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${String(date.getFullYear()).slice(-2)}`;
}

function nextExecutionNumber(): number {
  const testLogPattern = /^test_(\d+)_\d{2}-\d{2}-\d{2}\.log$/;
  let highestExecutionNumber = 0;

  for (const entry of fs.readdirSync(projectRoot)) {
    const match = testLogPattern.exec(entry);
    if (match) {
      highestExecutionNumber = Math.max(highestExecutionNumber, Number(match[1]));
    }
  }

  return highestExecutionNumber + 1;
}

function createLogFile(): { filePath: string; stream: fs.WriteStream } {
  let executionNumber = nextExecutionNumber();
  const date = formatDate();

  while (true) {
    const filePath = path.join(projectRoot, `test_${executionNumber}_${date}.log`);

    try {
      const fileDescriptor = fs.openSync(filePath, 'wx');
      const stream = fs.createWriteStream(filePath, {
        fd: fileDescriptor,
        autoClose: true,
      });
      return { filePath, stream };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        executionNumber += 1;
        continue;
      }
      throw error;
    }
  }
}

function writeToBoth(
  output: NodeJS.WritableStream,
  logStream: fs.WriteStream,
  chunk: Buffer,
): void {
  output.write(chunk);
  logStream.write(chunk);
}

const { filePath, stream: logStream } = createLogFile();
const relativeLogPath = path.relative(projectRoot, filePath);
const testArgs = process.argv.slice(2);
const dotenvCommand = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'dotenv.cmd' : 'dotenv',
);
const jestCommand = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'jest.cmd' : 'jest',
);

const runDescription = `Ausführung gestartet: bun run test${testArgs.length > 0 ? ` ${testArgs.join(' ')}` : ''}`;
logStream.write(`${runDescription}\nLogdatei: ${relativeLogPath}\n\n`);
console.log(runDescription);
console.log(`Logdatei: ${relativeLogPath}`);

const child = spawn(
  dotenvCommand,
  ['-o', '-e', '.env.development.local', '--', jestCommand, ...testArgs],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
    },
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  },
);

child.stdout?.on('data', (chunk: Buffer) => {
  writeToBoth(process.stdout, logStream, chunk);
});

child.stderr?.on('data', (chunk: Buffer) => {
  writeToBoth(process.stderr, logStream, chunk);
});

let hasFinished = false;

function finish(exitCode: number, summary: string): void {
  if (hasFinished) return;
  hasFinished = true;

  process.stdout.write(summary);
  logStream.write(summary);
  logStream.end(() => {
    process.exitCode = exitCode;
  });
}

child.on('error', (error) => {
  const message = `Testlauf konnte nicht gestartet werden: ${error.message}\n`;
  process.stderr.write(message);
  finish(1, message);
});

child.on('close', (code, signal) => {
  const exitCode = code ?? 1;
  const result = signal
    ? `Testlauf durch Signal ${signal} beendet (Exit-Code ${exitCode}).`
    : `Testlauf beendet (Exit-Code ${exitCode}).`;
  const summary = `\n${result}\nLogdatei: ${relativeLogPath}\n`;

  finish(exitCode, summary);
});
