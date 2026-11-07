import { json } from '../_shared/http.ts';

export const AI_CREDIT_LIMIT = 100;

type StatusRow = {
  credits_used: unknown;
  credits_remaining: unknown;
  credit_limit: unknown;
  warning_reached: unknown;
  blocked: unknown;
};

export type AiCreditStatus = {
  householdId: string;
  creditsUsed: number;
  creditsRemaining: number;
  creditLimit: number;
  warningReached: boolean;
  blocked: boolean;
};

type AuthenticationResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401; error: 'unauthorized' };

type HouseholdIdsResult =
  | { ok: true; householdIds: string[] }
  | { ok: false };

type ReadStatusResult =
  | { ok: true; row: StatusRow }
  | { ok: false };

type Dependencies = {
  authenticate: (authorization: string, requestId: string) => Promise<AuthenticationResult>;
  listHouseholdIds: (
    userId: string,
    authorization: string,
    requestId: string,
  ) => Promise<HouseholdIdsResult>;
  readStatus: (householdId: string, requestId: string) => Promise<ReadStatusResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyObject(value: unknown): value is Record<string, never> {
  return isRecord(value) && Object.keys(value).length === 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function mapAiCreditStatus(householdId: string, value: unknown): AiCreditStatus | null {
  if (!isRecord(value)) return null;
  const row = value as Partial<StatusRow>;
  if (
    !isNonNegativeInteger(row.credits_used) ||
    !isNonNegativeInteger(row.credits_remaining) ||
    row.credit_limit !== AI_CREDIT_LIMIT ||
    typeof row.warning_reached !== 'boolean' ||
    typeof row.blocked !== 'boolean'
  ) {
    return null;
  }

  return {
    householdId,
    creditsUsed: row.credits_used,
    creditsRemaining: row.credits_remaining,
    creditLimit: row.credit_limit,
    warningReached: row.warning_reached,
    blocked: row.blocked,
  };
}

async function readEmptyBody(request: Request): Promise<boolean> {
  try {
    return isEmptyObject(await request.json());
  } catch {
    return false;
  }
}

/**
 * Returns the credit status for every household visible to the authenticated user.
 * The request body is intentionally empty: household scope comes from the JWT and
 * the server-side membership query, never from client input.
 */
export function createAiCreditStatusHandler(dependencies: Dependencies) {
  return async (
    request: Request,
    requestId: string = crypto.randomUUID(),
  ): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'missing_authorization' }, 401);

    if (!(await readEmptyBody(request))) return json({ error: 'invalid_request' }, 400);

    let authentication: AuthenticationResult;
    try {
      authentication = await dependencies.authenticate(authorization, requestId);
    } catch {
      return json({ error: 'unauthorized' }, 401);
    }
    if (!authentication.ok) return json({ error: authentication.error }, authentication.status);

    let householdIds: HouseholdIdsResult;
    try {
      householdIds = await dependencies.listHouseholdIds(
        authentication.userId,
        authorization,
        requestId,
      );
    } catch {
      return json({ error: 'household_lookup_failed' }, 500);
    }
    if (!householdIds.ok) return json({ error: 'household_lookup_failed' }, 500);

    const uniqueHouseholdIds = Array.from(new Set(householdIds.householdIds));
    const statuses = await Promise.all(
      uniqueHouseholdIds.map(async (householdId) => {
        try {
          const result = await dependencies.readStatus(householdId, requestId);
          if (!result.ok) return null;
          return mapAiCreditStatus(householdId, result.row);
        } catch {
          return null;
        }
      }),
    );

    if (statuses.some((status) => status === null)) {
      return json({ error: 'household_status_unavailable' }, 500);
    }

    return json({ households: statuses });
  };
}
