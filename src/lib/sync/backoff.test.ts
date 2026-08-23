import { backoffDelayMs, classifyError, MAX_ATTEMPTS } from '@/lib/sync/backoff';

describe('backoffDelayMs', () => {
  it('waechst monoton', () => {
    const delays = [0, 1, 2, 3, 4].map(backoffDelayMs);

    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('deckelt die Wartezeit, statt sie unbegrenzt wachsen zu lassen', () => {
    expect(backoffDelayMs(99)).toBe(backoffDelayMs(4));
  });

  it('wartet auch beim allerersten Fehlversuch schon etwas', () => {
    expect(backoffDelayMs(0)).toBeGreaterThan(0);
  });

  it('behandelt negative Eingaben wie den ersten Versuch', () => {
    expect(backoffDelayMs(-1)).toBe(backoffDelayMs(0));
  });

  it('gibt fuer jeden Versuch bis MAX_ATTEMPTS eine Wartezeit', () => {
    for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts += 1) {
      expect(backoffDelayMs(attempts)).toBeGreaterThan(0);
    }
  });
});

describe('classifyError', () => {
  it('haelt einen Fehler ohne HTTP-Status fuer voruebergehend', () => {
    expect(classifyError(null)).toBe('transient');
  });

  it.each([500, 502, 503, 504])('haelt %i fuer voruebergehend', (status) => {
    expect(classifyError(status)).toBe('transient');
  });

  it.each([408, 429])('haelt %i fuer voruebergehend', (status) => {
    expect(classifyError(status)).toBe('transient');
  });

  it.each([400, 401, 403, 404, 409, 422])('haelt %i fuer dauerhaft', (status) => {
    expect(classifyError(status)).toBe('permanent');
  });
});
