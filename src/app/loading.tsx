export default function Loading() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-5">
      <section className="card w-full max-w-sm p-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 animate-soft-bounce">🏫</div>
        <h1 className="mt-4 text-lg font-bold">Loading workspace…</h1>
        <p className="mt-1 text-sm text-slate-500">Preparing your latest business data.</p>
        <div className="mx-auto mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 rounded-full bg-emerald-500 animate-loading-bar" /></div>
      </section>
    </main>
  );
}
