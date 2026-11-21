'use client';
import { SakugaButton } from './SakugaButton';

import React, { useMemo, useState } from 'react';
import { Activity, BellRing, CalendarClock, Check, CircleAlert, Coins, FilePlus2, Landmark, Pencil, Plus, ShieldCheck, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CommitmentFrequency, CommitmentInput, CommitmentPayment, CommitmentType, FinanceCommitment, PaymentMethod, markCommitmentPaid, saveCommitment } from './financeService';

type Props = { userId: string; methods: PaymentMethod[]; commitments: FinanceCommitment[]; payments: CommitmentPayment[]; available: boolean; loadError: string; onRefresh: () => Promise<void> };
const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dueDays = (value: string) => Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
const monthlyEquivalent = (amount: number, frequency: CommitmentFrequency) => amount * ({ weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[frequency]);
const frequencyLabel = (frequency: CommitmentFrequency) => ({ weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' })[frequency];
const COLORS = ['#ffcc00', '#3977ff', '#e63b2e', '#75cba3', '#f5f0e8'];

export function InvestmentsCommitments({ userId, methods, commitments, payments, available, loadError, onRefresh }: Props) {
  const [editing, setEditing] = useState<FinanceCommitment | null | false>(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const active = commitments.filter((item) => item.status === 'active');
  const allSips = commitments.filter((item) => item.commitment_type === 'sip');
  const sips = active.filter((item) => item.commitment_type === 'sip');
  const totalMonthlyInvestments = sips.reduce((sum, item) => sum + monthlyEquivalent(Number(item.amount), item.frequency), 0);
  const totalMonthlyInsurance = active.filter((item) => item.commitment_type === 'insurance').reduce((sum, item) => sum + monthlyEquivalent(Number(item.amount), item.frequency), 0);
  const totalInvested = payments.filter((payment) => payment.status === 'paid' && commitments.some((item) => item.id === payment.commitment_id && item.commitment_type === 'sip')).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const upcoming = active.map((item) => ({ item, days: dueDays(item.next_due_date) })).sort((a, b) => a.days - b.days);
  const reminders = upcoming.filter(({ item, days }) => item.reminder_days.includes(days) && days >= 0);

  const monthlyChart = useMemo(() => {
    const recentMonths = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index));
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(date);
    });
    return recentMonths.map((month) => ({
      month: new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)),
      contributed: payments.filter((payment) => payment.status === 'paid' && payment.due_date.slice(0, 7) === month && allSips.some((item) => item.id === payment.commitment_id)).reduce((sum, payment) => sum + Number(payment.amount), 0),
    }));
  }, [payments, allSips]);

  const sipBreakdown = useMemo(() => allSips.map((item) => ({
    name: item.name,
    value: payments.filter((payment) => payment.status === 'paid' && payment.commitment_id === item.id).reduce((sum, payment) => sum + Number(payment.amount), 0),
    monthly: monthlyEquivalent(Number(item.amount), item.frequency),
  })).filter((entry) => entry.value > 0 || entry.monthly > 0), [allSips, payments]);

  const commitmentBreakdown = useMemo(() => (['sip', 'insurance', 'recurring'] as const).map((kind) => ({
    name: kind === 'sip' ? 'SIPs' : kind === 'insurance' ? 'Insurance' : 'Other commitments',
    value: active.filter((item) => item.commitment_type === kind).reduce((sum, item) => sum + monthlyEquivalent(Number(item.amount), item.frequency), 0),
  })).filter((item) => item.value > 0), [active]);

  const markPaid = async (item: FinanceCommitment) => {
    const method = item.payment_method_id || methods[0]?.id;
    if (!method) { setError('Add a payment method before recording a payment.'); return; }
    if (!window.confirm(`Record ${money(Number(item.amount))} as paid for “${item.name}” due ${dateLabel(item.next_due_date)}? This creates one transaction in Moneta. It does not verify a bank deduction.`)) return;
    setBusyId(item.id); setError(''); setSuccess('');
    try {
      await markCommitmentPaid(item.id, item.next_due_date, method);
      await onRefresh();
      setSuccess(`${item.name} was recorded as paid and added once to transaction history.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record this payment.'); }
    finally { setBusyId(''); }
  };

  if (!available) return <div className="ft-content ft-page-content"><article className="ft-card ft-commitment-unavailable"><span className="ft-eyebrow">DATABASE SETUP REQUIRED</span><h2>Investments &amp; Commitments</h2><p>{loadError || 'The commitments tables are not available yet. Apply the pending investments and commitments migration to enable this section.'}</p><p>Your existing finance data remains available. No sample commitments have been created.</p></article></div>;

  return <div className="ft-content ft-page-content ft-commitments-page">
    <div className="ft-commitment-intro"><div><span className="ft-eyebrow">PLAN YOUR FINANCIAL FUTURE</span><h2>Investments &amp; Commitments</h2><p>Keep contributions, insurance premiums and recurring obligations in view.</p></div><SakugaButton className="ft-button ft-primary" onClick={() => setEditing(null)}><Plus size={17}/> Add commitment</SakugaButton></div>
    {reminders.length > 0 && <section className="ft-reminder-banner"><BellRing size={18}/><div><b>{reminders.length} in-app {reminders.length === 1 ? 'reminder' : 'reminders'}</b><span>{reminders.map(({ item, days }) => `${item.name} ${days === 0 ? 'is due today' : `is due in ${days} days`}`).join(' · ')}</span></div></section>}
    {error && <div className="ft-commitment-alert error"><CircleAlert size={16}/>{error}</div>}{success && <div className="ft-commitment-alert success"><Check size={16}/>{success}</div>}
    <section className="ft-kpis ft-commitment-kpis">
      <Kpi icon={Coins} label="Monthly investment commitment" value={money(totalMonthlyInvestments)} detail="Active SIPs, normalized monthly" tone="violet"/>
      <Kpi icon={Activity} label="Total invested" value={money(totalInvested)} detail={`${payments.filter((payment) => payment.status === 'paid' && sips.some((item) => item.id === payment.commitment_id)).length} recorded SIP contributions`} tone="green"/>
      <Kpi icon={Landmark} label="Active SIPs" value={String(sips.length)} detail={`${commitments.filter((item) => item.commitment_type === 'sip' && item.status === 'paused').length} paused`} tone="blue"/>
      <Kpi icon={CalendarClock} label="Upcoming payments" value={String(upcoming.filter(({ days }) => days >= 0).length)} detail={`${money(upcoming.filter(({ days }) => days >= 0).reduce((sum, row) => sum + Number(row.item.amount), 0))} scheduled`} tone="orange"/>
      <Kpi icon={ShieldCheck} label="Monthly insurance premiums" value={money(totalMonthlyInsurance)} detail="Active policies, normalized monthly" tone="red"/>
    </section>

    <section className="ft-grid-main ft-commitment-charts">
      <article className="ft-card ft-chart-card"><div className="ft-section-head"><div><h2>Investment contributions</h2><p>Recorded SIP payments · last six months</p></div></div>
        {payments.some((payment) => payment.status === 'paid' && sips.some((item) => item.id === payment.commitment_id)) ? <div className="ft-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyChart} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}><defs><linearGradient id="sipContributions" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffcc00" stopOpacity={.25}/><stop offset="100%" stopColor="#ffcc00" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" stroke="#3a3a40" vertical={false}/><XAxis dataKey="month" tick={{ fill: '#858d9e', fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: '#858d9e', fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: '#1c1c20', border: '2px solid #414147', borderRadius: 0, color: '#f5f0e8' }} formatter={(value) => money(Number(value))}/><Area type="monotone" dataKey="contributed" name="Invested" stroke="#ffcc00" strokeWidth={2.5} fill="url(#sipContributions)"/></AreaChart></ResponsiveContainer></div> : <EmptyChart>No recorded SIP contributions yet. Mark a payment paid to begin your history.</EmptyChart>}
      </article>
      <article className="ft-card ft-chart-card"><div className="ft-section-head"><div><h2>SIP-wise contributions</h2><p>Recorded total by active SIP</p></div></div>
        {sipBreakdown.some((row) => row.value > 0) ? <><div className="ft-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sipBreakdown.filter((row) => row.value > 0)} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="91%" paddingAngle={4} stroke="none">{sipBreakdown.filter((row) => row.value > 0).map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip contentStyle={{ background: '#1c1c20', border: '2px solid #414147', borderRadius: 0, color: '#f5f0e8' }} formatter={(value) => money(Number(value))}/></PieChart></ResponsiveContainer><div><b>{money(totalInvested)}</b><span>recorded invested</span></div></div><div className="ft-legend">{sipBreakdown.filter((row) => row.value > 0).map((row, index) => <div key={row.name}><span><i style={{ background: COLORS[index % COLORS.length] }}/>{row.name}</span><b>{money(row.value)}</b></div>)}</div></> : <EmptyChart>No recorded contributions to break down yet.</EmptyChart>}
      </article>
    </section>

    <section className="ft-grid-main ft-commitment-charts">
      <article className="ft-card ft-chart-card"><div className="ft-section-head"><div><h2>Upcoming payment timeline</h2><p>Next scheduled occurrence for each active commitment</p></div></div>
        {upcoming.length ? <div className="ft-timeline">{upcoming.slice(0, 8).map(({ item, days }) => <div className="ft-timeline-row" key={item.id}><span className={`ft-timeline-dot ${days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : ''}`}/><div><b>{item.name}</b><small>{dateLabel(item.next_due_date)} · {frequencyLabel(item.frequency)}</small></div><span className="ft-timeline-days">{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`}</span><strong>{money(Number(item.amount))}</strong></div>)}</div> : <EmptyChart>No upcoming payments. Add an SIP, policy or recurring commitment to see its schedule.</EmptyChart>}
      </article>
      <article className="ft-card ft-chart-card"><div className="ft-section-head"><div><h2>Monthly commitment mix</h2><p>Active obligations normalized to a month</p></div></div>
        {commitmentBreakdown.length ? <div className="ft-commitment-mix"><div className="ft-commitment-mix-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={commitmentBreakdown} layout="vertical" margin={{ left: 10, right: 16, top: 5, bottom: 5 }}><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={110} tick={{ fill: '#aeb4c1', fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: '#1c1c20', border: '2px solid #414147', borderRadius: 0, color: '#f5f0e8' }} formatter={(value) => money(Number(value))}/><Bar dataKey="value" name="Monthly commitment" fill="#ffcc00" radius={0} barSize={18}/></BarChart></ResponsiveContainer></div><div className="ft-commitment-total"><span>Monthly total</span><b>{money(commitmentBreakdown.reduce((sum, row) => sum + row.value, 0))}</b></div></div> : <EmptyChart>No active commitments to compare.</EmptyChart>}
      </article>
    </section>

    <section className="ft-card ft-commitment-list-card"><div className="ft-section-head"><div><h2>Your commitments</h2><p>SIPs, LIC and insurance policies, and recurring payments</p></div><SakugaButton className="ft-button ft-secondary ft-add-commitment-small" onClick={() => setEditing(null)}><FilePlus2 size={15}/> Add</SakugaButton></div>
      {commitments.length ? <div className="ft-commitment-list">{commitments.map((item) => <CommitmentCard key={item.id} item={item} paid={payments.filter((payment) => payment.commitment_id === item.id && payment.status === 'paid').length} onEdit={() => setEditing(item)} onPaid={() => void markPaid(item)} busy={busyId === item.id}/>)}</div> : <div className="ft-empty ft-commitment-empty"><div className="ft-empty-mark"><Landmark size={23}/></div><b>No commitments added</b><span>Your dashboard will fill in from records you enter here.</span><SakugaButton className="ft-button ft-primary" onClick={() => setEditing(null)}><Plus size={16}/> Add your first commitment</SakugaButton></div>}
    </section>

    <section className="ft-card ft-commitment-history"><div className="ft-section-head"><div><h2>SIP contribution &amp; payment history</h2><p>Only payments you manually recorded in Moneta</p></div></div>
      {payments.filter((payment) => payment.status === 'paid' && commitments.some((item) => item.id === payment.commitment_id)).length ? payments.filter((payment) => payment.status === 'paid' && commitments.some((item) => item.id === payment.commitment_id)).slice(0, 12).map((payment) => { const item = commitments.find((record) => record.id === payment.commitment_id); return <div className="ft-history-row" key={payment.id}><span className="ft-history-check"><Check size={13}/></span><div><b>{item?.name || 'Commitment payment'}</b><small>{item?.commitment_type === 'sip' ? 'SIP contribution' : item?.commitment_type === 'insurance' ? 'Insurance premium' : 'Recurring commitment'} · Recorded paid · {dateLabel(payment.due_date)}</small></div><strong>{money(Number(payment.amount))}</strong></div>; }) : <div className="ft-empty ft-history-empty">No commitment payments have been recorded yet.</div>}
    </section>
    {editing !== false && <CommitmentForm key={editing?.id || 'new'} initial={editing || undefined} userId={userId} methods={methods} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await onRefresh(); }}/ >}
  </div>;
}

