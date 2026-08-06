import { clockCeiling, createServerClock, parseDateHeader } from '@/lib/sync/server-clock';

function fakeResponse(dateHeader: string | null): Response {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'date' ? dateHeader : null),
    },
  } as unknown as Response;
}

describe('parseDateHeader', () => {
  it('parst einen gueltigen HTTP-Date-Header', () => {
    const ms = parseDateHeader('Wed, 15 Jan 2025 10:30:00 GMT');
    expect(ms).toBe(Date.UTC(2025, 0, 15, 10, 30, 0));
  });

  it('liefert null bei fehlendem Header', () => {
    expect(parseDateHeader(null)).toBeNull();
  });

  it('liefert null bei kaputtem Header', () => {
    expect(parseDateHeader('das ist kein datum')).toBeNull();
  });
});

describe('createServerClock', () => {
  it('serverNowMs ist null, bevor je eine Antwort beobachtet wurde', () => {
    const clock = createServerClock(async () => fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT'));
    expect(clock.serverNowMs()).toBeNull();
  });

  it('merkt sich den Date-Header nach einem Fetch', async () => {
    const clock = createServerClock(async () => fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT'));
    await clock.fetch('https://example.test');
    expect(clock.serverNowMs()).toBe(Date.UTC(2025, 0, 15, 10, 30, 0));
  });

  it('aktualisiert sich bei jedem weiteren Fetch', async () => {
    const responses = [
      fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT'),
      fakeResponse('Wed, 15 Jan 2025 10:31:00 GMT'),
    ];
    let call = 0;
    const clock = createServerClock(async () => responses[call++]);

    await clock.fetch('https://example.test');
    await clock.fetch('https://example.test');

    expect(clock.serverNowMs()).toBe(Date.UTC(2025, 0, 15, 10, 31, 0));
  });

  it('behaelt den letzten gueltigen Wert, wenn eine spaetere Antwort keinen Date-Header hat', async () => {
    const responses = [fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT'), fakeResponse(null)];
    let call = 0;
    const clock = createServerClock(async () => responses[call++]);

    await clock.fetch('https://example.test');
    await clock.fetch('https://example.test');

    expect(clock.serverNowMs()).toBe(Date.UTC(2025, 0, 15, 10, 30, 0));
  });

  it('gibt die Response des zugrundeliegenden fetch unveraendert weiter', async () => {
    const response = fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT');
    const clock = createServerClock(async () => response);
    await expect(clock.fetch('https://example.test')).resolves.toBe(response);
  });
});

describe('clockCeiling', () => {
  it('nutzt die Serverzeit, sobald eine beobachtet wurde', async () => {
    const clock = createServerClock(async () => fakeResponse('Wed, 15 Jan 2025 10:30:00 GMT'));
    await clock.fetch('https://example.test');

    expect(clockCeiling(clock, Date.UTC(2099, 0, 1))).toBe(Date.UTC(2025, 0, 15, 10, 30, 0));
  });

  it('faellt auf fallbackNowMs zurueck, solange keine Serverzeit beobachtet wurde', () => {
    const clock = createServerClock(async () => fakeResponse(null));
    const fallback = Date.UTC(2024, 5, 1);

    expect(clockCeiling(clock, fallback)).toBe(fallback);
  });
});
