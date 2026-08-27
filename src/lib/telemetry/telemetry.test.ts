import { trackAptabaseError, trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { Sentry } from '@/lib/sentry';
import {
  measureOperation,
  reportError,
  reportWarning,
  setTelemetryUserId,
  trackEvent,
} from '@/lib/telemetry';

jest.mock('@/lib/analytics/aptabase', () => ({
  trackAptabaseError: jest.fn(),
  trackAptabaseEvent: jest.fn(),
}));

jest.mock('@/lib/posthog', () => ({
  getPostHogClient: jest.fn(),
  isPostHogConfigured: jest.fn(),
}));

jest.mock('@/lib/sentry', () => ({
  Sentry: {
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}));

describe('telemetry fan-out', () => {
  const capture = jest.fn();
  const captureException = jest.fn();
  const addExceptionStep = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setTelemetryUserId(null);
    (isPostHogConfigured as jest.Mock).mockReturnValue(true);
    (getPostHogClient as jest.Mock).mockReturnValue({
      capture,
      captureException,
      addExceptionStep,
    });
  });

  afterEach(() => {
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
