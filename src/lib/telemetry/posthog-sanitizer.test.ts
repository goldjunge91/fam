import {
  getSafeErrorCode,
  sanitizePostHogError,
  sanitizePostHogProperties,
} from '@/lib/telemetry/posthog-sanitizer';

describe('PostHog payload sanitizer', () => {
  it('removes identity, household, error text, URL and UUID properties', () => {
    expect(
      sanitizePostHogProperties({
        email: 'person@example.com',
        error_message: 'request https://example.com/private',
        household_id: 'household-123',
        route: '/recipe/123',
        safe_code: 'sync_failed',
        safe_number: 42,
        user_id: 'user-123',
        uuid_value: '123e4567-e89b-12d3-a456-426614174000',
      }),
    ).toEqual({ safe_code: 'sync_failed', safe_number: 42 });
  });

  it('keeps safe static screen names and technical values', () => {
    expect(
      sanitizePostHogProperties({
        operation: 'sync.pull',
        screen: 'settings_privacy',
        source: 'sync_settings',
        timestamp: 123,
      }),
    ).toEqual({
      operation: 'sync.pull',
      screen: 'settings_privacy',
      source: 'sync_settings',
      timestamp: 123,
    });
  });

  it('normalizes error codes and never forwards the original error message', () => {
    const original = Object.assign(new Error('email person@example.com'), {
      code: 'sync_failed',
    });
    const safeError = sanitizePostHogError(original);

    expect(getSafeErrorCode(original)).toBe('sync_failed');
    expect(safeError).toEqual(expect.any(Error));
    expect(safeError.name).toBe('TelemetryError');
    expect(safeError.message).toBe('telemetry_error:sync_failed');
    expect(safeError.message).not.toContain('person@example.com');
  });

  it('verwendet einen sicheren Fallback für unbrauchbare Fehlercodes', () => {
    expect(getSafeErrorCode({ code: 'https://example.com/secret' })).toBe('unknown_error');
    expect(getSafeErrorCode(new Error('private message'))).toBe('unknown_error');
  });
});
