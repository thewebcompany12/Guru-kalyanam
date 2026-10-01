'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, CreditCard, RefreshCw, Search, WalletCards } from 'lucide-react';

type Supplier = { id: string; name: string; company: string | null; outstanding_amount: number; advance_balance: number };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; total: number; paid_amount: number; status: string };
type Payment = {
  id: string; supplier_id: string; purchase_id: string | null; payment_date: string; amount: number;
  payment_mode: string; reference_number: string | null; notes: string | null; is_advance: boolean; created_at: string;
  suppliers?: { name: string } | { name: string }[] | null;
  purchases?: { purchase_number: number } | { purchase_number: number }[] | null;
};
const money = (value: number) => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const modes = [{ value: 'UPI', label: 'UPI' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CASH', label: 'Cash' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'OTHER', label: 'Other' }];
const joinedName = (value: Payment['suppliers']) => Array.isArray(value) ? value[0]?.name || 'Supplier' : value?.name || 'Supplier';
const purchaseNo = (value: Payment['purchases']) => Array.isArray(value) ? value[0]?.purchase_number : value?.purchase_number;

export default function SupplierPaymentsPage() {
  const db = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isAdvance, setIsAdvance] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [s, p, h] = await Promise.all([
      db.from('suppliers').select('id,name,company,outstanding_amount,advance_balance').order('name'),
      db.from('purchases').select('id,purchase_number,supplier_id,purchase_date,total,paid_amount,status').order('created_at', { ascending: false }),
      db.from('supplier_payments').select('id,supplier_id,purchase_id,payment_date,amount,payment_mode,reference_number,notes,is_advance,created_at,suppliers(name),purchases(purchase_number)').order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(300),
    ]);
    if (s.error) setError(s.error.message); else setSuppliers((s.data || []) as Supplier[]);
    if (p.error) setError(p.error.message); else setPurchases((p.data || []) as Purchase[]);
    if (h.error) setError(h.error.message); else setPayments((h.data || []) as unknown as Payment[]);
    setLoading(false);
  }, [db]);

  useEffect(() => { void load(); }, [load]);

  const supplier = suppliers.find(s => s.id === supplierId);
  const availablePurchases = purchases.filter(p => p.supplier_id === supplierId && p.status !== 'CANCELLED' && Number(p.total) > Number(p.paid_amount));
  const selectedPurchase = availablePurchases.find(p => p.id === purchaseId);
  const due = selectedPurchase ? Math.max(0, Number(selectedPurchase.total) - Number(selectedPurchase.paid_amount)) : 0;
  const totalOutstanding = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.outstanding_amount || 0)), 0);
  const totalAdvances = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.advance_balance || 0)), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const visiblePayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter(p => !q || [joinedName(p.suppliers), String(purchaseNo(p.purchases) || ''), p.payment_mode, p.reference_number || '', p.notes || ''].join(' ').toLowerCase().includes(q));
  }, [payments, search]);

  const changeSupplier = (id: string) => { setSupplierId(id); setPurchaseId(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const value = Number(amount);
    if (!supplierId) { setError('Select a supplier.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a payment amount greater than zero.'); return; }
    if (!purchaseId && !isAdvance) { setError('Select a purchase order, or mark this as an advance payment.'); return; }
    if (purchaseId && !isAdvance && value > due) { setError('This amount exceeds the purchase order balance. Mark it as an advance only if you intend to record the excess as supplier credit.'); return; }
    setSaving(true);
    const requestKey = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(requestKey);
    const result = await db.rpc('record_supplier_payment', {
      p_supplier_id: supplierId,
      p_purchase_id: purchaseId || null,
      p_payment_date: date,
      p_amount: Math.round(value * 100) / 100,
      p_payment_mode: mode,
      p_reference_number: reference.trim() || null,
      p_notes: notes.trim() || null,
      p_is_advance: isAdvance,
      p_idempotency_key: requestKey,
    });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setNotice('Supplier payment recorded successfully.');
    setIdempotencyKey('');
    setAmount(''); setReference(''); setNotes(''); setPurchaseId(''); setIsAdvance(false);
    await load();
  };

  return <div className="min-h-screen flex bg-slate-50"><AppNav /><main className="flex-1 min-w-0 p-4 md:p-8"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"><WalletCards size={16} /> Phase 37 · Procurement finance</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Supplier payments</h1><p className="mt-2 text-sm text-slate-500">Record payments separately from school collections, track purchase balances and retain payment references.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button></header>
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={'flex items-start gap-2 rounded-xl border p-3 text-sm ' + (error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}<span className="flex-1">{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }} className="font-semibold">Dismiss</button></div>}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Supplier outstanding</p><p className="mt-2 text-2xl font-extrabold">{loading ? '—' : money(totalOutstanding)}</p><p className="mt-1 text-xs text-slate-500">Balance recorded on supplier accounts</p></div><div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Advance / credit balance</p><p className="mt-2 text-2xl font-extrabold">{loading ? '—' : money(totalAdvances)}</p><p className="mt-1 text-xs text-slate-500">Excess amounts recorded as supplier credit</p></div><div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Payments in loaded history</p><p className="mt-2 text-2xl font-extrabold">{loading ? '—' : money(totalPaid)}</p><p className="mt-1 text-xs text-slate-500">{payments.length} latest records</p></div></section>
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm md:p-6">
      <div><h2 className="text-lg font-bold">Record supplier payment</h2><p className="mt-1 text-sm text-slate-500">Payments against an order update its paid total. Excess payments require the advance option and are tracked as supplier credit.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Supplier *<select required value={supplierId} onChange={e => changeSupplier(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5"><option value="">Choose supplier…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ' · ' + s.company : ''}</option>)}</select></label>
        <label className="text-sm font-medium">Purchase order {isAdvance ? '(optional for advance)' : '*' }<select required={!isAdvance} value={purchaseId} onChange={e => setPurchaseId(e.target.value)} disabled={!supplierId} className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 disabled:bg-slate-100"><option value="">Unallocated advance…</option>{availablePurchases.map(p => <option key={p.id} value={p.id}>PO #{p.purchase_number} · due {money(Number(p.total) - Number(p.paid_amount))}</option>)}</select></label>
        <label className="text-sm font-medium">Payment date *<input required type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5" /></label>
        <label className="text-sm font-medium">Amount (₹) *<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5" placeholder="0.00" /></label>
        <label className="text-sm font-medium">Payment mode *<select value={mode} onChange={e => setMode(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white px-3 py-2.5">{modes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
        <label className="text-sm font-medium">Reference number<input maxLength={160} value={reference} onChange={e => setReference(e.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5" placeholder="UPI / bank / cheque reference" /></label>
      </div>
      {selectedPurchase && <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">PO #{selectedPurchase.purchase_number} balance: <b>{money(due)}</b>{isAdvance && Number(amount) > due && Number(amount) > 0 ? <span> · Excess {money(Number(amount) - due)} will be recorded as supplier credit.</span> : null}</div>}
      {supplier && <p className="text-xs text-slate-500">Current supplier balance: {money(Number(supplier.outstanding_amount || 0))} outstanding · {money(Number(supplier.advance_balance || 0))} in advances</p>}
      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={isAdvance} onChange={e => { setIsAdvance(e.target.checked); if (e.target.checked) setPurchaseId(''); }} className="mt-0.5 h-4 w-4 rounded" /><span><b>Record as advance / allow excess payment</b><span className="mt-1 block text-slate-500">Use only for money paid ahead of an order or an intentional overpayment. Excess is tracked in the supplier credit balance.</span></span></label>
      <label className="block text-sm font-medium">Notes<textarea maxLength={1000} rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 block w-full rounded-xl border px-3 py-2.5 font-normal" placeholder="Optional payment details" /></label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Customer collections in the Payments section remain separate.</p><button disabled={saving || loading || !suppliers.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><CreditCard size={17} />{saving ? 'Recording…' : 'Record payment'}</button></div>
    </form>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">Payment history</h2><p className="text-sm text-slate-500">Most recent 300 records, newest first.</p></div><label className="relative block w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" placeholder="Search supplier, PO, mode…" /></label></div>
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading supplier ledger…</div> : visiblePayments.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No supplier payments match this search.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date / supplier</th><th className="px-4 py-3">Purchase / type</th><th className="px-4 py-3">Mode / reference</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y">{visiblePayments.map(p => <tr key={p.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><div className="font-semibold text-slate-900">{joinedName(p.suppliers)}</div><div className="mt-1 text-xs text-slate-500">{p.payment_date}</div></td><td className="px-4 py-3"><div>{purchaseNo(p.purchases) ? 'PO #' + purchaseNo(p.purchases) : 'Unallocated advance'}</div>{p.is_advance && <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Advance / excess</span>}</td><td className="px-4 py-3"><div>{modes.find(m => m.value === p.payment_mode)?.label || p.payment_mode}</div><div className="mt-1 text-xs text-slate-500">{p.reference_number || p.notes || '—'}</div></td><td className="px-4 py-3 text-right font-bold tabular-nums">{money(Number(p.amount))}</td></tr>)}</tbody></table></div>}
    </section>
  </div></main></div>;
}
