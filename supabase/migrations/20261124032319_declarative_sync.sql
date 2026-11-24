SET local check_function_bodies = off;

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

DROP POLICY "profiles_insert_own" ON "public"."profiles";

ALTER TABLE "public"."profiles"
  ADD COLUMN "onboarding_required_at" timestamp WITH time zone;

CREATE OR REPLACE FUNCTION private.guard_profile_onboarding_state()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if (select auth.uid()) is not null then
    if new.onboarding_required_at is distinct from old.onboarding_required_at then
      raise exception using
        errcode = '42501',
        message = 'onboarding_required_at wird serverseitig verwaltet';
    end if;

    if old.onboarding_completed_at is not null
      and new.onboarding_completed_at is null then
      raise exception using
        errcode = '42501',
        message = 'onboarding_completed_at kann nicht zurückgesetzt werden';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, display_name, onboarding_required_at)
  values (
    new.id,
    -- Beim E-Mail-Signup ist noch kein Name bekannt; der lokale Teil der
    -- Adresse ist ein brauchbarer Startwert, den der Nutzer in #57 ueberschreibt.
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.created_at
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

CREATE TRIGGER profiles_guard_onboarding_state
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_onboarding_state();

REVOKE ALL ON FUNCTION "private"."guard_profile_onboarding_state"() FROM PUBLIC;
