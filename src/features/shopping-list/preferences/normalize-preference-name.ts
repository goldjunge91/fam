export function normalizePreferenceName(rawName: string): string {
  return rawName.trim().toLowerCase().replace(/\s+/g, ' ');
}
