'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { BarChart3, Download, IndianRupee, Package, RefreshCw, Search, TrendingUp, Truck } from 'lucide-react';

type PurchaseItem = { id: string; product_name: string; quantity: number; unit: string; unit_cost: number; line_total: number };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; status: string; total: number; suppliers?: { name: string } | { name: string }[] | null; purchase_items?: PurchaseItem[] };
const money = (v: number) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const supplier = (p: Purchase) => Array.isArray(p.suppliers) ? p.suppliers[0]?.name || 'Supplier' : p.suppliers?.name || 'Supplier';
const monthLabel = (v: string) => new Date(v + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

export default function ProcurementCostInsightsPage() {
  const db = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await db.from('purchases')
      .select('id,purchase_number,supplier_id,purchase_date,status,total,suppliers(name),purchase_items(id,product_name,quantity,unit,unit_cost,line_total)')
      .order('purchase_date', { ascending: false }).limit(2000);
    if (loadError) setError(loadError.message);
    else setRows((data || []) as unknown as Purchase[]);
    setLoading(false);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter(p => {
    const hay = [p.purchase_number, supplier(p), p.status, ...(p.purchase_items || []).map(i => i.product_name)].join(' ').toLowerCase();
    return (!query || hay.includes(query.toLowerCase())) && (!from || p.purchase_date >= from) && (!to || p.purchase_date <= to);
  }), [rows, query, from, to]);
  const metrics = useMemo(() => {
    const spend = filtered.reduce((s, p) => s + Number(p.total || 0), 0);
    const itemRows = filtered.flatMap(p => (p.purchase_items || []).map(i => ({ ...i, purchase_date: p.purchase_date, supplier: supplier(p), purchase_number: p.purchase_number })));
    const qty = itemRows.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const productTotals = new Map<string, { spend: number; qty: number; unit: string; count: number }>();
    const supplierTotals = new Map<string, { spend: number; count: number }>();
    const monthly = new Map<string, number>();
    for (const p of filtered) {
      const m = p.purchase_date?.slice(0, 7);
      if (m) monthly.set(m, (monthly.get(m) || 0) + Number(p.total || 0));
      const name = supplier(p);
      const sv = supplierTotals.get(name) || { spend: 0, count: 0 };
      sv.spend += Number(p.total || 0); sv.count += 1; supplierTotals.set(name, sv);
    }
    for (const i of itemRows) {
      const name = i.product_name || 'Unnamed item';
      const v = productTotals.get(name) || { spend: 0, qty: 0, unit: i.unit || '', count: 0 };
      v.spend += Number(i.line_total || (Number(i.quantity || 0) * Number(i.unit_cost || 0)));
      v.qty += Number(i.quantity || 0); v.count += 1; productTotals.set(name, v);
    }
    return {
      spend, qty, orderCount: filtered.length,
      average: filtered.length ? spend / filtered.length : 0,
      monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8),
      suppliers: [...supplierTotals.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 8),
      products: [...productTotals.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 10),
      itemRows
    };
  }, [filtered]);
  const exportCsv = () => {
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [['Purchase #','Date','Supplier','Status','Product','Quantity','Unit','Unit cost','Line total'], ...metrics.itemRows.map(i => [i.purchase_number,i.purchase_date,i.supplier,'',i.product_name,i.quantity,i.unit,i.unit_cost,i.line_total || Number(i.quantity || 0) * Number(i.unit_cost || 0)])];
    const blob = new Blob([lines.map(row => row.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'procurement-cost-insights.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const maxMonthly = Math.max(1, ...metrics.monthly.map(([, v]) => v));
  const maxSupplier = Math.max(1, ...metrics.suppliers.map(v => v.spend));
  const maxProduct = Math.max(1, ...metrics.products.map(v => v.spend));

  return <div className="min-h-screen bg-slate-50 text-slate-900"><AppNav/><main className="mx-auto max-w-7xl px-4 py-5 pb-24 md:px-8 md:py-8 md:pl-[290px]">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">Procurement · Phase 52</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Procurement cost insights</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Understand purchasing spend over time, compare supplier totals, and see which products account for the most procurement cost.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-slate-100"><RefreshCw size={16}/> Refresh</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"><Download size={16}/> Export CSV</button></div></div>
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="relative block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search supplier, purchase #, product…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label><input aria-label="Purchase date from" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input aria-label="Purchase date to" type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></div></div>
    {error&&<div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{[{label:'Total purchase spend',value:money(metrics.spend),icon:IndianRupee,tone:'text-indigo-600',desc:'For selected purchases'},{label:'Purchase orders',value:metrics.orderCount.toLocaleString('en-IN'),icon:Truck,tone:'text-blue-600',desc:'Matching purchase orders'},{label:'Average order value',value:money(metrics.average),icon:TrendingUp,tone:'text-emerald-600',desc:'Spend per order'},{label:'Quantity purchased',value:metrics.qty.toLocaleString('en-IN'),icon:Package,tone:'text-amber-600',desc:'Sum of item quantities'}].map(k=><div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500 sm:text-sm">{k.label}</span><k.icon size={19} className={k.tone}/></div><div className="mt-3 break-words text-xl font-bold sm:text-2xl">{k.value}</div><div className="mt-1 text-xs text-slate-400">{k.desc}</div></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><BarChart3 size={19} className="text-indigo-600"/><div><h2 className="font-bold">Monthly spend</h2><p className="text-xs text-slate-500">Latest eight months in the filtered data</p></div></div>{loading?<p className="py-8 text-center text-sm text-slate-500">Loading purchases…</p>:metrics.monthly.length===0?<p className="py-8 text-center text-sm text-slate-500">No spend data for this selection.</p>:<div className="space-y-3">{metrics.monthly.map(([month,value])=><div key={month}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-medium text-slate-600">{monthLabel(month)}</span><span className="font-semibold">{money(value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{width:(value/maxMonthly*100)+'%'}}/></div></div>)}</div>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Truck size={19} className="text-blue-600"/><div><h2 className="font-bold">Supplier spend</h2><p className="text-xs text-slate-500">Suppliers ranked by matching purchase value</p></div></div>{loading?<p className="py-8 text-center text-sm text-slate-500">Loading suppliers…</p>:metrics.suppliers.length===0?<p className="py-8 text-center text-sm text-slate-500">No supplier spend data.</p>:<div className="space-y-3">{metrics.suppliers.map(s=><div key={s.name}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="max-w-[65%] truncate font-medium text-slate-700">{s.name} <span className="text-slate-400">· {s.count} orders</span></span><span className="font-semibold">{money(s.spend)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:(s.spend/maxSupplier*100)+'%'}}/></div></div>)}</div>}</section>
    </div>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Package size={19} className="text-amber-600"/><div><h2 className="font-bold">Highest-cost products</h2><p className="text-xs text-slate-500">Based on recorded purchase line totals</p></div></div>{loading?<p className="py-8 text-center text-sm text-slate-500">Loading product costs…</p>:metrics.products.length===0?<p className="py-8 text-center text-sm text-slate-500">No purchase item data.</p>:<div className="space-y-4">{metrics.products.map(p=><div key={p.name} className="grid gap-1 sm:grid-cols-[minmax(150px,1fr)_100px_minmax(140px,1.5fr)] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-slate-400">{p.qty.toLocaleString('en-IN')} {p.unit} · {p.count} line items</p></div><p className="text-sm font-bold">{money(p.spend)}</p><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{width:(p.spend/maxProduct*100)+'%'}}/></div></div>)}</div>}</section>
    <div className="mt-4 flex flex-wrap gap-3 text-sm"><Link href="/purchases" className="font-semibold text-indigo-700 hover:underline">Open purchase management →</Link><Link href="/purchase-receiving" className="font-semibold text-indigo-700 hover:underline">View receiving tracker →</Link><Link href="/supplier-performance" className="font-semibold text-indigo-700 hover:underline">Supplier performance →</Link></div>
    <p className="mt-6 text-xs text-slate-400">Read-only analytics from existing purchase orders and purchase items. Totals reflect recorded purchase values and selected filters.</p>
  </main></div>;
}
