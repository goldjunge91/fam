import type { AnalyticsDeletionResult, DbError } from './handler.ts';

type PostHogDeletionConfig = {
  apiKey: string;
  projectId: string;
  host: string;
};

export type PostHogDeletionCheckpoint = {
  personIds: string[];
  deleteRequestedAt: string;
  deleteAcceptedAt: string | null;
  deleteVerifiedAt: string | null;
};

export type PostHogDeletionCheckpointStore = {
  read: (userId: string) => Promise<unknown>;
  upsert: (
    userId: string,
    checkpoint: PostHogDeletionCheckpoint,
  ) => Promise<DbError | null>;
};

type FetchLike = typeof fetch;

type PostHogDeletionOptions = {
  requestTimeoutMs?: number;
  verificationTimeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
};

type PostHogBulkDeleteResponse = {
  persons_found: number;
  persons_deleted: number;
  persons_queued_for_deletion: number;
  events_queued_for_deletion: boolean;
  recordings_queued_for_deletion: boolean;
  deletion_errors: unknown[];
};

type PostHogPersonList = {
  results: Array<{ id: string }>;
  next: null;
};

const MAX_PERSON_IDS = 1000;
const MAX_PERSON_ID_LENGTH = 256;
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_VERIFICATION_TIMEOUT_MS = 10000;
const DEFAULT_POLL_INTERVAL_MS = 250;

const POSTHOG_ERROR = Symbol('posthog_error');
type PostHogError = DbError & { readonly [POSTHOG_ERROR]: true };

function stableError(code: string, message: string): PostHogError {
  const error = { code, message } as PostHogError;
  Object.defineProperty(error, POSTHOG_ERROR, { value: true });
  return error;
}

function isPostHogError(value: unknown): value is PostHogError {
  return isRecord(value) &&
    Object.getOwnPropertyDescriptor(value, POSTHOG_ERROR)?.value === true &&
    typeof value.message === 'string';
}

function errorForRequest(operation: string, status: number): PostHogError {
  return stableError(`posthog_${operation}_${status}`, 'PostHog request failed');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCheckpointStoreError(value: unknown): value is DbError {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
    return false;
  }
  return value.code === 'account_deletion_checkpoint_read' ||
    value.code === 'account_deletion_checkpoint_write';
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isValidPersonId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_PERSON_ID_LENGTH &&
    value.trim() === value;
}

function isValidPersonIds(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PERSON_IDS) return false;
  if (!value.every(isValidPersonId)) return false;
  return new Set(value).size === value.length;
}

function parseCheckpoint(value: unknown): PostHogDeletionCheckpoint | null {
  if (!isRecord(value)) return null;
  if (!isValidPersonIds(value.personIds)) return null;
  if (!isValidTimestamp(value.deleteRequestedAt)) return null;
  if (value.deleteAcceptedAt !== null && !isValidTimestamp(value.deleteAcceptedAt)) return null;
  if (value.deleteVerifiedAt !== null && !isValidTimestamp(value.deleteVerifiedAt)) return null;
  if (value.deleteVerifiedAt !== null && value.deleteAcceptedAt === null) return null;

  const requestedAt = Date.parse(value.deleteRequestedAt as string);
  const acceptedAt = value.deleteAcceptedAt === null
    ? null
    : Date.parse(value.deleteAcceptedAt as string);
  const verifiedAt = value.deleteVerifiedAt === null
    ? null
    : Date.parse(value.deleteVerifiedAt as string);
  if (acceptedAt !== null && acceptedAt < requestedAt) return null;
  if (verifiedAt !== null && (acceptedAt === null || verifiedAt < acceptedAt)) return null;

  return {
    personIds: [...value.personIds],
    deleteRequestedAt: value.deleteRequestedAt,
    deleteAcceptedAt: value.deleteAcceptedAt,
    deleteVerifiedAt: value.deleteVerifiedAt,
  };
}

function samePersonIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

function mergePersonIds(...lists: string[][]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(id);
      }
    }
  }
  return merged;
}

function checkpointError(operation: 'read' | 'write' | 'invalid'): PostHogError {
  return stableError(
    `posthog_deletion_checkpoint_${operation}`,
    operation === 'invalid'
      ? 'PostHog deletion checkpoint was invalid'
      : 'PostHog deletion checkpoint failed',
  );
}

