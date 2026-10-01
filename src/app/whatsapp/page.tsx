'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, RefreshCw, Send, Clock3, CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import AppNav from '@/components/AppNav';

type Contact={id:string;school_id:string;name:string;whatsapp_number:string|null;phone:string|null;schools?:{name:string}|null};
type Template={id:string;name:string;body:string;language:string;active:boolean};
type Message={id:string;recipient_name:string|null;recipient_phone:string;message_body:string;status:string;scheduled_at:string|null;sent_at:string|null;schools?:{name:string}|null};

const cleanPhone=(v:string)=>v.replace(/[^0-9]/g,'');
const render=(body:string, values:Record<string,string>)=>body.replace(/{{\s*([^}]+)\s*}}/g,(_,k)=>values[k.trim()]??'');
export default function WhatsApp(){
 const s=createClient(); const [contacts,setContacts]=useState<Contact[]>([]),[templates,setTemplates]=useState<Template[]>([]),[messages,setMessages]=useState<Message[]>([]);
 const [contactId,setContactId]=useState(''),[templateId,setTemplateId]=useState(''),[body,setBody]=useState(''),[search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setError('');const [c,t,m]=await Promise.all([
  s.from('school_contacts').select('id,school_id,name,phone,whatsapp_number,schools(name)').not('whatsapp_number','is',null).order('name'),
  s.from('whatsapp_templates').select('id,name,body,language,active').eq('active',true).order('name'),
  s.from('whatsapp_messages').select('id,recipient_name,recipient_phone,message_body,status,scheduled_at,sent_at,schools(name)').order('created_at',{ascending:false}).limit(100)
 ]); if(c.error||t.error||m.error)setError(c.error?.message||t.error?.message||m.error?.message||'Unable to load WhatsApp workspace'); setContacts((c.data||[]) as Contact[]);setTemplates((t.data||[]) as Template[]);setMessages((m.data||[]) as Message[]);setBusy(false)};
 useEffect(()=>{void load()},[]);
 useEffect(()=>{const t=templates.find(x=>x.id===templateId); if(t)setBody(render(t.body,{school:contacts.find(x=>x.id===contactId)?.schools?.name||'School',order_number:'{{order_number}}',amount:'{{amount}}'}))},[templateId,contactId,templates,contacts]);
 const visible=useMemo(()=>contacts.filter(c=>(c.name+' '+(c.schools?.name||'')).toLowerCase().includes(search.toLowerCase())),[contacts,search]);
 const create=async()=>{const c=contacts.find(x=>x.id===contactId);if(!c||!body.trim()){setError('Select a WhatsApp contact and enter a message');return}const {data:{user}}=await s.auth.getUser();const r=await s.from('whatsapp_messages').insert({school_id:c.school_id,contact_id:c.id,recipient_name:c.name,recipient_phone:cleanPhone(c.whatsapp_number||c.phone||''),message_body:body.trim(),status:'DRAFT',created_by:user?.id});if(r.error)setError(r.error.message);else{setBody('');void load()}};
 const open=(m:Message)=>{const phone=cleanPhone(m.recipient_phone);if(!phone)return;window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(m.message_body),'_blank','noopener,noreferrer')};
 const queue=async(id:string)=>{const r=await s.from('whatsapp_messages').update({status:'QUEUED'}).eq('id',id);if(r.error)setError(r.error.message);else void load()};
 const cancel=async(id:string)=>{const r=await s.from('whatsapp_messages').update({status:'CANCELLED'}).eq('id',id);if(r.error)setError(r.error.message);else void load()};
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8 space-y-5 max-w-[1200px] mx-auto w-full">
  <header><h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle/>WhatsApp Center</h1><p className="text-sm text-slate-500 mt-1">Prepare reusable customer messages, queue notifications, and open them directly in WhatsApp.</p></header>
  {error&&<div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
  <section className="grid sm:grid-cols-3 gap-3">{[['Drafts',messages.filter(x=>x.status==='DRAFT').length,Clock3],['Queued',messages.filter(x=>x.status==='QUEUED').length,Send],['Sent',messages.filter(x=>x.status==='SENT').length,CheckCircle2]].map(([label,count,Icon]:any)=><div className="card p-4" key={label}><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-bold mt-1 flex items-center gap-2"><Icon size={20}/>{count}</div></div>)}</section>
  <section className="card p-4 space-y-3"><h2 className="font-semibold">Create WhatsApp message</h2><div className="grid md:grid-cols-2 gap-3">
   <select className="border rounded-xl p-3" value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">Select school contact</option>{visible.map(c=><option key={c.id} value={c.id}>{c.schools?.name||'School'} · {c.name} · {c.whatsapp_number}</option>)}</select>
   <select className="border rounded-xl p-3" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Start from template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.language}</option>)}</select>
  </div><textarea className="border rounded-xl p-3 min-h-28 w-full" value={body} onChange={e=>setBody(e.target.value)} placeholder="Message text"/><div className="flex flex-wrap gap-2"><button onClick={()=>void create()} className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold inline-flex items-center gap-2"><Plus size={16}/>Save draft</button><input className="border rounded-xl p-2 flex-1 min-w-48" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter contacts"/></div></section>
  <section className="card p-4"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Message queue</h2><button onClick={()=>void load()} disabled={busy} className="rounded-xl border px-3 py-2 text-sm inline-flex items-center gap-2"><RefreshCw size={15}/>Refresh</button></div><div className="space-y-3">{messages.map(m=><article key={m.id} className="border rounded-xl p-3"><div className="flex gap-3 items-start"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0"><MessageCircle size={17}/></span><div className="min-w-0 flex-1"><b>{m.recipient_name||m.recipient_phone}</b>{m.schools?.name&&<div className="text-xs text-slate-500">{m.schools.name}</div>}<p className="text-sm mt-2 whitespace-pre-wrap">{m.message_body}</p><div className="text-xs text-slate-500 mt-2">Status: {m.status}{m.sent_at?' · '+new Date(m.sent_at).toLocaleString('en-IN'):''}</div></div><div className="flex gap-2 shrink-0"><button onClick={()=>open(m)} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Send size={13}/>Open</button>{m.status==='DRAFT'&&<button onClick={()=>void queue(m.id)} className="rounded-lg border px-3 py-2 text-xs">Queue</button>}{m.status!=='CANCELLED'&&m.status!=='SENT'&&<button onClick={()=>void cancel(m.id)} aria-label="Cancel" className="rounded-lg border p-2"><XCircle size={15}/></button>}</div></div></article>)}{!messages.length&&<div className="empty-panel">No WhatsApp messages yet.</div>}</div></section>
 </main></div>
}
