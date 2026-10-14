import {
  announce,
  announceExpectedScreenshotCount,
  getScreenshotFixtureReadiness,
  isRecentScreenshotFlag,
  loadShotsFlag,
  SCREENSHOT_ABORT_MESSAGE,
  waitForScreenshotCapture,
  waitForScreenshotFixture,
} from './screenshots';

type FileRecord = { contents: string; readFailures: number };

jest.mock('expo-file-system', () => {
  const files = new Map<string, FileRecord>();
  const key = (name: string) => `document/${name}`;

  class MockFile {
    readonly fileKey: string;

    constructor(...segments: string[]) {
      this.fileKey = segments.join('/');
    }

    get exists(): boolean {
      return files.has(this.fileKey);
    }

    async text(): Promise<string> {
      const record = files.get(this.fileKey);
      if (!record) throw new Error('File does not exist');
      if (record.readFailures > 0) {
        record.readFailures -= 1;
        throw new Error('File is being replaced');
      }
      return record.contents;
    }

    write(contents: string): void {
      files.set(this.fileKey, { contents, readFailures: 0 });
    }

    delete(): void {
      files.delete(this.fileKey);
    }
  }

  return {
    File: MockFile,
    Paths: { document: 'document' },
    __test: {
      exists: (name: string) => files.has(key(name)),
      get: (name: string) => files.get(key(name))?.contents,
      reset: () => files.clear(),
      set: (name: string, contents: string, readFailures = 0) => {
        files.set(key(name), { contents, readFailures });
      },
    },
  };
});

const mockGetFirstAsync = jest.fn();
jest.mock('@/lib/db/local-client', () => ({
  getDatabase: () => ({ getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args) }),
}));

const mockDebugError = jest.fn();
const mockDebugInfo = jest.fn();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
  debugInfo: (...args: unknown[]) => mockDebugInfo(...args),
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

const fileSystem = jest.requireMock<{
  __test: {
    exists: (name: string) => boolean;
    get: (name: string) => string | undefined;
    reset: () => void;
    set: (name: string, contents: string, readFailures?: number) => void;
  };
}>('expo-file-system').__test;

