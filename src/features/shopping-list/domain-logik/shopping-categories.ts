export type StorageKind = 'fridge' | 'freezer' | 'pantry';

export type ShoppingCategory = {
  id: string;
  /** Reines Anzeige-Label. Gespeichert wird ausschliesslich `id`. */
  label: string;
  /** Rang auf der typischen Supermarkt-Laufstrecke, 10er-Schritte. */
  sortOrder: number;
  /** Wohin ein abgehakter Artikel dieser Kategorie standardmäßig wandert. */
  storageKind: StorageKind;
  /**
   * Wiedererkennungsfarbe der Kategorie (Kategorie-Header, Einkaufsmodus) —
   * dieselben gedämpften, erdigen Töne wie `STORE_COLOR_PALETTE` in
   * `store-presets.ts`, hier aber fest der Kategorie statt frei dem Markt
   * zugeordnet.
   */
  color: string;
  /**
   * Substrings, die im (kleingeschriebenen) Artikelnamen auf diese Kategorie
   * hindeuten — Grundlage der automatischen Zuordnung in `guessCategory`.
   * Reihenfolge der Kategorien entscheidet bei Mehrdeutigkeit.
   */
  keywords: readonly string[];
};

export const UNCATEGORIZED_LABEL = 'Sonstiges';
export const UNCATEGORIZED_SORT_ORDER = 999;

/**
 * Standard-Laufstrecke in deutschen Supermärkten (REWE, Edeka, ALDI, Lidl) —
 * siehe `docs/Supermarkt Laufstrecke - Einkaufslisten Sortierung.md`.
 * Reihenfolge und Ränge kommen direkt aus dieser Notiz.
 */
export const SHOPPING_CATEGORIES: readonly ShoppingCategory[] = [
  {
    id: 'produce',
    label: 'Obst & Gemüse',
    sortOrder: 10,
    storageKind: 'fridge',
    color: '#748C5B',
    keywords: [
      'apfel',
      'äpfel',
      'banane',
      'birne',
      'orange',
      'mandarine',
      'zitrone',
      'limette',
      'traube',
      'beere',
      'erdbeere',
      'himbeere',
      'blaubeere',
      'kiwi',
      'ananas',
      'mango',
      'avocado',
      'tomate',
      'gurke',
      'salat',
      'paprika',
      'zucchini',
      'aubergine',
      'karotte',
      'möhre',
      'kartoffel',
      'zwiebel',
      'knoblauch',
      'lauch',
      'brokkoli',
      'blumenkohl',
      'spinat',
      'pilz',
      'champignon',
      'sellerie',
      'radieschen',
      'kohl',
      'kürbis',
      'ingwer',
      'obst',
      'gemüse',
    ],
  },
  {
    id: 'bakery',
    label: 'Backwaren & Brot',
    sortOrder: 20,
    storageKind: 'pantry',
    color: '#C6A24A',
    keywords: [
      'brot',
      'brötchen',
      'baguette',
      'croissant',
      'toast',
      'brezel',
      'kuchen',
      'gebäck',
      'waffel',
      'bagel',
      'semmel',
    ],
  },
  {
    id: 'deli_meat',
    label: 'Wurst & Fleisch (Kühl)',
    sortOrder: 30,
    storageKind: 'fridge',
    color: '#A6483D',
    keywords: [
      'hackfleisch',
      'hähnchen',
      'huhn',
      'pute',
      'rindfleisch',
      'schweinefleisch',
      'wurst',
      'schinken',
      'salami',
      'speck',
      'fleisch',
      'bacon',
      'leberkäse',
      'mett',
      'bratwurst',
      'wiener',
      'lyoner',
      'mortadella',
      'gyros',
    ],
  },
  {
    id: 'pantry_canned',
    label: 'Konserven & Saucen',
    sortOrder: 40,
    storageKind: 'pantry',
    color: '#B5623F',
    keywords: [
      'dose',
      'konserve',
      'passierte tomaten',
      'pesto',
      'ketchup',
      'mayonnaise',
      'senf',
      'suppe',
      'brühe',
      'fertiggericht',
    ],
  },
  {
    id: 'pantry_dry',
    label: 'Grundnahrungsmittel',
    sortOrder: 50,
    storageKind: 'pantry',
    color: '#8B6B4A',
    keywords: [
      'nudeln',
      'pasta',
      'spaghetti',
      'reis',
      'mehl',
      'zucker',
      'salz',
      'essig',
      'gewürz',
      'pfeffer',
      'backpulver',
      'hefe',
      'linsen',
      'kichererbsen',
      'couscous',
      'bulgur',
      'quinoa',
      // "öl" allein ist als kurzes Keyword zu unspezifisch (matcht in
      // "Röllchen" o.ä.) und kommt praktisch nie einzeln vor — stattdessen
      // die gängigen Sorten, die als Kompositum ohnehin nur per Substring
      // erkennbar sind.
      'olivenöl',
      'sonnenblumenöl',
      'rapsöl',
      'sesamöl',
      'erdnussöl',
      'kokosöl',
      'pflanzenöl',
      'speiseöl',
    ],
  },
  {
    id: 'breakfast',
    label: 'Müsli & Frühstück',
    sortOrder: 60,
    storageKind: 'pantry',
    color: '#C08A4E',
    keywords: [
      'müsli',
      'haferflocken',
      'cornflakes',
      'marmelade',
      'honig',
      'nutella',
      'aufstrich',
      'kaffee',
      'tee',
      'kakao',
    ],
  },
  {
    id: 'snacks',
    label: 'Süßwaren & Snacks',
    sortOrder: 70,
    storageKind: 'pantry',
    color: '#8B6F72',
    keywords: [
      'schokolade',
      'chips',
      'gummibärchen',
      'kekse',
      'keks',
      'nüsse',
      'erdnüsse',
      'cracker',
      'popcorn',
      'riegel',
      'bonbon',
      'süßigkeiten',
      'snack',
    ],
  },
  {
    id: 'beverages',
    label: 'Getränke',
    sortOrder: 80,
    storageKind: 'fridge',
    color: '#4F8580',
    keywords: [
      'wasser',
      'saft',
      'cola',
      'limonade',
      'sprudel',
      'bier',
      'wein',
      'sekt',
      'softdrink',
      'smoothie',
      'mineralwasser',
    ],
  },
  {
    id: 'dairy',
    label: 'Molkerei',
    sortOrder: 90,
    storageKind: 'fridge',
    color: '#5C7396',
    keywords: [
      'milch',
      'butter',
      'joghurt',
      'käse',
      'sahne',
      'quark',
      'frischkäse',
      'ei',
      'eier',
      'schmand',
      'kefir',
      'buttermilch',
      'mozzarella',
      'parmesan',
      'feta',
    ],
  },
  {
    id: 'frozen',
    label: 'Tiefkühlkost',
    sortOrder: 100,
    storageKind: 'freezer',
    color: '#7A7680',
    keywords: ['tiefkühl', 'tiefgekühlt', 'gefroren', 'eiscreme', 'eis', 'speiseeis', 'tk'],
  },
  {
    id: 'drugstore',
    label: 'Drogerie & Haushalt',
    sortOrder: 110,
    storageKind: 'pantry',
    color: '#705773',
    keywords: [
      'toilettenpapier',
      'klopapier',
      'spülmittel',
      'shampoo',
      'duschgel',
      'seife',
      'zahnpasta',
      'waschmittel',
      'weichspüler',
      'putzmittel',
      'müllbeutel',
      'windeln',
      'deo',
      'rasierer',
    ],
  },
  {
    id: 'checkout',
    label: 'Kasse / Impulsware',
    sortOrder: 120,
    storageKind: 'pantry',
    color: '#786F79',
    keywords: ['kaugummi', 'batterie', 'zeitschrift', 'feuerzeug'],
  },
];

