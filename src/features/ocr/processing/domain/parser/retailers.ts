import type { ReceiptDraftField } from '../types';
import { emptyField, field, type NormalizedLine, scaleConfidence } from './input';

const MARKET_ALIASES = [
  { pattern: /\baldi\s*(?:süd|sued)\b/i, value: 'ALDI SÜD' },
  { pattern: /\baldi\s+nord\b/i, value: 'ALDI NORD' },
  { pattern: /\be{1,2}deka\b/i, value: 'EDEKA' },
  { pattern: /\bka[u\u00a0]?fland\b/i, value: 'KAUFLAND' },
  { pattern: /\blidl\b/i, value: 'LIDL' },
  { pattern: /\bnetto\b/i, value: 'NETTO' },
  { pattern: /\bpenny\b/i, value: 'PENNY' },
  { pattern: /\brewe\b/i, value: 'REWE' },
  { pattern: /\brossmann\b/i, value: 'ROSSMANN' },
  { pattern: /\bdm\b/i, value: 'dm' },
] as const;
// 103. Checks whether a line contains one of the configured market aliases.
export function isKnownMarketLine(text: string): boolean {
  return MARKET_ALIASES.some(({ pattern }) => pattern.test(text));
}
// 104. Finds the first recognized market line and preserves its source evidence.
export function findMarket(lines: readonly NormalizedLine[]): ReceiptDraftField<string> {
  for (const line of lines) {
    const alias = MARKET_ALIASES.find(({ pattern }) => pattern.test(line.text));
    if (alias) {
      return field(alias.value, scaleConfidence(line.confidence, 0.98), line.index, line.text);
    }
  }

  return emptyField();
}
