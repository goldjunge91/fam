import AsyncStorage from '@react-native-async-storage/async-storage';

import { migrateLegacyRecipePreferences } from './legacy-recipe-preferences';
import { setStoredRecipeFavorite, writeStoredRecipeRating } from './recipe-preferences-repository';

jest.mock('./recipe-preferences-repository', () => ({
  setStoredRecipeFavorite: jest.fn().mockResolvedValue(undefined),
  writeStoredRecipeRating: jest.fn().mockResolvedValue({
    score: 8,
    note: 'gut',
    updatedAt: Date.parse('2026-01-02T03:04:05.000Z'),
  }),
}));

describe('legacy recipe preferences', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('übernimmt Favoriten und Bewertungen einmalig für die wiederhergestellte Session', async () => {
    await AsyncStorage.setItem(
      'fam.recipe-favorites.v1',
      JSON.stringify(['recipe:one', 'template:two', 'invalid']),
    );
    await AsyncStorage.setItem(
      'fam.recipe-ratings.v1',
      JSON.stringify({
        one: { score: 8, note: 'gut', updatedAt: '2026-01-02T03:04:05.000Z' },
      }),
    );

    await migrateLegacyRecipePreferences('user-a');

    expect(setStoredRecipeFavorite).toHaveBeenCalledWith('user-a', 'recipe:one', true);
    expect(setStoredRecipeFavorite).toHaveBeenCalledWith('user-a', 'template:two', true);
    expect(writeStoredRecipeRating).toHaveBeenCalledWith(
      'user-a',
      'recipe:one',
      8,
      'gut',
      Date.parse('2026-01-02T03:04:05.000Z'),
    );
    await expect(AsyncStorage.getItem('fam.recipe-favorites.v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('fam.recipe-ratings.v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('@fam/migrations/recipe-favorites-v1')).resolves.toBe('done');
    await expect(AsyncStorage.getItem('@fam/migrations/recipe-ratings-v1')).resolves.toBe('done');
  });

  it('verwirft beide mehrdeutigen Altwerte ohne wiederhergestellte Session', async () => {
    await AsyncStorage.setItem('fam.recipe-favorites.v1', JSON.stringify(['recipe:one']));
    await AsyncStorage.setItem(
      'fam.recipe-ratings.v1',
      JSON.stringify({ one: { score: 8, note: 'gut' } }),
    );

    await migrateLegacyRecipePreferences(null);

    expect(setStoredRecipeFavorite).not.toHaveBeenCalled();
    expect(writeStoredRecipeRating).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem('fam.recipe-favorites.v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('fam.recipe-ratings.v1')).resolves.toBeNull();
  });

  it('achtet für Favoriten und Bewertungen getrennt auf ihre Marker', async () => {
    await AsyncStorage.setItem('fam.recipe-favorites.v1', JSON.stringify(['recipe:one']));
    await AsyncStorage.setItem('fam.recipe-ratings.v1', JSON.stringify({}));
    await AsyncStorage.setItem('@fam/migrations/recipe-favorites-v1', 'done');

    await migrateLegacyRecipePreferences('user-a');

    expect(setStoredRecipeFavorite).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem('fam.recipe-favorites.v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('fam.recipe-ratings.v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('@fam/migrations/recipe-ratings-v1')).resolves.toBe('done');
  });

  it('führt Bewertungen und ihren Marker trotz fehlgeschlagener Favoritenmigration fort', async () => {
    jest.mocked(setStoredRecipeFavorite).mockRejectedValueOnce(new Error('favorite failed'));
    await AsyncStorage.setItem('fam.recipe-favorites.v1', JSON.stringify(['recipe:one']));
    await AsyncStorage.setItem(
      'fam.recipe-ratings.v1',
      JSON.stringify({ one: { score: 8, note: 'gut' } }),
    );

    await expect(migrateLegacyRecipePreferences('user-a')).rejects.toThrow(/fehlgeschlagen/);

    expect(writeStoredRecipeRating).toHaveBeenCalledWith(
      'user-a',
      'recipe:one',
      8,
      'gut',
      expect.any(Number),
    );
    await expect(AsyncStorage.getItem('@fam/migrations/recipe-favorites-v1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('@fam/migrations/recipe-ratings-v1')).resolves.toBe('done');
  });
});
