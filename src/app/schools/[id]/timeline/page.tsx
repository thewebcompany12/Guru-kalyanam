'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, CalendarCheck, CheckCircle2, CreditCard, Package, RefreshCw, School, Search, Truck } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type EventItem = {
  id: string;
  kind: 'visit' | 'order' | 'delivery' | 'payment' | 'reminder' | 'activity';
  title: string;
  detail: string;
  at: string;
  status?: string;
  href?: string;
};

const kindMeta: Record<EventItem['kind'], { label: string; icon: any }> = {
  visit: { label: 'Visit', icon: CalendarCheck },
  order: { label: 'Order', icon: Package },
  delivery: { label: 'Delivery', icon: Truck },
  payment: { label: 'Payment', icon: CreditCard },
  reminder: { label: 'Reminder', icon: Bell },
  activity: { label: 'Record change', icon: RefreshCw },
};

function money(value: unknown) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function pretty(value: unknown) {
  if (!value) return '';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function SchoolTimeline() {
  const { id } = require('next/navigation').useParams<{ id: string }>();
  const client = createClient();
  const [school, setSchool] = useState<any>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'ALL' | EventItem['kind']>('ALL');

  const load = async () => {
    setLoading(true);
    setError('');
    const [schoolRes, visitsRes, ordersRes, deliveriesRes, paymentsRes, remindersRes] = await Promise.all([
      client.from('schools').select('id,name,udise_code,district,state,last_visit_at,next_follow_up_at').eq('id', id).single(),
      client.from('school_visits').select('id,started_at,ended_at,purpose,person_met,order_received,payment_collected,follow_up_required,notes').eq('school_id', id).order('started_at', { ascending: false }).limit(100),
      client.from('orders').select('id,order_number,order_date,expected_delivery_date,status,payment_status,total,paid_amount,notes,created_at,updated_at').eq('school_id', id).order('order_date', { ascending: false }).limit(100),
      client.from('deliveries').select('id,order_id,scheduled_date,scheduled_time,status,delivered_at,delivery_notes,created_at,updated_at').eq('school_id', id).order('scheduled_date', { ascending: false }).limit(100),
      client.from('payments').select('id,order_id,amount,payment_date,payment_mode,reference_number,notes,created_at').eq('school_id', id).order('payment_date', { ascending: false }).limit(100),
      client.from('reminders').select('id,title,description,due_at,order_id,priority,completed,created_at,updated_at').eq('school_id', id).order('due_at', { ascending: false }).limit(100),
    ]);

    if (schoolRes.error) {
      setError(schoolRes.error.message);
      setLoading(false);
      return;
    }

    const orders = ordersRes.data || [];
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));
    const entityIds = [
      id,
      ...(visitsRes.data || []).map((x: any) => x.id),
      ...orders.map((x: any) => x.id),
      ...(deliveriesRes.data || []).map((x: any) => x.id),
      ...(paymentsRes.data || []).map((x: any) => x.id),
      ...(remindersRes.data || []).map((x: any) => x.id),
    ];

    const activityRes = entityIds.length
      ? await client.from('activity_logs').select('id,actor_id,entity_type,entity_id,action,old_data,new_data,created_at').in('entity_id', entityIds).order('created_at', { ascending: false }).limit(250)
      : { data: [], error: null };

    const next: EventItem[] = [];

    for (const v of visitsRes.data || []) {
      next.push({
        id: 'visit-' + v.id,
        kind: 'visit',
        title: v.ended_at ? 'School visit completed' : 'School visit started',
        detail: [pretty(v.purpose), v.person_met && 'Met ' + v.person_met, v.order_received && 'Order received', v.payment_collected && 'Payment collected', v.follow_up_required && 'Follow-up required', v.notes].filter(Boolean).join(' · ') || 'Visit recorded',
        at: v.ended_at || v.started_at,
        status: v.ended_at ? 'COMPLETED' : 'ACTIVE',
      });
    }

    for (const o of orders) {
      next.push({
        id: 'order-' + o.id,
        kind: 'order',
        title: 'Order #' + o.order_number,
        detail: [pretty(o.status), o.payment_status && pretty(o.payment_status), money(o.total), o.notes].filter(Boolean).join(' · '),
        at: o.updated_at || o.created_at || o.order_date,
        status: o.status,
        href: '/orders/' + o.id,
      });
      if (o.status === 'PREPARING') {
        next.push({
          id: 'prep-' + o.id,
          kind: 'order',
          title: 'Order #' + o.order_number + ' is being prepared',
          detail: 'Preparation is currently in progress.',
          at: o.updated_at || o.created_at || o.order_date,
          status: 'PREPARING',
          href: '/orders/' + o.id,
        });
      }
    }

    for (const d of deliveriesRes.data || []) {
      const order = orderMap.get(d.order_id);
      next.push({
        id: 'delivery-' + d.id,
        kind: 'delivery',
        title: 'Delivery ' + pretty(d.status),
        detail: [order && 'Order #' + order.order_number, d.scheduled_date, d.scheduled_time, d.delivery_notes].filter(Boolean).join(' · '),
        at: d.delivered_at || d.updated_at || d.created_at || d.scheduled_date,
        status: d.status,
        href: order ? '/orders/' + order.id : undefined,
      });
    }

    for (const p of paymentsRes.data || []) {
      const order = orderMap.get(p.order_id);
      next.push({
        id: 'payment-' + p.id,
        kind: 'payment',
        title: 'Payment received ' + money(p.amount),
        detail: [order && 'Order #' + order.order_number, pretty(p.payment_mode), p.reference_number, p.notes].filter(Boolean).join(' · '),
        at: p.payment_date || p.created_at,
        href: order ? '/orders/' + order.id : undefined,
      });
    }

    for (const r of remindersRes.data || []) {
      const order = orderMap.get(r.order_id);
      next.push({
        id: 'reminder-' + r.id,
        kind: 'reminder',
        title: r.title,
        detail: [r.completed ? 'Completed' : 'Open', pretty(r.priority), order && 'Order #' + order.order_number, r.description].filter(Boolean).join(' · '),
        at: r.due_at || r.created_at,
        status: r.completed ? 'COMPLETED' : 'OPEN',
      });
    }

    for (const a of activityRes.data || []) {
      next.push({
        id: 'activity-' + a.id,
        kind: 'activity',
        title: pretty(a.action) + ' ' + pretty(a.entity_type),
        detail: [a.entity_id && 'ID ' + a.entity_id.slice(0, 8), a.actor_id && 'Actor ' + a.actor_id.slice(0, 8)].filter(Boolean).join(' · '),
        at: a.created_at,
      });
    }

    if (activityRes.error && !next.length) setError(activityRes.error.message);
    next.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setSchool(schoolRes.data);
    setEvents(next);
    setLoading(false);
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => {
      if (kind !== 'ALL' && event.kind !== kind) return false;
      if (!q) return true;
      return [event.title, event.detail, event.status, event.kind].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [events, kind, search]);

  const counts = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, event) => {
      acc[event.kind] = (acc[event.kind] || 0) + 1;
      return acc;
    }, {});
  }, [events]);

  if (loading) return <main className="p-8 text-slate-500">Loading school timeline…</main>;
  if (!school) return <main className="p-8 text-slate-500">School not found.</main>;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AppNav />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <Link href={'/schools/' + id} className="inline-flex items-center gap-1 text-sm text-slate-500 mb-4">
            <ArrowLeft size={15} /> Back to {school.name}
          </Link>

          <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-600 flex items-center gap-2"><School size={15} /> School history</p>
              <h1 className="text-3xl font-bold">{school.name}</h1>
              <p className="text-sm text-slate-500 mt-1">{[school.udise_code, school.district, school.state].filter(Boolean).join(' · ')}</p>
            </div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </header>

          {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <section className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            {(['visit', 'order', 'delivery', 'payment', 'reminder', 'activity'] as const).map((key) => {
              const Meta = kindMeta[key];
              const Icon = Meta.icon;
              return <button key={key} onClick={() => setKind(kind === key ? 'ALL' : key)} className={'card p-3 text-left transition ' + (kind === key ? 'ring-2 ring-emerald-400' : '')}>
                <Icon size={17} className="text-slate-500" />
                <p className="text-xl font-bold mt-2">{counts[key] || 0}</p>
                <p className="text-xs text-slate-500">{Meta.label}s</p>
              </button>;
            })}
          </section>

          <section className="card p-4 mb-5">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this school's history…" className="w-full rounded-xl border px-9 py-2.5 text-sm" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setKind('ALL')} className={'rounded-full px-3 py-1.5 text-xs font-semibold ' + (kind === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100')}>All</button>
              {Object.entries(kindMeta).map(([key, meta]) => <button key={key} onClick={() => setKind(key as EventItem['kind'])} className={'rounded-full px-3 py-1.5 text-xs font-semibold ' + (kind === key ? 'bg-emerald-600 text-white' : 'bg-slate-100')}>{meta.label}</button>)}
            </div>
            <p className="mt-3 text-xs text-slate-500">{filtered.length} events · showing visits, orders, preparation, deliveries, payments and reminders</p>
          </section>

          {!filtered.length ? <div className="card p-10 text-center text-slate-500">No history matches the current filters.</div> : (
            <div className="relative pl-5 md:pl-8">
              <div className="absolute left-2 md:left-3 top-2 bottom-2 w-px bg-slate-200" />
              <div className="space-y-3">
                {filtered.map((event) => {
                  const Meta = kindMeta[event.kind];
                  const Icon = Meta.icon;
                  const body = <article className="card p-4 relative"><span className="absolute -left-[25px] md:-left-[33px] top-5 grid h-6 w-6 place-items-center rounded-full bg-white border-2 border-emerald-400 text-emerald-600"><Icon size={12} /></span><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b>{event.title}</b><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{Meta.label}</span>{event.status && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px]">{pretty(event.status)}</span>}</div><p className="mt-1 text-sm text-slate-600">{event.detail || 'No additional details.'}</p></div><time className="shrink-0 text-xs text-slate-500">{new Date(event.at).toLocaleString('en-IN')}</time></div></article>;
                  return event.href ? <Link key={event.id} href={event.href} className="block hover:-translate-y-0.5 transition">{body}</Link> : <div key={event.id}>{body}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
