-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.exercises (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid,
  name         text                     NOT NULL,
  category     text                     DEFAULT 'strength'::text NOT NULL,
  muscle_group text,
  is_custom    boolean                  DEFAULT false NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.exercises IS 'Uebungskatalog. Globale Uebungen (user_id is null) sind fuer alle lesbar, eigene nur privat.';

ALTER TABLE public.exercises
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_category_check
    CHECK (category = ANY (ARRAY['strength'::text, 'cardio'::text, 'bodyweight'::text, 'machine'::text, 'dumbbell'::text, 'barbell'::text, 'cable'::text, 'other'::text]));

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_muscle_group_check
    CHECK (muscle_group = ANY (ARRAY['chest'::text, 'back'::text, 'legs'::text, 'shoulders'::text, 'biceps'::text, 'triceps'::text, 'abs'::text, 'full_body'::text, 'other'::text]));

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 200);

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.exercises TO anon;

GRANT ALL ON public.exercises TO authenticated;

GRANT ALL ON public.exercises TO service_role;

CREATE INDEX exercises_user_id_idx ON public.exercises (user_id);

CREATE INDEX exercises_name_idx ON public.exercises (name);

CREATE TRIGGER exercises_set_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY exercises_delete_own ON public.exercises
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY exercises_insert_own ON public.exercises
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY exercises_select ON public.exercises
  FOR SELECT
  TO authenticated
  USING (((user_id IS NULL) OR (( SELECT auth.uid() AS uid) = user_id)));

CREATE POLICY exercises_update_own ON public.exercises
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.fasting_sessions (
  id                      uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id                 uuid                     NOT NULL,
  child_profile_id        uuid,
  protocol                text                     DEFAULT '16:8'::text NOT NULL,
  started_at              timestamp with time zone DEFAULT now() NOT NULL,
  target_duration_minutes integer                  NOT NULL,
  ended_at                timestamp with time zone,
  notes                   text,
  created_at              timestamp with time zone DEFAULT now() NOT NULL,
  updated_at              timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at              timestamp with time zone
);

COMMENT ON TABLE public.fasting_sessions IS 'Streng privat pro Account. Aufgezeichnete Fastenfenster und Zielzeiten.';

ALTER TABLE public.fasting_sessions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fasting_sessions
  ADD CONSTRAINT fasting_sessions_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.fasting_sessions
  ADD CONSTRAINT fasting_sessions_pkey PRIMARY KEY (id);

ALTER TABLE public.fasting_sessions
  ADD CONSTRAINT fasting_sessions_protocol_check CHECK (protocol = ANY (ARRAY['16:8'::text, '18:6'::text, '20:4'::text, '5:2'::text, 'omad'::text, 'custom'::text]));

ALTER TABLE public.fasting_sessions
  ADD CONSTRAINT fasting_sessions_target_duration_minutes_check CHECK (target_duration_minutes > 0);

ALTER TABLE public.fasting_sessions
  ADD CONSTRAINT fasting_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.fasting_sessions TO anon;

GRANT ALL ON public.fasting_sessions TO authenticated;

GRANT ALL ON public.fasting_sessions TO service_role;

CREATE INDEX fasting_sessions_child_id_idx ON public.fasting_sessions (child_profile_id);

