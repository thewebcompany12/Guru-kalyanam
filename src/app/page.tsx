'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ClipboardList, IndianRupee, MapPin, Package, Plus, School, Users } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

export default function Home(){
 const [user,setUser]=useState<any>(null),[schools,setSchools]=useState(0),[orders,setOrders]=useState(0),[visits,setVisits]=useState(0),[outstanding,setOutstanding]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=createClient();Promise.all([c.auth.getUser(),c.from('schools').select('*',{count:'exact',head:true}),c.from('orders').select('*',{count:'exact',head:true}),c.from('school_visits').select('*',{count:'exact',head:true}).gte('started_at',new Date().toISOString().slice(0,10)),c.from('orders').select('total,paid_amount')]).then(([u,s,o,v,os])=>{setUser(u.data.user);setSchools(s.count||0);setOrders(o.count||0);setVisits(v.count||0);setOutstanding((os.data||[]).reduce((a:any,x:any)=>a+Math.max(0,Number(x.total)-Number(x.paid_amount||0)),0))}).finally(()=>setLoading(false))},[]);
 const quick=[['Add School','/schools',School],['Start Visit','/visits',MapPin],['Add Order','/orders',ClipboardList],['Add Contact','/schools',Users],['Add Payment','/payments',IndianRupee],['Add Product','/products',Package]];
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
  <header className="flex items-center justify-between mb-7"><div><p className="text-sm text-slate-500">Business operations dashboard · Phase 6</p><h1 className="text-2xl md:text-3xl font-bold mt-1">Good morning{user?.email?', '+user.email.split('@')[0]:''}</h1></div><Link href="/visits" className="h-11 w-11 rounded-full bg-white border flex items-center justify-center"><Bell size={19}/></Link></header>
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{[['Schools',schools,School],['Visits',visits,MapPin],['Orders',orders,ClipboardList],['Payments to collect',outstanding,IndianRupee]].map(([title,value,Icon]:any)=><div className="card p-4" key={title}><div className="flex justify-between"><span className="text-sm text-slate-500">{title}</span><Icon size={18} className="text-emerald-600"/></div><div className="text-2xl font-bold mt-3">{loading?'—':value}</div></div>)}</section>
  <section className="card p-5 mb-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold">Quick actions</h2><p className="text-sm text-slate-500">Common field-work actions.</p></div><Plus size={20}/></div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{quick.map(([label,href,Icon]:any)=><Link href={href} key={label} className="rounded-xl border p-3 hover:bg-slate-50"><Icon size={19} className="text-emerald-600 mb-3"/><span className="text-sm font-medium">{label}</span></Link>)}</div></section>
  <div className="grid lg:grid-cols-3 gap-5"><section className="card p-5 lg:col-span-2"><h2 className="font-bold">Today&apos;s field work</h2><div className="py-14 text-center text-slate-400"><ClipboardList className="mx-auto mb-3" size={32}/><p>Visits and follow-ups will appear here.</p><Link href="/visits" className="text-emerald-700 text-sm">Open visits</Link></div></section>
  <section className="card p-5"><h2 className="font-bold mb-4">Reports</h2><div className="space-y-3 text-sm"><Link href="/reports" className="block p-3 rounded-xl bg-slate-50">Reports & analytics</Link><Link href="/timeline" className="block p-3 rounded-xl bg-slate-50">Activity timeline</Link><Link href="/schools" className="block p-3 rounded-xl bg-slate-50">School directory</Link></div></section></div>
 </main></div>;
}
