'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ClipboardList, IndianRupee, MapPin, Package, Plus, School, Users } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

export default function Home(){
 const [user,setUser]=useState<any>(null),[schools,setSchools]=useState(0),[orders,setOrders]=useState(0),[visits,setVisits]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=createClient();Promise.all([c.auth.getUser(),c.from('schools').select('*',{count:'exact',head:true}),c.from('orders').select('*',{count:'exact',head:true}),c.from('school_visits').select('*',{count:'exact',head:true}).gte('started_at',new Date().toISOString().slice(0,10))]).then(([u,s,o,v])=>{setUser(u.data.user);setSchools(s.count||0);setOrders(o.count||0);setVisits(v.count||0)}).finally(()=>setLoading(false))},[]);
 const quick=[['Add School','/schools',School],['Start Visit','/visits',MapPin],['Add Order','/orders',ClipboardList],['Add Contact','/schools',Users],['Add Payment','/payments',IndianRupee],['Add Product','/products',Package]];
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
  <header className="flex items-center justify-between mb-7"><div><p className="text-sm text-slate-500">Phase 2 · Field operations</p><h1 className="text-2xl md:text-3xl font-bold mt-1">Good morning{user?.email?', '+user.email.split('@')[0]:''}</h1></div><Link href="/visits" className="h-11 w-11 rounded-full bg-white border flex items-center justify-center"><Bell size={19}/></Link></header>
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{[['Schools',schools,School],['Visits',visits,MapPin],['Orders',orders,ClipboardList],['Payments to collect',0,IndianRupee]].map(([title,value,Icon]:any)=><div className="card p-4" key={title}><div className="flex justify-between"><span className="text-sm text-slate-500">{title}</span><Icon size={18} className="text-emerald-600"/></div><div className="text-2xl font-bold mt-3">{loading?'—':value}</div></div>)}</section>
  <section className="card p-5 mb-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold">Quick actions</h2><p className="text-sm text-slate-500">Common field-work actions.</p></div><Plus size={20}/></div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{quick.map(([label,href,Icon]:any)=><Link href={href} key={label} className="rounded-xl border p-3 hover:bg-slate-50"><Icon size={19} className="text-emerald-600 mb-3"/><span className="text-sm font-medium">{label}</span></Link>)}</div></section>
  <div className="grid lg:grid-cols-3 gap-5"><section className="card p-5 lg:col-span-2"><h2 className="font-bold">Today&apos;s field work</h2><div className="py-14 text-center text-slate-400"><ClipboardList className="mx-auto mb-3" size={32}/><p>Visits and follow-ups will appear here.</p><Link href="/visits" className="text-emerald-700 text-sm">Open visits</Link></div></section>
  <section className="card p-5"><h2 className="font-bold mb-4">Phase 2</h2><div className="space-y-3 text-sm"><Link href="/schools" className="block p-3 rounded-xl bg-slate-50">School directory + CRUD</Link><Link href="/map" className="block p-3 rounded-xl bg-slate-50">GPS school map</Link><Link href="/visits" className="block p-3 rounded-xl bg-slate-50">Visit tracking</Link></div></section></div>
 </main></div>;
}
