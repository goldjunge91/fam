-- ==============================================================================
-- 23_brochures.sql
-- Tabellen für das Prospekt-Feature (Bring! API Dumps) und favorisierte Märkte
-- ==============================================================================

-- 1. Globale Markt-Definitionen (Read-Only für App)
create table public.brochure_stores (
  id text primary key,
  name text not null,
  logo_url text,
  active boolean default true not null,
  created_at timestamptz default now() not null
);

alter table public.brochure_stores enable row level security;
create policy brochure_stores_select on public.brochure_stores 
  for select to authenticated using (true);


-- 2. Wöchentliche Prospekt-Dumps pro PLZ (Read-Only für App)
create table public.brochure_dumps (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null,
  payload_json jsonb not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  created_at timestamptz default now() not null
);

create index brochure_dumps_zip_code_idx on public.brochure_dumps (zip_code, valid_until);

alter table public.brochure_dumps enable row level security;
create policy brochure_dumps_select on public.brochure_dumps 
  for select to authenticated using (true);


-- 3. Favorisierte Märkte pro Nutzer (Strikt privat via RLS)
create table public.favorite_brochure_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id text not null references public.brochure_stores(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  deleted_at timestamptz,
  unique(user_id, store_id)
);

alter table public.favorite_brochure_stores enable row level security;
create policy favorite_brochure_stores_all on public.favorite_brochure_stores
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger set_updated_at_favorite_brochure_stores
  before update on public.favorite_brochure_stores
  for each row execute function private.set_updated_at();
