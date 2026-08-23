/** Erkennt per PGRST116 eine Session ohne synchron angelegte Profilzeile. */
export function isOrphanedProfileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'PGRST116'
  );
}
