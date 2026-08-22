import type { ShoppingCategoryId } from './shopping-category-id';

export type NameCategoryRule = {
  value: string;
  categoryId: ShoppingCategoryId;
  /**
   * Position innerhalb eines Tokens (deutsche Komposita sind meist EIN
   * zusammengeschriebenes Wort, kein Leerzeichen):
   * - `word`: Token ist exakt `value` ("Wein" → Getränke)
   * - `word-start`: Token beginnt mit `value`, ist aber länger — `value`
   *   steht als Modifier vor dem eigentlichen Grundwort ("Apfel" in
   *   "Apfelsaft", "Schwein" in "Schweinefilet")
   * - `word-end`: Token endet auf `value`, ist aber länger — `value` ist
   *   das Grundwort/Determinatum, das ein deutsches Kompositum semantisch
   *   bestimmt ("Milch" in "Vollmilch", "Saft" in "Apfelsaft")
   */
  match: 'word' | 'word-start' | 'word-end';
  score: number;
};

const WHOLE_WORD = 100;
const WORD_END = 80;
const WORD_START = 20;
/** Explizite, eindeutige Marker (z. B. Tiefkühl-Präfix) schlagen alles. */
const EXPLICIT_MARKER = 120;

/**
 * Morphologischer Namens-Fallback, angewendet nur wenn keine OFF-Tags
 * eindeutig klassifizieren (Schritt 5 der Auflösungsreihenfolge, Abschnitt 3
 * des Plans). Neue Regeln werden ausschließlich für belegte, wiederkehrende
 * Fälle ergänzt (Abschnitt 8, "Präzisionsregel für Erweiterungen") — keine
 * spekulative Vollabdeckung aller denkbaren Komposita.
 */
export const NAME_CATEGORY_RULES: readonly NameCategoryRule[] = [
  // produce
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'produce',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'apfel', categoryId: 'produce', match: 'word-start', score: WORD_START },

  // bakery
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'bakery',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'brot', categoryId: 'bakery', match: 'word-end', score: WORD_END },

  // deli_meat
  ...[
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
    'schwein',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'deli_meat',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'hähnchen', categoryId: 'deli_meat', match: 'word-start', score: WORD_START },
  { value: 'schwein', categoryId: 'deli_meat', match: 'word-start', score: WORD_START },

  // pantry_canned
  ...[
    'dose',
    'konserve',
    'pesto',
    'ketchup',
    'mayonnaise',
    'senf',
    'suppe',
    'brühe',
    'fertiggericht',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'pantry_canned',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // pantry_dry
  ...[
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
    'olivenöl',
    'sonnenblumenöl',
    'rapsöl',
    'sesamöl',
    'erdnussöl',
    'kokosöl',
    'pflanzenöl',
    'speiseöl',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'pantry_dry',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'essig', categoryId: 'pantry_dry', match: 'word-end', score: WORD_END },

  // breakfast
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'breakfast',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // snacks
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'snacks',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // beverages
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'beverages',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'saft', categoryId: 'beverages', match: 'word-end', score: WORD_END },

  // dairy
  ...[
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
  ].map(
    (value): NameCategoryRule => ({ value, categoryId: 'dairy', match: 'word', score: WHOLE_WORD }),
  ),
  { value: 'milch', categoryId: 'dairy', match: 'word-end', score: WORD_END },

  // frozen
  ...['tiefgekühlt', 'gefroren', 'eiscreme', 'eis', 'speiseeis', 'tk'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'frozen',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'tiefkühl', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },

  // drugstore
  ...[
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
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'drugstore',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // checkout
  ...['kaugummi', 'batterie', 'zeitschrift', 'feuerzeug'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'checkout',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
];
