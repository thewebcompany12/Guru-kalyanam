'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Bell, Boxes, CalendarClock, CalendarCheck, CheckSquare, ClipboardList, IndianRupee, MapPin, Package, Plus, School, Truck, Users, WalletCards, TrendingUp } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type QueueRow={id:string;title:string;due_at:string;kind:'task'|'reminder';priority:string;school?:{name?:string}|null};

export default function Home(){
 const [user,setUser]=useState<any>(null),[schools,setSchools]=useState(0),[orders,setOrders]=useState(0),[visits,setVisits]=useState(0),[outstanding,setOutstanding]=useState(0);
 const [followUps,setFollowUps]=useState<any[]>([]),[queue,setQueue]=useState<QueueRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const today=new Date(); const todayKey=today.toISOString().slice(0,10);
 useEffect(()=>{const c=createClient();(async()=>{
   const [u,s,o,v,os,p,f,t,r]=await Promise.all([
    c.auth.getUser(),c.from('schools').select('*',{count:'exact',head:true}),c.from('orders').select('*',{count:'exact',head:true}),
    c.from('school_visits').select('*',{count:'exact',head:true}).gte('started_at',todayKey),
    c.from('orders').select('id,total,paid_amount'),c.from('payments').select('order_id,amount'),
    c.from('schools').select('id,name,next_follow_up_at').eq('status','ACTIVE').not('next_follow_up_at','is',null).lte('next_follow_up_at',new Date(Date.now()+7*86400000).toISOString()).order('next_follow_up_at').limit(8),
    c.from('tasks').select('id,title,due_at,priority,schools(name)').eq('completed',false).not('due_at','is',null).order('due_at').limit(8),
    c.from('reminders').select('id,title,due_at,priority,schools(name)').eq('completed',false).order('due_at').limit(8)
   ]);
   const errors=[s,o,v,os,p,f,t,r].filter((x:any)=>x.error); if(errors.length)setError(errors[0].error.message);
   const paidByOrder=new Map<string,number>(); for(const x of (p.data||[])){if(x.order_id)paidByOrder.set(x.order_id,(paidByOrder.get(x.order_id)||0)+Number(x.amount||0));}
   setUser(u.data.user);setSchools(s.count||0);setOrders(o.count||0);setVisits(v.count||0);
   setOutstanding((os.data||[]).reduce((a:any,x:any)=>a+Math.max(0,Number(x.total)-Math.max(Number(x.paid_amount||0),paidByOrder.get(x.id)||0)),0));
   setFollowUps(f.data||[]);
   const merged=[...(t.data||[]).map((x:any)=>({...x,kind:'task'})),...(r.data||[]).map((x:any)=>({...x,kind:'reminder'}))].sort((a:any,b:any)=>new Date(a.due_at).getTime()-new Date(b.due_at).getTime()).slice(0,8);
   setQueue(merged);
   setLoading(false);
 })()},[todayKey]);

 const dueCount=useMemo(()=>queue.filter(x=>new Date(x.due_at)<=new Date()).length,[queue]);
 const quick=[['Add School','/schools',School,'from-blue-500 to-cyan-500'],['Start Visit','/visits',MapPin,'from-emerald-500 to-teal-500'],['Add Order','/orders',ClipboardList,'from-violet-500 to-purple-500'],['Add Contact','/schools',Users,'from-amber-500 to-orange-500'],['Add Payment','/payments',IndianRupee,'from-pink-500 to-rose-500'],['Add Product','/products',Package,'from-indigo-500 to-blue-500']];
 const metrics=[['Schools',schools,School,'from-blue-500 to-cyan-500','/schools'],['Today visits',visits,MapPin,'from-emerald-500 to-teal-500','/visits'],['Orders',orders,ClipboardList,'from-violet-500 to-purple-500','/orders'],['Payments to collect',outstanding,IndianRupee,'from-orange-500 to-rose-500','/payments']];
 return <div className="app-root min-h-screen flex bg-slate-50"><AppNav/><main className="app-main flex-1 min-w-0 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
  <header className="dashboard-hero mb-6 overflow-hidden"><div className="relative p-5 md:p-7"><div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/><div className="relative flex items-center justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/95 backdrop-blur"><TrendingUp size={14}/> Business operations</div><h1 className="text-2xl md:text-3xl font-bold mt-3 text-white">Good morning{user?.email?', '+user.email.split('@')[0]:''}</h1><p className="mt-1 text-sm text-white/75">Your schools, field work, follow-ups, orders and collections in one place.</p></div><Link href="/notifications" aria-label="Notifications" className="dashboard-bell h-12 w-12 rounded-2xl bg-white/15 border border-white/20 text-white flex items-center justify-center backdrop-blur hover:bg-white/25"><Bell size={21}/></Link></div></div></header>
  {error&&<div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">{error}</div>}
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">{metrics.map(([title,value,Icon,gradient,href]:any)=><Link href={href} className="metric-card" key={title}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-500">{title}</span><span className={['metric-icon bg-gradient-to-br',gradient].join(' ')}><Icon size={18}/></span></div><div className="text-2xl md:text-3xl font-extrabold mt-3 text-slate-900">{loading?'—':title==='Payments to collect'?'₹'+Number(value).toLocaleString('en-IN'):value}</div><div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-400">Open details <ArrowRight size={13}/></div></Link>)}</section>
  <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
   <Link href="/follow-ups" className="card p-4"><div className="text-xs text-slate-500">Follow-ups next 7 days</div><b className="text-2xl">{followUps.length}</b></Link>
   <Link href="/tasks" className="card p-4"><div className="text-xs text-slate-500">Tasks needing attention</div><b className="text-2xl">{queue.filter(x=>x.kind==='task').length}</b></Link>
   <Link href="/reminders" className="card p-4"><div className="text-xs text-slate-500">Due now</div><b className="text-2xl text-rose-600">{dueCount}</b></Link>
   <Link href="/reports" className="card p-4"><div className="text-xs text-slate-500">Reports</div><b className="text-2xl flex items-center gap-2">Open <BarChart3 size={20}/></b></Link>
  </section>
  <section className="card p-4 md:p-5 mb-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-slate-900 flex items-center gap-2"><span className="section-icon bg-violet-100 text-violet-700"><Plus size={16}/></span>Quick actions</h2><p className="text-sm text-slate-500 mt-1">Common field-work actions, one tap away.</p></div><span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"><CalendarCheck size={14}/> Fast entry</span></div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{quick.map(([label,href,Icon,gradient]:any)=><Link href={href} key={label} className="quick-action group"><span className={['quick-icon bg-gradient-to-br',gradient].join(' ')}><Icon size={20}/></span><span className="text-sm font-semibold text-slate-700">{label}</span><ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-slate-500"/></Link>)}</div></section>
  <div className="grid lg:grid-cols-2 gap-5">
   <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold flex items-center gap-2"><span className="section-icon bg-amber-100 text-amber-700"><CalendarClock size={16}/></span>Follow-up queue</h2><p className="text-sm text-slate-500 mt-1">Schools due soon.</p></div><Link href="/follow-ups" className="text-sm font-semibold text-amber-700">Open</Link></div><div className="space-y-2 mt-4">{followUps.slice(0,5).map(s=><Link href={'/schools/'+s.id} key={s.id} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="font-semibold text-sm">{s.name}</span><span className="text-xs text-slate-500">{new Date(s.next_follow_up_at).toLocaleDateString()}</span></Link>)}{!followUps.length&&<p className="text-sm text-slate-400 py-5">No follow-ups scheduled in the next 7 days.</p>}</div></section>
   <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold flex items-center gap-2"><span className="section-icon bg-rose-100 text-rose-700"><CheckSquare size={16}/></span>Work queue</h2><p className="text-sm text-slate-500 mt-1">Open tasks and reminders.</p></div><Link href="/tasks" className="text-sm font-semibold text-rose-700">Open</Link></div><div className="space-y-2 mt-4">{queue.map(x=><div key={x.kind+x.id} className="flex justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="min-w-0"><b className="text-sm block truncate">{x.title}</b><small className="text-xs text-slate-500">{x.kind==='task'?'Task':'Reminder'}{x.schools?.name?' · '+x.schools.name:''}</small></span><span className={'text-xs font-semibold '+(new Date(x.due_at)<=new Date()?'text-rose-600':'text-slate-500')}>{new Date(x.due_at).toLocaleDateString()}</span></div>)}{!queue.length&&<p className="text-sm text-slate-400 py-5">No open tasks or reminders.</p>}</div></section>
  </div>
 </main></div>;
}
