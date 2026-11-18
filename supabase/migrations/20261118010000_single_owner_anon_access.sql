-- Remove the app's dependency on Supabase Auth while keeping RLS enabled.
-- Anonymous access is limited to one finance owner. Existing finance rows are
-- preserved; a database with multiple owners deliberately fails this migration.

create table if not exists public.finance_private_settings (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid not null unique,
  created_at timestamptz not null default now()
);

do $$
declare
  owner_count bigint;
  selected_owner uuid;
begin
  select count(*) into owner_count from (
    select user_id from (
      select user_id from public.finance_categories
      union all select user_id from public.finance_payment_methods
      union all select user_id from public.finance_transactions
      union all select user_id from public.finance_budgets
    ) as all_owners
    group by user_id
  ) as distinct_owners;

  if owner_count > 1 then
    raise exception 'Finance rows have multiple owners. Resolve ownership before enabling single-owner anonymous access.';
  elsif owner_count = 1 then
    select user_id into selected_owner from (
      select user_id from public.finance_categories
      union all select user_id from public.finance_payment_methods
      union all select user_id from public.finance_transactions
      union all select user_id from public.finance_budgets
    ) as existing_owners
    limit 1;
  else
    selected_owner := gen_random_uuid();
  end if;

  insert into public.finance_private_settings (singleton, owner_user_id)
  values (true, selected_owner)
  on conflict (singleton) do nothing;
end;
$$;

-- The owner UUID is now stored outside auth.users. Drop only the original
-- auth.users foreign keys; this does not delete or rewrite finance data.
alter table public.finance_categories drop constraint if exists finance_categories_user_id_fkey;
alter table public.finance_payment_methods drop constraint if exists finance_payment_methods_user_id_fkey;
alter table public.finance_transactions drop constraint if exists finance_transactions_user_id_fkey;
alter table public.finance_budgets drop constraint if exists finance_budgets_user_id_fkey;

alter table public.finance_private_settings enable row level security;
alter table public.finance_private_settings force row level security;
revoke all on public.finance_private_settings from public, anon, authenticated;

create or replace function public.finance_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select s.owner_user_id
  from public.finance_private_settings as s
  where s.singleton = true
$$;
revoke all on function public.finance_owner_id() from public;
grant execute on function public.finance_owner_id() to anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'finance_categories', 'finance_payment_methods',
    'finance_transactions', 'finance_budgets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "Finance owner access" on public.%I', t);
    execute format('drop policy if exists "Finance anon single owner" on public.%I', t);
    execute format(
      'create policy "Finance anon single owner" on public.%I '
      'for all to anon using (user_id = public.finance_owner_id()) '
      'with check (user_id = public.finance_owner_id())', t
    );
  end loop;
end;
$$;

grant usage on schema public to anon;
grant select, insert, update, delete on
  public.finance_categories,
  public.finance_payment_methods,
  public.finance_transactions,
  public.finance_budgets
to anon;
