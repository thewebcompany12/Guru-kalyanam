import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'Gemini is not configured yet. Add GEMINI_API_KEY in Vercel Environment Variables, then redeploy.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    if (!imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Please upload a valid image template.' }, { status: 400 });
    }

    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'The uploaded image could not be read.' }, { status: 400 });

    const mimeType = match[1];
    const data = match[2];
    if (data.length > 12_000_000) {
      return NextResponse.json({ error: 'Image is too large. Please use an image under about 9 MB.' }, { status: 413 });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Analyze this school banner/poster image. Find every visible occurrence of the school/institution name only (not general headings, slogans, or other text). Return JSON only in this exact schema: {"matches":[{"text":"exact existing school name","x":0.1,"y":0.1,"width":0.3,"height":0.08,"background":"#ffffff","textColor":"#111827","fontSize":32,"align":"center"}]}. Coordinates x,y,width,height must be normalized 0..1 relative to the full image and tightly surround the existing school-name text including its background area if practical. Use at most 8 matches. If there is no clear school name, return {"matches":[]}. Never guess a replacement name. background should be the closest simple background color around the text, not a gradient. fontSize is a relative suggested pixel size for a 1000px-wide image. align must be left, center, or right.' },
              { inlineData: { mimeType, data } },
            ],
          }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      },
    );

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: result?.error?.message || 'Gemini could not analyze this image.' }, { status: 502 });
    }

    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '{"matches":[]}';
    let parsed: { matches?: Array<{ text?: string; x?: number; y?: number; width?: number; height?: number; background?: string; textColor?: string; fontSize?: number; align?: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ matches: [], note: 'AI could not confidently identify a school-name area. You can still use the template preview.' });
    }

    const matches = (Array.isArray(parsed.matches) ? parsed.matches : []).slice(0, 8).map((item) => ({
      text: String(item.text || '').slice(0, 160),
      x: clamp(item.x, 0, 0.98),
      y: clamp(item.y, 0, 0.98),
      width: clamp(item.width, 0.02, 1),
      height: clamp(item.height, 0.02, 1),
      background: safeColor(item.background, '#ffffff'),
      textColor: safeColor(item.textColor, '#111827'),
      fontSize: clamp(item.fontSize, 10, 120),
      align: ['left', 'right', 'center'].includes(String(item.align)) ? item.align : 'center',
    }));
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: 'Unable to analyze this image right now. Please try again.' }, { status: 500 });
  }
}

function clamp(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, number));
}

function safeColor(value: unknown, fallback: string) {
  const color = String(value || '');
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}
