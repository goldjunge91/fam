-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

CREATE TABLE public.child_profiles (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  household_id uuid                     NOT NULL,
  managed_by   uuid,
  display_name text                     NOT NULL,
  birth_date   date,
  sex          text,
  height_cm    numeric(5,1),
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.child_profiles IS 'Profile ohne eigenen Auth-Account, verwaltet durch ein Haushaltsmitglied.';

ALTER TABLE public.child_profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_display_name_check CHECK (length(TRIM(BOTH FROM display_name)) >= 1 AND length(TRIM(BOTH FROM display_name)) <= 80);

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_height_cm_check CHECK (height_cm > 0::numeric AND height_cm < 300::numeric);

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_managed_by_fkey FOREIGN KEY (managed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_sex_check CHECK (sex = ANY (ARRAY['male'::text, 'female'::text]));

GRANT ALL ON public.child_profiles TO anon;

GRANT ALL ON public.child_profiles TO authenticated;

GRANT ALL ON public.child_profiles TO service_role;

CREATE INDEX child_profiles_managed_by_idx ON public.child_profiles (managed_by);

CREATE INDEX child_profiles_household_id_idx ON public.child_profiles (household_id);

CREATE TRIGGER child_profiles_set_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY child_profiles_delete_manager ON public.child_profiles
  FOR DELETE
  TO authenticated
  USING (((managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child_profiles.household_id) AS is_household_admin)));

CREATE POLICY child_profiles_insert_member ON public.child_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT private.is_household_member(child_profiles.household_id) AS is_household_member) AND (managed_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY child_profiles_select_member ON public.child_profiles
  FOR SELECT
  TO authenticated
  USING (( SELECT private.is_household_member(child_profiles.household_id) AS is_household_member));

CREATE POLICY child_profiles_update_manager ON public.child_profiles
  FOR UPDATE
  TO authenticated
  USING (((managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_household_admin(child_profiles.household_id) AS is_household_admin)))
  WITH CHECK (( SELECT private.is_household_member(child_profiles.household_id) AS is_household_member));