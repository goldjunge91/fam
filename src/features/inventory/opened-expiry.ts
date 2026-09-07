type LocationKind = 'fridge' | 'freezer' | 'pantry';
type ExpiryRule = readonly [pattern: RegExp, days: number];

export type OpenedExpiryInput = {
  name: string;
  category?: string | null;
  locationKind?: string | null;
  openedAt: Date;
  currentExpiryDate?: string | null;
  expiryUserSet?: boolean;
  vacuumSealed?: boolean;
};

// Reviewed values: docs/specs/household-capabilities/opened-expiry-rules_update.md.
// They are conservative household guidance, not a replacement for a
// manufacturer use-by date or a visible spoilage check.
const UNIVERSAL_RULES: readonly ExpiryRule[] = [
  [/\b(salz|salt|zucker|sugar|honig|honey|essig|vinegar|bicarbonat|natron)\b/i, 365],
  [/\b(backpulver|backtriebmittel|baking powder|baking soda)\b/i, 90],
  [
    /\b(spirituose\w*|liquor|sambuca|rum|brandy|whiskey|whisky|vodka|gin|grappa|amaro|aperol|campari|limoncello|cognac|porto|marsala|baileys|amaretto|vermouth)\b/i,
    365,
  ],
  [/\b(aroma\w*|extract\w*|extrakt\w*|essenz\w*|vanille\w*|vanillin|farbstoff\w*)\b/i, 365],
  [
    /\b(tee|tea|krautertee|kraeutertee|herbal tea|teemischung|tisane|kamille|verbene|infusion|rooibos)\b/i,
    365,
  ],
  [
    /^(?!.*\b(dosenfisch|canned\s+fish|thunfischdose|fisch|fish|lachs|salmon|thunfisch|tuna)\b.*\bin\s+(oel|ol|oil)\b).*\b(kaffee|coffee|nespresso|oil|oel|ol)\b/i,
    180,
  ],
  [/(sojasauce|soy sauce|paniermehl|breadcrumbs?|bread crumbs?|panko|brotkrumen|broesel)/i, 90],
];

const FREEZER_RULES: readonly ExpiryRule[] = [
  [
    /(brot\w*|bread\w*|toast\w*|brioche\w*|ciabatta|baguette|focaccia|pizza base|teig\w*|gebaeck\w*|geback\w*|pastry\w*|croissant\w*|cornetto|kuchen\w*|torte\w*|plumcake|muffin\w*|biskuit\w*|biscuit\w*)/i,
    90,
  ],
  [/(frische pasta|fresh pasta|gnocchi|ravioli|tortellini|lasagne frisch)/i, 60],
  [/(?:\beis\b|sorbet\w*|ice cream|eislutscher)/i, 60],
  [
    /(fisch\w*|fish\w*|lachs\w*|salmon|forelle|trout|zander|dorade|thunfisch|tuna|kabeljau|cod|meeresfruechte|meeresfruchte|seafood|garnele\w*|garnelen|calamari|muschel\w*)/i,
    60,
  ],
  [
    /(gefluegel|geflugel|poultry|huhn\w*|haehnchen|hahnchen|chicken|truthahn|pute|turkey|ente|duck)/i,
    90,
  ],
  [
    /(hackfleisch|ground meat|ground beef|hack\w*|hamburger|frikadelle\w*|meatball\w*|bolognese)/i,
    90,
  ],
  [
    /(rind\w*|beef|kalb\w*|veal|lamm\w*|lamb|schwein\w*|pork|rotes fleisch|red meat|fleisch\w*)/i,
    90,
  ],
  [/(wurst\w*|sausage\w*|salami|wuerstel|wurstel|speck|schinken|cured meat)/i, 60],
  [/(butter)/i, 180],
  [/(sahne|rahm|cream|kase|kaese|cheese|mozzarella|ricotta)/i, 30],
  [
    /(gemuese|gemuse|vegetable\w*|erbsen|peas|bohnen|beans|spinat|spinach|brokkoli|broccoli|blumenkohl|cauliflower|karotte\w*|carrot\w*|mais|corn|edamame|minestrone)/i,
    180,
  ],
  [
    /(obst|fruit\w*|beere\w*|berry|berries|erdbeere\w*|strawberr\w*|himbeere\w*|raspberr\w*|heidelbeere\w*|blueberr\w*|kirsche\w*|cherr\w*)/i,
    180,
  ],
  [/(bruehe|broth|suppe\w*|soup\w*|sauce\w*|sosse\w*|passata)/i, 60],
];