/** O(1)-Nachschlag statt Array.find() bei jedem Aufruf. */
const CATEGORY_BY_LABEL = new Map<string, ShoppingCategory>(
  SHOPPING_CATEGORIES.map((category) => [category.label, category]),
);
const CATEGORY_BY_ID = new Map<string, ShoppingCategory>(
  SHOPPING_CATEGORIES.map((category) => [category.id, category]),
);

/** Mechanische Bruecke fuer den Datenmodell-Cutover; Labels bleiben reine Darstellung. */
export function categoryIdForLabel(categoryLabel: string | null): string | null {
  if (!categoryLabel) return null;
  return CATEGORY_BY_LABEL.get(categoryLabel)?.id ?? null;
}

/** Loest ein gespeichertes Kategorie-ID-Snapshot in das aktuelle Anzeige-Label auf. */
export function categoryLabelForId(categoryId: string | null): string | null {
  if (!categoryId) return null;
  return CATEGORY_BY_ID.get(categoryId)?.label ?? null;
}

/** Unkategorisierte Artikel (category null) sinken ans Ende der Liste. */
export function sortOrderForCategory(categoryLabel: string | null): number {
  if (!categoryLabel) return UNCATEGORIZED_SORT_ORDER;
  return CATEGORY_BY_LABEL.get(categoryLabel)?.sortOrder ?? UNCATEGORIZED_SORT_ORDER;
}

export function storageKindForCategory(categoryLabel: string | null): StorageKind {
  if (!categoryLabel) return 'pantry';
  return CATEGORY_BY_LABEL.get(categoryLabel)?.storageKind ?? 'pantry';
}

/** Wiedererkennungsfarbe einer Kategorie, `null` bei "Sonstiges"/unbekannt. */
export function colorForCategory(categoryLabel: string | null): string | null {
  if (!categoryLabel) return null;
  return CATEGORY_BY_LABEL.get(categoryLabel)?.color ?? null;
}

/**
 * Eindeutige Wiedererkennungsfarben der übergebenen Kategorien, dedupliziert
 * und nach Laufstrecken-Reihenfolge sortiert (Übersichtskarte "Alle
 * Listen" — Kategorievorschau je Markt, s. `store-summary-card.tsx`).
 * Unkategorisierte Einträge (`null`) tragen keine Farbe und werden ignoriert.
 */
