-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION public.household_member_profiles (
  hid uuid
)
  RETURNS TABLE (
    user_id      uuid,
    display_name text,
    avatar_url   text,
    role         text,
    joined_at    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    m.role,
    m.joined_at
  from public.household_members as m
  -- left join: ein Mitglied ohne Profilzeile darf nicht aus der Liste fallen.
  left join public.profiles as p on p.id = m.user_id
  where m.household_id = hid
    and private.is_household_member(hid)
  order by m.joined_at;
$function$;

COMMENT ON FUNCTION public.household_member_profiles(uuid) IS 'Mitglieder eines Haushalts mit Anzeigename und Avatar. Gibt bewusst NUR diese beiden Profilspalten heraus — die Gesundheitsdaten in profiles bleiben privat.';

REVOKE ALL ON FUNCTION public.household_member_profiles(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.household_member_profiles(uuid) TO authenticated;