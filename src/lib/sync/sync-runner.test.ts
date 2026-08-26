const mockSyncHousehold = jest.fn();
const mockGetDatabase = jest.fn();
const mockGetSupabase = jest.fn();
const mockRetryFailedOutboxEntries = jest.fn();

jest.mock('@/lib/sync/engine', () => ({
  syncHousehold: (...args: unknown[]) => mockSyncHousehold(...args),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
}));

jest.mock('@/lib/db/outbox-retry', () => ({
  retryFailedOutboxEntries: (...args: unknown[]) => mockRetryFailedOutboxEntries(...args),
}));

jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));

// Eigenstaendiger Listener-Satz im Mock (nicht die echte Implementierung aus
// `lib/db/outbox.ts`) — der Test loest Schreibvorgaenge direkt ueber
// `__triggerOutboxChanged` aus, ohne eine echte SQLite-Transaktion zu
// brauchen. Im Factory-Scope statt als Modul-Variable, damit babel-jests
// Hoisting von `jest.mock` keine TDZ-Falle aufmacht.
jest.mock('@/lib/db/outbox', () => {
  const listeners = new Set<() => void>();
  return {
    onOutboxChanged: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    __triggerOutboxChanged: () => {
      for (const listener of listeners) listener();
    },
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { triggerHouseholdSync, useSyncEngine } from '@/lib/sync/sync-runner';

// `jest.requireMock` statt eines statischen `import`: Der reale
// `lib/db/outbox`-Typ kennt `__triggerOutboxChanged` nicht (existiert nur im
// Mock oben) — ein `import` wuerde `tsc` zu Recht als Fehler melden.
const { __triggerOutboxChanged } = jest.requireMock('@/lib/db/outbox') as {
  __triggerOutboxChanged: () => void;
};

function fakeQueryClient() {
  return { invalidateQueries: jest.fn() };
}

describe('triggerHouseholdSync — Query-Invalidierung (#115-Befund)', () => {
  beforeEach(() => {
    mockGetDatabase.mockResolvedValue({});
    mockGetSupabase.mockReturnValue({});
  });

  it('invalidiert die Query fuer jede Entity mit gepullten Zeilen', async () => {
    mockSyncHousehold.mockResolvedValue({
      push: { outcomes: [], stoppedEarly: false },
      pull: [
        { entity: 'shopping_list_items', cursor: null, rowsWritten: 2 },
        { entity: 'fridge_items', cursor: null, rowsWritten: 0 },
      ],
    });
    const queryClient = fakeQueryClient();

    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    await triggerHouseholdSync(['household-1'], false, queryClient as any);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['shopping_list_items', 'household-1'],
    });
    // rowsWritten: 0 -> keine Aenderung, keine Invalidierung fuer fridge_items
    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['fridge_items', 'household-1'],
    });
  });

  it('invalidiert bei fridge_items zusaetzlich die gruppierte Ansicht', async () => {
    mockSyncHousehold.mockResolvedValue({
      push: { outcomes: [], stoppedEarly: false },
      pull: [{ entity: 'fridge_items', cursor: null, rowsWritten: 1 }],
    });
    const queryClient = fakeQueryClient();

    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    await triggerHouseholdSync(['household-1'], false, queryClient as any);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['fridge_items', 'household-1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['fridge_items_grouped', 'household-1'],
    });
  });

  it('invalidiert auch fuer erfolgreich gepushte Entities (eigene Aenderung, andere Query-Beobachter)', async () => {
    mockSyncHousehold.mockResolvedValue({
      push: {
        outcomes: [{ kind: 'pushed', entity: 'stores', entityId: 'x', sourceIds: [1] }],
        stoppedEarly: false,
      },
      pull: [],
    });
    const queryClient = fakeQueryClient();

    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    await triggerHouseholdSync(['household-1'], false, queryClient as any);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['stores', 'household-1'],
    });
  });

  it('ohne uebergebenen QueryClient bleibt das Verhalten unveraendert (kein Crash)', async () => {
    mockSyncHousehold.mockResolvedValue({
      push: { outcomes: [], stoppedEarly: false },
      pull: [{ entity: 'fridge_items', cursor: null, rowsWritten: 3 }],
    });

    await expect(triggerHouseholdSync(['household-1'])).resolves.not.toBeNull();
  });
});

