const BACKGROUND_SYNC_TASK_NAME = 'fam-background-sync';

const mockGetSession = jest.fn();
const mockGetStoredActiveHouseholdId = jest.fn();
const mockSetActiveUserId = jest.fn();
const mockGetActiveDatabaseAccount = jest.fn();
const mockGetDatabase = jest.fn();
const mockCloseDatabaseForLifecycle = jest.fn();
const mockSyncHousehold = jest.fn();
const mockFinishAccountSyncRun = jest.fn();
const mockBeginAccountSyncRun = jest.fn<(() => void) | null, []>(() => mockFinishAccountSyncRun);
const mockBeginBackgroundContext = jest.fn();
const mockRemoveExpirationListener = jest.fn();
const mockAddExpirationListener = jest.fn((_listener: () => void) => ({
  remove: mockRemoveExpirationListener,
}));
const mockServerClock = { fetch: jest.fn() };

let activeDatabaseAccount = { userId: null as string | null, generation: 0 };

let backgroundContext: {
  kind: 'background';
  token: string;
  signal: AbortSignal;
  ended: boolean;
  end: jest.Mock;
};

function resetBackgroundContext(): void {
  backgroundContext = {
    kind: 'background',
    token: 'background-token',
    signal: new AbortController().signal,
    ended: false,
    end: jest.fn(),
  };
  mockBeginBackgroundContext.mockReturnValue(backgroundContext);
}

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: {
    Success: 'success',
    Failed: 'failed',
  },
  addExpirationListener: (listener: () => void) => mockAddExpirationListener(listener),
  getStatusAsync: jest.fn().mockResolvedValue('available'),
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('@/features/household/active-household-store', () => ({
  getStoredActiveHouseholdId: (...args: unknown[]) => mockGetStoredActiveHouseholdId(...args),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ auth: { getSession: (...args: unknown[]) => mockGetSession(...args) } }),
  serverClock: mockServerClock,
}));

jest.mock('@/lib/db/local-client', () => ({
  closeDatabaseForLifecycle: (...args: unknown[]) => mockCloseDatabaseForLifecycle(...args),
  getActiveDatabaseAccount: () => mockGetActiveDatabaseAccount(),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
  setActiveUserId: (...args: unknown[]) => mockSetActiveUserId(...args),
}));

jest.mock('@/lib/sync/remote-sync-gate', () => ({
  beginAccountSyncRun: () => mockBeginAccountSyncRun(),
}));

jest.mock('@/lib/apple/shared-store-lifecycle', () => ({
  beginBackgroundContext: (...args: unknown[]) => mockBeginBackgroundContext(...args),
}));

