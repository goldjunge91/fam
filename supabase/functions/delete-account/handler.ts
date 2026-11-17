import { json } from '../_shared/http.ts';

export type DbError = { message: string; code?: string };
export type AnalyticsDeletionResult = { status: 'not_found' | 'accepted' | 'verified' };

export const LAST_ADMIN_SQLSTATE = 'FAM01';

function isDbError(value: unknown): value is DbError {
  return typeof value === 'object' && value !== null && 'message' in value &&
    typeof value.message === 'string';
}

function isAnalyticsResult(value: unknown): value is AnalyticsDeletionResult {
  return typeof value === 'object' && value !== null && 'status' in value &&
    (value.status === 'not_found' || value.status === 'accepted' || value.status === 'verified');
}

type Dependencies = {
  getUserId: (authorization: string) => Promise<string | null>;
  prepareDeletion: (authorization: string) => Promise<DbError | null>;
  deleteAnalyticsData: (userId: string) => Promise<DbError | AnalyticsDeletionResult>;
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
        : json({ error: 'prepare_failed' }, 500);
    }

    // Remove third-party analytics data before deleting the identity that owns it.
    const analyticsResult = await deleteAnalyticsData(userId);
    if (isDbError(analyticsResult)) {
      console.error(JSON.stringify({
        event: 'delete_account_analytics_failed',
        provider: 'posthog',
        code: analyticsResult.code ?? null,
      }));
      return json({ error: 'analytics_delete_failed' }, 502);
    }
    if (!isAnalyticsResult(analyticsResult)) {
      console.error(JSON.stringify({
        event: 'delete_account_analytics_failed',
        provider: 'posthog',
        code: 'analytics_invalid_result',
      }));
      return json({ error: 'analytics_delete_failed' }, 502);
    }
    if (analyticsResult.status === 'accepted') {
      return json({ error: 'analytics_delete_pending' }, 425);
    }

    // Use the service role only after user-scoped and third-party cleanup succeeds.
    const deleteError = await deleteUser(userId);
    if (deleteError) return json({ error: 'delete_failed' }, 500);

    return json({ success: true, analyticsDeletion: analyticsResult.status });
  };
}
