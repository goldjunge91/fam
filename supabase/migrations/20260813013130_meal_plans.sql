-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.meal_plan_entries (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  meal_plan_id  uuid                     NOT NULL,
  household_id  uuid                     NOT NULL,
  recipe_id     uuid                     NOT NULL,
  entry_date    date                     NOT NULL,
  meal_slot     text                     NOT NULL,
  servings_mode text                     DEFAULT 'portions'::text NOT NULL,
  portions      numeric(6,2)             NOT NULL,
  people_count  integer,
  created_by    uuid,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at    timestamp with time zone
);

COMMENT ON TABLE public.meal_plan_entries IS 'Ein Rezept an einem Tag/einer Mahlzeit eines Wochenplans (#128). Nur Mengen (portions/people_count), keine Zuordnung zu einzelnen Haushaltsmitgliedern.';

ALTER TABLE public.meal_plan_entries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_meal_slot_check CHECK (meal_slot = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text]));

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_people_count_check CHECK (people_count > 0);

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_people_count_matches_mode CHECK (servings_mode = 'people'::text AND people_count IS
    NOT NULL OR servings_mode = 'portions'::text AND people_count IS NULL);

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_portions_check CHECK (portions > 0::numeric);

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_servings_mode_check CHECK (servings_mode = ANY (ARRAY['portions'::text, 'people'::text]));

GRANT ALL ON public.meal_plan_entries TO anon;

GRANT ALL ON public.meal_plan_entries TO authenticated;

GRANT ALL ON public.meal_plan_entries TO service_role;

CREATE INDEX meal_plan_entries_recipe_id_idx ON public.meal_plan_entries (recipe_id);

CREATE INDEX meal_plan_entries_household_updated_idx ON public.meal_plan_entries (household_id, updated_at);

CREATE INDEX meal_plan_entries_meal_plan_id_idx ON public.meal_plan_entries (meal_plan_id);

CREATE INDEX meal_plan_entries_entry_date_idx ON public.meal_plan_entries (meal_plan_id, entry_date);

CREATE TRIGGER meal_plan_entries_set_updated_at
  BEFORE UPDATE ON public.meal_plan_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY meal_plan_entries_household ON public.meal_plan_entries
  TO authenticated
  USING (( SELECT private.is_household_member(meal_plan_entries.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(meal_plan_entries.household_id) AS is_household_member));

CREATE TABLE public.meal_plans (
  id              uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id    uuid                     NOT NULL,
  name            text                     NOT NULL,
  week_start_date date                     NOT NULL,
  created_by      uuid,
  created_at      timestamp with time zone DEFAULT now() NOT NULL,
  updated_at      timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at      timestamp with time zone
);

COMMENT ON TABLE public.meal_plans IS 'Wochenplan, haushaltsweit geteilt (#128). Ein Eintrag pro Haushalt und Kalenderwoche, siehe meal_plans_household_week_unique.';

ALTER TABLE public.meal_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 120);

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_pkey PRIMARY KEY (id);

ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_meal_plan_id_fkey FOREIGN KEY (meal_plan_id) REFERENCES public.meal_plans(id) ON DELETE CASCADE;

GRANT ALL ON public.meal_plans TO anon;

GRANT ALL ON public.meal_plans TO authenticated;

GRANT ALL ON public.meal_plans TO service_role;

CREATE UNIQUE INDEX meal_plans_household_week_unique ON public.meal_plans (household_id, week_start_date)
  WHERE deleted_at IS NULL;

CREATE INDEX meal_plans_household_updated_idx ON public.meal_plans (household_id, updated_at);

CREATE INDEX meal_plans_household_id_idx ON public.meal_plans (household_id);

CREATE TRIGGER meal_plans_set_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY meal_plans_household ON public.meal_plans
  TO authenticated
  USING (( SELECT private.is_household_member(meal_plans.household_id) AS is_household_member))
  WITH CHECK (( SELECT private.is_household_member(meal_plans.household_id) AS is_household_member));