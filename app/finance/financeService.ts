import { supabase } from '../../src/lib/supabaseClient';

export type FinanceKind = 'expense' | 'income';
export interface FinanceCategory { id: string; name: string; kind: FinanceKind; icon: string; is_default: boolean }
export interface PaymentMethod { id: string; name: string }
export interface FinanceTransaction {
  id: string; amount: number; kind: FinanceKind; description: string;
  transaction_date: string; created_at: string; category_id: string;
  payment_method_id: string; category?: FinanceCategory; payment_method?: PaymentMethod;
  notes?: string | null;
  classification?: 'everyday' | 'investment' | 'insurance' | 'commitment';
  commitment_payment_id?: string | null;
}
export interface FinanceBudget { id: string; amount: number; month: string; category_id: string | null }
export type CommitmentType = 'sip' | 'insurance' | 'recurring';
export type CommitmentFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type CommitmentStatus = 'active' | 'paused' | 'completed';
export interface FinanceCommitment {
  id: string; user_id: string; commitment_type: CommitmentType; name: string;
  provider: string; product_name: string; policy_number: string; policy_type: string;
  folio_number: string; amount: number; frequency: CommitmentFrequency;
  schedule_anchor_day: number;
  start_date: string; next_due_date: string; maturity_date: string | null;
  sum_assured: number | null; payment_method_id: string | null; status: CommitmentStatus;
  reminder_days: number[]; created_at: string; updated_at: string;
  payment_method?: PaymentMethod | null;
}
export interface CommitmentPayment {
  id: string; user_id: string; commitment_id: string; due_date: string; amount: number;
  status: 'due' | 'paid'; paid_at: string | null; transaction_id: string | null;
}

export const defaultCategories: { name: string; kind: FinanceKind; icon: string }[] = [
  ...['Food','Transport','Shopping','Groceries','Entertainment','Education','Health','Bills','Subscriptions','Travel','Other'].map((name) => ({ name, kind: 'expense' as const, icon: 'circle' })),
  ...['Salary','Freelance','Business','Investments','Other'].map((name) => ({ name, kind: 'income' as const, icon: 'circle' })),
];
export const defaultMethods = ['Cash','UPI','Debit Card','Credit Card','Bank Transfer','Other'];
const requireClient = () => { if (!supabase) throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'); return supabase; };
const result = <T,>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export async function loadFinance() {
  const client = requireClient();
  const user_id = result(await client.rpc('finance_owner_id')) as string;
  if (!user_id) throw new Error('The finance owner is not configured in Supabase. Apply the single-owner migration.');
  let categories = result(await client.from('finance_categories').select('*').eq('user_id', user_id).order('name')) as FinanceCategory[];
  let methods = result(await client.from('finance_payment_methods').select('*').eq('user_id', user_id).order('name')) as PaymentMethod[];
  if (!categories.length) {
    categories = result(await client.from('finance_categories').insert(defaultCategories.map((c) => ({ ...c, user_id, is_default: true }))).select('*')) as FinanceCategory[];
  }
  if (!methods.length) {
    methods = result(await client.from('finance_payment_methods').insert(defaultMethods.map((name) => ({ name, user_id, is_default: true }))).select('*')) as PaymentMethod[];
  }
  const [transactions, budgets, notesColumn, commitments, commitmentPayments] = await Promise.all([
    client.from('finance_transactions').select('*, category:finance_categories(id,name,kind,icon), payment_method:finance_payment_methods(id,name)').eq('user_id', user_id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(3000),
    client.from('finance_budgets').select('*').eq('user_id', user_id),
    client.from('finance_transactions').select('notes').limit(0),
    client.from('finance_commitments').select('*, payment_method:finance_payment_methods(id,name)').eq('user_id', user_id).order('next_due_date'),
    client.from('finance_commitment_payments').select('*').eq('user_id', user_id).order('due_date', { ascending: false }).limit(5000),
  ]);
  return {
    categories,
    methods,
    transactions: result(transactions) as FinanceTransaction[],
    budgets: result(budgets) as FinanceBudget[],
    userId: user_id,
    notesAvailable: !notesColumn.error,
    commitments: (commitments.error ? [] : commitments.data) as FinanceCommitment[],
    commitmentPayments: (commitmentPayments.error ? [] : commitmentPayments.data) as CommitmentPayment[],
    commitmentsError: commitments.error?.message || commitmentPayments.error?.message || '',
    commitmentsAvailable: !commitments.error && !commitmentPayments.error,
  };
}

export async function loadTransactionsForExport(
  userId: string,
  options: { from?: string; to?: string; kind?: FinanceKind } = {},
) {
  const client = requireClient();
  const pageSize = 1000;
  const maxRows = 100_000;
  const rows: FinanceTransaction[] = [];
  let offset = 0;

  while (true) {
    let query = client
      .from('finance_transactions')
      .select('*, category:finance_categories(id,name,kind,icon), payment_method:finance_payment_methods(id,name)')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (options.from) query = query.gte('transaction_date', options.from);
    if (options.to) query = query.lte('transaction_date', options.to);
    if (options.kind) query = query.eq('kind', options.kind);

    const page = result(await query) as FinanceTransaction[];
    rows.push(...page);
    if (rows.length > maxRows) {
      throw new Error('This export exceeds 100,000 transactions. Narrow the reporting period and try again.');
    }
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

export async function saveTransaction(userId: string, value: Omit<FinanceTransaction, 'id'|'created_at'|'category'|'payment_method'>, id?: string) {
  const c = requireClient();
  const payload = { ...value, user_id: userId };
  if (id) result(await c.from('finance_transactions').update(payload).eq('id', id).eq('user_id', userId));
  else result(await c.from('finance_transactions').insert(payload));
}
export async function deleteTransaction(userId: string, id: string) { result(await requireClient().from('finance_transactions').delete().eq('id', id).eq('user_id', userId)); }
export async function saveBudget(userId: string, month: string, category_id: string | null, amount: number) {
  const c = requireClient();
  const found = await c.from('finance_budgets').select('id').eq('user_id', userId).eq('month', month).is('category_id', category_id).maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (found.data) result(await c.from('finance_budgets').update({ amount }).eq('id', found.data.id).eq('user_id', userId));
  else result(await c.from('finance_budgets').insert({ user_id: userId, month, category_id, amount }));
}
export async function addCategory(userId: string, name: string, kind: FinanceKind) { result(await requireClient().from('finance_categories').insert({ user_id: userId, name: name.trim(), kind, icon: 'circle' })); }
export async function deleteCategory(userId: string, id: string) { result(await requireClient().from('finance_categories').delete().eq('user_id', userId).eq('id', id).eq('is_default', false)); }

export type CommitmentInput = Omit<FinanceCommitment, 'id'|'user_id'|'created_at'|'updated_at'|'payment_method'>;
export async function saveCommitment(userId: string, value: CommitmentInput, id?: string) {
  const client = requireClient();
  const payload = { ...value, user_id: userId };
  if (id) result(await client.from('finance_commitments').update(payload).eq('id', id).eq('user_id', userId));
  else result(await client.from('finance_commitments').insert(payload));
}
export async function markCommitmentPaid(commitmentId: string, dueDate: string, paymentMethodId: string) {
  result(await requireClient().rpc('finance_mark_commitment_paid', {
    p_commitment_id: commitmentId,
    p_due_date: dueDate,
    p_payment_method_id: paymentMethodId,
  }));
}
