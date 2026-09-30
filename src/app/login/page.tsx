'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

function safeNextPath() {
  if (typeof window === 'undefined') return '/';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [mode,setMode]=useState<'signin'|'signup'>('signin'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{createClient().auth.getUser().then(({data})=>{if(data.user)router.replace(safeNextPath())})},[router]);

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    setBusy(true);
    setError('');
    const c=createClient();
    const r=mode==='signin'
      ? await c.auth.signInWithPassword({email,password})
      : await c.auth.signUp({email,password,options:{data:{full_name:email.split('@')[0]}}});

    if(r.error) {
      setError(r.error.message);
    } else if (mode === 'signup' && !r.data.session) {
      setError('Account created. Check your email to confirm the account, then sign in.');
    } else {
      router.replace(safeNextPath());
    }
    setBusy(false);
  };

  return <main className="min-h-screen grid place-items-center bg-slate-50 p-4"><section className="card w-full max-w-md p-6 md:p-8">
    <h1 className="text-2xl font-bold">School Supply Ops</h1><p className="text-sm text-slate-500 mt-1 mb-7">{mode==='signin'?'Sign in to your workspace.':'Create the first workspace user.'}</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
      <label className="block text-sm font-medium">Password<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
      {error&&<p className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold disabled:opacity-50">{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</button>
    </form>
    <button onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('')}} className="w-full mt-4 text-sm text-emerald-700">{mode==='signin'?'Need an account? Create one':'Already have an account? Sign in'}</button>
  </section></main>;
}
