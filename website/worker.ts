type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

type JsonRecord = Record<string, unknown>;

interface SupabaseConfig {
  url: string;
  publishableKey: string;
  secretKey?: string;
}

interface AuthUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  appMetadata: JsonRecord;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

interface ProfileRow {
  id: string;
  displayName: string | null;
  createdAt: string | null;
}

type CreditAction = 'suggestion' | 'recipe' | 'voice';

interface CreditBooking {
  subscriberUserId: string;
  requestId: string;
  action: CreditAction;
  credits: number;
}

interface CreditRefund {
  subscriberUserId: string;
  requestId: string;
}

interface UserCredits {
  suggestions: number;
  recipes: number;
  voice: number;
  total: number;
}

const PAGE_SIZE = 1000;
const AUTH_ROLE = 'supa-admin';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'Vary': 'Authorization',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function responseEmpty(status = 204): Response {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function configFrom(env: Env, includeSecret = false): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !publishableKey || (includeSecret && !secretKey)) return null;
  return { url, publishableKey, ...(secretKey ? { secretKey } : {}) };
}

async function readRequestJson(request: Request): Promise<JsonRecord | null> {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > 12_000) return null;
  try {
    const text = await request.text();
    if (text.length > 12_000) return null;
    const body: unknown = JSON.parse(text);
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    email: typeof value.email === 'string' ? value.email : null,
    createdAt: typeof value.created_at === 'string' ? value.created_at : null,
    appMetadata: isRecord(value.app_metadata) ? value.app_metadata : {},
  };
}

function parseAuthSession(value: unknown): AuthSession | null {
  if (!isRecord(value)) return null;
  const user = parseAuthUser(value.user);
  if (
    !user ||
    typeof value.access_token !== 'string' ||
    typeof value.refresh_token !== 'string' ||
    typeof value.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in)
  ) {
    return null;
  }
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresIn: value.expires_in,
    user,
  };
}

function sessionResponse(session: AuthSession): Response {
  return responseJson({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_in: session.expiresIn,
  });
}

