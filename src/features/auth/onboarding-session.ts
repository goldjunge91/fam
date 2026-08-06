/**
 * Verfolgt, ob das Onboarding in der aktuellen Laufzeit-Session
 * (seit dem letzten App-Reload) bereits abgeschlossen wurde.
 */
let completedInCurrentSession = false;

export function markOnboardingSessionCompleted() {
  completedInCurrentSession = true;
}

export function isOnboardingSessionCompleted() {
  return completedInCurrentSession;
}
