-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.injection_plans (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid                     NOT NULL,
  medication_name  text                     NOT NULL,
  dose             numeric(7,2)             NOT NULL,
  unit             text                     DEFAULT 'mg'::text NOT NULL,
  cadence_days     integer                  NOT NULL,
  anchor_at        timestamp with time zone NOT NULL,
  reminder_enabled boolean                  DEFAULT true NOT NULL,
  created_at       timestamp with time zone DEFAULT now() NOT NULL,
  updated_at       timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.injection_plans IS 'Streng privater, expliziter Injektionsrhythmus pro Account.';

ALTER TABLE public.injection_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_cadence_days_check CHECK (cadence_days > 0);

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_dose_check CHECK (dose > 0::numeric);

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_medication_name_check CHECK (length(TRIM(BOTH FROM medication_name)) >= 1 AND length(TRIM(BOTH FROM medication_name)) <= 200);

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_pkey PRIMARY KEY (id);

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_unit_check CHECK (unit = ANY (ARRAY['mg'::text, 'ml'::text, 'units'::text, 'mcg'::text, 'pills'::text]));

ALTER TABLE public.injection_plans
  ADD CONSTRAINT injection_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.injection_plans TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.injection_plans TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.injection_plans TO service_role;

CREATE INDEX injection_plans_user_id_idx ON public.injection_plans (user_id);

CREATE TRIGGER injection_plans_set_updated_at
  BEFORE UPDATE ON public.injection_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY injection_plans_own ON public.injection_plans
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));