import type { ReceiptDraftField } from '../types';
import { parseMoneyTokens } from './common';
import { emptyField, field, type MoneyToken, type NormalizedLine, scaleConfidence } from './input';

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
export function normalizeRossmannArtifacts(
  line: NormalizedLine,
  tokens: readonly MoneyToken[],
  subtotalCents: number | null,
): readonly MoneyToken[] {
  if (subtotalCents === null) {
    return tokens;
  }

  const hasTaxCodeSuffix = /(?:^|\s)(?:A|B|AW|BW)\s*$/iu.test(line.text);

  return tokens.map((token) => {
    const raw = line.text.slice(token.start, token.end).replace(/\s+/g, '');
    const isLeadingEightArtifact = hasTaxCodeSuffix && /^8\d+[,.]\d{2}$/u.test(raw);
    const isLeadingSixArtifact = /^6\d+[,.]\d{2}$/u.test(raw) && token.cents > subtotalCents;
    const prefix = line.text.slice(0, token.start);
    const isMisreadZeroPrice = /(?:^|\s)C0\.\s*$/iu.test(prefix) && /^1[,.]\d{2}$/u.test(raw);
    if (!isLeadingEightArtifact && !isLeadingSixArtifact && !isMisreadZeroPrice) {
      return token;
    }

    const withoutMisreadCurrencyGlyph = parseMoneyTokens(
      isMisreadZeroPrice ? raw.replace(/^1/u, '0') : raw.slice(1),
    )[0];
    if (
      !withoutMisreadCurrencyGlyph ||
      withoutMisreadCurrencyGlyph.cents >= token.cents ||
      withoutMisreadCurrencyGlyph.cents > subtotalCents
    ) {
      return token;
    }

    return {
      ...token,
      cents: withoutMisreadCurrencyGlyph.cents,
      repaired: true,
    };
  });
}
export function isKnownMarketLine(text: string): boolean {
  return MARKET_ALIASES.some(({ pattern }) => pattern.test(text));
}
export function findMarket(lines: readonly NormalizedLine[]): ReceiptDraftField<string> {
  for (const line of lines) {
    const alias = MARKET_ALIASES.find(({ pattern }) => pattern.test(line.text));
    if (alias) {
      return field(alias.value, scaleConfidence(line.confidence, 0.98), line.index, line.text);
    }
  }

  return emptyField();
}
