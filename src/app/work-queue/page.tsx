'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Bell,CheckCircle2,Clock3,ListTodo,RefreshCw} from 'lucide-react';
import AppNav from '@/components/AppNav';
import {createClient} from '@/lib/supabase';

const dateKey=(v:string|null)=>v?new Date(v).toLocaleDateString('en-CA'):'';
const today=()=>new Date().toLocaleDateString('en-CA');

export default function WorkQueuePage(){
 const supabase=createClient();
 const[tasks,setTasks]=useState<any[]>([]),[reminders,setReminders]=useState<any[]>([]),[notifications,setNotifications]=useState<any[]>([]);
 const[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');const{data:{user}}=await supabase.auth.getUser();if(!user){setError('Workspace session is not available.');setLoading(false);return}
  const[t,r,n]=await Promise.all([
   supabase.from('tasks').select('id,title,due_at,priority,completed,school_id,schools(id,name)').order('completed').order('due_at',{ascending:true,nullsFirst:false}).limit(100),
   supabase.from('reminders').select('id,title,due_at,priority,completed,school_id,schools(id,name)').order('completed').order('due_at',{ascending:true}).limit(100),
   supabase.from('notifications').select('id,title,body,type,created_at,read_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)
  ]);
  const e=t.error||r.error||n.error;if(e)setError(e.message);setTasks(t.data||[]);setReminders(r.data||[]);setNotifications(n.data||[]);setLoading(false);
 };
 useEffect(()=>{void load()},[]);
 const openTasks=tasks.filter(x=>!x.completed),openReminders=reminders.filter(x=>!x.completed),unread=notifications.filter(x=>!x.read_at);
 const overdueTasks=openTasks.filter(x=>x.due_at&&dateKey(x.due_at)<today()),overdueReminders=openReminders.filter(x=>x.due_at&&dateKey(x.due_at)<today());
 const queue=useMemo(()=>[...openTasks.map(x=>({...x,kind:'Task',href:'/tasks',tone:'text-emerald-700 bg-emerald-50'})),...openReminders.map(x=>({...x,kind:'Reminder',href:'/reminders',tone:'text-amber-700 bg-amber-50'}))].sort((a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999'))).slice(0,12),[openTasks,openReminders]);
 const complete=async(table:'tasks'|'reminders',id:string)=>{const r=await supabase.from(table).update({completed:true}).eq('id',id);if(r.error)setError(r.error.message);else void load()};
 const cards=[['Open tasks',openTasks.length,'/tasks','text-emerald-700 bg-emerald-50'],['Open reminders',openReminders.length,'/reminders','text-amber-700 bg-amber-50'],['Overdue tasks',overdueTasks.length,'/tasks','text-red-700 bg-red-50'],['Overdue reminders',overdueReminders.length,'/reminders','text-red-700 bg-red-50'],['Unread alerts',unread.length,'/notifications','text-rose-700 bg-rose-50']];
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8 space-y-5 max-w-[1250px] mx-auto w-full">
  <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Phase 25 · Work Queue</p><h1 className="text-2xl font-bold mt-1">Today’s Work</h1><p className="text-sm text-slate-500 mt-1">Tasks, reminders and unread alerts that need attention.</p></div><button onClick={()=>void load()} disabled={loading} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold inline-flex items-center gap-2"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button></header>
  {error&&<div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</div>}
  <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">{cards.map(([label,count,href,tone]:any)=><Link key={label} href={href} className="card p-4 hover:shadow-md transition-shadow"><div className={'h-9 w-9 rounded-xl grid place-items-center '+tone}><ListTodo size={17}/></div><div className="text-2xl font-bold mt-3">{count}</div><div className="text-xs text-slate-500">{label}</div></Link>)}</section>
  <section className="grid lg:grid-cols-[1.4fr_.8fr] gap-5"><div className="card p-4"><div className="flex items-center justify-between mb-3"><div><h2 className="font-bold">Next up</h2><p className="text-xs text-slate-500">Open work ordered by due date</p></div><ListTodo size={19} className="text-slate-400"/></div><div className="space-y-2">
   {queue.map(item=><div key={item.kind+item.id} className="rounded-xl border p-3 flex gap-3 items-start"><button onClick={()=>void complete(item.kind==='Task'?'tasks':'reminders',item.id)} aria-label={'Complete '+item.kind.toLowerCase()} className="mt-0.5 text-emerald-600"><CheckCircle2 size={19}/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 items-center"><b className="truncate">{item.title}</b><span className={'text-[11px] px-2 py-0.5 rounded-full '+item.tone}>{item.kind}</span><span className="text-[11px] text-slate-500">{item.priority}</span></div>{item.schools?.id&&<Link href={'/schools/'+item.schools.id} className="text-xs text-emerald-700">{item.schools.name}</Link>}<div className="text-xs text-slate-500 mt-1">{item.due_at?<><Clock3 size={12} className="inline mr-1"/>{new Date(item.due_at).toLocaleString('en-IN')}</>:'No due date'}</div></div><Link href={item.href} className="text-xs font-semibold text-slate-600">Open</Link></div>)}
   {!queue.length&&<div className="empty-panel">No open work. Your queue is clear.</div>}</div></div>
   <div className="card p-4"><div className="flex items-center justify-between mb-3"><div><h2 className="font-bold">Unread notifications</h2><p className="text-xs text-slate-500">{unread.length} waiting</p></div><Bell size={19} className="text-rose-500"/></div><div className="space-y-2">{unread.slice(0,8).map(n=><Link href="/notifications" key={n.id} className="block rounded-xl border p-3 hover:bg-slate-50"><b className="text-sm block">{n.title}</b><p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body||'No additional details.'}</p><span className="text-[11px] text-slate-400 mt-1 block">{new Date(n.created_at).toLocaleString('en-IN')}</span></Link>)}{!unread.length&&<div className="empty-panel">No unread notifications.</div>}</div><Link href="/notifications" className="block text-center text-sm font-semibold text-rose-700 mt-3">View all notifications</Link></div>
  </section>
 </main></div>;
}