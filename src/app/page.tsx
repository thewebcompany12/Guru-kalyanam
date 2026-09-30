'use client';

import { useEffect, useState } from 'react';
import {
  Bell, ChevronRight, ClipboardList, IndianRupee, MapPin, Package,
  Plus, School, Truck, Users, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

const nav = [
  ['Dashboard', '⌂'], ['Schools', 'School'], ['Orders', 'Orders'], ['Visits', 'Visits'],
  ['Products', 'Products'], ['Inventory', 'Inventory'], ['Deliveries', 'Deliveries'],
  ['Payments', 'Payments'], ['Tasks', 'Tasks'], ['Map', 'Map'], ['Reports', 'Reports'],
  ['Suppliers', 'Suppliers']
];

const quick = [
  ['Add School', School], ['Save Current Location', MapPin], ['Start Visit', CheckCircle2],
  ['Add Order', ClipboardList], ['Add Contact', Users], ['Add Payment', IndianRupee],
  ['Add Reminder', Bell], ['Add Product', Package]
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState(0);
  const [orders, setOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    Promise.all([
      client.auth.getUser(),
      client.from('schools').select('*', { count: 'exact', head: true }),
      client.from('orders').select('*', { count: 'exact', head: true })
    ])
      .then(([userResult, schoolsResult, ordersResult]) => {
        setUser(userResult.data.user);
        setSchools(schoolsResult.count ?? 0);
        setOrders(ordersResult.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 bg-white border-r p-5 flex-col">
        <div className="text-xl font-bold mb-8">
          School Supply <span className="text-emerald-600">Ops</span>
        </div>
        <nav className="space-y-1">
          {nav.map(([name, icon]) => (
            <button
              key={name}
              className={
                'w-full text-left px-3 py-2.5 rounded-xl ' +
                (name === 'Dashboard'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50')
              }
            >
              {icon} <span className="ml-2">{name}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto text-xs text-slate-400">Phase 1 · Core workspace</div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        <header className="flex items-center justify-between mb-7">
          <div>
            <p className="text-sm text-slate-500">Tuesday, September 29, 2026</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">
              Good evening{user?.email ? ', ' + user.email.split('@')[0] : ''}
            </h1>
          </div>
          <button className="h-11 w-11 rounded-full bg-white border flex items-center justify-center">
            <Bell size={19} />
          </button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            ["Today's visits", 0, MapPin],
            ["Today's orders", orders, ClipboardList],
            ['Pending orders', 0, Package],
            ['Payments to collect', 0, IndianRupee]
          ].map(([title, value, Icon]: any) => (
            <div className="card p-4" key={title}>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{title}</span>
                <Icon size={18} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-bold mt-3">{loading ? '—' : value}</div>
            </div>
          ))}
        </section>

        <section className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold">Quick actions</h2>
              <p className="text-sm text-slate-500">Common field-work actions, one tap away.</p>
            </div>
            <Plus size={20} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {quick.map(([label, Icon]: any) => (
              <button key={label} className="rounded-xl border p-3 text-left hover:bg-slate-50">
                <Icon size={19} className="text-emerald-600 mb-3" />
                <span className="text-sm font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-5">
          <section className="card p-5 lg:col-span-2">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Today’s work</h2>
              <ChevronRight size={18} />
            </div>
            <div className="py-14 text-center text-slate-400">
              <ClipboardList className="mx-auto mb-3" size={32} />
              <p>No tasks yet</p>
              <p className="text-sm">Schools, visits, deliveries and follow-ups will appear here.</p>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-bold mb-4">Workspace</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Schools</span><b>{schools}</b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Orders</span><b>{orders}</b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Connection</span>
                <span className="text-emerald-600 font-medium">Supabase</span>
              </div>
            </div>
          </section>
        </div>

        <div className="fixed bottom-5 right-5 md:hidden">
          <button className="h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center">
            <Plus />
          </button>
        </div>

        <div className="mt-8 flex gap-4 text-xs text-slate-400">
          <span><Truck size={14} className="inline mr-1" />Delivery workflow ready for Phase 4</span>
          <span>PWA foundation follows in Phase 7</span>
        </div>
      </main>
    </div>
  );
}
