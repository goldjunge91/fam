import type { DbError } from './handler.ts';

type PostHogDeletionConfig = {
  apiKey: string;
  projectId: string;
  host: string;
};

type FetchLike = typeof fetch;

function errorForRequest(operation: string, status: number): DbError {
  return { code: `posthog_${operation}_${status}`, message: 'PostHog request failed' };
}

function personIdsFromResponse(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || !('results' in payload)) return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((person) => {
    if (!person || typeof person !== 'object' || !('id' in person)) return [];
    const id = (person as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? [id] : [];
  });
}

export function createPostHogPersonDeleter(
  config: PostHogDeletionConfig | undefined,
  fetchImpl: FetchLike = fetch,
): ((distinctId: string) => Promise<DbError | null>) | undefined {
  if (!config) return undefined;

  const configuredHost = new URL(config.host);
  if (configuredHost.protocol !== 'https:') {
    throw new Error('posthog_host_must_use_https');
  }

  const projectPath = `/api/projects/${encodeURIComponent(config.projectId)}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  return async (distinctId) => {
    const personsUrl = new URL(projectPath, configuredHost);
    personsUrl.searchParams.set('distinct_id', distinctId);
    personsUrl.searchParams.set('limit', '100');

    let personsResponse: Response;
    try {
      personsResponse = await fetchImpl(personsUrl, { headers });
    } catch {
      return { code: 'posthog_person_lookup_network', message: 'PostHog request failed' };
    }

    if (!personsResponse.ok) {
      return errorForRequest('person_lookup', personsResponse.status);
    }

    let payload: unknown;
    try {
      payload = await personsResponse.json();
    } catch {
      return { code: 'posthog_person_lookup_payload', message: 'PostHog response was invalid' };
    }

    for (const personId of personIdsFromResponse(payload)) {
      const deleteUrl = new URL(`${projectPath}/${encodeURIComponent(personId)}`, configuredHost);
      deleteUrl.searchParams.set('delete_events', 'true');
      deleteUrl.searchParams.set('delete_recordings', 'true');

      let deleteResponse: Response;
      try {
        deleteResponse = await fetchImpl(deleteUrl, { method: 'DELETE', headers });
      } catch {
        return { code: 'posthog_person_delete_network', message: 'PostHog request failed' };
      }

      if (!deleteResponse.ok) {
        return errorForRequest('person_delete', deleteResponse.status);
      }
    }

    return null;
  };
}

export type { PostHogDeletionConfig };
