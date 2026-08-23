/** Puffert Deep-Link-Fehler, die beim Kaltstart vor dem ersten Abonnenten eintreffen. */
type Listener = (error: string | null) => void;

let lastError: string | null = null;
const listeners = new Set<Listener>();

export function setAuthDeepLinkError(error: string | null): void {
  lastError = error;
  for (const listener of listeners) listener(error);
}

export function getAuthDeepLinkError(): string | null {
  return lastError;
}

/** Liefert dem neuen Listener auch einen bereits gepufferten Fehler. */
export function subscribeAuthDeepLinkError(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastError);
  return () => {
    listeners.delete(listener);
  };
}

export function clearAuthDeepLinkError(): void {
  setAuthDeepLinkError(null);
}
