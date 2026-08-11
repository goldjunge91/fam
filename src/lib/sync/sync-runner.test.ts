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

import { triggerHouseholdSync } from '@/lib/sync/sync-runner';

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
