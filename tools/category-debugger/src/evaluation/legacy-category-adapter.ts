import type { CanonicalCategoryId } from './types';
import type { ProductFamilyId, ProductFormId } from './taxonomy';

/**
 * Compatibility target for evaluating the existing app classifier while the
 * richer taxonomy is collected. This mapping is not the new training target.
 */
export function legacyCategoryForTaxonomy(
  family: ProductFamilyId,
  form: ProductFormId,
): CanonicalCategoryId | null {
  if (form === 'frozen') return 'frozen';
  switch (family) {
    case 'fruit':
    case 'vegetables':
    case 'herbs':
    case 'potatoes_onions':
      return 'produce';
    case 'bread_baked_goods':
      return 'bakery';
    case 'breakfast_cereal':
      return 'breakfast';
    case 'coffee':
    case 'tea':
      return 'hot_beverages';
    case 'pasta':
    case 'rice':
    case 'grains':
    case 'legumes':
      return form === 'canned_jarred' ? 'canned_sauces' : 'pantry_staples';
    case 'flour_baking':
    case 'oil_vinegar':
    case 'spices_seasoning':
    case 'sugar_sweeteners':
      return 'cooking_baking';
    case 'tomato_products':
    case 'pasta_sauce':
    case 'condiments':
    case 'canned_food':
    case 'spreads':
      return 'canned_sauces';
    case 'soup_ready_meal':
      return 'convenience';
    case 'savory_snacks':
    case 'sweets':
    case 'nuts_dried_fruit':
      return 'snacks';
    case 'water_soft_drinks':
    case 'juice':
    case 'alcoholic_beverages':
      return 'beverages';
    case 'personal_care':
      return 'drugstore';
    case 'baby_food':
      return 'baby_kids';
    case 'household_cleaning':
      return 'household';
    case 'pet_food':
      return 'pet_supplies';
    case 'meat':
    case 'poultry':
      return 'meat_poultry';
    case 'fish_seafood':
      return 'fish_seafood';
    case 'deli_cold_cuts':
      return 'deli_cold_cuts';
    case 'tofu_meat_alternative':
      return 'plant_based';
    case 'milk':
    case 'plant_drink':
    case 'cream':
    case 'yogurt':
    case 'cheese':
    case 'butter_margarine':
    case 'eggs':
    case 'chilled_dessert':
      return 'dairy_eggs';
    case 'other_food':
      return null;
  }
}
