'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import { Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const money=(n:any)=>'₹'+Number(n||0).toFixed(2);
export default function InvoiceDetailPage(){
 const {id}=useParams<{id:string}>();const supabase=createClient();const [invoice,setInvoice]=useState<any>(null),[items,setItems]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{(async()=>{const [i,x]=await Promise.all([supabase.from('invoices').select('*,school:schools(name,address,state),order:orders(order_number)').eq('id',id).single(),supabase.from('invoice_items').select('*').eq('invoice_id',id).order('created_at')]);if(i.error){setError(i.error.message);return}setInvoice(i.data);setItems(x.data||[])})()},[id]);
 if(!invoice)return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-6"><div className="card p-8">{error||'Loading…'}</div></main></div>;
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-4 md:p-8"><div className="max-w-4xl mx-auto">
  <div className="no-print flex justify-between items-center mb-5"><Link href="/invoices" className="text-sm text-emerald-700">← Invoices</Link><button onClick={()=>window.print()} className="bg-slate-900 text-white rounded-xl px-4 py-2 flex gap-2 items-center"><Printer size={16}/>Print / Save PDF</button></div>
  <article className="bg-white shadow-sm border rounded-2xl p-5 md:p-8 print:shadow-none print:border-0 print:rounded-none">
   <div className="flex justify-between gap-5 border-b pb-5"><div><h1 className="text-2xl font-black">{invoice.seller_name}</h1><p className="text-sm whitespace-pre-line">{invoice.seller_address}</p>{invoice.seller_gstin&&<p className="text-sm mt-1"><b>GSTIN:</b> {invoice.seller_gstin}</p>}<p className="text-sm">{invoice.seller_state} ({invoice.seller_state_code})</p></div><div className="text-right"><h2 className="text-xl font-bold">TAX INVOICE</h2><p className="text-sm">Invoice #{invoice.invoice_number}</p><p className="text-sm">Date: {invoice.invoice_date}</p><p className="text-sm">Order #{invoice.order?.order_number||'—'}</p></div></div>
   <div className="grid md:grid-cols-2 gap-4 py-5 border-b"><div><p className="text-xs text-slate-500 uppercase">Bill To</p><b>{invoice.buyer_name}</b><p className="text-sm whitespace-pre-line">{invoice.buyer_address}</p>{invoice.buyer_gstin&&<p className="text-sm">GSTIN: {invoice.buyer_gstin}</p>}<p className="text-sm">{invoice.buyer_state} ({invoice.buyer_state_code})</p></div><div className="text-sm"><p><b>Place of supply:</b> {invoice.buyer_state||'—'}</p><p><b>Tax type:</b> {Number(invoice.igst_amount)>0?'IGST':'CGST + SGST'}</p></div></div>
   <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-3">Description</th><th className="text-right py-3">Qty</th><th className="text-right py-3">Rate</th><th className="text-right py-3">Tax %</th><th className="text-right py-3">Taxable</th><th className="text-right py-3">Total</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-b"><td className="py-3">{x.description}</td><td className="text-right">{x.quantity} {x.unit}</td><td className="text-right">{money(x.unit_price)}</td><td className="text-right">{x.tax_rate}%</td><td className="text-right">{money(x.taxable_amount)}</td><td className="text-right font-medium">{money(x.line_total)}</td></tr>)}</tbody></table></div>
   <div className="ml-auto max-w-sm pt-5 space-y-2 text-sm"><div className="flex justify-between"><span>Taxable amount</span><b>{money(invoice.taxable_amount)}</b></div><div className="flex justify-between"><span>CGST</span><b>{money(invoice.cgst_amount)}</b></div><div className="flex justify-between"><span>SGST</span><b>{money(invoice.sgst_amount)}</b></div><div className="flex justify-between"><span>IGST</span><b>{money(invoice.igst_amount)}</b></div><div className="border-t pt-3 flex justify-between text-lg"><span>Total</span><b>{money(invoice.total)}</b></div></div>
   <p className="text-xs text-slate-500 border-t mt-6 pt-4">Generated from Guru Kalyanam order records. Verify GST registration and invoice particulars before statutory filing.</p>
  </article>
 </div></main></div>
}
