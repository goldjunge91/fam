let attachedThisSession = false;

/** Ob `attachOffDump` in diesem Prozesslauf bereits erfolgreich angehaengt hat. */
export function isOffDumpAttached(): boolean {
  return attachedThisSession;
}

/** Setzt den internen Attach-Status (nur innerhalb von off-dump zu nutzen). */
export function setOffDumpAttached(attached: boolean): void {
  attachedThisSession = attached;
}

export function resetOffDumpAttachment(): void {
  attachedThisSession = false;
}
