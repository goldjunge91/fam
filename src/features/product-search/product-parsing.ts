/**
 * Reine Parsing-Helfer fuer Produktdaten. Bewusst quellneutral: dieselben
 * Funktionen bedienen den lokalen Produktspiegel, den OFF-Dump und die OFF-API.
 */

export function parseCategoryTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

export function isLikelyBarcode(value: string): boolean {
  return /^\d{6,14}$/.test(value.trim());
}

/**
 * Normalisiert rohe Mengenstrings wie "500 g", "1.5 L", "1 kg" in Menge und Einheit.
 */
export function parseQuantityAndUnit(rawQuantity?: string): { quantity: number; unit: string } {
  if (!rawQuantity) return { quantity: 1, unit: 'piece' };

  const match = rawQuantity.trim().match(/^([\d.,]+)\s*([a-zA-ZäöüÄÖÜµ]+)/);
  if (!match) return { quantity: 1, unit: 'piece' };

  const num = parseFloat(match[1].replace(',', '.'));
  const rawUnit = match[2].toLowerCase();

  let unit = 'piece';
  if (['g', 'gramm', 'gram'].includes(rawUnit)) unit = 'g';
  else if (['kg', 'kilogramm'].includes(rawUnit)) unit = 'kg';
  else if (['l', 'liter'].includes(rawUnit)) unit = 'l';
  else if (['ml', 'milliliter'].includes(rawUnit)) unit = 'ml';
  else if (['stk', 'stück', 'stk.', 'pcs', 'piece'].includes(rawUnit)) unit = 'piece';
  else if (['pkg', 'packung', 'pck', 'pack'].includes(rawUnit)) unit = 'pack';

  return { quantity: Number.isNaN(num) ? 1 : num, unit };
}

/**
 * Zerlegt eine Sucheingabe in Suchanker fuer LIKE-Abfragen: Mengenangaben
 * fallen raus, Interpunktion wird zu Trennern. Einzelne Tokens statt der
 * kompletten Phrase, damit "1l coca ccola" trotz Tippfehler Kandidaten liefert
 * — Ranking und Tippfehlertoleranz laufen danach in `search-ranking.ts`.
 */
export function toSearchTokens(query: string): string[] {
  return query
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/g, ' ')
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}
