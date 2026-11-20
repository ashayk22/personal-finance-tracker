-- Post-migration checks. This file is not a migration and changes no lasting data.
-- Replace the second-user placeholder with a real, distinct Auth UUID.
-- The payment RPC smoke test is fully rolled back.

do $verify$
declare
  c bigint; m bigint; t bigint; b bigint; k bigint; p bigint;
  owner_id uuid;
begin
  if (select count(*) from public.finance_private_settings where singleton=true) <> 1 then
    raise exception 'Finance settings singleton is missing or duplicated.';
  end if;
  select owner_user_id into owner_id
  from public.finance_private_settings where singleton=true;
  if not exists (select 1 from auth.users where id=owner_id) then
    raise exception 'Finance settings owner is not a valid Auth user.';
  end if;

  select count(*) into c from public.finance_categories where user_id=owner_id;
  select count(*) into m from public.finance_payment_methods where user_id=owner_id;
  select count(*) into t from public.finance_transactions where user_id=owner_id;
  select count(*) into b from public.finance_budgets where user_id=owner_id;
  select count(*) into k from public.finance_commitments where user_id=owner_id;
  select count(*) into p from public.finance_commitment_payments where user_id=owner_id;
  if c<>16 or m<>6 or t<>8 then
    raise exception 'Expected original baseline 16/6/8, got %, %, %.', c,m,t;
  end if;
  if exists (
    select 1 from (
      select user_id from public.finance_categories
      union all select user_id from public.finance_payment_methods
      union all select user_id from public.finance_transactions
      union all select user_id from public.finance_budgets
      union all select user_id from public.finance_commitments
      union all select user_id from public.finance_commitment_payments
    ) r where not exists (select 1 from auth.users u where u.id=r.user_id)
  ) then raise exception 'Finance rows without a valid Auth owner remain.'; end if;

  if has_table_privilege('authenticated','public.finance_commitment_payments','INSERT')
     or has_table_privilege('authenticated','public.finance_commitment_payments','UPDATE')
     or has_table_privilege('authenticated','public.finance_commitment_payments','DELETE') then
    raise exception 'Authenticated role can directly write commitment payments.';
  end if;
  if not has_function_privilege('authenticated','public.finance_mark_commitment_paid(uuid,date,uuid)','EXECUTE')
     or has_function_privilege('anon','public.finance_mark_commitment_paid(uuid,date,uuid)','EXECUTE') then
    raise exception 'Payment RPC execution grants are incorrect.';
  end if;
  if exists (
    select 1 from (values ('finance_categories'),('finance_payment_methods'),('finance_transactions'),
      ('finance_budgets'),('finance_commitments'),('finance_commitment_payments')) e(name)
    where not exists (
      select 1 from pg_class cl join pg_namespace n on n.oid=cl.relnamespace
      where n.nspname='public' and cl.relname=e.name and cl.relrowsecurity and cl.relforcerowsecurity
    )
  ) then raise exception 'One or more finance tables lack enabled and forced RLS.'; end if;
  raise notice 'Counts: categories %, methods %, transactions %, budgets %, commitments %, payments %.',
    c,m,t,b,k,p;
end;
$verify$;

do $privilege_check$
begin
  if not has_function_privilege('authenticated','public.finance_workspace_ready()','EXECUTE')
     or has_function_privilege('anon','public.finance_workspace_ready()','EXECUTE') then
    raise exception 'Workspace-readiness function grants are incorrect.';
  end if;
  if exists (
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in (
      'public.finance_workspace_ready()'::regprocedure,
      'public.finance_mark_commitment_paid(uuid,date,uuid)'::regprocedure
    )
      and a.grantee = 0::oid and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC has execute on a private finance function.';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='finance_tx_commitment_payment_unique_idx'
      and indexdef ilike 'CREATE UNIQUE INDEX%commitment_payment_id%'
  ) then
    raise exception 'Unique commitment-payment transaction index is missing.';
  end if;
end;
$privilege_check$;

begin;
do $set_test_owner$
begin
  perform set_config(
    'moneta.test_owner',
    (select owner_user_id::text from public.finance_private_settings where singleton=true),
    true
  );
end;
$set_test_owner$;
set local role authenticated;
select set_config('request.jwt.claim.sub','REPLACE_WITH_SECOND_AUTH_USER_UUID',true);
do $isolation$
declare owner_id uuid;
begin
  owner_id := current_setting('moneta.test_owner')::uuid;
  if auth.uid() = owner_id then raise exception 'Use a distinct second Auth account for isolation checks.'; end if;

  if exists (select 1 from public.finance_categories)
     or exists (select 1 from public.finance_payment_methods)
     or exists (select 1 from public.finance_transactions)
     or exists (select 1 from public.finance_budgets)
     or exists (select 1 from public.finance_commitments)
     or exists (select 1 from public.finance_commitment_payments) then
    raise exception 'Second user can access another workspace.';
  end if;

  if not has_table_privilege(current_user, 'public.finance_categories', 'INSERT') then
    raise exception 'RLS write probe is inconclusive because the role lacks insert privilege.';
  end if;
  begin
    insert into public.finance_categories(user_id, name, kind, icon, is_default)
    values (owner_id, 'isolation-probe-' || gen_random_uuid()::text, 'expense', 'circle', false);
    raise exception 'RLS unexpectedly allowed a cross-user insert.';
  exception
    when insufficient_privilege then null;
  end;

  update public.finance_categories
  set name = name || '-isolation-probe'
  where user_id = owner_id;
  if found then raise exception 'RLS unexpectedly allowed a cross-user update.'; end if;
end;
$isolation$;
rollback;

begin;
do $set_payment_owner$
begin
  perform set_config(
    'request.jwt.claim.sub',
    (select owner_user_id::text from public.finance_private_settings where singleton=true),
    true
  );
end;
$set_payment_owner$;
set local role authenticated;
do $payment_test$
declare cid uuid; due date; method_id uuid; first_result jsonb; second_result jsonb; pid uuid; tid uuid;
begin
  select c.id,c.next_due_date,coalesce(c.payment_method_id,(
    select m.id from public.finance_payment_methods m where m.user_id=auth.uid() order by m.name limit 1
  ))
  into cid,due,method_id
  from public.finance_commitments c
  where c.user_id=auth.uid() and c.status='active'
  order by c.next_due_date limit 1;
  if not found then raise notice 'Payment smoke test skipped: no active commitment.'; return; end if;
  if method_id is null then raise exception 'No payment method is available.'; end if;
  first_result:=public.finance_mark_commitment_paid(cid,due,method_id);
  pid:=(first_result->>'payment_id')::uuid;
  tid:=(first_result->>'transaction_id')::uuid;
  if pid is null or tid is null or coalesce((first_result->>'already_paid')::boolean,true) then
    raise exception 'First payment call failed to create one linked transaction.';
  end if;
  if (select count(*) from public.finance_transactions
      where user_id=auth.uid() and commitment_payment_id=pid) <> 1 then
    raise exception 'Payment did not produce exactly one transaction.';
  end if;
  second_result:=public.finance_mark_commitment_paid(cid,due,method_id);
  if not coalesce((second_result->>'already_paid')::boolean,false)
     or (second_result->>'transaction_id')::uuid<>tid then
    raise exception 'Repeated payment call was not idempotent.';
  end if;
  if (select count(*) from public.finance_transactions
      where user_id=auth.uid() and commitment_payment_id=pid) <> 1 then
    raise exception 'Repeated call produced a duplicate transaction.';
  end if;
end;
$payment_test$;
rollback;