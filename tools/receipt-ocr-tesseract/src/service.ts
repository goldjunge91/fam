import { readFile } from 'node:fs/promises';
import { compareOcrLines, type OcrComparison, type ReferenceLine } from './compare.ts';
import { compareOcrToGold, type GoldComparison } from './gold.ts';
import {
  normalizeReceiptImage,
  removeNormalizedReceiptImage,
  type NormalizedReceiptImage,
} from './image.ts';
import { normalizeOcrText, parseTesseractTsv, type ParsedTsv } from './tsv.ts';

export type OcrServiceOptions = {
  language: string;
  psm: number;
  preprocessing: NormalizedReceiptImage['preprocessing'];
  inputName: string;
  runtimeDirectory: string;
  referenceLines?: readonly ReferenceLine[] | null;
  gold?: unknown;
  includePreview?: boolean;
};

export type OcrReport = {
  schemaVersion: 1;
  engine: 'tesseract';
  engineVersion: string;
  language: string;
  pageSegmentationMode: number;
  input: string;
  normalizedImage: Omit<NormalizedReceiptImage, 'path'>;
  durationMs: number;
  text: string;
  normalizedText: string;
  lines: ParsedTsv['lines'];
  comparison?: OcrComparison;
  goldComparison?: GoldComparison | null;
  normalizedImageDataUrl?: string;
};

async function runCommand(
  command: readonly string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const child = Bun.spawn([...command], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function recognize(
  inputPath: string,
  language: string,
  psm: number,
): Promise<{ parsed: ParsedTsv; engineVersion: string; durationMs: number }> {
  const startedAt = performance.now();
  const binary = process.env.TESSERACT_BIN ?? 'tesseract';
  const result = await runCommand([
    binary,
    inputPath,
    'stdout',
    '-l',
    language,
    '--psm',
    String(psm),
    'tsv',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`Tesseract fehlgeschlagen (${result.exitCode}): ${result.stderr.trim()}`);
  }

  const versionResult = await runCommand([binary, '--version']);
  return {
    parsed: parseTesseractTsv(result.stdout),
    engineVersion: versionResult.stdout.split(/\r?\n/)[0]?.trim() || 'unbekannt',
    durationMs: Math.round(performance.now() - startedAt),
  };
}

export async function runOcrReport(
  inputPath: string,
  options: OcrServiceOptions,
): Promise<OcrReport> {
  const normalizedImage = await normalizeReceiptImage(
    inputPath,
    options.runtimeDirectory,
    options.preprocessing,
  );
  try {
    const result = await recognize(normalizedImage.path, options.language, options.psm);
    const report: OcrReport = {
      schemaVersion: 1,
      engine: 'tesseract',
      engineVersion: result.engineVersion,
      language: options.language,
      pageSegmentationMode: options.psm,
      input: options.inputName,
      normalizedImage: {
        width: normalizedImage.width,
        height: normalizedImage.height,
        byteSize: normalizedImage.byteSize,
        preprocessing: normalizedImage.preprocessing,
      },
      durationMs: result.durationMs,
      text: result.parsed.text,
      normalizedText: normalizeOcrText(result.parsed.text),
      lines: result.parsed.lines,
      ...(options.referenceLines
        ? { comparison: compareOcrLines(options.referenceLines, result.parsed.lines) }
        : {}),
      ...(options.gold !== undefined
        ? { goldComparison: compareOcrToGold(options.gold, options.inputName, result.parsed.lines) }
        : {}),
    };

    if (options.includePreview) {
      const image = await readFile(normalizedImage.path);
      const mimeType =
        normalizedImage.preprocessing === 'none' && /\.png$/iu.test(options.inputName)
          ? 'image/png'
          : normalizedImage.preprocessing === 'none'
            ? 'image/jpeg'
            : 'image/png';
      report.normalizedImageDataUrl = `data:${mimeType};base64,${image.toString('base64')}`;
    }
    return report;
  } finally {
    if (normalizedImage.preprocessing !== 'none') {
      await removeNormalizedReceiptImage(normalizedImage.path);
    }
  }
}
