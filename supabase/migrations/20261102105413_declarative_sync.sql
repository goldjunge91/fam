SET local check_function_bodies = off;

DROP POLICY "child_profiles_delete_manager" ON "public"."child_profiles";

CREATE OR REPLACE FUNCTION private.guard_last_admin()
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

  -- Rollenänderungen im selben Haushalt serialisieren, damit parallele
  -- Herabstufungen nicht beide den jeweils anderen Admin als verbleibend sehen.
  -- Bei einer Haushalts-Cascade ist die Elternzeile bereits entfernt.
  perform 1
  from public.households
  where id = old.household_id
  for update;

  if not found then
    return coalesce(new, old);
  end if;

  -- Verbleiben nach dieser Aenderung ueberhaupt keine anderen Mitglieder mehr,
  -- gibt es ebenfalls niemanden, der ohne Admin zurueckbliebe — der Fall
  -- "letzter Admin verlaesst einen Haushalt, der dadurch leer wird" ist erlaubt,
  -- nur "anderen Mitgliedern den Admin entziehen" nicht.
  select count(*) into remaining
  from public.household_members
  where household_id = old.household_id
    and user_id <> old.user_id;

  if remaining = 0 and tg_op = 'DELETE' then
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

CREATE POLICY "child_profiles_delete_manager" ON "public"."child_profiles"
  FOR DELETE
  TO "authenticated"
  USING
    ((( SELECT private.is_household_member(child_profiles.household_id) AS is_household_member) AND ((managed_by = ( SELECT auth.uid() AS uid)) OR ( SELECT
    private.is_household_admin(child_profiles.household_id) AS is_household_admin))));