export function distinctCategoryColors(categoryLabels: readonly (string | null)[]): string[] {
  const seenIds = new Set<string>();
  const matches: { color: string; sortOrder: number }[] = [];

  for (const label of categoryLabels) {
    const category = label ? CATEGORY_BY_LABEL.get(label) : undefined;
    if (!category || seenIds.has(category.id)) continue;
    seenIds.add(category.id);
    matches.push({ color: category.color, sortOrder: category.sortOrder });
  }

  return matches.sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.color);
}

/**
 * Marktspezifische Laufstrecke — vom Nutzer per Drag&Drop sortierte
 * Kategorie-IDs, kommagetrennt in `stores.category_order` gespeichert (kein
 * Array-/JSON-Spaltentyp noetig, damit Push/Pull die Spalte wie jede andere
 * Textspalte behandeln). Leer/NULL bedeutet: Standardreihenfolge.
 */
export function parseCategoryOrder(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

export function serializeCategoryOrder(ids: readonly string[]): string {
  return ids.join(',');
}

/**
 * Sortierrang einer Kategorie unter Beruecksichtigung einer optionalen,
 * marktspezifischen Laufstrecke. Kategorien, die der Nutzer nicht
 * einsortiert hat, laufen hinter den custom-sortierten, in ihrer
 * Standardreihenfolge.
 */
export function effectiveSortOrder(
  categoryLabel: string | null,
  customOrderIds: readonly string[] | null | undefined,
): number {
  if (!categoryLabel) return UNCATEGORIZED_SORT_ORDER;
  const category = CATEGORY_BY_LABEL.get(categoryLabel);
  if (!category) return UNCATEGORIZED_SORT_ORDER;
  if (customOrderIds && customOrderIds.length > 0) {
    const idx = customOrderIds.indexOf(category.id);
    if (idx !== -1) return idx;
    return customOrderIds.length + category.sortOrder;
  }
  return category.sortOrder;
}

/**
 * Ab dieser Laenge matcht ein Keyword als freier Substring (erwuenscht fuer
 * deutsche Komposita wie "tiefkühl" in "Tiefkühlpizza"). Kuerzere Keywords
 * wie "ei" oder "öl" matchen sonst faelschlich in "Eis", "Teig", "Seife"
 * oder "Eimer" — die brauchen ein echtes Ganzwort-Match.
 *
 * Kein `\b`/`\w`-Regex dafuer: JavaScripts `\w` kennt nur `[A-Za-z0-9_]`,
 * Umlaute zaehlen NICHT als Wortzeichen. `/\böl\b/` matcht deshalb ueberall
 * dort, wo vor einem "öl" ein Buchstabe steht ("sonnenblumenöl" trifft, weil
 * die Engine "ö" selbst schon als Wortgrenze liest) — das Gegenteil von dem,
 * was Wortgrenzen leisten sollen. Stattdessen eine explizite Zeichenklasse.
 */
const SUBSTRING_MIN_LENGTH = 4;
const WORD_CHAR = /[a-z0-9äöüß]/i;

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

/** Ob `keyword` in `haystack` als eigenstaendiges Wort vorkommt (nicht als Teil eines anderen Worts). */
function containsWholeWord(haystack: string, keyword: string): boolean {
  let fromIndex = 0;
  while (true) {
    const index = haystack.indexOf(keyword, fromIndex);
    if (index === -1) return false;
    if (!isWordChar(haystack[index - 1]) && !isWordChar(haystack[index + keyword.length])) {
      return true;
    }
    fromIndex = index + 1;
  }
}

type CategoryMatcher = {
  label: string;
  longKeywords: readonly string[];
  shortKeywords: readonly string[];
};

const CATEGORY_MATCHERS: readonly CategoryMatcher[] = SHOPPING_CATEGORIES.map((category) => ({
  label: category.label,
  longKeywords: category.keywords.filter((k) => k.length >= SUBSTRING_MIN_LENGTH),
  shortKeywords: category.keywords.filter((k) => k.length < SUBSTRING_MIN_LENGTH),
}));

/**
 * Errät die Kategorie aus dem Artikelnamen per Stichwort-Suche (Tipp #3 aus
 * der Laufstrecken-Notiz — dort fuer Open-Food-Facts-Tags gedacht, hier ohne
 * Produkt-Anbindung auf den freien Namen angewendet). Liefert `null`, wenn
 * kein Stichwort passt — der Aufrufer entscheidet dann selbst (z.B.
 * "Sonstiges" belassen), rein informativ, keine Garantie.
 */
export function guessCategory(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  for (const matcher of CATEGORY_MATCHERS) {
    const substringHit = matcher.longKeywords.some((keyword) => normalized.includes(keyword));
    const wholeWordHit =
      !substringHit &&
      matcher.shortKeywords.some((keyword) => containsWholeWord(normalized, keyword));
    if (substringHit || wholeWordHit) {
      return matcher.label;
    }
  }
  return null;
}
