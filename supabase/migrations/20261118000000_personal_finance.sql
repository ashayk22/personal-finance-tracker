-- Personal finance tables. All rows are private to the authenticated owner.
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('expense','income')),
  icon text not null default 'circle',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, name, kind),
  unique(user_id, id, kind),
  unique(user_id, id)
);
create table if not exists public.finance_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, name),
  unique(user_id, id)
);
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  payment_method_id uuid not null,
  kind text not null check (kind in ('expense','income')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '' check (length(description) <= 240),
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, category_id, kind) references public.finance_categories(user_id, id, kind) on delete restrict,
  foreign key (user_id, payment_method_id) references public.finance_payment_methods(user_id, id) on delete restrict
);
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category_id uuid,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_budgets_category_owner_fk foreign key (user_id, category_id) references public.finance_categories(user_id, id) on delete cascade
);
create unique index if not exists finance_budgets_user_month_category_idx
  on public.finance_budgets(user_id, month, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists finance_tx_user_date_idx on public.finance_transactions(user_id, transaction_date desc);
create index if not exists finance_tx_user_category_idx on public.finance_transactions(user_id, category_id);

-- Prevent cross-owner foreign key references, even if a client submits another UUID.
create or replace function public.finance_validate_transaction_refs()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.user_id = new.user_id and c.kind = new.kind)
     or not exists (select 1 from public.finance_payment_methods p where p.id = new.payment_method_id and p.user_id = new.user_id) then
    raise exception 'Invalid category or payment method for transaction owner' using errcode = '23503';
  end if;
  return new;
end;
$$;
drop trigger if exists finance_validate_transaction_refs on public.finance_transactions;
create trigger finance_validate_transaction_refs before insert or update on public.finance_transactions
for each row execute function public.finance_validate_transaction_refs();

create or replace function public.finance_validate_budget_category()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.finance_categories c
    where c.id = new.category_id and c.user_id = new.user_id and c.kind = 'expense'
  ) then
    raise exception 'Budget category must be an expense category owned by the user' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists finance_validate_budget_category on public.finance_budgets;
create trigger finance_validate_budget_category before insert or update on public.finance_budgets
for each row execute function public.finance_validate_budget_category();

create or replace function public.finance_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists finance_tx_updated_at on public.finance_transactions;
create trigger finance_tx_updated_at before update on public.finance_transactions for each row execute function public.finance_set_updated_at();
drop trigger if exists finance_budget_updated_at on public.finance_budgets;
create trigger finance_budget_updated_at before update on public.finance_budgets for each row execute function public.finance_set_updated_at();

do $$ declare t text; begin
  foreach t in array array['finance_categories','finance_payment_methods','finance_transactions','finance_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "Finance owner access" on public.%I', t);
    execute format('create policy "Finance owner access" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
