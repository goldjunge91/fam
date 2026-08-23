import type { ShoppingCategoryId } from './shopping-category-id';

export type NameCategoryRule = {
  value: string;
  categoryId: ShoppingCategoryId;
  /** Grundwoerter am Wortende werden hoeher gewichtet als Wortanfaenge. */
  match: 'word' | 'word-start' | 'word-end';
  score: number;
};

const WHOLE_WORD = 100;
const WORD_END = 80;
const WORD_START = 20;
const EXPLICIT_MARKER = 120;

/** Konservative Namensregeln fuer Faelle ohne eindeutige OFF-Kategorie. */
export const NAME_CATEGORY_RULES: readonly NameCategoryRule[] = [
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

  ...['tiefgekühlt', 'gefroren', 'eiscreme', 'eis', 'speiseeis', 'tk'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'frozen',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'tiefkühl', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },

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

  ...['kaugummi', 'batterie', 'zeitschrift', 'feuerzeug'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'checkout',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
];
