SET local check_function_bodies = off;

DROP POLICY "recipe_covers_select" ON "storage"."objects";

DROP POLICY "recipe_step_images_insert" ON "storage"."objects";

DROP POLICY "recipe_step_images_select" ON "storage"."objects";

CREATE OR REPLACE FUNCTION private.delete_orphaned_household()
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

  -- Der ganze Haushalt wird gerade mitgeloescht (`delete from households`
  -- kaskadiert hierher): Bei `on delete cascade` ist die Elternzeile zum
  -- Zeitpunkt dieses Row-Triggers bereits weg (empirisch geprueft, nicht nur
  -- angenommen). Dann gibt es keinen Haushalt mehr, den ein fehlender Admin
  -- verwaisen liesse — die Sperre waere hier nur im Weg (#98/#64).
  if not exists (select 1 from public.households where id = old.household_id) then
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

  if remaining = 0 then
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

CREATE OR REPLACE FUNCTION private.is_household_admin (
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

CREATE OR REPLACE FUNCTION private.is_household_member (
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

  insert into public.stores (household_id, name, color, sort_order)
  values
    (new_id, 'REWE', '#B5623F', 0),
    (new_id, 'Edeka', '#748C5B', 1),
    (new_id, 'Aldi', '#5C7396', 2);

  return new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.household_member_profiles (
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

CREATE POLICY "recipe_covers_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'recipe-covers'::text) AND
CASE
    WHEN ((storage.foldername(name))[1] = ANY (ARRAY['templates'::text, 'catalog'::text])) THEN true
    ELSE ( SELECT private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member)
END));

CREATE POLICY "recipe_step_images_insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'recipe-step-images'::text) AND (((storage.foldername(name))[1] = 'catalog'::text) OR ( SELECT
    private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member))));

CREATE POLICY "recipe_step_images_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING
    (((bucket_id = 'recipe-step-images'::text) AND (((storage.foldername(name))[1] = 'catalog'::text) OR ( SELECT
    private.is_household_member(((storage.foldername(objects.name))[1])::uuid) AS is_household_member))));
