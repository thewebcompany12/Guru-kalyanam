'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CheckCircle2, FileImage, LoaderCircle, ScanText, Trash2 } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

declare global {
  interface Window { Tesseract?: any; }
}
type School = { id: string; name: string };
type Product = { id: string; name: string; unit: string; selling_price: number; tax_rate: number };
type RecognizedItem = { line: string; productId: string; confidence: number };

function normalize(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0900-\u097f]/g, '');
}
function similarity(a: string, b: string) {
  const x = normalize(a), y = normalize(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length) + 0.5;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const A = grams(x), B = grams(y);
  const intersection = [...A].filter(g => B.has(g)).length;
  return A.size + B.size ? (2 * intersection) / (A.size + B.size) : 0;
}

export default function PhotoOrderPage() {
  const client = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [items, setItems] = useState<RecognizedItem[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        client.from('schools').select('id,name').order('name'),
        client.from('products').select('id,name,unit,selling_price,tax_rate').eq('active', true).order('name')
      ]);
      setSchools(s.data || []);
      setProducts(p.data || []);
      if (s.error || p.error) setError(s.error?.message || p.error?.message || 'Could not load schools and saved items.');
    })();
  }, [client]);

  const loadTesseract = async () => {
    if (window.Tesseract) return window.Tesseract;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-tesseract]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('OCR library could not load. Check your internet connection.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.dataset.tesseract = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('OCR library could not load. Check your internet connection.'));
      document.head.appendChild(script);
    });
    if (!window.Tesseract) throw new Error('OCR library did not initialize. Please try again.');
    return window.Tesseract;
  };

  const readPhoto = async (file?: File) => {
    if (!file) return;
    setError(''); setMessage(''); setItems([]); setOcrText('');
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setReading(true);
    try {
      const Tesseract = await loadTesseract();
      const result = await Tesseract.recognize(file, 'eng+hin', {
        logger: (event: any) => { if (event.status === 'recognizing text') setMessage('Reading photo… ' + Math.round((event.progress || 0) * 100) + '%'); }
      });
      const text = String(result.data?.text || '').trim();
      setOcrText(text);
      const lines = text.split(/\r?\n/).map((line: string) => line.replace(/^\s*[\d.)-]+\s*/, '').trim()).filter((line: string) => line.length > 1);
      const ranked = lines.map((line: string) => {
        const match = products.map(p => ({ p, score: similarity(line, p.name) })).sort((a, b) => b.score - a.score)[0];
        return { line, productId: match && match.score >= 0.32 ? match.p.id : '', confidence: match?.score || 0 };
      });
      const seen = new Set<string>();
      setItems(ranked.filter((item: RecognizedItem) => {
        const key = normalize(item.line);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }));
      const normalizedText = normalize(text);
      const schoolMatches = schools.map(s => ({ s, score: similarity(normalizedText, s.name) })).sort((a, b) => b.score - a.score);
      if (schoolMatches[0] && schoolMatches[0].score >= 0.18) setSchoolId(schoolMatches[0].s.id);
      setMessage('Photo read. Please verify the school and every item before creating the order.');
    } catch (e: any) {
      setError(e?.message || 'Could not read this photo. You can still add items manually below.');
    } finally { setReading(false); }
  };

  const saveOrder = async () => {
    setError(''); setMessage('');
    if (!schoolId) { setError('Please select or confirm the school written at the top of the page.'); return; }
    const valid = items.filter(i => products.some(p => p.id === i.productId));
    if (!valid.length) { setError('Match at least one recognized line to a saved product.'); return; }
    setSaving(true);
    const p_items = valid.map(i => {
      const p = products.find(x => x.id === i.productId)!;
      return { product_id: p.id, product_name: p.name, quantity: 1, unit: p.unit || 'piece', unit_price: Number(p.selling_price || 0), discount: 0, tax_rate: Number(p.tax_rate || 0), custom_item: false };
    });
    const { data, error: saveError } = await client.rpc('create_order', {
      p_school_id: schoolId, p_contact_id: null, p_order_date: new Date().toISOString().slice(0, 10),
      p_expected_delivery_date: null, p_notes: 'Created from handwritten order photo. OCR text for review: ' + ocrText.slice(0, 1500),
      p_items
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setMessage('Order created successfully with ' + valid.length + ' item(s), quantity 1 each.');
    if (data) window.location.href = '/orders/' + data;
  };

  const addBlank = () => setItems(prev => [...prev, { line: '', productId: '', confidence: 0 }]);
  const updateItem = (index: number, patch: Partial<RecognizedItem>) => setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));

  return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-4xl mx-auto">
    <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-slate-500 mb-4"><ArrowLeft size={16}/>Back to orders</Link>
    <header className="mb-6"><p className="text-sm text-emerald-700 font-semibold">Photo order entry</p><h1 className="text-3xl font-bold">Create order from notebook photo</h1><p className="text-slate-500 mt-2">Write the school name at the top of the page, then upload one clear photo. Every matched saved item is added once with quantity 1.</p></header>
    <section className="card p-5 mb-5 space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between"><div><h2 className="font-bold">1. Upload order photo</h2><p className="text-sm text-slate-500">Use a clear, well-lit photo with the full page visible.</p></div><button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl bg-emerald-600 text-white px-4 py-3 font-semibold flex gap-2 items-center"><Camera size={18}/>Choose photo</button></div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => readPhoto(e.target.files?.[0])}/>
      {imageUrl ? <img src={imageUrl} alt="Uploaded handwritten order" className="max-h-[420px] max-w-full mx-auto rounded-xl border object-contain"/> : <button type="button" onClick={() => fileRef.current?.click()} className="w-full min-h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2"><FileImage size={30}/><span>Tap to select or take a photo</span></button>}
      {reading && <p className="text-sm text-emerald-700 flex gap-2 items-center"><LoaderCircle size={16} className="animate-spin"/>{message || 'Reading photo…'}</p>}
    </section>
    <section className="card p-5 mb-5 space-y-4">
      <h2 className="font-bold">2. Confirm school</h2>
      <label className="block text-sm font-medium">School name written at the top<select value={schoolId} onChange={e => setSchoolId(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"><option value="">Select the correct school…</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </section>
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">3. Verify items</h2><p className="text-sm text-slate-500">OCR can misread handwriting. Correct the matches before saving.</p></div><button type="button" onClick={addBlank} className="rounded-xl border px-3 py-2 text-sm">+ Add item</button></div>
      {items.length === 0 && <p className="text-sm text-slate-500 rounded-xl bg-slate-50 p-4">No lines detected yet. Upload a photo or add an item manually.</p>}
      <div className="space-y-3">{items.map((item, index) => <div key={index} className="border rounded-xl p-3 space-y-2"><div className="flex gap-2"><input value={item.line} onChange={e => updateItem(index, { line: e.target.value })} placeholder="Text read from notebook" className="min-w-0 flex-1 border rounded-lg px-3 py-2"/><button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))} aria-label="Remove item" className="p-2 text-red-600"><Trash2 size={17}/></button></div><select value={item.productId} onChange={e => updateItem(index, { productId: e.target.value })} className="w-full border rounded-lg px-3 py-2 bg-white"><option value="">Choose matching saved item…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-xs text-slate-500">Order quantity: <b>1</b> · Price from saved product</p></div>)}</div>
      {ocrText && <details className="text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Show full OCR text</summary><textarea value={ocrText} onChange={e => setOcrText(e.target.value)} rows={5} className="mt-2 w-full border rounded-xl p-3"/></details>}
      {error && <p className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
      {message && !reading && <p className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm flex gap-2 items-start"><CheckCircle2 size={17} className="shrink-0 mt-0.5"/>{message}</p>}
      <button type="button" disabled={saving || reading} onClick={saveOrder} className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold disabled:opacity-50">{saving ? 'Creating order…' : 'Create one order for this school'}</button>
    </section>
  </div></main></div>;
}
