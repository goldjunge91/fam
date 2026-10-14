import { act, render } from '@testing-library/react-native';
import { ScreenshotDriver } from './ScreenshotDriver';

const mockLoadShotsFlag = jest.fn();
const mockWaitForScreenshotFixture = jest.fn();
const mockAnnounce = jest.fn().mockResolvedValue(undefined);
const mockDebugError = jest.fn();
let mockSession: { user: { id: string } } | null = null;
let mockIsLoading = true;

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => '/',
}));
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession, isLoading: mockIsLoading }),
}));
jest.mock('@/lib/devtools/screenshots', () => ({
  announce: (...args: unknown[]) => mockAnnounce(...args),
  announceExpectedScreenshotCount: jest.fn(),
  buildScreenshotTour: () => [],
  loadShotsFlag: (...args: unknown[]) => mockLoadShotsFlag(...args),
  normalizeScreenshotPath: (path: string) => path,
  SCREENSHOT_ABORT_MESSAGE: 'Screenshot tour aborted',
  TOUR_STATUS: { STARTING: '__starting__', DONE: '__done__', ERROR: '__error__' },
  waitForScreenshotCapture: jest.fn(),
  waitForScreenshotFixture: (...args: unknown[]) => mockWaitForScreenshotFixture(...args),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
  debugInfo: jest.fn(),
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

test('waits for a loaded session, then reports an active tour error to the capture runner', async () => {
  mockLoadShotsFlag.mockResolvedValue({ enabled: true, armedAt: 1_000, settleMs: 0 });
  mockWaitForScreenshotFixture.mockResolvedValue({
    householdId: 'household-1',
    recipeId: 'recipe-1',
  });
  mockAnnounce.mockImplementation(async (status: string) => {
    if (status === '__starting__') throw new Error('capture status unavailable');
  });

  const screen = await render(<ScreenshotDriver />);
  expect(mockLoadShotsFlag).not.toHaveBeenCalled();

  mockIsLoading = false;
  await screen.rerender(<ScreenshotDriver />);
  expect(mockLoadShotsFlag).not.toHaveBeenCalled();

  mockSession = { user: { id: 'user-1' } };
  await screen.rerender(<ScreenshotDriver />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockLoadShotsFlag).toHaveBeenCalledTimes(1);
  expect(mockWaitForScreenshotFixture).toHaveBeenCalledTimes(1);
  expect(mockDebugError).toHaveBeenCalledWith(
    '[ScreenshotTour] fehlgeschlagen:',
    expect.objectContaining({ message: 'capture status unavailable' }),
  );
  expect(mockAnnounce).toHaveBeenLastCalledWith('__error__');
  await screen.unmount();
});
