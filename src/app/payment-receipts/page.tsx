'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { Printer, Search, ReceiptText, RefreshCw, Share2 } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

type School={id:string;name:string;address?:string|null;udise_code?:string|null};
type Order={id:string;order_number:number;school_id:string;total:number};
type Payment={id:string;school_id:string;order_id:string|null;amount:number;payment_date:string;payment_mode:string;reference_number:string|null;notes:string|null;created_at?:string};
const money=(v:number)=>'₹'+Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateLabel=(v:string)=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})};

export default function PaymentReceiptsPage(){
 const supabase=createClient();
 const [schools,setSchools]=useState<School[]>([]),[orders,setOrders]=useState<Order[]>([]),[payments,setPayments]=useState<Payment[]>([]);
 const [selected,setSelected]=useState<string>(''),[query,setQuery]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{
  setLoading(true);setError('');
  const [s,o,p]=await Promise.all([
   supabase.from('schools').select('id,name,address,udise_code').order('name'),
   supabase.from('orders').select('id,order_number,school_id,total'),
   supabase.from('payments').select('id,school_id,order_id,amount,payment_date,payment_mode,reference_number,notes,created_at').order('payment_date',{ascending:false}).order('created_at',{ascending:false}).limit(500)
  ]);
  const e=s.error||o.error||p.error;
  if(e)setError(e.message);
  setSchools((s.data||[]) as School[]);setOrders((o.data||[]) as Order[]);setPayments((p.data||[]) as Payment[]);
  if(!selected&&p.data?.length)setSelected(p.data[0].id);
  setLoading(false);
 };
 useEffect(()=>{void load()},[]);
 const schoolById=useMemo(()=>new Map(schools.map(s=>[s.id,s])),[schools]);
 const orderById=useMemo(()=>new Map(orders.map(o=>[o.id,o])),[orders]);
 const visible=useMemo(()=>payments.filter(p=>{
  const q=query.trim().toLowerCase(),s=schoolById.get(p.school_id),o=p.order_id?orderById.get(p.order_id):undefined;
  return (!q||s?.name.toLowerCase().includes(q)||(p.reference_number||'').toLowerCase().includes(q)||(p.notes||'').toLowerCase().includes(q)||(o?String(o.order_number):'').includes(q))
   &&(!start||p.payment_date>=start)&&(!end||p.payment_date<=end);
 }),[payments,query,start,end,schoolById,orderById]);
 const chosen=payments.find(p=>p.id===selected)||visible[0]||null;
 const chosenSchool=chosen?schoolById.get(chosen.school_id):undefined;
 const chosenOrder=chosen?.order_id?orderById.get(chosen.order_id):undefined;
 const printReceipt=()=>{if(!chosen)return;window.print()};
 const shareReceipt=async()=>{
  if(!chosen)return;
  const textBody=['PAYMENT RECEIPT','Guru Kalyanam · School Supply Ops', 'Receipt: '+chosen.id.slice(0,8).toUpperCase(),'School: '+(chosenSchool?.name||'School'), 'Date: '+dateLabel(chosen.payment_date),'Amount received: '+money(Number(chosen.amount)), 'Payment mode: '+chosen.payment_mode, chosenOrder?'Order: #'+chosenOrder.order_number:'', chosen.reference_number?'Reference: '+chosen.reference_number:'',chosen.notes?'Notes: '+chosen.notes:''].filter(Boolean).join('\n');
  try{
   if(navigator.share)await navigator.share({title:'Payment receipt',text:textBody});
   else if(navigator.clipboard){await navigator.clipboard.writeText(textBody);window.alert('Receipt details copied. You can paste them into WhatsApp.')}
   else window.print();
  }catch(e){if(e instanceof Error&&e.name!=='AbortError')setError('Could not open sharing. Use Print / Save PDF instead.')}
 };
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-5">
  <header className="no-print"><p className="text-sm text-slate-500">Phase 47 · Collections</p><h1 className="text-2xl md:text-3xl font-bold">Payment receipts</h1><p className="text-slate-500 mt-1">Find a recorded collection, then print or share its receipt. Receipts do not create or change payments.</p></header>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 no-print">
   <div className="card p-4"><p className="text-xs text-slate-500">Payments loaded</p><p className="text-2xl font-bold">{payments.length}</p></div>
   <div className="card p-4"><p className="text-xs text-slate-500">Total received · loaded records</p><p className="text-xl font-bold text-emerald-700">{money(payments.reduce((n,p)=>n+Number(p.amount||0),0))}</p></div>
   <div className="card p-4 col-span-2 md:col-span-1"><p className="text-xs text-slate-500">Selected receipt</p><p className="text-xl font-bold">{chosen?chosen.id.slice(0,8).toUpperCase():'—'}</p></div>
  </div>
  <div className="grid lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
   <section className="card p-4 space-y-3 no-print">
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Recorded payments</h2><button onClick={()=>void load()} className="border rounded-xl px-3 py-2 text-sm inline-flex items-center gap-2"><RefreshCw size={15}/> Refresh</button></div>
    <label className="relative block"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input className="w-full border rounded-xl pl-9 pr-3 py-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school, order or reference"/></label>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">From<input type="date" className="block w-full border rounded-xl px-2 py-2 mt-1 text-sm" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="text-xs text-slate-500">To<input type="date" className="block w-full border rounded-xl px-2 py-2 mt-1 text-sm" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
    {error&&<p role="alert" className="text-sm text-red-600 break-words">{error}</p>}
    {loading?<p className="py-8 text-center text-slate-500">Loading payments…</p>:visible.length===0?<p className="py-8 text-center text-slate-500">No payments match these filters.</p>:<div className="space-y-2 max-h-[58vh] overflow-y-auto">{visible.map(p=>{const active=p.id===chosen?.id;return <button type="button" key={p.id} onClick={()=>setSelected(p.id)} className={'w-full text-left rounded-2xl border p-3 transition '+(active?'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200':'border-slate-200 bg-white hover:bg-slate-50')}><span className="flex justify-between gap-3"><span className="min-w-0"><b className="block truncate text-sm">{schoolById.get(p.school_id)?.name||'School'}</b><span className="block text-xs text-slate-500 mt-1">{dateLabel(p.payment_date)} · {p.payment_mode}</span></span><b className="shrink-0 text-emerald-700">{money(Number(p.amount))}</b></span><span className="block text-[11px] text-slate-400 mt-2">Receipt {p.id.slice(0,8).toUpperCase()}</span></button>})}</div>}
    <p className="text-xs text-slate-400">Showing up to 500 recent records. Date filters use payment date.</p>
   </section>
   <section className="space-y-3">
    {chosen?<><div className="flex flex-wrap gap-2 no-print"><button onClick={printReceipt} className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold px-4 py-3 inline-flex justify-center items-center gap-2"><Printer size={17}/> Print / Save PDF</button><button onClick={()=>void shareReceipt()} className="rounded-xl border bg-white px-4 py-3 inline-flex justify-center items-center gap-2"><Share2 size={17}/> Share</button></div>
    <article className="receipt-paper card p-5 md:p-8" aria-label="Payment receipt">
     <div className="flex justify-between items-start gap-3 border-b-2 border-slate-800 pb-4"><div><p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-bold">Payment receipt</p><h2 className="text-xl md:text-2xl font-extrabold mt-1">Guru Kalyanam</h2><p className="text-sm text-slate-500">School Supply Ops</p></div><div className="text-right"><ReceiptText size={28} className="ml-auto text-emerald-700"/><p className="text-xs text-slate-500 mt-2">Receipt no.</p><p className="font-bold tracking-wider">{chosen.id.slice(0,8).toUpperCase()}</p></div></div>
     <div className="py-5 border-b border-dashed border-slate-300"><p className="text-xs text-slate-500">Received from</p><h3 className="text-lg font-bold mt-1 break-words">{chosenSchool?.name||'School'}</h3>{chosenSchool?.address&&<p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{chosenSchool.address}</p>}{chosenSchool?.udise_code&&<p className="text-xs text-slate-500 mt-1">UDISE code: {chosenSchool.udise_code}</p>}</div>
     <div className="py-5 grid grid-cols-2 gap-4 border-b border-dashed border-slate-300"><div><p className="text-xs text-slate-500">Payment date</p><p className="font-semibold mt-1">{dateLabel(chosen.payment_date)}</p></div><div><p className="text-xs text-slate-500">Payment method</p><p className="font-semibold mt-1">{chosen.payment_mode.replaceAll('_',' ')}</p></div>{chosenOrder&&<div><p className="text-xs text-slate-500">Against order</p><p className="font-semibold mt-1">Order #{chosenOrder.order_number}</p></div>}{chosen.reference_number&&<div><p className="text-xs text-slate-500">Reference number</p><p className="font-semibold mt-1 break-all">{chosen.reference_number}</p></div>}</div>
     <div className="py-5"><p className="text-xs text-slate-500">Amount received</p><p className="text-3xl md:text-4xl font-extrabold text-emerald-700 mt-1">{money(Number(chosen.amount))}</p><p className="text-sm text-slate-500 mt-1">Rupees {numberWordsIndian(Number(chosen.amount))} only</p></div>
     {chosen.notes&&<div className="border-t border-slate-200 py-3"><p className="text-xs text-slate-500">Notes</p><p className="text-sm mt-1 whitespace-pre-line break-words">{chosen.notes}</p></div>}
     <div className="mt-6 pt-4 border-t border-slate-300 flex justify-between items-end gap-4"><p className="text-xs text-slate-500 max-w-[65%]">This receipt acknowledges the payment recorded in the system. Keep it for your records.</p><div className="text-center min-w-28"><div className="border-t border-slate-500 pt-2 text-xs">Authorized signature</div></div></div>
     <p className="text-[10px] text-slate-400 mt-5 text-center">Generated from recorded payment data · Receipt ID {chosen.id}</p>
    </article></>:<div className="card p-10 text-center text-slate-500">Select a payment to preview its receipt.</div>}
   </section>
  </div>
 </div></main>
 <style jsx global>{`
 @media print{
  @page{size:A4;margin:14mm}
  body{background:white!important;color:#111827!important}
  .no-print, .app-desktop-nav, .app-mobile-nav, .mobile-bottom-nav, .mobile-menu-panel, .mobile-menu-backdrop{display:none!important}
  main{padding:0!important;margin:0!important;overflow:visible!important}
  main>div{max-width:none!important;margin:0!important}
  main>div>div{display:block!important}
  .receipt-paper{box-shadow:none!important;border:1px solid #d1d5db!important;border-radius:0!important;padding:12mm!important;max-width:none!important;break-inside:avoid}
  .receipt-paper *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 }
 `}</style>
 </div>;
}

function numberWordsIndian(value:number){
 if(!Number.isFinite(value)||value<0)return '—';
 const n=Math.floor(value),paise=Math.round((value-n)*100);
 const words=(x:number):string=>{
  const one=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  if(x<20)return one[x];
  if(x<100)return tens[Math.floor(x/10)]+(x%10?' '+one[x%10]:'');
  if(x<1000)return one[Math.floor(x/100)]+' hundred'+(x%100?' '+words(x%100):'');
  for(const [base,label] of [[10000000,'crore'],[100000,'lakh'],[1000,'thousand']] as [number,string][]){if(x>=base)return words(Math.floor(x/base))+' '+label+(x%base?' '+words(x%base):'')}
  return String(x);
 };
 return words(n)+(paise?' and '+words(paise)+' paise':'');
}
