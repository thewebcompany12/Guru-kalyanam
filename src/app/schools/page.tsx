'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LocateFixed, Plus, Search, School as SchoolIcon, Trash2, Pencil, MapPin, Navigation, Sparkles } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

const empty={name:'',udise_code:'',address:'',district:'',state:'Uttar Pradesh',school_type:'OTHER',principal_name:'',latitude:'',longitude:''};

export default function SchoolsPage(){
 const [schools,setSchools]=useState<any[]>([]),[form,setForm]=useState<any>(empty),[editing,setEditing]=useState<string|null>(null);
 const [search,setSearch]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const client=createClient();
 const load=async()=>{setLoading(true);const r=await client.from('schools').select('*').order('name');if(r.error)setError(r.error.message);else setSchools(r.data||[]);setLoading(false)};
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>schools.filter(s=>[s.name,s.udise_code,s.district,s.address].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())),[schools,search]);
 const locate=()=>navigator.geolocation?.getCurrentPosition(p=>setForm((f:any)=>({...f,latitude:p.coords.latitude.toFixed(7),longitude:p.coords.longitude.toFixed(7)})),e=>setError(e.message),{enableHighAccuracy:true});
 const save=async(e:any)=>{e.preventDefault();setSaving(true);setError('');
   const payload={name:form.name.trim(),udise_code:form.udise_code||null,address:form.address||null,district:form.district||null,state:form.state||null,school_type:form.school_type,principal_name:form.principal_name||null,latitude:form.latitude?Number(form.latitude):null,longitude:form.longitude?Number(form.longitude):null};
   const r=editing?await client.from('schools').update(payload).eq('id',editing):await client.from('schools').insert(payload);
   if(r.error)setError(r.error.message);else{setForm(empty);setEditing(null);await load()}setSaving(false);
 };
 const remove=async(id:string)=>{if(!confirm('Delete this school and its related records?'))return;const r=await client.from('schools').delete().eq('id',id);if(r.error)setError(r.error.message);else load()};
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-6xl mx-auto animate-fade-up">
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><div><p className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><Sparkles size={14}/>Field operations</p><h1 className="text-3xl font-bold">Schools</h1><p className="text-sm text-slate-500 mt-1">Save a school once, then open its saved location with one tap.</p></div><button onClick={()=>{setForm(empty);setEditing(null)}} className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-500 text-white px-4 py-3 font-semibold flex items-center gap-2 shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5"><Plus size={18}/>Add school</button></div>
  {error&&<p className="mb-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm animate-fade-up">{error}</p>}
  <div className="grid lg:grid-cols-[360px_1fr] gap-5">
   <form onSubmit={save} className="card p-5 h-fit space-y-3 animate-fade-up"><h2 className="font-bold flex items-center gap-2"><span className="section-icon bg-emerald-100 text-emerald-700"><SchoolIcon size={16}/></span>{editing?'Edit school':'New school'}</h2>
    {['name','udise_code','principal_name','district','state','address'].map(k=><label key={k} className="block text-sm font-medium capitalize">{k.replace('_',' ')}{k==='name'&&<span className="text-red-500"> *</span>}<input required={k==='name'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5 transition focus:border-emerald-400"/></label>)}
    <label className="block text-sm font-medium">School type<select value={form.school_type} onChange={e=>setForm({...form,school_type:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5"><option>PRIMARY</option><option>UPPER_PRIMARY</option><option>SECONDARY</option><option>SENIOR_SECONDARY</option><option>OTHER</option></select></label>
    <div className="grid grid-cols-2 gap-2"><input placeholder="Latitude" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})} className="rounded-xl border px-3 py-2.5"/><input placeholder="Longitude" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})} className="rounded-xl border px-3 py-2.5"/></div>
    <button type="button" onClick={locate} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 py-2.5 flex justify-center gap-2 items-center transition hover:-translate-y-0.5"><LocateFixed size={17}/>Use current location</button>
    <p className="text-xs text-slate-500">GPS coordinates are saved with the school when you tap Save school.</p>
    <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-slate-900 text-white py-2.5 transition hover:-translate-y-0.5">{saving?'Saving…':editing?'Update':'Save school'}</button>{editing&&<button type="button" onClick={()=>{setForm(empty);setEditing(null)}} className="rounded-xl border px-4">Cancel</button>}</div>
   </form>
   <section><div className="card p-3 mb-4 flex items-center gap-2 animate-fade-up"><Search size={18} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search schools, UDISE, district…" className="w-full outline-none"/></div>
    {loading?<div className="card p-8 text-center text-slate-500">Loading schools…</div>:filtered.length===0?<div className="empty-panel animate-fade-up"><SchoolIcon className="mb-3 text-slate-400"/><p>No schools found.</p><p className="text-xs mt-1">Add your first school and save its GPS location.</p></div>:
    <div className="space-y-3">{filtered.map((s,i)=><article key={s.id} className="card p-4 animate-fade-up" style={{animationDelay:i*45+'ms'}}>
      <div className="flex gap-3 justify-between"><div className="min-w-0"><Link href={'/schools/'+s.id} className="font-bold hover:text-emerald-700">{s.name}</Link><p className="text-sm text-slate-500 mt-1">{[s.district,s.school_type,s.udise_code].filter(Boolean).join(' · ')}</p>{s.address&&<p className="text-sm mt-2 text-slate-600">{s.address}</p>}</div>
      <div className="flex gap-1 shrink-0"><button aria-label="Edit school" onClick={()=>{setEditing(s.id);setForm({...s,latitude:s.latitude??'',longitude:s.longitude??''})}} className="p-2 rounded-lg hover:bg-slate-100"><Pencil size={17}/></button><button aria-label="Delete school" onClick={()=>remove(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={17}/></button></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2">{s.latitude&&s.longitude?<><a target="_blank" rel="noreferrer" href={'https://www.google.com/maps?q='+s.latitude+','+s.longitude} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5"><Navigation size={15}/>Open location</a><Link href={'/map?school='+s.id} className="rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800 px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition hover:-translate-y-0.5"><MapPin size={15}/>View map</Link></>:<span className="col-span-2 text-xs rounded-xl bg-amber-50 text-amber-700 px-3 py-2.5">Location not captured — use “Use current location” while editing.</span>}</div>
    </article>)}</div>}
   </section>
  </div>
 </div></main></div>;
}
