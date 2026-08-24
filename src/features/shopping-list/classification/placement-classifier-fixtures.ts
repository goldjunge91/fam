import type { PlacementZoneId, ProductFamilyId, ProductFormId } from './placement-taxonomy';
import type { PlacementClassificationInput } from './types';

export type PlacementClassifierFixture = {
  name: string;
  categoryTags?: readonly string[];
  expected: {
    productFamilyId: ProductFamilyId;
    productFormId: ProductFormId;
    placementZoneId: PlacementZoneId;
  };
};

/** Kuratierter Domain-Korpus: eine repräsentative Eingabe pro V2-Zone. */
export const PLACEMENT_CLASSIFIER_FIXTURES: readonly PlacementClassifierFixture[] = [
  {
    name: 'Apfel',
    expected: {
      productFamilyId: 'fruit',
      productFormId: 'fresh',
      placementZoneId: 'fresh_produce',
    },
  },
  {
    name: 'Brot',
    expected: {
      productFamilyId: 'bread_baked_goods',
      productFormId: 'fresh',
      placementZoneId: 'bakery',
    },
  },
  {
    name: 'Joghurt',
    expected: {
      productFamilyId: 'yogurt',
      productFormId: 'chilled',
      placementZoneId: 'chilled_dairy_eggs',
    },
  },
  {
    name: 'Haferdrink',
    expected: {
      productFamilyId: 'plant_drink',
      productFormId: 'ambient',
      placementZoneId: 'ambient_milk_drinks',
    },
  },
  {
    name: 'Tofu',
    expected: {
      productFamilyId: 'tofu_meat_alternative',
      productFormId: 'chilled',
      placementZoneId: 'chilled_plant_based',
    },
  },
  {
    name: 'Hähnchenbrust',
    expected: {
      productFamilyId: 'poultry',
      productFormId: 'chilled',
      placementZoneId: 'meat_poultry',
    },
  },
  {
    name: 'Lachs',
    expected: {
      productFamilyId: 'fish_seafood',
      productFormId: 'chilled',
      placementZoneId: 'fish_seafood',
    },
  },
  {
    name: 'Salami',
    expected: {
      productFamilyId: 'deli_cold_cuts',
      productFormId: 'chilled',
      placementZoneId: 'deli',
    },
  },
  {
    name: 'Nudeln',
    expected: { productFamilyId: 'pasta', productFormId: 'dry', placementZoneId: 'pasta_tomato' },
  },
  {
    name: 'Reis',
    expected: {
      productFamilyId: 'rice',
      productFormId: 'dry',
      placementZoneId: 'rice_world_foods',
    },
  },
  {
    name: 'Müsli',
    expected: {
      productFamilyId: 'breakfast_cereal',
      productFormId: 'dry',
      placementZoneId: 'breakfast',
    },
  },
  {
    name: 'Mehl',
    expected: { productFamilyId: 'flour_baking', productFormId: 'dry', placementZoneId: 'baking' },
  },
  {
    name: 'Olivenöl',
    expected: {
      productFamilyId: 'oil_vinegar',
      productFormId: 'ambient',
      placementZoneId: 'oils_spices',
    },
  },
  {
    name: 'Ketchup',
    expected: {
      productFamilyId: 'condiments',
      productFormId: 'ambient',
      placementZoneId: 'condiments',
    },
  },
  {
    name: 'Konserve Bohnen',
    expected: {
      productFamilyId: 'canned_food',
      productFormId: 'canned_jarred',
      placementZoneId: 'canned_jars',
    },
  },
  {
    name: 'Tomatensuppe',
    expected: {
      productFamilyId: 'soup_ready_meal',
      productFormId: 'prepared',
      placementZoneId: 'ready_meals',
    },
  },
  {
    name: 'Chips',
    expected: {
      productFamilyId: 'savory_snacks',
      productFormId: 'ambient',
      placementZoneId: 'snacks',
    },
  },
  {
    name: 'Bonbons',
    expected: { productFamilyId: 'sweets', productFormId: 'ambient', placementZoneId: 'sweets' },
  },
  {
    name: 'Wasser',
    expected: {
      productFamilyId: 'water_soft_drinks',
      productFormId: 'ambient',
      placementZoneId: 'cold_drinks',
    },
  },
  {
    name: 'Kaffee',
    expected: { productFamilyId: 'coffee', productFormId: 'dry', placementZoneId: 'hot_drinks' },
  },
  {
    name: 'Wein',
    expected: {
      productFamilyId: 'alcoholic_beverages',
      productFormId: 'ambient',
      placementZoneId: 'alcohol',
    },
  },
  {
    name: 'Tiefkühlpizza',
    expected: { productFamilyId: 'other_food', productFormId: 'frozen', placementZoneId: 'frozen' },
  },
  {
    name: 'Babynahrung',
    expected: { productFamilyId: 'baby_food', productFormId: 'ambient', placementZoneId: 'baby' },
  },
  {
    name: 'Katzenfutter',
    expected: { productFamilyId: 'pet_food', productFormId: 'ambient', placementZoneId: 'pets' },
  },
  {
    name: 'Spülmittel',
    expected: {
      productFamilyId: 'household_cleaning',
      productFormId: 'ambient',
      placementZoneId: 'household',
    },
  },
  {
    name: 'Shampoo',
    expected: {
      productFamilyId: 'personal_care',
      productFormId: 'ambient',
      placementZoneId: 'personal_care',
    },
  },
  {
    name: 'Unbekannter Artikel XYZ',
    expected: { productFamilyId: 'other_food', productFormId: 'ambient', placementZoneId: 'other' },
  },
];

export function fixtureInput(fixture: PlacementClassifierFixture): PlacementClassificationInput {
  return {
    name: fixture.name,
    categoryTags: fixture.categoryTags,
  };
}
