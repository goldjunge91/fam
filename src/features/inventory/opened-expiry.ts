type LocationKind = 'fridge' | 'freezer' | 'pantry';

export type OpenedExpiryInput = {
  name: string;
  category?: string | null;
  locationKind?: string | null;
  openedAt: Date;
  currentExpiryDate?: string | null;
  expiryUserSet?: boolean;
  vacuumSealed?: boolean;
};

const UNIVERSAL_RULES: readonly [RegExp, number][] = [
  [/\b(salz|salt|zucker|sugar|honig|honey|essig|vinegar|bicarbonat|natron|backpulver)\b/i, 9999],
  [
    /\b(sambuca|rum|brandy|whiskey|whisky|vodka|gin|grappa|amaro|aperol|campari|limoncello|cognac|porto|marsala|baileys|amaretto|vermouth)\b/i,
    730,
  ],
  [/\b(aroma|extrakt|essenz|vanille|vanillin|farbstoff)\b/i, 730],
  [/\b(tee|tea|teemischung|tisane|kamille|verbene|infusion|rooibos)\b/i, 730],
  [/\b(kakao|kaffee|coffee|nespresso|öl|oel|oil)\b/i, 365],
  [/(sojasauce|soy sauce|paniermehl|panko|bread crumb|brösel|broesel)/i, 90],
];

const FREEZER_RULES: readonly [RegExp, number][] = [
  [/(brot|bread|toast|brioche|ciabatta|baguette|focaccia|pizza base|teig)/i, 90],
  [/(frische pasta|pasta fresca|gnocchi|ravioli|tortellini|lasagne frisch)/i, 60],
  [/(croissant|cornetto|gebäck|gebaeck|pasticceria|kuchen|torte|muffin|biscuit|biskuit)/i, 90],
  [/(\beis\b|gelato|sorbet|ice cream|eislutscher)/i, 365],
  [
    /(fisch|lachs|forelle|zander|dorade|thunfisch|tuna|kabeljau|meer(es)?früchte|seafood|garnelen|calamari|muscheln)/i,
    120,
  ],
  [/(huhn|hähnchen|haehnchen|pollo|truthahn|pute|tacchino|ente|duck|geflügel|gefluegel)/i, 270],
  [/(hackfleisch|hack|ground beef|macin|hamburger|frikadelle|bolognese)/i, 120],
  [/(wurst|salami|salsiccia|würstel|wurstel|speck|pancetta|schinken|prosciutto)/i, 60],
  [
    /(?!(hackfleisch|hack)\b)(rind|rinder|beef|kalb|veal|lamm|lamb|schwein|pork|fleisch|manzo|maiale)/i,
    365,
  ],
  [/(butter|burro)/i, 270],
  [/(sahne|rahm|panna|käse|kaese|cheese|mozzarella|ricotta)/i, 90],
  [
    /(gemüse|gemuese|vegetable|erbsen|bohnen|spinat|brokkoli|blumenkohl|karotten|mais|edamame|minestrone)/i,
    270,
  ],
  [/(obst|fruit|beeren|erdbeeren|himbeeren|heidelbeeren|kirschen|früchte|fruechte)/i, 270],
  [/(brühe|bruehe|suppe|sauce|soße|sosse|passata)/i, 180],
];

const PANTRY_RULES: readonly [RegExp, number][] = [
  [/(pasta|spaghetti|penne|rigatoni|fusilli|farfalle|tagliatelle|linguine|bucatini|lasagne)/i, 365],
  [/(reis|riso|risotto|orzo|farro|quinoa|couscous)/i, 365],
  [/(polenta|grieß|griess|maisstärke|maisstaerke|stärke|staerke|mehl|farina)/i, 180],
  [/(linsen|lenticchie|kichererbsen|ceci|bohnen|fagioli|erbsen|piselli)/i, 365],
  [/(keks|kekse|biscotti|cookies|wafer|taralli|cracker)/i, 60],
  [/(müsli|muesli|cerealien|cereals|corn flakes|granola|flocken)/i, 60],
  [/(marmelade|konfitüre|konfituere|confettura|nutella|schokolade|cioccolato)/i, 90],
  [/\b(brot|bread)\b/i, 4],
  [/(tomatensauce|tomatensoße|tomatensosse|salsa di pomodoro|salsa pronta)/i, 5],
  [/(sahne|rahm|panna)/i, 3],
  [/(joghurt|yogurt|yaourt|yoghurt)/i, 2],
  [/(milch|latte)/i, 1],
  [/(käse|kaese|formaggio|cheese)/i, 2],
  [/(kartoffel|kartoffeln|potato|zwiebel|onion|knoblauch|garlic|schalotte|lauch|porree)/i, 30],
  [/(karotte|karotten|möhre|moehre|carrot)/i, 14],
];