CREATE INDEX fasting_sessions_user_start_idx ON public.fasting_sessions (user_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER fasting_sessions_set_updated_at
  BEFORE UPDATE ON public.fasting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY fasting_sessions_own ON public.fasting_sessions
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.food_entries
  ADD COLUMN fiber_g numeric(7,2);

ALTER TABLE public.food_entries
  ADD CONSTRAINT food_entries_fiber_g_check CHECK (fiber_g >= 0::numeric);

CREATE TABLE public.glucose_entries (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  measured_at      timestamp with time zone DEFAULT now() NOT NULL,
  glucose_value    numeric(5,1)             NOT NULL,
  unit             text                     DEFAULT 'mg_dl'::text NOT NULL,
  context          text,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.glucose_entries IS 'Streng privat pro Account. Manuelle Glukosemessungen und CGM-Logs.';

ALTER TABLE public.glucose_entries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_context_check
    CHECK (context = ANY (ARRAY['fasting'::text, 'morning_fasting'::text, 'pre_meal'::text, 'post_meal_1h'::text, 'post_meal_2h'::text, 'bedtime'::text, 'other'::text]));

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_glucose_value_check CHECK (glucose_value > 0::numeric AND glucose_value < 1000::numeric);

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_unit_check CHECK (unit = ANY (ARRAY['mg_dl'::text, 'mmol_l'::text]));

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.glucose_entries TO anon;

GRANT ALL ON public.glucose_entries TO authenticated;

GRANT ALL ON public.glucose_entries TO service_role;

CREATE INDEX glucose_entries_child_id_idx ON public.glucose_entries (child_profile_id);

CREATE INDEX glucose_entries_user_measured_idx ON public.glucose_entries (user_id, measured_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER glucose_entries_set_updated_at
  BEFORE UPDATE ON public.glucose_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY glucose_entries_own ON public.glucose_entries
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.ketone_entries (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  measured_at      timestamp with time zone DEFAULT now() NOT NULL,
  ketone_value     numeric(5,2)             NOT NULL,
  unit             text                     DEFAULT 'mmol_l'::text NOT NULL,
  source           text                     DEFAULT 'blood'::text NOT NULL,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.ketone_entries IS 'Streng privat pro Account. Keton-Messwerte fuer Low-Carb und Ketose-Tracking.';

ALTER TABLE public.ketone_entries
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_ketone_value_check CHECK (ketone_value >= 0::numeric AND ketone_value < 100::numeric);

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_source_check CHECK (source = ANY (ARRAY['blood'::text, 'breath'::text, 'urine'::text]));

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_unit_check CHECK (unit = ANY (ARRAY['mmol_l'::text, 'ppm'::text, 'mg_dl'::text, 'level'::text]));

ALTER TABLE public.ketone_entries
  ADD CONSTRAINT ketone_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.ketone_entries TO anon;

GRANT ALL ON public.ketone_entries TO authenticated;

GRANT ALL ON public.ketone_entries TO service_role;

CREATE INDEX ketone_entries_user_measured_idx ON public.ketone_entries (user_id, measured_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ketone_entries_child_id_idx ON public.ketone_entries (child_profile_id);

CREATE TRIGGER ketone_entries_set_updated_at
  BEFORE UPDATE ON public.ketone_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY ketone_entries_own ON public.ketone_entries
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.medication_logs (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  medication_name  text                     NOT NULL,
  dose             numeric(7,2),
  unit             text                     DEFAULT 'mg'::text NOT NULL,
  administered_at  timestamp with time zone DEFAULT now() NOT NULL,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.medication_logs IS 'Streng privat pro Account. Protokollierung von Medikamenten/GLP-1 Injektionen.';

ALTER TABLE public.medication_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_dose_check CHECK (dose > 0::numeric);

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_medication_name_check CHECK (length(TRIM(BOTH FROM medication_name)) >= 1 AND length(TRIM(BOTH FROM medication_name)) <= 200);

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_unit_check CHECK (unit = ANY (ARRAY['mg'::text, 'ml'::text, 'units'::text, 'mcg'::text, 'pills'::text]));

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.medication_logs TO anon;

GRANT ALL ON public.medication_logs TO authenticated;

GRANT ALL ON public.medication_logs TO service_role;

CREATE INDEX medication_logs_child_id_idx ON public.medication_logs (child_profile_id);

CREATE INDEX medication_logs_user_admin_idx ON public.medication_logs (user_id, administered_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER medication_logs_set_updated_at
  BEFORE UPDATE ON public.medication_logs
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY medication_logs_own ON public.medication_logs
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER TABLE public.profiles
  ADD COLUMN module_glp1 boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_fasting boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_workouts boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_keto boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_cgm boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN module_volumetrics boolean DEFAULT true NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN tracking_day_start_time text DEFAULT '00:00'::text NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tracking_day_start_time_check CHECK (tracking_day_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text);

CREATE TABLE public.symptom_logs (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  logged_at        timestamp with time zone DEFAULT now() NOT NULL,
  appetite_level   integer,
  satiety_level    integer,
  nausea_level     integer,
  side_effects     text[]                   DEFAULT '{}'::text[] NOT NULL,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.symptom_logs IS 'Streng privat pro Account. Verlauf von Appetit, Saettigung und Nebenwirkungen.';

ALTER TABLE public.symptom_logs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_appetite_level_check CHECK (appetite_level >= 1 AND appetite_level <= 5);

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_nausea_level_check CHECK (nausea_level >= 0 AND nausea_level <= 5);

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_pkey PRIMARY KEY (id);

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_satiety_level_check CHECK (satiety_level >= 1 AND satiety_level <= 5);

ALTER TABLE public.symptom_logs
  ADD CONSTRAINT symptom_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.symptom_logs TO anon;

GRANT ALL ON public.symptom_logs TO authenticated;

GRANT ALL ON public.symptom_logs TO service_role;

CREATE INDEX symptom_logs_child_id_idx ON public.symptom_logs (child_profile_id);

CREATE INDEX symptom_logs_user_logged_idx ON public.symptom_logs (user_id, logged_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER symptom_logs_set_updated_at
  BEFORE UPDATE ON public.symptom_logs
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY symptom_logs_own ON public.symptom_logs
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.workout_sessions (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  child_profile_id uuid,
  name             text                     DEFAULT 'Workout'::text NOT NULL,
  started_at       timestamp with time zone DEFAULT now() NOT NULL,
  ended_at         timestamp with time zone,
  notes            text,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at       timestamp with time zone
);

COMMENT ON TABLE public.workout_sessions IS 'Streng privat pro Account. Aufgezeichnete Trainingseinheiten.';

ALTER TABLE public.workout_sessions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_child_profile_id_fkey FOREIGN KEY (child_profile_id) REFERENCES public.child_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 200);

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_pkey PRIMARY KEY (id);

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT ALL ON public.workout_sessions TO anon;

GRANT ALL ON public.workout_sessions TO authenticated;

GRANT ALL ON public.workout_sessions TO service_role;

CREATE INDEX workout_sessions_child_id_idx ON public.workout_sessions (child_profile_id);

CREATE INDEX workout_sessions_user_start_idx ON public.workout_sessions (user_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER workout_sessions_set_updated_at
  BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY workout_sessions_own ON public.workout_sessions
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.workout_sets (
  id                 uuid                     DEFAULT gen_random_uuid() NOT NULL,
  workout_session_id uuid                     NOT NULL,
  exercise_id        uuid                     NOT NULL,
  set_order          integer                  NOT NULL,
  set_type           text                     DEFAULT 'work'::text NOT NULL,
  weight_kg          numeric(6,2),
  reps               integer,
  rpe                numeric(3,1),
  notes              text,
  created_at         timestamp with time zone DEFAULT now() NOT NULL,
  updated_at         timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at         timestamp with time zone
);

COMMENT ON TABLE public.workout_sets IS 'Streng privat pro Account. Saetze, Wiederholungen und Gewichte einer Session.';

ALTER TABLE public.workout_sets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE RESTRICT;

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_pkey PRIMARY KEY (id);

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_reps_check CHECK (reps >= 0 AND reps < 1000);

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_rpe_check CHECK (rpe >= 1::numeric AND rpe <= 10::numeric);

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_set_order_check CHECK (set_order >= 1);

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_set_type_check CHECK (set_type = ANY (ARRAY['warmup'::text, 'work'::text, 'drop'::text, 'failure'::text]));

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_weight_kg_check CHECK (weight_kg >= 0::numeric AND weight_kg < 1000::numeric);

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_workout_session_id_fkey FOREIGN KEY (workout_session_id) REFERENCES public.workout_sessions(id) ON DELETE CASCADE;

GRANT ALL ON public.workout_sets TO anon;

GRANT ALL ON public.workout_sets TO authenticated;

GRANT ALL ON public.workout_sets TO service_role;

CREATE INDEX workout_sets_session_idx ON public.workout_sets (workout_session_id);

CREATE INDEX workout_sets_exercise_idx ON public.workout_sets (exercise_id);

CREATE TRIGGER workout_sets_set_updated_at
  BEFORE UPDATE ON public.workout_sets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY workout_sets_own ON public.workout_sets
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.workout_sessions s
  WHERE ((s.id = workout_sets.workout_session_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workout_sessions s
  WHERE ((s.id = workout_sets.workout_session_id) AND (s.user_id = ( SELECT auth.uid() AS uid))))));