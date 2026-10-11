import { getDrizzleDatabase } from '@/lib/db/local-client';
import {
  listFavoriteRecipeKeys,
  readStoredRecipeRating,
  setStoredRecipeFavorite,
  toggleStoredRecipeFavorite,
  writeStoredRecipeRating,
} from './recipe-preferences-repository';

jest.mock('@/lib/db/local-client', () => ({
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

  it('listet Favoriten und legt eine Favoritenänderung an', async () => {
    const where = jest.fn().mockResolvedValue([{ recipeKey: 'recipe:one' }]);
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({ where }),
    });
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(getDrizzleDatabase).mockResolvedValue({ select, insert } as never);

    await expect(listFavoriteRecipeKeys('user-a')).resolves.toEqual(['recipe:one']);
    await setStoredRecipeFavorite('user-a', 'recipe:two', true);

    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ isFavorite: true }) }),
    );
  });

  it('liest fehlende und vorhandene Bewertungen und behandelt ein leeres Upsert-Ergebnis', async () => {
    const limit = jest
      .fn()
      .mockResolvedValueOnce([{ score: 0, note: null, updatedAt: 123 }])
      .mockResolvedValueOnce([{ score: 8, note: null, updatedAt: 456 }]);
    const where = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({ where }),
    });
    const writeReturning = jest.fn().mockResolvedValue([]);
    const writeConflict = jest.fn().mockReturnValue({ returning: writeReturning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate: writeConflict });
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(getDrizzleDatabase).mockResolvedValue({ select, insert } as never);

    await expect(readStoredRecipeRating('user-a', 'recipe:one')).resolves.toBeNull();
    await expect(readStoredRecipeRating('user-a', 'recipe:two')).resolves.toEqual({
      score: 8,
      note: '',
      updatedAt: 456,
    });
    await expect(writeStoredRecipeRating('user-a', 'recipe:three', 7, 'gut')).rejects.toThrow(
      'konnte nicht gespeichert werden',
    );
  });

  it('gibt den Toggle-Wert aus der Rückgabe zurück und fällt bei leerer Rückgabe auf false', async () => {
    const returning = jest
      .fn()
      .mockResolvedValueOnce([{ favorite: true }])
      .mockResolvedValueOnce([]);
    const onConflictDoUpdate = jest.fn().mockReturnValue({ returning });
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = jest.fn().mockReturnValue({ values });
    jest.mocked(getDrizzleDatabase).mockResolvedValue({ insert } as never);

    await expect(toggleStoredRecipeFavorite('user-a', 'recipe:one')).resolves.toBe(true);
    await expect(toggleStoredRecipeFavorite('user-a', 'recipe:two')).resolves.toBe(false);
  });
});
