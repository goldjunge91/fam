const mockInit = jest.fn();
const mockTrackEvent = jest.fn();
const mockTrackError = jest.fn();
const mockDispose = jest.fn();

jest.mock('@aptabase/react-native', () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]) => mockInit(...args),
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
    trackError: (...args: unknown[]) => mockTrackError(...args),
    dispose: () => mockDispose(),
  },
  init: (...args: unknown[]) => mockInit(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  trackError: (...args: unknown[]) => mockTrackError(...args),
  dispose: () => mockDispose(),
}));

describe('Aptabase Analytics', () => {
  const originalKey = process.env.EXPO_PUBLIC_APTABASE_APP_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
    } else {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = originalKey;
    }
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('initAptabase / isAptabaseConfigured', () => {
    it('bleibt ohne App-Key ein No-op', () => {
      delete process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { initAptabase, isAptabaseConfigured } = require('@/lib/analytics/aptabase');

      initAptabase();

      expect(isAptabaseConfigured()).toBe(false);
      expect(mockInit).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('EXPO_PUBLIC_APTABASE_APP_KEY fehlt'),
      );
    });

    it('initialisiert Aptabase mit App-Key und korrekten Default-Optionen', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      const { initAptabase, isAptabaseConfigured } = require('@/lib/analytics/aptabase');

      initAptabase();

      expect(isAptabaseConfigured()).toBe(true);
      expect(mockInit).toHaveBeenCalledWith(
        'A-EU-1234567890',
        expect.objectContaining({
          enableWeb: true,
          enableCrashReporting: false,
        }),
      );
    });

    it('stürzt nicht ab, wenn init wirft, und fängt Fehler ab', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      mockInit.mockImplementationOnce(() => {
        throw new Error('SDK init failed');
      });
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const {
        getAptabaseInitializationError,
        initAptabase,
        isAptabaseConfigured,
      } = require('@/lib/analytics/aptabase');

      expect(() => initAptabase()).not.toThrow();
      expect(isAptabaseConfigured()).toBe(false);
      expect(getAptabaseInitializationError()).toBe('SDK init failed');

      // Zweiter Aufruf bleibt No-op (bereits attempted)
      expect(() => initAptabase()).not.toThrow();
      expect(mockInit).toHaveBeenCalledTimes(1);

      consoleError.mockRestore();
    });
  });

  describe('trackAptabaseEvent', () => {
    it('sendet Event wenn Aptabase konfiguriert ist', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      const { initAptabase, trackAptabaseEvent } = require('@/lib/analytics/aptabase');
      initAptabase();

      trackAptabaseEvent('test_event', { key: 'value', number: 42 });

      expect(mockTrackEvent).toHaveBeenCalledWith('test_event', { key: 'value', number: 42 });
    });

    it('sendet kein Event wenn Aptabase nicht konfiguriert ist', () => {
      delete process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
      const { initAptabase, trackAptabaseEvent } = require('@/lib/analytics/aptabase');
      initAptabase();

      trackAptabaseEvent('test_event');

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('fängt Fehler beim Tracken ab ohne zu crashen', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      mockTrackEvent.mockImplementationOnce(() => {
        throw new Error('Track failed');
      });
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { initAptabase, trackAptabaseEvent } = require('@/lib/analytics/aptabase');
      initAptabase();

      expect(() => trackAptabaseEvent('test_event')).not.toThrow();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[aptabase] Event konnte nicht gesendet werden:'),
        expect.any(Error),
      );
    });
  });

  describe('trackAptabaseError', () => {
    it('sendet Fehlerbericht wenn Aptabase konfiguriert ist', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      const { initAptabase, trackAptabaseError } = require('@/lib/analytics/aptabase');
      initAptabase();

      const testError = new Error('Test error');
      trackAptabaseError(testError, { fatal: true });

      expect(mockTrackError).toHaveBeenCalledWith(testError, { fatal: true });
    });

    it('sendet keinen Fehlerbericht wenn nicht konfiguriert', () => {
      delete process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
      const { initAptabase, trackAptabaseError } = require('@/lib/analytics/aptabase');
      initAptabase();

      trackAptabaseError(new Error('Test'));

      expect(mockTrackError).not.toHaveBeenCalled();
    });
  });

  describe('disposeAptabase', () => {
    it('ruft dispose auf und setzt konfigurierten Zustand zurück', () => {
      process.env.EXPO_PUBLIC_APTABASE_APP_KEY = 'A-EU-1234567890';
      const {
        disposeAptabase,
        initAptabase,
        isAptabaseConfigured,
      } = require('@/lib/analytics/aptabase');
      initAptabase();
      expect(isAptabaseConfigured()).toBe(true);

      disposeAptabase();

      expect(mockDispose).toHaveBeenCalled();
      expect(isAptabaseConfigured()).toBe(false);
    });
  });
});
