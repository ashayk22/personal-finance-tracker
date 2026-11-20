-- Multi-user authentication, RLS gating, and atomic commitment payments.
-- Legacy finance rows remain untouched in this migration. The next migration
-- performs only the explicitly confirmed, transactional in-place owner claim.
begin;
set local row_security = off;

create table if not exists public.finance_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.finance_profiles enable row level security;
alter table public.finance_profiles force row level security;
drop policy if exists "Finance profile owner access" on public.finance_profiles;
create policy "Finance profile owner access" on public.finance_profiles
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.finance_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.finance_profiles to authenticated;

create or replace function public.finance_create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  insert into public.finance_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
  on conflict (user_id) do nothing;

  -- On a genuinely empty installation, bind the empty singleton to the first
  -- Auth user. Never claim a workspace that already contains finance rows.
  perform pg_advisory_xact_lock(hashtext('moneta-empty-workspace-bootstrap-v1'));
  if not exists (
       select 1 from public.finance_private_settings s
       join auth.users u on u.id = s.owner_user_id
       where s.singleton = true
     )
     and not exists (
       select 1 from (
         select user_id from public.finance_categories
         union all select user_id from public.finance_payment_methods
         union all select user_id from public.finance_transactions
         union all select user_id from public.finance_budgets
         union all select user_id from public.finance_commitments
         union all select user_id from public.finance_commitment_payments
       ) r
     ) then
    update public.finance_private_settings
    set owner_user_id = new.id
    where singleton = true;
  end if;

  return new;
end;
$$;
revoke all on function public.finance_create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists finance_create_profile_after_signup on auth.users;
create trigger finance_create_profile_after_signup
  after insert on auth.users for each row execute function public.finance_create_profile_for_auth_user();

-- Missing singleton, unresolved legacy ownership, or orphaned user rows fail closed.
create or replace function public.finance_workspace_ready()
returns boolean language sql stable security definer
set search_path = '' set row_security = off as $$
  select auth.uid() is not null
     and exists (select 1 from auth.users u where u.id = auth.uid())
     and (select count(*) from public.finance_private_settings s where s.singleton = true) = 1
     and (
       exists (
         select 1 from public.finance_private_settings s
         join auth.users u on u.id = s.owner_user_id
         where s.singleton = true
       )
       or not exists (
         select 1 from (
           select user_id from public.finance_categories
           union all select user_id from public.finance_payment_methods
           union all select user_id from public.finance_transactions
           union all select user_id from public.finance_budgets
           union all select user_id from public.finance_commitments
           union all select user_id from public.finance_commitment_payments
         ) r
       )
     )
     and not exists (
       select 1 from (
         select user_id from public.finance_categories
         union all select user_id from public.finance_payment_methods
         union all select user_id from public.finance_transactions
         union all select user_id from public.finance_budgets
         union all select user_id from public.finance_commitments
         union all select user_id from public.finance_commitment_payments
       ) r
       where not exists (select 1 from auth.users u where u.id = r.user_id)
     );
$$;
revoke all on function public.finance_workspace_ready() from public, anon, authenticated;
grant execute on function public.finance_workspace_ready() to authenticated;

