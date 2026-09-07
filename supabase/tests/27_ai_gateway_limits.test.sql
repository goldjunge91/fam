begin;

\ir helpers.sql

select no_plan();

select tests.create_user('66666666-6666-6666-6666-666666666666', 'ai-limits@example.com');
select tests.create_user('77777777-7777-7777-7777-777777777777', 'ai-limits-two@example.com');

select tests.authenticate_as('66666666-6666-6666-6666-666666666666');
select public.create_household('AI Limits Haushalt') as household_id \gset
select tests.as_postgres();
set local role service_role;
select public.assign_ai_household(
  '66666666-6666-6666-6666-666666666666',
  :'household_id'::uuid,
  '2099-01-01T00:00:00Z'::timestamptz,
  10,
  'ai-limits-assignment'
);
reset role;

select ok(
  has_function_privilege('service_role', 'public.release_ai_credit(uuid)', 'execute'),
  'service_role kann AI-Credit-Reservierungen freigeben'
);
select ok(
  not has_function_privilege('authenticated', 'public.release_ai_credit(uuid)', 'execute'),
  'authenticated kann AI-Credit-Reservierungen nicht freigeben'
);
select ok(
  not has_function_privilege('anon', 'public.consume_request_limit(uuid,text,integer,integer)', 'execute'),
  'anon kann keinen Request-Limiter aufrufen'
);
select ok(
  has_function_privilege('service_role', 'public.consume_request_limit(uuid,text,integer,integer)', 'execute'),
  'service_role kann den Request-Limiter aufrufen'
);
select has_table(
  'private',
  'request_limits',
  'der persistente Request-Limiter-Zaehler ist vorhanden'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'private.request_limits'::regclass),
  'Request-Limiter-Zaehler haben RLS'
);
select ok(
  not has_table_privilege('anon', 'private.request_limits', 'select'),
  'anon kann Request-Limiter-Zaehler nicht lesen'
);
select ok(
  not has_table_privilege('authenticated', 'private.request_limits', 'select'),
  'authenticated kann Request-Limiter-Zaehler nicht lesen'
);
select ok(
  has_table_privilege('service_role', 'private.request_limits', 'select,insert,update,delete'),
  'service_role kann Request-Limiter-Zaehler verwalten'
);

set local role service_role;
select *
from public.book_ai_credit(
  :'household_id'::uuid,
  'suggestion',
  '66666666-0000-0000-0000-000000000001'::uuid,
  10
) \gset first_
select is(:'first_credits_used'::integer, 1, 'eine Vorschlagsreservierung kostet ein Credit');

select *
from public.book_ai_credit(
  :'household_id'::uuid,
  'suggestion',
  '66666666-0000-0000-0000-000000000001'::uuid,
  10
) \gset retry_
select is(:'retry_credits_used'::integer, 1, 'eine idempotente Wiederholung bucht nicht doppelt');

select throws_ok(
  format($$select public.book_ai_credit(%L::uuid, 'recipe', '66666666-0000-0000-0000-000000000001'::uuid, 10)$$, :'household_id'),
  '22023',
  'ai_credit_request_conflict',
  'dieselbe Request-ID darf nicht mit einer anderen Aktion wiederverwendet werden'
);
select is(
  (select credits_used from public.get_ai_credit_status(:'household_id'::uuid, 10)),
  1,
  'ein Request-Konflikt verbraucht keine zusaetzlichen Credits'
);

select lives_ok(
  $$select public.release_ai_credit('66666666-0000-0000-0000-000000000001'::uuid)$$,
  'Release-RPC liefert bewusst void'
);
select is(
  (select credits_used from public.get_ai_credit_status(:'household_id'::uuid, 10)),
  0,
  'eine freigegebene Reservierung zaehlt nicht mehr zum Verbrauch'
);
select lives_ok(
  $$select public.release_ai_credit('66666666-0000-0000-0000-000000000001'::uuid)$$,
  'eine wiederholte Freigabe ist idempotent'
);

select throws_ok(
  format($$select public.book_ai_credit(%L::uuid, 'suggestion', '66666666-0000-0000-0000-000000000002'::uuid, 0)$$, :'household_id'),
  '22023',
  'ai_credit_invalid_request',
  'ein nicht positives Monatslimit wird abgelehnt'
);

update public.households
set ai_active = true,
    ai_expires_at = clock_timestamp() - interval '1 second'
where id = :'household_id'::uuid;
select throws_ok(
  format($$select public.book_ai_credit(%L::uuid, 'suggestion', '66666666-0000-0000-0000-000000000003'::uuid, 10)$$, :'household_id'),
  '42501',
  'ai_entitlement_required',
  'ein abgelaufenes AI-Entitlement erlaubt keine Buchung'
);

select *
from public.consume_request_limit(
  '66666666-6666-6666-6666-666666666666'::uuid,
  'off-enrichment',
  2,
  60
) \gset limit_one_
select ok(:'limit_one_allowed'::boolean, 'der erste Nutzer-Request wird erlaubt');
select *
from public.consume_request_limit(
  '66666666-6666-6666-6666-666666666666'::uuid,
  'off-enrichment',
  2,
  60
) \gset limit_two_
select ok(:'limit_two_allowed'::boolean, 'der zweite Nutzer-Request wird erlaubt');
select *
from public.consume_request_limit(
  '66666666-6666-6666-6666-666666666666'::uuid,
  'off-enrichment',
  2,
  60
) \gset limit_three_
select ok(not :'limit_three_allowed'::boolean, 'der Nutzer-Request oberhalb des Limits wird blockiert');
select ok(:'limit_three_retry_after'::integer >= 1, 'das blockierte Request liefert Retry-After');

select *
from public.consume_request_limit(
  '77777777-7777-7777-7777-777777777777'::uuid,
  'off-enrichment',
  1,
  60
) \gset other_user_
select ok(:'other_user_allowed'::boolean, 'ein anderer Nutzer hat ein eigenes Kontingent');

update private.request_limits
set window_started_at = clock_timestamp() - interval '2 minutes'
where user_id = '66666666-6666-6666-6666-666666666666'::uuid
  and scope = 'off-enrichment';
select *
from public.consume_request_limit(
  '66666666-6666-6666-6666-666666666666'::uuid,
  'off-enrichment',
  1,
  60
) \gset reset_window_
select ok(:'reset_window_allowed'::boolean, 'nach Ablauf des Fensters wird der Request wieder erlaubt');

select *
from public.consume_request_limit(
  '66666666-6666-6666-6666-666666666666'::uuid,
  'ai-gateway',
  1,
  60
) \gset other_scope_
select ok(:'other_scope_allowed'::boolean, 'ein anderer Scope hat ein eigenes Kontingent');

select throws_ok(
  $$select public.consume_request_limit('66666666-6666-6666-6666-666666666666'::uuid, 'unknown', 1, 60)$$,
  '22023',
  'invalid_rate_limit',
  'unbekannte Request-Limiter-Scopes werden abgelehnt'
);

reset role;
select * from finish();
rollback;
