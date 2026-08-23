/** Nutzerspezifischer Haushalts-Key in einem eigenen, zyklusfreien Modul. */
export const HOUSEHOLDS_QUERY_KEY = ['households', 'by-user'] as const;

export function householdsQueryKey(userId: string | undefined) {
  return [...HOUSEHOLDS_QUERY_KEY, userId] as const;
}
