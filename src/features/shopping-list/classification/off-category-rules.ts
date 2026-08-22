import type { ShoppingCategoryId } from './shopping-category-id';

export type OffCategoryRule = {
  /** Kanonischer Open-Food-Facts-Tag, z. B. `en:porks`. Keine Anzeigenamen. */
  tag: string;
  categoryId: ShoppingCategoryId;
  /** Höher gewinnt. Spezifische Tags stehen über Oberkategorien. */
  priority: number;
};

/**
 * Priorität-Tiers: spezifische Tags (z. B. `en:porks`) stehen bewusst über
 * Oberkategorien (z. B. `en:meats`) über generischen Sammel-Tags
 * (z. B. `en:beverages`) — siehe `docs/issue#223_V2.md` Abschnitt 7.
 *
 * Die konkrete Tagliste ist ein erster, plausibler Startsatz. Die
 * verbindliche Kalibrierung gegen den vollständigen deutschen Dump
 * (`scripts/dump_data/evaluate-categories.ts`, Paket 5) folgt separat.
 */
const SPECIFIC = 100;
const MID = 50;
const GENERIC = 10;

export const OFF_CATEGORY_RULES: readonly OffCategoryRule[] = [
  // produce
  { tag: 'en:fresh-vegetables', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:fresh-fruits', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:vegetables', categoryId: 'produce', priority: MID },
  { tag: 'en:fruits', categoryId: 'produce', priority: MID },

  // bakery
  { tag: 'en:breads', categoryId: 'bakery', priority: SPECIFIC },
  { tag: 'en:viennoiseries', categoryId: 'bakery', priority: SPECIFIC },
  { tag: 'en:cakes', categoryId: 'bakery', priority: MID },

  // deli_meat
  { tag: 'en:porks', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:poultry', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:beef', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:hams', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:sausages', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:cold-cuts', categoryId: 'deli_meat', priority: SPECIFIC },
  { tag: 'en:meats', categoryId: 'deli_meat', priority: MID },

  // pantry_canned
  { tag: 'en:canned-vegetables', categoryId: 'pantry_canned', priority: SPECIFIC },
  { tag: 'en:tomato-sauces', categoryId: 'pantry_canned', priority: SPECIFIC },
  { tag: 'en:condiments', categoryId: 'pantry_canned', priority: MID },
  { tag: 'en:sauces', categoryId: 'pantry_canned', priority: MID },
  { tag: 'en:canned-foods', categoryId: 'pantry_canned', priority: GENERIC },

  // pantry_dry
  { tag: 'en:pastas', categoryId: 'pantry_dry', priority: SPECIFIC },
  { tag: 'en:rices', categoryId: 'pantry_dry', priority: SPECIFIC },
  { tag: 'en:flours', categoryId: 'pantry_dry', priority: SPECIFIC },
  { tag: 'en:legumes', categoryId: 'pantry_dry', priority: MID },

  // breakfast
  { tag: 'en:breakfast-cereals', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:jams', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:honeys', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:breakfasts', categoryId: 'breakfast', priority: MID },

  // snacks
  { tag: 'en:chocolates', categoryId: 'snacks', priority: SPECIFIC },
  { tag: 'en:salty-snacks', categoryId: 'snacks', priority: SPECIFIC },
  { tag: 'en:sweet-snacks', categoryId: 'snacks', priority: MID },
  { tag: 'en:snacks', categoryId: 'snacks', priority: GENERIC },

  // beverages
  { tag: 'en:fruit-juices', categoryId: 'beverages', priority: SPECIFIC },
  { tag: 'en:sodas', categoryId: 'beverages', priority: SPECIFIC },
  { tag: 'en:waters', categoryId: 'beverages', priority: SPECIFIC },
  { tag: 'en:beers', categoryId: 'beverages', priority: SPECIFIC },
  { tag: 'en:wines', categoryId: 'beverages', priority: SPECIFIC },
  { tag: 'en:alcoholic-beverages', categoryId: 'beverages', priority: MID },
  { tag: 'en:beverages', categoryId: 'beverages', priority: GENERIC },

  // dairy
  { tag: 'en:milks', categoryId: 'dairy', priority: SPECIFIC },
  { tag: 'en:cheeses', categoryId: 'dairy', priority: SPECIFIC },
  { tag: 'en:yogurts', categoryId: 'dairy', priority: SPECIFIC },
  { tag: 'en:dairies', categoryId: 'dairy', priority: MID },

  // frozen
  { tag: 'en:frozen-foods', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:ice-creams', categoryId: 'frozen', priority: SPECIFIC },

  // drugstore
  { tag: 'en:hygiene', categoryId: 'drugstore', priority: SPECIFIC },
  { tag: 'en:cleaning-products', categoryId: 'drugstore', priority: SPECIFIC },

  // checkout
  { tag: 'en:chewing-gums', categoryId: 'checkout', priority: SPECIFIC },
];
