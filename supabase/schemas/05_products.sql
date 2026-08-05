-- Gewuenschter Endzustand — NICHT von Hand migrieren (#38).
--
-- products: eigener Spiegel der Lebensmitteldaten.
--
-- Open Food Facts ist die Quelle, aber nicht die Wahrheit. Gefundene Produkte
-- werden hier gespeichert, damit Suche und Offline-Zugriff nicht von einem
-- fremden Dienst abhaengen — und damit ein Produkt, das dort spaeter geaendert
-- oder geloescht wird, hier stabil bleibt.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  -- Eindeutig, aber optional: unverpackte Lebensmittel (Aepfel, Hackfleisch
  -- von der Theke) haben keinen Barcode.
  barcode text unique,
  name text not null check (length(trim(name)) between 1 and 200),
  brand text,

  -- Naehrwerte je 100 g bzw. 100 ml — die Bezugsgroesse, in der Open Food Facts
  -- liefert und in der auch Verpackungen in der EU deklarieren.
  --
  -- Die Obergrenzen sind keine Schikane: Open Food Facts ist crowdsourced, und
  -- Werte wie "3200 kcal / 100 g" oder negative Mengen kommen dort real vor.
  -- Ohne Schranke landen sie in der Kalorienbilanz des Nutzers. 900 kcal/100 g
  -- liegt knapp ueber reinem Fett (884) und ist damit die physikalische Grenze.
  kcal_per_100 numeric(7, 2) check (kcal_per_100 >= 0 and kcal_per_100 <= 900),
  protein_g_per_100 numeric(6, 2) check (protein_g_per_100 between 0 and 100),
  carbs_g_per_100 numeric(6, 2) check (carbs_g_per_100 between 0 and 100),
  fat_g_per_100 numeric(6, 2) check (fat_g_per_100 between 0 and 100),
  fiber_g_per_100 numeric(6, 2) check (fiber_g_per_100 between 0 and 100),
  sugar_g_per_100 numeric(6, 2) check (sugar_g_per_100 between 0 and 100),
  salt_g_per_100 numeric(6, 2) check (salt_g_per_100 between 0 and 100),

  -- Gewicht einer Portion bzw. eines Stuecks. Ohne diesen Wert ist die
  -- Umrechnung "1 Stueck -> Gramm" nicht moeglich (#78) und muss ehrlich als
  -- "nicht umrechenbar" gemeldet werden, statt geraten zu werden.
  serving_size_g numeric(7, 2) check (serving_size_g > 0),

  source text not null default 'manual' check (source in ('off', 'manual')),

  -- on delete set null statt cascade: Loescht ein Nutzer seinen Account, bleibt
  -- das Produkt bestehen. Andere Haushalte haben es laengst in ihren
  -- Tagebucheintraegen referenziert.
  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is
  'Lebensmittel-Stammdaten, global lesbar. Nur selbst angelegte Produkte sind aenderbar.';

-- Volltextsuche auf dem Produktnamen (#75). 'german' bringt Stemming fuer
-- deutsche Wortformen mit — "Tomaten" findet "Tomate".
create index if not exists products_name_fts_idx
  on public.products using gin (to_tsvector('german', name));

create index if not exists products_created_by_idx on public.products (created_by);

-- Inkrementeller Pull der Sync-Engine (#47). Anders als bei den
-- Haushaltstabellen gibt es hier keinen household_id-Praefix: products ist
-- global. Die Sortierung ist (updated_at, id), weil der Pull ueber einen
-- Keyset-Cursor blaettert und bei gleichem Zeitstempel die id als zweites
-- Kriterium braucht.
create index if not exists products_updated_idx on public.products (updated_at, id);

create or replace trigger products_set_updated_at
  before update on public.products
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.products enable row level security;

-- Produktdaten sind nicht personenbezogen und fuer alle Angemeldeten lesbar —
-- anders als alles andere in diesem Schema.
create policy products_select_all on public.products
  for select to authenticated
  using (true);

create policy products_insert_own on public.products
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

-- Nur selbst angelegte Produkte sind aenderbar, und nur manuelle. Ein aus Open
-- Food Facts importierter Datensatz wird von allen Haushalten geteilt und darf
-- nicht von einem einzelnen Nutzer veraendert werden.
create policy products_update_own_manual on public.products
  for update to authenticated
  using ((select auth.uid()) = created_by and source = 'manual')
  with check ((select auth.uid()) = created_by and source = 'manual');
