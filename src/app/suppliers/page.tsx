'use client';

import { useEffect, useMemo, useState } from 'react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';
import { Building2, Check, LoaderCircle, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Trash2, Truck, Users, X } from 'lucide-react';

type Supplier = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  notes: string | null;
  outstanding_amount?: number | null;
};

type SupplierForm = {
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  address: string;
  notes: string;
};

const emptyForm: SupplierForm = { name: '', company: '', phone: '', whatsapp: '', address: '', notes: '' };

export default function SuppliersPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.from('suppliers').select('*').order('name');
    if (loadError) setError(loadError.message);
    else {
      setRows((data || []) as Supplier[]);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((supplier) =>
      [supplier.name, supplier.company, supplier.phone, supplier.whatsapp, supplier.address]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const outstanding = useMemo(
    () => rows.reduce((sum, row) => sum + Math.max(0, Number(row.outstanding_amount || 0)), 0),
    [rows]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setNotice('');
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Enter a supplier name before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name,
      company: form.company.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      updated_by: user?.id,
    };
    const result = editingId
      ? await supabase.from('suppliers').update(payload).eq('id', editingId)
      : await supabase.from('suppliers').insert({ ...payload, created_by: user?.id });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    setNotice(editingId ? 'Supplier details updated.' : 'Supplier added successfully.');
    setForm(emptyForm);
    setEditingId(null);
    await load();
    setSaving(false);
  };

  const startEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || '',
      company: supplier.company || '',
      phone: supplier.phone || '',
      whatsapp: supplier.whatsapp || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setError('');
    setNotice('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (supplier: Supplier) => {
    if (!window.confirm('Delete ' + supplier.name + '? This cannot be undone.')) return;
    setDeletingId(supplier.id);
    setError('');
    setNotice('');
    const { error: deleteError } = await supabase.from('suppliers').delete().eq('id', supplier.id);
    if (deleteError) setError(deleteError.message);
    else {
      setRows((current) => current.filter((row) => row.id !== supplier.id));
      setNotice('Supplier deleted.');
      if (editingId === supplier.id) resetForm();
    }
    setDeletingId(null);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <AppNav />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><Truck size={16} /> Procurement workspace</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">Suppliers</h1>
              <p className="text-sm text-slate-500 mt-2">Keep supplier contacts, addresses and outstanding balances organised.</p>
            </div>
            <button onClick={() => { resetForm(); document.getElementById('supplier-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-700 transition-colors">
              <Plus size={17} /> Add supplier
            </button>
          </header>

          {(error || notice) && <div role={error ? 'alert' : 'status'} className={'rounded-xl border p-3 text-sm ' + (error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{error || notice}</div>}

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total suppliers</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Users size={18} /></span></div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{loading ? '—' : rows.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-500">With contact number</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Phone size={18} /></span></div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{loading ? '—' : rows.filter((row) => row.phone || row.whatsapp).length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Outstanding balance</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Building2 size={18} /></span></div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{loading ? '—' : '₹' + outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </section>

          <section id="supplier-form" className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm scroll-mt-4">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div><h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit supplier' : 'Supplier details'}</h2><p className="text-sm text-slate-500 mt-1">Name is required. Other details can be added later.</p></div>
              {editingId && <button onClick={resetForm} aria-label="Cancel editing" className="rounded-lg border p-2 text-slate-500 hover:bg-slate-50"><X size={17} /></button>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Supplier name <span className="text-rose-600">*</span><input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sharma Stationers" maxLength={120} required /></label>
              <label className="text-sm font-medium text-slate-700">Company<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Business / firm name" maxLength={160} /></label>
              <label className="text-sm font-medium text-slate-700">Phone number<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Contact number" maxLength={30} /></label>
              <label className="text-sm font-medium text-slate-700">WhatsApp number<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" type="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp contact" maxLength={30} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Address<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Shop / office address" maxLength={300} /></label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2 xl:col-span-3">Notes<textarea className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, preferred items, delivery notes…" maxLength={1000} /></label>
            </div>
            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              {editingId && <button onClick={resetForm} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>}
              <button onClick={() => void save()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save supplier'}</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div><h2 className="text-lg font-bold text-slate-900">Supplier directory</h2><p className="text-sm text-slate-500 mt-1">{visibleRows.length} of {rows.length} suppliers</p></div>
              <label className="relative w-full sm:max-w-sm"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company or phone…" /></label>
            </div>
            {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading suppliers…</div>
              : !visibleRows.length ? <div className="py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Truck size={22} /></span><p className="mt-3 font-semibold text-slate-800">{search ? 'No matching suppliers' : 'No suppliers added yet'}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try a different name or phone number.' : 'Add your first supplier using the form above.'}</p></div>
              : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleRows.map((supplier) => <article key={supplier.id} className="rounded-xl border border-slate-200 p-4 transition-all hover:border-teal-200 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-slate-900 break-words">{supplier.name}</h3>{supplier.company && <p className="text-sm text-slate-500 mt-0.5">{supplier.company}</p>}</div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Building2 size={17} /></span></div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">{supplier.phone && <p className="flex items-center gap-2"><Phone size={15} className="shrink-0 text-slate-400" />{supplier.phone}</p>}{supplier.whatsapp && <p className="flex items-center gap-2"><MessageCircle size={15} className="shrink-0 text-emerald-600" />{supplier.whatsapp}</p>}{supplier.address && <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /><span className="break-words">{supplier.address}</span></p>}</div>
                <div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Outstanding balance</p><p className="mt-1 font-bold text-slate-900">₹{Number(supplier.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                {supplier.notes && <p className="mt-3 text-sm text-slate-500 line-clamp-2">{supplier.notes}</p>}
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3"><button onClick={() => startEdit(supplier)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Edit</button><button onClick={() => void remove(supplier)} disabled={deletingId === supplier.id} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14} />{deletingId === supplier.id ? 'Deleting…' : 'Delete'}</button></div>
              </article>)}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
