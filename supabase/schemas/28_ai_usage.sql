-- Tatsächliche Provider-Nutzung pro Aufruf. Die Tabelle enthält keine
-- Prompts, Antworten oder anderen Inhalte aus der KI-Anfrage.
create table if not exists public.ai_usage_events (
  request_id uuid not null,
  provider_call_index smallint not null check (provider_call_index >= 0),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscriber_user_id uuid references public.profiles (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  provider text not null check (provider in ('openrouter', 'groq')),
  model text not null,
  skill text not null check (skill in (
    'fam-assistant',
    'fam-cook-from-inventory',
    'fam-inventory-capture',
    'fam-recipe-import',
    'fam-ai-model-test'
  )),
  is_test boolean not null default false,
  prompt_tokens bigint check (prompt_tokens >= 0),
  completion_tokens bigint check (completion_tokens >= 0),
  total_tokens bigint check (total_tokens >= 0),
  provider_cost_usd numeric(20, 12) check (provider_cost_usd >= 0),
  cost_source text check (cost_source in ('provider_reported')),
  created_at timestamptz not null default now(),
  primary key (request_id, provider_call_index),
  constraint ai_usage_events_cost_source_matches_cost check (
    (provider_cost_usd is null and cost_source is null) or
    (provider_cost_usd is not null and cost_source is not null)
  )
);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_usage_events enable row level security;

create policy ai_usage_events_service_role_all on public.ai_usage_events
  for all to service_role
  using (true)
  with check (true);

comment on table public.ai_usage_events is
  'Append-only provider token and reported-cost data, readable only by the server-side AI usage administrator.';