function Kpi({ icon: Icon, label, value, detail, tone }: { icon: typeof Coins; label: string; value: string; detail: string; tone: string }) {
  return <article className="ft-card ft-kpi"><span className={`ft-kpi-icon ${tone}`}><Icon size={18}/></span><div><span className="ft-muted">{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function EmptyChart({ children }: { children: React.ReactNode }) { return <div className="ft-empty-chart">{children}</div>; }

function CommitmentCard({ item, paid, onEdit, onPaid, busy }: { item: FinanceCommitment; paid: number; onEdit: () => void; onPaid: () => void; busy: boolean }) {
  const days = dueDays(item.next_due_date);
  const kindLabel = item.commitment_type === 'sip' ? 'SIP' : item.commitment_type === 'insurance' ? 'INSURANCE' : 'RECURRING';
  const dueState = item.status !== 'active' ? item.status : days < 0 ? 'overdue' : days === 0 ? 'due today' : days <= 3 ? 'due soon' : 'upcoming';
  return <article className="ft-commitment-row"><div className={`ft-commitment-type-mark ${item.commitment_type}`}>{item.commitment_type === 'insurance' ? <ShieldCheck size={18}/> : item.commitment_type === 'sip' ? <Activity size={18}/> : <CalendarClock size={18}/>}</div><div className="ft-commitment-info"><div className="ft-commitment-title"><span className="ft-commitment-tag">{kindLabel}</span><b>{item.name}</b><span className={`ft-status-pill ${dueState.replace(' ', '-')}`}>{dueState}</span></div><p>{[item.product_name, item.provider, item.policy_type, item.folio_number && `Folio ${item.folio_number}`, item.policy_number && `Policy ${item.policy_number}`].filter(Boolean).join(' · ') || 'Commitment details'}</p><small>{frequencyLabel(item.frequency)} · Next {dateLabel(item.next_due_date)} · {paid} recorded {item.commitment_type === 'sip' ? 'contributions' : 'payments'}</small></div><div className="ft-commitment-amount"><strong>{money(Number(item.amount))}</strong><small>{frequencyLabel(item.frequency)}</small></div><div className="ft-commitment-actions"><button type="button" className="ft-icon-button" onClick={onEdit} aria-label={`Edit ${item.name}`}><Pencil size={15}/></button>{item.status === 'active' && <SakugaButton type="button" className="ft-button ft-mark-paid" onClick={onPaid} disabled={busy}>{busy ? 'Saving…' : <><Check size={14}/> Mark paid</>}</SakugaButton>}</div></article>;
}

function CommitmentForm({ initial, userId, methods, onClose, onSaved }: { initial?: FinanceCommitment; userId: string; methods: PaymentMethod[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<CommitmentType>(initial?.commitment_type || 'sip');
  const [name, setName] = useState(initial?.name || '');
  const [productName, setProductName] = useState(initial?.product_name || '');
  const [provider, setProvider] = useState(initial?.provider || '');
  const [policyNumber, setPolicyNumber] = useState(initial?.policy_number || '');
  const [policyType, setPolicyType] = useState(initial?.policy_type || '');
  const [folio, setFolio] = useState(initial?.folio_number || '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [frequency, setFrequency] = useState<CommitmentFrequency>(initial?.frequency || 'monthly');
  const [start, setStart] = useState(initial?.start_date || today());
  const [nextDue, setNextDue] = useState(initial?.next_due_date || today());
  const [maturity, setMaturity] = useState(initial?.maturity_date || '');
  const [sumAssured, setSumAssured] = useState(initial?.sum_assured ? String(initial.sum_assured) : '');
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.payment_method_id || methods[0]?.id || '');
  const [status, setStatus] = useState<FinanceCommitment['status']>(initial?.status || 'active');
  const [reminders, setReminders] = useState<number[]>(initial?.reminder_days || [7, 3, 1, 0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validateDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const numericAmount = Number(amount), numericSumAssured = sumAssured ? Number(sumAssured) : null;
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 9999999999) { setError('Enter an amount greater than zero.'); return; }
    if (!name.trim() || name.trim().length > 120) { setError('Enter a name with up to 120 characters.'); return; }
    if (!validateDate(start) || !validateDate(nextDue) || nextDue < start) { setError('Choose valid dates. The next payment must be on or after the start date.'); return; }
    if (maturity && (!validateDate(maturity) || maturity < start)) { setError('Maturity date must be valid and on or after the start date.'); return; }
    if (numericSumAssured !== null && (!Number.isFinite(numericSumAssured) || numericSumAssured <= 0)) { setError('Sum assured must be greater than zero.'); return; }
    setBusy(true);
    const value: CommitmentInput = {
      commitment_type: type, name: name.trim(), provider: provider.trim(), product_name: productName.trim(),
      policy_number: policyNumber.trim(), policy_type: policyType.trim(), folio_number: folio.trim(),
      amount: numericAmount, frequency, schedule_anchor_day: Number(nextDue.slice(8, 10)), start_date: start, next_due_date: nextDue,
      maturity_date: maturity || null, sum_assured: numericSumAssured,
      payment_method_id: paymentMethodId || null, status, reminder_days: reminders,
    };
    try { await saveCommitment(userId, value, initial?.id); await onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this commitment.'); }
    finally { setBusy(false); }
  };
  return <div className="ft-modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><form className="ft-modal ft-commitment-modal" onSubmit={(event) => void submit(event)}>
    <div className="ft-modal-head"><div><span className="ft-eyebrow">{initial ? 'UPDATE PLAN' : 'NEW FINANCIAL PLAN'}</span><h2>{initial ? 'Edit commitment' : 'Add a commitment'}</h2></div><button type="button" className="ft-icon-button" onClick={onClose} aria-label="Close"><X size={19}/></button></div>
    <div className="ft-commitment-kind-switch">{(['sip', 'insurance', 'recurring'] as const).map((value) => <button type="button" className={type === value ? 'selected' : ''} key={value} onClick={() => { setType(value); setFrequency((current) => value === 'sip' && current === 'yearly' || value === 'insurance' && current === 'weekly' ? 'monthly' : current); }}>{value === 'sip' ? 'SIP' : value === 'insurance' ? 'Insurance' : 'Recurring'}</button>)}</div>
    <div className="ft-commitment-form-grid">
      <label className="ft-field"><span>{type === 'insurance' ? 'POLICY NAME' : type === 'sip' ? 'INVESTMENT NAME' : 'PAYMENT NAME'}</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'insurance' ? 'e.g. LIC Jeevan Anand' : type === 'sip' ? 'e.g. Retirement SIP' : 'e.g. Rent or tuition'}/></label>
      {type === 'sip' && <label className="ft-field"><span>MUTUAL FUND</span><input maxLength={160} value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Fund name"/></label>}
      <label className="ft-field"><span>{type === 'insurance' ? 'INSURANCE PROVIDER' : type === 'sip' ? 'AMC / PROVIDER' : 'PAYEE / PROVIDER'}</span><input maxLength={120} value={provider} onChange={(event) => setProvider(event.target.value)} placeholder={type === 'insurance' ? 'LIC or insurer' : 'Provider name'}/></label>
      {type === 'insurance' && <><label className="ft-field"><span>POLICY TYPE</span><input maxLength={100} value={policyType} onChange={(event) => setPolicyType(event.target.value)} placeholder="Life, health, vehicle…"/></label><label className="ft-field"><span>POLICY NUMBER <em>OPTIONAL</em></span><input maxLength={100} value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)}/></label><label className="ft-field"><span>SUM ASSURED <em>OPTIONAL</em></span><input type="number" min="0.01" step="0.01" value={sumAssured} onChange={(event) => setSumAssured(event.target.value)}/></label><label className="ft-field"><span>MATURITY DATE <em>OPTIONAL</em></span><input type="date" value={maturity} onChange={(event) => setMaturity(event.target.value)}/></label></>}
      {type === 'sip' && <label className="ft-field"><span>FOLIO NUMBER <em>OPTIONAL</em></span><input maxLength={100} value={folio} onChange={(event) => setFolio(event.target.value)}/></label>}
      <label className="ft-field"><span>{type === 'insurance' ? 'PREMIUM AMOUNT' : type === 'sip' ? 'CONTRIBUTION AMOUNT' : 'PAYMENT AMOUNT'}</span><input required type="number" min="0.01" max="9999999999" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₹ Amount"/></label>
      <label className="ft-field"><span>{type === 'insurance' ? 'PREMIUM FREQUENCY' : 'FREQUENCY'}</span><select value={frequency} onChange={(event) => setFrequency(event.target.value as CommitmentFrequency)}>{(type === 'sip' ? ['weekly', 'monthly', 'quarterly'] as const : type === 'insurance' ? ['monthly', 'quarterly', 'yearly'] as const : ['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((value) => <option key={value} value={value}>{frequencyLabel(value)}</option>)}</select></label>
      <label className="ft-field"><span>START DATE</span><input required type="date" value={start} onChange={(event) => setStart(event.target.value)}/></label>
      <label className="ft-field"><span>NEXT {type === 'insurance' ? 'PREMIUM' : 'PAYMENT'} DATE</span><input required type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)}/></label>
      <label className="ft-field"><span>PAYMENT METHOD</span><select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}><option value="">Choose later</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
      {initial && <label className="ft-field"><span>STATUS</span><select value={status} onChange={(event) => setStatus(event.target.value as FinanceCommitment['status'])}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>}
    </div>
    <fieldset className="ft-reminder-options"><legend>IN-APP REMINDERS</legend>{[7, 3, 1, 0].map((day) => <label key={day}><input type="checkbox" checked={reminders.includes(day)} onChange={() => setReminders((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => b - a))}/>{day === 0 ? 'Due date' : `${day} days before`}</label>)}</fieldset>
    {error && <div className="ft-form-error"><CircleAlert size={15}/>{error}</div>}
    <div className="ft-modal-actions"><SakugaButton type="button" className="ft-button ft-secondary" onClick={onClose} disabled={busy}>Cancel</SakugaButton><SakugaButton type="submit" className="ft-button ft-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add commitment'}</SakugaButton></div>
  </form></div>;
}