describe('useSyncEngine — Sync-Ausloeser bei lokalem Schreibvorgang', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetDatabase.mockResolvedValue({});
    mockGetSupabase.mockReturnValue({});
    mockRetryFailedOutboxEntries.mockResolvedValue(undefined);
    mockSyncHousehold.mockReset();
    mockSyncHousehold.mockResolvedValue({ push: { outcomes: [], stoppedEarly: false }, pull: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loest fuer einen einzelnen Schreibvorgang SOFORT einen Sync aus (#70 AC1: unter einer Sekunde)', async () => {
    const { unmount } = await renderHook(() => useSyncEngine('household-1'), { wrapper });
    await jest.advanceTimersByTimeAsync(0);
    mockSyncHousehold.mockClear(); // Initialer Mount-Sync zaehlt hier nicht.

    await act(async () => {
      __triggerOutboxChanged();
      await jest.advanceTimersByTimeAsync(0);
    });

    // Kein Timer-Vorlauf noetig: der erste Schreibvorgang eines Schwungs
    // loest den Aufruf synchron aus, nicht erst nach OUTBOX_DEBOUNCE_MS.
    expect(mockSyncHousehold).toHaveBeenCalledTimes(1);

    await unmount();
  });

  it('buendelt einen Schwung von Schreibvorgaengen ab dem zweiten in einen einzigen Trailing-Sync', async () => {
    const { unmount } = await renderHook(() => useSyncEngine('household-1'), { wrapper });
    await jest.advanceTimersByTimeAsync(0);
    mockSyncHousehold.mockClear();

    await act(async () => {
      __triggerOutboxChanged(); // 1. Schreibvorgang: sofortiger Sync
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockSyncHousehold).toHaveBeenCalledTimes(1);

    await act(async () => {
      __triggerOutboxChanged(); // 2. und 3. Schreibvorgang kurz danach: gebuendelt
      __triggerOutboxChanged();
      await jest.advanceTimersByTimeAsync(0);
    });
    // Noch kein weiterer Sync, solange die Ruhezeit nicht abgelaufen ist.
    expect(mockSyncHousehold).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });
    // Genau EIN zusaetzlicher Trailing-Sync fuer den ganzen Rest des Schwungs.
    expect(mockSyncHousehold).toHaveBeenCalledTimes(2);

    await unmount();
  });

  it('erzwingt einen Sync spaetestens nach OUTBOX_MAX_WAIT_MS, auch bei andauerndem Schreibstrom', async () => {
    const { unmount } = await renderHook(() => useSyncEngine('household-1'), { wrapper });
    await jest.advanceTimersByTimeAsync(0);
    mockSyncHousehold.mockClear();

    await act(async () => {
      __triggerOutboxChanged(); // 1. Schreibvorgang: sofortiger Sync
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockSyncHousehold).toHaveBeenCalledTimes(1);

    // Ununterbrochener Schreibstrom, jeder Schreibvorgang erneuert eigentlich
    // den Trailing-Timer (500ms < OUTBOX_DEBOUNCE_MS von 800ms) — nach 9
    // Schreibvorgaengen a 500ms (4000ms seit Schwungbeginn, beim 9. Trigger
    // selbst erreicht) greift der Deckel WAEHREND des Stroms, nicht erst in
    // einer nie eintretenden Ruhephase.
    for (let i = 0; i < 9; i++) {
      await act(async () => {
        __triggerOutboxChanged();
        await jest.advanceTimersByTimeAsync(500);
      });
    }

    expect(mockSyncHousehold.mock.calls.length).toBeGreaterThanOrEqual(2);

    await unmount();
  });
});
