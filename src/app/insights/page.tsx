'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, TrendingDown, TrendingUp, WalletCards, IndianRupee, ReceiptText, ShoppingCart } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type MoneyRow = { amount?: number | string; total?: number | string; payment_date?: string; order_date?: string; expense_date?: string };
type MonthRow = { key: string; label: string; orders: number; collections: number; supplierPayments: number; expenses: number; netCash: number };

const money = (value: number) => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const monthKey = (date: Date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

export default function InsightsPage() {
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const client = createClient();
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const from = monthKey(first) + '-01';
      const until = monthKey(next) + '-01';
      const [orders, payments, supplierPayments, expenses] = await Promise.all([
        client.from('orders').select('order_date,total').gte('order_date', from).lt('order_date', until),
        client.from('payments').select('payment_date,amount').gte('payment_date', from).lt('payment_date', until),
        client.from('supplier_payments').select('payment_date,amount').gte('payment_date', from).lt('payment_date', until),
        client.from('business_expenses').select('expense_date,amount').gte('expense_date', from).lt('expense_date', until),
      ]);
      const firstError = [orders, payments, supplierPayments, expenses].find((result) => result.error);
      if (firstError?.error) setError(firstError.error.message);

      const buckets: MonthRow[] = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        return { key: monthKey(date), label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), orders: 0, collections: 0, supplierPayments: 0, expenses: 0, netCash: 0 };
      });
      const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
      (orders.data || []).forEach((item: MoneyRow) => {
        const bucket = byMonth.get((item.order_date || '').slice(0, 7));
        if (bucket) bucket.orders += Number(item.total || 0);
      });
      (payments.data || []).forEach((item: MoneyRow) => {
        const bucket = byMonth.get((item.payment_date || '').slice(0, 7));
        if (bucket) bucket.collections += Number(item.amount || 0);
      });
      (supplierPayments.data || []).forEach((item: MoneyRow) => {
        const bucket = byMonth.get((item.payment_date || '').slice(0, 7));
        if (bucket) bucket.supplierPayments += Number(item.amount || 0);
      });
      (expenses.data || []).forEach((item: MoneyRow) => {
        const bucket = byMonth.get((item.expense_date || '').slice(0, 7));
        if (bucket) bucket.expenses += Number(item.amount || 0);
      });
      buckets.forEach((bucket) => { bucket.netCash = bucket.collections - bucket.supplierPayments - bucket.expenses; });
      setRows(buckets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load monthly insights.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => rows.reduce((result, row) => ({
    orders: result.orders + row.orders,
    collections: result.collections + row.collections,
    supplierPayments: result.supplierPayments + row.supplierPayments,
    expenses: result.expenses + row.expenses,
    netCash: result.netCash + row.netCash,
  }), { orders: 0, collections: 0, supplierPayments: 0, expenses: 0, netCash: 0 }), [rows]);

  const peak = Math.max(1, ...rows.flatMap((row) => [row.orders, row.collections, row.supplierPayments + row.expenses]));
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const change = (current: number, before: number) => before === 0 ? (current === 0 ? '0%' : 'New') : (current >= before ? '+' : '') + Math.round(((current - before) / Math.abs(before)) * 100) + '%';
  const exportCsv = () => {
    const data = [
      ['Month', 'Order value', 'School collections', 'Supplier payments', 'Operating expenses', 'Net cash movement'],
      ...rows.map((row) => [row.label, row.orders, row.collections, row.supplierPayments, row.expenses, row.netCash]),
      ['Six-month total', totals.orders, totals.collections, totals.supplierPayments, totals.expenses, totals.netCash],
    ];
    const blob = new Blob(['\ufeff' + data.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'guru-kalyanam-monthly-insights.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const metrics = [
    { label: 'Order value', value: totals.orders, icon: ShoppingCart, color: 'text-violet-700 bg-violet-50', compare: change(last?.orders || 0, previous?.orders || 0) },
    { label: 'Collections', value: totals.collections, icon: IndianRupee, color: 'text-emerald-700 bg-emerald-50', compare: change(last?.collections || 0, previous?.collections || 0) },
    { label: 'Supplier payments', value: totals.supplierPayments, icon: WalletCards, color: 'text-orange-700 bg-orange-50', compare: change(last?.supplierPayments || 0, previous?.supplierPayments || 0) },
    { label: 'Operating expenses', value: totals.expenses, icon: ReceiptText, color: 'text-rose-700 bg-rose-50', compare: change(last?.expenses || 0, previous?.expenses || 0) },
  ];

  return <div className="app-root min-h-screen flex bg-slate-50">
    <AppNav />
    <main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1 space-y-6 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><TrendingUp size={14} /> BUSINESS OVERVIEW</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Monthly insights</h1><p className="mt-1 text-sm text-slate-500">Six months of orders, collections, supplier payments and operating costs.</p></div>
        <div className="flex gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button><button onClick={exportCsv} disabled={loading || !rows.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} />Export CSV</button></div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><b>Some report data could not be loaded.</b> {error}</div>}
      {loading ? <div className="card animate-pulse p-8 text-sm text-slate-500">Preparing your six-month summary…</div> : <>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="card animate-fade-up p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><div className="text-sm font-medium text-slate-500">{metric.label}</div><span className={['rounded-xl p-2.5', metric.color].join(' ')}><Icon size={19} /></span></div><div className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{money(metric.value)}</div><div className="mt-2 text-xs text-slate-500">Latest month <span className="font-semibold text-slate-700">{metric.compare}</span> vs previous month</div></article>; })}
        </section>

        <section className="card p-4 md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-lg font-bold text-slate-950">Month-by-month activity</h2><p className="mt-1 text-sm text-slate-500">Bars are scaled within each category for easier trend comparison.</p></div><span className="text-xs font-medium text-slate-400">Last 6 months</span></div>
          {rows.length ? <div className="space-y-5">{rows.map((row) => <div key={row.key} className="grid gap-3 sm:grid-cols-[76px_1fr] sm:items-center"><div className="text-sm font-semibold text-slate-700">{row.label}</div><div className="space-y-2">{[{ label: 'Orders', value: row.orders, color: 'bg-violet-500' }, { label: 'Collections', value: row.collections, color: 'bg-emerald-500' }, { label: 'Supplier pay + expenses', value: row.supplierPayments + row.expenses, color: 'bg-orange-400' }].map((bar) => <div key={bar.label} className="grid grid-cols-[120px_1fr_92px] items-center gap-2 text-xs sm:grid-cols-[145px_1fr_110px]"><span className="truncate text-slate-500">{bar.label}</span><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={['h-full rounded-full transition-all duration-500', bar.color].join(' ')} style={{ width: Math.max(0, (bar.value / peak) * 100) + '%' }} /></div><span className="text-right font-semibold tabular-nums text-slate-700">{money(bar.value)}</span></div>)}</div></div>)}</div> : <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No monthly records were found for this period.</div>}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card overflow-hidden p-4 md:p-5"><h2 className="font-bold text-slate-950">Monthly breakdown</h2><p className="mt-1 text-sm text-slate-500">Amounts grouped by the date each transaction was recorded.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-3 pr-3 font-medium">Month</th><th className="px-3 py-3 text-right font-medium">Orders</th><th className="px-3 py-3 text-right font-medium">Collections</th><th className="px-3 py-3 text-right font-medium">Supplier pay</th><th className="py-3 pl-3 text-right font-medium">Expenses</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-b last:border-0 transition hover:bg-slate-50"><td className="py-3 pr-3 font-semibold">{row.label}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.orders)}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.collections)}</td><td className="px-3 py-3 text-right tabular-nums">{money(row.supplierPayments)}</td><td className="py-3 pl-3 text-right tabular-nums">{money(row.expenses)}</td></tr>)}</tbody><tfoot><tr className="bg-slate-50 font-bold"><td className="py-3 pr-3">6-month total</td><td className="px-3 py-3 text-right">{money(totals.orders)}</td><td className="px-3 py-3 text-right">{money(totals.collections)}</td><td className="px-3 py-3 text-right">{money(totals.supplierPayments)}</td><td className="py-3 pl-3 text-right">{money(totals.expenses)}</td></tr></tfoot></table></div></div>
          <aside className="card p-5"><div className="flex items-center gap-2"><span className={['rounded-xl p-2', totals.netCash >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'].join(' ')}>{totals.netCash >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</span><h2 className="font-bold text-slate-950">Net cash movement</h2></div><div className={['mt-4 text-3xl font-bold tracking-tight', totals.netCash >= 0 ? 'text-emerald-700' : 'text-rose-700'].join(' ')}>{money(totals.netCash)}</div><p className="mt-2 text-sm leading-6 text-slate-500">Recorded school collections minus supplier payments and operating expenses across the six-month period.</p><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>Important:</b> This is a cash-flow measure, not accounting profit. Order value is shown separately from money actually collected.</div></aside>
        </section>
      </>}
    </main>
  </div>;
}
