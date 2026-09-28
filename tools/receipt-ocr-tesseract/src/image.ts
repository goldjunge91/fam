import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export type NormalizedReceiptImage = {
  path: string;
  width: number;
  height: number;
  byteSize: number;
  preprocessing: 'rotate-grayscale-normalize-threshold-160' | 'none';
};

export async function normalizeReceiptImage(
  inputPath: string,
  runtimeDirectory: string,
  preprocessing: NormalizedReceiptImage['preprocessing'],
): Promise<NormalizedReceiptImage> {
  const metadata = await sharp(inputPath).metadata();
  const inputStats = await stat(inputPath);
  if (!metadata.width || !metadata.height) {
    throw new Error(`Bildabmessungen konnten nicht gelesen werden: ${inputPath}`);
  }

  if (preprocessing === 'none') {
    return {
      path: inputPath,
      width: metadata.width,
      height: metadata.height,
      byteSize: inputStats.size,
      preprocessing,
    };
  }

  await mkdir(runtimeDirectory, { recursive: true });
  const outputPath = join(runtimeDirectory, `${randomUUID()}.png`);
  const output = await sharp(inputPath)
    .rotate()
    .grayscale()
    .normalize()
    .threshold(160)
    .png()
    .toFile(outputPath);

  return {
    path: outputPath,
    width: output.width,
    height: output.height,
    byteSize: output.size,
    preprocessing,
  };
}

export async function removeNormalizedReceiptImage(path: string): Promise<void> {
  await rm(path, { force: true });
}
