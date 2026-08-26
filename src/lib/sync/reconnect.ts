export function detectReconnect(previousOnline: boolean | null, currentOnline: boolean): boolean {
  return previousOnline === false && currentOnline === true;
}
