'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Loader2, Search, School, Package, ClipboardList, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';

type Result={id:string;label:string;meta:string;href:string;kind:'School'|'Product'|'Order'};

export default function GlobalSearch(){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [results,setResults]=useState<Result[]>([]);
  const [error,setError]=useState('');
  const clientRef=useRef(createClient());

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName)){
        event.preventDefault();setOpen(true);requestAnimationFrame(()=>inputRef.current?.focus());
      }
      if(event.key==='Escape'){setOpen(false);inputRef.current?.blur();}
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  useEffect(()=>{
    const q=query.trim().replace(/[,%()]/g,' ').replace(/\s+/g,' ');
    if(q.length<2){setResults([]);setError('');setLoading(false);return;}
    const timer=window.setTimeout(async()=>{
      setLoading(true);setError('');
      const client=clientRef.current;
      const numeric=Number(q);
      const [schools,products,orders]=await Promise.all([
        client.from('schools').select('id,name,district,udise_code').or(`name.ilike.%${q}%,district.ilike.%${q}%,udise_code.ilike.%${q}%`).order('name').limit(6),
        client.from('products').select('id,name,sku,unit').or(`name.ilike.%${q}%,sku.ilike.%${q}%`).order('name').limit(6),
        Number.isInteger(numeric)&&numeric>0?client.from('orders').select('id,order_number,status,school:schools(name)').eq('order_number',numeric).limit(4):Promise.resolve({data:[],error:null})
      ]);
      const firstError=schools.error||products.error||orders.error;
      if(firstError){setError(firstError.message);setResults([]);setLoading(false);return;}
      const next:Result[]=[
        ...((schools.data||[]) as any[]).map(s=>({id:s.id,label:s.name,meta:[s.district,s.udise_code].filter(Boolean).join(' · ')||'School',href:'/schools/'+s.id,kind:'School' as const})),
        ...((products.data||[]) as any[]).map(p=>({id:p.id,label:p.name,meta:[p.sku,p.unit].filter(Boolean).join(' · ')||'Product',href:'/products',kind:'Product' as const})),
        ...((orders.data||[]) as any[]).map(o=>({id:o.id,label:'Order #'+o.order_number,meta:[o.school?.[0]?.name,o.status?.replaceAll('_',' ')].filter(Boolean).join(' · ')||'Order',href:'/orders/'+o.id,kind:'Order' as const}))
      ];
      setResults(next);setLoading(false);
    },220);
    return()=>window.clearTimeout(timer);
  },[query]);

  const go=(result:Result)=>{setOpen(false);setQuery('');router.push(result.href);};
  const Icon=({kind}:{kind:Result['kind']})=>kind==='School'?<School size={17}/>:kind==='Product'?<Package size={17}/>:<ClipboardList size={17}/>;

  return <div className="relative w-full max-w-xl">
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
      <Search size={17} className="shrink-0 text-slate-400"/>
      <input ref={inputRef} value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true)}} placeholder="Search schools, products, orders…" aria-label="Global search" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
      {loading?<Loader2 size={16} className="shrink-0 animate-spin text-emerald-600"/>:query?<button type="button" onClick={()=>setQuery('')} aria-label="Clear search" className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={15}/></button>:<span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"><Command size={10}/> /</span>}
    </div>
    {open&&<><button type="button" aria-label="Close search" className="fixed inset-0 z-30 cursor-default bg-transparent" onClick={()=>setOpen(false)}/><div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {query.trim().length<2?<div className="p-4 text-sm text-slate-500"><b className="block text-slate-700 mb-1">Quick search</b>Type at least 2 characters. Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/</kbd> anytime to focus.</div>:error?<div className="p-4 text-sm text-red-600">{error}</div>:results.length===0&&!loading?<div className="p-5 text-center text-sm text-slate-500">No matching schools, products, or orders.</div>:<div className="max-h-80 overflow-y-auto p-2">{results.map(result=><button type="button" key={result.kind+result.id} onClick={()=>go(result)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon kind={result.kind}/></span><span className="min-w-0"><b className="block truncate text-sm text-slate-800">{result.label}</b><small className="block truncate text-xs text-slate-500">{result.kind} · {result.meta}</small></span>
      </button>)}</div>}
    </div></>}
  </div>;
}
