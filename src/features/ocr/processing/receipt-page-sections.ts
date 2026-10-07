import type * as ExpoFileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { normalizedText } from './domain/layout';
import type { ReceiptOcrLine, ReceiptOcrOptions, ReceiptOcrResult } from './native';
import { ReceiptOcrError, recognizeReceiptOcr, validateReceiptOcrUri } from './native';
import { enhanceReceiptSection } from './receipt-contrast';

type NitroImageModule = Pick<typeof import('react-native-nitro-image'), 'Images' | 'loadImage'>;

type ReceiptSection = {
  start: number;
  end: number;
  coreStart: number;
  coreEnd: number;
};

const GERMAN_RECEIPT_OCR_OPTIONS = { languages: ['de-DE'] } as const;
const COMPLETE_AMOUNT = /\d{1,4}[,.]\d{2}(?!\d)/u;
const MULTIPLIED_UNIT_PRICE = /\d{1,4}[,.]\d{2}\s*€\s*[x×]\b/iu;
const PRICE_FRAGMENT = /^[\d.,€\s*+\-x×ABWEUR]+$/iu;
const AGREED_CONFIDENCE = 0.9;
const REVIEW_CONFIDENCE = 0.79;
const TARGET_LINE_HEIGHT_PX = 32;
const MAX_SECTION_UPSCALE = 2;
const MAX_SECTION_LONG_EDGE = 4_096;

