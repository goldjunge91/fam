import { StorageApiError, StorageUnknownError } from '@supabase/storage-js';
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

  it('redigiert sensible Werte, lässt aber den Fehlertext diagnostisch sichtbar', () => {
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
      '\u001b[38;5;203m[PostHog]\u001b[0m capture-exception {"properties":{"user_id":"[redacted]","email":"[redacted]","error_message":"Fehler für [redacted]","access_token":"[redacted]","operation":"sync.pull","error_code":"sync_failed"}}',
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

  it('trennt Telemetrie-Kanaele farbig und nimmt keine Payload in die Kanalzeile auf', () => {
    debugLogEvent('telemetry.productEvents', {
      event: 'shopping_item.create.completed',
      status: 'blocked',
      destinations: [],
      properties: { email: 'marco@example.com' },
    });
    debugLogEvent('telemetry.errorReports', {
      event: 'error.occurred',
      status: 'allowed',
      destinations: ['Sentry', 'PostHog'],
    });
    debugLogEvent('telemetry.diagnostics', {
      event: 'route.changed',
      status: 'allowed',
      destinations: ['PostHog', 'Aptabase'],
    });

    expect(consoleLog.mock.calls.map(([value]) => value)).toEqual([
      '\u001b[38;5;42m[Produkt]\u001b[0m shopping_item.create.completed (blocked) → keine',
      '\u001b[38;5;196m[Fehler]\u001b[0m error.occurred → Sentry, PostHog',
      '\u001b[38;5;220m[Diagnose]\u001b[0m route.changed → PostHog, Aptabase',
    ]);
  });

  it('serialisiert normale Fehler mit name und message', () => {
    debugError(new Error('Lokaler Fehler'));

    expect(consoleError).toHaveBeenCalledWith(
      '{"args":[{"name":"Error","message":"Lokaler Fehler"}]}',
    );
  });

  it('behält native Diagnosefelder und lässt nicht erlaubte Felder aus', () => {
    const nativeError = Object.assign(new Error('Parsen der Antwort nicht möglich'), {
      code: -1017,
      domain: 'NSURLErrorDomain',
      stack: 'privater Stack',
      userInfo: { url: 'https://example.test/avatar?access_token=secret-token' },
      headers: { authorization: 'Bearer secret-token' },
    });

    debugError('[AvatarUpload] Upload fehlgeschlagen', nativeError);

    const line = consoleError.mock.calls[0][0];
    expect(line).toContain('"code":-1017');
    expect(line).toContain('"domain":"NSURLErrorDomain"');
    expect(line).not.toContain('privater Stack');
    expect(line).not.toContain('access_token');
    expect(line).not.toContain('secret-token');
    expect(line).not.toContain('authorization');
  });

  it('serialisiert cause rekursiv und redigiert sensible Inhalte in der Kette', () => {
    const cause = Object.assign(
      new Error('Request für marco@example.com mit Bearer test-token-value'),
      {
        code: 'E_NETWORK',
        domain: 'ExpoFetch',
      },
    );
    const error = Object.assign(new Error('Upload fehlgeschlagen'), { cause });

    debugWarn('Netzwerkfehler', error);

    const line = consoleWarn.mock.calls[0][0];
    expect(line).toContain(
      '"cause":{"name":"Error","message":"Request für [redacted] mit [redacted]"',
    );
    expect(line).toContain('"code":"E_NETWORK"');
    expect(line).toContain('"domain":"ExpoFetch"');
    expect(line).not.toContain('marco@example.com');
    expect(line).not.toContain('test-token-value');
  });

  it('serialisiert originalError eines StorageUnknownError', () => {
    const originalError = Object.assign(new Error('Parsen der Antwort nicht möglich'), {
      code: -1017,
      domain: 'NSURLErrorDomain',
    });
    const error = new StorageUnknownError('fetch failed', originalError);

    debugError('[AvatarUpload] Upload fehlgeschlagen', error);

    const line = consoleError.mock.calls[0][0];
    expect(line).toContain('"name":"StorageUnknownError"');
    expect(line).toContain(
      '"originalError":{"name":"Error","message":"Parsen der Antwort nicht möglich","code":-1017,"domain":"NSURLErrorDomain"}',
    );
  });

  it('serialisiert StorageApiError-Diagnosefelder', () => {
    const error = new StorageApiError('Nicht autorisiert', 401, '401', 'storage', 'AccessDenied');

    debugError('Storage fehlgeschlagen', error);

    expect(consoleError.mock.calls[0][0]).toContain(
      '"status":401,"statusCode":"401","code":"AccessDenied"',
    );
  });

  it('verarbeitet Error-Diagnosefelder über alle Log-Level', () => {
    const error = Object.assign(new Error('Level-Test'), { code: 'E_LEVEL' });

    debugLog('debug', error);
    debugInfo('info', error);
    debugWarn('warn', error);
    debugError('error', error);

    expect(consoleLog.mock.calls[0][0]).toContain('"code":"E_LEVEL"');
    expect(consoleInfo.mock.calls[0][0]).toContain('"code":"E_LEVEL"');
    expect(consoleWarn.mock.calls[0][0]).toContain('"code":"E_LEVEL"');
    expect(consoleError.mock.calls[0][0]).toContain('"code":"E_LEVEL"');
  });

  it('behält Plain Objects, Arrays und Primitive im bestehenden Format', () => {
    debugLog({ safe: true }, ['value'], 42, null);

    expect(consoleLog).toHaveBeenCalledWith('{"args":[{"safe":true},["value"],42,null]}');
  });

  it('markiert zirkuläre Error-Ursachen ohne den Logger abstürzen zu lassen', () => {
    const error = new Error('Zirkuläre Ursache');
    Object.assign(error, { cause: error });

    expect(() => debugError(error)).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      '{"args":[{"name":"Error","message":"Zirkuläre Ursache","cause":"[circular]"}]}',
    );
  });

  it('begrenzt tief verschachtelte Error-Ursachen', () => {
    let error: Error = new Error('Ebene 0');
    for (let depth = 1; depth <= 6; depth += 1) {
      error = Object.assign(new Error(`Ebene ${depth}`), { cause: error });
    }

    debugError(error);

    expect(consoleError.mock.calls[0][0]).toContain('"cause":"[truncated]"');
  });

  it('behandelt nicht lesbare Diagnose-Properties sicher', () => {
    const error = new Error('Getter-Fehler');
    Object.defineProperty(error, 'cause', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error('interner Getter-Fehler');
      },
    });

    expect(() => debugError(error)).not.toThrow();
    expect(consoleError.mock.calls[0][0]).toContain('"cause":"[unreadable]"');
    expect(consoleError.mock.calls[0][0]).not.toContain('interner Getter-Fehler');
  });
});
