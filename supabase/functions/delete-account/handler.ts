import { json } from '../_shared/http.ts';

export type DbError = { message: string; code?: string };

export const LAST_ADMIN_SQLSTATE = 'FAM01';

type Dependencies = {
  getUserId: (authorization: string) => Promise<string | null>;
  prepareDeletion: (authorization: string) => Promise<DbError | null>;
  deleteUser: (userId: string) => Promise<DbError | null>;
};

export function createDeleteAccountHandler(
  { getUserId, prepareDeletion, deleteUser }: Dependencies,
) {
  return async (
    req: Request,
    requestId: string = crypto.randomUUID(),
  ): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'missing_authorization' }, 401);

    const userId = await getUserId(authorization);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    // Prepare under the user token so the RPC can rely on auth.uid().
    const prepareError = await prepareDeletion(authorization);
    if (prepareError) {
      if (prepareError.code !== LAST_ADMIN_SQLSTATE) {
        console.error(JSON.stringify({
          event: 'delete_account_prepare_failed',
          requestId,
          databaseErrorCode: prepareError.code ?? null,
        }));
      }
      return prepareError.code === LAST_ADMIN_SQLSTATE
        ? json({ error: 'last_admin_with_members' }, 409)
        : json({ error: 'prepare_failed' }, 500);
    }

    // Use the service role only after the user-scoped cleanup succeeds.
    const deleteError = await deleteUser(userId);
    if (deleteError) {
      console.error(JSON.stringify({
        event: 'delete_account_delete_failed',
        requestId,
        databaseErrorCode: deleteError.code ?? null,
      }));
      return json({ error: 'delete_failed' }, 500);
    }

    return json({ success: true });
  };
}
