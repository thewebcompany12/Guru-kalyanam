'use client';

import { useEffect, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type ReportData = {
  orders: any[];
  received: number;
  sales: number;
  outstanding: number;
  deliveries: any[];
  purchases: any[];
  inventory: any[];
  visits: any[];
};

const EMPTY_REPORT: ReportData = {
  orders: [],
  received: 0,
  sales: 0,
  outstanding: 0,
  deliveries: [],
  purchases: [],
  inventory: [],
  visits: [],
};

export default function Reports() {
  const [data, setData] = useState<ReportData>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = createClient();

    const load = async () => {
      const [o, p, d, pu, i, sv] = await Promise.all([
        client
          .from('orders')
          .select('id,order_number,order_date,status,payment_status,total,paid_amount,schools(name)')
          .order('order_date', { ascending: false }),
        client
          .from('payments')
          .select('amount,order_id,payment_date,payment_mode,schools(name)'),
        client
          .from('deliveries')
          .select('status,scheduled_date,delivered_at,schools(name)'),
        client
          .from('purchases')
          .select('total,paid_amount,status,purchase_date,suppliers(name)'),
        client
          .from('inventory')
          .select('available_stock,incoming_stock,reserved_stock,products(name,sku)'),
        client
          .from('school_visits')
          .select('started_at,ended_at,school_id,schools(name)')
          .order('started_at', { ascending: false })
          .limit(200),
      ]);

      const orders = o.data ?? [];
      const payments = p.data ?? [];
      const received = payments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      const sales = orders.reduce((sum, item) => sum + Number(item.total ?? 0), 0);

      const linkedPaid = new Map<string, number>();
      for (const item of payments as any[]) {
        if (item.order_id) {
          linkedPaid.set(
            item.order_id,
            (linkedPaid.get(item.order_id) ?? 0) + Number(item.amount ?? 0),
          );
        }
      }

      const outstanding = orders.reduce(
        (sum, item) =>
          sum +
          Math.max(
            0,
            Number(item.total ?? 0) -
              (linkedPaid.get(item.id) ?? Number(item.paid_amount ?? 0)),
          ),
        0,
      );

      setData({
        orders,
        received,
        sales,
        outstanding,
        deliveries: d.data ?? [],
        purchases: pu.data ?? [],
        inventory: i.data ?? [],
        visits: sv.data ?? [],
      });
    };

    load().finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-root min-h-screen flex bg-slate-50">
      <AppNav />
      <main className="app-main flex-1 min-w-0 p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            Live operational summaries from current records.
          </p>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Sales', data.sales],
            ['Payments received', data.received],
            ['Outstanding', data.outstanding],
            ['Orders', data.orders.length],
          ].map(([label, value]) => (
            <div className="border rounded-xl p-4 bg-white" key={label as string}>
              <div className="text-sm text-slate-500">{label}</div>
              <div className="text-2xl font-bold mt-2">
                {typeof value === 'number' && label !== 'Orders'
                  ? '₹' + value.toFixed(2)
                  : value}
              </div>
            </div>
          ))}
        </section>

        {loading ? (
          <div className="border rounded-xl p-6 bg-white text-slate-500">
            Loading report data…
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-bold mb-3">Order pipeline</h2>
              {[
                'NEW',
                'CONFIRMED',
                'PREPARING',
                'READY',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'PARTIALLY_DELIVERED',
                'CANCELLED',
              ].map((status) => {
                const count = data.orders.filter((item) => item.status === status).length;
                return (
                  <div className="flex justify-between py-2 border-b last:border-0" key={status}>
                    <span>{status}</span>
                    <b>{count}</b>
                  </div>
                );
              })}
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-bold mb-3">Delivery status</h2>
              {['SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RESCHEDULED'].map(
                (status) => (
                  <div className="flex justify-between py-2 border-b last:border-0" key={status}>
                    <span>{status}</span>
                    <b>{data.deliveries.filter((item) => item.status === status).length}</b>
                  </div>
                ),
              )}
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-bold mb-3">Inventory snapshot</h2>
              {data.inventory.slice(0, 12).map((item: any, index) => (
                <div
                  className="flex justify-between py-2 border-b last:border-0 text-sm"
                  key={item.products?.sku ?? `inventory-${index}`}
                >
                  <span>{item.products?.name ?? 'Unknown product'}</span>
                  <b>{Number(item.available_stock ?? 0).toFixed(0)}</b>
                </div>
              ))}
              {!data.inventory.length && (
                <p className="text-slate-500">No inventory records yet.</p>
              )}
            </section>

            <section className="border rounded-xl p-4 bg-white">
              <h2 className="font-bold mb-3">Recent visits</h2>
              {data.visits.slice(0, 8).map((item: any) => (
                <div
                  className="py-2 border-b last:border-0 text-sm"
                  key={item.started_at + item.school_id}
                >
                  {item.schools?.name ?? 'Unknown school'} ·{' '}
                  {new Date(item.started_at).toLocaleString()}
                </div>
              ))}
              {!data.visits.length && <p className="text-slate-500">No visits yet.</p>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
