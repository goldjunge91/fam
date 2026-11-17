import { createImportAuthorizer, fetchWithRetry } from '../tools/batch-import/import-safety';

describe('batch import safety', () => {
  it('accepts one approved target token only once', () => {
    const authorize = createImportAuthorizer({
      RECIPE_IMPORT_TOKEN: 'one-time-token',
      RECIPE_IMPORT_ALLOWED_TARGET: 'https://recipes.example.test',
    });
    const request = () =>
      new Request('http://127.0.0.1/api/import', {
        headers: { 'x-recipe-import-token': 'one-time-token' },
      });

    expect(
      authorize(new Request('http://127.0.0.1/api/import'), 'https://recipes.example.test'),
    ).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(authorize(request(), 'https://recipes.example.test')).toEqual({
      ok: true,
      approvedTarget: 'https://recipes.example.test',
    });
    expect(authorize(request(), 'https://recipes.example.test')).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(authorize(request(), 'https://other.example.test')).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('does not replay an accepted write after a timeout', async () => {
    let calls = 0;
    const acceptedThenTimedOut: typeof fetch = async () => {
      calls += 1;
      throw new Error('The request timed out after the remote write was accepted');
    };

    await expect(
      fetchWithRetry(
        'https://recipes.example.test/rest/v1/catalog_recipe_components',
        { method: 'POST' },
        acceptedThenTimedOut,
      ),
    ).rejects.toThrow('remote write was accepted');
    expect(calls).toBe(1);
  });
});
