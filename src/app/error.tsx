'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Application route error:', error); }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle size={28} /></div>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">This page could not finish loading. You can retry or return to the dashboard.</p>
        {error.digest && <p className="mt-3 text-xs text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => reset()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"><RefreshCw size={17} /> Retry</button>
          <a href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700"><Home size={17} /> Dashboard</a>
        </div>
      </section>
    </main>
  );
}
