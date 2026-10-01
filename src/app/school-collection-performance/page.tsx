'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, School, WalletCards, TrendingUp, AlertCircle } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type Order = { id: string; order_number: number; school_id: string; order_date: string; status: string; total: number | string; paid_amount?: number | string | null; schools?: { name: string } | { name: string }[] | null };
type Payment = { order_id: string | null; payment_date?: string; amount: number | string };
type Row = { schoolId: string; school: string; orders: number; orderValue: number; collections: number; outstanding: number; collectionRate: number };
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const csvCell = (value: unknown) => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default function SchoolCollectionPerformancePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const client = createClient();
      const [o, p] = await Promise.all([
        client.from('orders').select('id,order_number,school_id,order_date,status,total,paid_amount,schools(name)').neq('status', 'CANCELLED').order('order_date', { ascending: true }),
        client.from('payments').select('order_id,payment_date,amount').not('order_id', 'is', null).order('payment_date', { ascending: true }),
      ]);
      const issue = o.error || p.error;
      if (issue) throw new Error(issue.message);
      setOrders((o.data || []) as unknown as Order[]);
      setPayments((p.data || []) as Payment[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load school collection data.');
      setOrders([]); setPayments([]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo<Row[]>(() => {
    const paidByOrder = new Map<string, number>();
    payments.forEach(p => { if (p.order_id) paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) || 0) + Math.max(0, Number(p.amount) || 0)); });
    const schoolRows = new Map<string, Row>();
    orders.filter(o => (!from || o.order_date >= from) && (!to || o.order_date.slice(0, 10) <= to)).forEach(o => {
      const rel = Array.isArray(o.schools) ? o.schools[0] : o.schools;
      const name = rel?.name || 'Unknown school';
      const row = schoolRows.get(o.school_id) || { schoolId: o.school_id, school: name, orders: 0, orderValue: 0, collections: 0, outstanding: 0, collectionRate: 0 };
      const total = Math.max(0, Number(o.total) || 0);
      const paid = Math.min(total, Math.max(Math.max(0, Number(o.paid_amount) || 0), paidByOrder.get(o.id) || 0));
      row.orders += 1; row.orderValue += total; row.collections += paid; row.outstanding += Math.max(0, total - paid);
      schoolRows.set(o.school_id, row);
    });
    return Array.from(schoolRows.values()).map(row => ({ ...row, collectionRate: row.orderValue > 0 ? row.collections / row.orderValue * 100 : 0 })).sort((a,b) => b.outstanding - a.outstanding);
  }, [orders, payments, from, to]);

  const visible = useMemo(() => rows.filter(r => r.school.toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);
  const totals = useMemo(() => visible.reduce((a,r) => ({ schools:a.schools+1, orders:a.orders+r.orders, orderValue:a.orderValue+r.orderValue, collections:a.collections+r.collections, outstanding:a.outstanding+r.outstanding }), { schools:0, orders:0, orderValue:0, collections:0, outstanding:0 }), [visible]);
  const exportCsv = () => {
    const data = [['School','Orders','Order value (INR)','Recorded paid amount (INR)','Outstanding on filtered orders (INR)','Collection rate (%)'], ...visible.map(r => [r.school,r.orders,r.orderValue,r.collections,r.outstanding,r.collectionRate.toFixed(2)])];
    const blob = new Blob(['\ufeff' + data.map(row => row.map(csvCell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='guru-kalyanam-school-collection-performance.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="app-root min-h-screen flex bg-slate-50"><AppNav/><main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800"><School size={14}/> SCHOOL COLLECTIONS</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">School collection performance</h1><p className="mt-1 text-sm text-slate-500">Compare order values, recorded paid amounts, and outstanding balances by school.</p></div><div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button><button onClick={exportCsv} disabled={loading || visible.length===0} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download size={16}/>Export CSV</button></div></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mr-2 inline"/>Could not load collection data: {error}</div>}
    <section className="card grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="text-sm font-medium text-slate-700">Search school<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="School name" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label><label className="text-sm font-medium text-slate-700">Order date from<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label><label className="text-sm font-medium text-slate-700">Order date to<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5"/></label></section>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Schools in view',value:String(totals.schools),detail:'With orders in selected period',Icon:School},{label:'Order value',value:money(totals.orderValue),detail:totals.orders+' orders',Icon:TrendingUp},{label:'Recorded paid amount',value:money(totals.collections),detail:'Paid amount on filtered orders',Icon:WalletCards},{label:'Outstanding balance',value:money(totals.outstanding),detail:'Balance on filtered orders',Icon:AlertCircle}].map(item=><article key={item.label} className="card p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{item.label}</p><item.Icon size={18} className="text-slate-400"/></div><p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></article>)}</section>
    <section className="card overflow-hidden"><div className="border-b p-4"><h2 className="font-bold text-slate-950">School comparison</h2><p className="mt-1 text-sm text-slate-500">Based on order dates {from||'from all time'} to {to||'all time'} · {visible.length} schools shown</p></div>{loading?<p className="py-12 text-center text-slate-500">Loading school collection performance…</p>:visible.length===0?<p className="py-12 text-center text-slate-500">No schools match these filters.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-3">School</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Order value</th><th className="p-3 text-right">Paid amount*</th><th className="p-3 text-right">Outstanding</th><th className="p-3 text-right">Collection rate</th></tr></thead><tbody>{visible.map(r=><tr key={r.schoolId} className="border-b last:border-0 hover:bg-slate-50"><td className="p-3 font-semibold">{r.school}</td><td className="p-3 text-right tabular-nums">{r.orders}</td><td className="p-3 text-right tabular-nums">{money(r.orderValue)}</td><td className="p-3 text-right tabular-nums text-emerald-700">{money(r.collections)}</td><td className="p-3 text-right tabular-nums font-semibold">{money(r.outstanding)}</td><td className="p-3 text-right tabular-nums">{r.collectionRate.toFixed(1)}%</td></tr>)}</tbody></table></div>}</section>
    <p className="text-xs leading-5 text-slate-400">* Paid amount uses the greater of each order's stored paid_amount and the sum of its linked payment records to avoid double-counting. Order dates control the period filter; payments are not reallocated by payment date. This is an operational view, not a dated accounting statement. Cancelled orders are excluded.</p>
  </main></div>;
}
