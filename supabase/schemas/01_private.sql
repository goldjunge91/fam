-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- Aenderungen hier eintragen, danach `supabase db diff -f <name>`.
--
-- Sammelort fuer SECURITY-DEFINER-Helfer. Bewusst nicht `public`: alles in
-- `public` ist ueber PostgREST als RPC aufrufbar, und eine Funktion, die RLS
-- umgeht, hat dort nichts verloren. PostgREST exponiert nur die unter
-- `[api] schemas` in config.toml gelisteten Schemas.

create schema if not exists private;

-- Wird von allen synchronisierten Tabellen gebraucht; hier zentral, damit es
-- nur eine Implementierung gibt.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
