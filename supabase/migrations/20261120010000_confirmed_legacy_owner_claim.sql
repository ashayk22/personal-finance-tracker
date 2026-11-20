-- The production-only owner claim was applied after human confirmation.
-- Account UUIDs and the claim operation are intentionally excluded from this public repository.
-- This file is a post-claim assertion for an already-linked or empty workspace.
-- It never changes or reassigns finance records.
begin;
set local row_security = off;

do $post_claim$
declare
  v_settings_count bigint;
  v_settings_owner uuid;
  v_finance_rows bigint;
begin
  select count(*), (array_agg(s.owner_user_id))[1]
    into v_settings_count, v_settings_owner
  from public.finance_private_settings s
  where s.singleton = true;
  if v_settings_count <> 1 then
    raise exception 'Expected exactly one finance settings singleton.';
  end if;

  select count(*) into v_finance_rows from (
    select user_id from public.finance_categories
    union all select user_id from public.finance_payment_methods
    union all select user_id from public.finance_transactions
    union all select user_id from public.finance_budgets
    union all select user_id from public.finance_commitments
    union all select user_id from public.finance_commitment_payments
  ) r;

  if exists (
    select 1 from (
      select user_id from public.finance_categories
      union all select user_id from public.finance_payment_methods
      union all select user_id from public.finance_transactions
      union all select user_id from public.finance_budgets
      union all select user_id from public.finance_commitments
      union all select user_id from public.finance_commitment_payments
    ) r
    where not exists (select 1 from auth.users u where u.id = r.user_id)
  ) then
    raise exception 'Legacy ownership remains unresolved. Do not expose the workspace; prepare a private, human-reviewed claim.';
  end if;

  if v_finance_rows > 0 and not exists (
    select 1 from auth.users u where u.id = v_settings_owner
  ) then
    raise exception 'Finance rows exist but the settings owner is not an Auth user.';
  end if;
end;
$post_claim$;

notify pgrst, 'reload schema';
commit;