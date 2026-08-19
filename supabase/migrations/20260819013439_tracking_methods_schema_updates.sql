-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.food_entries
  ADD COLUMN logged_at timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE public.glucose_entries
  ADD COLUMN food_entry_id uuid;

ALTER TABLE public.glucose_entries
  ADD CONSTRAINT glucose_entries_food_entry_id_fkey FOREIGN KEY (food_entry_id) REFERENCES public.food_entries(id) ON DELETE SET NULL;

CREATE INDEX glucose_entries_food_entry_id_idx ON public.glucose_entries (food_entry_id);

ALTER TABLE public.medication_logs
  ADD COLUMN injection_site text;

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_injection_site_check CHECK (injection_site = ANY (ARRAY['abdomen'::text, 'thigh'::text, 'upper_arm'::text, 'other'::text]));

ALTER TABLE public.user_goals
  ADD COLUMN net_carbs_g integer;

ALTER TABLE public.user_goals
  ADD CONSTRAINT user_goals_net_carbs_g_check CHECK (net_carbs_g >= 0);