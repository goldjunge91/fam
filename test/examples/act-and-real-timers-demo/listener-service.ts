// Steht stellvertretend fuer z. B. supabase.auth.onAuthStateChange: eine
// Funktion, die einen Callback registriert, den ein externes System (nicht
// React) irgendwann aufruft.
export type StatusListener = (status: string) => void;

export function onStatusChange(_listener: StatusListener): () => void {
  // In echt: registriert bei einem nativen/vendor SDK. Im Test wird das
  // Modul gemockt, damit wir den uebergebenen Callback selbst "von aussen"
  // feuern koennen.
  return () => {};
}
