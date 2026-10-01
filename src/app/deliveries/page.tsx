'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { CalendarDays, CheckCircle2, Clock3, Download, Filter, PackageCheck, RefreshCw, Search, Truck, XCircle } from 'lucide-react';

type Delivery = {
  id: string;
  order_id: string;
  school_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  delivered_at: string | null;
  delivery_notes: string | null;
  responsible_user_id: string | null;
  school?: { name: string } | null;
  order?: { order_number: number; total: number; status: string } | null;
};
type Order = { id: string; order_number: number; school_id: string; total: number; status: string; school?: { name: string } | null };
type Profile = { id: string; full_name: string | null };

const statuses = ['SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RESCHEDULED'];
const statusMeta: Record<string, { label: string; tone: string; icon: typeof Truck }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'bg-slate-100 text-slate-700', icon: CalendarDays },
  PREPARING: { label: 'Preparing', tone: 'bg-amber-100 text-amber-700', icon: PackageCheck },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'bg-blue-100 text-blue-700', icon: Truck },
  DELIVERED: { label: 'Delivered', tone: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  FAILED: { label: 'Failed', tone: 'bg-red-100 text-red-700', icon: XCircle },
  RESCHEDULED: { label: 'Rescheduled', tone: 'bg-purple-100 text-purple-700', icon: Clock3 },
};

