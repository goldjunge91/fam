SET local check_function_bodies = off;

CREATE TABLE "private"."household_invite_attempts" (
  "user_id"           uuid                     NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "attempts"          integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "household_invite_attempts_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "private"."household_invite_attempts"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."household_members"
  REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION private.generate_household_invite_code()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  random_bits bigint;
  invite_code text := '';
  digit integer;
begin
  random_bits :=
    (pg_catalog.get_byte(bytes, 0)::bigint << 24)
    | (pg_catalog.get_byte(bytes, 1)::bigint << 16)
    | (pg_catalog.get_byte(bytes, 2)::bigint << 8)
    | pg_catalog.get_byte(bytes, 3)::bigint;

  for position in 0..5 loop
    digit := ((random_bits >> (27 - position * 5)) & 31)::integer;
    invite_code := invite_code || pg_catalog.substr(alphabet, digit + 1, 1);
  end loop;

  return invite_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_invite (
  invite_code text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  inv record;
  uid uuid := (select auth.uid());
  attempt_count integer;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  delete from private.household_invite_attempts
  where window_started_at < now() - interval '1 day';

  insert into private.household_invite_attempts (user_id, window_started_at, attempts)
  values (uid, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when private.household_invite_attempts.window_started_at <= now() - interval '5 minutes'
          then now()
        else private.household_invite_attempts.window_started_at
      end,
      attempts = case
        when private.household_invite_attempts.window_started_at <= now() - interval '5 minutes'
          then 1
        else private.household_invite_attempts.attempts + 1
      end
  returning attempts into attempt_count;

  if attempt_count > 10 then
    return null;
  end if;

  -- `for update` sperrt die Zeile bis zum Commit. Ohne das koennten zwei
  -- gleichzeitige Einloesungen beide den letzten freien Platz sehen und
  -- belegen — max_uses waere dann nur eine Empfehlung.
  select * into inv
  from public.household_invites
  where code = pg_catalog.regexp_replace(upper(btrim(invite_code)), '[[:space:]-]', '', 'g')
     or token::text = lower(btrim(invite_code))
  for update;

  -- Alle Fehlerfaelle melden bewusst nur, was der Aufrufer ohnehin weiss oder
  -- braucht. Insbesondere wird nie der Haushaltsname genannt, bevor der
  -- Beitritt erfolgt ist.
  if not found then
    -- Ein Null-Ergebnis committet den Fehlversuchszähler. Eine Exception hier
    -- wuerde die Zaehler-Aenderung zusammen mit dem RPC zurueckrollen.
    return null;
  end if;

  if inv.revoked_at is not null then
    raise exception 'Einladung wurde zurueckgezogen';
  end if;

  if inv.expires_at <= now() then
    raise exception 'Einladung ist abgelaufen';
  end if;

  -- Bereits Mitglied: still durchwinken, ohne eine Nutzung zu verbrauchen.
  -- Ein zweiter Klick auf denselben Link darf weder fehlschlagen noch einen
  -- Platz kosten — sonst brennt ein Nutzer die Einladung fuer jemand anderen ab.
  if exists (
    select 1 from public.household_members
    where household_id = inv.household_id and user_id = uid
  ) then
    return inv.household_id;
  end if;

  if inv.uses >= inv.max_uses then
    raise exception 'Einladung ist aufgebraucht';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member');

  update public.household_invites
  set uses = uses + 1
  where id = inv.id;

  return inv.household_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."redeem_invite"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.redeem_invite (
  invite_token uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  household_id uuid;
begin
  household_id := public.redeem_invite(invite_token::text);
  if household_id is null then
    raise exception 'Einladung ungueltig';
  end if;
  return household_id;
end;
$function$;

ALTER TABLE "private"."household_invite_attempts"
  ADD CONSTRAINT "household_invite_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE POLICY "household_invite_attempts_deny_direct_access" ON "private"."household_invite_attempts"
  FOR ALL
  TO PUBLIC
  USING (false)
  WITH CHECK (false);

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."household_members";

COMMENT ON FUNCTION "public"."redeem_invite"(text) IS 'Loest einen sechsstelligen Einladungscode oder einen alten UUID-Token ein. Begrenzt Fehlversuche pro Benutzer.';

COMMENT ON FUNCTION "public"."redeem_invite"(uuid) IS 'Kompatibilitaets-Wrapper fuer bestehende UUID-Einladungslinks.';

GRANT EXECUTE ON FUNCTION "public"."redeem_invite"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."redeem_invite"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_invite"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."redeem_invite"(text) TO "service_role";

ALTER TABLE "public"."household_invites"
  ADD COLUMN "code" text NOT NULL DEFAULT private.generate_household_invite_code();

ALTER TABLE "public"."household_invites"
  ADD CONSTRAINT "household_invites_code_key" UNIQUE (code);
