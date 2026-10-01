'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { CalendarClock, CheckCircle2, Download, PackageCheck, RefreshCw, Search, Truck, AlertTriangle } from 'lucide-react';

type Item = { id: string; product_name: string; quantity: number; received_quantity: number; unit: string; unit_cost: number };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; expected_arrival_date: string | null; status: string; total: number; notes: string | null; suppliers?: { name: string } | { name: string }[] | null; purchase_items?: Item[] };
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const supplierName = (p: Purchase) => Array.isArray(p.suppliers) ? p.suppliers[0]?.name || 'Supplier' : p.suppliers?.name || 'Supplier';
const dateLabel = (value: string | null) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled';

export default function PurchaseReceivingPage() {
  const db = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('OPEN');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await db.from('purchases')
      .select('id,purchase_number,supplier_id,purchase_date,expected_arrival_date,status,total,notes,suppliers(name),purchase_items(id,product_name,quantity,received_quantity,unit,unit_cost)')
      .order('expected_arrival_date', { ascending: true, nullsFirst: false });
    if (loadError) setError(loadError.message);
    else setRows((data || []) as unknown as Purchase[]);
    setLoading(false);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const enriched = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rows.map(p => {
      const items = p.purchase_items || [];
      const ordered = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
      const received = items.reduce((s, i) => s + Number(i.received_quantity || 0), 0);
      const open = Math.max(0, ordered - received);
      const complete = open <= 0 || ['RECEIVED', 'CANCELLED'].includes((p.status || '').toUpperCase());
      const overdue = !complete && !!p.expected_arrival_date && p.expected_arrival_date < today;
      return { ...p, ordered, received, open, complete, overdue };
    });
  }, [rows]);
  const filtered = useMemo(() => enriched.filter(p => {
    const text = [p.purchase_number, supplierName(p), p.status, p.notes, ...(p.purchase_items || []).map(i => i.product_name)].join(' ').toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (filter === 'OPEN' && p.complete) return false;
    if (filter === 'OVERDUE' && !p.overdue) return false;
    if (filter === 'COMPLETE' && !p.complete) return false;
    if (from && p.purchase_date < from) return false;
    if (to && p.purchase_date > to) return false;
    return true;
  }), [enriched, query, filter, from, to]);
  const openCount = enriched.filter(p => !p.complete).length;
  const overdueCount = enriched.filter(p => p.overdue).length;
  const totalOpenUnits = enriched.filter(p => !p.complete).reduce((s, p) => s + p.open, 0);
  const exportCsv = () => {
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [['Purchase #','Supplier','Order date','Expected arrival','Status','Ordered qty','Received qty','Open qty','Value','Notes'], ...filtered.map(p => [p.purchase_number, supplierName(p), p.purchase_date, p.expected_arrival_date || '', p.status, p.ordered, p.received, p.open, p.total, p.notes || ''])];
    const blob = new Blob([lines.map(row => row.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'purchase-receiving.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="min-h-screen bg-slate-50 text-slate-900"><AppNav /><main className="mx-auto max-w-7xl px-4 py-5 pb-24 md:px-8 md:py-8 md:pl-[290px]">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">Procurement · Phase 51</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Purchase receiving tracker</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Track what is still expected from suppliers, spot late arrivals, and reconcile received quantities against purchase orders.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-slate-100"><RefreshCw size={16}/> Refresh</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"><Download size={16}/> Export CSV</button></div>
    </div>
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[{label:'Open purchase orders',value:openCount,icon:Truck,tone:'text-indigo-600',desc:'Still awaiting items'},{label:'Overdue arrivals',value:overdueCount,icon:AlertTriangle,tone:'text-rose-600',desc:'Past expected date'},{label:'Units outstanding',value:totalOpenUnits.toLocaleString('en-IN'),icon:PackageCheck,tone:'text-amber-600',desc:'Ordered minus received'},{label:'Fully received',value:enriched.filter(p=>p.complete && (p.status||'').toUpperCase()!=='CANCELLED').length,icon:CheckCircle2,tone:'text-emerald-600',desc:'Completed purchase orders'}].map(k => <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500 sm:text-sm">{k.label}</span><k.icon size={19} className={k.tone}/></div><div className="mt-3 text-2xl font-bold">{k.value}</div><div className="mt-1 text-xs text-slate-400">{k.desc}</div></div>)}
    </div>
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
        <label className="relative block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search supplier, purchase #, product…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label>
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="OPEN">Open orders</option><option value="OVERDUE">Overdue only</option><option value="COMPLETE">Fully received / closed</option><option value="ALL">All purchases</option></select>
        <input aria-label="Purchase date from" type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input aria-label="Purchase date to" type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/>
      </div>
    </div>
    {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><h2 className="font-bold">Receiving register</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} purchase orders shown</p></div><CalendarClock size={20} className="text-slate-400"/></div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading purchase orders…</div> : filtered.length === 0 ? <div className="p-10 text-center"><PackageCheck size={30} className="mx-auto text-slate-300"/><p className="mt-3 font-semibold">No matching purchase orders</p><p className="mt-1 text-sm text-slate-500">Try changing the filters or search.</p></div> : <div className="divide-y divide-slate-100">{filtered.map(p => <article key={p.id} className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">Purchase #{p.purchase_number}</span><span className={'rounded-full px-2.5 py-1 text-xs font-bold '+(p.overdue?'bg-rose-100 text-rose-700':p.complete?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800')}>{p.overdue?'Overdue':p.complete?'Received / Closed':'Awaiting items'}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{p.status}</span></div><p className="mt-1 font-medium text-slate-700">{supplierName(p)}</p><p className="mt-1 text-xs text-slate-500">Ordered {dateLabel(p.purchase_date)} · Expected {dateLabel(p.expected_arrival_date)}</p></div><div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:min-w-[260px]"><div><p className="text-xs text-slate-500">Ordered quantity</p><p className="font-semibold">{p.ordered}</p></div><div><p className="text-xs text-slate-500">Received quantity</p><p className="font-semibold text-emerald-700">{p.received}</p></div><div><p className="text-xs text-slate-500">Outstanding</p><p className="font-bold text-amber-700">{p.open}</p></div><div><p className="text-xs text-slate-500">Order value</p><p className="font-semibold">{money(p.total)}</p></div></div></div>
        {(p.purchase_items||[]).length>0 && <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[520px] text-left text-xs sm:text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-semibold">Item</th><th className="px-3 py-2 font-semibold">Ordered</th><th className="px-3 py-2 font-semibold">Received</th><th className="px-3 py-2 font-semibold">Open</th></tr></thead><tbody className="divide-y divide-slate-100">{(p.purchase_items||[]).map(i=><tr key={i.id}><td className="px-3 py-2 font-medium">{i.product_name}</td><td className="px-3 py-2">{i.quantity} {i.unit}</td><td className="px-3 py-2 text-emerald-700">{i.received_quantity} {i.unit}</td><td className="px-3 py-2 font-semibold">{Math.max(0,Number(i.quantity||0)-Number(i.received_quantity||0))} {i.unit}</td></tr>)}</tbody></table></div>}
        {p.notes && <p className="mt-3 text-sm text-slate-500">Note: {p.notes}</p>}
      </article>)}</div>}
    </div>
    <div className="mt-4 flex flex-wrap gap-3 text-sm"><Link href="/purchases" className="font-semibold text-indigo-700 hover:underline">Open purchase management →</Link><Link href="/suppliers" className="font-semibold text-indigo-700 hover:underline">View suppliers →</Link></div>
    <p className="mt-6 text-xs text-slate-400">Read-only report. Receiving quantities are taken from existing purchase items; no duplicate stock or payment records are created.</p>
  </main></div>;
}
