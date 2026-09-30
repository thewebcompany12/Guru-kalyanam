'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Filter, RefreshCw } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

const csv=(rows:any[])=>rows.map(row=>row.map((v:any)=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n');
const money=(n:number)=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function Reports(){
 const [data,setData]=useState<any>({orders:[],payments:[],deliveries:[],purchases:[],inventory:[],visits:[]});
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');const c=createClient();const [o,p,d,pu,i,sv]=await Promise.all([
  c.from('orders').select('id,order_number,order_date,status,payment_status,total,paid_amount,schools(name)').order('order_date',{ascending:false}),
  c.from('payments').select('amount,order_id,payment_date,payment_mode,schools(name)').order('payment_date',{ascending:false}),
  c.from('deliveries').select('status,scheduled_date,delivered_at,schools(name)').order('scheduled_date',{ascending:false}),
  c.from('purchases').select('total,paid_amount,status,purchase_date,suppliers(name)').order('purchase_date',{ascending:false}),
  c.from('inventory').select('available_stock,incoming_stock,reserved_stock,products(name,sku)'),
  c.from('school_visits').select('started_at,ended_at,school_id,schools(name)').order('started_at',{ascending:false}).limit(500)
 ]);const bad:any=[o,p,d,pu,i,sv].find((x:any)=>x?.error);if(bad)setError(bad.error.message);setData({orders:o.data||[],payments:p.data||[],deliveries:d.data||[],purchases:pu.data||[],inventory:i.data||[],visits:sv.data||[]});setLoading(false)};
 useEffect(()=>{load()},[]);
 const inRange=(value:string)=>{const day=value?.slice(0,10);return (!from||day>=from)&&(!to||day<=to)};
 const orders=useMemo(()=>data.orders.filter((x:any)=>inRange(x.order_date)),[data.orders,from,to]);
 const payments=useMemo(()=>data.payments.filter((x:any)=>inRange(x.payment_date)),[data.payments,from,to]);
 const deliveries=useMemo(()=>data.deliveries.filter((x:any)=>inRange(x.scheduled_date||x.delivered_at||'')),[data.deliveries,from,to]);
 const purchases=useMemo(()=>data.purchases.filter((x:any)=>inRange(x.purchase_date)),[data.purchases,from,to]);
 const visits=useMemo(()=>data.visits.filter((x:any)=>inRange(x.started_at)),[data.visits,from,to]);
 const received=payments.reduce((a:any,x:any)=>a+Number(x.amount||0),0),sales=orders.reduce((a:any,x:any)=>a+Number(x.total||0),0);
 const paidByOrder=new Map<string,number>(); payments.forEach((x:any)=>{if(x.order_id)paidByOrder.set(x.order_id,(paidByOrder.get(x.order_id)||0)+Number(x.amount||0))});
 const outstanding=orders.reduce((a:any,x:any)=>a+Math.max(0,Number(x.total||0)-Math.max(Number(x.paid_amount||0),paidByOrder.get(x.id)||0)),0);
 const download=(name:string,rows:any[])=>{const blob=new Blob(['\ufeff'+csv(rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)};
 const exportReport=()=>download('guru-kalyanam-report.csv',[
  ['Section','Date','Reference','School/Supplier','Status','Amount'],
  ...orders.map((x:any)=>['Order',x.order_date,x.order_number,x.schools?.name||'',x.status,x.total]),
  ...payments.map((x:any)=>['Payment',x.payment_date,x.order_id||'',x.schools?.name||'',x.payment_mode,x.amount]),
  ...purchases.map((x:any)=>['Purchase',x.purchase_date,'',x.suppliers?.name||'',x.status,x.total]),
  ...deliveries.map((x:any)=>['Delivery',x.scheduled_date||x.delivered_at||'', '',x.schools?.name||'',x.status,'']),
  ...visits.map((x:any)=>['Visit',x.started_at,'',x.schools?.name||'','',''])
 ]);
 return <div className="app-root min-h-screen flex bg-slate-50"><AppNav/><main className="app-main flex-1 min-w-0 p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
 <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Reports &amp; Analytics</h1><p className="text-sm text-slate-500 mt-1">Live operational summaries with date filters and CSV export.</p></div><button onClick={load} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"><RefreshCw size={16}/>Refresh</button></header>
 {error&&<div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
 <section className="card p-4"><div className="flex items-center gap-2 font-bold mb-3"><Filter size={17}/>Report period</div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-sm">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="text-sm">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><button onClick={()=>{setFrom('');setTo('')}} className="rounded-xl border p-3 self-end">Clear filters</button><button disabled={loading} onClick={exportReport} className="rounded-xl bg-slate-900 text-white p-3 font-semibold self-end inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Download size={16}/>Export CSV</button></div></section>
 <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Sales',sales],['Payments received',received],['Outstanding',outstanding],['Orders',orders.length]].map(([label,value]:any)=><div className="card p-4" key={label}><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-bold mt-2">{label==='Orders'?value:money(value)}</div></div>)}</section>
 {loading?<div className="card p-6 text-slate-500">Loading report data…</div>:<div className="grid lg:grid-cols-2 gap-5">
 <section className="card p-4"><h2 className="font-bold mb-3">Order pipeline</h2>{['NEW','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','PARTIALLY_DELIVERED','CANCELLED'].map(status=><div className="flex justify-between py-2 border-b last:border-0" key={status}><span>{status}</span><b>{orders.filter((x:any)=>x.status===status).length}</b></div>)}</section>
 <section className="card p-4"><h2 className="font-bold mb-3">Delivery status</h2>{['SCHEDULED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','FAILED','RESCHEDULED'].map(status=><div className="flex justify-between py-2 border-b last:border-0" key={status}><span>{status}</span><b>{deliveries.filter((x:any)=>x.status===status).length}</b></div>)}</section>
 <section className="card p-4"><h2 className="font-bold mb-3">Inventory snapshot</h2>{data.inventory.slice(0,12).map((x:any,i:number)=><div className="flex justify-between py-2 border-b last:border-0 text-sm" key={x.products?.sku||i}><span>{x.products?.name||'Unknown product'}</span><b>{Number(x.available_stock||0).toFixed(0)}</b></div>)}{!data.inventory.length&&<p className="text-slate-500">No inventory records yet.</p>}</section>
 <section className="card p-4"><h2 className="font-bold mb-3">Activity in period</h2><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-emerald-50 p-3"><b className="text-xl">{visits.length}</b><small className="block text-slate-500">Visits</small></div><div className="rounded-xl bg-blue-50 p-3"><b className="text-xl">{payments.length}</b><small className="block text-slate-500">Payments</small></div><div className="rounded-xl bg-orange-50 p-3"><b className="text-xl">{purchases.length}</b><small className="block text-slate-500">Purchases</small></div></div></section>
 </div>}
 <div className="text-xs text-slate-400 flex items-center gap-2"><FileSpreadsheet size={14}/>CSV contains the currently filtered orders, payments, purchases, deliveries and visits.</div>
 </main></div>;
}
