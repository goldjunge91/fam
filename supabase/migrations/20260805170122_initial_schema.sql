-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE SCHEMA private AUTHORIZATION postgres;

GRANT USAGE ON SCHEMA private TO authenticated;

CREATE FUNCTION private.guard_last_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  removed_admin boolean;
  remaining integer;
begin
  removed_admin := (tg_op = 'DELETE' and old.role = 'admin')
    or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin');

  if not removed_admin then
    return coalesce(new, old);
  end if;

  select count(*) into remaining
  from public.household_members
  where household_id = old.household_id
    and role = 'admin'
    and user_id <> old.user_id;

  if remaining = 0 then
    raise exception 'Der letzte Administrator kann den Haushalt nicht verlassen. Ernenne zuerst jemand anderen.';
  end if;

  return coalesce(new, old);
end;
$function$;

REVOKE ALL ON FUNCTION private.guard_last_admin() FROM PUBLIC;

CREATE FUNCTION private.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Beim E-Mail-Signup ist noch kein Name bekannt; der lokale Teil der
    -- Adresse ist ein brauchbarer Startwert, den der Nutzer in #57 ueberschreibt.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

CREATE FUNCTION private.is_household_admin (
  hid uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$function$;

REVOKE ALL ON FUNCTION private.is_household_admin(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.is_household_admin(uuid) TO authenticated;

CREATE FUNCTION private.is_household_member (
  hid uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION private.is_household_member(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION private.is_household_member(uuid) TO authenticated;

CREATE FUNCTION private.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;

CREATE FUNCTION public.create_household (
  household_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.households (name, created_by)
  values (household_name, uid)
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, uid, 'admin');

  return new_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.create_household(text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.create_household(text) TO authenticated;

CREATE TABLE public.household_members (
  household_id uuid                     NOT NULL,
  user_id      uuid                     NOT NULL,
  role         text                     DEFAULT 'member'::text NOT NULL,
  joined_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.household_members
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_pkey PRIMARY KEY (household_id, user_id);

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_role_check CHECK (role = ANY (ARRAY['admin'::text, 'member'::text]));

GRANT ALL ON public.household_members TO anon;

GRANT ALL ON public.household_members TO authenticated;

GRANT ALL ON public.household_members TO service_role;

CREATE INDEX household_members_user_id_idx ON public.household_members (user_id);

CREATE TRIGGER household_members_guard_last_admin
  BEFORE DELETE OR UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_last_admin();

CREATE POLICY household_members_delete ON public.household_members
  FOR DELETE
  TO authenticated
  USING ((( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin) OR (user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY household_members_insert_admin ON public.household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin));

CREATE POLICY household_members_select ON public.household_members
  FOR SELECT
  TO authenticated
  USING (( SELECT private.is_household_member(household_members.household_id) AS is_household_member));

CREATE POLICY household_members_update_admin ON public.household_members
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin))
  WITH CHECK (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin));

CREATE TABLE public.households (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  created_by uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.households
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.households
  ADD CONSTRAINT households_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 80);

ALTER TABLE public.households
  ADD CONSTRAINT households_pkey PRIMARY KEY (id);

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

GRANT ALL ON public.households TO anon;

GRANT ALL ON public.households TO authenticated;

GRANT ALL ON public.households TO service_role;

CREATE INDEX households_created_by_idx ON public.households (created_by);

CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY households_delete_admin ON public.households
  FOR DELETE
  TO authenticated
  USING (( SELECT private.is_household_admin(households.id) AS is_household_admin));

CREATE POLICY households_select_member ON public.households
  FOR SELECT
  TO authenticated
  USING (( SELECT private.is_household_member(households.id) AS is_household_member));

CREATE POLICY households_update_admin ON public.households
  FOR UPDATE
  TO authenticated
  USING (( SELECT private.is_household_admin(households.id) AS is_household_admin))
  WITH CHECK (( SELECT private.is_household_admin(households.id) AS is_household_admin));

CREATE TABLE public.profiles (
  id             uuid                     NOT NULL,
  display_name   text,
  avatar_url     text,
  birth_date     date,
  sex            text,
  height_cm      numeric(5,1),
  activity_level text,
  created_at     timestamp with time zone DEFAULT now() NOT NULL,
  updated_at     timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profiles IS 'Stammdaten pro Account. Streng privat — kein Zugriff durch Haushaltsmitglieder.';

COMMENT ON COLUMN public.profiles.sex IS 'Berechnungsbasis fuer Grundumsatz-Formeln, nicht die Geschlechtsidentitaet.';

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_activity_level_check CHECK (activity_level = ANY (ARRAY['sedentary'::text, 'light'::text, 'moderate'::text, 'active'::text, 'very_active'::text]));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_height_cm_check CHECK (height_cm > 0::numeric AND height_cm < 300::numeric);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.households
  ADD CONSTRAINT households_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sex_check CHECK (sex = ANY (ARRAY['male'::text, 'female'::text]));

GRANT ALL ON public.profiles TO anon;

GRANT ALL ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));