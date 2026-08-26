const WORD_CHAR = /[\p{L}\p{N}]/u;

const UNIT_TOKENS = new Set([
  'g',
  'kg',
  'mg',
  'ml',
  'l',
  'cl',
  'stk',
  'stück',
  'stueck',
  'packung',
  'pkg',
  'pck',
  'flasche',
  'bund',
  'paar',
]);

/** `"500g"`, `"2"`, `"1,5l"` — Zahl, optional gefolgt von einer Einheit. */
const QUANTITY_TOKEN = /^\d+([.,]\d+)?[a-zäöüß]*$/;

export function normalizeShoppingName(name: string): string[] {
  // `name: string` ist der TS-Vertrag, aber Aufrufer wie der Namens-Fallback
  // reichen Daten aus externen Quellen durch (z.B. ein kaputter Barcode-
  // Datensatz) — ein hartes `undefined` hier crasht sonst statt einfach kein
  // Tokensignal zu liefern (dasselbe Prinzip wie off_category_tags-Handling).
  if (typeof name !== 'string' || name.length === 0) return [];

  const normalized = name.normalize('NFC').toLowerCase();

  const tokens: string[] = [];
  let current = '';
  for (const char of normalized) {
    if (WORD_CHAR.test(char)) {
      current += char;
    } else if (current) {
      tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);

  return tokens.filter((token) => !UNIT_TOKENS.has(token) && !QUANTITY_TOKEN.test(token));
}
