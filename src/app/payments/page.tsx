'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type School={id:string;name:string};
type Order={id:string;order_number:number;school_id:string;total:number;payment_status:string;order_date:string};
type Payment={id:string;school_id:string;order_id:string|null;amount:number;payment_date:string;payment_mode:string;reference_number:string|null;notes:string|null;schools?:{name:string}|null};

const modes=['CASH','UPI','BANK_TRANSFER','CHEQUE','OTHER'];
const money=(n:number)=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function PaymentsPage(){
 const supabase=createClient();
 const [schools,setSchools]=useState<School[]>([]),[orders,setOrders]=useState<Order[]>([]),[rows,setRows]=useState<Payment[]>([]);
 const [school,setSchool]=useState(''),[order,setOrder]=useState(''),[amount,setAmount]=useState(''),[mode,setMode]=useState('UPI'),[ref,setRef]=useState(''),[notes,setNotes]=useState('');
 const [query,setQuery]=useState(''),[modeFilter,setModeFilter]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);

 const load=async()=>{
   setLoading(true); setError('');
   const [s,o,p]=await Promise.all([
     supabase.from('schools').select('id,name').order('name'),
     supabase.from('orders').select('id,order_number,school_id,total,payment_status,order_date').order('created_at',{ascending:false}),
     supabase.from('payments').select('id,school_id,order_id,amount,payment_date,payment_mode,reference_number,notes,schools(name)').order('payment_date',{ascending:false}).order('created_at',{ascending:false}).limit(200)
   ]);
   const e=s.error||o.error||p.error;
   if(e) setError(e.message);
   setSchools((s.data||[]) as School[]); setOrders((o.data||[]) as Order[]); setRows((p.data||[]) as Payment[]); setLoading(false);
 };
 useEffect(()=>{load()},[]);

 const totals=useMemo(()=>{
   const received=rows.reduce((x,r)=>x+Number(r.amount||0),0);
   const byOrder=new Map<string,number>();
   rows.forEach(r=>{if(r.order_id)byOrder.set(r.order_id,(byOrder.get(r.order_id)||0)+Number(r.amount||0))});
   const outstanding=orders.reduce((x,o)=>x+Math.max(0,Number(o.total)-Number(byOrder.get(o.id)||0)),0);
   const paidOrders=orders.filter(o=>Number(byOrder.get(o.id)||0)>=Number(o.total)&&Number(o.total)>0).length;
   const partialOrders=orders.filter(o=>{const p=Number(byOrder.get(o.id)||0);return p>0&&p<Number(o.total)}).length;
   return {received,outstanding,paidOrders,partialOrders};
 },[rows,orders]);

 const schoolOrders=orders.filter(o=>o.school_id===school && Number(o.total)>0);
 const orderPaid=order?rows.filter(r=>r.order_id===order).reduce((x,r)=>x+Number(r.amount||0),0):0;
 const selectedOrder=orders.find(o=>o.id===order);
 const remaining=selectedOrder?Math.max(0,Number(selectedOrder.total)-orderPaid):0;

 const visible=rows.filter(r=>{
   const name=r.schools?.name||'';
   const q=query.trim().toLowerCase();
   return (!school||r.school_id===school)&&(!modeFilter||r.payment_mode===modeFilter)&&(!q||name.toLowerCase().includes(q)||(r.reference_number||'').toLowerCase().includes(q)||(r.notes||'').toLowerCase().includes(q));
 });

 const save=async()=>{
   const n=Number(amount);
   if(!school||!Number.isFinite(n)||n<=0){setError('Select a school and enter a positive amount.');return}
   if(selectedOrder&&n>remaining){setError('Payment cannot exceed the remaining order balance.');return}
   setSaving(true);setError('');
   const {data:{user}}=await supabase.auth.getUser();
   const {error:e}=await supabase.from('payments').insert({school_id:school,order_id:order||null,amount:n,payment_mode:mode,reference_number:ref.trim()||null,notes:notes.trim()||null,created_by:user?.id||null});
   if(e){setError(e.message);setSaving(false);return}
   if(selectedOrder){
     const newPaid=orderPaid+n;
     const status=newPaid>=Number(selectedOrder.total)?'PAID':newPaid>0?'PARTIAL':'UNPAID';
     const {error:oe}=await supabase.from('orders').update({paid_amount:newPaid,payment_status:status}).eq('id',selectedOrder.id);
     if(oe){setError('Payment saved, but order payment status could not be updated: '+oe.message)}
   }
   setAmount('');setRef('');setNotes('');setOrder('');setSaving(false);await load();
 };

 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-6">
   <header><p className="text-sm text-slate-500">Phase 23 · Collections</p><h1 className="text-3xl font-bold">Payments & Udhaar</h1><p className="text-slate-500 mt-1">Record school collections and keep order balances synchronized.</p></header>
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
     <div className="card p-4"><p className="text-xs text-slate-500">Received</p><p className="text-xl font-bold text-emerald-700">{money(totals.received)}</p></div>
     <div className="card p-4"><p className="text-xs text-slate-500">Outstanding</p><p className="text-xl font-bold text-amber-700">{money(totals.outstanding)}</p></div>
     <div className="card p-4"><p className="text-xs text-slate-500">Fully paid orders</p><p className="text-xl font-bold">{totals.paidOrders}</p></div>
     <div className="card p-4"><p className="text-xs text-slate-500">Partial orders</p><p className="text-xl font-bold">{totals.partialOrders}</p></div>
   </div>
   <div className="grid xl:grid-cols-[400px_1fr] gap-5">
     <section className="card p-5 space-y-3"><h2 className="font-bold">Record collection</h2>
       <select className="w-full border rounded-xl px-3 py-2" value={school} onChange={e=>{setSchool(e.target.value);setOrder('')}}><option value="">Select school…</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
       <select className="w-full border rounded-xl px-3 py-2" value={order} onChange={e=>setOrder(e.target.value)} disabled={!school}><option value="">School payment · no order</option>{schoolOrders.map(o=><option key={o.id} value={o.id}>Order #{o.order_number} · {money(Number(o.total))}</option>)}</select>
       {selectedOrder&&<div className="rounded-xl bg-slate-100 p-3 text-sm">Order total <b>{money(Number(selectedOrder.total))}</b> · already paid <b>{money(orderPaid)}</b> · remaining <b>{money(remaining)}</b></div>}
       <input className="w-full border rounded-xl px-3 py-2" type="number" min="0.01" step="0.01" max={selectedOrder?remaining:undefined} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount"/>
       <select className="w-full border rounded-xl px-3 py-2" value={mode} onChange={e=>setMode(e.target.value)}>{modes.map(x=><option key={x}>{x}</option>)}</select>
       <input className="w-full border rounded-xl px-3 py-2" value={ref} onChange={e=>setRef(e.target.value)} placeholder="Reference / cheque number"/>
       <textarea className="w-full border rounded-xl px-3 py-2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes"/>
       {error&&<p className="text-sm text-red-600">{error}</p>}
       <button disabled={saving} className="w-full bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold" onClick={save}>{saving?'Saving…':'Record payment'}</button>
     </section>
     <section className="card p-4">
       <div className="flex flex-col md:flex-row gap-2 mb-4"><input className="flex-1 border rounded-xl px-3 py-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school, reference or note…"/><select className="border rounded-xl px-3 py-2" value={school} onChange={e=>setSchool(e.target.value)}><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="border rounded-xl px-3 py-2" value={modeFilter} onChange={e=>setModeFilter(e.target.value)}><option value="">All modes</option>{modes.map(x=><option key={x}>{x}</option>)}</select><button className="border rounded-xl px-3 py-2" onClick={load}>Refresh</button></div>
       {loading?<p className="py-12 text-center text-slate-500">Loading payments…</p>:visible.length===0?<p className="py-12 text-center text-slate-500">No payments match these filters.</p>:<div className="space-y-2">{visible.map(r=><div key={r.id} className="border rounded-xl p-4"><div className="flex justify-between gap-3"><div><b>{r.schools?.name||'School'}</b><p className="text-sm text-slate-500">{r.payment_date} · {r.payment_mode}</p></div><b className="text-emerald-700">{money(Number(r.amount))}</b></div>{r.reference_number&&<p className="text-sm mt-2">Ref: {r.reference_number}</p>}{r.notes&&<p className="text-sm text-slate-500 mt-1">{r.notes}</p>}</div>)}</div>}
     </section>
   </div>
 </div></main></div>
}