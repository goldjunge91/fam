-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.delete_orphaned_household()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = old.household_id
  ) then
    delete from public.households where id = old.household_id;
  end if;

  return old;
end;
$function$;

REVOKE ALL ON FUNCTION private.delete_orphaned_household() FROM PUBLIC;

CREATE TRIGGER household_members_delete_orphaned_household
  AFTER DELETE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION private.delete_orphaned_household();
