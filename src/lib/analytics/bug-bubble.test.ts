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
    const originalAllowedEmails = process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS;
    const originalAllowedUserIds = process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS;
    const originalDevTools = process.env.EXPO_PUBLIC_DEV_TOOLS;
    const originalDevDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');

    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS;
      delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS;
      delete process.env.EXPO_PUBLIC_DEV_TOOLS;
      Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
    });

    afterEach(() => {
      if (originalAllowedEmails === undefined) {
        delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS;
      } else {
        process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS = originalAllowedEmails;
      }
      if (originalAllowedUserIds === undefined) {
        delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS;
      } else {
        process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS = originalAllowedUserIds;
      }
      if (originalDevTools === undefined) {
        delete process.env.EXPO_PUBLIC_DEV_TOOLS;
      } else {
        process.env.EXPO_PUBLIC_DEV_TOOLS = originalDevTools;
      }
      if (originalDevDescriptor) {
        Object.defineProperty(globalThis, '__DEV__', originalDevDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, '__DEV__');
      }
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

    it('normalisiert erlaubte E-Mail-Adressen und ignoriert leere Einträge', () => {
      process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS = ' , ADMIN@example.com , ';

      expect(
        isBugBubbleEnabledForUser({
          email: 'admin@EXAMPLE.com',
          flagEnabled: false,
        }),
      ).toBe(true);
    });

    it('erfordert eine exakte passende Freigabe wenn Flag und Umgebungsmodus aus sind', () => {
      delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_EMAILS;
      delete process.env.EXPO_PUBLIC_BUGBUBBLE_ALLOWED_USER_IDS;

      expect(
        isBugBubbleEnabledForUser({
          email: 'unknown@example.com',
          userId: 'unknown-user',
          flagEnabled: false,
        }),
      ).toBe(false);
    });
  });
});
