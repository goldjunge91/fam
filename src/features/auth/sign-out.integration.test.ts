import { QueryClient } from '@tanstack/react-query';
import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { enqueueMutation, recordOutboxOutcome } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { syncHousehold } from '@/lib/sync/remote-sync-engine';
import { createServerClock } from '@/lib/sync/server-clock';
import { assertLocalSupabase, setupTwoDevices } from '../../../test/setup-two-devices';
import { signOutAndClearLocalData, UnsyncedLocalWritesError } from './sign-out';

let mockActiveClient: TypedSupabaseClient;
let mockActiveDatabase: SqlDatabase;
let mockRememberedUserId: string | null = null;
const mockAccountKeyMarkers = new Map<string, string>();
const mockDeletedDatabaseOwners: string[] = [];
const mockDeletedStorageOwners: string[] = [];
const mockForgottenOwners: string[] = [];

jest.mock('expo-linking', () => ({
  createURL: jest.fn(),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => mockActiveClient,
}));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => mockActiveDatabase,
  deleteLocalDatabase: async () => {
    if (mockRememberedUserId) mockDeletedDatabaseOwners.push(mockRememberedUserId);
  },
  setActiveUserId: jest.fn(),
}));

jest.mock('@/lib/storage/local-account-storage', () => ({
  getRememberedLocalAccountUserId: async () => mockRememberedUserId,
  deleteEncryptedAccountStorage: async (userId: string) => {
    mockDeletedStorageOwners.push(userId);
    mockAccountKeyMarkers.delete(userId);
  },
  forgetLocalAccountUserId: async (userId: string) => {
    mockForgottenOwners.push(userId);
    if (mockRememberedUserId === userId) mockRememberedUserId = null;
  },
}));

jest.mock('@/lib/sync/remote-sync-gate', () => ({
  stopAccountSyncAndWait: async () => undefined,
}));

jest.mock('@/lib/platform/notifications', () => ({
  cancelUserNotificationReminders: async () => undefined,
}));

jest.mock('@/lib/storage/local-account-cache-registry', () => ({
  resetLocalAccountModuleCaches: jest.fn(),
}));

jest.mock('@/features/household/active-household-store', () => ({
  setStoredActiveHouseholdId: async () => undefined,
}));

const teardowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const teardown of teardowns) await teardown();
  teardowns.length = 0;
  mockRememberedUserId = null;
  mockAccountKeyMarkers.clear();
  mockDeletedDatabaseOwners.length = 0;
  mockDeletedStorageOwners.length = 0;
  mockForgottenOwners.length = 0;
});

async function sessionUserId(client: TypedSupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Testsession fehlt.');
  return userId;
}

async function enqueueStorageLocation(
  db: SqlDatabase,
  id: string,
  householdId: string,
  name: string,
): Promise<void> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const payload = {
    id,
    household_id: householdId,
    name,
    kind: 'pantry',
    sort_order: 10,
    created_at: now,
    updated_at: now,
  };

  await enqueueMutation(db, {
    entity: 'storage_locations',
    entityId: id,
    op: 'insert',
    payload,
    now: nowMs,
    applyLocally: (txn) =>
      applyLocalMirrorWrite(txn, 'storage_locations', 'insert', payload, nowMs),
  });
}

async function outboxCounts(db: SqlDatabase) {
  return db.getFirstAsync<{ failed: number; pending: number }>(
    `select
       coalesce(sum(case when attempts >= ? then 1 else 0 end), 0) as failed,
       coalesce(sum(case when attempts < ? then 1 else 0 end), 0) as pending
     from outbox`,
    [MAX_ATTEMPTS, MAX_ATTEMPTS],
  );
}

