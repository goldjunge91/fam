-- Gewuenschter Endzustand — NICHT von Hand migrieren.
-- SECURITY-DEFINER-Helfer bleiben ausserhalb des von PostgREST exponierten Schemas.

create schema if not exists private;

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
