-- Shared counters survive Edge cold starts. At most one row per user/scope.
create table if not exists private.request_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('ai-gateway', 'off-enrichment')),
  window_started_at timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (user_id, scope)
);

alter table private.request_limits enable row level security;
create policy request_limits_service on private.request_limits
  for all to service_role using (true) with check (true);
revoke all on private.request_limits from public, anon, authenticated;
grant select, insert, update, delete on private.request_limits to service_role;

-- Fixed window beginning with the first accepted request. The row lock makes
-- checking and consuming one atomic operation across all Edge instances.
create or replace function public.consume_request_limit(
  p_user_id uuid,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_counter private.request_limits%rowtype;
  v_now timestamptz;
begin
  if p_user_id is null or p_scope is null
    or p_scope not in ('ai-gateway', 'off-enrichment')
    or p_limit is null or p_limit < 1 or p_limit > 10000
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit';
  end if;

  insert into private.request_limits (user_id, scope, window_started_at, requests)
  values (p_user_id, p_scope, clock_timestamp(), 1)
  on conflict (user_id, scope) do nothing;
  if found then
    return query select true, 0;
    return;
  end if;

  select * into v_counter from private.request_limits
  where user_id = p_user_id and scope = p_scope for update;
  v_now := clock_timestamp();

  if v_counter.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update private.request_limits set window_started_at = v_now, requests = 1
    where user_id = p_user_id and scope = p_scope;
    return query select true, 0;
  elsif v_counter.requests < p_limit then
    update private.request_limits set requests = requests + 1
    where user_id = p_user_id and scope = p_scope;
    return query select true, 0;
  else
    return query select false, greatest(1, ceil(extract(epoch from
      v_counter.window_started_at + make_interval(secs => p_window_seconds) - v_now))::integer);
  end if;
end;
$$;

revoke execute on function public.consume_request_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_request_limit(uuid, text, integer, integer) to service_role;
