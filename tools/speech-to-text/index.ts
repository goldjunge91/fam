#!/usr/bin/env bun

import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  buildAudioPlan,
  normalizeSpeechRecords,
  parseCliArgs,
  parseInputRecords,
  type AudioFormat,
  type AudioGeneratorOptions,
  type AudioPlan,
  type CommandPlan,
  type InputFormat,
} from './core';

const execFileAsync = promisify(execFile);
const MANIFEST_FILENAME = 'manifest.json';

const USAGE = `
JSON/CSV -> speech audio for speech-to-text testing

Usage:
  bun run tools/speech-to-text/index.ts <input.json|input.csv> [options]

Options:
  --output-dir <dir>     Output directory (default: <input>-audio)
  --formats <list>       wav, mp3, or wav,mp3 (default: wav)
  --voice <name>         macOS say voice (default: Anna)
  --rate <number>        Words per minute (default: 175)
  --sample-rate <hz>     WAV sample rate (default: 16000)
  --text-field <name>    Text field (auto-detects text/sentence/prompt/...)
  --id-field <name>      ID field used for filenames (default: id)
  --delimiter <char>     CSV delimiter (default: ,; use ';' for German CSV)
  --force                Overwrite generated files and manifest
  --keep-aiff            Keep intermediate AIFF files
  --dry-run              Print commands without invoking macOS tools
  -h, --help             Show this help

The real audio path is macOS-only and uses /usr/bin/say and afconvert.
MP3 output additionally requires ffmpeg.
`;

type Manifest = {
  generatedAt: string;
  sourceFile: string;
  recordCount: number;
  settings: {
    formats: AudioFormat[];
    voice: string;
    rate: number;
    sampleRate: number;
    channels: 1;
  };
  records: Array<{
    id: string;
    text: string;
    files: Partial<Record<AudioFormat, string>>;
  }>;
};

function detectInputFormat(inputPath: string): InputFormat {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === '.json') return 'json';
  if (extension === '.csv') return 'csv';
  throw new Error('Input must have a .json or .csv extension.');
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function formatCommand(command: CommandPlan): string {
  return [command.program, ...command.args].map(shellQuote).join(' ');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function checkOutputTargets(
  plans: AudioPlan[],
  options: AudioGeneratorOptions,
  manifestPath: string,
): Promise<void> {
  const targets = [
    manifestPath,
    ...plans.flatMap((plan) => [
      ...options.formats.map((format) => (format === 'wav' ? plan.wavPath : plan.mp3Path)),
      ...(options.keepAiff ? [plan.aiffPath] : []),
    ]),
  ];
  const existingTargets = (
    await Promise.all(targets.map(async (target) => ((await pathExists(target)) ? target : null)))
  ).filter((target): target is string => target !== null);

  if (existingTargets.length > 0 && !options.force) {
    throw new Error(
      `Output already exists: ${existingTargets[0]}. Use --force to overwrite generated files.`,
    );
  }

  if (options.force) {
    await Promise.all(existingTargets.map((target) => rm(target, { force: true })));
  }
}

function manifestForPlans(
  plans: AudioPlan[],
  options: AudioGeneratorOptions,
  inputPath: string,
): Manifest {
  return {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(inputPath),
    recordCount: plans.length,
    settings: {
      formats: options.formats,
      voice: options.voice,
      rate: options.rate,
      sampleRate: options.sampleRate,
      channels: 1,
    },
    records: plans.map((plan) => ({
      id: plan.record.id,
      text: plan.record.text,
      files: Object.fromEntries(
        options.formats.map((format) => [format, `${plan.stem}.${format}`]),
      ) as Partial<Record<AudioFormat, string>>,
    })),
  };
}

async function runCommand(command: CommandPlan, dryRun: boolean): Promise<void> {
  console.log(`$ ${formatCommand(command)}`);
  if (dryRun) return;

  try {
    await execFileAsync(command.program, command.args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    const details =
      typeof error === 'object' &&
      error !== null &&
      'stderr' in error &&
      typeof error.stderr === 'string'
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`Command failed: ${command.program}${details ? `\n${details}` : ''}`);
  }
}

function printDryRun(plans: AudioPlan[], options: AudioGeneratorOptions, inputPath: string): void {
  console.log(`Input:   ${inputPath}`);
  console.log(`Output:  ${path.resolve(options.outputDir)}`);
  console.log(`Records: ${plans.length}`);
  console.log(`Formats: ${options.formats.join(', ')}`);
  console.log('');

  plans.forEach((plan, index) => {
    console.log(`[${index + 1}/${plans.length}] ${plan.record.id}: ${plan.record.text}`);
    plan.commands.forEach((command) => console.log(`  $ ${formatCommand(command)}`));
  });
}

async function generateAudio(plans: AudioPlan[], outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  for (const [index, plan] of plans.entries()) {
    console.log(`[${index + 1}/${plans.length}] ${plan.record.id}`);
    for (const command of plan.commands) await runCommand(command, false);
  }
}

export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(USAGE.trim());
    return;
  }
  if (!options.inputPath) throw new Error('Input is required. Use --help for usage.');
  if (!options.outputDir) throw new Error('Output directory could not be determined.');

  const inputPath = path.resolve(options.inputPath);
  const outputDir = path.resolve(options.outputDir);
  const inputFormat = detectInputFormat(inputPath);
  const source = await readFile(inputPath, 'utf8');
  const rawRecords = parseInputRecords(source, {
    format: inputFormat,
    delimiter: options.delimiter,
  });
  const records = normalizeSpeechRecords(rawRecords, {
    textField: options.textField,
    idField: options.idField,
  });

  if (records.length === 0) throw new Error('Input contains no records.');

  const dryRunTempDir = path.join(outputDir, '.speech-to-text-tmp');
  const plans = buildAudioPlan(records, { ...options, inputPath, outputDir }, dryRunTempDir);

  if (options.dryRun) {
    printDryRun(plans, options, inputPath);
    return;
  }

  if (process.platform !== 'darwin') {
    throw new Error('Audio generation requires macOS because it uses /usr/bin/say and afconvert.');
  }

  await mkdir(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
  await checkOutputTargets(plans, options, manifestPath);

  const tempDir = options.keepAiff ? null : await mkdtemp(path.join(outputDir, '.speech-to-text-'));
  try {
    const generatedPlans = buildAudioPlan(
      records,
      { ...options, inputPath, outputDir },
      tempDir ?? path.join(outputDir, '.speech-to-text-tmp'),
    );
    await generateAudio(generatedPlans, outputDir);

    const manifest = manifestForPlans(generatedPlans, options, inputPath);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Generated ${generatedPlans.length} record(s) in ${outputDir}`);
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
