type Listener = (error: string | null) => void;

let lastError: string | null = null;
const listeners = new Set<Listener>();

export function setAuthDeepLinkError(error: string | null): void {
  lastError = error;
  for (const listener of listeners) listener(error);
}

/**
 * Ruft den Listener sofort mit dem aktuellen Wert auf, damit ein Fehler aus der
 * Kaltstartphase nicht verloren geht. Gibt die Abmeldefunktion zurueck.
 */
export function subscribeAuthDeepLinkError(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastError);
  return () => {
    listeners.delete(listener);
  };
}

/** Nach dem Anzeigen aufraeumen, damit der Fehler nicht bei der naechsten
 *  Registrierung erneut auftaucht. */
export function clearAuthDeepLinkError(): void {
  setAuthDeepLinkError(null);
}
