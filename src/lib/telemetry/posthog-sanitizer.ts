import type { TelemetryProperties } from './schema';

const SENSITIVE_PROPERTY_KEYS = new Set([
  'email',
  'error_message',
  'household_id',
  'password',
  'route',
  'secret',
  'stack',
  'token',
  'uri',
  'url',
  'user_id',
]);

const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const URL_PATTERN = /\b(?:https?|file|mailto):\/\//i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const SAFE_ERROR_CODE_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;

function isSensitiveValue(value: string): boolean {
  return EMAIL_PATTERN.test(value) || URL_PATTERN.test(value) || UUID_PATTERN.test(value);
}

export function sanitizePostHogProperties(properties: TelemetryProperties): TelemetryProperties {
  const sanitized: TelemetryProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (SENSITIVE_PROPERTY_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && isSensitiveValue(value)) continue;
    sanitized[key] = value;
  }

  return sanitized;
}

export function getSafeErrorCode(error: unknown): string {
  const candidate =
    error instanceof Error
      ? (error as Error & { code?: unknown }).code
      : typeof error === 'object' && error !== null
        ? (error as { code?: unknown }).code
        : undefined;
  const normalized =
    typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';

  return SAFE_ERROR_CODE_PATTERN.test(normalized) ? normalized : 'unknown_error';
}

export function sanitizePostHogError(error: unknown): Error {
  const safeError = new Error(`telemetry_error:${getSafeErrorCode(error)}`);
  safeError.name = 'TelemetryError';
  return safeError;
}
