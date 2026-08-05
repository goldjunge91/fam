create schema if not exists "private";


  create table "public"."household_members" (
    "household_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "joined_at" timestamp with time zone not null default now()
      );


alter table "public"."household_members" enable row level security;


  create table "public"."households" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."households" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "display_name" text,
    "avatar_url" text,
    "birth_date" date,
    "sex" text,
    "height_cm" numeric(5,1),
    "activity_level" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;

CREATE UNIQUE INDEX household_members_pkey ON public.household_members USING btree (household_id, user_id);

CREATE INDEX household_members_user_id_idx ON public.household_members USING btree (user_id);

CREATE INDEX households_created_by_idx ON public.households USING btree (created_by);

CREATE UNIQUE INDEX households_pkey ON public.households USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

alter table "public"."household_members" add constraint "household_members_pkey" PRIMARY KEY using index "household_members_pkey";

alter table "public"."households" add constraint "households_pkey" PRIMARY KEY using index "households_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."household_members" add constraint "household_members_household_id_fkey" FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE not valid;

alter table "public"."household_members" validate constraint "household_members_household_id_fkey";

alter table "public"."household_members" add constraint "household_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text]))) not valid;

alter table "public"."household_members" validate constraint "household_members_role_check";

alter table "public"."household_members" add constraint "household_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."household_members" validate constraint "household_members_user_id_fkey";

alter table "public"."households" add constraint "households_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT not valid;

alter table "public"."households" validate constraint "households_created_by_fkey";

alter table "public"."households" add constraint "households_name_check" CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 80))) not valid;

alter table "public"."households" validate constraint "households_name_check";

alter table "public"."profiles" add constraint "profiles_activity_level_check" CHECK ((activity_level = ANY (ARRAY['sedentary'::text, 'light'::text, 'moderate'::text, 'active'::text, 'very_active'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_activity_level_check";

alter table "public"."profiles" add constraint "profiles_height_cm_check" CHECK (((height_cm > (0)::numeric) AND (height_cm < (300)::numeric))) not valid;

alter table "public"."profiles" validate constraint "profiles_height_cm_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_sex_check" CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_sex_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guard_last_admin()
 RETURNS trigger
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
$function$
;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
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
$function$
;

CREATE OR REPLACE FUNCTION private.is_household_admin(hid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION private.is_household_member(hid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
  );
$function$
;

CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_household(household_name text)
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
$function$
;

grant delete on table "public"."household_members" to "anon";

grant insert on table "public"."household_members" to "anon";

grant references on table "public"."household_members" to "anon";

grant select on table "public"."household_members" to "anon";

grant trigger on table "public"."household_members" to "anon";

grant truncate on table "public"."household_members" to "anon";

grant update on table "public"."household_members" to "anon";

grant delete on table "public"."household_members" to "authenticated";

grant insert on table "public"."household_members" to "authenticated";

grant references on table "public"."household_members" to "authenticated";

grant select on table "public"."household_members" to "authenticated";

grant trigger on table "public"."household_members" to "authenticated";

grant truncate on table "public"."household_members" to "authenticated";

grant update on table "public"."household_members" to "authenticated";

grant delete on table "public"."household_members" to "service_role";

grant insert on table "public"."household_members" to "service_role";

grant references on table "public"."household_members" to "service_role";

grant select on table "public"."household_members" to "service_role";

grant trigger on table "public"."household_members" to "service_role";

grant truncate on table "public"."household_members" to "service_role";

grant update on table "public"."household_members" to "service_role";

grant delete on table "public"."households" to "anon";

grant insert on table "public"."households" to "anon";

grant references on table "public"."households" to "anon";

grant select on table "public"."households" to "anon";

grant trigger on table "public"."households" to "anon";

grant truncate on table "public"."households" to "anon";

grant update on table "public"."households" to "anon";

grant delete on table "public"."households" to "authenticated";

grant insert on table "public"."households" to "authenticated";

grant references on table "public"."households" to "authenticated";

grant select on table "public"."households" to "authenticated";

grant trigger on table "public"."households" to "authenticated";

grant truncate on table "public"."households" to "authenticated";

grant update on table "public"."households" to "authenticated";

grant delete on table "public"."households" to "service_role";

grant insert on table "public"."households" to "service_role";

grant references on table "public"."households" to "service_role";

grant select on table "public"."households" to "service_role";

grant trigger on table "public"."households" to "service_role";

grant truncate on table "public"."households" to "service_role";

grant update on table "public"."households" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";


  create policy "household_members_delete"
  on "public"."household_members"
  as permissive
  for delete
  to authenticated
using ((( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin) OR (user_id = ( SELECT auth.uid() AS uid))));



  create policy "household_members_insert_admin"
  on "public"."household_members"
  as permissive
  for insert
  to authenticated
with check (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin));



  create policy "household_members_select"
  on "public"."household_members"
  as permissive
  for select
  to authenticated
using (( SELECT private.is_household_member(household_members.household_id) AS is_household_member));



  create policy "household_members_update_admin"
  on "public"."household_members"
  as permissive
  for update
  to authenticated
using (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin))
with check (( SELECT private.is_household_admin(household_members.household_id) AS is_household_admin));



  create policy "households_delete_admin"
  on "public"."households"
  as permissive
  for delete
  to authenticated
using (( SELECT private.is_household_admin(households.id) AS is_household_admin));



  create policy "households_select_member"
  on "public"."households"
  as permissive
  for select
  to authenticated
using (( SELECT private.is_household_member(households.id) AS is_household_member));



  create policy "households_update_admin"
  on "public"."households"
  as permissive
  for update
  to authenticated
using (( SELECT private.is_household_admin(households.id) AS is_household_admin))
with check (( SELECT private.is_household_admin(households.id) AS is_household_admin));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = id));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = id))
with check ((( SELECT auth.uid() AS uid) = id));


CREATE TRIGGER household_members_guard_last_admin BEFORE DELETE OR UPDATE ON public.household_members FOR EACH ROW EXECUTE FUNCTION private.guard_last_admin();

CREATE TRIGGER households_set_updated_at BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();


