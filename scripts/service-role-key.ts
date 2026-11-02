export function getRequiredServiceRoleKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error(
      'SUPABASE_SECRET_KEY fehlt. Übergib den lokalen Service-Role-Key ausschließlich als Umgebungsvariable.',
    );
  }
  return key;
}
