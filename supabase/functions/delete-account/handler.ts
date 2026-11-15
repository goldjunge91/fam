import { errorResponse, json } from '../_shared/http.ts';

export type DbError = { message: string; code?: string };

export const LAST_ADMIN_SQLSTATE = 'FAM01';

type Dependencies = {
  getUserId: (authorization: string) => Promise<string | null>;
  prepareDeletion: (authorization: string) => Promise<DbError | null>;
  deleteAnalyticsData: (userId: string) => Promise<DbError | null>;
  deleteUser: (userId: string) => Promise<DbError | null>;
};

export function createDeleteAccountHandler(
  { getUserId, prepareDeletion, deleteAnalyticsData, deleteUser }: Dependencies,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'missing_authorization' }, 401);

    const userId = await getUserId(authorization);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    // Prepare under the user token so the RPC can rely on auth.uid().
    const prepareError = await prepareDeletion(authorization);
    if (prepareError) {
      return prepareError.code === LAST_ADMIN_SQLSTATE
        ? json({ error: 'last_admin_with_members' }, 409)
        : errorResponse('prepare_failed', 500, prepareError);
    }

    // Remove third-party analytics data before deleting the identity that owns it.
    const analyticsError = await deleteAnalyticsData(userId);
    if (analyticsError) return errorResponse('analytics_delete_failed', 502);

    // Use the service role only after user-scoped and third-party cleanup succeeds.
    const deleteError = await deleteUser(userId);
    if (deleteError) return errorResponse('delete_failed', 500, deleteError);

    return json({ success: true });
  };
}
