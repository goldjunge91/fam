import { render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { runScreenshotTour, ScreenshotDriver } from '@/components/ScreenshotDriver';

const mockLoadShotsFlag = jest.fn();
const mockWaitForScreenshotFixture = jest.fn();
const mockAnnounce = jest.fn().mockResolvedValue(undefined);
const mockAnnounceExpectedScreenshotCount = jest.fn();
const mockWaitForScreenshotCapture = jest.fn().mockResolvedValue(undefined);
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
let mockIsLoading = false;
let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => mockPathname,
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: mockSession, isLoading: mockIsLoading }),
}));

jest.mock('@/lib/screenshots', () => ({
  announce: (...args: unknown[]) => mockAnnounce(...args),
  announceExpectedScreenshotCount: (...args: unknown[]) =>
    mockAnnounceExpectedScreenshotCount(...args),
  buildScreenshotTour: () => [
    { name: '01-home', href: '/', path: '/' },
    {
      name: '02-guided-cooking',
      href: { pathname: '/recipe/cook', params: { id: 'recipe-1' } },
      path: '/recipe/cook',
    },
  ],
  loadShotsFlag: (...args: unknown[]) => mockLoadShotsFlag(...args),
  normalizeScreenshotPath: (path: string) => {
    const trimmed = path.trim().replace(/^\/+|\/+$/g, '');
    return trimmed ? `/${trimmed}` : '/';
  },
  SCREENSHOT_ABORT_MESSAGE: 'Screenshot tour aborted',
  TOUR_STATUS: { STARTING: '__starting__', DONE: '__done__', ERROR: '__error__' },
  waitForScreenshotCapture: (...args: unknown[]) => mockWaitForScreenshotCapture(...args),
  waitForScreenshotFixture: (...args: unknown[]) => mockWaitForScreenshotFixture(...args),
}));

describe('ScreenshotDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = { user: { id: 'user-1' } };
    mockIsLoading = false;
    mockPathname = '/';
    mockWaitForScreenshotFixture.mockResolvedValue({
      householdId: 'household-1',
      recipeId: 'recipe-1',
    });
  });

  it('bleibt ohne shots.json vollständig inaktiv', async () => {
    mockLoadShotsFlag.mockResolvedValue(null);

    await render(<ScreenshotDriver />);

    expect(mockWaitForScreenshotFixture).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockAnnounceExpectedScreenshotCount).not.toHaveBeenCalled();
  });

  it('kündigt jede freigegebene Route erst nach dem Navigieren an', async () => {
    mockLoadShotsFlag.mockResolvedValue({ enabled: true, settleMs: 0 });
    (router.replace as jest.Mock).mockImplementation((target) => {
      mockPathname = typeof target === 'string' ? target : target.pathname;
    });

    await runScreenshotTour(
      new AbortController().signal,
      { enabled: true, settleMs: 0 },
      'recipe-1',
      () => mockPathname,
    );

    expect(mockAnnounce.mock.calls.map(([name]) => name)).toEqual([
      '__starting__',
      '01-home',
      '02-guided-cooking',
      '__done__',
    ]);
    expect(mockAnnounceExpectedScreenshotCount).toHaveBeenCalledWith(2);
    expect(mockWaitForScreenshotCapture.mock.calls.map(([name]) => name)).toEqual([
      '01-home',
      '02-guided-cooking',
    ]);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/recipe/cook',
      params: { id: 'recipe-1' },
    });
    expect(mockAnnounce.mock.invocationCallOrder[2]).toBeGreaterThan(
      (router.replace as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('wartet auf den tatsächlich aktiven Pfad, bevor es den Status meldet', async () => {
    let activePath = '/pending';
    (router.replace as jest.Mock).mockImplementation((target) => {
      const nextPath = typeof target === 'string' ? target : target.pathname;
      setTimeout(() => {
        activePath = nextPath;
      }, 20);
    });
    const getCurrentPath = () => activePath;
    const tour = runScreenshotTour(
      new AbortController().signal,
      { enabled: true, settleMs: 0 },
      'recipe-1',
      getCurrentPath,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockAnnounce).toHaveBeenCalledWith('__starting__');
    expect(mockAnnounce).not.toHaveBeenCalledWith('01-home');

    await tour;
    expect(mockAnnounce).toHaveBeenCalledWith('01-home');
  });
});
