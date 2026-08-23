/** Der unbekannte Startzustand zaehlt nicht als Reconnect. */
export function detectReconnect(previousOnline: boolean | null, currentOnline: boolean): boolean {
  return previousOnline === false && currentOnline === true;
}
