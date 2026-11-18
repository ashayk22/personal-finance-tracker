import { supabase } from '../../src/lib/supabaseClient';

export type FinanceKind = 'expense' | 'income';
export interface FinanceCategory { id: string; name: string; kind: FinanceKind; icon: string; is_default: boolean }
export interface PaymentMethod { id: string; name: string }
export interface FinanceTransaction {
  id: string; amount: number; kind: FinanceKind; description: string;
  transaction_date: string; created_at: string; category_id: string;
  payment_method_id: string; category?: FinanceCategory; payment_method?: PaymentMethod;
}
export interface FinanceBudget { id: string; amount: number; month: string; category_id: string | null }

export const defaultCategories: { name: string; kind: FinanceKind; icon: string }[] = [
  ...['Food','Transport','Shopping','Groceries','Entertainment','Education','Health','Bills','Subscriptions','Travel','Other'].map((name) => ({ name, kind: 'expense' as const, icon: 'circle' })),
  ...['Salary','Freelance','Business','Investments','Other'].map((name) => ({ name, kind: 'income' as const, icon: 'circle' })),
];
export const defaultMethods = ['Cash','UPI','Debit Card','Credit Card','Bank Transfer','Other'];
const requireClient = () => { if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'); return supabase; };
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
  const [transactions, budgets] = await Promise.all([
    client.from('finance_transactions').select('*, category:finance_categories(id,name,kind,icon), payment_method:finance_payment_methods(id,name)').eq('user_id', user_id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(3000),
    client.from('finance_budgets').select('*').eq('user_id', user_id),
  ]);
  return { categories, methods, transactions: result(transactions) as FinanceTransaction[], budgets: result(budgets) as FinanceBudget[], userId: user_id };
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
