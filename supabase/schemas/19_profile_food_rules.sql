-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Persoenliche Lebensmittelregeln gehoeren zum Account, nicht zum Haushalt.
-- Die eigene Tabelle verhindert, dass spaetere Erweiterungen an gemeinsam
-- sichtbaren Profilprojektionen diese privaten Angaben versehentlich leaken.

create table if not exists public.profile_food_rules (
  user_id uuid primary key references auth.users (id) on delete cascade,
  allergy_codes text[] not null default '{}',
  custom_allergies text[] not null default '{}',
  intolerance_codes text[] not null default '{}',
  custom_intolerances text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_food_rules_allergy_codes_allowed check (
    allergy_codes <@ array[
      'gluten-containing-cereals',
      'crustaceans',
      'eggs',
      'fish',
      'peanuts',
      'soybeans',
      'milk',
      'tree-nuts',
      'celery',
      'mustard',
      'sesame',
      'sulphur-dioxide-sulphites',
      'lupin',
      'molluscs'
    ]::text[]
    and cardinality(allergy_codes) <= 14
  ),
  constraint profile_food_rules_intolerance_codes_allowed check (
    intolerance_codes <@ array[
      'lactose',
      'fructose-malabsorption',
      'sorbitol-malabsorption',
      'celiac-gluten'
    ]::text[]
    and cardinality(intolerance_codes) <= 4
  ),
  constraint profile_food_rules_custom_counts check (
    cardinality(custom_allergies) <= 64
    and cardinality(custom_intolerances) <= 64
    and cardinality(disliked_foods) <= 64
  )
);

comment on table public.profile_food_rules is
  'Private, accountweite Allergien, Unvertraeglichkeiten und Lebensmittelabneigungen.';

create or replace trigger profile_food_rules_set_updated_at
  before update on public.profile_food_rules
  for each row
  execute function private.set_updated_at();

alter table public.profile_food_rules enable row level security;

create policy profile_food_rules_select_own on public.profile_food_rules
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy profile_food_rules_insert_own on public.profile_food_rules
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy profile_food_rules_update_own on public.profile_food_rules
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- Kinder haben keinen auth.users-Account. Ihre Regeln werden deshalb separat
-- am Kinderprofil gespeichert und duerfen nur vom verwaltenden Elternteil oder
-- einem Haushaltsadministrator gelesen/geaendert werden.
create table if not exists public.child_profile_food_rules (
  child_profile_id uuid primary key references public.child_profiles (id) on delete cascade,
  allergy_codes text[] not null default '{}',
  custom_allergies text[] not null default '{}',
  intolerance_codes text[] not null default '{}',
  custom_intolerances text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint child_profile_food_rules_allergy_codes_allowed check (
    allergy_codes <@ array[
      'gluten-containing-cereals', 'crustaceans', 'eggs', 'fish', 'peanuts',
      'soybeans', 'milk', 'tree-nuts', 'celery', 'mustard', 'sesame',
      'sulphur-dioxide-sulphites', 'lupin', 'molluscs'
    ]::text[]
    and cardinality(allergy_codes) <= 14
  ),
  constraint child_profile_food_rules_intolerance_codes_allowed check (
    intolerance_codes <@ array[
      'lactose', 'fructose-malabsorption', 'sorbitol-malabsorption', 'celiac-gluten'
    ]::text[]
    and cardinality(intolerance_codes) <= 4
  ),
  constraint child_profile_food_rules_custom_counts check (
    cardinality(custom_allergies) <= 64
    and cardinality(custom_intolerances) <= 64
    and cardinality(disliked_foods) <= 64
  )
);

comment on table public.child_profile_food_rules is
  'Private Lebensmittelregeln eines Kinderprofils; sichtbar nur fuer Verwaltung und serverseitige Sicherheitsprojektionen.';

create or replace trigger child_profile_food_rules_set_updated_at
  before update on public.child_profile_food_rules
  for each row
  execute function private.set_updated_at();

alter table public.child_profile_food_rules enable row level security;

create policy child_profile_food_rules_select_manager on public.child_profile_food_rules
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles child
      where child.id = child_profile_food_rules.child_profile_id
        and (
          child.managed_by = (select auth.uid())
          or (select private.is_household_admin(child.household_id))
        )
    )
  );

create policy child_profile_food_rules_insert_manager on public.child_profile_food_rules
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.child_profiles child
      where child.id = child_profile_food_rules.child_profile_id
        and (
          child.managed_by = (select auth.uid())
          or (select private.is_household_admin(child.household_id))
        )
    )
  );

create policy child_profile_food_rules_update_manager on public.child_profile_food_rules
  for update to authenticated
  using (
    exists (
      select 1
      from public.child_profiles child
      where child.id = child_profile_food_rules.child_profile_id
        and (
          child.managed_by = (select auth.uid())
          or (select private.is_household_admin(child.household_id))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.child_profiles child
      where child.id = child_profile_food_rules.child_profile_id
        and (
          child.managed_by = (select auth.uid())
          or (select private.is_household_admin(child.household_id))
        )
    )
  );
