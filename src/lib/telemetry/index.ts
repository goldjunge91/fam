import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { trackAptabaseError, trackAptabaseEvent } from '@/lib/analytics/aptabase';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { Sentry } from '@/lib/sentry';
import {
  HANGING_OPERATION_THRESHOLD_MS,
  SLOW_OPERATION_THRESHOLD_MS,
  TELEMETRY_EVENTS,
  type TelemetryEventName,
  type TelemetryProperties,
  type TelemetryValue,
} from './schema';
import { recordSessionOperation } from './session-diagnostics';

let activeUserId: string | undefined;
let correlationSequence = 0;

function createCorrelationId(now = Date.now()): string {
  correlationSequence = (correlationSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${now.toString(36)}-${correlationSequence.toString(36)}`;
}

function eventOperation(name: string): string {
  const segments = name.split('.');
  return segments.length >= 3 ? segments.slice(0, -1).join('.') : name;
}

function eventOutcome(name: string): string {
  const segments = name.split('.');
  return segments.length >= 3 ? (segments.at(-1) ?? 'occurred') : 'occurred';
}

function errorDetails(error: unknown): { error_code: string; error_message: string } {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      error_code: typeof code === 'string' || typeof code === 'number' ? String(code) : error.name,
      error_message: error.message,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const value = error as { code?: unknown; message?: unknown };
    return {
      error_code:
        typeof value.code === 'string' || typeof value.code === 'number'
          ? String(value.code)
          : 'unknown_error',
      error_message:
        typeof value.message === 'string' ? value.message : 'Unbekannter Fehler ohne Nachricht',
    };
  }

  return { error_code: 'unknown_error', error_message: String(error) };
}

function commonProperties(
  name: TelemetryEventName,
  properties: TelemetryProperties = {},
): TelemetryProperties {
  const now = Date.now();
  const base: TelemetryProperties = {
    correlation_id: properties.correlation_id ?? createCorrelationId(now),
    operation: properties.operation ?? eventOperation(name),
    outcome: properties.outcome ?? eventOutcome(name),
    timestamp: properties.timestamp ?? now,
    platform: Platform.OS,
  };

  const appVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  const buildNumber = Constants.nativeBuildVersion;

  if (appVersion) base.app_version = appVersion;
  if (buildNumber) base.build_number = buildNumber;
  if (activeUserId) base.user_id = activeUserId;

  return { ...base, ...properties };
}

function captureEvent(name: TelemetryEventName, properties: TelemetryProperties): void {
  recordSessionOperation(String(properties.operation ?? name));
  try {
    trackAptabaseEvent(name, properties);
  } catch (error) {
    if (__DEV__) console.warn(`[telemetry] Aptabase-Event "${name}" fehlgeschlagen:`, error);
  }

  try {
    if (isPostHogConfigured()) getPostHogClient()?.capture(name, properties);
  } catch (error) {
    if (__DEV__) console.warn(`[telemetry] PostHog-Event "${name}" fehlgeschlagen:`, error);
  }
}

export function setTelemetryUserId(userId: string | null | undefined): void {
  activeUserId = userId ?? undefined;
}

export function normalizeTelemetryValue(value: string | number | boolean): TelemetryValue {
  return typeof value === 'boolean' ? Number(value) : value;
}

export function normalizeTelemetryProperties(
  properties: Record<string, string | number | boolean>,
): TelemetryProperties {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, normalizeTelemetryValue(value)]),
  );
}

export function trackEvent(name: TelemetryEventName, properties: TelemetryProperties = {}): void {
  captureEvent(name, commonProperties(name, properties));
}

export function reportError(error: unknown, context: TelemetryProperties = {}): void {
  const details = errorDetails(error);
  const errorId = context.error_id ?? createCorrelationId();
  const properties = commonProperties(TELEMETRY_EVENTS.errorOccurred, {
    ...details,
    ...context,
    error_id: errorId,
    correlation_id: context.correlation_id ?? errorId,
    outcome: 'failed',
  });

  try {
    Sentry.captureException(error, {
      tags: {
        telemetry_event: TELEMETRY_EVENTS.errorOccurred,
        correlation_id: properties.correlation_id,
        error_code: properties.error_code,
        operation: properties.operation,
      },
      extra: properties,
    });
  } catch (reportingError) {
    if (__DEV__) console.warn('[telemetry] Sentry-Fehlerbericht fehlgeschlagen:', reportingError);
  }

  try {
    if (isPostHogConfigured()) getPostHogClient()?.captureException(error, properties);
  } catch (reportingError) {
    if (__DEV__) console.warn('[telemetry] PostHog-Fehlerbericht fehlgeschlagen:', reportingError);
  }

  try {
    trackAptabaseError(error);
  } catch (reportingError) {
    if (__DEV__) console.warn('[telemetry] Aptabase-Fehlerbericht fehlgeschlagen:', reportingError);
  }

  captureEvent(TELEMETRY_EVENTS.errorOccurred, properties);
}

export function reportWarning(message: string, context: TelemetryProperties = {}): void {
  const properties = commonProperties(TELEMETRY_EVENTS.warningOccurred, {
    ...context,
    error_message: message,
    outcome: 'warning',
  });

  try {
    Sentry.captureMessage(message, {
      level: 'warning',
      tags: {
        telemetry_event: TELEMETRY_EVENTS.warningOccurred,
        correlation_id: properties.correlation_id,
        operation: properties.operation,
      },
      extra: properties,
    });
  } catch (reportingError) {
    if (__DEV__) console.warn('[telemetry] Sentry-Warnung fehlgeschlagen:', reportingError);
  }

  captureEvent(TELEMETRY_EVENTS.warningOccurred, properties);
}

export function addDiagnosticStep(
  name: TelemetryEventName,
  context: TelemetryProperties = {},
): void {
  const properties = commonProperties(name, context);

  try {
    Sentry.addBreadcrumb({
      category: 'diagnostic',
      message: name,
      level: 'info',
      data: properties,
    });
  } catch (reportingError) {
    if (__DEV__) console.warn('[telemetry] Sentry-Breadcrumb fehlgeschlagen:', reportingError);
  }

  try {
    if (isPostHogConfigured()) getPostHogClient()?.addExceptionStep(name, properties);
  } catch (reportingError) {
    if (__DEV__)
      console.warn('[telemetry] PostHog-Diagnoseschritt fehlgeschlagen:', reportingError);
  }

  captureEvent(name, properties);
}

function reportOperationDuration(
  operation: string,
  durationMs: number,
  context: TelemetryProperties,
  alreadyReported: { hanging: boolean; slow: boolean },
): void {
  const properties = { ...context, operation, duration_ms: durationMs };
  if (durationMs >= HANGING_OPERATION_THRESHOLD_MS && !alreadyReported.hanging) {
    trackEvent(TELEMETRY_EVENTS.operationHanging, properties);
  }
  if (durationMs >= SLOW_OPERATION_THRESHOLD_MS && !alreadyReported.slow) {
    trackEvent(TELEMETRY_EVENTS.operationSlow, properties);
  }
}

export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T> | T,
  context: TelemetryProperties = {},
): Promise<T> {
  const startedAt = Date.now();
  const correlationId = context.correlation_id ?? createCorrelationId(startedAt);
  const shared = { ...context, correlation_id: correlationId, operation: name };
  let completed = false;
  const durationReported = { hanging: false, slow: false };
  const slowTimer = setTimeout(() => {
    if (!completed) {
      durationReported.slow = true;
      trackEvent(TELEMETRY_EVENTS.operationSlow, {
        ...shared,
        duration_ms: SLOW_OPERATION_THRESHOLD_MS,
      });
    }
  }, SLOW_OPERATION_THRESHOLD_MS);
  const hangingTimer = setTimeout(() => {
    if (!completed) {
      durationReported.hanging = true;
      trackEvent(TELEMETRY_EVENTS.operationHanging, {
        ...shared,
        duration_ms: HANGING_OPERATION_THRESHOLD_MS,
      });
    }
  }, HANGING_OPERATION_THRESHOLD_MS);

  trackEvent(`${name}.started`, { ...shared, outcome: 'started' });
  try {
    const result = await operation();
    const durationMs = Date.now() - startedAt;
    trackEvent(`${name}.completed`, {
      ...shared,
      outcome: 'completed',
      duration_ms: durationMs,
    });
    reportOperationDuration(name, durationMs, shared, durationReported);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const details = errorDetails(error);
    trackEvent(`${name}.failed`, {
      ...shared,
      ...details,
      outcome: 'failed',
      duration_ms: durationMs,
    });
    reportError(error, { ...shared, ...details, duration_ms: durationMs });
    reportOperationDuration(name, durationMs, shared, durationReported);
    throw error;
  } finally {
    completed = true;
    clearTimeout(slowTimer);
    clearTimeout(hangingTimer);
  }
}

export type { TelemetryEventName, TelemetryProperties, TelemetryValue } from './schema';
