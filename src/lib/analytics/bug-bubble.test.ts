import { BugBubbleLogger } from '@lokal-dev/react-native-bugbubble';

import {
  bugBubbleAnalytics,
  bugBubbleConsole,
  isBugBubbleActive,
  isBugBubbleEnabledForUser,
  setBugBubbleActive,
} from './bug-bubble';

describe('bug-bubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isBugBubbleActive & setBugBubbleActive', () => {
    it('kann aktiv und inaktiv geschaltet werden', () => {
      setBugBubbleActive(true);
      expect(isBugBubbleActive()).toBe(true);

      setBugBubbleActive(false);
      expect(isBugBubbleActive()).toBe(false);
    });
  });

  describe('bugBubbleAnalytics', () => {
    it('leitet Events an BugBubbleLogger weiter wenn aktiv', () => {
      setBugBubbleActive(true);
      bugBubbleAnalytics('test_event', { foo: 'bar' });
      expect(BugBubbleLogger.logAnalytics).toHaveBeenCalledWith('test_event', { foo: 'bar' });
    });

    it('leitet nichts weiter wenn inaktiv', () => {
      setBugBubbleActive(false);
      bugBubbleAnalytics('test_event', { foo: 'bar' });
      expect(BugBubbleLogger.logAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('bugBubbleConsole', () => {
    it('leitet Konsolen-Logs weiter wenn aktiv', () => {
      setBugBubbleActive(true);
      bugBubbleConsole('info', 'hello', 123);
      expect(BugBubbleLogger.logConsole).toHaveBeenCalledWith('info', 'hello', 123);
    });

    it('leitet nichts weiter wenn inaktiv', () => {
      setBugBubbleActive(false);
      bugBubbleConsole('error', 'error_msg');
      expect(BugBubbleLogger.logConsole).not.toHaveBeenCalled();
    });
  });

  describe('isBugBubbleEnabledForUser', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('erlaubt Zugriff wenn flagEnabled true ist', () => {
      expect(isBugBubbleEnabledForUser({ flagEnabled: true })).toBe(true);
    });

    it('erlaubt Zugriff wenn E-Mail in EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS enthalten ist', () => {
      process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS = 'admin@example.com,marco@test.de';
      expect(
        isBugBubbleEnabledForUser({
          email: 'Marco@Test.de',
          flagEnabled: false,
        }),
      ).toBe(true);
    });

    it('erlaubt Zugriff wenn User-ID in EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS enthalten ist', () => {
      process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS = 'uuid-123,uuid-456';
      expect(
        isBugBubbleEnabledForUser({
          userId: 'uuid-123',
          flagEnabled: false,
        }),
      ).toBe(true);
    });
  });
});
