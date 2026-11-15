-- KI-Nutzung bleibt für App-Clients gesperrt und wird serverseitig erfasst.

begin;
\ir helpers.sql

select plan(8);

select tests.create_user('70707070-7070-4070-8070-707070707070', 'ai-usage@example.com');

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.ai_usage_events'::regclass),
  'ai_usage_events hat RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.ai_usage_events', 'select,insert,update,delete'),
  'authenticated kann KI-Nutzung weder lesen noch verändern'
);
select ok(
  not has_table_privilege('anon', 'public.ai_usage_events', 'select,insert,update,delete'),
  'anon kann KI-Nutzung weder lesen noch verändern'
);
select ok(
  has_table_privilege('service_role', 'public.ai_usage_events', 'select,insert'),
  'service_role kann Nutzungsereignisse lesen und anlegen'
);
select ok(
  not has_table_privilege('service_role', 'public.ai_usage_events', 'update,delete'),
  'service_role kann Nutzungsereignisse nicht umschreiben oder löschen'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_usage_events'
      and ('anon' = any (roles) or 'authenticated' = any (roles))
  ),
  'keine Client-Rolle hat eine Nutzungs-RLS-Policy'
);

set local role service_role;
insert into public.ai_usage_events (
  request_id,
  provider_call_index,
  user_id,
  provider,
  model,
  skill,
  prompt_tokens,
  completion_tokens,
  total_tokens
)
values (
  '80808080-8080-4080-8080-808080808080',
  0,
  '70707070-7070-4070-8070-707070707070',
  'groq',
  'openai/gpt-oss-20b',
  'fam-assistant',
  12,
  7,
  19
);
select is(
  (select count(*)::integer from public.ai_usage_events),
  1,
  'service_role kann einen aufrufbezogenen Datensatz speichern'
);
select is(
  (select provider_cost_usd from public.ai_usage_events limit 1),
  null::numeric,
  'fehlende Provider-Kosten bleiben als nicht gemeldet erkennbar'
);
reset role;

select * from finish();
rollback;
