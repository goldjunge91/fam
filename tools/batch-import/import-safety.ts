type ImportEnvironment = {
  RECIPE_IMPORT_TOKEN?: string;
  RECIPE_IMPORT_ALLOWED_TARGET?: string;
};

type ImportAuthorization =
  | { ok: true; approvedTarget: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

export const createImportAuthorizer = (environment: ImportEnvironment) => {
  const expectedToken = environment.RECIPE_IMPORT_TOKEN?.trim();
  const approvedTarget = environment.RECIPE_IMPORT_ALLOWED_TARGET?.trim();
  const usedTokens = new Set<string>();

  return (request: Request, target: string): ImportAuthorization => {
    if (!expectedToken || !approvedTarget) {
      return {
        ok: false,
        status: 503,
        error: 'Import-Autorisierung ist nicht konfiguriert.',
      };
    }
    if (target !== approvedTarget) {
      return {
        ok: false,
        status: 403,
        error: 'Das konfigurierte Importziel ist nicht freigegeben.',
      };
    }

    const token = request.headers.get('x-recipe-import-token');
    if (!token || token !== expectedToken || usedTokens.has(token)) {
      return {
        ok: false,
        status: 401,
        error: 'Import-Autorisierung fehlt oder wurde bereits verwendet.',
      };
    }

    usedTokens.add(token);
    return { ok: true, approvedTarget };
  };
};

const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const fetchWithRetry = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  fetchImplementation: typeof fetch = fetch,
): Promise<Response> => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  const attempts = RETRYABLE_METHODS.has(method) ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchImplementation(input, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
};
