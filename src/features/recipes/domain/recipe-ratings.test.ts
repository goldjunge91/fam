import { getRecipeRating, saveRecipeRating } from '@/features/recipes/domain/recipe-ratings';

const mockRatings = new Map<string, { score: number; note: string; updatedAt: number }>();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/recipes/data/recipe-preferences-repository', () => ({
  readStoredRecipeRating: jest.fn(async (userId: string, recipeKey: string) =>
    mockRatings.get(`${userId}:${recipeKey}`),
  ),
  writeStoredRecipeRating: jest.fn(
    async (userId: string, recipeKey: string, score: number, note: string) => {
      const rating = { score, note, updatedAt: Date.now() };
      mockRatings.set(`${userId}:${recipeKey}`, rating);
      return rating;
    },
  ),
}));

describe('recipe-ratings', () => {
  beforeEach(() => {
    mockRatings.clear();
  });

  it('gibt null zurück wenn keine Bewertung existiert', async () => {
    const rating = await getRecipeRating('user-1', 'rec-1');
    expect(rating).toBeNull();
  });

  it('speichert und liest Bewertung mit Score (1-10) und Notiz', async () => {
    await saveRecipeRating('user-1', 'rec-1', 9, 'Fantastisch gewürzt');

    const rating = await getRecipeRating('user-1', 'rec-1');
    expect(rating).not.toBeNull();
    expect(rating?.score).toBe(9);
    expect(rating?.note).toBe('Fantastisch gewürzt');
  });

  it('begrenzt Score auf den Bereich 1 bis 10', async () => {
    await saveRecipeRating('user-1', 'rec-low', -5, '');
    await saveRecipeRating('user-1', 'rec-high', 15, '');

    const low = await getRecipeRating('user-1', 'rec-low');
    const high = await getRecipeRating('user-1', 'rec-high');

    expect(low?.score).toBe(1);
    expect(high?.score).toBe(10);
  });
});
