-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.food_entries (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  product_id       uuid,
  logged_on        date                     DEFAULT CURRENT_DATE NOT NULL,
  meal_type        text                     NOT NULL,
  quantity         numeric(10,3)            NOT NULL,
  unit             text                     DEFAULT 'g'::text NOT NULL,
  name             text                     NOT NULL,
  kcal             numeric(8,2),
  protein_g        numeric(7,2),
  carbs_g          numeric(7,2),
  fat_g            numeric(7,2),
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.food_entries IS 'Streng privat pro Account. Kein Zugriff durch Haushaltsmitglieder, auch nicht durch Admins.';

ALTER TABLE public.food_entries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_carbs_g_check CHECK (carbs_g >= 0::numeric);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_fat_g_check CHECK (fat_g >= 0::numeric);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_kcal_check CHECK (kcal >= 0::numeric);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_meal_type_check CHECK (meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text]));

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_protein_g_check CHECK (protein_g >= 0::numeric);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_unit_check CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'piece'::text, 'package'::text, 'portion'::text]));

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.food_entries TO anon;

GRANT ALL ON public.food_entries TO authenticated;

GRANT ALL ON public.food_entries TO service_role;

CREATE INDEX food_entries_user_day_idx ON public.food_entries (user_id, logged_on)
  WHERE deleted_at IS NULL;

CREATE INDEX food_entries_product_id_idx ON public.food_entries (product_id);

CREATE INDEX food_entries_child_day_idx ON public.food_entries (child_profile_id, logged_on)
  WHERE deleted_at IS NULL AND child_profile_id IS NOT NULL;

CREATE TRIGGER food_entries_set_updated_at
  BEFORE UPDATE ON public.food_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY food_entries_own ON public.food_entries
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.user_goals (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  goal_type        text                     NOT NULL,
  target_weight_kg numeric(5,2),
  rate_kg_per_week numeric(3,2),
  daily_kcal       integer,
  protein_g        integer,
  carbs_g          integer,
  fat_g            integer,
  valid_from       date                     DEFAULT CURRENT_DATE NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.user_goals IS 'Streng privat pro Account. Historisiert ueber valid_from statt ueberschrieben.';

ALTER TABLE public.user_goals
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_carbs_g_check CHECK (carbs_g >= 0);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_daily_kcal_check CHECK (daily_kcal >= 1000 AND daily_kcal <= 10000);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_fat_g_check CHECK (fat_g >= 0);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_goal_type_check CHECK (goal_type = ANY (ARRAY['lose'::text, 'maintain'::text, 'gain'::text]));

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_pkey PRIMARY KEY (id);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_protein_g_check CHECK (protein_g >= 0);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_rate_kg_per_week_check CHECK (rate_kg_per_week >= 0::numeric AND rate_kg_per_week <= 1::numeric);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_target_weight_kg_check CHECK (target_weight_kg > 0::numeric AND target_weight_kg < 700::numeric);

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.user_goals TO anon;

GRANT ALL ON public.user_goals TO authenticated;

GRANT ALL ON public.user_goals TO service_role;

CREATE INDEX user_goals_user_valid_idx ON public.user_goals (user_id, valid_from DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX user_goals_child_id_idx ON public.user_goals (child_profile_id);

CREATE TRIGGER user_goals_set_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY user_goals_own ON public.user_goals
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.weight_entries (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  measured_on      date                     DEFAULT CURRENT_DATE NOT NULL,
  weight_kg        numeric(5,2)             NOT NULL,
  waist_cm         numeric(5,1),
  chest_cm         numeric(5,1),
  hip_cm           numeric(5,1),
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.weight_entries IS 'Streng privat pro Account. Kein Zugriff durch Haushaltsmitglieder.';

ALTER TABLE public.weight_entries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_chest_cm_check CHECK (chest_cm > 0::numeric);

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_hip_cm_check CHECK (hip_cm > 0::numeric);

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_waist_cm_check CHECK (waist_cm > 0::numeric);

ALTER TABLE public.weight_entries
  ADD CONSTRAINT weight_entries_weight_kg_check CHECK (weight_kg > 0::numeric AND weight_kg < 700::numeric);

GRANT ALL ON public.weight_entries TO anon;

GRANT ALL ON public.weight_entries TO authenticated;

GRANT ALL ON public.weight_entries TO service_role;

CREATE INDEX weight_entries_user_day_idx ON public.weight_entries (user_id, measured_on)
  WHERE deleted_at IS NULL;

CREATE INDEX weight_entries_child_id_idx ON public.weight_entries (child_profile_id);

CREATE TRIGGER weight_entries_set_updated_at
  BEFORE UPDATE ON public.weight_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY weight_entries_own ON public.weight_entries
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));