import { env } from '../config/env';

type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';
type DebugValue = string | number | boolean | null | DebugValue[] | { [key: string]: DebugValue };

const REDACTED_VALUE = '[redacted]';
const POSTHOG_COLOR = '\u001b[38;5;203m';
const BLUE_COLOR = '\u001b[38;5;39m';
const COLOR_RESET = '\u001b[0m';
const TELEMETRY_CHANNEL_STYLES: Record<string, { label: string; color: string }> = {
  productEvents: { label: 'Produkt', color: '\u001b[38;5;42m' },
  errorReports: { label: 'Fehler', color: '\u001b[38;5;196m' },
  diagnostics: { label: 'Diagnose', color: '\u001b[38;5;220m' },
  info: { label: 'Information', color: '\u001b[38;5;110m]' },
};
const SENSITIVE_KEY_PATTERN =
  /(?:token|secret|password|api.?key|authorization|cookie|email|phone|user.?id|error.?message|stack)/iu;
const SENSITIVE_STRING_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  /\beyJ[A-Z0-9_-]*\.[A-Z0-9_-]+\.[A-Z0-9_-]+\b/giu,
  /\bBearer\s+[A-Z0-9._-]+/giu,
];

function canWriteDebugLogs(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && env.debugLogsEnabled;
}

function sanitizeString(value: string): string {
  return SENSITIVE_STRING_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, REDACTED_VALUE),
    value,
  );
}

function sanitizeValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth: number,
): DebugValue {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return REDACTED_VALUE;
  if (value === null) return null;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (depth >= 5) return '[truncated]';

  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
    };
  }

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, undefined, seen, depth + 1));
  }

  const objectValue: { [key: string]: DebugValue } = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    objectValue[entryKey] = sanitizeValue(entryValue, entryKey, seen, depth + 1);
  }
  return objectValue;
}

function isDebugRecord(value: DebugValue): value is { [key: string]: DebugValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatDebugValue(value: DebugValue): string {
  return JSON.stringify(value);
}

function hasDebugPayload(value: DebugValue): boolean {
  return (
    !(Array.isArray(value) && value.length === 0) &&
    !(isDebugRecord(value) && Object.keys(value).length === 0)
  );
}

function formatDebugPayload(value: DebugValue): string {
  return hasDebugPayload(value) ? ` ${formatDebugValue(value)}` : '';
}

function formatProviderMessage(message: string): string {
  if (message.startsWith('[RevenueCat]')) {
    return `${BLUE_COLOR}[RevenueCat]${COLOR_RESET}${message.slice('[RevenueCat]'.length)}`;
  }
  if (message.startsWith('[Purchases]')) {
    return `${BLUE_COLOR}[Purchases]${COLOR_RESET}${message.slice('[Purchases]'.length)}`;
  }
  if (message.startsWith('[HouseholdSync]')) {
    return `${BLUE_COLOR}[HouseholdSync]${COLOR_RESET}${message.slice('[HouseholdSync]'.length)}`;
  }
  return message;
}

function formatTelemetryRecord(event: string, details: DebugValue | undefined): string | undefined {
  if (!event.startsWith('telemetry.')) return undefined;

  const style = TELEMETRY_CHANNEL_STYLES[event.slice('telemetry.'.length)];
  if (
    !style ||
    details === undefined ||
    !isDebugRecord(details) ||
    typeof details.event !== 'string'
  ) {
    return undefined;
  }

  const status = details.status === 'blocked' ? ' (blocked)' : '';
  const destinations = Array.isArray(details.destinations)
    ? details.destinations.filter((value): value is string => typeof value === 'string')
    : [];
  const destinationSuffix = Array.isArray(details.destinations)
    ? ` → ${destinations.length > 0 ? destinations.join(', ') : 'keine'}`
    : '';
  return `${style.color}[${style.label}]${COLOR_RESET} ${details.event}${status}${destinationSuffix}`;
}

function formatDebugRecord(record: DebugValue): string {
  if (isDebugRecord(record)) {
    if (typeof record.message === 'string') {
      return record.args === undefined || !Array.isArray(record.args) || record.args.length === 0
        ? formatProviderMessage(record.message)
        : `${formatProviderMessage(record.message)}${formatDebugPayload(record.args.length === 1 ? record.args[0] : record.args)}`;
    }

    if (typeof record.event === 'string') {
      const telemetryLine = formatTelemetryRecord(record.event, record.details);
      if (telemetryLine) return telemetryLine;

      const eventLabel = record.event.startsWith('posthog.')
        ? `${POSTHOG_COLOR}[PostHog]${COLOR_RESET} ${record.event.slice('posthog.'.length)}`
        : `[${record.event}]`;
      return record.details === undefined
        ? eventLabel
        : `${eventLabel}${formatDebugPayload(record.details)}`;
    }
  }

  return formatDebugValue(record);
}

function writeDebugRecord(level: DebugLogLevel, record: Record<string, unknown>): void {
  if (!canWriteDebugLogs()) return;

  const safeRecord = sanitizeValue(record, undefined, new WeakSet<object>(), 0);
  const line = formatDebugRecord(safeRecord);
  if (level === 'debug') console.log(line);
  else console[level](line);
}

export function debugLog(...args: unknown[]): void {
  const [first, ...rest] = args;
  writeDebugRecord('debug', {
    ...(typeof first === 'string' ? { message: first } : {}),
    ...(typeof first === 'string' ? { args: rest } : { args }),
  });
}

export function debugInfo(...args: unknown[]): void {
  const [message, ...rest] = args;
  writeDebugRecord('info', {
    ...(typeof message === 'string' ? { message } : {}),
    ...(typeof message === 'string' ? { args: rest } : { args }),
  });
}

export function debugWarn(...args: unknown[]): void {
  const [message, ...rest] = args;
  writeDebugRecord('warn', {
    ...(typeof message === 'string' ? { message } : {}),
    ...(typeof message === 'string' ? { args: rest } : { args }),
  });
}

export function debugError(...args: unknown[]): void {
  const [message, ...rest] = args;
  writeDebugRecord('error', {
    ...(typeof message === 'string' ? { message } : {}),
    ...(typeof message === 'string' ? { args: rest } : { args }),
  });
}

/** Schreibt ein lesbares, redigiertes Debug-Ereignis ins Dev-Terminal. */
export function debugLogEvent(event: string, details?: Record<string, unknown>): void {
  writeDebugRecord('debug', { event, details: details ?? {} });
}