function parsePersonList(payload: unknown): PostHogPersonList | PostHogError {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return stableError('posthog_person_list_payload', 'PostHog response was invalid');
  }

  if (payload.next !== null) {
    return stableError('posthog_person_list_incomplete', 'PostHog person list was incomplete');
  }

  if (
    payload.count !== undefined &&
    (!isNonNegativeSafeInteger(payload.count) || payload.count !== payload.results.length)
  ) {
    return stableError('posthog_person_list_incomplete', 'PostHog person list was incomplete');
  }

  const ids: string[] = [];
  for (const result of payload.results) {
    if (!isRecord(result) || !isValidPersonId(result.id)) {
      return stableError('posthog_person_list_payload', 'PostHog response was invalid');
    }
    if (ids.includes(result.id)) {
      return stableError('posthog_person_list_payload', 'PostHog response was invalid');
    }
    ids.push(result.id);
  }

  return { results: ids.map((id) => ({ id })), next: null };
}

function parseBulkDeleteResponse(
  payload: unknown,
  expectedPersonCount: number,
): PostHogBulkDeleteResponse | PostHogError {
  if (!isRecord(payload)) {
    return stableError('posthog_person_delete_payload', 'PostHog response was invalid');
  }

  const response = payload as Partial<PostHogBulkDeleteResponse>;
  if (
    !isNonNegativeSafeInteger(response.persons_found) ||
    !isNonNegativeSafeInteger(response.persons_deleted) ||
    !isNonNegativeSafeInteger(response.persons_queued_for_deletion) ||
    typeof response.events_queued_for_deletion !== 'boolean' ||
    typeof response.recordings_queued_for_deletion !== 'boolean' ||
    !Array.isArray(response.deletion_errors) ||
    response.deletion_errors.length > 0 ||
    response.persons_deleted > response.persons_found ||
    response.persons_queued_for_deletion > response.persons_found ||
    response.persons_deleted + response.persons_queued_for_deletion !== response.persons_found
  ) {
    return stableError('posthog_person_delete_payload', 'PostHog response was invalid');
  }

  const validatedResponse = {
    persons_found: response.persons_found,
    persons_deleted: response.persons_deleted,
    persons_queued_for_deletion: response.persons_queued_for_deletion,
    events_queued_for_deletion: response.events_queued_for_deletion,
    recordings_queued_for_deletion: response.recordings_queued_for_deletion,
    deletion_errors: response.deletion_errors,
  };

  if (validatedResponse.persons_found === 0) {
    if (
      validatedResponse.persons_deleted !== 0 ||
      validatedResponse.persons_queued_for_deletion !== 0 ||
      validatedResponse.events_queued_for_deletion ||
      validatedResponse.recordings_queued_for_deletion
    ) {
      return stableError('posthog_person_delete_payload', 'PostHog response was invalid');
    }
    return validatedResponse;
  }

  if (
    validatedResponse.persons_found !== expectedPersonCount ||
    validatedResponse.persons_deleted + validatedResponse.persons_queued_for_deletion !==
      expectedPersonCount ||
    !validatedResponse.events_queued_for_deletion ||
    !validatedResponse.recordings_queued_for_deletion
  ) {
    return stableError('posthog_person_delete_payload', 'PostHog response was invalid');
  }

  return validatedResponse;
}

type PostHogDeletionStatus = {
  status: 'pending' | 'completed';
  createdAt: string;
  deleteVerifiedAt: string | null;
};

type PostHogDeletionStatusResult =
  | { status: 'absent' }
  | PostHogDeletionStatus;

