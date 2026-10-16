import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gemini is not configured yet. Add GEMINI_API_KEY in Vercel Environment Variables, or use the built-in OCR fallback.' }, { status: 503 });
  try {
    const body = await request.json();
    const imageBase64 = String(body?.imageBase64 || '');
    const mimeType = String(body?.mimeType || '');
    if (!imageBase64 || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return NextResponse.json({ error: 'Please upload a JPG, PNG, or WebP photo.' }, { status: 400 });
    }
    if (imageBase64.length > 12_000_000) return NextResponse.json({ error: 'Photo is too large. Please choose a smaller or compressed image.' }, { status: 413 });
    const schools = Array.isArray(body?.schools) ? body.schools.slice(0, 200).map((x: unknown) => String(x)) : [];
    const products = Array.isArray(body?.products) ? body.products.slice(0, 500).map((x: unknown) => String(x)) : [];
    const prompt = `Read this photo of a handwritten school order notebook. The school name is usually written at the top. Extract only actual product/item names from the list; ignore quantities, prices, serial numbers, headings and notes. Use the supplied catalogue to map each handwritten item to the closest exact saved product name ONLY when reasonably confident. Do not invent items. Preserve the raw text for unclear items and mark them uncertain. Respond with JSON only in this schema: {"schoolName":"string or empty","items":[{"rawText":"what is written","productName":"exact catalogue name or empty","confidence":0.0,"uncertain":true}],"fullText":"transcription"}. Confidence is 0 to 1. If you cannot read an item, productName must be empty and uncertain true. A photo is one school order; quantities will be set to 1 by the app regardless of handwritten quantities. Saved schools: ${schools.join(' | ')}. Saved products: ${products.join(' | ')}.`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      }),
      signal: AbortSignal.timeout(25000)
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'Gemini could not read the photo.' }, { status: 502 });
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
    if (!text) return NextResponse.json({ error: 'No readable text was returned. Try a clearer photo.' }, { status: 502 });
    let parsed;
    try { parsed = JSON.parse(text); } catch { return NextResponse.json({ error: 'The photo response could not be parsed. Please retry.' }, { status: 502 }); }
    return NextResponse.json({ result: parsed });
  } catch (error: any) {
    return NextResponse.json({ error: error?.name === 'TimeoutError' ? 'Photo reading timed out. Try a smaller, clearer photo.' : 'Unable to process this photo right now.' }, { status: 500 });
  }
}
