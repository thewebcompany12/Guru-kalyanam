'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <section className="card w-full max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-emerald-700">School Supply Ops</p>
        <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-slate-600">The page could not complete this request. Your saved business data is not deleted.</p>
        {error.digest ? <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p> : null}
        <button type="button" onClick={() => reset()} className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-white">Try again</button>
      </section>
    </main>
  );
}
