'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BellRing, CalendarClock, CheckCircle2, Clock3, Plus, School, Search } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

const dateKey=(value:string)=>new Date(value).toISOString().slice(0,10);
const formatDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
const statusFor=(value:string|null)=>{
  if(!value)return 'unscheduled';
  const today=dateKey(new Date().toISOString());
  const key=dateKey(value);
  if(key<today)return 'overdue';
  if(key===today)return 'today';
  return 'upcoming';
};

export default function FollowUpsPage(){
 const client=createClient();
 const [schools,setSchools]=useState<any[]>([]);
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState('');
 const [error,setError]=useState('');

 const load=async()=>{
   setLoading(true); setError('');
   const r=await client.from('schools').select('id,name,district,next_follow_up_at,last_visit_at').eq('status','ACTIVE').order('next_follow_up_at',{ascending:true,nullsFirst:false}).order('name');
   if(r.error)setError(r.error.message);
   setSchools(r.data||[]);
   setLoading(false);
 };
 useEffect(()=>{load()},[]);

 const filtered=useMemo(()=>schools.filter(s=>[s.name,s.district].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())),[schools,search]);
 const groups=useMemo(()=>({
   overdue:filtered.filter(s=>statusFor(s.next_follow_up_at)==='overdue'),
   today:filtered.filter(s=>statusFor(s.next_follow_up_at)==='today'),
   upcoming:filtered.filter(s=>statusFor(s.next_follow_up_at)==='upcoming'),
   unscheduled:filtered.filter(s=>statusFor(s.next_follow_up_at)==='unscheduled')
 }),[filtered]);

 const schedule=async(schoolId:string)=>{
   const current=new Date();
   current.setDate(current.getDate()+7);
   const value=current.toISOString();
   setSaving(schoolId); setError('');
   const r=await client.from('schools').update({next_follow_up_at:value}).eq('id',schoolId);
   if(r.error)setError(r.error.message);
   else await load();
   setSaving('');
 };

 const remind=async(school:any)=>{
   if(!school.next_follow_up_at){await schedule(school.id); return;}
   const due=school.next_follow_up_at;
   setSaving('reminder:'+school.id); setError('');
   const {data:{user}}=await client.auth.getUser();
   const r=await client.from('reminders').insert({
     title:'Follow up: '+school.name,
     description:'School follow-up from the field visit workflow.',
     due_at:due,
     school_id:school.id,
     priority:statusFor(due)==='overdue'?'HIGH':'MEDIUM',
     created_by:user?.id||null
   });
   if(r.error)setError(r.error.message);
   else alert('Reminder created for '+school.name);
   setSaving('');
 };

 const section=(title:string,items:any[],tone:string)=>{
   if(!items.length)return null;
   return <section className="card p-4 md:p-5">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div><h2 className="font-bold flex items-center gap-2"><span className={'section-icon '+tone}><CalendarClock size={16}/></span>{title}</h2><p className="text-xs text-slate-500 mt-1">{items.length} school{items.length===1?'':'s'}</p></div>
    </div>
    <div className="space-y-2">
      {items.map(s=><article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={'/schools/'+s.id} className="font-bold hover:text-emerald-700">{s.name}</Link>
            <p className="text-xs text-slate-500 mt-1">{s.district||'District not set'}{s.last_visit_at&&' · Last visit '+formatDate(s.last_visit_at)}</p>
            {s.next_follow_up_at&&<p className="text-sm font-semibold mt-2">{formatDate(s.next_follow_up_at)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving===s.id} onClick={()=>schedule(s.id)} className="rounded-xl border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Plus size={14}/>{saving===s.id?'Saving…':'+7 days'}</button>
            <button disabled={saving==='reminder:'+s.id} onClick={()=>remind(s)} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><BellRing size={14}/>{saving==='reminder:'+s.id?'Adding…':s.next_follow_up_at?'Reminder':'Schedule'}</button>
            <Link href={'/visits?school='+s.id} className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-semibold">Visit</Link>
          </div>
        </div>
      </article>)}
    </div>
   </section>;
 };

 return <div className="min-h-screen flex bg-slate-50">
  <AppNav/>
  <main className="flex-1 min-w-0 p-4 md:p-8">
   <div className="max-w-6xl mx-auto animate-fade-up">
    <header className="mb-5">
      <p className="text-sm font-semibold text-amber-600 flex items-center gap-1"><Clock3 size={14}/>Phase 12 · Field follow-up</p>
      <h1 className="text-3xl font-bold">Follow-up Planner</h1>
      <p className="text-sm text-slate-500 mt-1">See which schools need attention today, which are overdue, and which are coming next.</p>
    </header>
    {error&&<div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
    <section className="card p-4 mb-5">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-center">
        <label className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search school or district…" className="w-full rounded-xl border px-10 py-3"/></label>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{filtered.length} active schools</div>
      </div>
    </section>
    {loading?<div className="card p-8 text-center text-slate-500">Loading follow-ups…</div>:filtered.length===0?<div className="empty-panel"><School className="mb-3 text-slate-400"/><p>No active schools found.</p></div>:
      <div className="space-y-4">
        {section('Overdue',groups.overdue,'bg-red-100 text-red-700')}
        {section('Today',groups.today,'bg-amber-100 text-amber-700')}
        {section('Upcoming',groups.upcoming,'bg-sky-100 text-sky-700')}
        {section('No follow-up scheduled',groups.unscheduled,'bg-slate-100 text-slate-700')}
        {groups.unscheduled.length>0&&<div className="card p-4 text-sm text-slate-600 flex gap-2 items-start"><CheckCircle2 size={18} className="text-emerald-600 shrink-0"/><span>Use +7 days to schedule a school, or record a visit with “Follow-up needed” and a date.</span></div>}
      </div>}
   </div>
  </main>
 </div>;
}