jest.mock('@/lib/sync/remote-sync-engine', () => ({
  syncHousehold: (...args: unknown[]) => mockSyncHousehold(...args),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

type BackgroundSyncModule = typeof import('./remote-background-sync');
type TaskExecutor = () => Promise<string>;

function loadBackgroundSync(): {
  backgroundSync: BackgroundSyncModule;
  taskExecutor: TaskExecutor;
} {
  jest.resetModules();
  const backgroundSync = require('./remote-background-sync') as BackgroundSyncModule;
  const taskManager = getTaskManagerMock();
  const taskExecutor = taskManager.defineTask.mock.calls.at(-1)?.[1] as TaskExecutor | undefined;
  if (!taskExecutor)
    throw new Error('Background task was not defined during module initialization.');
  return { backgroundSync, taskExecutor };
}

function getBackgroundTaskMock(): {
  getStatusAsync: jest.Mock;
  registerTaskAsync: jest.Mock;
  unregisterTaskAsync: jest.Mock;
  BackgroundTaskResult: { Success: string; Failed: string };
} {
  return jest.requireMock('expo-background-task') as unknown as {
    getStatusAsync: jest.Mock;
    registerTaskAsync: jest.Mock;
    unregisterTaskAsync: jest.Mock;
    BackgroundTaskResult: { Success: string; Failed: string };
  };
}

function getTaskManagerMock(): { defineTask: jest.Mock } {
  return jest.requireMock('expo-task-manager') as unknown as { defineTask: jest.Mock };
}

function getReportErrorMock(): jest.Mock {
  return (jest.requireMock('@/lib/telemetry') as { reportError: jest.Mock }).reportError;
}

describe('background sync task contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeDatabaseAccount = { userId: null, generation: 0 };
    mockGetActiveDatabaseAccount.mockImplementation(() => activeDatabaseAccount);
    mockSetActiveUserId.mockImplementation((userId: string | null) => {
      if (activeDatabaseAccount.userId !== userId) activeDatabaseAccount.generation += 1;
      activeDatabaseAccount = { userId, generation: activeDatabaseAccount.generation };
    });
    resetBackgroundContext();
    mockBeginAccountSyncRun.mockReturnValue(mockFinishAccountSyncRun);
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
      error: null,
    });
    mockGetStoredActiveHouseholdId.mockResolvedValue('household-a');
    mockGetDatabase.mockResolvedValue({ id: 'database-a' });
    mockCloseDatabaseForLifecycle.mockResolvedValue({
      status: 'closed',
      account: { userId: 'user-a', generation: 1 },
    });
    mockSyncHousehold.mockResolvedValue({
      push: { outcomes: [], stoppedEarly: false },
      pull: [],
    });
    mockAddExpirationListener.mockReturnValue({ remove: mockRemoveExpirationListener });
  });

  it('defines the task during module initialization and remains idempotent', () => {
    const { backgroundSync } = loadBackgroundSync();
    const taskManager = getTaskManagerMock();

    expect(taskManager.defineTask).toHaveBeenCalledTimes(1);
    expect(taskManager.defineTask).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK_NAME,
      expect.any(Function),
    );

    backgroundSync.defineBackgroundSyncTask();
    expect(taskManager.defineTask).toHaveBeenCalledTimes(1);
  });

  it('restores session and household state without React before syncing', async () => {
    const { taskExecutor } = loadBackgroundSync();
    const { BackgroundTaskResult } = getBackgroundTaskMock();

    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Success);

    expect(mockSetActiveUserId).toHaveBeenCalledWith('user-a');
    expect(mockGetDatabase).toHaveBeenCalledWith({
      kind: 'background',
      backgroundContext,
      signal: expect.any(AbortSignal),
    });
    expect(mockSyncHousehold).toHaveBeenCalledWith({
      db: { id: 'database-a' },
      supabase: expect.objectContaining({ auth: expect.any(Object) }),
      serverClock: mockServerClock,
      householdIds: ['household-a'],
      signal: expect.any(AbortSignal),
    });
    expect(mockBeginAccountSyncRun).toHaveBeenCalledTimes(1);
    expect(mockFinishAccountSyncRun).toHaveBeenCalledTimes(1);
    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
    expect(mockRemoveExpirationListener).toHaveBeenCalledTimes(1);
    expect(backgroundContext.end).toHaveBeenCalledTimes(1);
  });

  it('hält die Account-Ownership bis nach dem globalen Close und stellt den vorherigen Account wieder her', async () => {
    const events: string[] = [];
    mockBeginAccountSyncRun.mockImplementationOnce(() =>
      jest.fn(() => {
        events.push('finish-account-run');
      }),
    );
    mockCloseDatabaseForLifecycle.mockImplementationOnce(async (expected) => {
      events.push('close-database');
      expect(expected).toMatchObject({ userId: 'user-a' });
      return {
        status: 'closed',
        account: { userId: 'user-a', generation: 1 },
      };
    });
    const { taskExecutor } = loadBackgroundSync();

    await expect(taskExecutor()).resolves.toBe('success');

    expect(events).toEqual(['close-database', 'finish-account-run']);
    expect(mockSetActiveUserId).toHaveBeenNthCalledWith(1, 'user-a');
    expect(mockSetActiveUserId).toHaveBeenLastCalledWith(null);
  });

  it('closes the captured Background-Connection after process ownership changes', async () => {
    mockSyncHousehold.mockImplementationOnce(async () => {
      activeDatabaseAccount = {
        userId: null,
        generation: activeDatabaseAccount.generation + 1,
      };
      return { push: { outcomes: [], stoppedEarly: false }, pull: [] };
    });
    mockCloseDatabaseForLifecycle.mockImplementationOnce(async (expected) => {
      expect(activeDatabaseAccount.userId).toBeNull();
      expect(expected).toEqual({ userId: 'user-a', generation: 1, previousUserId: null });
      return {
        status: 'closed',
        account: { userId: 'user-a', generation: 1 },
      };
    });
    const { taskExecutor } = loadBackgroundSync();

    await expect(taskExecutor()).resolves.toBe('success');

    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
    expect(mockFinishAccountSyncRun).toHaveBeenCalledTimes(1);
    expect(backgroundContext.end).toHaveBeenCalledTimes(1);
  });

  it('does not cross an account transition that already stopped sync', async () => {
    mockBeginAccountSyncRun.mockReturnValueOnce(null);
    const { taskExecutor } = loadBackgroundSync();
    const { BackgroundTaskResult } = getBackgroundTaskMock();

    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Success);

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockSyncHousehold).not.toHaveBeenCalled();
    expect(mockFinishAccountSyncRun).not.toHaveBeenCalled();
    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'without a restored session',
      prepare: () => mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null }),
    },
    {
      name: 'without an active household',
      prepare: () => mockGetStoredActiveHouseholdId.mockResolvedValueOnce(null),
    },
  ])('returns success $name and still closes SQLite', async ({ prepare }) => {
    prepare();
    const { taskExecutor } = loadBackgroundSync();
    const { BackgroundTaskResult } = getBackgroundTaskMock();

    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Success);

    expect(mockSyncHousehold).not.toHaveBeenCalled();
    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
  });

  it('reports worker failures, returns failed, and still closes SQLite', async () => {
    const error = new Error('offline');
    mockSyncHousehold.mockRejectedValueOnce(error);
    const { taskExecutor } = loadBackgroundSync();
    const { BackgroundTaskResult } = getBackgroundTaskMock();

    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Failed);

    expect(getReportErrorMock()).toHaveBeenCalledWith(error, {
      operation: 'sync.background',
      error_code: 'background_sync_failed',
    });
    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
  });

  it('wiederholt einen fehlgeschlagenen Raw-Close unter demselben Background-Kontext', async () => {
    mockCloseDatabaseForLifecycle
      .mockRejectedValueOnce(new Error('temporary raw close failure'))
      .mockResolvedValueOnce({
        status: 'closed',
        account: { userId: 'user-a', generation: 1 },
      });
    const { taskExecutor } = loadBackgroundSync();

    await expect(taskExecutor()).resolves.toBe('success');

    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(2);
    expect(mockFinishAccountSyncRun).toHaveBeenCalledTimes(1);
    expect(backgroundContext.end).toHaveBeenCalledTimes(1);
  });

  it('behält den Background-Kontext bei, wenn der Close eine andere Connection meldet', async () => {
    mockCloseDatabaseForLifecycle.mockResolvedValue({
      status: 'ownership-mismatch',
      account: { userId: 'user-b', generation: 2 },
    });
    const { taskExecutor } = loadBackgroundSync();

    await expect(taskExecutor()).rejects.toThrow(/different ownership/);

    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(2);
    expect(mockSetActiveUserId).toHaveBeenCalledTimes(1);
    expect(mockFinishAccountSyncRun).not.toHaveBeenCalled();
    expect(backgroundContext.end).not.toHaveBeenCalled();
  });

  it('behält Background-Kontext und Account-Ownership bei unresolved Raw-Close', async () => {
    const closeError = new Error('persistent raw close failure');
    mockCloseDatabaseForLifecycle.mockRejectedValue(closeError);
    const { taskExecutor } = loadBackgroundSync();

    await expect(taskExecutor()).rejects.toBe(closeError);

    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(2);
    expect(getReportErrorMock()).toHaveBeenCalledWith(closeError, {
      operation: 'sync.background.close',
      error_code: 'background_sync_close_failed',
    });
    expect(mockSetActiveUserId).toHaveBeenCalledTimes(1);
    expect(mockFinishAccountSyncRun).not.toHaveBeenCalled();
    expect(backgroundContext.end).not.toHaveBeenCalled();
  });

  it('requests an immediate database close when iOS expires the worker', async () => {
    let expire: (() => void) | undefined;
    let resolveSession: ((value: { data: { session: null }; error: null }) => void) | undefined;
    mockGetSession.mockReturnValueOnce(
      new Promise<{ data: { session: null }; error: null }>((resolve) => {
        resolveSession = resolve;
      }),
    );
    mockAddExpirationListener.mockImplementationOnce((listener: () => void) => {
      expire = listener;
      return { remove: mockRemoveExpirationListener };
    });
    const { taskExecutor } = loadBackgroundSync();
    const task = taskExecutor();

    expire?.();
    await Promise.resolve();

    expect(mockCloseDatabaseForLifecycle).not.toHaveBeenCalled();
    const beginOptions = mockBeginBackgroundContext.mock.calls[0]?.[1] as
      | { signal: AbortSignal }
      | undefined;
    if (!beginOptions) throw new Error('Background-Kontext wurde nicht gestartet.');
    expect(beginOptions.signal.aborted).toBe(true);

    resolveSession?.({ data: { session: null }, error: null });
    await task;
    expect(mockCloseDatabaseForLifecycle).toHaveBeenCalledTimes(1);
    expect(backgroundContext.end).toHaveBeenCalledTimes(1);
  });

  it('registers the task with the requested minimum interval', async () => {
    const { backgroundSync } = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await backgroundSync.registerBackgroundSync(30);

    expect(backgroundTask.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: 30,
    });
  });

  it('unregisters the task by its shared name', async () => {
    const { backgroundSync } = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await backgroundSync.unregisterBackgroundSync();

    expect(backgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME);
  });

  it('returns the native background task status', async () => {
    const { backgroundSync } = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await expect(backgroundSync.getBackgroundSyncStatus()).resolves.toBe('available');
    expect(backgroundTask.getStatusAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['expo-background-task', 'expo-task-manager'])(
    'returns the rebuild hint when %s is unavailable',
    (moduleName) => {
      jest.resetModules();
      jest.doMock(moduleName, () => {
        throw new Error('native module unavailable');
      });

      expect(() => require('./remote-background-sync')).toThrow(
        'expo-background-task/expo-task-manager sind im installierten Build nicht enthalten.',
      );

      jest.dontMock(moduleName);
    },
  );
});
