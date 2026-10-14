import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  getRecipeRating,
  resetRecipeRatingsCache,
  saveRecipeRating,
  useRecipeRating,
} from '@/features/recipes/domain/recipe-ratings';

const mockRatings = new Map<string, { score: number; note: string; updatedAt: number }>();
const mockSessionState: { session: { user: { id: string } } | null } = {
  session: { user: { id: 'user-1' } },
};
const mockRepositoryState: {
  reads: number;
  read: (
    userId: string,
    recipeKey: string,
  ) => Promise<{
    score: number;
    note: string;
    updatedAt: number;
  } | null>;
  write: (
    userId: string,
    recipeKey: string,
    score: number,
    note: string,
  ) => Promise<{ score: number; note: string; updatedAt: number } | null>;
} = {
  reads: 0,
  read: async () => null,
  write: async () => null,
};

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => mockSessionState,
}));

jest.mock('@/features/recipes/data/recipe-preferences-repository', () => ({
  readStoredRecipeRating: (userId: string, recipeKey: string) => {
    mockRepositoryState.reads += 1;
    return mockRepositoryState.read(userId, recipeKey);
  },
  writeStoredRecipeRating: (userId: string, recipeKey: string, score: number, note: string) =>
    mockRepositoryState.write(userId, recipeKey, score, note),
}));

describe('recipe-ratings', () => {
  beforeEach(() => {
    mockRatings.clear();
    mockRepositoryState.reads = 0;
    mockRepositoryState.read = async (userId, recipeKey) =>
      mockRatings.get(`${userId}:${recipeKey}`) ?? null;
    mockRepositoryState.write = async (userId, recipeKey, score, note) => {
      const rating = { score, note, updatedAt: Date.now() };
      mockRatings.set(`${userId}:${recipeKey}`, rating);
      return rating;
    };
    mockSessionState.session = { user: { id: 'user-1' } };
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

  it('lädt die Bewertung für den angemeldeten Nutzer und hält sie aktuell', async () => {
    mockRatings.set('user-1:recipe:rec-1', {
      score: 8,
      note: 'Gut',
      updatedAt: new Date('2026-10-01T12:00:00Z').getTime(),
    });
    const { result } = await renderHook(() => useRecipeRating('rec-1'));

    await waitFor(() =>
      expect(result.current).toEqual({
        score: 8,
        note: 'Gut',
        updatedAt: '2026-10-01T12:00:00.000Z',
      }),
    );

    await act(() => saveRecipeRating('user-1', 'rec-1', 9, '  Noch besser  '));
    await waitFor(() =>
      expect(result.current).toEqual({
        score: 9,
        note: 'Noch besser',
        updatedAt: expect.any(String),
      }),
    );
  });

  it('leert den Zustand beim Logout und überspringt den Datenbankzugriff', async () => {
    mockSessionState.session = null;
    const { result } = await renderHook(() => useRecipeRating('rec-1'));

    expect(result.current).toBeNull();
    expect(mockRepositoryState.reads).toBe(0);
  });

  it('ignoriert einen abgebrochenen Lesevorgang nach dem Unmount', async () => {
    let rejectRead!: (reason: Error) => void;
    mockRepositoryState.read = () => new Promise((_resolve, reject) => (rejectRead = reject));
    const { unmount } = await renderHook(() => useRecipeRating('rec-1'));

    await unmount();
    rejectRead(new Error('account switched'));
    await Promise.resolve();
  });

  it('entfernt Listener nur für den angeforderten Account', async () => {
    const first = await renderHook(() => useRecipeRating('rec-1'));
    const second = await renderHook(() => useRecipeRating('rec-2'));
    await waitFor(() => expect(first.result.current).toBeNull());
    await waitFor(() => expect(second.result.current).toBeNull());

    resetRecipeRatingsCache('user-1');
    await act(() => saveRecipeRating('user-1', 'rec-1', 7, 'Neu'));

    expect(first.result.current).toBeNull();
    expect(second.result.current).toBeNull();
    await first.unmount();
    await second.unmount();
  });

  it('wirft einen klaren Fehler, wenn das Repository keine gespeicherte Bewertung liefert', async () => {
    mockRepositoryState.write = async () => null;

    await expect(saveRecipeRating('user-1', 'rec-1', 7, 'Fehlt')).rejects.toThrow(
      'Die Rezeptbewertung konnte nicht gespeichert werden.',
    );
  });
});
