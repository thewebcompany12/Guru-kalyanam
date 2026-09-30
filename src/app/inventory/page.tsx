'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { AlertTriangle, Boxes, Filter, History, PackagePlus, RefreshCw, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase';

type Row = { product_id:string; available_stock:number; incoming_stock:number; reserved_stock:number; products?:{name:string;sku:string|null;unit:string|null} };
type Tx = { id:string; product_id:string; quantity:number; transaction_type:string; notes:string|null; created_at:string; products?:{name:string} };
const transactionTypes=['PURCHASE','SALE','ADJUSTMENT','RETURN','DAMAGE','TRANSFER'];

export default function Inventory(){
  const s=createClient();
  const [rows,setRows]=useState<Row[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [tx,setTx]=useState<Tx[]>([]);
  const [pid,setPid]=useState('');
  const [qty,setQty]=useState('');
  const [type,setType]=useState('ADJUSTMENT');
  const [note,setNote]=useState('');
  const [search,setSearch]=useState('');
  const [stockFilter,setStockFilter]=useState('ALL');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  const load=async()=>{
    setLoading(true); setError('');
    const [i,p,t]=await Promise.all([
      s.from('inventory').select('product_id,available_stock,incoming_stock,reserved_stock,products(name,sku,unit)').order('updated_at',{ascending:false}),
      s.from('products').select('id,name,sku,unit').eq('active',true).order('name'),
      s.from('inventory_transactions').select('id,product_id,quantity,transaction_type,notes,created_at,products(name)').order('created_at',{ascending:false}).limit(100),
    ]);
    if(i.error) setError(i.error.message); else setRows((i.data||[]) as unknown as Row[]);
    setProducts(p.data||[]);
    setTx((t.data||[]) as unknown as Tx[]);
    setLoading(false);
  };
  useEffect(()=>{void load()},[]);

  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return rows.filter(r=>{
      const matchesSearch=!q||[r.products?.name,r.products?.sku,r.products?.unit].filter(Boolean).join(' ').toLowerCase().includes(q);
      const available=Number(r.available_stock||0);
      const matchesStock=stockFilter==='ALL'||(stockFilter==='LOW'&&available<=5)||(stockFilter==='OUT'&&available<=0)||(stockFilter==='HEALTHY'&&available>5);
      return matchesSearch&&matchesStock;
    });
  },[rows,search,stockFilter]);

  const stats=useMemo(()=>({
    products:rows.length,
    units:rows.reduce((n,r)=>n+Number(r.available_stock||0),0),
    low:rows.filter(r=>Number(r.available_stock||0)>0&&Number(r.available_stock||0)<=5).length,
    out:rows.filter(r=>Number(r.available_stock||0)<=0).length,
    incoming:rows.reduce((n,r)=>n+Number(r.incoming_stock||0),0),
  }),[rows]);

  const adjust=async()=>{
    const n=Number(qty);
    if(!pid||!Number.isFinite(n)||n===0){setError('Select a product and enter a non-zero quantity.');return}
    setSaving(true);setError('');
    const {data:{user}}=await s.auth.getUser();
    const r=await s.from('inventory_transactions').insert({product_id:pid,quantity:n,transaction_type:type,notes:note.trim()||null,created_by:user?.id});
    if(r.error){setError(r.error.message);setSaving(false);return}
    const rpc=await s.rpc('recalculate_inventory',{p_product_id:pid});
    if(rpc.error){setError(rpc.error.message);setSaving(false);return}
    setQty('');setNote('');setSaving(false);await load();
  };

  return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-5">
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-teal-700 flex items-center gap-2"><Boxes size={15}/> Phase 22 · Stock Control</p><h1 className="text-3xl font-bold">Inventory Control</h1><p className="text-sm text-slate-500 mt-1">Monitor stock, record movements and identify low or out-of-stock products.</p></div>
      <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button>
    </header>
    {error&&<div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        ['Products',stats.products,Boxes,'bg-teal-100 text-teal-700'],
        ['Available units',stats.units,PackagePlus,'bg-blue-100 text-blue-700'],
        ['Low stock',stats.low,TrendingDown,'bg-amber-100 text-amber-700'],
        ['Out of stock',stats.out,AlertTriangle,'bg-red-100 text-red-700'],
        ['Incoming',stats.incoming,TrendingUp,'bg-emerald-100 text-emerald-700'],
      ].map(([label,value,Icon,tone]:any)=><div className="card p-4" key={label as string}><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon size={17}/></span><p className="text-xs text-slate-500 mt-3">{label}</p><b className="text-2xl">{value}</b></div>)}
    </section>
    <section className="card p-4">
      <h2 className="font-bold mb-3">Record stock movement</h2>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <select className="border rounded-xl px-3 py-2.5 text-sm xl:col-span-2" value={pid} onChange={e=>setPid(e.target.value)}><option value="">Select product…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.sku?' · '+p.sku:''}</option>)}</select>
        <select className="border rounded-xl px-3 py-2.5 text-sm" value={type} onChange={e=>setType(e.target.value)}>{transactionTypes.map(x=><option key={x}>{x}</option>)}</select>
        <input className="border rounded-xl px-3 py-2.5 text-sm" type="number" step="any" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Quantity (+ / -)"/>
        <input className="border rounded-xl px-3 py-2.5 text-sm" value={note} onChange={e=>setNote(e.target.value)} placeholder="Notes"/>
      </div>
      <button onClick={()=>void adjust()} disabled={saving} className="mt-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{saving?'Saving…':'Record movement'}</button>
    </section>
    <section className="card p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_180px]">
        <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="w-full border rounded-xl px-9 py-2.5 text-sm" placeholder="Search product or SKU…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <select className="border rounded-xl px-3 py-2.5 text-sm" value={stockFilter} onChange={e=>setStockFilter(e.target.value)}><option value="ALL">All stock</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option><option value="HEALTHY">Healthy stock</option></select>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 my-3"><Filter size={14}/> Showing {visible.length} of {rows.length} products</div>
      {loading?<div className="py-10 text-center text-slate-500">Loading inventory…</div>:!visible.length?<div className="py-10 text-center text-slate-500">No products match the current filters.</div>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(r=><article key={r.product_id} className="border rounded-xl p-4">
        <div className="flex justify-between gap-3"><div><b>{r.products?.name||'Product'}</b><p className="text-xs text-slate-500">{r.products?.sku||'No SKU'} · {r.products?.unit||'unit'}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${Number(r.available_stock)<=0?'bg-red-100 text-red-700':Number(r.available_stock)<=5?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{Number(r.available_stock)<=0?'Out':Number(r.available_stock)<=5?'Low':'In stock'}</span></div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-sm"><div><p className="text-xs text-slate-500">Available</p><b>{r.available_stock}</b></div><div><p className="text-xs text-slate-500">Incoming</p><b>{r.incoming_stock}</b></div><div><p className="text-xs text-slate-500">Reserved</p><b>{r.reserved_stock}</b></div></div>
      </article>)}</div>}
    </section>
    <section className="card p-4"><div className="flex items-center gap-2 mb-3"><History size={17}/><h2 className="font-bold">Recent stock movements</h2></div>
      {!tx.length?<p className="text-sm text-slate-500 py-6 text-center">No stock movements recorded yet.</p>:<div className="space-y-2">{tx.slice(0,30).map(t=><div key={t.id} className="border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2"><div><b className="text-sm">{t.products?.name||'Product'}</b><p className="text-xs text-slate-500">{t.transaction_type} · {t.notes||'No notes'}</p></div><div className="text-right"><b className={Number(t.quantity)>=0?'text-emerald-700':'text-red-700'}>{Number(t.quantity)>=0?'+':''}{t.quantity}</b><p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString('en-IN')}</p></div></div>)}</div>}
    </section>
  </div></main></div>
}