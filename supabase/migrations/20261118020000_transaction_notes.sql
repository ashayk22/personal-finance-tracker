alter table public.finance_transactions
  add column if not exists notes text not null default ''
  check (char_length(notes) <= 4000);

comment on column public.finance_transactions.notes is
  'Optional transaction notes included in personal finance exports.';