// 059. Parses a complete printed decimal amount into integer euro cents.
function completeAmountCents(text: string): number | null {
  const amount = text.match(COMPLETE_AMOUNT)?.[0];
  if (!amount) return null;

  const cents = Math.round(Number(amount.replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

// 060. Reads the final complete amount from an OCR line, including optional tax marks.
function lineTotalCents(text: string): number | null {
  const trailingAmount = text.match(
    /(\d{1,4}[,.]\d{2})(?:\s*(?:€|EUR))?(?:\s*\*?(?:A|B|AW|BW))?\s*$/iu,
  )?.[1];
  return trailingAmount ? completeAmountCents(trailingAmount) : null;
}

// 061. Caps line confidence so a corrected whole-image amount remains reviewable.
function markForReview(line: ReceiptOcrLine): ReceiptOcrLine {
  return {
    ...line,
    confidence: Math.min(line.confidence ?? REVIEW_CONFIDENCE, REVIEW_CONFIDENCE),
  };
}

// 055. Defines three overlapping vertical OCR sections and their non-overlap cores.
export function receiptSections(imageHeight: number): readonly ReceiptSection[] {
  const overlap = Math.max(12, Math.round(imageHeight * 0.025));
  return Array.from({ length: 3 }, (_, index) => {
    const coreStart = Math.round((index * imageHeight) / 3);
    const coreEnd = Math.round(((index + 1) * imageHeight) / 3);
    return {
      start: Math.max(0, coreStart - overlap),
      end: Math.min(imageHeight, coreEnd + overlap),
      coreStart,
      coreEnd,
    };
  });
}

// 065. Upscales small printed lines within the configured scale and long-edge limits.
export function sectionUpscale(
  whole: ReceiptOcrResult | null,
  sectionWidth: number,
  sectionHeight: number,
): number {
  if (!whole) return 1;
  const heights = whole.lines
    .map(({ boundingBox }) => boundingBox.height * whole.imageSize.height)
    .filter((height) => height > 0)
    .sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)];
  if (!medianHeight || medianHeight >= TARGET_LINE_HEIGHT_PX) return 1;
  const longEdgeCap = MAX_SECTION_LONG_EDGE / Math.max(sectionWidth, sectionHeight);
  return Math.max(
    1,
    Math.min(MAX_SECTION_UPSCALE, TARGET_LINE_HEIGHT_PX / medianHeight, longEdgeCap),
  );
}

// 058. Projects section boxes onto the full image and keeps lines owned by that section core.
export function projectSectionLines(
  lines: readonly ReceiptOcrLine[],
  section: ReceiptSection,
  imageHeight: number,
): ReceiptOcrLine[] {
  const sectionHeight = section.end - section.start;
  return lines.flatMap((line) => {
    const center =
      section.start + (line.boundingBox.y + line.boundingBox.height / 2) * sectionHeight;
    if (center < section.coreStart || center >= section.coreEnd) return [];
    return [
      {
        ...line,
        boundingBox: {
          ...line.boundingBox,
          y: (section.start + line.boundingBox.y * sectionHeight) / imageHeight,
          height: (line.boundingBox.height * sectionHeight) / imageHeight,
        },
      },
    ];
  });
}

// 062. Checks whether two OCR boxes overlap enough on both axes to refer to one printed line.
function overlapping(left: ReceiptOcrLine, right: ReceiptOcrLine): boolean {
  const leftBox = left.boundingBox;
  const rightBox = right.boundingBox;
  const horizontal =
    Math.min(leftBox.x + leftBox.width, rightBox.x + rightBox.width) -
    Math.max(leftBox.x, rightBox.x);
  const vertical =
    Math.min(leftBox.y + leftBox.height, rightBox.y + rightBox.height) -
    Math.max(leftBox.y, rightBox.y);
  return (
    horizontal > Math.min(leftBox.width, rightBox.width) * 0.3 &&
    vertical > Math.min(leftBox.height, rightBox.height) * 0.3
  );
}

// 064. Confirms provider lines with unknown confidence when both OCR passes agree in text and place.
export function confirmByAgreement(
  whole: readonly ReceiptOcrLine[],
  sections: readonly ReceiptOcrLine[],
): ReceiptOcrLine[] {
  return whole.map((line) => {
    if (line.confidence !== null) return line;
    const comparable = normalizedText(line.text).toLowerCase();
    const agreed = sections.some(
      (candidate) =>
        overlapping(line, candidate) && normalizedText(candidate.text).toLowerCase() === comparable,
    );
    return agreed ? { ...line, confidence: AGREED_CONFIDENCE } : line;
  });
}

// 063. Merges supplementary price fragments while preserving whole-image text and conflicts.
export function mergeReceiptOcrLines(
  whole: readonly ReceiptOcrLine[],
  sections: readonly ReceiptOcrLine[],
): ReceiptOcrLine[] {
  let merged = [...whole];
  for (const candidate of sections) {
    if (candidate.boundingBox.x < 0.5 && !MULTIPLIED_UNIT_PRICE.test(candidate.text)) {
      continue;
    }
    const amount = candidate.text.match(COMPLETE_AMOUNT)?.[0];
    if (!amount) continue;
    const matches = merged.filter((line) => overlapping(line, candidate));
    if (matches.some((line) => line.text.includes(amount))) continue;
    const candidateAmountCents = completeAmountCents(candidate.text);
    const conflictingWholePrice =
      candidateAmountCents === null
        ? undefined
        : matches.find((line) => {
            const wholeAmountCents = lineTotalCents(line.text);
            return wholeAmountCents !== null && wholeAmountCents !== candidateAmountCents;
          });
    if (conflictingWholePrice) {
      merged = merged.map((line) => (line === conflictingWholePrice ? markForReview(line) : line));
      continue;
    }
    merged = merged.filter(
      (line) =>
        !overlapping(line, candidate) ||
        !(/[\d€]/u.test(line.text) && PRICE_FRAGMENT.test(line.text)),
    );
    // A price seen only in the supplementary pass is useful, but still needs review.
    merged.push({
      ...candidate,
      confidence: Math.min(candidate.confidence ?? REVIEW_CONFIDENCE, REVIEW_CONFIDENCE),
    });
  }
  return merged.sort(
    (left, right) =>
      left.boundingBox.y - right.boundingBox.y || left.boundingBox.x - right.boundingBox.x,
  );
}

// 049. Runs full-image OCR plus three local sections, then merges their observed lines.
export async function recognizeReceiptPageSections(
  uri: string,
  options: ReceiptOcrOptions = {},
): Promise<ReceiptOcrResult> {
  const localUri = validateReceiptOcrUri(uri);
  const ocrOptions = {
    ...options,
    languages: options.languages ?? GERMAN_RECEIPT_OCR_OPTIONS.languages,
  };
  let whole: ReceiptOcrResult | null = null;
  try {
    whole = await recognizeReceiptOcr(localUri, ocrOptions);
  } catch (error) {
    if (!(error instanceof ReceiptOcrError && error.code === 'NO_TEXT')) throw error;
  }
  let loadImage: NitroImageModule['loadImage'];
  let Images: NitroImageModule['Images'];
  let fileSystem: typeof ExpoFileSystem;
  let image: Awaited<ReturnType<typeof loadImage>>;
  try {
    ({ Images, loadImage } = require('react-native-nitro-image') as NitroImageModule);
    fileSystem = require('expo-file-system') as typeof ExpoFileSystem;
    image = await loadImage({ filePath: localUri.slice('file://'.length) });
  } catch {
    if (whole) return whole;
    return recognizeReceiptOcr(localUri, ocrOptions);
  }
  if (image.height < 3) {
    if (whole) return whole;
    return recognizeReceiptOcr(localUri, ocrOptions);
  }

  const lines: ReceiptOcrLine[] = [];
  for (const section of receiptSections(image.height)) {
    let cropUri: string;
    try {
      const crop = await image.cropAsync(0, section.start, image.width, section.end);
      const scale = sectionUpscale(whole, crop.width, crop.height);
      const sized =
        scale === 1
          ? crop
          : await crop.resizeAsync(Math.round(crop.width * scale), Math.round(crop.height * scale));
      let ocrImage = sized;
      if (Platform.OS === 'ios') {
        try {
          const enhanced = enhanceReceiptSection(await sized.toRawPixelDataAsync());
          if (enhanced) ocrImage = await Images.loadFromRawPixelDataAsync(enhanced);
        } catch {
          ocrImage = sized;
        }
      }
      const path = await ocrImage.saveToTemporaryFileAsync('png');
      cropUri = path.startsWith('file://') ? path : `file://${path}`;
    } catch {
      if (whole) return whole;
      return recognizeReceiptOcr(localUri, ocrOptions);
    }

    try {
      const result = await recognizeReceiptOcr(cropUri, ocrOptions);
      lines.push(...projectSectionLines(result.lines, section, image.height));
    } catch (error) {
      if (!(error instanceof ReceiptOcrError && error.code === 'NO_TEXT')) throw error;
    } finally {
      const file = new fileSystem.File(cropUri);
      if (file.info().exists) file.delete();
    }
  }

  if (whole) {
    return { ...whole, lines: mergeReceiptOcrLines(confirmByAgreement(whole.lines, lines), lines) };
  }
  if (lines.length > 0) {
    return { imageSize: { width: image.width, height: image.height }, lines };
  }
  return recognizeReceiptOcr(localUri, ocrOptions);
}
