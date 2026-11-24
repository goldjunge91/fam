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
const mockShoppingListSnapshot = jest.fn();
const mockQuickAddSnapshot = jest.fn();
let mockLanguage: 'de' | 'en' = 'de';
const mockI18nT = jest.fn((key: string) => {
  if (mockLanguage === 'de') {
    if (key === 'common.widgets.quickAdd') return 'Schnell hinzufügen';
    if (key === 'common.widgets.quickAddArticle') return 'Milch hinzufügen';
  }
  if (key === 'common.widgets.quickAdd') return 'Quick add';
  if (key === 'common.widgets.quickAddArticle') return 'Add milk';
  return key;
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: (...args: unknown[]) => mockPreventAutoHide(...args),
}));
jest.mock('react-native-reanimated', () => ({
  configureReanimatedLogger: (...args: unknown[]) => mockConfigureReanimated(...args),
}));
jest.mock('@/features/ads', () => ({
  initMobileAds: (...args: unknown[]) => mockInitMobileAds(...args),
}));
jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string) => mockI18nT(key),
  },
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
jest.mock('@/widgets/quick-add-shopping-widget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockQuickAddSnapshot(...args) },
}));
jest.mock('@/widgets/shopping-list-widget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockShoppingListSnapshot(...args) },
}));

function loadInitializeAppRuntime(): () => void {
  jest.resetModules();
  return (require('./initialize-app-runtime') as typeof import('./initialize-app-runtime'))
    .initializeAppRuntime;
}

describe('initializeAppRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'de';
    mockStartPerformanceSpan.mockReturnValue(mockFinishPerformance);
  });

  it('initializes foreground services once', () => {
    const initializeAppRuntime = loadInitializeAppRuntime();

    initializeAppRuntime();
    initializeAppRuntime();

    expect(mockMarkPerformance).toHaveBeenCalledWith('app.start', { phase: 'startup' });
    expect(mockStartPerformanceSpan).toHaveBeenCalledWith('app.runtime.initialization', {
      phase: 'startup',
    });
    expect(mockConfigureReanimated).toHaveBeenCalledWith({ strict: false });
    expect(mockPreventAutoHide).toHaveBeenCalledTimes(1);
    expect(mockInitSentry).toHaveBeenCalledTimes(1);
    expect(mockInitPostHog).toHaveBeenCalledTimes(1);
    expect(mockInitAptabase).toHaveBeenCalledTimes(1);
    expect(mockInitMobileAds).toHaveBeenCalledTimes(1);
    expect(mockShoppingListSnapshot).toHaveBeenCalledWith({ openCount: 0 });
    expect(mockQuickAddSnapshot).toHaveBeenCalledWith({
      articleName: 'Milch hinzufügen',
      title: 'Schnell hinzufügen',
    });
    expect(mockI18nT).toHaveBeenCalledWith('common.widgets.quickAdd');
    expect(mockI18nT).toHaveBeenCalledWith('common.widgets.quickAddArticle');
    expect(mockFinishPerformance).toHaveBeenCalledWith('completed', { initialized: true });
  });

  it.each([
    ['de', 'Schnell hinzufügen', 'Milch hinzufügen'],
    ['en', 'Quick add', 'Add milk'],
  ] as const)(
    'passes localized Quick Add snapshot props for %s',
    (language, title, articleName) => {
      mockLanguage = language;
      const initializeAppRuntime = loadInitializeAppRuntime();

      initializeAppRuntime();

      expect(mockQuickAddSnapshot).toHaveBeenCalledWith({ articleName, title });
    },
  );

  it('marks initialization failed, resets the guard, and allows a retry', () => {
    const initializeAppRuntime = loadInitializeAppRuntime();
    const error = new Error('PostHog initialization failed');
    mockInitPostHog.mockImplementationOnce(() => {
      throw error;
    });

    expect(initializeAppRuntime).toThrow(error);
    expect(mockInitAptabase).not.toHaveBeenCalled();
    expect(mockFinishPerformance).toHaveBeenCalledWith('failed', { initialized: false });

    expect(initializeAppRuntime).not.toThrow();
    expect(mockInitPostHog).toHaveBeenCalledTimes(2);
  });
});
