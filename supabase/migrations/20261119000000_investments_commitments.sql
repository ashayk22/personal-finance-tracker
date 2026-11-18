-- Investment and recurring commitment tracking for Moneta's single-owner app.
-- RLS remains enabled and access is limited to the existing anon owner UUID.

alter table public.finance_transactions
  add column if not exists classification text not null default 'everyday'
    check (classification in ('everyday','investment','insurance','commitment')),
  add column if not exists commitment_payment_id uuid;

create table if not exists public.finance_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commitment_type text not null check (commitment_type in ('sip','insurance','recurring')),
  name text not null check (length(trim(name)) between 1 and 120),
  provider text not null default '' check (length(provider) <= 120),
  product_name text not null default '' check (length(product_name) <= 160),
  policy_number text not null default '' check (length(policy_number) <= 100),
  policy_type text not null default '' check (length(policy_type) <= 100),
  folio_number text not null default '' check (length(folio_number) <= 100),
  amount numeric(12,2) not null check (amount > 0),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  schedule_anchor_day smallint not null default 1 check (schedule_anchor_day between 1 and 31),
  start_date date not null,
  next_due_date date not null,
  maturity_date date,
  sum_assured numeric(14,2) check (sum_assured is null or sum_assured > 0),
  payment_method_id uuid,
  status text not null default 'active' check (status in ('active','paused','completed')),
  reminder_days smallint[] not null default array[7,3,1,0]::smallint[]
    check (reminder_days <@ array[7,3,1,0]::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, payment_method_id)
    references public.finance_payment_methods(user_id, id) on delete restrict
);

create table if not exists public.finance_commitment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commitment_id uuid not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  transaction_id uuid unique,
  created_at timestamptz not null default now(),
  unique (commitment_id, due_date),
  unique (user_id, id),
  foreign key (user_id, commitment_id)
    references public.finance_commitments(user_id, id) on delete cascade
);

alter table public.finance_transactions
  add constraint finance_transactions_commitment_payment_fk
  foreign key (user_id, commitment_payment_id)
  references public.finance_commitment_payments(user_id, id) on delete restrict;

alter table public.finance_commitment_payments
  add constraint finance_commitment_payments_transaction_fk
  foreign key (user_id, transaction_id)
  references public.finance_transactions(user_id, id) on delete restrict;

create unique index if not exists finance_tx_commitment_payment_unique_idx
  on public.finance_transactions(commitment_payment_id)
  where commitment_payment_id is not null;
create index if not exists finance_commitments_user_due_idx
  on public.finance_commitments(user_id, status, next_due_date);
create index if not exists finance_commitment_payments_user_paid_idx
  on public.finance_commitment_payments(user_id, status, paid_at desc);

drop trigger if exists finance_commitments_updated_at on public.finance_commitments;
create trigger finance_commitments_updated_at before update on public.finance_commitments
  for each row execute function public.finance_set_updated_at();

alter table public.finance_commitments enable row level security;
alter table public.finance_commitments force row level security;
drop policy if exists "Finance anon single owner" on public.finance_commitments;
create policy "Finance anon single owner" on public.finance_commitments
  for all to anon using (user_id = public.finance_owner_id())
  with check (user_id = public.finance_owner_id());

alter table public.finance_commitment_payments enable row level security;
alter table public.finance_commitment_payments force row level security;
drop policy if exists "Finance anon single owner" on public.finance_commitment_payments;
create policy "Finance anon single owner" on public.finance_commitment_payments
  for all to anon using (user_id = public.finance_owner_id())
  with check (user_id = public.finance_owner_id());

grant select, insert, update, delete on public.finance_commitments to anon;
revoke insert, update, delete on public.finance_commitment_payments from anon;
grant select on public.finance_commitment_payments to anon;

create or replace function public.finance_protect_commitment_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.commitment_payment_id is not null then
    raise exception 'Commitment payment transactions cannot be edited or deleted; update the commitment record instead.' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists finance_protect_commitment_transaction on public.finance_transactions;
create trigger finance_protect_commitment_transaction
  before update or delete on public.finance_transactions
  for each row execute function public.finance_protect_commitment_transaction();

create or replace function public.finance_mark_commitment_paid(
  p_commitment_id uuid,
  p_due_date date,
  p_payment_method_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_owner uuid := public.finance_owner_id();
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
  select * into v_commitment
  from public.finance_commitments
  where id = p_commitment_id and user_id = v_owner
  for update;
  if not found then raise exception 'Commitment not found.' using errcode = 'P0002'; end if;
  select id, transaction_id into v_payment_id, v_transaction_id
  from public.finance_commitment_payments
  where commitment_id = p_commitment_id and due_date = p_due_date and status = 'paid';
  if found then
    return jsonb_build_object('payment_id', v_payment_id, 'transaction_id', v_transaction_id, 'already_paid', true);
  end if;
  if v_commitment.status <> 'active' then raise exception 'Only active commitments can be marked paid.' using errcode = '23514'; end if;
  if p_due_date <> v_commitment.next_due_date then raise exception 'This payment date is no longer current. Refresh the commitments page.' using errcode = '23514'; end if;
  if not exists (select 1 from public.finance_payment_methods m where m.id = p_payment_method_id and m.user_id = v_owner) then
    raise exception 'Choose a valid payment method.' using errcode = '23503';
  end if;

  v_classification := case v_commitment.commitment_type
    when 'sip' then 'investment'
    when 'insurance' then 'insurance'
    else 'commitment' end;
  v_category_name := case v_commitment.commitment_type
    when 'sip' then 'Investments'
    when 'insurance' then 'Insurance premiums'
    else 'Recurring commitments' end;

  insert into public.finance_categories (user_id, name, kind, icon, is_default)
  values (v_owner, v_category_name, 'expense', 'circle', true)
  on conflict (user_id, name, kind) do update set name = excluded.name
  returning id into v_category_id;

  insert into public.finance_commitment_payments (user_id, commitment_id, due_date, amount, status, paid_at)
  values (v_owner, p_commitment_id, p_due_date, v_commitment.amount, 'paid', now())
  on conflict (commitment_id, due_date) do update set status = 'paid', paid_at = now()
  returning id into v_payment_id;

  insert into public.finance_transactions (
    user_id, category_id, payment_method_id, kind, amount, description,
    transaction_date, notes, classification, commitment_payment_id
  ) values (
    v_owner, v_category_id, p_payment_method_id, 'expense', v_commitment.amount,
    left(v_commitment.name || ' payment', 240), p_due_date,
    'Recorded manually as paid in Moneta. No bank deduction was verified.',
    v_classification, v_payment_id
  ) returning id into v_transaction_id;

  update public.finance_commitment_payments set transaction_id = v_transaction_id where id = v_payment_id;

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
      status = case when maturity_date is not null and v_next_date > maturity_date then 'completed' else status end
  where id = p_commitment_id;

  return jsonb_build_object('payment_id', v_payment_id, 'transaction_id', v_transaction_id, 'already_paid', false);
end;
$$;

revoke all on function public.finance_mark_commitment_paid(uuid, date, uuid) from public;
grant execute on function public.finance_mark_commitment_paid(uuid, date, uuid) to anon;
