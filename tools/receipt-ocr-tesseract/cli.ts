import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { referenceLinesFromJson } from './src/compare.ts';
import { runOcrReport } from './src/service.ts';
import type { NormalizedReceiptImage } from './src/image.ts';

type CliOptions = {
  inputs: string[];
  language: string;
  outputDirectory: string;
  psm: number;
  referencePath: string | null;
  preprocessing: NormalizedReceiptImage['preprocessing'];
};

const usage = `
Lokales Receipt-OCR-Testtool

Aufruf:
  bun cli.ts <bild...> [--output-dir <ordner>] [--reference <native.json>]

Optionen:
  --lang <code>       Tesseract-Sprache, Standard: deu
  --psm <number>      Page segmentation mode, Standard: 6
  --preprocess <mode> Bildaufbereitung: receipt oder none, Standard: receipt
  --output-dir <dir>  JSON-Reports, Standard: ./reports
  --reference <file>  Native-Report mit native_lines oder lines zum Vergleichen
`;

function fail(message: string): never {
  throw new Error(`${message}\n${usage}`);
}

function parsePositiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 13) {
    fail(`${option} muss eine ganze Zahl zwischen 0 und 13 sein.`);
  }
  return parsed;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const inputs: string[] = [];
  let language = 'deu';
  let outputDirectory = 'reports';
  let psm = 6;
  let referencePath: string | null = null;
  let preprocessing: CliOptions['preprocessing'] = 'rotate-grayscale-normalize-threshold-160';

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;

    if (argument === '--lang') {
      language = argv[++index] ?? fail('--lang benötigt einen Wert.');
      if (!/^[a-z0-9_+-]+$/iu.test(language)) fail('Ungültiger Tesseract-Sprachcode.');
      continue;
    }
    if (argument === '--psm') {
      psm = parsePositiveInteger(argv[++index] ?? fail('--psm benötigt einen Wert.'), '--psm');
      continue;
    }
    if (argument === '--output-dir') {
      outputDirectory = argv[++index] ?? fail('--output-dir benötigt einen Wert.');
      continue;
    }
    if (argument === '--preprocess') {
      const value = argv[++index] ?? fail('--preprocess benötigt einen Wert.');
      if (value === 'receipt') preprocessing = 'rotate-grayscale-normalize-threshold-160';
      else if (value === 'none') preprocessing = 'none';
      else fail('--preprocess muss receipt oder none sein.');
      continue;
    }
    if (argument === '--reference') {
      referencePath = argv[++index] ?? fail('--reference benötigt einen Wert.');
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      console.log(usage);
      process.exit(0);
    }
    if (argument.startsWith('-')) fail(`Unbekannte Option: ${argument}`);
    inputs.push(argument);
  }

  if (inputs.length === 0) fail('Mindestens ein Bildpfad ist erforderlich.');
  return { inputs, language, outputDirectory, psm, referencePath, preprocessing };
}

async function assertInputFile(inputPath: string): Promise<string> {
  const absolutePath = resolve(inputPath);
  const details = await stat(absolutePath).catch(() => null);
  if (!details?.isFile()) throw new Error(`Bilddatei nicht gefunden: ${inputPath}`);
  return absolutePath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const referenceLines = options.referencePath
    ? referenceLinesFromJson(JSON.parse(await readFile(options.referencePath, 'utf8')) as unknown)
    : null;
  await mkdir(options.outputDirectory, { recursive: true });
  const runtimeDirectory = resolve('.runtime');

  for (const input of options.inputs) {
    const inputPath = await assertInputFile(input);
    const report = await runOcrReport(inputPath, {
      language: options.language,
      psm: options.psm,
      preprocessing: options.preprocessing,
      inputName: input,
      runtimeDirectory,
      referenceLines,
    });
    const outputPath = resolve(options.outputDirectory, `${basename(inputPath)}.tesseract.json`);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(
      `${basename(inputPath)}: ${report.lines.length} Zeilen, ${report.durationMs} ms → ${outputPath}`,
    );
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
