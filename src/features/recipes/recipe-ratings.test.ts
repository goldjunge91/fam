import AsyncStorage from '@react-native-async-storage/async-storage';

import { getRecipeRating, saveRecipeRating } from '@/features/recipes/recipe-ratings';

describe('recipe-ratings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('gibt null zurück wenn keine Bewertung existiert', async () => {
    const rating = await getRecipeRating('rec-1');
    expect(rating).toBeNull();
  });

  it('speichert und liest Bewertung mit Score (1-10) und Notiz', async () => {
    await saveRecipeRating('rec-1', 9, 'Fantastisch gewürzt');

    const rating = await getRecipeRating('rec-1');
    expect(rating).not.toBeNull();
    expect(rating?.score).toBe(9);
    expect(rating?.note).toBe('Fantastisch gewürzt');
  });

  it('begrenzt Score auf den Bereich 1 bis 10', async () => {
    await saveRecipeRating('rec-low', -5, '');
    await saveRecipeRating('rec-high', 15, '');

    const low = await getRecipeRating('rec-low');
    const high = await getRecipeRating('rec-high');

    expect(low?.score).toBe(1);
    expect(high?.score).toBe(10);
  });
});
