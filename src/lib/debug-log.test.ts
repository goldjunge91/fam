import { debugError, debugInfo, debugLog, debugLogEvent, debugWarn } from './debug-log';

describe('Dev-Terminal-Logging', () => {
  const originalDebugLogs = process.env.EXPO_PUBLIC_DEBUG_LOGS;
  let consoleLog: jest.SpiedFunction<typeof console.log>;
  let consoleInfo: jest.SpiedFunction<typeof console.info>;
  let consoleWarn: jest.SpiedFunction<typeof console.warn>;
  let consoleError: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalDebugLogs === undefined) delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
    else process.env.EXPO_PUBLIC_DEBUG_LOGS = originalDebugLogs;
    consoleLog.mockRestore();
    consoleInfo.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it('schreibt Events als lesbare einzelne Zeile mit JSON-Payload', () => {
    debugLogEvent('posthog.capture', {
      event: 'sync.pull.completed',
      properties: {
        correlation_id: 'corr-123',
        duration_ms: 42,
      },
    });

    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(consoleLog).toHaveBeenCalledWith(
      '\u001b[38;5;203m[PostHog]\u001b[0m capture {"event":"sync.pull.completed","properties":{"correlation_id":"corr-123","duration_ms":42}}',
    );
  });

  it('redigiert sensible Werte und lässt sichere Diagnosedaten sichtbar', () => {
    debugLogEvent('posthog.capture-exception', {
      properties: {
        user_id: 'user-123',
        email: 'marco@example.com',
        error_message: 'Fehler für marco@example.com',
        access_token: 'secret-token',
        operation: 'sync.pull',
        error_code: 'sync_failed',
      },
    });

    expect(consoleLog).toHaveBeenCalledWith(
      '\u001b[38;5;203m[PostHog]\u001b[0m capture-exception {"properties":{"user_id":"[redacted]","email":"[redacted]","error_message":"[redacted]","access_token":"[redacted]","operation":"sync.pull","error_code":"sync_failed"}}',
    );
    expect(consoleLog.mock.calls[0][0]).not.toContain('marco@example.com');
    expect(consoleLog.mock.calls[0][0]).not.toContain('secret-token');
  });

  it('verwendet für alle Level dieselbe lesbare Darstellung', () => {
    debugInfo('info.event', { safe: true });
    debugWarn('warn.event', { safe: true });
    debugError('error.event', { safe: true });

    expect(consoleInfo).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledWith('info.event {"safe":true}');
    expect(consoleWarn).toHaveBeenCalledWith('warn.event {"safe":true}');
    expect(consoleError).toHaveBeenCalledWith('error.event {"safe":true}');
  });

  it('markiert RevenueCat im Dev-Terminal farbig', () => {
    debugInfo('[RevenueCat] ℹ️ Finished syncing all cached transaction metadata');

    expect(consoleInfo).toHaveBeenCalledWith(
      '\u001b[38;5;39m[RevenueCat]\u001b[0m ℹ️ Finished syncing all cached transaction metadata',
    );
  });

  it('markiert HouseholdSync im Dev-Terminal blau', () => {
    debugLog('[HouseholdSync] pull completed', { rowsWritten: 2 });

    expect(consoleLog).toHaveBeenCalledWith(
      '\u001b[38;5;39m[HouseholdSync]\u001b[0m pull completed {"rowsWritten":2}',
    );
  });
});
