import { parseMoneyTokens } from '../common';
import type { MoneyToken, NormalizedLine } from '../input';

// 117. Repairs Rossmann price and barcode-name artifacts only when a subtotal is observed.
export function normalizeRossmannArtifacts(
  line: NormalizedLine,
  tokens: readonly MoneyToken[],
  subtotalCents: number | null,
  hasBarcodePrefix: boolean,
): { tokens: readonly MoneyToken[]; itemNamePrefix: string | null } {
  if (subtotalCents === null) {
    return { tokens, itemNamePrefix: null };
  }

  const hasTaxCodeSuffix = /(?:^|\s)(?:A|B|AW|BW)\s*$/iu.test(line.text);

  const repairedTokens = tokens.map((token) => {
    const raw = line.text.slice(token.start, token.end).replace(/\s+/g, '');
    const isLeadingEightArtifact = hasTaxCodeSuffix && /^8\d+[,.]\d{2}$/u.test(raw);
    const isLeadingSixArtifact = /^6\d+[,.]\d{2}$/u.test(raw) && token.cents > subtotalCents;
    const prefix = line.text.slice(0, token.start);
    const isMisreadZeroPrice =
      /(?:^|\s)(?:C0\.|€0)\s*$/iu.test(prefix) && /^1[,.]\d{2}$/u.test(raw);
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
  const firstToken = repairedTokens[0];
  const itemNamePrefix =
    hasBarcodePrefix && firstToken
      ? line.text
          .slice(0, firstToken.start)
          .replace(/\s+C0\.\s*$/iu, '')
          .trim()
      : null;

  return { tokens: repairedTokens, itemNamePrefix };
}
