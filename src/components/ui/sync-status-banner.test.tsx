import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SyncStatusBanner, type SyncStatusBannerProps } from '@/components/ui/sync-status-banner';
import { Colors } from '@/constants/theme';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, loadDueOutboxEntries, recordOutboxOutcome } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

let activeTestTrees: (() => Promise<void>)[] = [];

async function renderBanner(props: SyncStatusBannerProps) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const result = await render(
    <QueryClientProvider client={queryClient}>
      <SyncStatusBanner {...props} />
    </QueryClientProvider>,
  );
  activeTestTrees.push(async () => {
    await result.unmount();
    queryClient.clear();
  });
  return result;
}

async function createDb(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await runMigrations(db, MIGRATIONS);
  return db;
}

async function insertStorageLocation(db: SqlDatabase, id: string) {
  await db.runAsync(
    'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
    [id, 'hh-1', 'Kühlschrank', 'fridge', 1000],
  );
}

describe('SyncStatusBanner', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createDb();
  });

  afterEach(async () => {
    // Erst unmounten, damit der Observer keinen Refetch-Timer neu anlegt.
    for (const dispose of activeTestTrees) {
      await dispose();
    }
    activeTestTrees = [];

    db.close();
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  it('rendert nichts, wenn online und nichts aussteht', async () => {
    await renderBanner({ getDb: async () => db });

    expect(screen.queryByText(/Offline/)).toBeNull();
    expect(screen.queryByText(/ausstehend/)).toBeNull();
  });

  it('zeigt den Offline-Zustand, wenn der echte onlineManager offline meldet', async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });

    await renderBanner({ getDb: async () => db });

    expect(await screen.findByText('Offline')).toBeTruthy();
  });

  it('zeigt den ausstehenden Zaehler kurz nach einem echten lokalen Schreibvorgang', async () => {
    // Vor dem Schreiben rendern, damit das Outbox-Abonnement aktiv ist.
    await renderBanner({ getDb: async () => db });

    await act(async () => {
      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: 'loc-1',
        op: 'insert',
        payload: { id: 'loc-1', household_id: 'hh-1', name: 'Kühlschrank', kind: 'fridge' },
        applyLocally: (txn) => insertStorageLocation(txn, 'loc-1'),
      });
    });

    expect(await screen.findByText('Synchronisiere … 1 ausstehend')).toBeTruthy();
  });

  it('verschwindet von selbst kurz nach dem Schreibvorgang — unabhaengig davon, ob der Push schon durch ist', async () => {
    await renderBanner({ getDb: async () => db });

    await act(async () => {
      await enqueueMutation(db, {
        entity: 'storage_locations',
        entityId: 'loc-2',
        op: 'insert',
        payload: { id: 'loc-2', household_id: 'hh-1', name: 'Vorrat', kind: 'pantry' },
        applyLocally: (txn) => insertStorageLocation(txn, 'loc-2'),
      });
    });
    expect(await screen.findByText(/ausstehend/)).toBeTruthy();

    await waitFor(() => expect(screen.queryByText(/ausstehend/)).toBeNull(), { timeout: 4_000 });

    const due = await loadDueOutboxEntries(db, Date.now());
    expect(due).toHaveLength(1);
  }, 10_000);

  it('zeigt den Fehlerzustand und ruft onRetry beim Tap auf', async () => {
    await enqueueMutation(db, {
      entity: 'storage_locations',
      entityId: 'loc-3',
      op: 'insert',
      payload: { id: 'loc-3', household_id: 'hh-1', name: 'Gefrierfach', kind: 'freezer' },
      applyLocally: (txn) => insertStorageLocation(txn, 'loc-3'),
    });
    const [entry] = await loadDueOutboxEntries(db, 0);
    await recordOutboxOutcome(db, [entry.id], {
      attempts: MAX_ATTEMPTS,
      lastError: 'RLS-Verstoss',
      nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
    });

    const onRetry = jest.fn().mockResolvedValue(undefined);
    await renderBanner({ getDb: async () => db, onRetry });

    const button = await screen.findByRole('button');
    expect(screen.getByText(/1 Änderungen konnten nicht synchronisiert werden/)).toBeTruthy();

    fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('nutzt fuer offline/syncing und failed unterschiedliche Theme-Farben', () => {
    expect(Colors.light.warning).not.toBe(Colors.light.danger);
    expect(Colors.dark.warning).not.toBe(Colors.dark.danger);
    expect(Colors.light.warning).not.toBe(Colors.dark.warning);
  });
});
