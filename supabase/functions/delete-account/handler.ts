export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...JSON_HEADERS, ...extraHeaders },
  });
}

export type AuthenticationResult =
  | { ok: true; user: { id: string } }
  | { ok: false; status: 401 | 500; error: string; message?: string };

export type RequestLimitResult = {
  allowed: boolean;
  retryAfter: number | null;
};

export type PrepareResult = {
  error: { message?: string } | null;
};

export type DeleteResult = {
  error: { message?: string } | null;
};

export type DeleteAccountDependencies = {
  authenticate: (authHeader: string | null) => Promise<AuthenticationResult>;
  checkRequestLimit: (userId: string) => Promise<RequestLimitResult>;
  prepareAccountDeletion: (userId: string, authHeader: string) => Promise<PrepareResult>;
  deleteUser: (userId: string) => Promise<DeleteResult>;
};

export function createDeleteAccountHandler(dependencies: DeleteAccountDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'missing_authorization' }, 401);
    }

    try {
      const auth = await dependencies.authenticate(authHeader);
      if (!auth.ok) {
        return json({ error: auth.error, ...(auth.message ? { message: auth.message } : {}) }, auth.status);
      }

      const { user } = auth;

      let limitResult: RequestLimitResult;
      try {
        limitResult = await dependencies.checkRequestLimit(user.id);
      } catch (err) {
        console.warn(JSON.stringify({
          event: 'delete_account_rate_limit_skipped',
          error: err instanceof Error ? err.message : String(err),
        }));
        limitResult = { allowed: true, retryAfter: null };
      }

      if (!limitResult.allowed) {
        const retryAfter = Math.max(1, limitResult.retryAfter ?? 60);
        return json(
          { error: 'rate_limited', message: 'Zu viele Anfragen. Bitte warte einen Moment.' },
          429,
          { 'Retry-After': String(retryAfter) },
        );
      }

      const prepareResult = await dependencies.prepareAccountDeletion(user.id, authHeader);
      if (prepareResult.error) {
        if (prepareResult.error.message?.includes('last_admin_with_members')) {
          return json(
            {
              error: 'last_admin_with_members',
              message:
                'Du bist der letzte Administrator eines Haushalts mit weiteren Mitgliedern. ' +
                'Übertrage die Administratorrolle oder lösche den Haushalt zuerst.',
            },
            409,
          );
        }

        console.error(JSON.stringify({
          event: 'delete_account_prepare_failed',
          userId: user.id,
          error: prepareResult.error.message,
        }));
        return json(
          { error: 'prepare_failed', message: 'Konto konnte nicht zur Löschung vorbereitet werden.' },
          500,
        );
      }

      const deleteResult = await dependencies.deleteUser(user.id);
      if (deleteResult.error) {
        console.error(JSON.stringify({
          event: 'delete_account_user_delete_failed',
          userId: user.id,
          error: deleteResult.error.message,
        }));
        return json({ error: 'delete_failed', message: 'Löschung fehlgeschlagen.' }, 500);
      }

      return json({ success: true }, 200);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'delete_account_unhandled_error',
        error: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: 'internal_error', message: 'Ein unerwarteter Fehler ist aufgetreten.' }, 500);
    }
  };
}
