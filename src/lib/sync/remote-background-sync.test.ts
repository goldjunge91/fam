const BACKGROUND_SYNC_TASK_NAME = 'fam-background-sync';

jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: {
    Success: 'success',
    Failed: 'failed',
  },
  getStatusAsync: jest.fn().mockResolvedValue('available'),
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

type BackgroundSyncModule = typeof import('./remote-background-sync');

function loadBackgroundSync(): BackgroundSyncModule {
  jest.resetModules();
  return require('./remote-background-sync') as BackgroundSyncModule;
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
  });

  it('defines the task once and treats a missing handler as success', async () => {
    const backgroundSync = loadBackgroundSync();
    const taskManager = getTaskManagerMock();
    const { BackgroundTaskResult } = getBackgroundTaskMock();

    backgroundSync.defineBackgroundSyncTask();
    backgroundSync.defineBackgroundSyncTask();

    expect(taskManager.defineTask).toHaveBeenCalledTimes(1);
    expect(taskManager.defineTask).toHaveBeenCalledWith(
      BACKGROUND_SYNC_TASK_NAME,
      expect.any(Function),
    );

    const taskExecutor = taskManager.defineTask.mock.calls[0][1] as () => Promise<string>;
    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Success);
  });

  it('returns success after the configured handler completes', async () => {
    const backgroundSync = loadBackgroundSync();
    const taskManager = getTaskManagerMock();
    const { BackgroundTaskResult } = getBackgroundTaskMock();
    const handler = jest.fn().mockResolvedValue(undefined);

    backgroundSync.setBackgroundSyncHandler(handler);
    backgroundSync.defineBackgroundSyncTask();

    const taskExecutor = taskManager.defineTask.mock.calls[0][1] as () => Promise<string>;
    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Success);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reports handler failures and returns failed', async () => {
    const backgroundSync = loadBackgroundSync();
    const taskManager = getTaskManagerMock();
    const { BackgroundTaskResult } = getBackgroundTaskMock();
    const reportError = getReportErrorMock();
    const error = new Error('offline');
    const handler = jest.fn().mockRejectedValue(error);

    backgroundSync.setBackgroundSyncHandler(handler);
    backgroundSync.defineBackgroundSyncTask();

    const taskExecutor = taskManager.defineTask.mock.calls[0][1] as () => Promise<string>;
    await expect(taskExecutor()).resolves.toBe(BackgroundTaskResult.Failed);
    expect(reportError).toHaveBeenCalledWith(error, {
      operation: 'sync.background',
      error_code: 'background_sync_failed',
    });
  });

  it('registers the task with the requested minimum interval', async () => {
    const backgroundSync = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await backgroundSync.registerBackgroundSync(30);

    expect(backgroundTask.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME, {
      minimumInterval: 30,
    });
  });

  it('unregisters the task by its canonical name', async () => {
    const backgroundSync = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await backgroundSync.unregisterBackgroundSync();

    expect(backgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK_NAME);
  });

  it('returns the native background task status', async () => {
    const backgroundSync = loadBackgroundSync();
    const backgroundTask = getBackgroundTaskMock();

    await expect(backgroundSync.getBackgroundSyncStatus()).resolves.toBe('available');
    expect(backgroundTask.getStatusAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['expo-background-task', 'expo-task-manager'])(
    'returns the rebuild hint when %s is unavailable',
    async (moduleName) => {
      jest.resetModules();
      jest.doMock(moduleName, () => {
        throw new Error('native module unavailable');
      });

      const backgroundSync = require('./remote-background-sync') as BackgroundSyncModule;
      const operation =
        moduleName === 'expo-task-manager'
          ? () => backgroundSync.defineBackgroundSyncTask()
          : () => backgroundSync.registerBackgroundSync();

      if (moduleName === 'expo-task-manager') {
        expect(operation).toThrow(
          'expo-background-task/expo-task-manager sind im installierten Build nicht enthalten.',
        );
        return;
      }

      await expect(operation()).rejects.toThrow(
        'expo-background-task/expo-task-manager sind im installierten Build nicht enthalten.',
      );
    },
  );
});
