'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, WalletCards, Clock3, School, AlertTriangle, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type Order = { id: string; order_number: number; school_id: string; order_date: string; status: string; payment_status: string; total: number | string; paid_amount?: number | string | null; schools?: { name: string } | { name: string }[] | null };
type Payment = { order_id: string | null; amount: number | string };
type Receivable = { id: string; orderNumber: number; schoolId: string; school: string; orderDate: string; status: string; paymentStatus: string; total: number; paid: number; balance: number; ageDays: number; bucket: string };

const money = (value: number) => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const ageBucket = (age: number) => age <= 30 ? '0–30 days' : age <= 60 ? '31–60 days' : age <= 90 ? '61–90 days' : '90+ days';
const csvCell = (value: unknown) => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export default function ReceivablesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [bucketFilter, setBucketFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    setError('');
    const client = createClient();
    const [orderResult, paymentResult] = await Promise.all([
      client.from('orders').select('id,order_number,school_id,order_date,status,payment_status,total,paid_amount,schools(name)').neq('status', 'CANCELLED').order('order_date', { ascending: true }),
      client.from('payments').select('order_id,amount').not('order_id', 'is', null),
    ]);
    const issue = orderResult.error || paymentResult.error;
    if (issue) setError(issue.message);
    setOrders((orderResult.data || []) as unknown as Order[]);
    setPayments((paymentResult.data || []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const rows = useMemo<Receivable[]>(() => {
    const paidByOrder = new Map<string, number>();
    payments.forEach((payment) => {
      if (payment.order_id) paidByOrder.set(payment.order_id, (paidByOrder.get(payment.order_id) || 0) + Number(payment.amount || 0));
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.map((order) => {
      const total = Math.max(0, Number(order.total || 0));
      const paid = Math.min(total, Math.max(Number(order.paid_amount || 0), paidByOrder.get(order.id) || 0));
      const balance = Math.max(0, total - paid);
      const orderDay = new Date((order.order_date || '').slice(0, 10) + 'T00:00:00');
      const ageDays = Number.isNaN(orderDay.getTime()) ? 0 : Math.max(0, Math.floor((today.getTime() - orderDay.getTime()) / 86400000));
      const schoolRel = Array.isArray(order.schools) ? order.schools[0] : order.schools;
      return { id: order.id, orderNumber: order.order_number, schoolId: order.school_id, school: schoolRel?.name || 'Unknown school', orderDate: order.order_date, status: order.status, paymentStatus: balance <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID', total, paid, balance, ageDays, bucket: ageBucket(ageDays) };
    }).filter((row) => row.balance > 0);
  }, [orders, payments]);

  const visible = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (!schoolFilter || row.schoolId === schoolFilter)
      && (bucketFilter === 'all' || row.bucket === bucketFilter)
      && (!q || row.school.toLowerCase().includes(q) || String(row.orderNumber).includes(q) || row.paymentStatus.toLowerCase().includes(q));
  }), [rows, query, schoolFilter, bucketFilter]);

  const totals = useMemo(() => ({
    outstanding: rows.reduce((sum, row) => sum + row.balance, 0),
    overdue: rows.filter((row) => row.ageDays > 30).reduce((sum, row) => sum + row.balance, 0),
    orders: rows.length,
    schools: new Set(rows.map((row) => row.schoolId)).size,
  }), [rows]);

  const buckets = ['0–30 days', '31–60 days', '61–90 days', '90+ days'];
  const bucketTotals = buckets.map((bucket) => ({ bucket, amount: rows.filter((row) => row.bucket === bucket).reduce((sum, row) => sum + row.balance, 0), count: rows.filter((row) => row.bucket === bucket).length }));
  const schools = useMemo(() => Array.from(new Map(rows.map((row) => [row.schoolId, row.school])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [rows]);

  const exportCsv = () => {
    const data = [
      ['School', 'Order number', 'Order date', 'Age in days', 'Aging bucket', 'Order value', 'Recorded paid', 'Outstanding balance', 'Order status', 'Payment status'],
      ...visible.map((row) => [row.school, row.orderNumber, row.orderDate, row.ageDays, row.bucket, row.total, row.paid, row.balance, row.status, row.paymentStatus]),
    ];
    const blob = new Blob(['\ufeff' + data.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'guru-kalyanam-receivables.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="app-root min-h-screen flex bg-slate-50"><AppNav /><main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"><WalletCards size={14}/> COLLECTIONS WORKSPACE</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">School receivables</h1><p className="mt-1 text-sm text-slate-500">Track unpaid order balances and how long each balance has been outstanding.</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Refresh</button><button onClick={exportCsv} disabled={loading || !visible.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"><Download size={16}/>Export CSV</button></div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not load all receivables: {error}</div>}
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[{label:'Outstanding balance',value:money(totals.outstanding),icon:WalletCards,style:'text-amber-700 bg-amber-50'},{label:'Over 30 days',value:money(totals.overdue),icon:AlertTriangle,style:'text-rose-700 bg-rose-50'},{label:'Orders with balance',value:String(totals.orders),icon:Clock3,style:'text-violet-700 bg-violet-50'},{label:'Schools owing',value:String(totals.schools),icon:School,style:'text-sky-700 bg-sky-50'}].map((item) => {const Icon=item.icon;return <article key={item.label} className="card animate-fade-up p-4 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-2"><p className="text-sm text-slate-500">{item.label}</p><span className={'rounded-xl p-2 '+item.style}><Icon size={18}/></span></div><p className="mt-3 text-xl font-bold text-slate-950 md:text-2xl">{item.value}</p></article>;})}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {bucketTotals.map((item) => <button key={item.bucket} onClick={() => setBucketFilter(bucketFilter === item.bucket ? 'all' : item.bucket)} className={'card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md '+(bucketFilter === item.bucket ? 'ring-2 ring-emerald-500' : '')}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-600">{item.bucket}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.count} orders</span></div><p className="mt-3 text-xl font-bold">{money(item.amount)}</p><p className="mt-1 text-xs text-slate-400">Outstanding by order age</p></button>)}
    </section>

    <section className="card p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3" placeholder="Search school or order number…"/></label><select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)} className="rounded-xl border bg-white px-3 py-2.5 md:min-w-56"><option value="">All schools</option>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)} className="rounded-xl border bg-white px-3 py-2.5"><option value="all">All aging buckets</option>{buckets.map((bucket) => <option key={bucket}>{bucket}</option>)}</select></div>
      {loading ? <p className="py-12 text-center text-slate-500">Loading receivables…</p> : visible.length === 0 ? <div className="rounded-xl bg-slate-50 p-10 text-center"><TrendingDown className="mx-auto mb-2 text-emerald-600" size={26}/><p className="font-semibold text-slate-800">No outstanding balances found</p><p className="mt-1 text-sm text-slate-500">Try another filter, or enjoy a clear receivables list.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-3 pr-3 font-medium">School / order</th><th className="px-3 py-3 font-medium">Order date</th><th className="px-3 py-3 text-right font-medium">Order value</th><th className="px-3 py-3 text-right font-medium">Paid</th><th className="px-3 py-3 text-right font-medium">Balance</th><th className="px-3 py-3 font-medium">Age</th><th className="py-3 pl-3 font-medium">Status</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="border-b last:border-0 transition hover:bg-slate-50"><td className="py-3 pr-3"><Link href={'/orders'} className="font-semibold text-slate-900 hover:text-emerald-700">{row.school}</Link><div className="mt-1 text-xs text-slate-500">Order #{row.orderNumber}</div></td><td className="px-3 py-3 whitespace-nowrap">{row.orderDate}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.total)}</td><td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money(row.paid)}</td><td className="px-3 py-3 text-right font-bold tabular-nums text-amber-700">{money(row.balance)}</td><td className="px-3 py-3 whitespace-nowrap"><span className="font-semibold">{row.ageDays}d</span><div className="text-xs text-slate-500">{row.bucket}</div></td><td className="py-3 pl-3"><span className={'rounded-full px-2 py-1 text-xs font-semibold '+(row.paymentStatus==='PARTIAL'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700')}>{row.paymentStatus}</span></td></tr>)}</tbody></table><div className="mt-4 flex justify-between border-t pt-4 text-sm"><span className="text-slate-500">{visible.length} of {rows.length} outstanding orders</span><b>Visible total: {money(visible.reduce((sum,row)=>sum+row.balance,0))}</b></div></div>}
    </section>
    <p className="text-xs leading-5 text-slate-400">Balances use the greater of the order’s recorded paid amount or linked payment totals to avoid double-counting the same collection. Cancelled orders are excluded. Aging is based on order date, not a contractual due date.</p>
  </main></div>;
}
