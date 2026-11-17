-- Server-only checkpoint for the asynchronous PostHog deletion workflow.
--
-- The row is intentionally keyed by auth.users rather than public.profiles:
-- it must survive the initial request and disappear with the identity after the
-- account deletion has reached the final Supabase step.
create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  posthog_person_ids text[] not null default '{}'::text[],
  delete_requested_at timestamptz not null default now(),
  delete_accepted_at timestamptz,
  delete_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_person_ids_limit
    check (cardinality(posthog_person_ids) between 1 and 1000),
  constraint account_deletion_requests_person_ids_no_null
    check (array_position(posthog_person_ids, null::text) is null),
  constraint account_deletion_requests_verified_after_acceptance
    check (delete_verified_at is null or delete_accepted_at is not null)
);

create or replace trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row
  execute function private.set_updated_at();

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_service_role_all
  on public.account_deletion_requests
  for all to service_role
  using (true)
  with check (true);
