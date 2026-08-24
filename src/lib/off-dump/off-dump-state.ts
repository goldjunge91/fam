let attachedThisSession = false;

/** Ob `attachOffDump` in diesem Prozesslauf bereits erfolgreich angehaengt hat. */
export function isOffDumpAttached(): boolean {
  return attachedThisSession;
}

/** Setzt den internen Attach-Status (nur innerhalb von off-dump zu nutzen). */
export function setOffDumpAttached(attached: boolean): void {
  attachedThisSession = attached;
}

/**
 * Setzt den Attach-Status zurueck, wenn die zugrundeliegende Connection
 * verschwindet (Logout-Wipe, Nutzerwechsel-Wipe in `client.ts`). Ohne diesen
 * Aufruf haelt `attachedThisSession` weiter `true` gegen eine Verbindung, an
 * der nie ein `ATTACH` lief — `isOffDumpAttached()`/`getOffDumpStatus()`
 * luegen dann, und `attachOffDump()` haengt nie neu an.
 */
export function resetOffDumpAttachment(): void {
  attachedThisSession = false;
}
