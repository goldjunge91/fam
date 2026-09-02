import { createCustomFoodSelection } from '@/features/profile/domain/food-rules';
import {
  fetchProfileFoodRules,
  profileFoodRulesQueryKey,
  saveProfileFoodRules,
} from '@/features/profile/food-rules-api';
import { getSupabase } from '@/lib/supabase';

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(),
}));

const queryBuilder = {
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
  select: mockSelect,
  upsert: mockUpsert,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockReturnValue(queryBuilder);
  mockSelect.mockReturnValue(queryBuilder);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue(queryBuilder);
  jest
    .mocked(getSupabase)
    .mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabase>);
});

test('trennt Lebensmittelregeln im Query-Cache nach Account', () => {
  expect(profileFoodRulesQueryKey('user-1')).toEqual(['profile-food-rules', 'user-1']);
});

test('liefert leere Regeln, solange noch keine Zeile gespeichert wurde', async () => {
  await expect(fetchProfileFoodRules('user-1')).resolves.toEqual({
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
  });

  expect(mockFrom).toHaveBeenCalledWith('profile_food_rules');
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
});

test('liest gespeicherte Codes und freie Einträge in den logischen Vertrag', async () => {
  mockMaybeSingle.mockResolvedValueOnce({
    data: {
      allergy_codes: ['peanuts'],
      custom_allergies: ['Johannisbrot'],
      intolerance_codes: ['lactose'],
      custom_intolerances: ['Histamin'],
      disliked_foods: ['Oliven'],
    },
    error: null,
  });

  await expect(fetchProfileFoodRules('user-1')).resolves.toEqual({
    allergies: [{ source: 'preset', code: 'peanuts' }, createCustomFoodSelection('Johannisbrot')],
    intolerances: [{ source: 'preset', code: 'lactose' }, createCustomFoodSelection('Histamin')],
    dislikedFoods: [createCustomFoodSelection('Oliven')],
  });
});

test('speichert alle drei Kategorien gemeinsam per Upsert', async () => {
  await saveProfileFoodRules('user-1', {
    allergies: [{ source: 'preset', code: 'peanuts' }, createCustomFoodSelection('Johannisbrot')],
    intolerances: [{ source: 'preset', code: 'lactose' }],
    dislikedFoods: [createCustomFoodSelection('Oliven')],
  });

  expect(mockUpsert).toHaveBeenCalledWith(
    {
      user_id: 'user-1',
      allergy_codes: ['peanuts'],
      custom_allergies: ['Johannisbrot'],
      intolerance_codes: ['lactose'],
      custom_intolerances: [],
      disliked_foods: ['Oliven'],
    },
    { onConflict: 'user_id' },
  );
});

test('reicht Datenbankfehler beim Speichern weiter', async () => {
  mockUpsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });

  await expect(
    saveProfileFoodRules('user-1', {
      allergies: [],
      intolerances: [],
      dislikedFoods: [],
    }),
  ).rejects.toThrow('permission denied');
});
