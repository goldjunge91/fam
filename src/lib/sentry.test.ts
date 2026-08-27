const mockSentryInit = jest.fn();
const mockMobileReplayIntegration = jest.fn();

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: (...args: unknown[]) => mockSentryInit(...args),
  reactNavigationIntegration: () => ({ registerNavigationContainer: jest.fn() }),
  mobileReplayIntegration: () => mockMobileReplayIntegration(),
}));

describe('initSentry', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('bleibt ohne DSN ein No-op', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { initSentry } = require('@/lib/sentry');

    initSentry();

    expect(mockSentryInit).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN fehlt'));
  });

  it('initialisiert Sentry mit DSN', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@o1.ingest.sentry.io/1';
    const { initSentry } = require('@/lib/sentry');

    initSentry();

    const initOptions = mockSentryInit.mock.calls[0]?.[0];
    expect(initOptions).toEqual(
      expect.objectContaining({
        dsn: 'https://example@o1.ingest.sentry.io/1',
        integrations: [expect.any(Object)],
        sendDefaultPii: true,
      }),
    );
    expect(initOptions).not.toHaveProperty('replaysOnErrorSampleRate');
    expect(initOptions).not.toHaveProperty('replaysSessionSampleRate');
    expect(mockMobileReplayIntegration).not.toHaveBeenCalled();
  });

  it('verwendet bei aktiviertem Replay kleine Sample-Raten', () => {
    const { getSentryReplayOptions } = require('@/lib/sentry');

    expect(getSentryReplayOptions(false)).toEqual({
      replaysOnErrorSampleRate: 0.1,
      replaysSessionSampleRate: 0.01,
    });
  });

  it('stuerzt nicht ab, wenn init wirft, und wiederholt den Fehler nicht', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example@o1.ingest.sentry.io/1';
    mockSentryInit.mockImplementation(() => {
      throw new Error('init fehlgeschlagen');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { initSentry } = require('@/lib/sentry');

    expect(() => initSentry()).not.toThrow();

    // Zweiter Aufruf darf den Fehler nicht erneut werfen (configured-Flag).
    expect(() => initSentry()).not.toThrow();
    expect(mockSentryInit).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });
});