-- These NOT VALID FKs preserve legacy owner IDs for the following claim step,
-- while enforcing Auth ownership on every inserted or changed row immediately.
do $$
declare item record;
begin
  for item in select * from (values
    ('finance_categories', 'finance_categories_user_id_auth_fkey'),
    ('finance_payment_methods', 'finance_payment_methods_user_id_auth_fkey'),
    ('finance_transactions', 'finance_transactions_user_id_auth_fkey'),
    ('finance_budgets', 'finance_budgets_user_id_auth_fkey'),
    ('finance_commitments', 'finance_commitments_user_id_auth_fkey'),
    ('finance_commitment_payments', 'finance_commitment_payments_user_id_auth_fkey'),
    ('finance_private_settings', 'finance_private_settings_owner_auth_fkey')
  ) as constraints_to_add(table_name, constraint_name) loop
    if not exists (
      select 1 from pg_constraint
      where conname = item.constraint_name
        and conrelid = format('public.%I', item.table_name)::regclass
    ) then
      if item.table_name = 'finance_private_settings' then
        execute 'alter table public.finance_private_settings
          add constraint finance_private_settings_owner_auth_fkey
          foreign key (owner_user_id) references auth.users(id) on delete cascade not valid';
      else
        execute format(
          'alter table public.%I add constraint %I
           foreign key (user_id) references auth.users(id) on delete cascade not valid',
          item.table_name, item.constraint_name
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Per-user policies require both uid ownership and the fail-closed readiness gate.
-- Commitment payment rows are SELECT-only to clients.
do $$
declare t text;
begin
  foreach t in array array[
    'finance_categories', 'finance_payment_methods', 'finance_transactions',
    'finance_budgets', 'finance_commitments', 'finance_commitment_payments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "Finance anon single owner" on public.%I', t);
    execute format('drop policy if exists "Finance owner access" on public.%I', t);
    execute format('drop policy if exists "Finance authenticated owner access" on public.%I', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    if t = 'finance_commitment_payments' then
      execute format(
        'create policy "Finance authenticated owner access" on public.%I
         for select to authenticated
         using (user_id = (select auth.uid()) and (select public.finance_workspace_ready()))',
        t
      );
      execute format('grant select on public.%I to authenticated', t);
    else
      execute format(
        'create policy "Finance authenticated owner access" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()) and (select public.finance_workspace_ready()))
         with check (user_id = (select auth.uid()) and (select public.finance_workspace_ready()))',
        t
      );
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end;
$$;

-- Reject client-forged commitment links while preserving the existing
-- transaction CRUD payload. Only the payment RPC's SECURITY DEFINER owner can set one.
create or replace function public.finance_validate_transaction_refs()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare payment_writer oid;
begin
  select p.proowner into payment_writer
  from pg_proc p
  where p.oid = 'public.finance_mark_commitment_paid(uuid,date,uuid)'::regprocedure;

  if new.commitment_payment_id is not null
     and current_user <> pg_get_userbyid(payment_writer) then
    raise exception 'Commitment payment links can only be written by the payment RPC.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.finance_categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.kind = new.kind
  ) or not exists (
    select 1 from public.finance_payment_methods m
    where m.id = new.payment_method_id and m.user_id = new.user_id
  ) then
    raise exception 'Invalid category or payment method for transaction owner.'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

-- The RPC is the only client-visible writer of commitment-payment rows.
alter table public.finance_private_settings enable row level security;
alter table public.finance_private_settings force row level security;
revoke all on public.finance_private_settings from public, anon, authenticated;
revoke all on function public.finance_owner_id() from public, anon, authenticated;
drop function if exists public.finance_claim_legacy_owner(uuid);

-- Atomic record + transaction + schedule advance. The commitment row lock and
-- unique partial transaction index prevent concurrent or repeated duplicates.
create or replace function public.finance_mark_commitment_paid(
  p_commitment_id uuid, p_due_date date, p_payment_method_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  v_owner uuid := auth.uid();
  v_commitment public.finance_commitments%rowtype;
  v_payment_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
  v_classification text;
  v_category_name text;
  v_next_date date;
  v_month_start date;
  v_month_end_day integer;
begin
  if v_owner is null or not exists (select 1 from auth.users u where u.id = v_owner) then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;
  if not public.finance_workspace_ready() then
    raise exception 'The finance workspace is not ready for access.' using errcode = '42501';
  end if;

  select * into v_commitment
  from public.finance_commitments
  where id = p_commitment_id and user_id = v_owner
  for update;
  if not found then raise exception 'Commitment not found.' using errcode = 'P0002'; end if;

  select p.id, p.transaction_id into v_payment_id, v_transaction_id
  from public.finance_commitment_payments p
  where p.user_id = v_owner and p.commitment_id = p_commitment_id
    and p.due_date = p_due_date and p.status = 'paid'
  for update;
  if found then
    return jsonb_build_object(
      'payment_id', v_payment_id, 'transaction_id', v_transaction_id, 'already_paid', true
    );
  end if;

  if v_commitment.status <> 'active' then
    raise exception 'Only active commitments can be marked paid.' using errcode = '23514';
  end if;
  if p_due_date <> v_commitment.next_due_date then
    raise exception 'This payment date is no longer current. Refresh the commitments page.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.finance_payment_methods m
    where m.id = p_payment_method_id and m.user_id = v_owner
  ) then
    raise exception 'Choose a valid payment method.' using errcode = '23503';
  end if;

  v_classification := case v_commitment.commitment_type
    when 'sip' then 'investment'
    when 'insurance' then 'insurance'
    else 'commitment'
  end;
  v_category_name := case v_commitment.commitment_type
    when 'sip' then 'Investments'
    when 'insurance' then 'Insurance premiums'
    else 'Recurring commitments'
  end;

  insert into public.finance_categories (user_id, name, kind, icon, is_default)
  values (v_owner, v_category_name, 'expense', 'circle', true)
  on conflict (user_id, name, kind) do update set name = excluded.name
  returning id into v_category_id;

  insert into public.finance_commitment_payments
    (user_id, commitment_id, due_date, amount, status, paid_at)
  values (v_owner, p_commitment_id, p_due_date, v_commitment.amount, 'paid', now())
  on conflict (commitment_id, due_date)
  do update set status = 'paid', paid_at = now()
  returning id into v_payment_id;

  insert into public.finance_transactions (
    user_id, category_id, payment_method_id, kind, amount, description,
    transaction_date, notes, classification, commitment_payment_id
  ) values (
    v_owner, v_category_id, p_payment_method_id, 'expense', v_commitment.amount,
    left(v_commitment.name || ' payment', 240), p_due_date,
    'Recorded manually as paid in Moneta. No bank deduction was verified.',
    v_classification, v_payment_id
  )
  returning id into v_transaction_id;

  update public.finance_commitment_payments
  set transaction_id = v_transaction_id where id = v_payment_id and user_id = v_owner;

  if v_commitment.frequency = 'weekly' then
    v_next_date := v_commitment.next_due_date + 7;
  else
    v_month_start := date_trunc('month', v_commitment.next_due_date + case
      when v_commitment.frequency = 'monthly' then interval '1 month'
      when v_commitment.frequency = 'quarterly' then interval '3 months'
      else interval '1 year' end)::date;
    v_month_end_day := extract(day from (v_month_start + interval '1 month - 1 day'))::integer;
    v_next_date := v_month_start + (least(v_commitment.schedule_anchor_day, v_month_end_day) - 1);
  end if;

  update public.finance_commitments
  set next_due_date = v_next_date,
      status = case when maturity_date is not null and v_next_date > maturity_date
                    then 'completed' else status end
  where id = p_commitment_id and user_id = v_owner;

  return jsonb_build_object(
    'payment_id', v_payment_id, 'transaction_id', v_transaction_id, 'already_paid', false
  );
end;
$$;
revoke all on function public.finance_mark_commitment_paid(uuid,date,uuid) from public, anon, authenticated;
grant execute on function public.finance_mark_commitment_paid(uuid,date,uuid) to authenticated;

drop function if exists public.finance_owner_id();
grant usage on schema public to authenticated;
commit;
