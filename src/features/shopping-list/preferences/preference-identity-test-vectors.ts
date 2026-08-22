import type { ShoppingCategoryPreferenceKey } from './preference-identity';

/** Plattformübergreifende Referenzwerte für App, Node/Bun und spätere Backends. */
export const PREFERENCE_ID_TEST_VECTORS: readonly {
  input: ShoppingCategoryPreferenceKey;
  canonicalKey: string;
  expectedId: string;
}[] = [
  {
    input: {
      householdId: '11111111-1111-4111-8111-111111111111',
      keyType: 'product',
      normalizedKeyValue: '22222222-2222-4222-8222-222222222222',
    },
    canonicalKey:
      'shopping-category-preference/v1\n11111111-1111-4111-8111-111111111111\nproduct\n36:22222222-2222-4222-8222-222222222222',
    expectedId: '7ae73655-861f-5867-acb3-d60dd420a97b',
  },
  {
    input: {
      householdId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      keyType: 'name',
      normalizedKeyValue: 'hafermilch',
    },
    canonicalKey:
      'shopping-category-preference/v1\naaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\nname\n10:hafermilch',
    expectedId: '226dc221-915c-5ad6-b818-d774f47dc990',
  },
  {
    input: {
      householdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      keyType: 'name',
      normalizedKeyValue: 'crème fraîche',
    },
    canonicalKey:
      'shopping-category-preference/v1\naaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\nname\n15:crème fraîche',
    expectedId: '42582fa5-972b-507d-b3d4-b371f22cb30a',
  },
];
