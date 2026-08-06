/**
 * Reconnect-Erkennung (#50).
 *
 * Rein: kein Netzwerk, keine Uhr, kein Zufall. Ein Reconnect ist genau der
 * Uebergang von "offline beobachtet" zu "online" — `null` (noch nie
 * beobachtet, z. B. beim allerersten Event nach App-Start) zaehlt bewusst
 * NICHT als Reconnect, sonst wuerde jeder App-Start faelschlich einen
 * Sync-Trigger ausloesen, obwohl dafuer der normale App-Oeffnen-Sync
 * zustaendig ist (siehe #50: "die App muss beim Oeffnen immer selbst
 * synchronisieren" — das ist nicht Aufgabe dieser Funktion).
 */
export function detectReconnect(previousOnline: boolean | null, currentOnline: boolean): boolean {
  return previousOnline === false && currentOnline === true;
}
