/**
 * Traegt den Fehler eines fehlgeschlagenen Auth-Deep-Links vom Empfaenger
 * (`src/app/_layout.tsx`) zu der Stelle, die ihn anzeigen kann
 * (`PendingAuthBanner`).
 *
 * Vorher endete dieser Fehler in einem `console.warn`. Er war damit im
 * Metro-Log sichtbar und im UI nirgends — der Nutzer sah nur einen
 * Wartezustand, der sich nicht mehr aufloeste, ohne jeden Hinweis auf die
 * Ursache ("Email link is invalid or has expired") oder den Ausweg.
 *
 * Bewusst ein Modul mit Modulzustand statt eines Context: der Fehler trifft
 * ein, bevor irgendeine Komponente ihn abonnieren kann (beim Kaltstart noch
 * waehrend `Linking.getInitialURL()`). Deshalb merkt sich das Modul den letzten
 * Wert, und ein spaeter montierter Abonnent bekommt ihn nachtraeglich.
 */
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
