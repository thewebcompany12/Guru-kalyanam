'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const start = async () => {
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        if (mounted) setReady(true);
        return;
      }

      const { error: signInError } = await supabase.auth.signInAnonymously({
        options: { data: { full_name: 'Personal workspace' } },
      });

      if (!mounted) return;
      if (signInError) {
        setError('Automatic workspace setup is not enabled yet. Enable Anonymous Sign-Ins in Supabase Authentication settings, then reload this app.');
        return;
      }
      setReady(true);
    };

    start();
    return () => { mounted = false; };
  }, []);

  if (error) return <main className="min-h-screen grid place-items-center bg-slate-50 p-5"><section className="card w-full max-w-lg p-6 text-center animate-fade-up"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">⚙️</div><h1 className="text-xl font-bold">One-time workspace setup</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Reload app</button></section></main>;
  if (!ready) return <main className="min-h-screen grid place-items-center bg-slate-50 p-5"><section className="card w-full max-w-sm p-7 text-center animate-fade-up"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-500 text-white shadow-lg animate-soft-bounce">🏫</div><h1 className="text-xl font-bold">Opening your workspace…</h1><p className="mt-2 text-sm text-slate-500">No login needed.</p><div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 rounded-full bg-emerald-500 animate-loading-bar" /></div></section></main>;
  return <>{children}</>;
}
