import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';

import {
  ActiveHouseholdProvider,
  useActiveHousehold,
} from '@/features/household/active-household-provider';

/**
 * Regression fuer das Cross-Account-Datenleck.
 *
 * Der Ablauf hier ist der entscheidende: Der Provider haengt in der App im
 * Root-Layout und wird bei An- und Abmeldung **nicht neu gemountet**. Genau
 * darum blieb er frueher an den Daten des Vornutzers haengen — `queryClient.clear()`
 * beim Logout benachrichtigt gemountete Observer nicht, und eine spaetere
 * Invalidierung findet die entfernte Query nicht mehr. Der Test bildet das ab,
 * indem er denselben Baum **und denselben QueryClient** stehen laesst und nur
 * die Session wechselt. Ein frischer Client pro Wechsel waere ein leerer Cache
 * — der Test waere dann auch ohne den Fix gruen.
 *
 * Echt sind hier React Query, der Provider und `useHouseholds()`. Ersetzt ist
 * nur, was in einem Unit-Test nicht laufen kann: die lokale Datenbank und die
 * Quelle der Session. `household-bootstrap-sync.ts` ist als No-Op gemockt —
 * dessen Pull-Verhalten hat einen eigenen Test (household-bootstrap-sync.test.ts),
 * hier geht es nur um das Umschalten zwischen bereits gespiegelten Nutzern.
 */
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

  // Spiegelt `query-client.ts`. Wichtig fuer die Aussagekraft: Mit
  // `staleTime: 0` wuerde jeder Re-Render ohnehin neu laden, und der Test
  // waere auch ohne den nutzerspezifischen Schluessel gruen.
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
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('zeigt nach dem Wechsel den Haushalt des neuen Nutzers, ohne neu zu mounten', async () => {
    const { rerender, findByText, queryByText } = await render(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();

    // Anderer Nutzer, derselbe Baum, derselbe Cache.
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

    // Zurueck zu A nach einem Zwischenstopp bei B: Die gespeicherte Auswahl
    // darf nie dazu fuehren, dass ein Haushalt angezeigt wird, in dem der
    // aktuelle Nutzer gar kein Mitglied ist.
    mockCurrentUserId = 'user-b';
    await rerender(tree());
    expect(await findByText('Haushalt von B')).toBeTruthy();

    mockCurrentUserId = 'user-a';
    await rerender(tree());
    expect(await findByText('Haushalt von A')).toBeTruthy();
    expect(queryByText('Haushalt von B')).toBeNull();
  });
});