function isSupaAdmin(user: AuthUser): boolean {
  return user.appMetadata.platform_role === AUTH_ROLE;
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get('Authorization');
  const match = value?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function requestSupabaseUser(
  config: SupabaseConfig,
  accessToken: string,
): Promise<AuthUser | null> {
  const response = await fetch(new URL('/auth/v1/user', config.url), {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return parseAuthUser(await readResponseJson(response));
}

async function endSupabaseSession(config: SupabaseConfig, accessToken: string): Promise<void> {
  await fetch(new URL('/auth/v1/logout', config.url), {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
}

async function signIn(request: Request, config: SupabaseConfig): Promise<Response> {
  if (!sameOrigin(request)) return responseJson({ error: 'forbidden' }, 403);
  const body = await readRequestJson(request);
  const email = body?.email;
  const password = body?.password;
  if (
    typeof email !== 'string' ||
    email.length > 320 ||
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > 4096
  ) {
    return responseJson({ error: 'invalid_request' }, 400);
  }

  const response = await fetch(new URL('/auth/v1/token?grant_type=password', config.url), {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
    cache: 'no-store',
  });
  if (!response.ok) return responseJson({ error: 'sign_in_failed' }, 401);

  const session = parseAuthSession(await readResponseJson(response));
  if (!session) return responseJson({ error: 'sign_in_failed' }, 401);

  const user = await requestSupabaseUser(config, session.accessToken);
  if (!user || !isSupaAdmin(user)) {
    await endSupabaseSession(config, session.accessToken);
    return responseJson({ error: 'admin_access_required' }, 403);
  }
  return sessionResponse(session);
}

async function refreshSession(request: Request, config: SupabaseConfig): Promise<Response> {
  if (!sameOrigin(request)) return responseJson({ error: 'forbidden' }, 403);
  const body = await readRequestJson(request);
  const refreshToken = body?.refresh_token;
  if (typeof refreshToken !== 'string' || refreshToken.length === 0 || refreshToken.length > 4096) {
    return responseJson({ error: 'invalid_request' }, 400);
  }

  const response = await fetch(new URL('/auth/v1/token?grant_type=refresh_token', config.url), {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return responseJson({ error: 'session_expired' }, 401);

  const session = parseAuthSession(await readResponseJson(response));
  if (!session) return responseJson({ error: 'session_expired' }, 401);

  const user = await requestSupabaseUser(config, session.accessToken);
  if (!user || !isSupaAdmin(user)) {
    await endSupabaseSession(config, session.accessToken);
    return responseJson({ error: 'admin_access_required' }, 403);
  }
  return sessionResponse(session);
}

async function signOut(request: Request, config: SupabaseConfig): Promise<Response> {
  const accessToken = bearerToken(request);
  if (accessToken) {
    try {
      await endSupabaseSession(config, accessToken);
    } catch {
      return responseEmpty();
    }
  }
  return responseEmpty();
}

async function assertSupaAdmin(
  request: Request,
  config: SupabaseConfig,
): Promise<{ user: AuthUser } | { response: Response }> {
  const accessToken = bearerToken(request);
  if (!accessToken || accessToken.length > 8192) {
    return { response: responseJson({ error: 'unauthorized' }, 401) };
  }
  const user = await requestSupabaseUser(config, accessToken);
  if (!user) return { response: responseJson({ error: 'unauthorized' }, 401) };
  if (!isSupaAdmin(user)) {
    return { response: responseJson({ error: 'admin_access_required' }, 403) };
  }
  return { user };
}

function adminHeaders(secretKey: string): HeadersInit {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

function parseAdminUser(value: unknown): AuthUser | null {
  return parseAuthUser(value);
}

async function listAuthUsers(config: SupabaseConfig): Promise<AuthUser[]> {
  if (!config.secretKey) throw new Error('missing_secret');
  const users: AuthUser[] = [];
  let page = 1;
  while (page <= 1000) {
    const url = new URL('/auth/v1/admin/users', config.url);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    const response = await fetch(url, {
      headers: adminHeaders(config.secretKey),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('auth_admin_request_failed');
    const payload = await readResponseJson(response);
    const rows = isRecord(payload) && Array.isArray(payload.users) ? payload.users : null;
    if (!rows) throw new Error('invalid_auth_admin_response');
    const batch = rows.map(parseAdminUser).filter((user): user is AuthUser => user !== null);
    users.push(...batch);
    if (rows.length < PAGE_SIZE) return users;
    page += 1;
  }
  throw new Error('auth_user_limit_reached');
}

function parseProfile(value: unknown): ProfileRow | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  return {
    id: value.id,
    displayName: typeof value.display_name === 'string' ? value.display_name : null,
    createdAt: typeof value.created_at === 'string' ? value.created_at : null,
  };
}

function parseCreditBooking(value: unknown): CreditBooking | null {
  if (!isRecord(value)) return null;
  const { subscriber_user_id: subscriberUserId, request_id: requestId, action } = value;
  const credits = Number(value.credits);
  if (
    typeof subscriberUserId !== 'string' ||
    typeof requestId !== 'string' ||
    (action !== 'suggestion' && action !== 'recipe' && action !== 'voice') ||
    !Number.isSafeInteger(credits) ||
    credits < 1
  ) {
    return null;
  }
  return { subscriberUserId, requestId, action, credits };
}

function parseCreditRefund(value: unknown): CreditRefund | null {
  if (
    !isRecord(value) ||
    typeof value.subscriber_user_id !== 'string' ||
    typeof value.request_id !== 'string'
  ) {
    return null;
  }
  return {
    subscriberUserId: value.subscriber_user_id,
    requestId: value.request_id,
  };
}

async function listRestRows<T>(
  config: SupabaseConfig,
  table: string,
  filters: Array<[string, string]>,
  parse: (value: unknown) => T | null,
): Promise<T[]> {
  if (!config.secretKey) throw new Error('missing_secret');
  const rows: T[] = [];
  let offset = 0;
  while (offset <= 1_000_000) {
    const url = new URL(`/rest/v1/${table}`, config.url);
    for (const [key, value] of filters) url.searchParams.append(key, value);
    const end = offset + PAGE_SIZE - 1;
    const response = await fetch(url, {
      headers: {
        ...adminHeaders(config.secretKey),
        'Range-Unit': 'items',
        Range: `${offset}-${end}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('database_request_failed');
    const payload = await readResponseJson(response);
    if (!Array.isArray(payload)) throw new Error('invalid_database_response');
    const batch = payload.map(parse).filter((row): row is T => row !== null);
    rows.push(...batch);
    if (payload.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
  throw new Error('database_row_limit_reached');
}

function validUserId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function listProfiles(config: SupabaseConfig, userIds: string[]): Promise<ProfileRow[]> {
  const profiles: ProfileRow[] = [];
  for (let index = 0; index < userIds.length; index += 100) {
    const ids = userIds.slice(index, index + 100).filter(validUserId);
    if (ids.length === 0) continue;
    const rows = await listRestRows(
      config,
      'profiles',
      [
        ['select', 'id,display_name,created_at'],
        ['id', `in.(${ids.join(',')})`],
      ],
      parseProfile,
    );
    profiles.push(...rows);
  }
  return profiles;
}

function monthBounds(month: string): { start: string; end: string } | null {
  const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (year < 2000 || year > 9999) return null;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)).toISOString(),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString(),
  };
}

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function listBookings(config: SupabaseConfig, start: string, end: string): Promise<CreditBooking[]> {
  return listRestRows(
    config,
    'ai_credit_bookings',
    [
      ['select', 'subscriber_user_id,request_id,action,credits'],
      ['and', `(created_at.gte.${start},created_at.lt.${end})`],
    ],
    parseCreditBooking,
  );
}

async function listRefunds(config: SupabaseConfig, bookings: CreditBooking[]): Promise<CreditRefund[]> {
  const refunds: CreditRefund[] = [];
  const requestIds = [...new Set(bookings.map((booking) => booking.requestId))];
  for (let index = 0; index < requestIds.length; index += 100) {
    const ids = requestIds.slice(index, index + 100);
    const rows = await listRestRows(
      config,
      'ai_credit_refunds',
      [
        ['select', 'subscriber_user_id,request_id'],
        ['request_id', `in.(${ids.join(',')})`],
      ],
      parseCreditRefund,
    );
    refunds.push(...rows);
  }
  return refunds;
}

function userCreditsById(bookings: CreditBooking[], refunds: CreditRefund[]): Map<string, UserCredits> {
  const refunded = new Set(refunds.map((refund) => `${refund.subscriberUserId}:${refund.requestId}`));
  const totals = new Map<string, UserCredits>();
  for (const booking of bookings) {
    if (refunded.has(`${booking.subscriberUserId}:${booking.requestId}`)) continue;
    const current = totals.get(booking.subscriberUserId) ?? {
      suggestions: 0,
      recipes: 0,
      voice: 0,
      total: 0,
    };
    if (booking.action === 'suggestion') current.suggestions += booking.credits;
    if (booking.action === 'recipe') current.recipes += booking.credits;
    if (booking.action === 'voice') current.voice += booking.credits;
    current.total += booking.credits;
    totals.set(booking.subscriberUserId, current);
  }
  return totals;
}

function fallbackName(user: AuthUser): string {
  return user.email?.split('@')[0] ?? 'Unbekannter Nutzer';
}

async function readUsage(config: SupabaseConfig, month: string): Promise<Response> {
  const bounds = monthBounds(month);
  if (!bounds) return responseJson({ error: 'invalid_month' }, 400);

  const users = await listAuthUsers(config);
  const [profiles, bookings] = await Promise.all([
    listProfiles(config, users.map((user) => user.id)),
    listBookings(config, bounds.start, bounds.end),
  ]);
  const refunds = await listRefunds(config, bookings);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const creditsById = userCreditsById(bookings, refunds);
  const rows = users.map((user) => {
    const profile = profilesById.get(user.id);
    const credits = creditsById.get(user.id) ?? { suggestions: 0, recipes: 0, voice: 0, total: 0 };
    return {
      id: user.id,
      name: profile?.displayName?.trim() || fallbackName(user),
      email: user.email ?? '',
      created_at: profile?.createdAt ?? user.createdAt,
      credits,
    };
  });
  rows.sort((left, right) => right.credits.total - left.credits.total || left.name.localeCompare(right.name, 'de'));

  const totals = rows.reduce(
    (sum, user) => ({
      accounts: sum.accounts + 1,
      users_with_usage: sum.users_with_usage + Number(user.credits.total > 0),
      total_credits: sum.total_credits + user.credits.total,
      suggestions: sum.suggestions + user.credits.suggestions,
      recipes: sum.recipes + user.credits.recipes,
      voice: sum.voice + user.credits.voice,
    }),
    { accounts: 0, users_with_usage: 0, total_credits: 0, suggestions: 0, recipes: 0, voice: 0 },
  );
  return responseJson({ month, totals, users: rows });
}

async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  const config = configFrom(env);
  if (!config) return responseJson({ error: 'admin_service_not_configured' }, 503);

  if (path === '/api/admin/auth/login' && request.method === 'POST') {
    return signIn(request, config);
  }
  if (path === '/api/admin/auth/refresh' && request.method === 'POST') {
    return refreshSession(request, config);
  }
  if (path === '/api/admin/auth/logout' && request.method === 'POST') {
    return signOut(request, config);
  }
  if (path === '/api/admin/usage' && request.method === 'GET') {
    const authorization = await assertSupaAdmin(request, config);
    if ('response' in authorization) return authorization.response;
    const adminConfig = configFrom(env, true);
    if (!adminConfig) return responseJson({ error: 'admin_service_not_configured' }, 503);
    try {
      const month = new URL(request.url).searchParams.get('month') ?? currentUtcMonth();
      return await readUsage(adminConfig, month);
    } catch {
      return responseJson({ error: 'admin_data_unavailable' }, 502);
    }
  }
  return responseJson({ error: 'not_found' }, 404);
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminApi(request, env, url.pathname);
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
