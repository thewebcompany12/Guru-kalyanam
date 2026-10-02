'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import AppNav from '@/components/AppNav';
import { Users, Search, Plus, Phone, MessageCircle, RefreshCw, X } from 'lucide-react';

type School={id:string;name:string};
type Contact={id:string;school_id:string;name:string;phone:string|null;whatsapp_number:string|null;schools?:{name:string}|null};

export default function ContactsPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [schools,setSchools]=useState<School[]>([]);
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [showForm,setShowForm]=useState(false);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState({school_id:'',name:'',phone:'',whatsapp_number:''});
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  const [cr,sr]=await Promise.all([
   supabase.from('school_contacts').select('id,school_id,name,phone,whatsapp_number,schools(name)').order('name'),
   supabase.from('schools').select('id,name').order('name')
  ]);
  if(cr.error||sr.error)setError(cr.error?.message||sr.error?.message||'Could not load contacts.');
  const rows=(cr.data||[]) as unknown as Array<Contact & {schools:{name:string}[]|{name:string}|null}>;
  setContacts(rows.map(x=>({...x,schools:Array.isArray(x.schools)?(x.schools[0]||null):x.schools})));
  setSchools((sr.data||[]) as School[]);setLoading(false);
 },[supabase]);
 useEffect(()=>{void load()},[load]);
 const filtered=contacts.filter(c=>(c.name+' '+(c.schools?.name||'')+' '+(c.phone||'')+' '+(c.whatsapp_number||'')).toLowerCase().includes(query.toLowerCase()));
 const save=async()=>{
  if(!form.school_id||!form.name.trim()){setError('Choose a school and enter the contact name.');return}
  setSaving(true);setError('');
  const result=await supabase.from('school_contacts').insert({school_id:form.school_id,name:form.name.trim(),phone:form.phone.trim()||null,whatsapp_number:form.whatsapp_number.trim()||form.phone.trim()||null,email:form.email.trim()||null});
  if(result.error)setError(result.error.message);
  else{setForm({school_id:'',name:'',phone:'',whatsapp_number:''});setShowForm(false);await load()}
  setSaving(false);
 };
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="app-main flex-1 min-w-0 p-4 md:p-8 space-y-5 w-full">
  <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Users size={14}/> SCHOOL DIRECTORY</div><h1 className="mt-3 text-2xl md:text-3xl font-extrabold">Contacts</h1><p className="mt-1 text-sm text-slate-500">Keep school decision-makers and WhatsApp details in one place.</p></div><button onClick={()=>setShowForm(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/20">{showForm?<X size={17}/>:<Plus size={17}/>} {showForm?'Close':'Add contact'}</button></header>
  {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
  {showForm&&<section className="card p-4 md:p-5 space-y-3"><h2 className="font-bold">New school contact</h2><div className="grid sm:grid-cols-2 gap-3"><select value={form.school_id} onChange={e=>setForm({...form,school_id:e.target.value})}><option value="">Choose school *</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Contact name *"/><input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone number"/><input inputMode="tel" value={form.whatsapp_number} onChange={e=>setForm({...form,whatsapp_number:e.target.value})} placeholder="WhatsApp number (optional)"/></div><button disabled={saving} onClick={()=>void save()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?'Saving…':'Save contact'}</button></section>}
  <section className="card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">School contact directory</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} contact{filtered.length===1?'':'s'}</p></div><button onClick={()=>void load()} disabled={loading} aria-label="Refresh contacts" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><RefreshCw size={15}/>Refresh</button></div><label className="mt-4 flex items-center gap-2 rounded-xl border bg-white px-3"><Search size={17} className="text-slate-400"/><input className="w-full border-0 shadow-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search contacts, schools or phone numbers…"/></label>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(c=><article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Users size={20}/></span><div className="min-w-0 flex-1"><h3 className="font-bold break-words">{c.name}</h3><p className="mt-1 text-xs text-slate-500">{c.schools?.name||'School not linked'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{(c.phone||c.whatsapp_number)&&<a className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold" href={'tel:'+ (c.phone||c.whatsapp_number)}><Phone size={14}/>Call</a>}{(c.whatsapp_number||c.phone)&&<a className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" target="_blank" rel="noreferrer" href={'https://wa.me/'+(c.whatsapp_number||c.phone||'').replace(/[^0-9]/g,'')}><MessageCircle size={14}/>WhatsApp</a>}</div></article>)}
   {!loading&&!filtered.length&&<div className="empty-panel col-span-full p-8 text-center"><Users size={28} className="mx-auto text-slate-400"/><h3 className="mt-3 font-bold">{query?'No matching contacts':'No contacts added yet'}</h3><p className="mt-1 text-sm text-slate-500">{query?'Try another name, school or number.':'Add a school contact to make calling and WhatsApp messaging easier.'}</p></div>}
   {loading&&<p className="col-span-full py-8 text-center text-sm text-slate-500">Loading contacts…</p>}
   </div>
  </section>
 </main></div>
}
