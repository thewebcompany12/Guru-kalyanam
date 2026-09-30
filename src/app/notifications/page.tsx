'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, School } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import AppNav from '@/components/AppNav';

type NotificationRow = { id:string; title:string; body:string|null; created_at:string; read_at:string|null; related_school_id:string|null };

export default function Notifications() {
  const supabase = createClient();
  const [rows,setRows] = useState<NotificationRow[]>([]);
  const [error,setError] = useState('');

  const load = async () => {
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return;
    const result = await supabase.from('notifications').select('id,title,body,created_at,read_at,related_school_id').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if (result.error) setError(result.error.message); else setRows((result.data||[]) as NotificationRow[]);
  };
  useEffect(()=>{ void load(); },[]);

  const read = async (id:string) => {
    const result=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);
    if(result.error) setError(result.error.message); else void load();
  };
  const markAllRead = async () => {
    const { data:{user} }=await supabase.auth.getUser();
    if(!user) return;
    const result=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
    if(result.error) setError(result.error.message); else void load();
  };
  const unread=rows.filter(row=>!row.read_at).length;

  return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8 space-y-5 max-w-[1100px] mx-auto w-full">
    <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Bell/>Notifications</h1><p className="text-sm text-slate-500 mt-1">{unread} unread notification{unread===1?'':'s'}</p></div>{unread>0&&<button onClick={()=>void markAllRead()} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"><CheckCheck size={16}/>Mark all read</button>}</header>
    {error&&<div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
    <div className="space-y-3">{rows.map(row=><button onClick={()=>void read(row.id)} key={row.id} className={'block w-full text-left card p-4 '+(!row.read_at?'border-amber-200 bg-amber-50/60':'')}><div className="flex gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700 shrink-0"><Bell size={17}/></span><div className="min-w-0 flex-1"><b>{row.title}</b><div className="text-sm text-slate-600 mt-1">{row.body||'No additional details.'}</div><div className="text-xs text-slate-500 mt-2">{new Date(row.created_at).toLocaleString('en-IN')}</div>{row.related_school_id&&<Link href={'/schools/'+row.related_school_id} onClick={event=>event.stopPropagation()} className="text-xs text-emerald-700 inline-flex items-center gap-1 mt-2"><School size={13}/>Open school</Link>}</div></div></button>)}{!rows.length&&<div className="empty-panel">No notifications yet.</div>}</div>
  </main></div>;
}