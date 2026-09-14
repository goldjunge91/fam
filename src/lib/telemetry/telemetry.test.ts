import { useAnalyticsSettingsStore } from '@/constants/analytics';
import {
  isAptabaseConfigured,
  trackAptabaseError,
  trackAptabaseEvent,
} from '@/lib/analytics/aptabase';
import { getPostHogClient, isPostHogConfigured } from '@/lib/observability/providers/posthog';
import { Sentry } from '@/lib/observability/providers/sentry';
import {
  addDiagnosticStep,
  measureOperation,
  reportError,
  reportWarning,
  setTelemetryUserId,
  trackEvent,
} from '@/lib/telemetry';

jest.mock('@/lib/analytics/aptabase', () => ({
  isAptabaseConfigured: jest.fn(),
  trackAptabaseError: jest.fn(),
  trackAptabaseEvent: jest.fn(),
}));

jest.mock('@/lib/observability/providers/posthog', () => ({
  getPostHogClient: jest.fn(),
  isPostHogConfigured: jest.fn(),
}));

jest.mock('@/lib/observability/providers/sentry', () => ({
  Sentry: {
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

function hasPostHogOperation(value: string, operation: string): boolean {
  return value.includes('[PostHog]') && value.includes(` ${operation} `);
}

describe('telemetry fan-out', () => {
  const capture = jest.fn();
  const captureException = jest.fn();
  const addExceptionStep = jest.fn();
  let originalDebugLogs: string | undefined;

  beforeEach(() => {
    originalDebugLogs = process.env.EXPO_PUBLIC_DEBUG_LOGS;
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'false';
    jest.clearAllMocks();
    useAnalyticsSettingsStore.getState().resetOverrides();
    useAnalyticsSettingsStore.getState().setOverride('providers.aptabase', true);
    setTelemetryUserId(null);
    (isAptabaseConfigured as jest.Mock).mockReturnValue(true);
    (isPostHogConfigured as jest.Mock).mockReturnValue(true);
    (getPostHogClient as jest.Mock).mockReturnValue({
      capture,
      captureException,
      addExceptionStep,
    });
  });

  afterEach(() => {
    if (originalDebugLogs === undefined) delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
    else process.env.EXPO_PUBLIC_DEBUG_LOGS = originalDebugLogs;
    jest.useRealTimers();
  });

  it('sendet exakt dasselbe Eventobjekt an Aptabase und PostHog', () => {
    setTelemetryUserId('user-123');

    trackEvent('sync.pull.completed', { entity: 'households', duration_ms: 42 });

    const aptabaseProperties = (trackAptabaseEvent as jest.Mock).mock.calls[0][1];
    const postHogProperties = capture.mock.calls[0][1];
    expect(aptabaseProperties).toBe(postHogProperties);
    expect(aptabaseProperties).toEqual(
      expect.objectContaining({
        correlation_id: expect.any(String),
        duration_ms: 42,
        entity: 'households',
        operation: 'sync.pull',
        outcome: 'completed',
        platform: expect.any(String),
        timestamp: expect.any(Number),
        user_id: 'user-123',
      }),
    );
  });

  it('spiegelt die gesendete PostHog-Event-Payload sicher ins Dev-Terminal', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';

    try {
      setTelemetryUserId('user-123');
      trackEvent('sync.pull.completed', { entity: 'households', duration_ms: 42 });

      const postHogLine = consoleLog.mock.calls
        .map(([value]) => value)
        .find((value): value is string => hasPostHogOperation(value, 'capture'));
      const terminalPayload = JSON.parse(postHogLine?.slice(postHogLine.indexOf('{')) ?? '{}');

      expect(terminalPayload).toEqual(
        expect.objectContaining({
          event: 'sync.pull.completed',
          properties: expect.objectContaining({
            entity: 'households',
            duration_ms: 42,
            user_id: '[redacted]',
          }),
        }),
      );
      expect(capture.mock.calls[0][1]).toEqual(
        expect.objectContaining({ user_id: 'user-123', entity: 'households' }),
      );
      expect(postHogLine).not.toContain('user-123');
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('spiegelt PostHog-Fehlerberichte und Diagnoseschritte ins Dev-Terminal', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';

    try {
      reportError(new Error('Fehler für marco@example.com'), {
        operation: 'sync.pull',
        user_id: 'user-123',
      });
      addDiagnosticStep('route.changed', { route: '/settings', user_id: 'user-123' });

      const captureExceptionLine = consoleLog.mock.calls
        .map(([value]) => value)
        .find((value): value is string => hasPostHogOperation(value, 'capture-exception'));
      const captureExceptionPayload = JSON.parse(
        captureExceptionLine?.slice(captureExceptionLine.indexOf('{')) ?? '{}',
      );
      const addExceptionStepLine = consoleLog.mock.calls
        .map(([value]) => value)
        .find((value): value is string => hasPostHogOperation(value, 'add-exception-step'));
      const addExceptionStepPayload = JSON.parse(
        addExceptionStepLine?.slice(addExceptionStepLine.indexOf('{')) ?? '{}',
      );

      expect(captureExceptionPayload).toEqual(
        expect.objectContaining({
          event: 'error.occurred',
          properties: expect.objectContaining({ user_id: '[redacted]' }),
        }),
      );
      expect(addExceptionStepPayload).toEqual(
        expect.objectContaining({
          step: 'route.changed',
          properties: expect.objectContaining({ user_id: '[redacted]' }),
        }),
      );
      expect(consoleLog.mock.calls.flat().join(' ')).not.toContain('marco@example.com');
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('spiegelt behandelte Fehler zu Sentry, PostHog und Aptabase', () => {
    const error = Object.assign(new Error('JWT liegt in der Zukunft'), {
      code: 'jwt_issued_in_future',
    });

    reportError(error, { operation: 'sync.pull', entity: 'households' });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
    expect(captureException).toHaveBeenCalledWith(error, expect.any(Object));
    expect(trackAptabaseError).toHaveBeenCalledWith(error);
    expect(capture).toHaveBeenCalledWith(
      'error.occurred',
      expect.objectContaining({
        error_code: 'jwt_issued_in_future',
        error_id: expect.any(String),
        error_message: 'JWT liegt in der Zukunft',
        outcome: 'failed',
      }),
    );
    expect(trackAptabaseEvent).toHaveBeenCalledWith(
      'error.occurred',
      capture.mock.calls.at(-1)?.[1],
    );
  });

  it('spiegelt Warnungen zu Sentry, PostHog und Aptabase', () => {
    reportWarning('Pull ist fehlgeschlagen', {
      operation: 'sync.pull',
      error_code: 'sync_pull_failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Pull ist fehlgeschlagen',
      expect.any(Object),
    );
    expect(capture).toHaveBeenCalledWith(
      'warning.occurred',
      expect.objectContaining({
        error_code: 'sync_pull_failed',
        operation: 'sync.pull',
        outcome: 'warning',
      }),
    );
    expect(trackAptabaseEvent).toHaveBeenCalledWith(
      'warning.occurred',
      capture.mock.calls.at(-1)?.[1],
    );
  });

  it('spricht Aptabase und PostHog unabhaengig an', () => {
    useAnalyticsSettingsStore.getState().setOverride('providers.aptabase', false);

    trackEvent('sync.pull.completed', { entity: 'households' });

    expect(trackAptabaseEvent).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith('sync.pull.completed', expect.any(Object));

    useAnalyticsSettingsStore.getState().setOverride('providers.aptabase', null);
    useAnalyticsSettingsStore.getState().setOverride('providers.aptabase', true);
    useAnalyticsSettingsStore.getState().setOverride('providers.posthog', false);
    jest.clearAllMocks();

    trackEvent('sync.pull.completed', { entity: 'households' });

    expect(trackAptabaseEvent).toHaveBeenCalledWith('sync.pull.completed', expect.any(Object));
    expect(capture).not.toHaveBeenCalled();
  });

  it('trennt Produkt-, Fehler- und Diagnosekanaele', () => {
    const store = useAnalyticsSettingsStore.getState();
    store.setOverride('channels.productEvents', false);
    trackEvent('recipe.create.completed', {}, 'productEvents');
    expect(trackAptabaseEvent).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();

    store.setOverride('channels.productEvents', null);
    store.setOverride('channels.diagnostics', false);
    addDiagnosticStep('route.changed', { route: '/settings' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(trackAptabaseEvent).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();

    store.setOverride('channels.diagnostics', null);
    store.setOverride('channels.errorReports', false);
    reportError(new Error('Testfehler'));
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(trackAptabaseError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalledWith('error.occurred', expect.any(Object));
  });

  it('markiert blockierte Produkt-Events im Dev-Terminal als Produktkanal', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';

    try {
      useAnalyticsSettingsStore.getState().setOverride('features.shoppingList', false);

      trackEvent('shopping_item.create.completed', {}, 'productEvents');

      expect(consoleLog).toHaveBeenCalledWith(
        '\u001b[38;5;42m[Produkt]\u001b[0m shopping_item.create.completed (blocked) → keine',
      );
      expect(capture).not.toHaveBeenCalled();
      expect(trackAptabaseEvent).not.toHaveBeenCalled();
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('zeigt aktive Analytics-Ziele in der farbigen Kanalzeile', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';

    try {
      trackEvent('sync.pull.completed', { entity: 'households' });

      expect(consoleLog).toHaveBeenCalledWith(
        '\u001b[38;5;220m[Diagnose]\u001b[0m sync.pull.completed → PostHog, Aptabase',
      );
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('misst erfolgreiche Operationen mit einer gemeinsamen Korrelation', async () => {
    await expect(measureOperation('db.open', async () => 'ready')).resolves.toBe('ready');

    expect(capture.mock.calls.map(([name]) => name)).toEqual([
      'db.open.started',
      'db.open.completed',
    ]);
    expect(capture.mock.calls[0][1].correlation_id).toBe(capture.mock.calls[1][1].correlation_id);
  });

  it('meldet laufende Operationen nach einer und zwei Sekunden als langsam und haengend', async () => {
    jest.useFakeTimers();
    let complete!: () => void;
    const pending = measureOperation(
      'sync.pull',
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );

    await jest.advanceTimersByTimeAsync(1_000);
    expect(capture).toHaveBeenCalledWith(
      'operation.slow',
      expect.objectContaining({ operation: 'sync.pull', duration_ms: 1_000 }),
    );

    await jest.advanceTimersByTimeAsync(1_000);
    expect(capture).toHaveBeenCalledWith(
      'operation.hanging',
      expect.objectContaining({ operation: 'sync.pull', duration_ms: 2_000 }),
    );

    complete();
    await pending;
  });
});