function parseDeletionStatus(
  payload: unknown,
  personId: string,
  checkpoint: PostHogDeletionCheckpoint,
): PostHogDeletionStatusResult | PostHogError {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return stableError('posthog_deletion_status_payload', 'PostHog deletion status was invalid');
  }
  if (payload.next !== null) {
    return stableError(
      'posthog_deletion_status_incomplete',
      'PostHog deletion status was incomplete',
    );
  }
  if (
    !isNonNegativeSafeInteger(payload.count) ||
    payload.count !== payload.results.length
  ) {
    return stableError('posthog_deletion_status_payload', 'PostHog deletion status was invalid');
  }

  const requestedAt = Date.parse(checkpoint.deleteRequestedAt);
  const acceptedAt = checkpoint.deleteAcceptedAt === null
    ? null
    : Date.parse(checkpoint.deleteAcceptedAt);
  const currentStatuses: PostHogDeletionStatus[] = [];

  for (const result of payload.results) {
    if (
      !isRecord(result) ||
      result.person_uuid !== personId ||
      !isValidTimestamp(result.created_at)
    ) {
      return stableError('posthog_deletion_status_payload', 'PostHog deletion status was invalid');
    }

    const createdAt = Date.parse(result.created_at);
    let status: PostHogDeletionStatus;
    if (result.status === 'pending') {
      if (result.delete_verified_at !== undefined && result.delete_verified_at !== null) {
        return stableError(
          'posthog_deletion_status_payload',
          'PostHog deletion status was invalid',
        );
      }
      status = {
        status: 'pending',
        createdAt: result.created_at,
        deleteVerifiedAt: null,
      };
    } else if (result.status === 'completed' && isValidTimestamp(result.delete_verified_at)) {
      if (Date.parse(result.delete_verified_at) < createdAt) {
        return stableError(
          'posthog_deletion_status_payload',
          'PostHog deletion status was invalid',
        );
      }
      status = {
        status: 'completed',
        createdAt: result.created_at,
        deleteVerifiedAt: result.delete_verified_at,
      };
    } else {
      return stableError('posthog_deletion_status_payload', 'PostHog deletion status was invalid');
    }

    if (createdAt >= requestedAt && (acceptedAt === null || createdAt <= acceptedAt)) {
      currentStatuses.push(status);
    }
  }

  if (currentStatuses.length === 0) return { status: 'absent' };
  if (currentStatuses.length > 1) {
    return stableError(
      'posthog_deletion_status_ambiguous',
      'PostHog deletion status was ambiguous',
    );
  }
  return currentStatuses[0];
}

