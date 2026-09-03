export const DATASET_VERSION = 'synthetic-v1';

// expiry_days is relative to this date, never a food-safety decision.
const REFERENCE_DATE = '2026-09-03';
const SIZES = [1, 2, 3, 4, 6];
const STATES = [
  'empty_shopping_list',
  'shopping_declined',
  'shopping_promised_planned_ingredients',
  'generative_fallback',
  'priority_pressure',
];

// Quantities are per serving. Pack/dose weights stay in the explicit food name;
// the inventory unit is preserved, including when an opened lot is fractional.
const food = (name, quantity, unit, category, allergens = []) => ({
  name, quantity, unit, category, allergens,
});

const families = [
  {
    id: 'apfelporridge',
    titles: ['Apfelporridge', 'Apfelporridge ohne Beeren', 'Beeren-Apfelporridge', 'Birnenporridge', 'Fruchtporridge aus zwei Haferlosen'],
    foods: [food('Haferflocken', 60, 'g', 'Getreide', ['Gluten']), food('Apfel', 1, 'pcs', 'Obst'), food('Haferdrink', 150, 'ml', 'Pflanzendrink', ['Gluten'])],
    fallback: food('Birne', 1, 'pcs', 'Obst'),
    extras: [food('Heidelbeere', 50, 'g', 'Obst'), food('Banane', 0.5, 'pcs', 'Obst')],
    staples: ['Wasser', 'Zimt'],
    preferences: ['vegan', 'Frühstück'],
  },
  {
    id: 'kartoffeleintopf',
    titles: ['Kartoffel-Karotten-Eintopf', 'Kartoffeleintopf ohne Lauch', 'Kartoffel-Lauch-Eintopf', 'Kartoffel-Zucchini-Topf', 'Kartoffeleintopf aus zwei Kartoffellosen'],
    foods: [food('Kartoffel', 0.3, 'kg', 'Gemüse'), food('Karotte', 120, 'g', 'Gemüse'), food('Zwiebel', 40, 'g', 'Gemüse')],
    fallback: food('Zucchini', 180, 'g', 'Gemüse'),
    extras: [food('Lauch', 100, 'g', 'Gemüse'), food('Petersilie', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Rapsöl', 'Salz', 'Muskat'],
    preferences: ['vegan', 'Eintopf'],
  },
  {
    id: 'linsendal',
    titles: ['Tomaten-Linsen-Dal mit Reis', 'Linsen-Dal ohne Spinat', 'Spinat-Linsen-Dal mit Reis', 'Karotten-Linsen-Dal', 'Linsen-Dal aus zwei Linsenlosen'],
    foods: [food('Rote Linsen', 80, 'g', 'Hülsenfrüchte'), food('Tomate', 150, 'g', 'Gemüse'), food('Basmatireis', 60, 'g', 'Getreide')],
    fallback: food('Karotte', 150, 'g', 'Gemüse'),
    extras: [food('Spinat', 80, 'g', 'Gemüse'), food('Kokosmilch', 100, 'ml', 'Konserve')],
    staples: ['Wasser', 'Rapsöl', 'Salz', 'Kurkuma', 'Kreuzkümmel'],
    preferences: ['vegan', 'proteinreich'],
  },
  {
    id: 'kichererbsensalat',
    titles: ['Kichererbsen-Couscous-Salat', 'Couscous-Salat ohne Paprika', 'Paprika-Kichererbsen-Salat', 'Tomaten-Kichererbsen-Couscous', 'Couscous-Salat aus zwei Kichererbsenlosen'],
    foods: [food('Kichererbsen (240-g-Dose, Abtropfgewicht)', 0.5, 'dose', 'Hülsenfrüchte'), food('Gurke', 150, 'g', 'Gemüse'), food('Couscous', 70, 'g', 'Getreide', ['Gluten'])],
    fallback: food('Tomate', 150, 'g', 'Gemüse'),
    extras: [food('Rote Paprika', 100, 'g', 'Gemüse'), food('Petersilie', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Olivenöl', 'Zitronensaft', 'Salz'],
    preferences: ['vegan', 'Salat'],
  },
  {
    id: 'spinatomelett',
    titles: ['Spinatomelett mit Vollkornbrot', 'Spinatomelett ohne Pilze', 'Pilz-Spinat-Omelett mit Brot', 'Zucchiniomelett mit Brot', 'Gemüseomelett aus zwei Eierlosen'],
    foods: [food('Ei', 2, 'pcs', 'Eier', ['Ei']), food('Spinat', 100, 'g', 'Gemüse'), food('Vollkornbrot', 80, 'g', 'Brot', ['Gluten'])],
    fallback: food('Zucchini', 150, 'g', 'Gemüse'),
    extras: [food('Champignon', 100, 'g', 'Pilze'), food('Schnittlauch', 5, 'g', 'Kräuter')],
    staples: ['Rapsöl', 'Salz', 'Pfeffer'],
    preferences: ['vegetarisch', 'schnell'],
  },
  {
    id: 'tofunudeln',
    titles: ['Tofu-Brokkoli-Reisnudeln', 'Tofunudeln ohne Paprika', 'Tofunudeln mit Paprika und Limette', 'Tofu-Karotten-Reisnudeln', 'Gemüsereisnudeln aus zwei Tofulosen'],
    foods: [food('Naturtofu (200-g-Packung)', 0.75, 'pack', 'Pflanzliches Protein', ['Soja']), food('Brokkoli', 180, 'g', 'Gemüse'), food('Reisnudeln', 70, 'g', 'Getreide')],
    fallback: food('Karotte', 180, 'g', 'Gemüse'),
    extras: [food('Rote Paprika', 100, 'g', 'Gemüse'), food('Limette', 0.5, 'pcs', 'Obst')],
    staples: ['Wasser', 'Rapsöl', 'Salz', 'Ingwer'],
    preferences: ['vegan', 'proteinreich'],
  },
  {
    id: 'blumenkohlquinoa',
    titles: ['Blumenkohl-Quinoa-Pfanne', 'Blumenkohlquinoa ohne Erbsen', 'Blumenkohl-Erbsen-Quinoa', 'Blumenkohl-Karotten-Quinoa', 'Quinoapfanne aus zwei Blumenkohllosen'],
    foods: [food('Blumenkohl', 0.25, 'kg', 'Gemüse'), food('Rote Paprika', 100, 'g', 'Gemüse'), food('Quinoa', 70, 'g', 'Getreide')],
    fallback: food('Karotte', 120, 'g', 'Gemüse'),
    extras: [food('Erbsen', 100, 'g', 'Gemüse'), food('Zitronensaft', 15, 'ml', 'Fruchtsaft')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Kreuzkümmel'],
    preferences: ['vegan', 'glutenfrei'],
  },
  {
    id: 'haehnchenreis',
    titles: ['Hähnchen-Zucchini-Reispfanne', 'Hähnchenreis ohne Paprika', 'Hähnchen-Pilz-Reispfanne', 'Hähnchen-Brokkoli-Reispfanne', 'Gemüsereis aus zwei Hähnchenlosen'],
    foods: [food('Hähnchenbrust', 150, 'g', 'Fleisch'), food('Zucchini', 180, 'g', 'Gemüse'), food('Langkornreis', 70, 'g', 'Getreide')],
    fallback: food('Brokkoli', 180, 'g', 'Gemüse'),
    extras: [food('Rote Paprika', 100, 'g', 'Gemüse'), food('Champignon', 100, 'g', 'Pilze')],
    staples: ['Wasser', 'Rapsöl', 'Salz', 'Paprikapulver'],
    preferences: ['proteinreich', 'ohne Milchprodukte'],
  },
  {
    id: 'ofenlachs',
    titles: ['Ofenlachs mit Brokkoli und Kartoffeln', 'Ofenlachs ohne Zitrone', 'Zitronenlachs mit Brokkoli', 'Ofenlachs mit Spinat und Kartoffeln', 'Ofenlachs aus zwei Fischlosen'],
    foods: [food('Lachsfilet', 150, 'g', 'Fisch', ['Fisch']), food('Brokkoli', 200, 'g', 'Gemüse'), food('Kartoffel', 0.25, 'kg', 'Gemüse')],
    fallback: food('Spinat', 150, 'g', 'Gemüse'),
    extras: [food('Zitrone', 0.5, 'pcs', 'Obst'), food('Dill', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Pfeffer'],
    preferences: ['pescetarisch', 'Ofengericht'],
  },
  {
    id: 'pilznudeln',
    titles: ['Pilz-Vollkornnudelpfanne', 'Pilznudeln ohne Hafercuisine', 'Cremige Pilznudeln', 'Pilz-Lauch-Nudeln', 'Vollkornnudeln aus zwei Pilzlosen'],
    foods: [food('Champignon', 200, 'g', 'Pilze'), food('Zwiebel', 40, 'g', 'Gemüse'), food('Vollkornnudeln', 90, 'g', 'Getreide', ['Gluten'])],
    fallback: food('Lauch', 100, 'g', 'Gemüse'),
    extras: [food('Hafercuisine', 75, 'ml', 'Pflanzliche Alternative', ['Gluten']), food('Petersilie', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Pfeffer'],
    preferences: ['vegan', 'schnell'],
  },
  {
    id: 'auberginenbulgur',
    titles: ['Auberginen-Tomaten-Topf mit Bulgur', 'Auberginenbulgur ohne Kichererbsen', 'Auberginen-Kichererbsen-Bulgur', 'Auberginenbulgur mit frischen Tomaten', 'Bulgurtopf aus zwei Auberginenlosen'],
    foods: [food('Aubergine', 0.5, 'pcs', 'Gemüse'), food('Passierte Tomaten', 200, 'ml', 'Konserve'), food('Bulgur', 70, 'g', 'Getreide', ['Gluten'])],
    fallback: food('Tomate', 180, 'g', 'Gemüse'),
    extras: [food('Kichererbsen (240-g-Dose, Abtropfgewicht)', 0.5, 'dose', 'Hülsenfrüchte'), food('Petersilie', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Kreuzkümmel'],
    preferences: ['vegan', 'Eintopf'],
  },
  {
    id: 'suesskartoffelchili',
    titles: ['Süßkartoffel-Bohnen-Chili', 'Bohnen-Chili ohne Mais', 'Süßkartoffel-Chili mit Mais', 'Süßkartoffel-Paprika-Bohnenpfanne', 'Chili aus zwei Süßkartoffellosen'],
    foods: [food('Süßkartoffel', 0.3, 'kg', 'Gemüse'), food('Tomate', 150, 'g', 'Gemüse'), food('Kidneybohnen (240-g-Dose, Abtropfgewicht)', 0.5, 'dose', 'Hülsenfrüchte')],
    fallback: food('Rote Paprika', 180, 'g', 'Gemüse'),
    extras: [food('Mais (140-g-Dose, Abtropfgewicht)', 0.5, 'dose', 'Konserve'), food('Koriander', 5, 'g', 'Kräuter')],
    staples: ['Wasser', 'Rapsöl', 'Salz', 'Kreuzkümmel', 'Paprikapulver'],
    preferences: ['vegan', 'glutenfrei'],
  },
  {
    id: 'bohnenkohltopf',
    titles: ['Bohnen-Grünkohl-Topf mit Brot', 'Bohnentopf ohne Sellerie', 'Bohnen-Grünkohl-Topf mit Sellerie', 'Bohnen-Wirsing-Topf mit Brot', 'Kohltopf aus zwei Bohnenlosen'],
    foods: [food('Weiße Bohnen (240-g-Dose, Abtropfgewicht)', 0.5, 'dose', 'Hülsenfrüchte'), food('Grünkohl', 150, 'g', 'Gemüse'), food('Vollkornbrot', 80, 'g', 'Brot', ['Gluten'])],
    fallback: food('Wirsing', 150, 'g', 'Gemüse'),
    extras: [food('Knollensellerie', 50, 'g', 'Gemüse', ['Sellerie']), food('Karotte', 100, 'g', 'Gemüse')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Pfeffer'],
    preferences: ['vegan', 'Eintopf'],
  },
  {
    id: 'fruehstuecksquark',
    titles: ['Bananenquark mit Dinkelflocken', 'Bananenquark ohne Beeren', 'Beeren-Bananenquark', 'Apfelquark mit Dinkelflocken', 'Fruchtquark aus zwei Quarklosen'],
    foods: [food('Quark', 200, 'g', 'Milchprodukte', ['Milch']), food('Banane', 1, 'pcs', 'Obst'), food('Dinkelflocken', 50, 'g', 'Getreide', ['Gluten'])],
    fallback: food('Apfel', 1, 'pcs', 'Obst'),
    extras: [food('Erdbeere', 100, 'g', 'Obst'), food('Heidelbeere', 50, 'g', 'Obst')],
    staples: ['Wasser', 'Zimt'],
    preferences: ['vegetarisch', 'Frühstück', 'proteinreich'],
  },
  {
    id: 'gemuesepolenta',
    titles: ['Polenta mit Tomaten und Spinat', 'Gemüsepolenta ohne Pilze', 'Pilz-Tomaten-Polenta', 'Kürbis-Spinat-Polenta', 'Gemüsepolenta aus zwei Polentalosen'],
    foods: [food('Polenta', 75, 'g', 'Getreide'), food('Tomate', 180, 'g', 'Gemüse'), food('Spinat', 100, 'g', 'Gemüse')],
    fallback: food('Kürbis', 200, 'g', 'Gemüse'),
    extras: [food('Champignon', 100, 'g', 'Pilze'), food('Rosmarin', 2, 'g', 'Kräuter')],
    staples: ['Wasser', 'Olivenöl', 'Salz', 'Pfeffer'],
    preferences: ['vegan', 'glutenfrei'],
  },
];

const allergyProfiles = [
  { allergy: 'Erdnüsse', food: food('Erdnussmus', 30, 'g', 'Nussmus', ['Erdnüsse']) },
  { allergy: 'Milch', food: food('Sahne', 100, 'ml', 'Milchprodukte', ['Milch']) },
  { allergy: 'Sesam', food: food('Sesamöl', 10, 'ml', 'Öl', ['Sesam']) },
  { allergy: 'Soja', food: food('Sojajoghurt', 150, 'g', 'Pflanzliche Alternative', ['Soja']) },
  { allergy: 'Schalenfrüchte', food: food('Walnuss', 30, 'g', 'Nüsse', ['Schalenfrüchte']) },
  { allergy: 'Gluten', food: food('Weizenmehl', 100, 'g', 'Getreide', ['Gluten']) },
  { allergy: 'Ei', food: food('Mayonnaise mit Ei', 20, 'g', 'Sauce', ['Ei']) },
  { allergy: 'Sellerie', food: food('Selleriesalz', 5, 'g', 'Gewürze', ['Sellerie']) },
];

const rounded = (quantity) => Math.round(quantity * 1000) / 1000;

function makeScenario(family, familyIndex, stateIndex) {
  const scenario_id = `synthetic-${String(familyIndex * 5 + stateIndex + 1).padStart(3, '0')}`;
  const scenario_type = STATES[stateIndex];
  const servings = SIZES[(familyIndex + stateIndex) % SIZES.length];
  const accepted = stateIndex === 2;
  const fallback = stateIndex === 3;
  const pressure = stateIndex === 4;
  const shopping = stateIndex === 1 || accepted;
  const core = family.foods.map((item, index) => fallback && index === 1 ? family.fallback : item);
  const compatibleProfiles = allergyProfiles.filter(({ allergy }) =>
    [...core, ...family.extras].every((item) => !item.allergens.includes(allergy)),
  );
  const profileIndex = (familyIndex + stateIndex) % compatibleProfiles.length;
  const profiles = stateIndex === 0 && familyIndex % 3 === 0 ? [] : [compatibleProfiles[profileIndex]];
  if (accepted && familyIndex % 3 === 0) profiles.push(compatibleProfiles[(profileIndex + 1) % compatibleProfiles.length]);
  const allergies = profiles.map((profile) => profile.allergy);
  const forbidden_ingredients = ['Rotwein', 'Chilischote', ...profiles.map((profile) => profile.food.name)];

  function inventory(item, suffix, expiry_days, priority_score, opened) {
    return {
      inventory_item_id: `${scenario_id}-${suffix}`,
      name: item.name,
      quantity: rounded(item.quantity * servings),
      unit: item.unit,
      expiry_days,
      opened: opened || (['pack', 'dose'].includes(item.unit) && !Number.isInteger(item.quantity * servings)),
      allergens: [...item.allergens],
      usable: true,
      category: item.category,
      priority_score,
    };
  }

  const selected = core.map((item, index) => inventory(
    item, `food-${index + 1}`,
    index === 0 ? (pressure ? 0 : 2) : item.category === 'Getreide' ? 180 : 3,
    [0.98, 0.86, 0.65][index], stateIndex > 0,
  ));
  if (fallback && family.id === 'apfelporridge') selected[0].expiry_days = -1;
  if (pressure) {
    const first = selected[0];
    const olderQuantity = first.unit === 'pcs'
      ? Math.max(1, Math.floor(first.quantity / 3))
      : rounded(first.quantity / 4);
    selected.push({
      ...first, inventory_item_id: `${scenario_id}-lot-new`,
      quantity: rounded(first.quantity - olderQuantity), expiry_days: 3, priority_score: 0.74,
      opened: ['pack', 'dose'].includes(first.unit) && !Number.isInteger(rounded(first.quantity - olderQuantity)),
      allergens: [...first.allergens],
    });
    first.quantity = olderQuantity;
    first.opened = true;
    selected.push(...family.extras.map((item, index) => inventory(item, `extra-${index + 1}`, 2, 0.65, false)));
  }

  const longlife = inventory(food('Zucker', 500, 'g', 'Backvorrat'), 'longlife', 365, 0.05, false);
  // An explicit synthetic unusable status excludes this item, independently of MHD.
  const unusable = { ...inventory(food('Blattsalat', 100, 'g', 'Gemüse'), 'unusable', 3, 1, true), usable: false };
  const blocked = inventory(food('Chilischote', 1, 'pcs', 'Gemüse'), 'blocked', 0, 1, false);
  const synthetic_inventory = [...selected, longlife, unusable, blocked];
  synthetic_inventory.push(...profiles.map((profile, index) => inventory(profile.food, `allergen-${index + 1}`, 1, 1, true)));

  const priority_foods = selected
    .filter((item) => item.usable && !forbidden_ingredients.includes(item.name) && !item.allergens.some((allergen) => allergies.includes(allergen)))
    .sort((a, b) => b.priority_score - a.priority_score || (a.inventory_item_id < b.inventory_item_id ? -1 : 1))
    .map((item) => ({
      inventory_item_id: item.inventory_item_id, name: item.name,
      available_quantity: item.quantity, unit: item.unit, priority_score: item.priority_score,
    }));
  const shopping_list = shopping ? family.extras.slice(0, familyIndex % 2 + 1).map((item, index) => ({
    shopping_item_id: `${scenario_id}-shop-${index + 1}`, name: item.name,
    quantity: rounded(item.quantity * servings), unit: item.unit,
  })) : [];
  const planned_shopping_items = accepted ? shopping_list.map((item) => ({ ...item })) : [];
  const ingredient_names = [...new Set([
    ...priority_foods.map((item) => item.name), ...family.staples,
    ...planned_shopping_items.map((item) => item.name),
  ])];
  const stateDescriptions = [
    'Leere Einkaufsliste; vollständig aus dem Bestand kochen.',
    `Einkauf abgelehnt; ${shopping_list.map((item) => item.name).join(' und ')} bleiben unbestätigt. Die vorhandenen Mengen reichen genau.`,
    `Einkauf zugesagt; ${planned_shopping_items.map((item) => item.name).join(' und ')} sind fest eingeplant.`,
    `Kein Katalogtreffer; ${family.titles[3]} ist aus dem veränderten Bestand möglich.`,
    'Geöffnetes älteres Los zuerst nutzen; zwei getrennte Lose reichen zusammen genau. Gleich bewertete Beilagen haben eine feste ID-Reihenfolge.',
  ];
  return {
    scenario_id, scenario_type,
    description: `${family.titles[stateIndex]} für ${servings} Personen. ${stateDescriptions[stateIndex]}`,
    tags: [
      `family:${family.id}`, `reference_date:${REFERENCE_DATE}`, `household:${servings}`,
      scenario_type, 'trusted_synthetic_recipe', 'blocked_food', 'unusable_food', 'longlife_distractor',
      ...(allergies.length ? ['allergy_exclusion'] : ['no_allergies']),
      ...(stateIndex > 0 ? ['opened'] : []),
      ...(stateIndex === 1 || pressure ? ['quantity_boundary'] : []),
      ...(pressure ? ['duplicate_lots', 'score_tie'] : []),
      ...(selected.some((item) => item.expiry_days < 0 && item.usable) ? ['past_mhd_explicitly_usable'] : []),
    ],
    synthetic_inventory, shopping_list,
    shopping_decision: accepted ? 'accepted' : shopping ? 'declined' : 'not_needed',
    compact_context: {
      schema_version: 1,
      request: { type: 'recipe_suggestion', servings },
      constraints: {
        allergies, preferences: [...family.preferences, 'mild'],
        allowed_staples: [...family.staples], forbidden_ingredients,
      },
      priority_foods, planned_shopping_items,
      candidate_recipes: fallback ? [] : [{
        id: `${scenario_id}-recipe`, source: stateIndex % 2 === 0 ? 'template' : 'catalog',
        title: family.titles[stateIndex], ingredient_names,
      }],
      shopping_question: null,
      fallback_allowed: fallback,
    },
    expected: {
      servings, required_priority_ids: [priority_foods[0].inventory_item_id],
      min_used_items: 2,
    },
  };
}

export const syntheticScenarios = families.flatMap((family, familyIndex) =>
  STATES.map((_, stateIndex) => makeScenario(family, familyIndex, stateIndex)),
);
