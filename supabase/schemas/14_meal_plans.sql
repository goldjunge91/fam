-- Gewuenschter Endzustand — NICHT von Hand migrieren (#41, #123, #128).
--
-- Meal-Planner / Wochenplanung (Epic #15, entschieden in
-- docs/plans/phase-2-4-brainstorm.md, Abschnitt "#15 — Meal-Planner
-- (Wochenplanung)").
--
-- Ein Wochenplan (`meal_plans`) buendelt die Eintraege einer Kalenderwoche.
-- Ein Eintrag (`meal_plan_entries`) ordnet ein Rezept einem Tag und einer
-- Mahlzeit zu, mit einer Mengenangabe (Portionen oder Personen). Bewusst
-- KEINE Zuordnung zu einzelnen Haushaltsmitgliedern/Profilen — nur Mengen,
-- siehe die Entscheidung vom 2026-08-12 im Brainstorm-Dokument. Damit
-- entfaellt auch jede Notwendigkeit, Gaeste oder abwesende Mitglieder
-- gesondert zu behandeln.

-- ---------------------------------------------------------------- Wochenplan
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Frei benennbar (z. B. "Woche 34" oder "Grillwoche"), Default kommt vom
  -- Client aus week_start_date — kein DB-generierter Text noetig.
  name text not null check (length(trim(name)) between 1 and 120),
  -- Montag der geplanten Kalenderwoche. Alle Eintraege dieses Plans liegen
  -- zwischen week_start_date und week_start_date + 6 Tagen; die DB erzwingt
  -- das nicht (siehe Kommentar an meal_plan_entries.entry_date), damit ein
  -- Plan sich nicht selbst im Weg steht, wenn ein Eintrag testweise
  -- ausserhalb der Woche verschoben wird.
  week_start_date date not null,

  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.meal_plans is
  'Wochenplan, haushaltsweit geteilt (#128). Ein Eintrag pro Haushalt und Kalenderwoche, siehe meal_plans_household_week_unique.';

-- Pro Haushalt und Woche genau ein (nicht geloeschter) Plan: "letzte Woche
-- erneut verwenden" (#129) und das Anlegen eines neuen Wochenplans muessen
-- sich auf einen eindeutigen Datensatz je week_start_date verlassen koennen,
-- sonst waere unklar, welcher von mehreren Plaenen derselben Woche gemeint ist.
create unique index if not exists meal_plans_household_week_unique
  on public.meal_plans (household_id, week_start_date)
  where deleted_at is null;

create index if not exists meal_plans_household_id_idx
  on public.meal_plans (household_id);
-- Inkrementeller Pull der Sync-Engine (#47), analog zu recipes.
create index if not exists meal_plans_household_updated_idx
  on public.meal_plans (household_id, updated_at);

create or replace trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row
  execute function private.set_updated_at();

-- --------------------------------------------------------------- Eintraege
create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  -- Denormalisiert wie household_id auf recipe_components: spart den Join
  -- ueber meal_plans in der RLS-Policy und im Sync-Index.
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,

  -- Konkretes Kalenderdatum statt eines day_of_week-Enums: "letzte Woche
  -- erneut verwenden" (#129) kopiert Eintraege per simpler +7-Tage-Addition
  -- auf entry_date, ohne Wochentag<->Datum erst zurueckrechnen zu muessen.
  entry_date date not null,
  -- Kein 'snack': der Wochenplan bildet nur die drei Hauptmahlzeiten ab
  -- (Produktentscheidung, siehe PR-Feedback zu #129 — anders als das
  -- Kalorien-Tagebuch, das 'snack' als Eintragskategorie kennt).
  meal_slot text not null
    check (meal_slot in ('breakfast', 'lunch', 'dinner')),

  -- Portionen-/Personen-Eingabe (#130). servings_mode bestimmt, welche
  -- Eingabe die urspruengliche Nutzer-Absicht war; portions ist in beiden
  -- Faellen der kanonische, bereits umgerechnete Wert, den #131 fuer die
  -- Bedarfsberechnung verwendet — sonst muesste jede lesende Stelle die
  -- Umrechnung (Personen * Faktor) selbst wiederholen.
  servings_mode text not null default 'portions'
    check (servings_mode in ('portions', 'people')),
  portions numeric(6, 2) not null check (portions > 0),
  -- Nur im Personen-Modus gesetzt; der Umrechnungsfaktor selbst ist eine
  -- Geraete-/App-Einstellung (src/features/meal-planner/settings.ts), keine
  -- DB-Spalte — er gilt fuer die Anzeige/Neuberechnung im Formular, nicht fuer
  -- das gespeicherte Ergebnis.
  people_count integer check (people_count > 0),

  created_by uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint meal_plan_entries_people_count_matches_mode
    check (
      (servings_mode = 'people' and people_count is not null)
      or (servings_mode = 'portions' and people_count is null)
    )
);

comment on table public.meal_plan_entries is
  'Ein Rezept an einem Tag/einer Mahlzeit eines Wochenplans (#128). Nur Mengen (portions/people_count), keine Zuordnung zu einzelnen Haushaltsmitgliedern.';

create index if not exists meal_plan_entries_meal_plan_id_idx
  on public.meal_plan_entries (meal_plan_id);
create index if not exists meal_plan_entries_recipe_id_idx
  on public.meal_plan_entries (recipe_id);
create index if not exists meal_plan_entries_entry_date_idx
  on public.meal_plan_entries (meal_plan_id, entry_date);
create index if not exists meal_plan_entries_household_updated_idx
  on public.meal_plan_entries (household_id, updated_at);

create or replace trigger meal_plan_entries_set_updated_at
  before update on public.meal_plan_entries
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;

create policy meal_plans_household on public.meal_plans
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

create policy meal_plan_entries_household on public.meal_plan_entries
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));
