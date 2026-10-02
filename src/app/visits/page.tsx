'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, Clock3, LocateFixed, MapPin, Navigation, Play, Plus, Route, Search, Square, X } from 'lucide-react';
import AppNav from '@/components/AppNav';
import SearchableSelect from '@/components/SearchableSelect';
import { createClient } from '@/lib/supabase';

const emptyForm = {
  purpose: 'GENERAL',
  person_met: '',
  notes: '',
  order_received: false,
  payment_collected: false,
  follow_up_required: false,
  follow_up_date: '',
};

const formatDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
const formatTime=(value:string)=>new Date(value).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});

export default function VisitsPage(){
 const client=createClient();
 const [schools,setSchools]=useState<any[]>([]);
 const [visits,setVisits]=useState<any[]>([]);
 const [schoolId,setSchoolId]=useState('');
 const [filterSchool,setFilterSchool]=useState('');
 const [filterDate,setFilterDate]=useState('');
 const [activeSession,setActiveSession]=useState<any>(null);
 const [active,setActive]=useState<any>(null);
 const [form,setForm]=useState<any>(emptyForm);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');

 const load=async()=>{
   setLoading(true); setError('');
   const [s,v,vs]=await Promise.all([
     client.from('schools').select('id,name').eq('status','ACTIVE').order('name'),
     client.from('school_visits').select('*,schools(name)').order('started_at',{ascending:false}).limit(500),
     client.from('visit_sessions').select('*').order('started_at',{ascending:false}).limit(100)
   ]);
   if(s.error||v.error||vs.error)setError((s.error||v.error||vs.error)?.message||'Unable to load visits');
   setSchools(s.data||[]); setVisits(v.data||[]);
   const sessionRows=vs.data||[];
   const currentSession=sessionRows.find((x:any)=>!x.ended_at)||null;
   setActiveSession(currentSession);
   setActive((v.data||[]).find((x:any)=>!x.ended_at&&x.session_id===currentSession?.id)||null);
   setLoading(false);
 };

 useEffect(()=>{load()},[]);

 const filtered=useMemo(()=>visits.filter(v=>{
   const schoolOk=!filterSchool||v.school_id===filterSchool;
   const dateOk=!filterDate||new Date(v.started_at).toISOString().slice(0,10)===filterDate;
   return schoolOk&&dateOk;
 }),[visits,filterSchool,filterDate]);

 const grouped=useMemo(()=>{
   const map=new Map<string,any[]>();
   filtered.forEach(v=>{
     const key=new Date(v.started_at).toLocaleDateString(undefined,{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
     if(!map.has(key))map.set(key,[]);
     map.get(key)!.push(v);
   });
   return Array.from(map.entries());
 },[filtered]);

 const start=async()=>{
   setSaving(true);setError('');
   const user=(await client.auth.getUser()).data.user;
   const saveSession=async(latitude?:number,longitude?:number)=>{
     const r=await client.from('visit_sessions').insert({
       visited_by:user?.id||null,
       started_at:new Date().toISOString(),
       start_latitude:latitude??null,
       start_longitude:longitude??null
     }).select().single();
     if(r.error){setError(r.error.message);setSaving(false);return}
     setActiveSession(r.data);setSaving(false);await load();
   };
   if(navigator.geolocation){
     navigator.geolocation.getCurrentPosition(
       p=>saveSession(p.coords.latitude,p.coords.longitude),
       ()=>saveSession(),
       {enableHighAccuracy:true,timeout:10000,maximumAge:30000}
     );
   }else saveSession();
 };

 const addSchool=async()=>{
   if(!activeSession){setError('Start today\'s visit first');return}
   if(!schoolId){setError('Choose the school you have reached');return}
   setSaving(true);setError('');
   if(active){
     const previous=await client.from('school_visits').update({ended_at:new Date().toISOString()}).eq('id',active.id);
     if(previous.error){setError(previous.error.message);setSaving(false);return}
   }
   const saveVisit=async(latitude?:number,longitude?:number)=>{
     const now=new Date().toISOString();
     const r=await client.from('school_visits').insert({
       session_id:activeSession.id,
       school_id:schoolId,
       visited_by:(await client.auth.getUser()).data.user?.id||null,
       started_at:now,
       latitude:latitude??null,
       longitude:longitude??null,
       purpose:form.purpose,
       person_met:form.person_met.trim()||null,
       notes:form.notes.trim()||null,
       order_received:form.order_received,
       payment_collected:form.payment_collected,
       follow_up_required:form.follow_up_required
     }).select().single();
     if(r.error){setError(r.error.message);setSaving(false);return}
     const schoolUpdate:any={last_visit_at:now};
     if(form.follow_up_required&&form.follow_up_date)schoolUpdate.next_follow_up_at=new Date(form.follow_up_date+'T09:00:00').toISOString();
     else if(!form.follow_up_required)schoolUpdate.next_follow_up_at=null;
     await client.from('schools').update(schoolUpdate).eq('id',schoolId);
     setSchoolId('');setForm(emptyForm);await load();setSaving(false);
   };
   if(navigator.geolocation){
     navigator.geolocation.getCurrentPosition(
       p=>saveVisit(p.coords.latitude,p.coords.longitude),
       ()=>saveVisit(),
       {enableHighAccuracy:true,timeout:10000,maximumAge:30000}
     );
   }else saveVisit();
 };

 const end=async()=>{
   if(!activeSession)return;
   setSaving(true);setError('');
   const now=new Date().toISOString();
   if(active){
     const visitEnd=await client.from('school_visits').update({ended_at:now}).eq('id',active.id);
     if(visitEnd.error){setError(visitEnd.error.message);setSaving(false);return}
   }
   const r=await client.from('visit_sessions').update({ended_at:now}).eq('id',activeSession.id);
   if(r.error)setError(r.error.message);
   else await load();
   setSaving(false);
 };

 const duration=(v:any)=>{
   if(!v.ended_at)return 'In progress';
   const mins=Math.max(1,Math.round((new Date(v.ended_at).getTime()-new Date(v.started_at).getTime())/60000));
   return mins<60?mins+' min':Math.floor(mins/60)+'h '+mins%60+'m';
 };

 return <div className="min-h-screen flex bg-slate-50">
  <AppNav/>
  <main className="flex-1 min-w-0 p-4 md:p-8">
   <div className="max-w-6xl mx-auto animate-fade-up">
    <header className="mb-5">
      <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><CalendarDays size={14}/>Field visit diary</p>
      <h1 className="text-3xl font-bold">School Visits</h1>
      <p className="text-sm text-slate-500 mt-1">Start one morning route, then add each school when you reach it. Every school gets its own arrival, GPS, notes, and visit details.</p>
    </header>

    {error&&<div className="mb-4 rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

    <section className="card p-4 md:p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div><h2 className="font-bold flex items-center gap-2"><span className="section-icon bg-emerald-100 text-emerald-700"><Route size={16}/></span>Today&apos;s visit route</h2><p className="text-xs text-slate-500 mt-1">{activeSession?'Morning route is running — add schools as you reach them.':'Start the route once in the morning. You do not need to start a new visit for every school.'}</p></div>
        {activeSession&&<span className="text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 px-3 py-1">Route in progress</span>}
      </div>
      {!activeSession ? <button disabled={saving} onClick={start} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-500 text-white px-5 py-3 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"><Play size={17}/>{saving?'Starting…':'Start morning visit route & capture GPS'}</button> : <>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 mb-4 text-sm text-emerald-800 flex items-start gap-2"><Route size={17} className="mt-0.5 shrink-0"/><span>Started at <b>{formatTime(activeSession.started_at)}</b>. {active?'Currently at '+(active.schools?.name||'the selected school')+'. Add the next school when you leave.':'Choose the school you have reached and add it below.'}</span></div>
        <div className="grid md:grid-cols-2 gap-3">
          <SearchableSelect value={schoolId} onChange={setSchoolId} options={schools.map(s=>({value:s.id,label:s.name}))} placeholder="Search school reached…" searchPlaceholder="Type a school name…" />
          <select value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})} className="rounded-xl border px-3 py-3"><option value="GENERAL">General visit</option><option value="SALES">Sales / order</option><option value="DELIVERY">Delivery</option><option value="PAYMENT_COLLECTION">Payment collection</option><option value="FOLLOW_UP">Follow-up</option></select>
          <input value={form.person_met} onChange={e=>setForm({...form,person_met:e.target.value})} placeholder="Person met (e.g. Principal)" className="rounded-xl border px-3 py-3"/>
          <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes: what happened, what was discussed…" className="rounded-xl border px-3 py-3 md:row-span-2"/>
        </div>
        {form.follow_up_required&&<label className="mt-3 block text-sm font-medium">Next follow-up date<input type="date" value={form.follow_up_date} onChange={e=>setForm({...form,follow_up_date:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-3"/><span className="text-xs text-slate-500">Saved on the school and shown in Follow-up Planner.</span></label>}
        <div className="flex flex-wrap gap-2 mt-3">{([['order_received','Order received'],['payment_collected','Payment collected'],['follow_up_required','Follow-up needed']] as const).map(([key,label])=><label key={key} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm"><input type="checkbox" checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})} className="h-4 w-4"/>{label}</label>)}</div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2"><button disabled={saving||!schoolId} onClick={addSchool} className="flex-1 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={17}/>{saving?'Saving…':'Add reached school'}</button><button disabled={saving} onClick={end} className="sm:w-48 rounded-xl bg-amber-600 text-white px-5 py-3 font-semibold flex items-center justify-center gap-2"><Square size={17}/>{saving?'Saving…':'End morning route'}</button></div>
        <p className="text-xs text-slate-500 mt-3 flex gap-1 items-center"><LocateFixed size={13}/>GPS is captured when available for the route start and each school arrival. If location permission is denied, the visit is still saved.</p>
      </>}
    </section>

    <section className="card p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 className="font-bold">Visit history</h2><p className="text-xs text-slate-500 mt-1">{filtered.length} school visit{filtered.length===1?'':'s'} shown · each route can contain multiple schools</p></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <SearchableSelect value={filterSchool} onChange={setFilterSchool} options={[{value:'',label:'All schools'},...schools.map(s=>({value:s.id,label:s.name}))]} placeholder="All schools" searchPlaceholder="Search schools…" />
          <label className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="rounded-xl border pl-9 pr-3 py-2.5 text-sm"/></label>
          {(filterSchool||filterDate)&&<button onClick={()=>{setFilterSchool('');setFilterDate('')}} className="rounded-xl border px-3 py-2.5 text-sm flex items-center justify-center gap-1"><X size={15}/>Clear</button>}
        </div>
      </div>

      {loading?<p className="py-8 text-center text-slate-500">Loading visits…</p>:grouped.length===0?
        <div className="empty-panel"><CheckCircle2 className="mb-3 text-slate-400"/><p>No visits found.</p><p className="text-xs mt-1">Choose a school above and start your first visit.</p></div>:
        <div className="space-y-5">
          {grouped.map(([day,items])=><div key={day}>
            <div className="sticky top-[70px] z-10 mb-2 rounded-xl bg-slate-100/95 px-3 py-2 text-xs font-bold text-slate-600">{day}</div>
            <div className="space-y-2">
              {items.map(v=><article key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={'/schools/'+v.school_id} className="font-bold text-slate-900 hover:text-emerald-700">{v.schools?.name||'School'}</Link>
                    <p className="text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"><Clock3 size={13}/>{formatTime(v.started_at)}{v.ended_at&&' → '+formatTime(v.ended_at)}<span>·</span>{duration(v)}</p>
                    <p className="text-xs text-slate-500 mt-2">{v.purpose.replaceAll('_',' ')}{v.person_met&&' · '+v.person_met}</p>
                    {v.notes&&<p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{v.notes}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {v.order_received&&<span className="rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-xs font-semibold">Order received</span>}
                      {v.payment_collected&&<span className="rounded-full bg-pink-50 text-pink-700 px-2.5 py-1 text-xs font-semibold">Payment collected</span>}
                      {v.follow_up_required&&<span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-semibold">Follow-up</span>}
                    </div>
                    {v.latitude&&v.longitude&&<a target="_blank" rel="noreferrer" href={'https://www.google.com/maps?q='+v.latitude+','+v.longitude} className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-cyan-700"><MapPin size={13}/>Open visit location</a>}
                  </div>
                  <span className={'text-xs rounded-full px-2.5 py-1 h-fit whitespace-nowrap '+(v.ended_at?'bg-slate-100 text-slate-600':'bg-emerald-50 text-emerald-700')}>{v.ended_at?'Completed':'Active'}</span>
                </div>
              </article>)}
            </div>
          </div>)}
        </div>}
    </section>
   </div>
  </main>
 </div>;
}
