import { renderHook } from '@testing-library/react-native';

import { usePreferredProductMarketName } from './preferred-market';

const mockUseQuery = jest.fn();
const mockUseStores = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: (...args: unknown[]) => mockUseStores(...args),
}));

beforeEach(() => {
  mockUseQuery.mockReturnValue({ data: undefined });
  mockUseStores.mockReturnValue({ data: undefined });
});

it('liefert bei unveränderten Daten dieselbe Markt-Referenz', async () => {
  const { result, rerender } = await renderHook(() => usePreferredProductMarketName(undefined));
  const firstResult = result.current;

  rerender(undefined);

  expect(result.current).toBe(firstResult);
});
