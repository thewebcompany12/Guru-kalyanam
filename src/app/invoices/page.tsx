'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { FileText, Printer, RefreshCw } from 'lucide-react';

const money=(n:any)=>'₹'+Number(n||0).toFixed(2);

export default function InvoicesPage(){
 const supabase=createClient();
 const [orders,setOrders]=useState<any[]>([]),[invoices,setInvoices]=useState<any[]>([]),[school,setSchool]=useState<any>(null);
 const [orderId,setOrderId]=useState(''),[seller,setSeller]=useState('Guru Kalyanam'),[gstin,setGstin]=useState(''),[sellerAddress,setSellerAddress]=useState(''),[sellerState,setSellerState]=useState('Uttar Pradesh'),[sellerCode,setSellerCode]=useState('09');
 const [error,setError]=useState(''),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);

 const load=async()=>{setLoading(true);setError('');const [o,i]=await Promise.all([
  supabase.from('orders').select('id,order_number,school_id,order_date,total,subtotal,discount,tax_amount,school:schools(id,name,address,state)').order('created_at',{ascending:false}),
  supabase.from('invoices').select('*,school:schools(name),order:orders(order_number)').order('created_at',{ascending:false})
 ]);if(o.error||i.error)setError((o.error||i.error)?.message||'Unable to load invoices');setOrders(o.data||[]);setInvoices(i.data||[]);setLoading(false)};
 useEffect(()=>{load();(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {data}=await supabase.from('business_settings').select('business_name,gstin,address,state,state_code').eq('user_id',user.id).maybeSingle();if(data){setSeller(data.business_name||'Guru Kalyanam');setGstin(data.gstin||'');setSellerAddress(data.address||'');setSellerState(data.state||'Uttar Pradesh');setSellerCode(data.state_code||'09')}})()},[]);
 const selected=orders.find(o=>o.id===orderId);
 const createInvoice=async()=>{
  if(!selected){setError('Select an order.');return} setSaving(true);setError('');
  const {data:items,error:ie}=await supabase.from('order_items').select('*').eq('order_id',selected.id).order('created_at');
  if(ie){setError(ie.message);setSaving(false);return}
  const {data:last}=await supabase.from('invoices').select('invoice_number').order('invoice_number',{ascending:false}).limit(1).maybeSingle();
  const number=Number(last?.invoice_number||0)+1;
  const buyer=selected.school||{}; const sameState=(buyer.state||'').trim().toLowerCase()===(sellerState||'').trim().toLowerCase();
  const rows=(items||[]).map((x:any)=>{const base=Math.max(0,Number(x.quantity)*Number(x.unit_price)-Number(x.discount||0));const tax=base*Number(x.tax_rate||0)/100;return {...x,taxable_amount:base,cgst_amount:sameState?tax/2:0,sgst_amount:sameState?tax/2:0,igst_amount:sameState?0:tax,line_total:base+tax}});
  const taxable=rows.reduce((s:any,x:any)=>s+x.taxable_amount,0),cgst=rows.reduce((s:any,x:any)=>s+x.cgst_amount,0),sgst=rows.reduce((s:any,x:any)=>s+x.sgst_amount,0),igst=rows.reduce((s:any,x:any)=>s+x.igst_amount,0),total=taxable+cgst+sgst+igst;
  const {data:inv,error:e}=await supabase.from('invoices').insert({invoice_number:number,order_id:selected.id,school_id:selected.school_id,invoice_date:new Date().toISOString().slice(0,10),seller_name:seller.trim()||'Guru Kalyanam',seller_gstin:gstin.trim()||null,seller_address:sellerAddress.trim()||null,seller_state:sellerState,seller_state_code:sellerCode,buyer_name:buyer.name||'School',buyer_address:buyer.address||null,buyer_state:buyer.state||null,subtotal:selected.subtotal,discount:selected.discount,taxable_amount:taxable,cgst_amount:cgst,sgst_amount:sgst,igst_amount:igst,total,status:'ISSUED'}).select().single();
  if(e){setError(e.message);setSaving(false);return}
  const {error:ei}=await supabase.from('invoice_items').insert(rows.map((x:any)=>({invoice_id:inv.id,product_id:x.product_id,description:x.product_name,quantity:x.quantity,unit:x.unit,unit_price:x.unit_price,discount:x.discount||0,taxable_amount:x.taxable_amount,tax_rate:x.tax_rate||0,cgst_amount:x.cgst_amount,sgst_amount:x.sgst_amount,igst_amount:x.igst_amount,line_total:x.line_total})));
  if(ei){await supabase.from('invoices').delete().eq('id',inv.id);setError(ei.message);setSaving(false);return}
  setOrderId('');await load();setSaving(false);
 };
 const orderOptions=orders.filter(o=>!invoices.some(i=>i.order_id===o.id));
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-4 md:p-8"><div className="max-w-7xl mx-auto">
  <header className="mb-6"><p className="text-sm text-slate-500">Phase 28 · Billing</p><h1 className="text-3xl font-bold">GST Invoices</h1><p className="text-slate-500 mt-1">Create GST-ready invoices from orders with automatic CGST/SGST or IGST calculation and print-ready layouts.</p></header>
  <div className="grid lg:grid-cols-[430px_1fr] gap-5">
   <section className="card p-5 space-y-3"><h2 className="font-bold flex gap-2 items-center"><FileText size={18}/>Create invoice</h2>
    <select className="w-full border rounded-xl px-3 py-3" value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">Select an uninvoiced order…</option>{orderOptions.map(o=><option key={o.id} value={o.id}>Order #{o.order_number} · {o.school?.name||'School'} · {money(o.total)}</option>)}</select>
    <input className="w-full border rounded-xl px-3 py-3" value={seller} onChange={e=>setSeller(e.target.value)} placeholder="Seller / business name"/>
    <input className="w-full border rounded-xl px-3 py-3" value={gstin} onChange={e=>setGstin(e.target.value.toUpperCase())} placeholder="Seller GSTIN (optional)"/>
    <textarea className="w-full border rounded-xl px-3 py-3" value={sellerAddress} onChange={e=>setSellerAddress(e.target.value)} placeholder="Seller address"/>
    <div className="grid grid-cols-2 gap-2"><input className="border rounded-xl px-3 py-3" value={sellerState} onChange={e=>setSellerState(e.target.value)} placeholder="Seller state"/><input className="border rounded-xl px-3 py-3" value={sellerCode} onChange={e=>setSellerCode(e.target.value)} placeholder="State code"/></div>
    {selected&&<div className="rounded-xl bg-slate-50 p-3 text-sm"><b>{selected.school?.name}</b><p>{selected.school?.address||'No address recorded'}</p><p className="mt-2">Order total: <b>{money(selected.total)}</b> · Tax: {money(selected.tax_amount)}</p><p className="text-xs text-slate-500 mt-2">Same-state school → CGST + SGST. Other state → IGST.</p></div>}
    {error&&<p className="text-sm text-red-600">{error}</p>}<button disabled={saving||!orderId} onClick={createInvoice} className="w-full bg-emerald-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold">{saving?'Creating…':'Create GST invoice'}</button>
   </section>
   <section className="card p-4"><div className="flex justify-between items-center mb-4"><div><h2 className="font-bold">Invoice register</h2><p className="text-xs text-slate-500">{invoices.length} invoice{invoices.length===1?'':'s'}</p></div><button onClick={load} className="border rounded-xl p-2" title="Refresh"><RefreshCw size={16}/></button></div>
    {loading?<p className="py-10 text-center text-slate-500">Loading…</p>:invoices.length===0?<p className="py-10 text-center text-slate-500">No invoices yet.</p>:<div className="space-y-2">{invoices.map(i=><Link key={i.id} href={'/invoices/'+i.id} className="block border rounded-xl p-4 hover:bg-slate-50"><div className="flex justify-between gap-3"><div><b>Invoice #{i.invoice_number}</b><p className="text-sm text-slate-600">{i.school?.name||'School'} · {i.invoice_date}</p></div><div className="text-right"><span className="text-xs rounded-full border px-2 py-1">{i.status}</span><p className="font-semibold mt-2">{money(i.total)}</p></div></div></Link>)}</div>}
   </section>
  </div>
 </div></main></div>
}