beforeEach(() => {
  jest.useRealTimers();
  fileSystem.reset();
  mockGetFirstAsync.mockReset();
  mockDebugError.mockClear();
  mockDebugInfo.mockClear();
  mockDebugLog.mockClear();
  mockDebugWarn.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('reads, rejects, and deletes screenshot arming files safely', async () => {
  await expect(loadShotsFlag()).resolves.toBeNull();

  const armedAt = Date.now();
  const config = { enabled: true, armedAt, settleMs: 0 };
  fileSystem.set('shots.json', JSON.stringify(config));
  await expect(loadShotsFlag()).resolves.toEqual({
    enabled: true,
    armedAt,
    captureTimeoutMs: undefined,
    fixtureTimeoutMs: undefined,
    settleMs: 0,
  });

  fileSystem.set('shots.json', JSON.stringify({ enabled: false, armedAt }));
  await expect(loadShotsFlag()).resolves.toBeNull();
  expect(fileSystem.exists('shots.json')).toBe(false);

  fileSystem.set('shots.json', JSON.stringify({ enabled: true, armedAt: armedAt - 30_001 }));
  await expect(loadShotsFlag()).resolves.toBeNull();
  expect(fileSystem.exists('shots.json')).toBe(false);

  fileSystem.set('shots.json', '{invalid');
  await expect(loadShotsFlag()).resolves.toBeNull();
  expect(fileSystem.exists('shots.json')).toBe(true);
  expect(mockDebugWarn).toHaveBeenCalledTimes(3);
});

test('writes status and expected-count files for the screenshot runner', async () => {
  await announce('__starting__');
  announceExpectedScreenshotCount(7);

  expect(fileSystem.get('shot-current.txt')).toBe('__starting__');
  expect(fileSystem.get('shot-expected.txt')).toBe('7');
  expect(mockDebugInfo).toHaveBeenCalledWith('[ScreenshotTour] Status: __starting__');
});

test('reads a complete SQLite fixture and represents missing rows with empty identifiers', async () => {
  mockGetFirstAsync
    .mockResolvedValueOnce({ household_id: 'household-1', recipe_id: 'recipe-1' })
    .mockResolvedValueOnce(null);

  await expect(getScreenshotFixtureReadiness()).resolves.toEqual({
    householdId: 'household-1',
    recipeId: 'recipe-1',
  });
  await expect(getScreenshotFixtureReadiness()).resolves.toEqual({
    householdId: '',
    recipeId: '',
  });
  expect(mockGetFirstAsync).toHaveBeenCalledTimes(2);
});

test('waits for a fixture, tolerates transient database errors, and preserves the final cause', async () => {
  jest.useFakeTimers();
  mockGetFirstAsync
    .mockRejectedValueOnce(new Error('database is opening'))
    .mockResolvedValueOnce({ household_id: 'household-1', recipe_id: 'recipe-1' });

  const ready = waitForScreenshotFixture(new AbortController().signal, {
    intervalMs: 10,
    timeoutMs: 100,
  });
  const readyExpectation = expect(ready).resolves.toEqual({
    householdId: 'household-1',
    recipeId: 'recipe-1',
  });
  await jest.advanceTimersByTimeAsync(10);
  await readyExpectation;

  jest.setSystemTime(0);
  const databaseError = new Error('database still opening');
  mockGetFirstAsync.mockRejectedValue(databaseError);
  const timeout = waitForScreenshotFixture(new AbortController().signal, {
    intervalMs: 10,
    timeoutMs: 15,
  });
  const timeoutExpectation = expect(timeout).rejects.toMatchObject({
    message: 'Screenshot fixture was not ready before the tour timeout.',
    cause: databaseError,
  });
  await jest.advanceTimersByTimeAsync(20);
  await timeoutExpectation;
});

test('stops fixture polling when its AbortSignal is already cancelled or cancelled while waiting', async () => {
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await expect(waitForScreenshotFixture(alreadyAborted.signal)).rejects.toMatchObject({
    name: 'AbortError',
    message: SCREENSHOT_ABORT_MESSAGE,
  });
  expect(mockGetFirstAsync).not.toHaveBeenCalled();

  jest.useFakeTimers();
  mockGetFirstAsync.mockResolvedValue({ household_id: '', recipe_id: '' });
  const controller = new AbortController();
  const waiting = waitForScreenshotFixture(controller.signal, { intervalMs: 50 });
  const waitingExpectation = expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  for (let attempt = 0; attempt < 5 && jest.getTimerCount() === 0; attempt += 1) {
    await Promise.resolve();
  }
  expect(jest.getTimerCount()).toBe(1);
  controller.abort();
  await waitingExpectation;
  expect(jest.getTimerCount()).toBe(0);
});

test('accepts only the matching capture acknowledgement and retries transient reads', async () => {
  jest.useFakeTimers();
  fileSystem.set('shot-captured.txt', '01-home', 1);

  const capture = waitForScreenshotCapture('01-home', new AbortController().signal);
  await jest.advanceTimersByTimeAsync(50);
  await expect(capture).resolves.toBeUndefined();
  expect(mockDebugInfo).toHaveBeenCalledWith('[ScreenshotTour] Capture bestätigt: 01-home');
});

test('rejects capture waits after cancellation or timeout without advancing the tour', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(waitForScreenshotCapture('01-home', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
    message: SCREENSHOT_ABORT_MESSAGE,
  });

  jest.useFakeTimers();
  fileSystem.set('shot-captured.txt', 'other-screen');
  const timeout = waitForScreenshotCapture('01-home', new AbortController().signal, 25);
  const timeoutExpectation = expect(timeout).rejects.toThrow(
    'Screenshot was not captured before the timeout: 01-home',
  );
  await jest.advanceTimersByTimeAsync(50);
  await timeoutExpectation;
  expect(mockDebugError).toHaveBeenCalledWith(
    '[ScreenshotTour] Capture-Timeout für 01-home nach 25ms.',
  );
});

test('checks timestamp validity and future timestamps before accepting the arming flag', () => {
  expect(isRecentScreenshotFlag(Number.NaN, 100)).toBe(false);
  expect(isRecentScreenshotFlag(101, 100)).toBe(false);
  expect(isRecentScreenshotFlag(90, 100, -1)).toBe(false);
});
