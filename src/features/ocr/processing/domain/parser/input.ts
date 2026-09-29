import { normalizedText, reconstructReceiptLines } from '../layout';
import type {
  ReceiptConfidence,
  ReceiptDraftField,
  ReceiptOcrLine,
  ReceiptOcrPage,
} from '../types';
import { RECEIPT_DRAFT_REVIEW_CONFIDENCE } from '../types';

export type ParserInput = string | readonly ReceiptOcrLine[] | readonly ReceiptOcrPage[];

export type NormalizedLine = {
  index: number;
  text: string;
  confidence: ReceiptConfidence;
};

export type MoneyToken = {
  cents: number;
  negative: boolean;
  start: number;
  end: number;
  repaired?: boolean;
};

export type ObservedLineTotal = {
  cents: number;
  confidence: ReceiptConfidence;
  evidence: string;
};

const BARCODE_TOKEN_PATTERN = /\b\d{8,14}\b/g;
// 096. Clamps finite OCR confidence to the supported range and preserves unknown values.
export function normalizeConfidence(value: ReceiptConfidence): ReceiptConfidence {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

// 097. Scales known confidence and normalizes the result to the supported range.
export function scaleConfidence(value: ReceiptConfidence, factor: number): ReceiptConfidence {
  return value === null ? null : normalizeConfidence(value * factor);
}

// 098. Splits repeated barcode segments while retaining any leading quantity marker.
function splitBarcodePrefixedLine(
  line: Omit<NormalizedLine, 'index'>,
): readonly Omit<NormalizedLine, 'index'>[] {
  const matches = [...line.text.matchAll(BARCODE_TOKEN_PATTERN)];
  if (matches.length < 2) {
    return [line];
  }

  const firstMatchIndex = matches[0]?.index;
  if (firstMatchIndex === undefined) {
    return [line];
  }

  const prefix = line.text.slice(0, firstMatchIndex);
  const quantityPrefix = prefix.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*$/i);
  const segments = matches.flatMap((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? line.text.length;
    const barcodeSegment = line.text.slice(start, end).trim();
    const text =
      index === 0 && quantityPrefix ? `${quantityPrefix[1]}X ${barcodeSegment}` : barcodeSegment;
    return text.length > 0 ? [{ text, confidence: line.confidence }] : [];
  });

  return segments.length > 0 ? segments : [line];
}

// 066. Converts text, line, or page input into indexed normalized parser lines.
export function normalizeInput(input: ParserInput): readonly NormalizedLine[] {
  const sourceLines =
    typeof input === 'string'
      ? input.split(/\r?\n/).map((text) => ({
          text: normalizedText(text),
          // Plain text has no native provider confidence. Keep it unknown instead
          // of presenting a non-OCR input as a certain recognition result.
          confidence: null,
        }))
      : reconstructReceiptLines(input).map((line) => ({
          text: normalizedText(line.text),
          confidence: normalizeConfidence(line.confidence),
        }));

  return sourceLines.flatMap(splitBarcodePrefixedLine).map((line, index) => ({ ...line, index }));
}

// 099. Creates a missing draft field with review required and no source evidence.
export function emptyField<T>(): ReceiptDraftField<T> {
  return {
    value: null,
    confidence: null,
    sourceLineIndex: null,
    evidence: null,
    needsReview: true,
  };
}

// 100. Builds a draft field with normalized confidence and its originating evidence.
export function field<T>(
  value: T,
  confidence: ReceiptConfidence,
  sourceLineIndex: number,
  evidence: string,
): ReceiptDraftField<T> {
  const normalizedConfidence = normalizeConfidence(confidence);
  return {
    value,
    confidence: normalizedConfidence,
    sourceLineIndex,
    evidence,
    needsReview:
      normalizedConfidence === null || normalizedConfidence < RECEIPT_DRAFT_REVIEW_CONFIDENCE,
  };
}

// 101. Records a missing value against the line that was considered as evidence.
export function missingField<T>(line: NormalizedLine): ReceiptDraftField<T> {
  return {
    value: null,
    confidence: line.confidence,
    sourceLineIndex: line.index,
    evidence: line.text,
    needsReview: true,
  };
}
