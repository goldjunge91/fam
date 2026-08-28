import { renderHook, waitFor } from '@testing-library/react-native';

import { useRecipeFavorites } from './recipe-favorites';

let mockUserId: string | null = 'user-1';
const mockFavoritesByUser = new Map<string, string[]>([
  ['user-1', ['recipe:first']],
  ['user-2', ['recipe:second']],
]);

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

jest.mock('@/features/recipes/data/recipe-preferences-repository', () => ({
  listFavoriteRecipeKeys: jest.fn(async (userId: string) => mockFavoritesByUser.get(userId) ?? []),
  toggleStoredRecipeFavorite: jest.fn().mockResolvedValue(true),
}));

describe('useRecipeFavorites', () => {
  it('zeigt nach einem Nutzerwechsel keine Favoriten des vorherigen Accounts', async () => {
    const { result, rerender } = await renderHook(() => useRecipeFavorites());
    await waitFor(() => expect(result.current.isFavorite('recipe:first')).toBe(true));

    mockUserId = 'user-2';
    await rerender(undefined);

    expect(result.current.isFavorite('recipe:first')).toBe(false);
    await waitFor(() => expect(result.current.isFavorite('recipe:second')).toBe(true));
  });
});
