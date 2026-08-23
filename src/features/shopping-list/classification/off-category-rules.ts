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
  { tag: 'en:fresh-herbs', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:fresh-salads', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:fresh-mushrooms', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:raw-fruits', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:raw-vegetables', categoryId: 'produce', priority: SPECIFIC },
  { tag: 'en:salads', categoryId: 'produce', priority: MID },

  // bakery
  { tag: 'en:breads', categoryId: 'bakery', priority: SPECIFIC },
  { tag: 'en:viennoiseries', categoryId: 'bakery', priority: SPECIFIC },
  { tag: 'en:cakes', categoryId: 'bakery', priority: MID },

  // convenience
  { tag: 'en:sandwiches', categoryId: 'convenience', priority: SPECIFIC },
  { tag: 'en:prepared-salads', categoryId: 'convenience', priority: SPECIFIC },
  { tag: 'en:sushi', categoryId: 'convenience', priority: SPECIFIC },

  // breakfast
  { tag: 'en:breakfast-cereals', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:jams', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:honeys', categoryId: 'breakfast', priority: SPECIFIC },
  { tag: 'en:spreads', categoryId: 'breakfast', priority: MID },
  { tag: 'en:breakfasts', categoryId: 'breakfast', priority: MID },

  // hot_beverages
  { tag: 'en:coffees', categoryId: 'hot_beverages', priority: SPECIFIC },
  { tag: 'en:teas', categoryId: 'hot_beverages', priority: SPECIFIC },
  { tag: 'en:herbal-teas', categoryId: 'hot_beverages', priority: SPECIFIC },
  { tag: 'en:cocoas-and-chocolates-powders', categoryId: 'hot_beverages', priority: SPECIFIC },
  { tag: 'en:hot-beverages', categoryId: 'hot_beverages', priority: MID },

  // pantry_staples
  { tag: 'en:pastas', categoryId: 'pantry_staples', priority: SPECIFIC },
  { tag: 'en:rices', categoryId: 'pantry_staples', priority: SPECIFIC },
  { tag: 'en:flours', categoryId: 'pantry_staples', priority: SPECIFIC },
  { tag: 'en:legumes', categoryId: 'pantry_staples', priority: MID },

  // cooking_baking
  { tag: 'en:vegetable-oils', categoryId: 'cooking_baking', priority: SPECIFIC },
  { tag: 'en:olive-oils', categoryId: 'cooking_baking', priority: SPECIFIC },
  { tag: 'en:vinegars', categoryId: 'cooking_baking', priority: SPECIFIC },
  { tag: 'en:spices', categoryId: 'cooking_baking', priority: SPECIFIC },
  { tag: 'en:salts', categoryId: 'cooking_baking', priority: SPECIFIC },
  { tag: 'en:baking-powders', categoryId: 'cooking_baking', priority: SPECIFIC },

  // canned_sauces
  { tag: 'en:canned-vegetables', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:canned-fruits', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:compotes', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:apple-compotes', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:applesauces', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:fruit-compotes', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:pickled-vegetables', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:tomato-sauces', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:soups', categoryId: 'canned_sauces', priority: SPECIFIC },
  { tag: 'en:condiments', categoryId: 'canned_sauces', priority: MID },
  { tag: 'en:sauces', categoryId: 'canned_sauces', priority: MID },
  { tag: 'en:canned-foods', categoryId: 'canned_sauces', priority: MID },

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

  // drugstore
  { tag: 'en:hygiene', categoryId: 'drugstore', priority: SPECIFIC },
  { tag: 'en:body-care', categoryId: 'drugstore', priority: SPECIFIC },

  // baby_kids
  { tag: 'en:baby-foods', categoryId: 'baby_kids', priority: SPECIFIC },

  // household
  { tag: 'en:cleaning-products', categoryId: 'household', priority: SPECIFIC },

  // pet_supplies
  { tag: 'en:pet-food', categoryId: 'pet_supplies', priority: SPECIFIC },
  { tag: 'en:cat-food', categoryId: 'pet_supplies', priority: SPECIFIC },
  { tag: 'en:dog-food', categoryId: 'pet_supplies', priority: SPECIFIC },

  // meat_poultry
  { tag: 'en:poultry', categoryId: 'meat_poultry', priority: SPECIFIC },
  { tag: 'en:beef', categoryId: 'meat_poultry', priority: SPECIFIC },
  { tag: 'en:porks', categoryId: 'meat_poultry', priority: SPECIFIC },
  { tag: 'en:meats', categoryId: 'meat_poultry', priority: MID },

  // fish_seafood
  { tag: 'en:fishes', categoryId: 'fish_seafood', priority: SPECIFIC },
  { tag: 'en:seafood', categoryId: 'fish_seafood', priority: SPECIFIC },

  // deli_cold_cuts
  { tag: 'en:hams', categoryId: 'deli_cold_cuts', priority: SPECIFIC },
  { tag: 'en:sausages', categoryId: 'deli_cold_cuts', priority: SPECIFIC },
  { tag: 'en:cold-cuts', categoryId: 'deli_cold_cuts', priority: SPECIFIC },

  // plant_based
  { tag: 'en:meat-substitutes', categoryId: 'plant_based', priority: SPECIFIC },
  { tag: 'en:tofu', categoryId: 'plant_based', priority: SPECIFIC },

  // dairy_eggs
  { tag: 'en:milks', categoryId: 'dairy_eggs', priority: SPECIFIC },
  { tag: 'en:cheeses', categoryId: 'dairy_eggs', priority: SPECIFIC },
  { tag: 'en:yogurts', categoryId: 'dairy_eggs', priority: SPECIFIC },
  { tag: 'en:eggs', categoryId: 'dairy_eggs', priority: SPECIFIC },
  { tag: 'en:dairies', categoryId: 'dairy_eggs', priority: MID },

  // frozen
  { tag: 'en:frozen-foods', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-fruits', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-vegetables', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-berries', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-pizzas', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-ready-meals', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-desserts', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-fishes', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:frozen-meats', categoryId: 'frozen', priority: SPECIFIC },
  { tag: 'en:ice-creams', categoryId: 'frozen', priority: SPECIFIC },

  // checkout
  { tag: 'en:chewing-gums', categoryId: 'checkout', priority: SPECIFIC },
];
