'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

const money=(n:number)=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const statuses=['ORDERED','RECEIVED','PARTIAL','CANCELLED'];

export default function PurchasesPage(){
 const supabase=createClient();
 const [suppliers,setSuppliers]=useState<any[]>([]),[products,setProducts]=useState<any[]>([]),[rows,setRows]=useState<any[]>([]);
 const [supplier,setSupplier]=useState(''),[product,setProduct]=useState(''),[qty,setQty]=useState('1'),[cost,setCost]=useState('0'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[arrival,setArrival]=useState(''),[notes,setNotes]=useState('');
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');

 const load=async()=>{
  setLoading(true);setError('');
  const [s,p,r]=await Promise.all([
   supabase.from('suppliers').select('id,name,company,phone,outstanding_amount').order('name'),
   supabase.from('products').select('id,name,sku,unit,purchase_price').eq('active',true).order('name'),
   supabase.from('purchases').select('id,purchase_number,supplier_id,purchase_date,expected_arrival_date,status,total,paid_amount,notes').order('purchase_date',{ascending:false}).order('created_at',{ascending:false}).limit(200)
  ]);
  const e=s.error||p.error||r.error;if(e)setError(e.message);
  setSuppliers(s.data||[]);setProducts(p.data||[]);setRows(r.data||[]);setLoading(false);
 };
 useEffect(()=>{load()},[]);
 const selected=products.find(p=>p.id===product);
 const total=Number(qty||0)*Number(cost||0);
 const supplierNames=useMemo(()=>new Map(suppliers.map(s=>[s.id,s.name])),[suppliers]);
 const visible=rows.filter(r=>{const q=query.trim().toLowerCase();const n=supplierNames.get(r.supplier_id)||'';return(!status||r.status===status)&&(!q||n.toLowerCase().includes(q)||String(r.purchase_number).includes(q)||(r.notes||'').toLowerCase().includes(q))});
 const openTotal=rows.filter(r=>r.status!=='CANCELLED').reduce((a,r)=>a+Number(r.total||0),0);
 const outstanding=rows.reduce((a,r)=>a+Math.max(0,Number(r.total||0)-Number(r.paid_amount||0)),0);

 const create=async()=>{
  const q=Number(qty),c=Number(cost);
  if(!supplier||!product||!Number.isFinite(q)||q<=0||!Number.isFinite(c)||c<0){setError('Select supplier and product, then enter valid quantity and cost.');return}
  setSaving(true);setError('');
  const {data:{user}}=await supabase.auth.getUser();
  const {data:maxRow}=await supabase.from('purchases').select('purchase_number').order('purchase_number',{ascending:false}).limit(1).maybeSingle();
  const purchaseNumber=Number(maxRow?.purchase_number||0)+1;
  const ins=await supabase.from('purchases').insert({supplier_id:supplier,purchase_number:purchaseNumber,purchase_date:date,expected_arrival_date:arrival||null,status:'ORDERED',total:total,paid_amount:0,notes:notes.trim()||null,created_by:user?.id||null}).select('id').single();
  if(ins.error){setError(ins.error.message);setSaving(false);return}
  const item=await supabase.from('purchase_items').insert({purchase_id:ins.data.id,product_id:product,product_name:selected?.name||'Product',quantity:q,unit:selected?.unit||'unit',unit_cost:c,line_total:total});
  if(item.error){setError('Purchase created but item could not be added: '+item.error.message);setSaving(false);return}
  setQty('1');setCost(String(selected?.purchase_price||0));setArrival('');setNotes('');setProduct('');setSaving(false);await load();
 };

 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-6">
  <header><p className="text-sm text-slate-500">Phase 24 · Procurement</p><h1 className="text-3xl font-bold">Purchasing</h1><p className="text-slate-500 mt-1">Create purchase orders, track supplier commitments, and monitor payable balances.</p></header>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div className="card p-4"><p className="text-xs text-slate-500">Purchase value</p><b className="text-xl">{money(openTotal)}</b></div><div className="card p-4"><p className="text-xs text-slate-500">Supplier payable</p><b className="text-xl text-amber-700">{money(outstanding)}</b></div><div className="card p-4"><p className="text-xs text-slate-500">Open purchases</p><b className="text-xl">{rows.filter(r=>r.status!=='CANCELLED').length}</b></div><div className="card p-4"><p className="text-xs text-slate-500">Suppliers</p><b className="text-xl">{suppliers.length}</b></div></div>
  <div className="grid xl:grid-cols-[420px_1fr] gap-5">
   <section className="card p-5 space-y-3"><h2 className="font-bold">Create purchase</h2>
    <select className="w-full border rounded-xl px-3 py-2" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Select supplier…</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}{s.company?' · '+s.company:''}</option>)}</select>
    <select className="w-full border rounded-xl px-3 py-2" value={product} onChange={e=>{setProduct(e.target.value);const p=products.find(x=>x.id===e.target.value);if(p)setCost(String(p.purchase_price||0))}}><option value="">Select product…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.sku?' · '+p.sku:''}</option>)}</select>
    <div className="grid grid-cols-2 gap-2"><input className="border rounded-xl px-3 py-2" type="number" min="0.01" step="0.01" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Quantity"/><input className="border rounded-xl px-3 py-2" type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="Unit cost"/></div>
    <div className="rounded-xl bg-slate-100 p-3 text-sm">Line total <b>{money(total)}</b>{selected?.unit?' · '+selected.unit:''}</div>
    <div className="grid grid-cols-2 gap-2"><input className="border rounded-xl px-3 py-2" type="date" value={date} onChange={e=>setDate(e.target.value)}/><input className="border rounded-xl px-3 py-2" type="date" value={arrival} onChange={e=>setArrival(e.target.value)}/></div>
    <textarea className="w-full border rounded-xl px-3 py-2" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes / supplier reference"/>
    {error&&<p className="text-sm text-red-600">{error}</p>}<button disabled={saving} className="w-full bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold" onClick={create}>{saving?'Creating…':'Create purchase order'}</button>
   </section>
   <section className="card p-4"><div className="flex flex-col md:flex-row gap-2 mb-4"><input className="flex-1 border rounded-xl px-3 py-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search supplier, purchase number or note…"/><select className="border rounded-xl px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select><button className="border rounded-xl px-3 py-2" onClick={load}>Refresh</button></div>
   {loading?<p className="py-12 text-center text-slate-500">Loading purchases…</p>:visible.length===0?<p className="py-12 text-center text-slate-500">No purchases match these filters.</p>:<div className="space-y-2">{visible.map(r=><div key={r.id} className="border rounded-xl p-4"><div className="flex justify-between gap-3"><div><b>Purchase #{r.purchase_number}</b><p className="text-sm text-slate-500">{supplierNames.get(r.supplier_id)||'Supplier'} · {r.purchase_date}</p></div><span className="text-xs px-2 py-1 rounded-full bg-slate-100">{r.status}</span></div><div className="mt-2 flex flex-wrap gap-4 text-sm"><span>Total <b>{money(Number(r.total))}</b></span><span>Paid <b>{money(Number(r.paid_amount))}</b></span><span>Due <b>{money(Math.max(0,Number(r.total)-Number(r.paid_amount)))}</b></span></div>{r.expected_arrival_date&&<p className="text-xs text-slate-500 mt-2">Expected arrival: {r.expected_arrival_date}</p>}{r.notes&&<p className="text-sm text-slate-500 mt-1">{r.notes}</p>}</div>)}</div>}</section>
  </div>
 </div></main></div>;
}