const FRIDGE_RULES: readonly [RegExp, number][] = [
  [/(frische milch|frische vollmilch|fresh milk)/i, 3],
  [/(uht|haltbare milch|long life milk|milch|latte)/i, 7],
  [/(joghurt|yogurt|yaourt|yoghurt)/i, 5],
  [/(mozzarella|burrata|stracciatella)/i, 3],
  [/(frischkäse|frischkaese|cream cheese|philadelphia|spalmabile)/i, 7],
  [
    /(hartkäse|hartkaese|hard cheese|parmesan|parmigiano|grana|pecorino|provolone|asiago|emmental|gruyère|gruyere|gouda)/i,
    28,
  ],
  [/(frischer käse|frischer kaese|ricotta|mascarpone)/i, 5],
  [/(käse|kaese|formaggio|cheese)/i, 10],
  [/(butter|burro)/i, 30],
  [/(sahne|rahm|panna)/i, 4],
  [/(kochschinken|mortadella|wiener|würstchen|wuerstchen)/i, 5],
  [/(rohschinken|salami|bresaola|speck|pancetta|nduja)/i, 7],
  [
    /(huhn|hähnchen|haehnchen|pollo|pute|truthahn|tacchino|schwein|pork|rind|beef|kalb|lamm|fleisch)/i,
    2,
  ],
  [
    /(frischer fisch|fresh fish|lachs|salmon|thunfisch frisch|pesce)(?!.*(dose|konserve|in öl|in oel))/i,
    2,
  ],
  [/(passata|pelati|tomatensauce|tomatensoße|tomatensosse)/i, 5],
  [/(reis.?salat|pasta.?salat|getreide.?salat|couscous.?salat)/i, 7],
  [/(salat|rucola|spinat|lattich|kresse|sprossen)/i, 4],
  [/(saft|juice)/i, 3],
  [/(bier|beer)/i, 3],
  [/(wein|wine)/i, 5],
  [/(dosenfisch|thunfischdose|fischkonserve|canned fish)/i, 4],
  [/(beeren|erdbeeren|himbeeren|heidelbeeren)/i, 4],
  [/(avocado|banane|banana|pfirsich|aprikose|kirsche|mango|papaya)/i, 4],
  [/(apfel|äpfel|aepfel|birne|birnen|kiwi|ananas|traube|melone|wassermelone)/i, 5],
  [/(orange|mandarine|grapefruit|zitrone|zitrus)/i, 7],
  [/(zucchini|aubergine|tomate|paprika)/i, 5],
  [/(brokkoli|blumenkohl|kohl)/i, 4],
  [/(zwiebel|frühlingszwiebel|fruehlingszwiebel|schalotte|lauch|porree)/i, 6],
  [/(karotte|karotten|möhre|moehre)/i, 7],
  [/(kartoffel|kartoffeln)/i, 4],
  [/(knoblauch|garlic)/i, 14],
  [/(piadina|fladenbrot|flatbread)/i, 2],
  [/(schnittbrot|toastbrot|packung.?brot|packaged bread)/i, 4],
];

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function normalizeLocation(value: string | null | undefined): LocationKind {
  const location = normalize(value);
  if (/(freezer|tiefkuhl|tiefkuehl|gefrier|surgelat)/.test(location)) return 'freezer';
  if (/(fridge|kuhlschrank|kuehlschrank|frigo)/.test(location)) return 'fridge';
  return 'pantry';
}

function firstMatch(name: string, rules: readonly [RegExp, number][]): number | null {
  for (const [pattern, days] of rules) {
    // The product name is normalized before matching, so accents in the
    // rule source need the same treatment (for example Gemüse -> gemuse).
    const normalizedPattern = new RegExp(normalize(pattern.source), pattern.flags);
    if (normalizedPattern.test(name)) return days;
  }
  return null;
}

function categoryFallback(category: string, location: LocationKind): number | null {
  if (location === 'freezer') {
    if (/fisch|fish|seafood/.test(category)) return 120;
    if (/fleisch|meat|carne/.test(category)) return 365;
    if (/obst|fruit|gemuse|vegetable/.test(category)) return 270;
  }
  if (location === 'fridge') {
    if (/fisch|fish/.test(category)) return 2;
    if (/milch|dairy|milchprodukt/.test(category)) return 7;
    if (/obst|fruit|gemuse|vegetable/.test(category)) return 5;
  }
  return null;
}

/**
 * Liefert die vorläufige Tageszahl aus der freigegebenen v2-Regelbasis.
 * Die Werte bleiben absichtlich in dieser reinen Funktion austauschbar, bis
 * die fachliche Prüfung der Lebensmittelsicherheitswerte abgeschlossen ist.
 */
export function estimateOpenedExpiryDays(input: {
  name: string;
  category?: string | null;
  locationKind?: string | null;
}): number {
  const name = normalize(input.name);
  const category = normalize(input.category);
  const universal = firstMatch(name, UNIVERSAL_RULES);
  if (universal !== null) return universal;

  const location = normalizeLocation(input.locationKind);
  const rules =
    location === 'freezer' ? FREEZER_RULES : location === 'fridge' ? FRIDGE_RULES : PANTRY_RULES;
  return (
    firstMatch(name, rules) ??
    categoryFallback(category, location) ??
    (location === 'freezer' ? 180 : location === 'fridge' ? 5 : 60)
  );
}

/** Vorläufige Verlängerung für vakuumierte Ware; ersetzt durch fam-lem.9. */
export function getVacuumExpiryDays(baseDays: number): number {
  if (baseDays >= 9999) return baseDays;
  return baseDays + Math.max(1, Math.ceil(baseDays * 1.5));
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
  const calculated = new Date(input.openedAt);
  calculated.setHours(12, 0, 0, 0);
  calculated.setDate(calculated.getDate() + days);
  const calculatedDate = toIsoDate(calculated);

  if (input.expiryUserSet && input.currentExpiryDate) {
    const current = parseIsoDate(input.currentExpiryDate);
    if (current && current.getTime() < calculated.getTime()) return input.currentExpiryDate;
  }

  return calculatedDate;
}
