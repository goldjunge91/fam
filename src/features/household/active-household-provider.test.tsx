import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import {
  ActiveHouseholdProvider,
  useActiveHousehold,
} from '@/features/household/active-household-provider';

/** Prueft Nutzerwechsel mit demselben Provider und QueryClient. */
let mockCurrentUserId: string | null = 'user-a';

const mockHouseholdsByUser: Record<string, { id: string; name: string }[]> = {
  'user-a': [{ id: 'hh-a', name: 'Haushalt von A' }],
  'user-b': [{ id: 'hh-b', name: 'Haushalt von B' }],
};

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: mockCurrentUserId ? { user: { id: mockCurrentUserId } } : null,
    isLoading: false,
    seenOnboarding: true,
    error: null,
  }),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({
    getAllAsync: async () =>
      mockCurrentUserId ? (mockHouseholdsByUser[mockCurrentUserId] ?? []) : [],
  }),
}));

jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
  useHouseholdsBootstrapSync: () => {},
  triggerHouseholdsPull: async () => null,
}));

function ActiveHouseholdProbe() {
  const { activeHousehold } = useActiveHousehold();
  return <Text>{activeHousehold ? activeHousehold.name : 'kein Haushalt'}</Text>;
}

describe('ActiveHouseholdProvider bei Nutzerwechsel', () => {
  let queryClient: QueryClient;

  // Der echte staleTime verhindert einen zufaellig immer neuen Request.
  const tree = (): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <ActiveHouseholdProvider>
        <ActiveHouseholdProbe />
      </ActiveHouseholdProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    mockCurrentUserId = 'user-a';
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30_000,
          gcTime: Number.POSITIVE_INFINITY,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('zeigt nach dem Wechsel den Haushalt des neuen Nutzers, ohne neu zu mounten', async () => {
    const { rerender, findByText, queryByText } = await render(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();

    mockCurrentUserId = 'user-b';
    await rerender(tree());

    expect(await findByText('Haushalt von B')).toBeTruthy();
    expect(queryByText('Haushalt von A')).toBeNull();
  });

  it('zeigt nach dem Abmelden keinen Haushalt mehr', async () => {
    const { rerender, findByText } = await render(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();

    mockCurrentUserId = null;
    await rerender(tree());

    expect(await findByText('kein Haushalt')).toBeTruthy();
  });

  it('faellt beim Wechsel nicht auf die gemerkte Haushalts-Id des Vornutzers zurueck', async () => {
    const { rerender, findByText, queryByText } = await render(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();

    mockCurrentUserId = 'user-b';
    await rerender(tree());
    expect(await findByText('Haushalt von B')).toBeTruthy();

    mockCurrentUserId = 'user-a';
    await rerender(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();
    expect(queryByText('Haushalt von B')).toBeNull();
  });
});
