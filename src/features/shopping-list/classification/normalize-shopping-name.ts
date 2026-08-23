/** Eigenes Wortzeichen-Set, da JavaScripts `\w` keine Umlaute umfasst. */
const WORD_CHAR = /[a-z0-9äöüß]/;

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
  'dose',
  'flasche',
  'beutel',
  'bund',
  'paar',
]);

const QUANTITY_TOKEN = /^\d+([.,]\d+)?[a-zäöüß]*$/;

export function normalizeShoppingName(name: string): string[] {
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
