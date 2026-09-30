export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <section className="card w-full max-w-lg p-6 text-center">
        <p className="text-sm font-semibold text-emerald-700">School Supply Ops</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-600">The requested page does not exist.</p>
        <a href="/" className="inline-block mt-5 rounded-xl bg-slate-900 px-4 py-2 text-white">Go to dashboard</a>
      </section>
    </main>
  );
}