async function requestJson(
  fetchImpl: FetchLike,
  url: URL,
  init: RequestInit,
  operation: string,
  timeoutMs: number,
  expectedStatus: number,
): Promise<unknown | PostHogError> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const requestPromise = (async (): Promise<unknown | PostHogError> => {
    let response: Response;
    try {
      const candidate = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!(candidate instanceof Response)) {
        return stableError(`posthog_${operation}_response`, 'PostHog response was invalid');
      }
      response = candidate;
    } catch {
      return timedOut
        ? stableError(`posthog_${operation}_timeout`, 'PostHog request timed out')
        : stableError(`posthog_${operation}_network`, 'PostHog request failed');
    }

    if (response.status !== expectedStatus) {
      return errorForRequest(operation, response.status);
    }

    try {
      return await response.json();
    } catch {
      return timedOut
        ? stableError(`posthog_${operation}_timeout`, 'PostHog request timed out')
        : stableError(`posthog_${operation}_payload`, 'PostHog response was invalid');
    }
  })();

  const timeoutPromise = new Promise<PostHogError>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve(stableError(`posthog_${operation}_timeout`, 'PostHog request timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function createPostHogPersonDeleter(
  config: PostHogDeletionConfig | undefined,
  fetchImpl: FetchLike = fetch,
  checkpointStore?: PostHogDeletionCheckpointStore,
  options: PostHogDeletionOptions = {},
): ((distinctId: string) => Promise<DbError | AnalyticsDeletionResult>) | undefined {
  if (!config) return undefined;

  const configuredHost = new URL(config.host);
  if (configuredHost.protocol !== 'https:') {
    throw new Error('posthog_host_must_use_https');
  }

  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const verificationTimeoutMs = options.verificationTimeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
  const projectPath = `/api/projects/${encodeURIComponent(config.projectId)}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  async function getPersonList(distinctId: string): Promise<PostHogPersonList | PostHogError> {
    const url = new URL(`${projectPath}/persons`, configuredHost);
    url.searchParams.set('distinct_id', distinctId);
    url.searchParams.set('limit', String(MAX_PERSON_IDS));
    const payload = await requestJson(
      fetchImpl,
      url,
      { method: 'GET', headers },
      'person_list',
      requestTimeoutMs,
      200,
    );
    if (isPostHogError(payload)) return payload;
    return parsePersonList(payload);
  }

  async function getDeletionStatus(
    personId: string,
    checkpoint: PostHogDeletionCheckpoint,
    timeoutMs = requestTimeoutMs,
  ): Promise<PostHogDeletionStatusResult | PostHogError> {
    const url = new URL(`${projectPath}/persons/deletion_status`, configuredHost);
    url.searchParams.set('person_uuid', personId);
    url.searchParams.set('status', 'all');
    const payload = await requestJson(
      fetchImpl,
      url,
      { method: 'GET', headers },
      'deletion_status',
      timeoutMs,
      200,
    );
    if (isPostHogError(payload)) return payload;
    return parseDeletionStatus(payload, personId, checkpoint);
  }

  function currentStatusMissing(): PostHogError {
    return stableError(
      'posthog_deletion_status_current_missing',
      'PostHog deletion status did not match the current request',
    );
  }

  async function recoverUnknownAcceptance(
    personIds: string[],
    checkpoint: PostHogDeletionCheckpoint,
  ): Promise<'absent' | 'pending' | 'completed' | PostHogError> {
    const deadline = now().getTime() + verificationTimeoutMs;
    let hasAbsent = false;
    let hasPending = false;
    let hasCompleted = false;

    for (const personId of personIds) {
      const remainingMs = deadline - now().getTime();
      if (remainingMs <= 0) {
        return stableError('posthog_deletion_status_timeout', 'PostHog request timed out');
      }

      const status = await getDeletionStatus(
        personId,
        checkpoint,
        Math.min(requestTimeoutMs, remainingMs),
      );
      if (isPostHogError(status)) return status;
      if (now().getTime() >= deadline) {
        return stableError('posthog_deletion_status_timeout', 'PostHog request timed out');
      }

      if (status.status === 'absent') hasAbsent = true;
      else if (status.status === 'pending') hasPending = true;
      else hasCompleted = true;
    }

    if (hasAbsent && (hasPending || hasCompleted)) return currentStatusMissing();
    if (hasAbsent) return 'absent';
    return hasPending ? 'pending' : 'completed';
  }

  async function verifyStatuses(
    personIds: string[],
    checkpoint: PostHogDeletionCheckpoint,
  ): Promise<'pending' | 'completed' | PostHogError> {
    const deadline = now().getTime() + verificationTimeoutMs;
    while (true) {
      if (now().getTime() >= deadline) return 'pending';

      let hasPending = false;
      for (const personId of personIds) {
        const remainingMs = deadline - now().getTime();
        if (remainingMs <= 0) return 'pending';

        const status = await getDeletionStatus(
          personId,
          checkpoint,
          Math.min(requestTimeoutMs, remainingMs),
        );
        if (isPostHogError(status)) {
          if (status.code === 'posthog_deletion_status_timeout' && now().getTime() >= deadline) {
            return 'pending';
          }
          return status;
        }
        if (now().getTime() >= deadline) return 'pending';
        if (status.status === 'absent') return currentStatusMissing();
        if (status.status === 'pending') hasPending = true;
      }
      if (!hasPending) return 'completed';
      if (now().getTime() >= deadline) return 'pending';

      try {
        await sleep(Math.min(pollIntervalMs, deadline - now().getTime()));
      } catch {
        return stableError('posthog_deletion_status_timeout', 'PostHog request timed out');
      }
    }
  }

  return async (distinctId) => {
    if (!checkpointStore) {
      return checkpointError('read');
    }
    if (!isValidPersonId(distinctId)) {
      return stableError('posthog_person_list_payload', 'PostHog response was invalid');
    }

    let rawCheckpoint: unknown;
    try {
      rawCheckpoint = await checkpointStore.read(distinctId);
    } catch {
      return checkpointError('read');
    }
    if (isPostHogError(rawCheckpoint) || isCheckpointStoreError(rawCheckpoint)) {
      return checkpointError('read');
    }
    const storedCheckpoint = rawCheckpoint === null ? null : parseCheckpoint(rawCheckpoint);
    if (rawCheckpoint !== null && storedCheckpoint === null) return checkpointError('invalid');
    if (
      storedCheckpoint?.deleteVerifiedAt !== null &&
      storedCheckpoint?.deleteVerifiedAt !== undefined
    ) {
      return { status: 'verified' };
    }

    const personList = await getPersonList(distinctId);
    if (isPostHogError(personList)) return personList;

    const foundPersonIds = personList.results.map(({ id }) => id);
    const personIds = mergePersonIds(storedCheckpoint?.personIds ?? [], foundPersonIds);
    if (personIds.length === 0) return { status: 'not_found' };
    if (personIds.length > MAX_PERSON_IDS) {
      return stableError('posthog_person_list_incomplete', 'PostHog person list was incomplete');
    }

    let checkpoint = storedCheckpoint;
    const hasNewPersonIds = checkpoint === null || !samePersonIds(checkpoint.personIds, personIds);
    const canRecoverUnknownAcceptance = storedCheckpoint !== null && !hasNewPersonIds;
    if (hasNewPersonIds) {
      checkpoint = {
        personIds,
        deleteRequestedAt: now().toISOString(),
        deleteAcceptedAt: null,
        deleteVerifiedAt: null,
      };
      let checkpointWriteError: DbError | null;
      try {
        checkpointWriteError = await checkpointStore.upsert(distinctId, checkpoint);
      } catch {
        return checkpointError('write');
      }
      if (checkpointWriteError) return checkpointError('write');
    }

    if (checkpoint === null) return checkpointError('invalid');

    if (checkpoint.deleteAcceptedAt === null) {
      let recoveredStatus: 'absent' | 'pending' | 'completed' = 'absent';
      if (canRecoverUnknownAcceptance) {
        const recovery = await recoverUnknownAcceptance(personIds, checkpoint);
        if (isPostHogError(recovery)) return recovery;
        recoveredStatus = recovery;
      }

      if (recoveredStatus === 'absent') {
        const bulkDeleteUrl = new URL(`${projectPath}/persons/bulk_delete`, configuredHost);
        const payload = await requestJson(
          fetchImpl,
          bulkDeleteUrl,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ids: personIds,
              delete_events: true,
              delete_recordings: true,
              keep_person: false,
            }),
          },
          'person_delete',
          requestTimeoutMs,
          202,
        );
        if (isPostHogError(payload)) return payload;

        const deleteResult = parseBulkDeleteResponse(payload, personIds.length);
        if (isPostHogError(deleteResult)) return deleteResult;
        if (deleteResult.persons_found === 0) {
          const recovery = await recoverUnknownAcceptance(personIds, checkpoint);
          if (isPostHogError(recovery)) return recovery;
          if (recovery === 'absent') {
            return stableError(
              'posthog_person_delete_missing',
              'PostHog person deletion was not verified',
            );
          }
        }
      }

      checkpoint = {
        ...checkpoint,
        deleteAcceptedAt: now().toISOString(),
        deleteVerifiedAt: null,
      };
      let checkpointWriteError: DbError | null;
      try {
        checkpointWriteError = await checkpointStore.upsert(distinctId, checkpoint);
      } catch {
        return checkpointError('write');
      }
      if (checkpointWriteError) return checkpointError('write');
    }

    const verification = await verifyStatuses(personIds, checkpoint);
    if (isPostHogError(verification)) return verification;
    if (verification === 'pending') return { status: 'accepted' };

    const finalPersonList = await getPersonList(distinctId);
    if (isPostHogError(finalPersonList)) return finalPersonList;
    if (finalPersonList.results.length > 0) {
      return stableError('posthog_person_remains', 'PostHog person deletion was not verified');
    }

    checkpoint = {
      ...checkpoint,
      deleteVerifiedAt: now().toISOString(),
    };
    let checkpointWriteError: DbError | null;
    try {
      checkpointWriteError = await checkpointStore.upsert(distinctId, checkpoint);
    } catch {
      return checkpointError('write');
    }
    if (checkpointWriteError) return checkpointError('write');
    return { status: 'verified' };
  };
}

export type { PostHogDeletionConfig, PostHogDeletionOptions };
