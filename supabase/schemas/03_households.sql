-- Gewuenschter Endzustand — NICHT von Hand migrieren.
--
-- Hier entscheidet sich, wer welche Daten sieht. Der Haushalt ist die Grenze
-- zwischen "geteilt" (Vorrat, Einkaufsliste) und "privat" (Kalorien, Gewicht).

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Plus und AI gelten haushaltsweit. RevenueCat bleibt per
  -- `Purchases.logIn(userId)` an den kaufenden Supabase-Account gebunden; der
  -- Webhook projiziert dessen Entitlements auf den zugeordneten Haushalt,
  -- damit auch Mitglieder ohne eigenen Kauf den gemeinsamen Status sehen.
  -- Plus und AI bleiben getrennt, weil beide unabhaengig aktiv sein koennen.
  -- Serverseitig gepflegt vom RevenueCat-Webhook
  -- (supabase/functions/revenuecat-webhook) — siehe Schreibschutz in
  -- 20_privileges.sql, sonst koennte sich jeder Haushalts-Admin selbst
  -- freischalten.
  plus_active boolean not null default false,
  plus_expires_at timestamptz,
  plus_updated_at timestamptz,
  -- RevenueCat-`event_timestamp_ms` des zuletzt angewendeten Plus-Events.
  -- Schuetzt vor einem verspaetet zugestellten aelteren Webhook-Event, das
  -- sonst einen bereits neueren Stand ueberschreiben wuerde (Ereignisreihen-
  -- folge ist bei Retries nicht garantiert).
  plus_last_event_timestamp_ms bigint,
  ai_active boolean not null default false,
  ai_expires_at timestamptz,
  ai_updated_at timestamptz,
  ai_subscriber_id uuid references public.profiles (id) on delete set null,
  constraint households_active_ai_has_subscriber
    check (not ai_active or ai_subscriber_id is not null)
);

