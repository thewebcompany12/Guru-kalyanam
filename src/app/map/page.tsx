'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

export default function MapPage(){
 const searchParams=useSearchParams(); const requestedSchool=searchParams.get('school');
 const [schools,setSchools]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{createClient().from('schools').select('id,name,address,district,latitude,longitude,status').not('latitude','is',null).not('longitude','is',null).order('name').then(({data})=>{const rows=data||[];setSchools(rows);setSelected(rows.find((x:any)=>x.id===requestedSchool)||rows[0]||null);setLoading(false)})},[requestedSchool]);
 const bbox=useMemo(()=>selected?(selected.longitude-0.005)+','+(selected.latitude-0.005)+','+(selected.longitude+0.005)+','+(selected.latitude+0.005):null,[selected]);
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-6xl mx-auto animate-fade-up"><header className="mb-6"><p className="text-sm text-slate-500">Field map</p><h1 className="text-3xl font-bold">School map</h1><p className="text-slate-500 mt-1">Tap a school to jump to its saved location.</p></header>
 {loading?<div className="card p-8">Loading map…</div>:schools.length===0?<div className="empty-panel"><LocateFixed className="mx-auto mb-3 text-slate-400"/><p>No school locations captured yet.</p><Link href="/schools" className="text-emerald-700 inline-block mt-2">Capture a school location</Link></div>:
 <div className="grid lg:grid-cols-[340px_1fr] gap-5"><section className="card p-3 max-h-[70vh] overflow-auto">{schools.map(s=><button key={s.id} onClick={()=>setSelected(s)} className={'w-full text-left rounded-xl p-3 mb-1 transition '+(selected?.id===s.id?'bg-emerald-50 text-emerald-900':'hover:bg-slate-50')}><div className="flex gap-3"><MapPin size={18} className="text-emerald-600 mt-0.5"/><div><b className="text-sm">{s.name}</b><p className="text-xs text-slate-500">{s.district||'District not set'}</p></div></div></button>)}</section>
 <section className="card overflow-hidden"><div className="p-4 border-b flex flex-wrap gap-3 justify-between items-center"><div><h2 className="font-bold">{selected.name}</h2><p className="text-sm text-slate-500">{selected.address||'No address'}</p></div><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps?q='+selected.latitude+','+selected.longitude} className="rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold flex items-center gap-2"><Navigation size={15}/>Open maps</a></div><iframe title="Selected school map" className="w-full h-[60vh] min-h-[400px]" src={'https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&layer=mapnik&marker='+selected.latitude+','+selected.longitude}/></section></div>}
 </div></main></div>;
}
