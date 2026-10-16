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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
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
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
    if (!isImage) { setError('This file is not recognized as a photo. Please take a new photo or choose a JPG/PNG image.'); return; }
    setImageUrl(URL.createObjectURL(file));
    setReading(true); setMessage('Photo selected — preparing image…');
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not load this photo.'));
        reader.onerror = () => reject(new Error('Could not load this photo. Please choose it again.'));
        reader.readAsDataURL(file);
      });
      let base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      let uploadMime = file.type === 'image/jpg' ? 'image/jpeg' : (file.type || 'image/jpeg');
      // Compress large phone photos before sending them to the serverless API.
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          base64 = compressed.slice(compressed.indexOf(',') + 1);
          uploadMime = 'image/jpeg';
        }
        bitmap.close();
      } catch { /* Some browsers cannot create a bitmap; use the original image. */ }
      // Run independent Hindi + English OCR as a second reader, then let Gemini compare both sources.
      let independentOcrText = '';
      let tesseractInstance: any = null;
      try {
        tesseractInstance = await loadTesseract();
        const ocrResult = await tesseractInstance.recognize(file, 'eng+hin', {
          logger: (event: any) => { if (event.status === 'recognizing text') setMessage('Reading handwriting with OCR… ' + Math.round((event.progress || 0) * 100) + '%'); }
        });
        independentOcrText = String(ocrResult.data?.text || '').trim();
      } catch { /* Gemini still gets the photo if independent OCR cannot read this format. */ }
      let recognized: any = null;
      let aiMessage = '';
      try {
        const response = await fetch('/api/orders/read-photo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: uploadMime, ocrText: independentOcrText, schools: schools.map(s => s.name), products: products.map(p => p.name) })
        });
        const payload = await response.json();
        if (response.ok && payload.result) recognized = payload.result;
        else aiMessage = payload.error || 'AI photo reading is not configured.';
      } catch { aiMessage = 'AI photo reading is unavailable; trying built-in OCR.'; }
      if (recognized && Array.isArray(recognized.items)) {
        const fullText = [String(recognized.fullText || '').trim(), independentOcrText].filter(Boolean).join('\n\n--- Independent Hindi/English OCR ---\n');
        setOcrText(fullText);
        const schoolName = String(recognized.schoolName || '').trim();
        if (schoolName) {
          const exactSchool = schools.find(s => s.name.trim().toLocaleLowerCase() === schoolName.toLocaleLowerCase());
          const schoolMatch = exactSchool ? { s: exactSchool, score: 1 } : schools.map(s => ({ s, score: similarity(schoolName, s.name) })).sort((a, b) => b.score - a.score)[0];
          if (schoolMatch && (schoolMatch.score >= 0.45 || exactSchool)) setSchoolId(schoolMatch.s.id);
        }
        const parsed: RecognizedItem[] = recognized.items.map((item: any) => {
          const raw = String(item.rawText || '').trim();
          const chosenName = String(item.productName || '').trim();
          const exact = products.find(p => p.name.toLowerCase() === chosenName.toLowerCase());
          const best = exact ? { p: exact, score: 1 } : products.map(p => ({ p, score: similarity(raw, p.name) })).sort((a, b) => b.score - a.score)[0];
          const confidence = Number(item.confidence || best?.score || 0);
          const safeMatch = best && (exact || (confidence >= 0.78 && best.score >= 0.5));
          return { line: raw, productId: safeMatch ? best.p.id : '', confidence };
        }).filter((item: RecognizedItem) => item.line.length > 0);
        // Keep OCR-only lines too, so the second reader can recover items Gemini missed.
        const ocrLines = independentOcrText.split(/\r?\n/).map((line: string) => line.replace(/^\s*[\d.)-]+\s*/, '').trim()).filter((line: string) => line.length > 1);
        for (const line of ocrLines) {
          if (parsed.some(item => similarity(item.line, line) >= 0.78)) continue;
          const best = products.map(p => ({ p, score: similarity(line, p.name) })).sort((a, b) => b.score - a.score)[0];
          parsed.push({ line, productId: best && best.score >= 0.72 ? best.p.id : '', confidence: best?.score || 0 });
        }
        const seen = new Set<string>();
        setItems(parsed.filter(item => { const key = normalize(item.line); if (!key || seen.has(key)) return false; seen.add(key); return true; }));
        setMessage('Gemini + Hindi/English OCR comparison finished. Confirm the school and items; unmatched lines can be saved as new products.');
        return;
      }
      setMessage('Using independent Hindi/English OCR results…');
      const text = independentOcrText || '';
      setOcrText(text);
      const lines = text.split(/\r?\n/).map((line: string) => line.replace(/^\s*[\d.)-]+\s*/, '').trim()).filter((line: string) => line.length > 1);
      const ranked = lines.map((line: string) => {
        const match = products.map(p => ({ p, score: similarity(line, p.name) })).sort((a, b) => b.score - a.score)[0];
        return { line, productId: match && match.score >= 0.72 ? match.p.id : '', confidence: match?.score || 0 };
      });
      const seen = new Set<string>();
      setItems(ranked.filter((item: RecognizedItem) => { const key = normalize(item.line); if (!key || seen.has(key)) return false; seen.add(key); return true; }));
      setMessage((aiMessage ? aiMessage + ' ' : '') + 'Built-in OCR finished. Match any unclear products manually.');
    } catch (e: any) {
      setError((e?.message || 'Could not read this photo.') + ' The preview is kept if it loaded; retry or add items manually.');
    } finally { setReading(false); }
  };

  const createNewProduct = async (index: number) => {
    const item = items[index];
    const name = item?.line.trim();
    if (!name) { setError('Enter the handwritten item name before creating a new product.'); return; }
    setError(''); setMessage('');
    const existing = products.find(p => normalize(p.name) === normalize(name));
    if (existing) { updateItem(index, { productId: existing.id }); setMessage('Matched the existing saved product: ' + existing.name); return; }
    const { data, error: insertError } = await client.from('products').insert({
      name, sku: null, unit: 'piece', purchase_price: 0, selling_price: 0,
      tax_rate: 0, minimum_stock: 0, category_id: null,
      notes: 'Created from handwritten school order photo; please review price and details.',
      active: true
    }).select('id,name,unit,selling_price,tax_rate').single();
    if (insertError || !data) { setError(insertError?.message || 'Could not create this new product.'); return; }
    const product = { ...data, unit: data.unit || 'piece', selling_price: Number(data.selling_price || 0), tax_rate: Number(data.tax_rate || 0) } as Product;
    setProducts(prev => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)));
    updateItem(index, { productId: product.id, line: product.name });
    setMessage('New saved product created: ' + product.name + '. Its price is currently ₹0; update it in Products before using it for billing.');
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
    <header className="mb-6"><p className="text-sm text-emerald-700 font-semibold">Photo order entry</p><h1 className="text-3xl font-bold">Create order from notebook photo</h1><p className="text-slate-500 mt-2">Take a photo or choose one from your gallery. The preview appears immediately; AI recognition is used when configured, with built-in OCR as fallback. Every selected saved item is added once with quantity 1.</p></header>
    <section className="card p-5 mb-5 space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between"><div><h2 className="font-bold">1. Upload order photo</h2><p className="text-sm text-slate-500">Use a clear, well-lit photo with the full page visible.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => cameraRef.current?.click()} className="rounded-xl bg-emerald-600 text-white px-4 py-3 font-semibold flex gap-2 items-center"><Camera size={18}/>Take photo</button><button type="button" onClick={() => galleryRef.current?.click()} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold flex gap-2 items-center"><FileImage size={18}/>Choose from gallery</button></div></div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void readPhoto(file); e.currentTarget.value = ''; }}/>
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void readPhoto(file); e.currentTarget.value = ''; }}/>
      {imageUrl ? <img src={imageUrl} alt="Uploaded handwritten order" className="max-h-[420px] max-w-full mx-auto rounded-xl border object-contain"/> : <div className="w-full min-h-36 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-3 p-4"><FileImage size={30}/><span>Choose how to add the notebook photo</span><div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => cameraRef.current?.click()} className="rounded-lg bg-emerald-600 text-white px-4 py-2 font-semibold">Open camera</button><button type="button" onClick={() => galleryRef.current?.click()} className="rounded-lg border px-4 py-2 font-semibold">Open gallery</button></div></div>}
      {reading && <p className="text-sm text-emerald-700 flex gap-2 items-center"><LoaderCircle size={16} className="animate-spin"/>{message || 'Reading photo…'}</p>}
    </section>
    <section className="card p-5 mb-5 space-y-4">
      <h2 className="font-bold">2. Confirm school</h2>
      <label className="block text-sm font-medium">School name written at the top<select value={schoolId} onChange={e => setSchoolId(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"><option value="">Select the correct school…</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </section>
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">3. Verify items</h2><p className="text-sm text-slate-500">OCR can misread handwriting. Correct the matches before saving.</p></div><button type="button" onClick={addBlank} className="rounded-xl border px-3 py-2 text-sm">+ Add item</button></div>
      {items.length === 0 && <p className="text-sm text-slate-500 rounded-xl bg-slate-50 p-4">No lines detected yet. Upload a photo or add an item manually.</p>}
      <div className="space-y-3">{items.map((item, index) => <div key={index} className="border rounded-xl p-3 space-y-2"><div className="flex gap-2"><input value={item.line} onChange={e => updateItem(index, { line: e.target.value })} placeholder="Text read from notebook" className="min-w-0 flex-1 border rounded-lg px-3 py-2"/><button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))} aria-label="Remove item" className="p-2 text-red-600"><Trash2 size={17}/></button></div><select value={item.productId} onChange={e => updateItem(index, { productId: e.target.value })} className="w-full border rounded-lg px-3 py-2 bg-white"><option value="">Choose matching saved item…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="text-xs text-slate-500">Order quantity: <b>1</b> · Price from saved product</p>{!item.productId && item.line.trim() && <button type="button" onClick={() => void createNewProduct(index)} className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm font-semibold">+ Save “{item.line.trim()}” as a new product</button>}</div>)}</div>
      {ocrText && <details className="text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Show full OCR text</summary><textarea value={ocrText} onChange={e => setOcrText(e.target.value)} rows={5} className="mt-2 w-full border rounded-xl p-3"/></details>}
      {error && <p className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
      {message && !reading && <p className="rounded-xl bg-emerald-50 text-emerald-800 p-3 text-sm flex gap-2 items-start"><CheckCircle2 size={17} className="shrink-0 mt-0.5"/>{message}</p>}
      <button type="button" disabled={saving || reading} onClick={saveOrder} className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold disabled:opacity-50">{saving ? 'Creating order…' : 'Create one order for this school'}</button>
    </section>
  </div></main></div>;
}
