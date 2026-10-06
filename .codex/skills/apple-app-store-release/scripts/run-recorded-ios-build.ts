#!/usr/bin/env bun
import path from 'node:path';
import { runRecordedBuild } from './build-run-recorder';

type BuildMode = 'cloud' | 'local';

function readOption(args: string[], name: string): [string, string[]] {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    throw new Error(`Missing required option: ${name}`);
  }
  const value = args[index + 1];
  return [value, [...args.slice(0, index), ...args.slice(index + 2)]];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const separator = args.indexOf('--');
  if (separator < 0 || separator === args.length - 1) {
    throw new Error('Provide the build command after --.');
  }
  const buildCommand = args.slice(separator + 1);
  let options = args.slice(0, separator);
  let mode: string;
  let profile: string;
  let workflowDir = path.resolve(__dirname, '../../../../build/workflows/ios');
  [mode, options] = readOption(options, '--mode');
  [profile, options] = readOption(options, '--profile');
  if (options.includes('--workflow-dir')) {
    [workflowDir, options] = readOption(options, '--workflow-dir');
  }
  if (options.length > 0) throw new Error(`Unexpected option: ${options[0]}`);
  if (mode !== 'local' && mode !== 'cloud') {
    throw new Error(`Unsupported EAS build mode: ${mode}`);
  }
  if (process.env.GITHUB_ACTIONS === 'true' && !process.env.GITHUB_RUN_NUMBER) {
    throw new Error('GITHUB_RUN_NUMBER is required in GitHub Actions.');
  }

  const exitCode = await runRecordedBuild({
    workflowDir,
    mode: mode as BuildMode,
    profile,
    githubRunNumber:
      process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_RUN_NUMBER : undefined,
    command: buildCommand[0],
    args: buildCommand.slice(1),
    cwd: process.cwd(),
  });
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown iOS build workflow error.';
  process.stderr.write(`iOS build workflow error: ${message}\n`);
  process.exitCode = 75;
});