const PANTRY_RULES: readonly ExpiryRule[] = [
  [
    /(pasta|spaghetti|penne|rigatoni|fusilli|farfalle|tagliatelle|linguine|bucatini|lasagne|tortiglioni|noodle\w*)/i,
    365,
  ],
  [/(reis|rice|farro|quinoa|couscous)/i, 365],
  [/(polenta|griess|gries|semolina|maisstaerke|corn starch|staerke|starch|mehl|flour)/i, 180],
  [/(linsen|lentils|kichererbsen|chickpeas|bohnen|beans|erbsen|peas|legumes)/i, 365],
  [/(keks\w*|cookie\w*|wafer\w*|taralli|cracker\w*)/i, 60],
  [/(muesli|musli|cerealien|cereal\w*|corn flakes|granola|flocken)/i, 60],
  [/(marmelade|jam|konfituere|konfiture|nutella|nuss-nougat|schokolade|chocolate)/i, 60],
  [/\b(brot|bread)\b/i, 4],
  [/(tomatensauce|tomatensosse|tomato sauce)/i, 5],
  [/(sahne|rahm|cream)/i, 3],
  [/(joghurt|yogurt|yoghurt)/i, 2],
  [/(milch|milk)/i, 1],
  [/(kase|kaese|cheese)/i, 2],
  [
    /(kartoffel\w*|potato\w*|zwiebel\w*|onion\w*|knoblauch|garlic|schalotte\w*|shallot\w*|\b(lauch|leek|porree)\b)/i,
    30,
  ],
  [/(karotte\w*|moehre\w*|carrot\w*)/i, 14],
];

const FRIDGE_RULES: readonly ExpiryRule[] = [
  [/(frische milch|fresh milk|frische vollmilch)/i, 3],
  [/(uht|h-milch|haltbare milch|long life milk|milch|milk)/i, 7],
  [/(joghurt|yogurt|yoghurt)/i, 7],
  [/(mozzarella|burrata)/i, 3],
  [/(frischkase|frischkaese|fresh cheese|cream cheese|philadelphia|spalmabile)/i, 7],
  [/(hartkaese|hard cheese|parmesan|emmental|gruyere|gouda)/i, 21],
  [/(frischer kaese|fresh cheese|ricotta|mascarpone)/i, 7],
  [/(kase|kaese|cheese)/i, 7],
  [/(butter)/i, 30],
  [/(sahne|rahm|cream)/i, 7],
  [/(kochschinken|cooked ham|mortadella|wiener|wuerstchen)/i, 3],
  [/(rohschinken|cured ham|salami|bresaola|speck|nduja)/i, 7],
  [
    /(huhn\w*|haehnchen|chicken|pute|truthahn|turkey|schwein\w*|pork|rind\w*|beef|kalb\w*|veal|lamm\w*|lamb|fleisch\w*)/i,
    2,
  ],
  [
    /(dosenfisch|canned fish|thunfischdose|fischkonserve|(fisch|fish|lachs|salmon|thunfisch|tuna).*(dose|can|konserve|in oel|in ol|in oil))/i,
    3,
  ],
  [/(frischer fisch|fresh fish|frischer thunfisch|fresh tuna|lachs|salmon|fisch\w*)/i, 1],
  [/(passata|pelati|tomatensauce|tomatensosse|tomato sauce)/i, 5],
  [
    /(reis(?:\w*[-\s])?salat\w*|rice(?:\w*[-\s])?salad\w*|nudel(?:\w*[-\s])?salat\w*|pasta(?:\w*[-\s])?salat\w*|getreide(?:\w*[-\s])?salat\w*|couscous(?:\w*[-\s])?salat\w*)/i,
    3,
  ],
  [
    /(salat\w*|salad\w*|rucola|arugula|spinat|spinach|lattich|lettuce|kresse|cress|sprossen|sprouts)/i,
    4,
  ],
  [/\b(saft|juice)\b/i, 5],
  [/\b(bier|beer)\b/i, 3],
  [/\b(wein|wine)\b/i, 5],
  [/(beeren|berries|erdbeeren|strawberries|himbeeren|raspberries|heidelbeeren|blueberries)/i, 3],
  [/(avocado)/i, 3],
  [/(banane|banana|pfirsich|peach|aprikose|apricot|kirsche|cherry|mango|papaya)/i, 3],
  [
    /(apfel\w*|apple\w*|birne\w*|pear\w*|nektarine|nectarine|pflaume|plum|kiwi|ananas|pineapple|traube\w*|grape(?!fruit)\w*|melone|melon|wassermelone|watermelon)/i,
    5,
  ],
  [/(orange|mandarine|tangerine|grapefruit|zitrone|lemon|zitrus|citrus)/i, 7],
  [/(zucchini|aubergine|eggplant|tomate\w*|tomato\w*|paprika|pepper)/i, 5],
  [/(brokkoli|broccoli|blumenkohl|cauliflower|kohl|cabbage)/i, 4],
  [
    /(zwiebel\w*|onion\w*|fruehlingszwiebel\w*|spring onion\w*|schalotte\w*|shallot\w*|\b(lauch|leek|porree)\b)/i,
    6,
  ],
  [/(karotte\w*|moehre\w*|carrot\w*)/i, 7],
  [/(kartoffel\w*|potato\w*)/i, 4],
  [/(knoblauch|garlic)/i, 14],
  [/(fladenbrot|flatbread)/i, 2],
  [/(schnittbrot|sliced bread|toastbrot|packung\w* brot|packaged bread)/i, 4],
];

