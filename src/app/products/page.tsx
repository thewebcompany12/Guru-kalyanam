'use client';

import { FormEvent, useEffect, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type Product = { id:string; category_id:string|null; name:string; sku:string|null; unit:string; purchase_price:number; selling_price:number; tax_rate:number; current_stock:number; minimum_stock:number; active:boolean; notes:string|null };
type Category = { id:string; name:string };

const empty = { name:'', sku:'', unit:'piece', purchase_price:'0', selling_price:'0', tax_rate:'0', minimum_stock:'0', category_id:'', notes:'', active:true };

export default function ProductsPage(){
  const supabase=createClient();
  const [products,setProducts]=useState<Product[]>([]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{ setLoading(true); const [p,c]=await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('product_categories').select('id,name').order('name')
  ]); setProducts((p.data||[]) as Product[]); setCategories((c.data||[]) as Category[]); setLoading(false); };
  useEffect(()=>{load()},[]);
  const submit=async(e:FormEvent)=>{e.preventDefault();setError('');
    const payload={name:form.name.trim(),sku:form.sku.trim()||null,unit:form.unit.trim()||'piece',purchase_price:Number(form.purchase_price),selling_price:Number(form.selling_price),tax_rate:Number(form.tax_rate),minimum_stock:Number(form.minimum_stock),category_id:form.category_id||null,notes:form.notes.trim()||null,active:form.active};
    if(!payload.name||payload.purchase_price<0||payload.selling_price<0||payload.tax_rate<0||payload.minimum_stock<0){setError('Enter a product name and valid non-negative prices, tax, and minimum stock.');return;}
    const q=editing?supabase.from('products').update(payload).eq('id',editing):supabase.from('products').insert(payload);
    const {error:e2}=await q; if(e2){setError(e2.message);return;} setForm(empty);setEditing(null);await load();
  };
  const edit=(p:Product)=>setForm({name:p.name,sku:p.sku||'',unit:p.unit,purchase_price:String(p.purchase_price),selling_price:String(p.selling_price),tax_rate:String(p.tax_rate),minimum_stock:String(p.minimum_stock),category_id:p.category_id||'',notes:p.notes||'',active:p.active});
  const remove=async(id:string)=>{if(!confirm('Delete this product?'))return;const {error:e}=await supabase.from('products').delete().eq('id',id);if(e)setError(e.message);else await load();};
  const visible=products.filter(p=>(p.name+' '+(p.sku||'')).toLowerCase().includes(search.toLowerCase()));
  return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-4 md:p-8"><div className="max-w-6xl mx-auto">
    <header className="mb-6"><p className="text-sm text-slate-500">Phase 3 · Catalog</p><h1 className="text-3xl font-bold">Products</h1><p className="text-slate-500 mt-1">Manage the school-supply catalog used in orders and templates.</p></header>
    <div className="grid xl:grid-cols-[360px_1fr] gap-5">
      <form onSubmit={submit} className="card p-5 space-y-3"><h2 className="font-bold">{editing?'Edit product':'New product'}</h2>
        {['name','sku','unit','purchase_price','selling_price','tax_rate','minimum_stock','notes'].map(k=><label key={k} className="block text-sm"><span className="text-slate-600 capitalize">{k.replace('_',' ')}</span><input className="w-full mt-1 border rounded-xl px-3 py-2" type={k.includes('price')||k==='tax_rate'||k==='minimum_stock'?'number':'text'} step="0.01" value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={k==='name'}/></label>)}
        <label className="block text-sm"><span className="text-slate-600">Category</span><select className="w-full mt-1 border rounded-xl px-3 py-2" value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
        {error&&<p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2"><button className="bg-emerald-600 text-white rounded-xl px-4 py-2 font-semibold">{editing?'Save changes':'Add product'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(empty)}} className="border rounded-xl px-4 py-2">Cancel</button>}</div>
      </form>
      <section className="card p-4"><div className="flex gap-3 mb-4"><input className="flex-1 border rounded-xl px-3 py-2" placeholder="Search products or SKU" value={search} onChange={e=>setSearch(e.target.value)}/><span className="self-center text-sm text-slate-500">{visible.length}</span></div>
        {loading?<p>Loading…</p>:visible.length===0?<p className="text-slate-500 py-10 text-center">No products found.</p>:<div className="space-y-2">{visible.map(p=><div key={p.id} className="border rounded-xl p-3 flex gap-3 justify-between items-center"><div><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.sku||'No SKU'} · {p.unit} · ₹{Number(p.selling_price).toFixed(2)} · stock {Number(p.current_stock)}</div></div><div className="flex gap-2"><button onClick={()=>{setEditing(p.id);edit(p)}} className="border rounded-lg px-3 py-1.5 text-sm">Edit</button><button onClick={()=>remove(p.id)} className="text-red-600 border rounded-lg px-3 py-1.5 text-sm">Delete</button></div></div>)}</div>}
      </section>
    </div>
  </div></main></div>;
}