export default function Deliveries() {
  const supabase = createClient();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orderId, setOrderId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [d, o, p] = await Promise.all([
      supabase.from('deliveries').select('id,order_id,school_id,scheduled_date,scheduled_time,status,delivered_at,delivery_notes,responsible_user_id,school:schools(name),order:orders(order_number,total,status)').order('scheduled_date', { ascending: true, nullsFirst: false }),
      supabase.from('orders').select('id,order_number,school_id,total,status,school:schools(name)').not('status', 'eq', 'CANCELLED').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name').order('full_name'),
    ]);
    if (d.error) setError(d.error.message);
    else setRows((d.data || []) as unknown as Delivery[]);
    const normalizedOrders = (o.data || []).map((item) => {
      const order = item as unknown as Order & { school: { name: string } | { name: string }[] | null };
      return {
        ...order,
        school: Array.isArray(order.school) ? order.school[0] ?? null : order.school,
      };
    });
    setOrders(normalizedOrders);
    setProfiles((p.data || []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (dateFrom && (!r.scheduled_date || r.scheduled_date < dateFrom)) return false;
      if (dateTo && (!r.scheduled_date || r.scheduled_date > dateTo)) return false;
      if (!q) return true;
      return [r.school?.name, r.order?.order_number, r.status, r.delivery_notes].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, filter, dateFrom, dateTo]);

  const counts = useMemo(() => statuses.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {}), [rows]);

  const today = new Date().toISOString().slice(0, 10);\n  const overdueCount = rows.filter((r) => r.scheduled_date && r.scheduled_date < today && !['DELIVERED', 'FAILED'].includes(r.status)).length;\n  const exportCsv = () => {\n    const escape = (value: unknown) => '\"' + String(value ?? '').replace(/\"/g, '\"\"') + '\"';\n    const header = ['School', 'Order number', 'Amount', 'Scheduled date', 'Scheduled time', 'Status', 'Assigned to', 'Delivered at', 'Notes'];\n    const data = visible.map((r) => [r.school?.name, r.order?.order_number, r.order?.total, r.scheduled_date, r.scheduled_time, statusMeta[r.status]?.label || r.status, profiles.find((p) => p.id === r.responsible_user_id)?.full_name, r.delivered_at, r.delivery_notes]);\n    const csv = [header, ...data].map((line) => line.map(escape).join(',')).join('\\r\\n');\n    const url = URL.createObjectURL(new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));\n    const a = document.createElement('a'); a.href = url; a.download = 'guru-kalyanam-deliveries.csv'; a.click(); URL.revokeObjectURL(url);\n  };\n\n  const create = async () => {
    if (!orderId) { setError('Select an order.'); return; }
    const order = orders.find((o) => o.id === orderId);
    if (!order) { setError('Selected order was not found.'); return; }
    setSaving(true); setError('');
    const { data: auth } = await supabase.auth.getUser();
    const result = await supabase.from('deliveries').insert({
      order_id: orderId,
      school_id: order.school_id,
      scheduled_date: date || null,
      scheduled_time: time || null,
      responsible_user_id: responsible || null,
      delivery_notes: notes.trim() || null,
      status: 'SCHEDULED',
      created_by: auth.user?.id || null,
    });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setOrderId(''); setDate(''); setTime(''); setResponsible(''); setNotes('');
    await load();
  };

  const update = async (id: string, patch: Partial<Delivery>) => {
    setError('');
    const result = await supabase.from('deliveries').update({
      ...patch,
      delivered_at: patch.status === 'DELIVERED' ? new Date().toISOString() : patch.status ? null : undefined,
    }).eq('id', id);
    if (result.error) setError(result.error.message);
    else await load();
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AppNav />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-5">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-lime-700 flex items-center gap-2"><Truck size={15} /> Phase 21 · Fulfillment</p>
              <h1 className="text-3xl font-bold">Delivery Management</h1>
              <p className="text-sm text-slate-500 mt-1">Schedule, assign, track and close school deliveries.</p>
            </div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </header>

          {error && <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">{error}</div>}

          <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <button onClick={() => setFilter('ALL')} className="card p-3 text-left transition hover:-translate-y-0.5"><div className="text-xl font-bold">{rows.length}</div><p className="text-xs text-slate-500 mt-2">All deliveries</p></button>
            <button onClick={() => { setFilter('ALL'); setDateFrom(''); setDateTo(''); }} className="card p-3 text-left transition hover:-translate-y-0.5"><div className="text-xl font-bold text-rose-600">{overdueCount}</div><p className="text-xs text-slate-500 mt-2">Past due</p></button>
            {statuses.map((s) => { const M = statusMeta[s]; const Icon = M.icon; return (
              <button key={s} onClick={() => setFilter(filter === s ? 'ALL' : s)} className={`card p-3 text-left transition ${filter === s ? 'ring-2 ring-lime-500' : ''}`}>
                <div className="flex items-center justify-between"><span className={`grid h-8 w-8 place-items-center rounded-lg ${M.tone}`}><Icon size={16} /></span><b className="text-xl">{counts[s] || 0}</b></div>
                <p className="text-xs text-slate-500 mt-2">{M.label}</p>
              </button>
            ); })}
          </section>

          <section className="card p-4">
            <h2 className="font-bold mb-3">Schedule a delivery</h2>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <select className="border rounded-xl px-3 py-2.5 text-sm xl:col-span-2" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">Select order…</option>
                {orders.map((o) => <option key={o.id} value={o.id}>#{o.order_number} · {o.school?.name || 'School'} · ₹{Number(o.total).toFixed(0)}</option>)}
              </select>
              <input className="border rounded-xl px-3 py-2.5 text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input className="border rounded-xl px-3 py-2.5 text-sm" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              <select className="border rounded-xl px-3 py-2.5 text-sm" value={responsible} onChange={(e) => setResponsible(e.target.value)}>
                <option value="">Assign delivery person…</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || 'Workspace user'}</option>)}
              </select>
            </div>
            <div className="flex flex-col md:flex-row gap-2 mt-2">
              <input className="flex-1 border rounded-xl px-3 py-2.5 text-sm" placeholder="Delivery notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button onClick={() => void create()} disabled={saving} className="rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? 'Scheduling…' : 'Schedule delivery'}</button>
            </div>
          </section>

          <section className="card p-4">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_180px_160px_160px_auto] mb-4">
              <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="w-full border rounded-xl px-9 py-2.5 text-sm" placeholder="Search school, order or delivery note…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
              <select className="border rounded-xl px-3 py-2.5 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}</select>
              <input aria-label="Scheduled from date" className="border rounded-xl px-3 py-2.5 text-sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input aria-label="Scheduled to date" className="border rounded-xl px-3 py-2.5 text-sm" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
              <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 border rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"><Download size={15}/> Export CSV</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-3"><Filter size={14} /> Showing {visible.length} of {rows.length} deliveries</div>
            {loading ? <div className="py-12 text-center text-slate-500">Loading deliveries…</div> : !visible.length ? <div className="py-12 text-center text-slate-500">No deliveries match the current filters.</div> : (
              <div className="space-y-3">
                {visible.map((r) => {
                  const M = statusMeta[r.status] || statusMeta.SCHEDULED;
                  const person = profiles.find((p) => p.id === r.responsible_user_id);
                  return <article key={r.id} className="border rounded-xl p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><b className="text-base">{r.school?.name || 'School'}</b><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${M.tone}`}>{M.label}</span></div>
                        <p className="text-sm text-slate-600 mt-1">Order #{r.order?.order_number || '—'} · ₹{Number(r.order?.total || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-1">{r.scheduled_date || 'No date'}{r.scheduled_time ? ` · ${r.scheduled_time.slice(0,5)}` : ''}{person ? ` · ${person.full_name || 'Assigned user'}` : ''}</p>
                        {r.delivery_notes && <p className="text-sm text-slate-600 mt-2">{r.delivery_notes}</p>}
                        {r.delivered_at && <p className="text-xs text-emerald-700 mt-2">Delivered {new Date(r.delivered_at).toLocaleString('en-IN')}</p>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select className="border rounded-xl px-3 py-2 text-sm" value={r.status} onChange={(e) => void update(r.id, { status: e.target.value })}>{statuses.map((s) => <option key={s} value={s}>{statusMeta[s].label}</option>)}</select>
                        <input className="border rounded-xl px-3 py-2 text-sm" type="date" value={r.scheduled_date || ''} onChange={(e) => void update(r.id, { scheduled_date: e.target.value || null })} />
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
