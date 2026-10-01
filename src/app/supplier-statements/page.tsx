'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { Download, FileText, Printer, RefreshCw, Search } from 'lucide-react';

type Supplier = { id: string; name: string; company: string | null };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; total: number | string; status: string };
type Payment = { id: string; supplier_id: string; purchase_id: string | null; payment_date: string; amount: number | string; payment_mode: string; reference_number: string | null; notes: string | null; is_advance: boolean };
type Entry = { date: string; kind: 'Purchase' | 'Payment' | 'Advance'; reference: string; description: string; debit: number; credit: number; balance: number };
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const csvCell = (value: unknown) => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default function SupplierStatementsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const db = createClient();
    const [s, p, h] = await Promise.all([
      db.from('suppliers').select('id,name,company').order('name'),
      db.from('purchases').select('id,purchase_number,supplier_id,purchase_date,total,status').neq('status', 'CANCELLED').order('purchase_date'),
      db.from('supplier_payments').select('id,supplier_id,purchase_id,payment_date,amount,payment_mode,reference_number,notes,is_advance').order('payment_date'),
    ]);
    const issue = s.error || p.error || h.error;
    if (issue) setError(issue.message);
    setSuppliers((s.data || []) as Supplier[]);
    setPurchases((p.data || []) as Purchase[]);
    setPayments((h.data || []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const entries = useMemo<Entry[]>(() => {
    if (!supplierId) return [];
    const charges: Entry[] = purchases.filter((purchase) => purchase.supplier_id === supplierId).map((purchase) => ({
      date: purchase.purchase_date, kind: 'Purchase', reference: 'Purchase #' + purchase.purchase_number,
      description: 'Purchase order', debit: Math.max(0, Number(purchase.total || 0)), credit: 0, balance: 0,
    }));
    const credits: Entry[] = payments.filter((payment) => payment.supplier_id === supplierId).map((payment) => ({
      date: payment.payment_date, kind: payment.is_advance ? 'Advance' : 'Payment',
      reference: payment.reference_number || (payment.purchase_id ? 'Linked purchase payment' : 'Supplier payment'),
      description: [payment.payment_mode, payment.notes].filter(Boolean).join(' · ') || (payment.is_advance ? 'Advance / supplier credit' : 'Payment recorded'),
      debit: 0, credit: Math.max(0, Number(payment.amount || 0)), balance: 0,
    }));
    const all = [...charges, ...credits].sort((a, b) => a.date.localeCompare(b.date) || (a.kind !== b.kind ? (a.kind === 'Purchase' ? -1 : 1) : a.reference.localeCompare(b.reference)));
    let running = 0;
    return all.map((entry) => {
      running += entry.debit - entry.credit;
      return { ...entry, balance: running };
    });
  }, [supplierId, purchases, payments]);

  const opening = useMemo(() => entries.filter((entry) => from && entry.date < from).reduce((sum, entry) => sum + entry.debit - entry.credit, 0), [entries, from]);
  const periodEntries = useMemo(() => entries.filter((entry) => (!from || entry.date >= from) && (!to || entry.date <= to)), [entries, from, to]);
  const visibleSuppliers = suppliers.filter((supplier) => [supplier.name, supplier.company || ''].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const totals = useMemo(() => ({
    purchases: periodEntries.reduce((sum, entry) => sum + entry.debit, 0),
    payments: periodEntries.reduce((sum, entry) => sum + entry.credit, 0),
    closing: opening + periodEntries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0),
  }), [periodEntries, opening]);

  const exportCsv = () => {
    const rows = [
      ['Supplier', selectedSupplier?.name || '', 'From', from || 'All time', 'To', to || 'All time'],
      ['Date', 'Type', 'Reference', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running balance (₹)'],
      ['Opening balance', '', '', '', '', '', opening],
      ...periodEntries.map((entry) => [entry.date, entry.kind, entry.reference, entry.description, entry.debit, entry.credit, entry.balance]),
      ['Period totals', '', '', '', totals.purchases, totals.payments, totals.closing],
    ];
    const blob = new Blob(['\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'guru-kalyanam-supplier-statement.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="app-root min-h-screen flex bg-slate-50"><AppNav /><main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800"><FileText size={14}/> PROCUREMENT FINANCE</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Supplier account statements</h1><p className="mt-1 text-sm text-slate-500">Track purchase charges, payments, advances, and payable movement by supplier.</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Refresh</button><button onClick={() => window.print()} disabled={!supplierId || loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Printer size={16}/>Print</button><button onClick={exportCsv} disabled={!supplierId || loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download size={16}/>Export CSV</button></div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not load supplier statement data: {error}</div>}
    <section className="card grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px] md:p-5">
      <label className="text-sm font-medium text-slate-700">Find supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"><option value="">Select a supplier…</option>{visibleSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.company ? ' · ' + supplier.company : ''}</option>)}</select><span className="relative mt-2 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplier names" className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"/></span></label>
      <label className="text-sm font-medium text-slate-700">From date<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label>
      <label className="text-sm font-medium text-slate-700">To date<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label>
    </section>
    {!supplierId ? <section className="card p-12 text-center"><FileText size={28} className="mx-auto mb-3 text-slate-400"/><h2 className="font-semibold">Choose a supplier to view its statement</h2><p className="mt-1 text-sm text-slate-500">The statement includes purchase orders and recorded supplier payments for the selected period.</p></section> : <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[{label:'Purchase charges',value:money(totals.purchases),tone:'text-slate-950'},{label:'Payments & advances',value:money(totals.payments),tone:'text-emerald-700'},{label:'Closing balance',value:money(totals.closing),tone:totals.closing > 0 ? 'text-amber-700' : 'text-emerald-700'}].map((item) => <article key={item.label} className="card p-4"><p className="text-sm text-slate-500">{item.label}</p><p className={'mt-2 text-xl font-bold '+item.tone}>{item.value}</p></article>)}
      </section>
      <section className="card p-4 md:p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h2 className="text-lg font-bold">{selectedSupplier?.name || 'Supplier statement'}</h2><p className="text-sm text-slate-500">Period: {from || 'All time'} to {to || 'All time'}</p></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">Opening balance</span><p className="font-bold">{money(opening)}</p></div></div>
        {loading ? <p className="py-10 text-center text-slate-500">Loading statement…</p> : periodEntries.length === 0 ? <p className="py-10 text-center text-slate-500">No purchases or payments in this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-3 pr-3">Date</th><th className="px-3 py-3">Type / reference</th><th className="px-3 py-3">Description</th><th className="px-3 py-3 text-right">Debit</th><th className="px-3 py-3 text-right">Credit</th><th className="py-3 pl-3 text-right">Balance</th></tr></thead><tbody>{periodEntries.map((entry, index) => <tr key={entry.kind + entry.date + entry.reference + index} className="border-b last:border-0"><td className="py-3 pr-3 whitespace-nowrap">{entry.date}</td><td className="px-3 py-3"><span className="font-semibold">{entry.kind}</span><div className="text-xs text-slate-500">{entry.reference}</div></td><td className="px-3 py-3">{entry.description}</td><td className="px-3 py-3 text-right tabular-nums">{entry.debit ? money(entry.debit) : '—'}</td><td className="px-3 py-3 text-right tabular-nums text-emerald-700">{entry.credit ? money(entry.credit) : '—'}</td><td className="py-3 pl-3 text-right font-semibold tabular-nums">{money(entry.balance)}</td></tr>)}</tbody><tfoot><tr className="border-t-2"><td colSpan={3} className="py-3 font-bold">Period totals</td><td className="px-3 py-3 text-right font-bold">{money(totals.purchases)}</td><td className="px-3 py-3 text-right font-bold text-emerald-700">{money(totals.payments)}</td><td className="py-3 pl-3 text-right font-bold">{money(totals.closing)}</td></tr></tfoot></table></div>}
      </section>
      <p className="text-xs leading-5 text-slate-400">This statement is based on purchase totals and recorded supplier payment entries. It does not infer payment dates from purchase paid_amount fields; the ledger reflects recorded entries available in the system.</p>
    </>}
    <style jsx global>{'@media print { .app-desktop-nav, .app-mobile-nav, .mobile-bottom-nav, button, section:first-of-type { display: none !important; } body, .app-root { background: white !important; } .app-main { padding: 0 !important; max-width: none !important; } .card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; } }'}</style>
  </main></div>;
}
