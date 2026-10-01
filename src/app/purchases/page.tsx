'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, PackageCheck, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';

type Supplier = { id: string; name: string; company: string | null };
type Product = { id: string; name: string; unit: string; purchase_price: number; sku: string | null };
type Line = { id: string; product_id: string | null; product_name: string; quantity: number; received_quantity: number; unit: string; unit_cost: number; line_total: number };
type Purchase = { id: string; purchase_number: number; supplier_id: string; purchase_date: string; expected_arrival_date: string | null; status: string; total: number; notes: string | null; suppliers?: Supplier | Supplier[] | null; purchase_items?: Line[] };
type Draft = { product_id: string; product_name: string; quantity: string; unit: string; unit_cost: string };
const blank = (): Draft => ({ product_id: '', product_name: '', quantity: '1', unit: 'piece', unit_cost: '0' });
const statuses = ['ORDERED', 'PARTIALLY_RECEIVED', 'PARTIAL', 'RECEIVED', 'CANCELLED'];
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vendor = (p: Purchase) => Array.isArray(p.suppliers) ? p.suppliers[0]?.name || 'Supplier' : p.suppliers?.name || 'Supplier';

export default function PurchasesPage() {
  const db = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [arrival, setArrival] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Draft[]>([blank()]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, pr] = await Promise.all([
      db.from('purchases').select('id,purchase_number,supplier_id,purchase_date,expected_arrival_date,status,total,notes,suppliers(name,company),purchase_items(id,product_id,product_name,quantity,received_quantity,unit,unit_cost,line_total)').order('created_at', { ascending: false }),
      db.from('suppliers').select('id,name,company').order('name'),
      db.from('products').select('id,name,unit,purchase_price,sku').eq('active', true).order('name'),
    ]);
    if (p.error) setError(p.error.message); else setRows((p.data || []) as unknown as Purchase[]);
    if (s.error) setError(s.error.message); else setSuppliers((s.data || []) as Supplier[]);
    if (pr.error) setError(pr.error.message); else setProducts((pr.data || []) as Product[]);
    setLoading(false);
  }, [db]);
  useEffect(() => { void load(); }, [load]);

  const total = useMemo(() => items.reduce((sum, i) => sum + Math.max(0, Number(i.quantity) || 0) * Math.max(0, Number(i.unit_cost) || 0), 0), [items]);
  const visible = useMemo(() => rows.filter(p => {
    const q = query.trim().toLowerCase();
    return (filter === 'ALL' || p.status === filter) && (!q || [String(p.purchase_number), vendor(p), p.notes || ''].join(' ').toLowerCase().includes(q));
  }), [rows, query, filter]);
  const openRows = rows.filter(p => ['ORDERED', 'PARTIALLY_RECEIVED', 'PARTIAL'].includes(p.status));
  const openValue = openRows.reduce((sum, p) => sum + Number(p.total || 0), 0);

  const selectProduct = (index: number, id: string) => {
    const p = products.find(x => x.id === id);
    setItems(old => old.map((item, i) => i === index ? { ...item, product_id: id, product_name: p?.name || '', unit: p?.unit || 'piece', unit_cost: String(p?.purchase_price ?? 0) } : item));
  };

  const create = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setNotice('');
    if (!supplierId) { setError('Select a supplier first.'); return; }
    const started = items.filter(i => i.product_id || i.product_name.trim() || i.quantity !== '1' || i.unit_cost !== '0');
    const valid = items.filter(i => i.product_name.trim() && Number(i.quantity) > 0 && Number.isFinite(Number(i.quantity)) && Number(i.unit_cost) >= 0 && Number.isFinite(Number(i.unit_cost)));
    if (!valid.length || valid.length !== Math.max(1, started.length)) { setError('Check each item line. Enter an item name, positive quantity and non-negative unit cost.'); return; }
    setSaving(true);
    const result = await db.rpc('create_purchase_order', {
      p_supplier_id: supplierId, p_purchase_date: date, p_expected_arrival_date: arrival || null,
      p_notes: notes.trim() || null,
      p_items: valid.map(i => ({ product_id: i.product_id || null, product_name: i.product_name.trim(), quantity: Number(i.quantity), unit: i.unit || 'piece', unit_cost: Number(i.unit_cost) })),
    });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setSupplierId(''); setDate(new Date().toISOString().slice(0, 10)); setArrival(''); setNotes(''); setItems([blank()]);
    setNotice('Purchase order created. Inventory changes only when goods are received.');
    await load();
    if (result.data) setExpanded(String(result.data));
  };

  const receive = async (p: Purchase) => {
    const lines = (p.purchase_items || []).map(line => ({ purchase_item_id: line.id, quantity: Number(receiveQty[line.id] || 0) })).filter(line => Number.isFinite(line.quantity) && line.quantity > 0);
    if (!lines.length) { setError('Enter a received quantity for at least one line.'); return; }
    for (const line of lines) {
      const item = (p.purchase_items || []).find(x => x.id === line.purchase_item_id);
      if (!item || line.quantity > Number(item.quantity) - Number(item.received_quantity || 0)) { setError('A received quantity is higher than the remaining quantity.'); return; }
    }
    setReceiving(p.id); setError(''); setNotice('');
    const result = await db.rpc('receive_purchase_order', { p_purchase_id: p.id, p_idempotency_key: crypto.randomUUID(), p_items: lines, p_notes: 'Goods received in app' });
    setReceiving(null);
    if (result.error) { setError(result.error.message); return; }
    setReceiveQty(old => { const next = { ...old }; lines.forEach(x => { delete next[x.purchase_item_id]; }); return next; });
    setNotice('Receipt recorded. Inventory stock was updated.');
    await load();
  };

  const cancel = async (p: Purchase) => {
    if ((p.purchase_items || []).some(i => Number(i.received_quantity) > 0)) { setError('This order already has received stock; receive the remaining quantities instead of cancelling.'); return; }
    if (!window.confirm('Cancel purchase order #' + p.purchase_number + '?')) return;
    setError(''); setNotice('');
    const result = await db.from('purchases').update({ status: 'CANCELLED', updated_at: new Date().toISOString() }).eq('id', p.id).in('status', ['ORDERED', 'DRAFT']);
    if (result.error) setError(result.error.message); else { setNotice('Purchase order cancelled.'); await load(); }
  };

  return <div className="min-h-screen flex bg-slate-50"><AppNav /><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700"><Truck size={16} /> Phase 36 · Procurement</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Purchase orders</h1><p className="mt-2 text-sm text-slate-500">Create supplier orders, track partial deliveries and update inventory safely on receipt.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button></header>
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={'flex items-start gap-2 rounded-xl border p-3 text-sm ' + (error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}<span className="flex-1">{error || notice}</span><button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss"><X size={16} /></button></div>}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Open orders</p><p className="mt-2 text-3xl font-extrabold">{openRows.length}</p><p className="text-xs text-slate-500">Ordered or partly received</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Open order value</p><p className="mt-2 text-2xl font-extrabold">{money(openValue)}</p><p className="text-xs text-slate-500">Purchase value, not payment balance</p></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Fully received</p><p className="mt-2 text-3xl font-extrabold">{rows.filter(p => p.status === 'RECEIVED').length}</p><p className="text-xs text-slate-500">Completed purchase orders</p></div></section>

    <form onSubmit={create} className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm md:p-6">
      <div><h2 className="text-lg font-bold">Create purchase order</h2><p className="mt-1 text-sm text-slate-500">Ordering goods does not increase stock. Record the quantities when they arrive.</p></div>
      <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-medium">Supplier *<select required className="mt-1 block w-full rounded-xl border px-3 py-2.5" value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Select supplier…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ' · ' + s.company : ''}</option>)}</select></label><label className="text-sm font-medium">Order date<input required type="date" className="mt-1 block w-full rounded-xl border px-3 py-2.5" value={date} onChange={e => setDate(e.target.value)} /></label><label className="text-sm font-medium">Expected arrival<input type="date" className="mt-1 block w-full rounded-xl border px-3 py-2.5" value={arrival} onChange={e => setArrival(e.target.value)} /></label></div>
      <div className="space-y-2">{items.map((item, idx) => <div key={idx} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-[1.2fr_1.2fr_100px_120px_90px_36px] md:items-end">
        <label className="text-xs font-semibold text-slate-600">Catalog product<select className="mt-1 block w-full rounded-lg border bg-white px-2 py-2 text-sm font-normal" value={item.product_id} onChange={e => selectProduct(idx, e.target.value)}><option value="">Custom item…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ' · ' + p.sku : ''}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Item name<input required maxLength={160} className="mt-1 block w-full rounded-lg border px-2 py-2 text-sm font-normal" value={item.product_name} onChange={e => setItems(old => old.map((x, i) => i === idx ? { ...x, product_name: e.target.value } : x))} placeholder="Item description" /></label>
        <label className="text-xs font-semibold text-slate-600">Quantity<input required type="number" min="0.001" step="0.001" className="mt-1 block w-full rounded-lg border px-2 py-2 text-sm font-normal" value={item.quantity} onChange={e => setItems(old => old.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} /></label>
        <label className="text-xs font-semibold text-slate-600">Unit cost (₹)<input required type="number" min="0" step="0.01" className="mt-1 block w-full rounded-lg border px-2 py-2 text-sm font-normal" value={item.unit_cost} onChange={e => setItems(old => old.map((x, i) => i === idx ? { ...x, unit_cost: e.target.value } : x))} /></label>
        <p className="pb-2 text-sm font-semibold">{money((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}</p>{items.length > 1 && <button type="button" onClick={() => setItems(old => old.filter((_, i) => i !== idx))} aria-label="Remove item" className="mb-1 rounded-lg p-2 text-rose-600"><X size={16} /></button>}
      </div>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><button type="button" onClick={() => setItems(old => [...old, blank()])} className="inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 text-sm font-semibold"><Plus size={16} /> Add item</button><label className="flex-1 text-sm font-medium">Notes<input maxLength={1000} className="mt-1 block w-full rounded-xl border px-3 py-2.5 font-normal" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supplier reference or delivery terms" /></label><div className="sm:text-right"><p className="text-xs text-slate-500">Order total</p><p className="text-2xl font-extrabold">{money(total)}</p></div><button disabled={saving || !suppliers.length} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create order'}</button></div>
      {!suppliers.length && !loading && <p className="text-sm text-amber-700">Add a supplier before creating a purchase order.</p>}
    </form>

    <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-bold">Purchase history</h2><p className="text-sm text-slate-500">Expand an order to record full or partial receipts.</p></div><label className="relative block md:w-72"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" placeholder="Search supplier or order #" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="my-4 flex gap-2 overflow-x-auto pb-1">{['ALL', ...statuses].map(s => <button type="button" key={s} onClick={() => setFilter(s)} className={'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ' + (filter === s ? 'bg-slate-900 text-white' : 'border text-slate-600')}>{s === 'ALL' ? 'All orders' : s === 'PARTIAL' ? 'PARTIAL (legacy)' : s.replaceAll('_', ' ')}</button>)}</div>
      {loading ? <p className="py-10 text-center text-slate-500">Loading purchase orders…</p> : !visible.length ? <div className="py-10 text-center text-slate-500"><PackageCheck className="mx-auto mb-2 text-slate-300" size={30} />No purchase orders found.</div> : <div className="space-y-3">{visible.map(p => {
        const lines = p.purchase_items || []; const isOpen = expanded === p.id;
        const remaining = lines.reduce((sum, l) => sum + Math.max(0, Number(l.quantity) - Number(l.received_quantity || 0)), 0);
        return <article key={p.id} className="overflow-hidden rounded-xl border">
          <button type="button" onClick={() => setExpanded(isOpen ? null : p.id)} className="flex w-full flex-col gap-3 p-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Purchase #{p.purchase_number} · {vendor(p)}</p><p className="mt-1 text-xs text-slate-500">{p.purchase_date}{p.expected_arrival_date ? ' · Expected ' + p.expected_arrival_date : ''} · {lines.length} item(s)</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><div className="sm:text-right"><p className="font-bold">{money(Number(p.total))}</p><p className="text-xs text-slate-500">{remaining} units remaining</p></div><span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + (p.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' : p.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : p.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>{p.status === 'PARTIAL' ? 'PARTIALLY RECEIVED' : p.status.replaceAll('_', ' ')}</span>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div></button>
          {isOpen && <div className="space-y-3 border-t bg-slate-50/60 p-4">{p.notes && <p className="text-sm text-slate-600">{p.notes}</p>}
            {lines.map(l => { const left = Math.max(0, Number(l.quantity) - Number(l.received_quantity || 0)); return <div key={l.id} className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_80px_80px_80px] sm:items-center"><div><p className="text-sm font-semibold">{l.product_name}</p><p className="text-xs text-slate-500">{money(Number(l.unit_cost))} / {l.unit} · Line {money(Number(l.line_total))}</p></div><div><p className="text-xs text-slate-500">Ordered</p><b>{l.quantity}</b></div><div><p className="text-xs text-slate-500">Received</p><b className="text-emerald-700">{Number(l.received_quantity || 0)}</b></div><div><p className="text-xs text-slate-500">Remaining</p><b>{left}</b></div>
              {p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && left > 0 && <label className="text-xs font-semibold text-slate-600 sm:col-span-4">Receive now<input type="number" min="0" max={left} step="0.001" className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-normal sm:max-w-xs" value={receiveQty[l.id] || ''} onChange={e => setReceiveQty(old => ({ ...old, [l.id]: e.target.value }))} placeholder={'Up to ' + left} /></label>}
            </div>; })}
            {p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && <div className="flex flex-wrap gap-2"><button type="button" disabled={receiving === p.id} onClick={() => void receive(p)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><PackageCheck size={16} />{receiving === p.id ? 'Saving receipt…' : 'Record receipt'}</button>{p.status === 'ORDERED' && <button type="button" onClick={() => void cancel(p)} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700">Cancel order</button>}</div>}
            {p.status === 'RECEIVED' && <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> All quantities received.</p>}
          </div>}
        </article>;
      })}</div>}
    </section>
  </div></main></div>;
}
