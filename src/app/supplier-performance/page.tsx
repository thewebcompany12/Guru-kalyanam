'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { Download, RefreshCw, Search, TrendingUp, PackageCheck, WalletCards, ClipboardList } from 'lucide-react';

type Supplier = { id: string; name: string; company: string | null };
type PurchaseItem = { quantity: number | string; received_quantity: number | string };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; total: number | string; status: string; purchase_items?: PurchaseItem[] };
type Payment = { supplier_id: string; payment_date: string; amount: number | string; is_advance: boolean };
type Summary = { supplier: Supplier; orders: number; spend: number; received: number; ordered: number; payments: number; openOrders: number; openValue: number; payable: number };
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const csvCell = (value: unknown) => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default function SupplierPerformancePage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const db = createClient();
    const [s, p, h] = await Promise.all([
      db.from('suppliers').select('id,name,company').order('name'),
      db.from('purchases').select('id,purchase_number,supplier_id,purchase_date,total,status,purchase_items(quantity,received_quantity)').neq('status', 'CANCELLED').order('purchase_date'),
      db.from('supplier_payments').select('supplier_id,payment_date,amount,is_advance').order('payment_date'),
    ]);
    const issue = s.error || p.error || h.error;
    if (issue) setError(issue.message);
    setSuppliers((s.data || []) as Supplier[]);
    setPurchases((p.data || []) as unknown as Purchase[]);
    setPayments((h.data || []) as Payment[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const summaries = useMemo(() => suppliers.map((supplier): Summary => {
    const supplierPurchases = purchases.filter(p => p.supplier_id === supplier.id && (!from || p.purchase_date >= from) && (!to || p.purchase_date <= to));
    const supplierPayments = payments.filter(p => p.supplier_id === supplier.id && (!from || p.payment_date >= from) && (!to || p.payment_date <= to));
    const orders = supplierPurchases.length;
    const spend = supplierPurchases.reduce((sum, p) => sum + Math.max(0, Number(p.total) || 0), 0);
    const ordered = supplierPurchases.reduce((sum, p) => sum + (p.purchase_items || []).reduce((s, i) => s + Math.max(0, Number(i.quantity) || 0), 0), 0);
    const received = supplierPurchases.reduce((sum, p) => sum + (p.purchase_items || []).reduce((s, i) => s + Math.min(Math.max(0, Number(i.received_quantity) || 0), Math.max(0, Number(i.quantity) || 0)), 0), 0);
    const open = supplierPurchases.filter(p => ['ORDERED', 'PARTIALLY_RECEIVED', 'PARTIAL'].includes(p.status));
    const openOrders = open.length;
    const openValue = open.reduce((sum, p) => sum + Math.max(0, Number(p.total) || 0), 0);
    const paymentsTotal = supplierPayments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
    return { supplier, orders, spend, received, ordered, payments: paymentsTotal, openOrders, openValue, payable: spend - paymentsTotal };
  }), [suppliers, purchases, payments, from, to]);

  const visible = useMemo(() => summaries.filter(s => [s.supplier.name, s.supplier.company || ''].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => b.spend - a.spend), [summaries, search]);
  const totals = useMemo(() => visible.reduce((a, s) => ({ suppliers: a.suppliers + (s.orders > 0 ? 1 : 0), orders: a.orders + s.orders, spend: a.spend + s.spend, received: a.received + s.received, ordered: a.ordered + s.ordered, payments: a.payments + s.payments, openOrders: a.openOrders + s.openOrders, openValue: a.openValue + s.openValue, payable: a.payable + s.payable }), { suppliers: 0, orders: 0, spend: 0, received: 0, ordered: 0, payments: 0, openOrders: 0, openValue: 0, payable: 0 }), [visible]);

  const exportCsv = () => {
    const rows = [['Supplier', 'Company', 'Purchase orders', 'Purchase total (₹)', 'Recorded payments (₹)', 'Net period movement (₹)', 'Open orders', 'Open order value (₹)', 'Units ordered', 'Units received'], ...visible.map(s => [s.supplier.name, s.supplier.company || '', s.orders, s.spend, s.payments, s.payable, s.openOrders, s.openValue, s.ordered, s.received])];
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'guru-kalyanam-supplier-performance.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="app-root min-h-screen flex bg-slate-50"><AppNav /><main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><TrendingUp size={14}/> PROCUREMENT INSIGHTS</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Supplier performance</h1><p className="mt-1 text-sm text-slate-500">Compare purchase activity, receipts, open orders, and recorded payments.</p></div><div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Refresh</button><button onClick={exportCsv} disabled={loading || visible.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download size={16}/>Export CSV</button></div></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not load supplier data: {error}</div>}
    <section className="card grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="text-sm font-medium text-slate-700">Search suppliers<span className="relative mt-1 block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or company" className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-3"/></span></label><label className="text-sm font-medium text-slate-700">From date<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label><label className="text-sm font-medium text-slate-700">To date<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label></section>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Purchase value',value:money(totals.spend),detail:totals.orders+' purchase orders',Icon:ClipboardList},{label:'Recorded payments',value:money(totals.payments),detail:'Payments logged in period',Icon:WalletCards},{label:'Open purchase orders',value:String(totals.openOrders),detail:money(totals.openValue)+' open order value',Icon:PackageCheck},{label:'Units received',value:totals.received.toLocaleString('en-IN'),detail:'of '+totals.ordered.toLocaleString('en-IN')+' units ordered',Icon:TrendingUp}].map(item => <article key={item.label} className="card p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{item.label}</p><item.Icon size={18} className="text-slate-400"/></div><p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></article>)}</section>
    <section className="card overflow-hidden"><div className="border-b p-4"><h2 className="font-bold text-slate-950">Supplier comparison</h2><p className="mt-1 text-sm text-slate-500">Period: {from || 'All time'} to {to || 'All time'} · {visible.length} suppliers shown</p></div>{loading ? <p className="py-12 text-center text-slate-500">Loading supplier performance…</p> : visible.length === 0 ? <p className="py-12 text-center text-slate-500">No suppliers match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-3">Supplier</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Purchase value</th><th className="p-3 text-right">Payments recorded</th><th className="p-3 text-right">Period movement*</th><th className="p-3 text-right">Open orders</th><th className="p-3 text-right">Units received</th></tr></thead><tbody>{visible.map(s => <tr key={s.supplier.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-3"><div className="font-semibold">{s.supplier.name}</div>{s.supplier.company && <div className="text-xs text-slate-500">{s.supplier.company}</div>}</td><td className="p-3 text-right tabular-nums">{s.orders}</td><td className="p-3 text-right tabular-nums">{money(s.spend)}</td><td className="p-3 text-right tabular-nums text-emerald-700">{money(s.payments)}</td><td className={'p-3 text-right font-semibold tabular-nums '+(s.payable > 0 ? 'text-amber-700' : 'text-emerald-700')}>{money(s.payable)}</td><td className="p-3 text-right tabular-nums">{s.openOrders}<div className="text-xs text-slate-500">{money(s.openValue)}</div></td><td className="p-3 text-right tabular-nums">{s.received.toLocaleString('en-IN')} / {s.ordered.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>}</section>
    <p className="text-xs leading-5 text-slate-400">* Period movement is purchase totals minus recorded supplier payments in the selected dates, not a full historical payable balance or accounting statement. Open order value uses full totals for open orders. Units received are summed across purchase lines; different units are not converted. Cancelled purchase orders are excluded.</p>
  </main></div>;
}