describe('geschützter Logout mit echtem Offline-Lifecycle', () => {
  beforeAll(assertLocalSupabase);

  it('bewahrt ungesicherte Accountdaten, synchronisiert A und isoliert den Cleanup von B', async () => {
    const accountA = await setupTwoDevices('sign-out-account-a');
    const accountB = await setupTwoDevices('sign-out-account-b');
    teardowns.push(accountA.teardown, accountB.teardown);

    const userA = await sessionUserId(accountA.deviceA.client);
    const userB = await sessionUserId(accountB.deviceA.client);
    const locationA = crypto.randomUUID();
    const locationB = crypto.randomUUID();
    mockAccountKeyMarkers.set(userA, 'account-a-key');
    mockAccountKeyMarkers.set(userB, 'account-b-key');

    await enqueueStorageLocation(
      accountA.deviceA.db,
      locationA,
      accountA.householdId,
      'Offline Lager A',
    );
    await enqueueStorageLocation(
      accountB.deviceA.db,
      locationB,
      accountB.householdId,
      'Offline Lager B',
    );

    mockActiveClient = accountA.deviceA.client;
    mockActiveDatabase = accountA.deviceA.db;
    mockRememberedUserId = userA;
    const accountAQueryClient = new QueryClient();

    const blocked = await signOutAndClearLocalData(accountAQueryClient, {
      protectUnsyncedWrites: true,
    });

    expect(blocked.error).toBeInstanceOf(UnsyncedLocalWritesError);
    expect(blocked.error).toMatchObject({ pendingCount: 1, failedCount: 0 });
    expect(
      await accountA.deviceA.db.getFirstAsync('select id from storage_locations where id = ?', [
        locationA,
      ]),
    ).toEqual({ id: locationA });
    expect(await outboxCounts(accountA.deviceA.db)).toEqual({ failed: 0, pending: 1 });
    expect(await sessionUserId(accountA.deviceA.client)).toBe(userA);
    expect(mockAccountKeyMarkers.get(userA)).toBe('account-a-key');
    expect(mockDeletedDatabaseOwners).toEqual([]);
    expect(mockDeletedStorageOwners).toEqual([]);

    expect(await sessionUserId(accountB.deviceA.client)).toBe(userB);
    expect(mockAccountKeyMarkers.get(userB)).toBe('account-b-key');
    expect(
      await accountB.deviceA.db.getFirstAsync('select id from storage_locations where id = ?', [
        locationB,
      ]),
    ).toEqual({ id: locationB });
    expect(await outboxCounts(accountB.deviceA.db)).toEqual({ failed: 0, pending: 1 });

    await syncHousehold({
      db: accountA.deviceA.db,
      supabase: accountA.deviceA.client,
      serverClock: createServerClock(),
      householdIds: [accountA.householdId],
    });

    expect(await outboxCounts(accountA.deviceA.db)).toEqual({ failed: 0, pending: 0 });
    const { data: remoteLocationA, error: remoteLocationError } = await accountA.deviceA.client
      .from('storage_locations')
      .select('id')
      .eq('id', locationA)
      .single();
    expect(remoteLocationError).toBeNull();
    expect(remoteLocationA).toEqual({ id: locationA });

    await expect(
      signOutAndClearLocalData(accountAQueryClient, { protectUnsyncedWrites: true }),
    ).resolves.toEqual({ error: null });

    expect((await accountA.deviceA.client.auth.getSession()).data.session).toBeNull();
    expect(mockDeletedDatabaseOwners).toEqual([userA]);
    expect(mockDeletedStorageOwners).toEqual([userA]);
    expect(mockForgottenOwners).toEqual([userA]);
    expect(mockAccountKeyMarkers.has(userA)).toBe(false);

    expect(await sessionUserId(accountB.deviceA.client)).toBe(userB);
    expect(mockAccountKeyMarkers.get(userB)).toBe('account-b-key');
    expect(
      await accountB.deviceA.db.getFirstAsync('select id from storage_locations where id = ?', [
        locationB,
      ]),
    ).toEqual({ id: locationB });
    expect(await outboxCounts(accountB.deviceA.db)).toEqual({ failed: 0, pending: 1 });

    const pendingB = await accountB.deviceA.db.getFirstAsync<{ id: number }>(
      'select id from outbox where entity_id = ?',
      [locationB],
    );
    if (!pendingB) throw new Error('Bs Outbox-Eintrag fehlt.');
    await recordOutboxOutcome(accountB.deviceA.db, [pendingB.id], {
      attempts: MAX_ATTEMPTS,
      kind: 'permanent',
      lastError: 'terminal test failure',
      nextAttemptAtMs: 0,
    });

    mockActiveClient = accountB.deviceA.client;
    mockActiveDatabase = accountB.deviceA.db;
    mockRememberedUserId = userB;
    const terminalBlocked = await signOutAndClearLocalData(new QueryClient(), {
      protectUnsyncedWrites: true,
    });

    expect(terminalBlocked.error).toBeInstanceOf(UnsyncedLocalWritesError);
    expect(terminalBlocked.error).toMatchObject({ pendingCount: 0, failedCount: 1 });
    expect(await outboxCounts(accountB.deviceA.db)).toEqual({ failed: 1, pending: 0 });
    expect(await sessionUserId(accountB.deviceA.client)).toBe(userB);
    expect(mockAccountKeyMarkers.get(userB)).toBe('account-b-key');
    expect(mockDeletedDatabaseOwners).toEqual([userA]);
    expect(mockDeletedStorageOwners).toEqual([userA]);
  }, 30_000);
});
