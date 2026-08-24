import type { StoredPlacementZoneId } from './placement-taxonomy';

export type NameCategoryRule = {
  value: string;
  /** Legacy-Regeln werden im Classifier vor der Auswertung auf V2 normalisiert. */
  categoryId: StoredPlacementZoneId;
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
    'kräuter',
    'basilikum',
    'petersilie',
    'rosmarin',
    'thymian',
    'dill',
    'schnittlauch',
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
    'fladenbrot',
    'pita',
    'ciabatta',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'bakery',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'brot', categoryId: 'bakery', match: 'word-end', score: WORD_END },

  // convenience
  ...[
    'fertigsalat',
    'sandwich',
    'wraps',
    'sushi',
    'hummus',
    'guacamole',
    'tzatziki',
    'feinkost',
    'tortellini',
    'gnocchi',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'convenience',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // breakfast
  ...[
    'müsli',
    'haferflocken',
    'cornflakes',
    'marmelade',
    'honig',
    'nutella',
    'aufstrich',
    'konfitüre',
    'erdnussbutter',
    'agavendicksaft',
    'ahornsirup',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'breakfast',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // hot_beverages
  ...[
    'kaffee',
    'kaffeebohnen',
    'tee',
    'schwarztee',
    'grüntee',
    'kräutertee',
    'früchtetee',
    'kamillentee',
    'pfefferminztee',
    'moringa',
    'chai',
    'matcha',
    'kakao',
    'kakaopulver',
    'filtertüten',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'hot_beverages',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'tee', categoryId: 'hot_beverages', match: 'word-end', score: WORD_END },

  // pantry_staples
  ...[
    'nudeln',
    'pasta',
    'spaghetti',
    'penne',
    'reis',
    'basmatireis',
    'mehl',
    'zucker',
    'puderzucker',
    'linsen',
    'kichererbsen',
    'couscous',
    'bulgur',
    'quinoa',
    'hafer',
    'grieß',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'pantry_staples',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // cooking_baking
  ...[
    'öl',
    'olivenöl',
    'rapsöl',
    'sonnenblumenöl',
    'speiseöl',
    'salz',
    'meersalz',
    'pfeffer',
    'gewürz',
    'paprikapulver',
    'curry',
    'oregano',
    'zimt',
    'kurkuma',
    'backpulver',
    'vanillezucker',
    'hefe',
    'trockenhefe',
    'natron',
    'gelatine',
    'speisestärke',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'cooking_baking',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'essig', categoryId: 'cooking_baking', match: 'word-end', score: WORD_END },

  // canned_sauces
  ...[
    'pesto',
    'ketchup',
    'mayonnaise',
    'senf',
    'suppe',
    'brühe',
    'gemüsebrühe',
    'fertiggericht',
    'ravioli',
    'tomatenmark',
    'passata',
    'kokosmilch',
    'sauerkraut',
    'gewürzgurke',
    'gewürzgurken',
    'sauergurke',
    'sauergurken',
    'apfelmus',
    'apfelmark',
    'fruchtmark',
    'kompott',
    'mus',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'canned_sauces',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  ...[
    'dose',
    'dosen',
    'konserve',
    'konserven',
    'eingelegt',
    'eingelegte',
    'eingelegter',
    'eingelegtes',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'canned_sauces',
      match: 'word',
      score: EXPLICIT_MARKER,
    }),
  ),
  { value: 'dosen', categoryId: 'canned_sauces', match: 'word-start', score: EXPLICIT_MARKER },
  { value: 'eingelegt', categoryId: 'canned_sauces', match: 'word-start', score: EXPLICIT_MARKER },
  { value: 'konserve', categoryId: 'canned_sauces', match: 'word-end', score: EXPLICIT_MARKER },
  { value: 'mark', categoryId: 'canned_sauces', match: 'word-end', score: WORD_END },
  { value: 'mus', categoryId: 'canned_sauces', match: 'word-end', score: WORD_END },
  { value: 'kompott', categoryId: 'canned_sauces', match: 'word-end', score: WORD_END },

  // snacks
  ...[
    'schokolade',
    'chips',
    'gummibärchen',
    'kekse',
    'keks',
    'nüsse',
    'erdnüsse',
    'cashews',
    'mandeln',
    'walnüsse',
    'cracker',
    'popcorn',
    'riegel',
    'bonbon',
    'süßigkeiten',
    'snack',
    'salzstangen',
    'flips',
    'pralinen',
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
    'tonic',
    'energy',
    'sirup',
    'likör',
    'schnaps',
    'gin',
    'rum',
    'vodka',
    'whisky',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'beverages',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'saft', categoryId: 'beverages', match: 'word-end', score: WORD_END },

  // drugstore
  ...[
    'shampoo',
    'duschgel',
    'seife',
    'zahnpasta',
    'zahnbürste',
    'deo',
    'deodorant',
    'creme',
    'bodylotion',
    'gesichtscreme',
    'rasierer',
    'rasierklingen',
    'rasierschaum',
    'wattepads',
    'wattestäbchen',
    'tampons',
    'binden',
    'pflaster',
    'sonnencreme',
    'lippenbalsam',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'drugstore',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // baby_kids
  ...[
    'windeln',
    'feuchttücher',
    'babynahrung',
    'gläschen',
    'folgemilch',
    'babybrei',
    'babyöl',
    'babycreme',
    'schnuller',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'baby_kids',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // household
  ...[
    'toilettenpapier',
    'klopapier',
    'küchenrolle',
    'taschentücher',
    'spülmittel',
    'spülmaschinentabs',
    'waschmittel',
    'weichspüler',
    'putzmittel',
    'allzweckreiniger',
    'glasreiniger',
    'müllbeutel',
    'alufolie',
    'backpapier',
    'frischhaltefolie',
    'schwamm',
    'spültuch',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'household',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // pet_supplies
  ...[
    'katzenfutter',
    'hundefutter',
    'katzenstreu',
    'vogelfutter',
    'nassfutter',
    'trockenfutter',
    'hundeleckerli',
    'katzenleckerli',
    'tiernahrung',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'pet_supplies',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // meat_poultry
  ...[
    'hackfleisch',
    'hähnchen',
    'huhn',
    'pute',
    'rindfleisch',
    'schweinefleisch',
    'schnitzel',
    'steak',
    'gulasch',
    'kotelett',
    'ente',
    'gans',
    'lamm',
    'fleisch',
    'schwein',
    'rind',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'meat_poultry',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'hähnchen', categoryId: 'meat_poultry', match: 'word-start', score: WORD_START },
  { value: 'schwein', categoryId: 'meat_poultry', match: 'word-start', score: WORD_START },

  // fish_seafood
  ...[
    'lachs',
    'lachsfilet',
    'forelle',
    'garnelen',
    'shrimps',
    'thunfisch',
    'kabeljau',
    'dorade',
    'scholle',
    'fisch',
    'meeresfrüchte',
    'muscheln',
    'tintenfisch',
    'matjes',
    'hering',
    'räucherlachs',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'fish_seafood',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'fisch', categoryId: 'fish_seafood', match: 'word-end', score: WORD_END },

  // deli_cold_cuts
  ...[
    'wurst',
    'schinken',
    'salami',
    'speck',
    'bacon',
    'leberkäse',
    'mett',
    'bratwurst',
    'wiener',
    'lyoner',
    'mortadella',
    'gyros',
    'aufschnitt',
    'leberwurst',
    'teewurst',
    'chorizo',
    'prosciutto',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'deli_cold_cuts',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'wurst', categoryId: 'deli_cold_cuts', match: 'word-end', score: WORD_END },
  { value: 'schinken', categoryId: 'deli_cold_cuts', match: 'word-end', score: WORD_END },

  // plant_based
  ...[
    'tofu',
    'tempeh',
    'seitan',
    'hafermilch',
    'sojamilch',
    'mandelmilch',
    'haferdrink',
    'sojadrink',
    'sojajoghurt',
    'kokosjoghurt',
    'veggie',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'plant_based',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),

  // dairy_eggs
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
    'gouda',
    'cheddar',
    'emmentaler',
  ].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'dairy_eggs',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  { value: 'milch', categoryId: 'dairy_eggs', match: 'word-end', score: WORD_END },

  // frozen
  ...['eiscreme', 'eis', 'speiseeis'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'frozen',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
  ...['tiefgekühlt', 'tiefgefroren', 'gefroren', 'tk'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'frozen',
      match: 'word',
      score: EXPLICIT_MARKER,
    }),
  ),
  { value: 'tiefkühl', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },
  { value: 'tiefgefrier', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },
  { value: 'tiefgefroren', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },
  { value: 'gefroren', categoryId: 'frozen', match: 'word-start', score: EXPLICIT_MARKER },

  // checkout
  ...['kaugummi', 'batterie', 'batterien', 'zeitschrift', 'feuerzeug'].map(
    (value): NameCategoryRule => ({
      value,
      categoryId: 'checkout',
      match: 'word',
      score: WHOLE_WORD,
    }),
  ),
];
