const resetters = new Map<string, (userId: string) => void>();

/** Registriert einen entschlüsselten Modulcache für den zentralen Account-Cleanup. */
export function registerLocalAccountCache(
  cacheName: string,
  reset: (userId: string) => void,
): void {
  resetters.set(cacheName, reset);
}

export function resetLocalAccountModuleCaches(userId: string): void {
  for (const reset of resetters.values()) reset(userId);
}
