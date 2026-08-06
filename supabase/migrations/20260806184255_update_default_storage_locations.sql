-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.create_household (
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

  insert into public.storage_locations (household_id, name, kind, sort_order)
  values
    (new_id, 'Kühlschrank', 'fridge', 0),
    (new_id, 'Tiefkühltruhe', 'freezer', 1),
    (new_id, 'Abstellkammer', 'pantry', 2);

  return new_id;
end;
$function$;