const CATEGORY_RULES: Record<LocationKind, readonly ExpiryRule[]> = {
  freezer: [
    [/(fish|fisch|seafood)/i, 60],
    [/(poultry|gefluegel|chicken)/i, 90],
    [/(ground meat|hackfleisch)/i, 90],
    [/(red meat|meat|fleisch)/i, 90],
    [/(sausage|wurst|cured meat)/i, 60],
    [/(butter)/i, 180],
    [/(dairy|milchprodukt|cream|cheese)/i, 30],
    [/(vegetable|gemuese|gemuse)/i, 180],
    [/(fruit|obst)/i, 180],
    [/(ice|frozen)/i, 60],
    [/(pasta)/i, 60],
    [/(bread|brot|pastry|gebaeck)/i, 90],
    [/(soup|broth|sauce)/i, 60],
  ],
  fridge: [
    [/(fresh milk|frische milch)/i, 3],
    [/(milk|milch|dairy|milchprodukt)/i, 7],
    [/(yogurt|joghurt)/i, 7],
    [/(mozzarella|burrata)/i, 3],
    [/(cream cheese|frischkaese)/i, 7],
    [/(hard cheese|hartkaese)/i, 21],
    [/(fresh cheese|frischer kaese|ricotta|mascarpone)/i, 7],
    [/(cheese|kase|kaese)/i, 7],
    [/(fish|fisch|seafood)/i, 1],
    [/(fruit|obst)/i, 5],
    [/(vegetable|gemuese|gemuse)/i, 5],
  ],
  pantry: [
    [/(pasta|noodle)/i, 365],
    [/(rice|reis|cereal|getreide)/i, 365],
    [/(flour|mehl|starch)/i, 180],
    [/(legume|huelsenfrucht)/i, 365],
    [/(snack|biscuit|cookie|cereal|muesli)/i, 60],
    [/(jam|marmelade|chocolate|schokolade|preserve)/i, 60],
    [/\b(bread|brot)\b/i, 4],
    [/(cream|sahne)/i, 3],
    [/(yogurt|joghurt)/i, 2],
    [/(milk|milch)/i, 1],
    [/(cheese|kase|kaese)/i, 2],
    [/(carrot|karotte|moehre)/i, 14],
    [/(root vegetable|kartoffel|potato|onion|zwiebel|garlic|knoblauch|leek|lauch)/i, 30],
  ],
};

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function normalizeLocation(value: string | null | undefined): LocationKind {
  const location = normalize(value);
  if (/(freezer|deep freeze|tiefkuhl|tiefkuehl|gefrier)/.test(location)) {
    return 'freezer';
  }
  if (/(fridge|refrigerator|kuhlschrank|kuehlschrank)/.test(location)) {
    return 'fridge';
  }
  return 'pantry';
}

function firstMatch(value: string, rules: readonly ExpiryRule[]): number | null {
  for (const [pattern, days] of rules) {
    if (pattern.test(value)) return days;
  }
  return null;
}

/**
 * Liefert die geprüfte Tageszahl aus der dokumentierten Regelbasis.
 * Der erste passende Treffer gewinnt; nicht erkannte Orte sind Speisekammern.
 */
export function estimateOpenedExpiryDays(input: {
  name: string;
  category?: string | null;
  locationKind?: string | null;
}): number {
  const name = normalize(input.name);
  const category = normalize(input.category);
  const universalByName = firstMatch(name, UNIVERSAL_RULES);
  if (universalByName !== null) return universalByName;

  const location = normalizeLocation(input.locationKind);
  const rules =
    location === 'freezer' ? FREEZER_RULES : location === 'fridge' ? FRIDGE_RULES : PANTRY_RULES;
  const locationByName = firstMatch(name, rules);
  if (locationByName !== null) return locationByName;

  return (
    firstMatch(category, UNIVERSAL_RULES) ??
    firstMatch(category, CATEGORY_RULES[location]) ??
    (location === 'freezer' ? 60 : location === 'fridge' ? 3 : 30)
  );
}

/**
 * Vakuumverpackung erhält keine pauschale Verlängerung.
 * Ohne validierte Prozess- und Temperaturdaten bleibt der kürzere Grundwert.
 */
export function getVacuumExpiryDays(baseDays: number): number {
  return baseDays;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toIsoDate(date) === value ? date : null;
}

export function calculateOpenedExpiryDate(input: OpenedExpiryInput): string {
  const baseDays = estimateOpenedExpiryDays(input);
  const days = input.vacuumSealed ? getVacuumExpiryDays(baseDays) : baseDays;
  const calculated = new Date(input.openedAt.getTime());
  calculated.setHours(12, 0, 0, 0);
  calculated.setDate(calculated.getDate() + days);

  if (input.expiryUserSet && input.currentExpiryDate && parseIsoDate(input.currentExpiryDate)) {
    return input.currentExpiryDate;
  }

  return toIsoDate(calculated);
}