-- UUID statt bigint identity, obwohl UUIDv4 die Index-Lokalitaet
-- verschlechtert: Die App legt Datensaetze offline an (#46) und muss die ID
-- dabei selbst vergeben. Bei einer serverseitigen Sequenz ginge das nicht.
-- `updated_at` ist hier kein Beiwerk, sondern Voraussetzung fuer Epic 2: Der
-- inkrementelle Pull der Sync-Engine fragt je Tabelle "was hat sich seit
-- lastSyncedAt geaendert". Mit nur `joined_at` waere ein Rollenwechsel oder das
-- Entfernen eines Mitglieds fuer diesen Pull unsichtbar — der lokale
-- Rechte-Cache liesse sich nie aktualisieren und ein entfernter Nutzer behielte
-- auf seinem Geraet Zugriffsrechte, die serverseitig laengst weg sind.
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Der Primaerschluessel deckt (household_id, user_id) ab und damit jede Suche,
-- die mit household_id beginnt. Die Gegenrichtung "alle Haushalte eines
-- Nutzers" braucht einen eigenen Index — genau die Query laeuft beim App-Start.
create index if not exists household_members_user_id_idx
  on public.household_members (user_id);
create index if not exists households_created_by_idx
  on public.households (created_by);

-- Die kanonische AI-Zuordnung lebt pro RevenueCat-Subscriber genau einmal.
-- `households.ai_*` ist nur die gemeinsam lesbare Projektion fuer Mitglieder.
-- Clients erhalten auf diese Tabelle weder Tabellenrechte noch eine RLS-
-- Policy; geschrieben wird ausschliesslich ueber assign_ai_household().
create table if not exists public.revenuecat_ai_assignments (
  subscriber_user_id uuid primary key references public.profiles (id) on delete cascade,
  household_id uuid not null unique references public.households (id) on delete cascade,
  household_changed_at timestamptz not null default now(),
  -- RevenueCat-`event_timestamp_ms` des zuletzt angewendeten AI-Events fuer
  -- diesen Subscriber. Bleibt beim Haushaltswechsel erhalten (anders als die
  -- Haushaltsprojektion), damit ein verspaetet zugestelltes aelteres Event
  -- den bereits neueren Zuordnungsstand nicht zuruecksetzen kann.
  last_event_timestamp_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotenz fuer den RevenueCat-Webhook: RevenueCat sendet ein Event bei
-- ausbleibender 2xx-Antwort erneut zu. Ohne diese Tabelle wuerde ein
-- wiederholter Zustellversuch denselben Zustand ein zweites Mal schreiben —
-- bei AI sogar einen Eintrag im monatlichen Wechsel-Kontingent verbrauchen,
-- obwohl fachlich kein zweiter Wechsel stattgefunden hat. Jede Kombination
-- aus Event-ID und betroffenem Entitlement wird deshalb genau einmal
-- verarbeitet; der DB-Adapter fuegt vor der eigentlichen Verarbeitung einen
-- Eintrag ein und ueberspringt die Anwendung, wenn er schon existiert.
create table if not exists public.revenuecat_processed_events (
  event_id text not null,
  entitlement_id text not null check (entitlement_id in ('Plus', 'AI')),
  processed_at timestamptz not null default now(),
  primary key (event_id, entitlement_id)
);

create or replace trigger households_set_updated_at
  before update on public.households
  for each row
  execute function private.set_updated_at();

-- ------------------------------------------------------ Zugehoerigkeits-Helfer
--
-- Der eigentliche Fallstrick des Datenmodells:
--
-- Eine Policy auf household_members, die zur Pruefung einer Zeile wieder
-- household_members abfragt ("darf ich diese Zeile sehen? -> bin ich Mitglied
-- dieses Haushalts? -> SELECT auf household_members"), bricht Postgres mit
-- `infinite recursion detected in policy for relation "household_members"` ab.
--
-- SECURITY DEFINER umgeht RLS innerhalb der Funktion und durchbricht den Kreis.

create or replace function private.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_admin(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- ACHTUNG: Die Rechte fuer diese Funktionen stehen NICHT hier, sondern in
-- supabase/migrations/*_privileges.sql. `supabase db diff` erfasst
-- Schema-Privilegien und Funktions-Grants nicht — hier notiert waeren sie
-- wirkungslos und wuerden einen Zustand behaupten, den die Datenbank nicht hat.

-- ------------------------------------------------------------- Haushalt anlegen
-- `public.create_household()` ist als RPC gebaut, nicht als INSERT aus dem
-- Client: Haushalt und Admin-Mitgliedschaft muessen zusammen entstehen. Ein
-- Abbruch dazwischen hinterliesse einen Haushalt ohne Admin, den danach niemand
-- mehr verwalten koennte.
--
-- Die Definition steht bewusst NICHT hier, sondern in 08_inventory.sql: Dort
-- legt sie zusaetzlich die Standard-Lagerorte an und braucht deshalb die
-- storage_locations-Tabelle. Stuende hier eine zweite Fassung, gaebe es zwei
-- Definitionen derselben Funktion, von denen die spaetere still gewinnt —
-- und bei jeder Umsortierung von `schema_paths` kippte, welche das ist.
--
-- Rechte fuer dieses RPC: siehe 04_privileges.sql.

-- ------------------------------------------------------- letzter Admin absichern
-- Ohne diese Sperre kann sich der letzte Admin degradieren oder austragen und
-- laesst einen Haushalt zurueck, den niemand mehr verwalten kann — inklusive
-- der Daten aller anderen Mitglieder.
create or replace function private.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace trigger household_members_guard_last_admin
  before update or delete on public.household_members
  for each row
  execute function private.guard_last_admin();

-- Reihenfolge ist hier relevant: Postgres feuert BEFORE-Row-Trigger in
-- alphabetischer Reihenfolge ihres Namens. `..._guard_last_admin` laeuft also
-- vor `..._set_updated_at`. Der Waechter gibt `coalesce(new, old)` zurueck,
-- damit erreicht NEW den zweiten Trigger unveraendert.
create or replace trigger household_members_set_updated_at
  before update on public.household_members
  for each row
  execute function private.set_updated_at();

create or replace trigger revenuecat_ai_assignments_set_updated_at
  before update on public.revenuecat_ai_assignments
  for each row
  execute function private.set_updated_at();

-- Atomare serverseitige AI-Zuordnung. Die aufrufende Edge Function muss das
-- RevenueCat-Entitlement vorher verifizieren; die Datenbank erzwingt danach
-- Mitgliedschaft, Eindeutigkeit und hoechstens einen Wechsel pro UTC-
-- Kalendermonat. Die Funktion ist nur fuer service_role ausfuehrbar.
--
-- `p_event_timestamp_ms` ist optional (Default null) fuer Aufrufer ohne
-- Ereignis-Zeitstempel. Ist er gesetzt und existiert bereits eine Zuordnung
-- mit einem juengeren `last_event_timestamp_ms`, ist der Aufruf ein No-op:
-- Ein verspaetet zugestelltes aelteres RevenueCat-Event (Retry, Out-of-Order-
-- Zustellung) darf einen bereits neueren Zuordnungs- oder Ablaufstand nicht
-- ueberschreiben.
create or replace function public.assign_ai_household(
  p_subscriber_user_id uuid,
  p_target_household_id uuid,
  p_entitlement_expires_at timestamptz,
  p_event_timestamp_ms bigint default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_household_id uuid;
  current_household_changed_at timestamptz;
  current_event_timestamp_ms bigint;
begin
  if not exists (
    select 1
    from public.household_members
    where household_id = p_target_household_id
      and user_id = p_subscriber_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'ai_target_household_forbidden';
  end if;

  select household_id, household_changed_at, last_event_timestamp_ms
  into current_household_id, current_household_changed_at, current_event_timestamp_ms
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is not null
    and p_event_timestamp_ms is not null
    and current_event_timestamp_ms is not null
    and p_event_timestamp_ms < current_event_timestamp_ms
  then
    return;
  end if;

  if current_household_id is null then
    insert into public.revenuecat_ai_assignments (
      subscriber_user_id,
      household_id,
      last_event_timestamp_ms
    )
    values (
      p_subscriber_user_id,
      p_target_household_id,
      p_event_timestamp_ms
    );
  elsif current_household_id <> p_target_household_id then
    if date_trunc('month', current_household_changed_at at time zone 'UTC')
      >= date_trunc('month', now() at time zone 'UTC') then
      raise exception 'ai_household_change_cooldown';
    end if;

    update public.households
    set ai_active = false,
        ai_expires_at = null,
        ai_updated_at = now(),
        ai_subscriber_id = null
    where id = current_household_id
      and ai_subscriber_id = p_subscriber_user_id;

    update public.revenuecat_ai_assignments
    set household_id = p_target_household_id,
        household_changed_at = now(),
        last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  else
    update public.revenuecat_ai_assignments
    set last_event_timestamp_ms = p_event_timestamp_ms
    where subscriber_user_id = p_subscriber_user_id;
  end if;

  update public.households
  set ai_active = true,
      ai_expires_at = p_entitlement_expires_at,
      ai_updated_at = now(),
      ai_subscriber_id = p_subscriber_user_id
  where id = p_target_household_id;
end;
$$;

-- Deaktiviert AI fuer den aktuell zugeordneten Haushalt eines Subscribers
-- (RevenueCat EXPIRATION). Getrennt von assign_ai_household, weil eine
-- Deaktivierung keinen Zielhaushalt kennt und das Monatswechsel-Limit nicht
-- betrifft. Derselbe Staleness-Schutz wie oben: Ein verspaetet zugestelltes
-- EXPIRATION-Event darf eine bereits juengere Aktivierung (Renewal) nicht
-- widerrufen.
create or replace function public.deactivate_ai_household(
  p_subscriber_user_id uuid,
  p_event_timestamp_ms bigint default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_household_id uuid;
  current_event_timestamp_ms bigint;
begin
  select household_id, last_event_timestamp_ms
  into current_household_id, current_event_timestamp_ms
  from public.revenuecat_ai_assignments
  where subscriber_user_id = p_subscriber_user_id
  for update;

  if current_household_id is null then
    return;
  end if;

  if p_event_timestamp_ms is not null
    and current_event_timestamp_ms is not null
    and p_event_timestamp_ms < current_event_timestamp_ms
  then
    return;
  end if;

  update public.households
  set ai_active = false,
      ai_expires_at = null,
      ai_updated_at = now(),
      ai_subscriber_id = null
  where id = current_household_id
    and ai_subscriber_id = p_subscriber_user_id;

  update public.revenuecat_ai_assignments
  set last_event_timestamp_ms = p_event_timestamp_ms
  where subscriber_user_id = p_subscriber_user_id;
end;
$$;

-- ------------------------------------------------------- AI-Fair-Use-Kontingent
-- Serverseitiger Vertrag fuer das haushaltsweite AI-Kontingent (Epic #23,
-- 100 Credits pro UTC-Kalendermonat als Arbeitsbaseline). Es existiert noch
-- keine AI-Fachfunktion; dieser Vertrag legt nur Buchung, Monatsreset und
-- Zustandsableitung fest, damit die erste AI-Funktion ihn direkt aufrufen
-- kann, statt eine eigene Zaehl-Logik zu erfinden.
--
-- Der Ledger haengt bewusst am Subscriber (`subscriber_user_id`), nicht am
-- Haushalt: PREMIUM_MONETIZATION_SPEC Abschnitt 4.2.1 verlangt, dass beim
-- erlaubten monatlichen AI-Haushaltswechsel "das verbleibende Kontingent
-- uebertragen, aber nicht zurueckgesetzt" wird. Ein an household_id
-- gebundener Ledger wuerde dem neuen Haushalt faelschlich volle 100 Credits
-- geben, obwohl derselbe Subscriber im selben Monat schon Credits verbraucht
-- hat. `revenuecat_ai_assignments` ist bereits die kanonische, haushalts-
-- unabhaengige Subscriber-Identitaet — der Ledger nutzt dieselbe.
--
-- Buchungen sind ein Append-only-Ledger statt eines einzelnen Zaehlerfelds:
-- Der Verbrauch des laufenden UTC-Kalendermonats wird bei jeder Pruefung neu
-- summiert. Ein Reset am Monatsanfang braucht dadurch keinen eigenen Job —
-- Buchungen des Vormonats faellen einfach aus dem Summenfenster, es gibt
-- explizit keinen Uebertrag zwischen Monaten (kein Rollover). `primary key
-- (subscriber_user_id, request_id)` macht Retries idempotent: Derselbe
-- Request kann nie doppelt verbucht werden.
create table if not exists public.ai_credit_bookings (
  subscriber_user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null,
  action text not null check (action in ('suggestion', 'recipe', 'voice')),
  credits smallint not null check (credits > 0),
  created_at timestamptz not null default now(),
  primary key (subscriber_user_id, request_id)
);

create index if not exists ai_credit_bookings_subscriber_created_idx
  on public.ai_credit_bookings (subscriber_user_id, created_at);

-- Summiert den Verbrauch des laufenden UTC-Kalendermonats. Eigene Funktion
-- statt Inline-Subquery, damit Buchung und reine Statusabfrage exakt dieselbe
-- Monatsgrenze verwenden.
create or replace function private.ai_credit_month_usage(p_subscriber_user_id uuid)
returns integer
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(sum(credits), 0)::integer
  from public.ai_credit_bookings
  where subscriber_user_id = p_subscriber_user_id
    and created_at >= (date_trunc('month', (now() at time zone 'UTC')) at time zone 'UTC');
$$;

-- Loest den fuer einen Haushalt kanonisch zugeordneten AI-Subscriber auf.
-- Beide oeffentlichen Funktionen nehmen bewusst `p_household_id` entgegen
-- (das kennt die aufrufende AI-Funktion aus dem aktiven Haushalt des
-- Nutzers), buchen intern aber gegen den Subscriber, damit das Kontingent
-- den Haushaltswechsel ueberlebt.
create or replace function private.ai_credit_subscriber_for_household(p_household_id uuid)
returns uuid
language sql
security invoker
stable
set search_path = ''
as $$
  select subscriber_user_id
  from public.revenuecat_ai_assignments
  where household_id = p_household_id;
$$;

-- Bucht eine AI-Aktion atomar gegen das Monatskontingent. Die aufrufende
-- AI-Edge-Function muss vorher pruefen, dass der Haushalt AI-Zugriff hat —
-- dieser Vertrag kennt nur Credits, keine Entitlements. `p_request_id` ist
-- die Idempotenzsperre: Ein wiederholter Aufruf mit derselben ID (Netzwerk-
-- Retry) bucht nicht doppelt, sondern liefert denselben Stand zurueck.
-- Ueberschreitet die Buchung das Kontingent, schlaegt sie vollstaendig fehl
-- (kein Teilverbrauch) — Plus bleibt davon unberuehrt, diese Funktion
-- schreibt ausschliesslich in ai_credit_bookings.
create or replace function public.book_ai_credit(
  p_household_id uuid,
  p_action text,
  p_request_id uuid,
  p_monthly_limit integer default 100
)
returns table (
  credits_used integer,
  credits_remaining integer,
  credit_limit integer,
  warning_reached boolean,
  blocked boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subscriber_user_id uuid;
  v_weight smallint;
  v_existing smallint;
  v_usage integer;
begin
  v_subscriber_user_id := private.ai_credit_subscriber_for_household(p_household_id);
  if v_subscriber_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ai_household_not_assigned';
  end if;

  v_weight := case p_action
    when 'suggestion' then 1
    when 'recipe' then 3
    when 'voice' then 2
    else null
  end;
  if v_weight is null then
    raise exception using errcode = '22023', message = 'ai_credit_invalid_action';
  end if;

  select b.credits into v_existing
  from public.ai_credit_bookings as b
  where b.subscriber_user_id = v_subscriber_user_id and b.request_id = p_request_id;

  if v_existing is null then
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
    if v_usage + v_weight > p_monthly_limit then
      raise exception using errcode = 'P0001', message = 'ai_credit_limit_exceeded';
    end if;

    insert into public.ai_credit_bookings (subscriber_user_id, request_id, action, credits)
    values (v_subscriber_user_id, p_request_id, p_action, v_weight);

    v_usage := v_usage + v_weight;
  else
    v_usage := private.ai_credit_month_usage(v_subscriber_user_id);
  end if;

  return query select
    v_usage,
    greatest(p_monthly_limit - v_usage, 0),
    p_monthly_limit,
    v_usage >= ceil(p_monthly_limit * 0.8),
    v_usage >= p_monthly_limit;
end;
$$;

-- Reine Statusabfrage ohne Buchung, fuer eine spaetere 80-Prozent-Warnung in
-- der UI — bewusst getrennt von book_ai_credit, damit ein reines Anzeigen des
-- Kontingents niemals selbst Credits verbraucht. Ein Haushalt ohne AI-
-- Zuordnung hat definitionsgemaess 0 Verbrauch.
create or replace function public.get_ai_credit_status(
  p_household_id uuid,
  p_monthly_limit integer default 100
)
returns table (
  credits_used integer,
  credits_remaining integer,
  credit_limit integer,
  warning_reached boolean,
  blocked boolean
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    usage.credits_used,
    greatest(p_monthly_limit - usage.credits_used, 0),
    p_monthly_limit,
    usage.credits_used >= ceil(p_monthly_limit * 0.8),
    usage.credits_used >= p_monthly_limit
  from (
    select coalesce(
      private.ai_credit_month_usage(
        private.ai_credit_subscriber_for_household(p_household_id)
      ),
      0
    ) as credits_used
  ) as usage;
$$;

-- ------------------------------------------------- verwaisten Haushalt loeschen
-- `guard_last_admin` laesst den letzten Admin gehen, wenn danach kein Mitglied
-- mehr bleibt. Ohne diesen Trigger bliebe dann die households-Zeile mitsamt
-- ihren geteilten Daten (Vorrat, Einkaufsliste, Rezepte, Essensplaene,
-- Kinderprofile) fuer immer stehen: jede RLS-Policy ist mitgliederbezogen, also
-- kaeme niemand mehr an diese Daten und niemand koennte sie loeschen (#189).
--
-- Der AFTER-DELETE-Trigger raeumt genau diesen Fall auf: ist der Haushalt nach
-- dem Entfernen des Mitglieds leer, wird er geloescht. `on delete cascade`
-- entfernt den Rest — dieselbe Kaskade, auf die sich `prepare_account_deletion`
-- bereits stuetzt.
--
-- SECURITY DEFINER, weil das Aufrufer-Recht auf households an eine
-- Admin-Mitgliedschaft gebunden ist, die es beim Verlassen gerade nicht mehr
-- gibt. Kein Rekursionsrisiko: die Kaskade der households-Loeschung feuert
-- diesen Trigger nur fuer noch vorhandene Mitglieder — hier gibt es keine mehr.
create or replace function private.delete_orphaned_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = old.household_id
  ) then
    delete from public.households where id = old.household_id;
  end if;

  return old;
end;
$$;

create or replace trigger household_members_delete_orphaned_household
  after delete on public.household_members
  for each row
  execute function private.delete_orphaned_household();

-- ------------------------------------------------------- Kontoloeschung vorbereiten
-- `public.prepare_account_deletion()` (#98): raeumt Haushaltsbezuege des
-- aufrufenden Nutzers auf, BEVOR die Edge Function `delete-account` per
-- Admin-API `auth.users` loescht. Zwei Dinge wuerden sonst kaskadierend
-- blockieren:
--
-- 1. `households.created_by references profiles on delete restrict` — ein
--    Nutzer, der einen noch bestehenden Haushalt erstellt hat, kann sein
--    Profil nie loeschen, solange `created_by` auf ihn zeigt.
-- 2. Ist er in einem Haushalt mit weiteren Mitgliedern der letzte Admin,
--    wuerde ihn niemand mehr verwalten koennen — dieselbe Situation, die
--    `guard_last_admin` schon beim manuellen Verlassen verhindert.
--
-- Statt beides in der Edge Function per einzelnen REST-Calls zu behandeln
-- (nicht atomar, RLS muesste mit Service-Role umgangen werden), laeuft es
-- hier als eine Transaktion unter der Identitaet des aufrufenden Nutzers
-- (`auth.uid()`), SECURITY DEFINER nur fuer den households-Zugriff.
--
-- Nimmt bewusst keine user_id entgegen — ausschliesslich `auth.uid()` selbst,
-- damit niemand die Loeschung fuer einen anderen Account anstossen kann.
create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
      raise exception 'last_admin_with_members: % (%)', rec.name, rec.household_id;
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
$$;

-- ------------------------------------------------------------------------- RLS
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.revenuecat_ai_assignments enable row level security;
alter table public.revenuecat_processed_events enable row level security;
alter table public.ai_credit_bookings enable row level security;

-- households: sichtbar fuer Mitglieder, aenderbar nur durch Admins.
-- Kein INSERT: Haushalte entstehen ausschliesslich ueber create_household().
create policy households_select_member on public.households
  for select to authenticated
  using ((select private.is_household_member(id)));

create policy households_update_admin on public.households
  for update to authenticated
  using ((select private.is_household_admin(id)))
  with check ((select private.is_household_admin(id)));

create policy households_delete_admin on public.households
  for delete to authenticated
  using ((select private.is_household_admin(id)));

-- household_members: Mitglieder sehen die Mitgliederliste ihrer Haushalte.
-- Der Aufruf laeuft ueber die SECURITY-DEFINER-Funktion und nicht ueber eine
-- Subquery auf dieselbe Tabelle — siehe Kommentar oben.
create policy household_members_select on public.household_members
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy household_members_insert_admin on public.household_members
  for insert to authenticated
  with check ((select private.is_household_admin(household_id)));

create policy household_members_update_admin on public.household_members
  for update to authenticated
  using ((select private.is_household_admin(household_id)))
  with check ((select private.is_household_admin(household_id)));

-- Entfernen darf ein Admin — oder das Mitglied sich selbst (Haushalt verlassen).
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (
    (select private.is_household_admin(household_id))
    or user_id = (select auth.uid())
  );

-- ------------------------------------------------- Mitgliederliste mit Namen
--
-- Mitglieder muessen sehen, wer sonst im Haushalt ist. `profiles` ist aber
-- bewusst streng privat (siehe Kopf von 02_profiles.sql): Dort liegen
-- Geburtsdatum, Geschlecht, Koerpergroesse und Aktivitaetslevel — die
-- Rechenbasis fuer das Kalorienziel. Eine SELECT-Policy koennte das nicht
-- trennen, denn RLS wirkt auf Zeilen, nicht auf Spalten: Wer die Zeile sehen
-- darf, sieht sie ganz.
--
-- Deshalb ein RPC, das genau die zwei Spalten herausgibt, die zur
-- Identifikation noetig sind — Anzeigename und Avatar. Die Gesundheitsdaten
-- bleiben unerreichbar, und was den Haushalt verlaesst, steht hier an einer
-- Stelle statt verteilt in Policies.
--
-- SECURITY DEFINER, weil die Funktion die profiles-RLS gezielt umgeht; die
-- Berechtigung prueft sie selbst ueber `is_household_member`. Ohne diese
-- Pruefung waere sie ein Leck fuer beliebige Haushalts-IDs.
--
-- Rechte fuer dieses RPC: siehe 04_privileges.sql.
create or replace function public.household_member_profiles(hid uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
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
$$;

comment on function public.household_member_profiles(uuid) is
  'Mitglieder eines Haushalts mit Anzeigename und Avatar. Gibt bewusst NUR '
  'diese beiden Profilspalten heraus — die Gesundheitsdaten in profiles '
  'bleiben privat.';
