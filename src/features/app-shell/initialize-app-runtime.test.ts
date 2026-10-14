import { initializeAppRuntime } from './initialize-app-runtime';

const mockConfigureObserve = jest.fn();
const mockPreventAutoHide = jest.fn();
const mockConfigureReanimated = jest.fn();
const mockInitMobileAds = jest.fn();
const mockInitAptabase = jest.fn();
const mockMarkPerformance = jest.fn();
const mockFinishPerformance = jest.fn();
const mockStartPerformanceSpan = jest.fn(
  (_name: string, _details: { phase: string }) => mockFinishPerformance,
);
const mockInitPostHog = jest.fn();
const mockInitSentry = jest.fn();
const mockDefineBackgroundSyncTask = jest.fn();
const mockShoppingListSnapshot = jest.fn();
const mockQuickAddSnapshot = jest.fn();

jest.mock('expo-observe', () => ({
  Observe: { configure: (...args: unknown[]) => mockConfigureObserve(...args) },
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: (...args: unknown[]) => mockPreventAutoHide(...args),
}));
jest.mock('react-native-reanimated', () => ({
  configureReanimatedLogger: (...args: unknown[]) => mockConfigureReanimated(...args),
}));
jest.mock('@/features/ads', () => ({
  initMobileAds: (...args: unknown[]) => mockInitMobileAds(...args),
}));
jest.mock('@/lib/analytics/aptabase', () => ({
  initAptabase: (...args: unknown[]) => mockInitAptabase(...args),
}));
jest.mock('@/lib/observability/performance', () => ({
  markPerformance: (...args: unknown[]) => mockMarkPerformance(...args),
  startPerformanceSpan: (name: string, details: { phase: string }) =>
    mockStartPerformanceSpan(name, details),
}));
jest.mock('@/lib/observability/providers/posthog', () => ({
  initPostHog: (...args: unknown[]) => mockInitPostHog(...args),
}));
jest.mock('@/lib/observability/providers/sentry', () => ({
  initSentry: (...args: unknown[]) => mockInitSentry(...args),
}));
jest.mock('@/lib/sync/remote-background-sync', () => ({
  defineBackgroundSyncTask: (...args: unknown[]) => mockDefineBackgroundSyncTask(...args),
}));
jest.mock('@/widgets/quick-add-shopping-widget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockQuickAddSnapshot(...args) },
}));
jest.mock('@/widgets/shopping-list-widget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockShoppingListSnapshot(...args) },
}));

describe('initializeAppRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartPerformanceSpan.mockReturnValue(mockFinishPerformance);
  });

  it('initializes startup services before configuring Observe', () => {
    initializeAppRuntime();

    expect(mockMarkPerformance).toHaveBeenCalledWith('app.start', { phase: 'startup' });
    expect(mockStartPerformanceSpan).toHaveBeenCalledWith('app.runtime.initialization', {
      phase: 'startup',
    });
    expect(mockConfigureReanimated).toHaveBeenCalledWith({ strict: false });
    expect(mockPreventAutoHide).toHaveBeenCalledTimes(1);
    expect(mockDefineBackgroundSyncTask).toHaveBeenCalledTimes(1);
    expect(mockInitSentry).toHaveBeenCalledTimes(1);
    expect(mockInitPostHog).toHaveBeenCalledTimes(1);
    expect(mockInitAptabase).toHaveBeenCalledTimes(1);
    expect(mockInitMobileAds).toHaveBeenCalledTimes(1);
    expect(mockShoppingListSnapshot).toHaveBeenCalledWith({ openCount: 0 });
    expect(mockQuickAddSnapshot).toHaveBeenCalledWith({ articleName: 'Milch hinzufügen' });
    expect(mockConfigureObserve).toHaveBeenCalledWith({
      integrations: { 'expo-router': true },
    });
    expect(mockFinishPerformance).toHaveBeenCalledWith('completed', { initialized: true });
  });

  it('marks the initialization span failed and rethrows the first startup error', () => {
    const error = new Error('PostHog initialization failed');
    mockInitPostHog.mockImplementationOnce(() => {
      throw error;
    });

    expect(initializeAppRuntime).toThrow(error);
    expect(mockInitAptabase).not.toHaveBeenCalled();
    expect(mockFinishPerformance).toHaveBeenCalledWith('failed', { initialized: false });
  });
});
