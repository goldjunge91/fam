SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  uid uuid := (select auth.uid());
  rec record;
  other_admins integer;
  other_members integer;
  new_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- AI/Plus vorher deaktivieren: sonst verletzt die FK-Aktion auf
  -- ai_subscriber_id gleich den Active-Subscriber-Constraint.
  update public.households
  set ai_active = false, ai_expires_at = null, ai_updated_at = now(), ai_subscriber_id = null
  where ai_subscriber_id = uid;

  delete from public.revenuecat_ai_assignments where subscriber_user_id = uid;

  for rec in
    select household_id from public.revenuecat_plus_assignments where subscriber_user_id = uid
  loop
    delete from public.revenuecat_plus_assignments
    where subscriber_user_id = uid and household_id = rec.household_id;
    perform private.recompute_household_plus(rec.household_id);
  end loop;

  -- Haushalte, in denen dieser Nutzer Admin ist: Bricht ab, wenn er dort der
  -- letzte Admin waere UND noch andere Mitglieder zurueckbliebe. Der Abbruch
  -- rollt die ganze Funktion zurueck — die Edge Function sieht die Exception
  -- und fragt den Nutzer nach einer Entscheidung (Admin uebertragen oder
  -- Haushalt mitloeschen), bevor sie es erneut versucht.
  for rec in
    select hm.household_id, h.name
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = uid and hm.role = 'admin'
  loop
    select count(*) into other_admins
    from public.household_members
    where household_id = rec.household_id and role = 'admin' and user_id <> uid;

    select count(*) into other_members
    from public.household_members
    where household_id = rec.household_id and user_id <> uid;

    if other_admins = 0 and other_members > 0 then
      raise exception 'last_admin_with_members: % (%)', rec.name, rec.household_id
        using errcode = 'FAM01';
    end if;
  end loop;

  -- Haushalte, in denen dieser Nutzer das letzte verbleibende Mitglied ist:
  -- komplett loeschen. Cascade raeumt household_members, child_profiles,
  -- fridge_items, shopping_list_items usw. mit ab (#98 AC "Haushalte mit
  -- weiteren Mitgliedern bleiben bestehen" — dieser Haushalt hat keine).
  delete from public.households h
  where exists (
    select 1 from public.household_members hm
    where hm.household_id = h.id and hm.user_id = uid
  )
  and (
    select count(*) from public.household_members hm2
    where hm2.household_id = h.id
  ) = 1;

  -- Verbleibende Haushalte, die dieser Nutzer erstellt hat: `created_by` auf
  -- ein verbleibendes Mitglied uebertragen (bevorzugt einen anderen Admin),
  -- sonst blockiert `on delete restrict` gleich die Profil-Loeschung.
  for rec in
    select id from public.households where created_by = uid
  loop
    select user_id into new_owner
    from public.household_members
    where household_id = rec.id and user_id <> uid
    order by (role = 'admin') desc, joined_at asc
    limit 1;

    if new_owner is not null then
      update public.households set created_by = new_owner where id = rec.id;
    end if;
  end loop;
end;
$function$;
