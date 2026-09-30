'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, CircleCheck, Clock3, IndianRupee, Package, RefreshCw, School, Truck } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type PipelineStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
type Order = {
  id: string;
  order_number: number;
  school_id: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  payment_status: string;
  total: number;
  school?: { name: string }[] | null;
};
type ItemSummary = { order_id: string; quantity: number; count: number };

const stages: { key: PipelineStatus; label: string; tone: string; icon: typeof School }[] = [
  { key: 'NEW', label: 'New', tone: 'sky', icon: Clock3 },
  { key: 'CONFIRMED', label: 'Confirmed', tone: 'blue', icon: CircleCheck },
  { key: 'PREPARING', label: 'Preparing', tone: 'amber', icon: Package },
  { key: 'READY', label: 'Ready', tone: 'emerald', icon: Package },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', tone: 'violet', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', tone: 'green', icon: CircleCheck },
];

const stageClasses: Record<string, string> = {
  sky: 'bg-sky-50 border-sky-200 text-sky-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  violet: 'bg-violet-50 border-violet-200 text-violet-800',
  green: 'bg-green-50 border-green-200 text-green-800',
};

function money(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'No delivery date';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00'));
}

export default function PipelinePage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [ordersResult, itemsResult] = await Promise.all([
      supabase.from('orders').select('id,order_number,school_id,order_date,expected_delivery_date,status,payment_status,total,school:schools(name)').in('status', stages.map(stage => stage.key)).order('expected_delivery_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('order_items').select('order_id,quantity'),
    ]);
    if (ordersResult.error) setError(ordersResult.error.message);
    else setOrders((ordersResult.data || []) as Order[]);
    if (itemsResult.error) setError(itemsResult.error.message);
    else {
      const grouped = new Map<string, ItemSummary>();
      for (const row of (itemsResult.data || []) as { order_id: string; quantity: number }[]) {
        const current = grouped.get(row.order_id) || { order_id: row.order_id, quantity: 0, count: 0 };
        current.quantity += Number(row.quantity || 0);
        current.count += 1;
        grouped.set(row.order_id, current);
      }
      setItems([...grouped.values()]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(order => {
      const school = order.school?.[0]?.name || '';
      return school.toLowerCase().includes(q) || String(order.order_number).includes(q) || order.status.toLowerCase().includes(q);
    });
  }, [orders, search]);

  const moveOrder = async (orderId: string, status: PipelineStatus) => {
    setMoving(orderId);
    setError('');
    const { error: updateError } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (updateError) setError(updateError.message);
    else setOrders(current => current.map(order => order.id === orderId ? { ...order, status } : order));
    setMoving('');
  };

  const itemInfo = (orderId: string) => items.find(item => item.order_id === orderId) || { order_id: orderId, quantity: 0, count: 0 };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AppNav />
      <main className="flex-1 min-w-0 p-3 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          <header className="mb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-violet-600 font-semibold">Phase 13 · Order pipeline</p>
                <h1 className="text-3xl font-bold mt-1">Orders at a glance</h1>
                <p className="text-slate-500 mt-1">Move school orders from new to delivered and see delivery and payment status in one place.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/orders" className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold">Create / edit orders</Link>
                <button onClick={() => void load()} className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2"><RefreshCw size={16} />Refresh</button>
              </div>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search school, order number…" className="min-w-[240px] flex-1 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-200" />
              <div className="shrink-0 rounded-xl bg-violet-100 px-4 py-3 text-sm font-bold text-violet-800">{filtered.length} active orders</div>
            </div>
          </header>

          {error && <div className="card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {stages.map(stage => <div key={stage.key} className="card h-64 animate-pulse bg-white" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {stages.map(stage => {
                const stageOrders = filtered.filter(order => order.status === stage.key);
                const Icon = stage.icon;
                return (
                  <section key={stage.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
                    <div className={`rounded-xl border p-3 ${stageClasses[stage.tone]}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold"><Icon size={17} />{stage.label}</div>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{stageOrders.length}</span>
                      </div>
                    </div>
                    <div
                      className="mt-3 min-h-32 space-y-3"
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        event.preventDefault();
                        const orderId = event.dataTransfer.getData('text/plain');
                        if (orderId) void moveOrder(orderId, stage.key);
                      }}
                    >
                      {stageOrders.length === 0 && <div className="rounded-xl border border-dashed p-5 text-center text-xs text-slate-400">Drop orders here</div>}
                      {stageOrders.map(order => {
                        const info = itemInfo(order.id);
                        const schoolName = order.school?.[0]?.name || 'School not linked';
                        return (
                          <article
                            key={order.id}
                            draggable
                            onDragStart={event => event.dataTransfer.setData('text/plain', order.id)}
                            className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${moving === order.id ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link href={`/orders/${order.id}`} className="font-bold text-slate-900 hover:text-violet-700">#{order.order_number}</Link>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${order.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : order.payment_status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{order.payment_status}</span>
                            </div>
                            <div className="mt-2 flex items-start gap-2 text-sm font-semibold"><School size={16} className="mt-0.5 shrink-0 text-violet-500" /><span>{schoolName}</span></div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                              <div className="flex items-center gap-1.5"><Package size={14} />{info.count} item{info.count === 1 ? '' : 's'} · {info.quantity} qty</div>
                              <div className="flex items-center gap-1.5"><IndianRupee size={14} />{money(Number(order.total || 0))}</div>
                              <div className="col-span-2 flex items-center gap-1.5"><CalendarDays size={14} />{formatDate(order.expected_delivery_date)}</div>
                            </div>
                            <div className="mt-3 flex gap-1.5 overflow-x-auto">
                              {stages.map((nextStage, index) => {
                                const currentIndex = stages.findIndex(item => item.key === order.status);
                                if (index !== currentIndex + 1) return null;
                                return <button key={nextStage.key} onClick={() => void moveOrder(order.id, nextStage.key)} className="flex-1 rounded-lg bg-violet-600 px-2 py-2 text-xs font-bold text-white"><ChevronRight size={13} className="inline" /> {nextStage.label}</button>;
                              })}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
