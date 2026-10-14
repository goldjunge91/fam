import { act, renderHook, waitFor } from '@testing-library/react-native';
import { resetRecipeFavoritesCache, useRecipeFavorites } from './recipe-favorites';

let mockUserId: string | null = 'user-1';
const mockFavoritesByUser = new Map<string, string[]>();
const mockListFavorites = jest.fn();
const mockToggleFavorite = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

jest.mock('@/features/recipes/data/recipe-preferences-repository', () => ({
  listFavoriteRecipeKeys: (...args: unknown[]) => mockListFavorites(...args),
  toggleStoredRecipeFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
}));

describe('useRecipeFavorites', () => {
  beforeEach(() => {
    mockUserId = 'user-1';
    mockFavoritesByUser.clear();
    mockFavoritesByUser.set('user-1', ['recipe:first']);
    mockFavoritesByUser.set('user-2', ['recipe:second']);
    mockListFavorites
      .mockReset()
      .mockImplementation(async (userId: string) => mockFavoritesByUser.get(userId) ?? []);
    mockToggleFavorite.mockReset().mockResolvedValue(true);
    resetRecipeFavoritesCache('user-1');
    resetRecipeFavoritesCache('user-2');
  });

  it('zeigt nach einem Nutzerwechsel keine Favoriten des vorherigen Accounts', async () => {
    const { result, rerender } = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(result.current.isFavorite('recipe:first')).toBe(true));

    mockUserId = 'user-2';
    await rerender(undefined);

    expect(result.current.isFavorite('recipe:first')).toBe(false);
    await waitFor(() => expect(result.current.isFavorite('recipe:second')).toBe(true));
  });

  it('filtert ungültige Favoritenschlüssel und verwendet den Cache für weitere Verbraucher', async () => {
    mockListFavorites.mockResolvedValueOnce(['catalog:meal', 'template:old-meal', 'unknown:meal']);
    const first = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(first.result.current.isFavorite('catalog:meal')).toBe(true));

    const second = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(second.result.current.isFavorite('template:old-meal')).toBe(true));
    expect(second.result.current.favorites.size).toBe(2);
    expect(mockListFavorites).toHaveBeenCalledTimes(1);
    await first.unmount();
    await second.unmount();
  });

  it('teilt Änderungen mit allen aktiven Verbrauchern und räumt den Cache nach dem letzten ab', async () => {
    const first = await renderHook(() => useRecipeFavorites());
    const second = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(first.result.current.isFavorite('recipe:first')).toBe(true));
    await waitFor(() => expect(second.result.current.isFavorite('recipe:first')).toBe(true));

    mockToggleFavorite.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(async () => {
      await first.result.current.toggleFavorite('recipe:first');
    });
    await waitFor(() => expect(second.result.current.isFavorite('recipe:first')).toBe(false));

    await act(async () => {
      await second.result.current.toggleFavorite('catalog:new');
    });
    await waitFor(() => expect(first.result.current.isFavorite('catalog:new')).toBe(true));
    expect(mockToggleFavorite).toHaveBeenCalledTimes(2);

    await first.unmount();
    await second.unmount();
    const reloaded = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(mockListFavorites).toHaveBeenCalledTimes(2));
    expect(reloaded.result.current.isFavorite('catalog:new')).toBe(false);
  });

  it('hält ohne angemeldeten Account lokale Favoriten unberührt', async () => {
    mockUserId = null;
    const { result } = await renderHook(() => useRecipeFavorites());

    expect(result.current.favorites.size).toBe(0);
    await act(async () => {
      await result.current.toggleFavorite('recipe:first');
    });
    expect(mockListFavorites).not.toHaveBeenCalled();
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  it('behält den geleerten Zustand bei einem fehlgeschlagenen Lesen', async () => {
    mockListFavorites.mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useRecipeFavorites());

    await waitFor(() => expect(mockListFavorites).toHaveBeenCalledWith('user-1'));
    expect(result.current.favorites.size).toBe(0);
  });
});
