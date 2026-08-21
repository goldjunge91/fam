-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Kraftsport & Workout-Log (#175): Uebungen, Saetze, Wdh., Gewichte, Progressive Overload.
--
-- Streng privat: Kein Zugriff durch Haushaltsmitglieder.

-- ------------------------------------------------------------------ Uebungen
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,

  name text not null check (length(trim(name)) between 1 and 200),
  category text not null default 'strength'
    check (category in ('strength', 'cardio', 'bodyweight', 'machine', 'dumbbell', 'barbell', 'cable', 'other')),
  muscle_group text check (
    muscle_group in ('chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'full_body', 'other')
  ),
  is_custom boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.exercises is
  'Uebungskatalog. Globale Uebungen (user_id is null) sind fuer alle lesbar, eigene nur privat.';

create index if not exists exercises_user_id_idx on public.exercises (user_id);
create index if not exists exercises_name_idx on public.exercises (name);

create or replace trigger exercises_set_updated_at
  before update on public.exercises
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------- Workout-Sessions
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  child_profile_id uuid references public.child_profiles (id) on delete cascade,

  name text not null default 'Workout' check (length(trim(name)) between 1 and 200),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.workout_sessions is
  'Streng privat pro Account. Aufgezeichnete Trainingseinheiten.';

create index if not exists workout_sessions_user_start_idx
  on public.workout_sessions (user_id, started_at desc)
  where deleted_at is null;
create index if not exists workout_sessions_child_id_idx
  on public.workout_sessions (child_profile_id);

create or replace trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row
  execute function private.set_updated_at();

-- -------------------------------------------------------------- Workout-Sets
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,

  set_order integer not null check (set_order >= 1),
  set_type text not null default 'work'
    check (set_type in ('warmup', 'work', 'drop', 'failure')),

  weight_kg numeric(6, 2) check (weight_kg >= 0 and weight_kg < 1000),
  reps integer check (reps >= 0 and reps < 1000),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.workout_sets is
  'Streng privat pro Account. Saetze, Wiederholungen und Gewichte einer Session.';

create index if not exists workout_sets_session_idx on public.workout_sets (workout_session_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets (exercise_id);

create or replace trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------------------------- RLS
alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

-- Uebungen: Globale oder eigene
create policy exercises_select on public.exercises
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);

create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy exercises_update_own on public.exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Workout Sessions: Nur der eigene User
create policy workout_sessions_own on public.workout_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Workout Sets: Nur wenn gehoerig zur eigenen Session
create policy workout_sets_own on public.workout_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_session_id
        and s.user_id = (select auth.uid())
    )
  );
