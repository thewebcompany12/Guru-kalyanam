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
    const ocrText = String(body?.ocrText || '').slice(0, 12000);
    const prompt = `You are extracting one school's handwritten supply order. Understand BOTH Hindi/Devanagari and English, including mixed Hindi-English writing, spelling variations, transliteration, phonetic spellings and common school/item-name equivalents. The saved catalogue may be in English while the handwriting is Hindi, or vice versa. The school name is usually at the top: identify it and match it to the closest saved school by meaning/pronunciation across scripts; if confident, return the exact saved school name in schoolName. Also return rawSchoolName exactly as best read. For each actual product line, use the saved catalogue's exact name in productName when a bilingual/phonetic match is reasonably confident. Otherwise keep productName empty and preserve the handwritten text in rawText so the user can create a new catalogue item. Do not silently drop unclear item lines. Ignore quantities/prices/serial numbers when identifying product names, but preserve item lines; do not invent lines. Use the attached photo AND this independent OCR transcript as two evidence sources; resolve disagreements conservatively and mention the whole readable transcript in fullText. Respond with JSON only: {"schoolName":"exact saved school name or empty","rawSchoolName":"school name as written or empty","items":[{"rawText":"what is written","productName":"exact saved catalogue name or empty","confidence":0.0,"uncertain":true}],"fullText":"transcription"}. Confidence is 0 to 1. Never claim a low-confidence match as certain. A photo is one school order; the app sets quantity 1 for every selected item. Saved schools: ${schools.join(' | ')}. Saved products: ${products.join(' | ')}. Independent OCR transcript (may contain errors): ${ocrText}`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + encodeURIComponent(key), {
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
