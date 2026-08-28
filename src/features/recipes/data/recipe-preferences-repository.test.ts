import { getDrizzleDatabase } from '@/lib/db/client';
import {
  listFavoriteRecipeKeys,
  readStoredRecipeRating,
  setStoredRecipeFavorite,
  toggleStoredRecipeFavorite,
  writeStoredRecipeRating,
} from './recipe-preferences-repository';

jest.mock('@/lib/db/client', () => ({
  getDrizzleDatabase: jest.fn(),
}));

describe('recipe preferences repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verweigert jeden Zugriff ohne user_id vor dem Öffnen der Datenbank', async () => {
    await expect(listFavoriteRecipeKeys('')).rejects.toThrow('user_id');
    await expect(setStoredRecipeFavorite(' ', 'recipe:one', true)).rejects.toThrow('user_id');
    await expect(toggleStoredRecipeFavorite('', 'recipe:one')).rejects.toThrow('user_id');
    await expect(readStoredRecipeRating('', 'recipe:one')).rejects.toThrow('user_id');
    await expect(writeStoredRecipeRating('', 'recipe:one', 8, 'gut')).rejects.toThrow('user_id');

    expect(getDrizzleDatabase).not.toHaveBeenCalled();
  });

  it('schreibt die normalisierte user_id in jede neue Präferenzzeile', async () => {
    const values = jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ score: 8, note: 'gut', updatedAt: 123 }]),
      }),
    });
    jest.mocked(getDrizzleDatabase).mockResolvedValue({
      insert: jest.fn().mockReturnValue({ values }),
    } as never);

    await writeStoredRecipeRating('  user-a  ', 'recipe:one', 8, 'gut', 123);

    expect(values).toHaveBeenCalledWith({
      userId: 'user-a',
      recipeKey: 'recipe:one',
      isFavorite: false,
      rating: 8,
      note: 'gut',
      updatedAt: 123,
    });
  });
});
