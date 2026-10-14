import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import type { SqlDatabase } from '@/lib/db/types';
import type { PullOutcome } from '@/lib/sync/pull';
import type { PushResult } from '@/lib/sync/push';
import type { ServerClock } from '@/lib/sync/server-clock';
import { syncHousehold } from './remote-sync-engine';

const mockPushOutbox = jest.fn();
const mockPullHousehold = jest.fn();

jest.mock('@/lib/sync/push', () => ({
  pushOutbox: (...args: unknown[]) => mockPushOutbox(...args),
}));
jest.mock('@/lib/sync/pull', () => ({
  pullHousehold: (...args: unknown[]) => mockPullHousehold(...args),
}));

const db = {} as SqlDatabase;
const supabase = {} as TypedSupabaseClient;
const push: PushResult = { outcomes: [], stoppedEarly: false };
const pull: PullOutcome[] = [];
const householdIds = ['household-a'];

beforeEach(() => {
  mockPushOutbox.mockReset().mockResolvedValue(push);
  mockPullHousehold.mockReset().mockResolvedValue(pull);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('syncHousehold', () => {
  it('passes one captured client time through push and pull alongside the server clock', async () => {
    const serverNowMs = jest.fn(() => 9_500);
    const serverClock: ServerClock = {
      fetch,
      serverNowMs,
    };
    const now = jest.fn(() => 10_000);

    await expect(syncHousehold({ db, supabase, serverClock, householdIds, now })).resolves.toEqual({
      push,
      pull,
    });

    const pushDeps = mockPushOutbox.mock.calls[0]?.[0] as {
      db: SqlDatabase;
      supabase: TypedSupabaseClient;
      now: () => number;
    };
    expect(pushDeps.db).toBe(db);
    expect(pushDeps.supabase).toBe(supabase);
    expect(pushDeps.now()).toBe(10_000);
    expect(now).toHaveBeenCalledTimes(1);
    expect(mockPullHousehold).toHaveBeenCalledWith({
      db,
      supabase,
      householdIds,
      clockCeilingMs: 9_500,
      serverNowMs,
    });
  });

  it('falls back to the current time when no client clock or server time is available', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
    const nowMs = Date.now();
    const serverNowMs = jest.fn(() => null);
    const serverClock: ServerClock = { fetch, serverNowMs };

    await syncHousehold({ db, supabase, serverClock, householdIds });

    const pushDeps = mockPushOutbox.mock.calls[0]?.[0] as { now: () => number };
    expect(pushDeps.now()).toBe(nowMs);
    expect(mockPullHousehold).toHaveBeenCalledWith({
      db,
      supabase,
      householdIds,
      clockCeilingMs: nowMs,
      serverNowMs,
    });
  });
});
