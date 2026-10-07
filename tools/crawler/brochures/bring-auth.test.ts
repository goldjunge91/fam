import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { authenticateBring } from '../../../scripts/bring-auth';

describe('authenticateBring', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.BRING_EMAIL;
    delete process.env.BRING_PASSWORD;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('bricht ab, wenn weder E-Mail noch Passwort übergeben wurden', async () => {
    await expect(authenticateBring('', '')).rejects.toThrow(
      'Bring-Authentifizierung fehlgeschlagen: BRING_EMAIL und BRING_PASSWORD müssen gesetzt sein',
    );
  });

  it('gibt Token, userUuid und API-Key bei erfolgreichem Login zurück', async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token',
          uuid: 'mock-user-uuid',
          refresh_token: 'mock-refresh-token',
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const result = await authenticateBring('user@test.com', 'secret');

    expect(result).toEqual({
      token: 'mock-access-token',
      userUuid: 'mock-user-uuid',
      apiKey: 'cof4Nc6D8saplXjE3h3HXqHH8m7VU2i1Gs0g85Sp',
    });
  });

  it('wirft einen aussagekräftigen Fehler bei ungültigen Zugangsdaten (401)', async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({
          message: 'email password combination not existing',
          error: 'unauthorized',
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await expect(authenticateBring('user@test.com', 'wrong')).rejects.toThrow(
      'Bring-Login fehlgeschlagen (HTTP 401): email password combination not existing',
    );
  });
});
