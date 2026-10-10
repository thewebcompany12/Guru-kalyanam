import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy.' }, { status: 503 });

  try {
    const body = await request.json();
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const newName = typeof body.newName === 'string' ? body.newName.trim() : '';
    if (!newName) return NextResponse.json({ error: 'पहले नया स्कूल का नाम लिखें।' }, { status: 400 });
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'कृपया सही image upload करें।' }, { status: 400 });
    if (match[2].length > 8_000_000) return NextResponse.json({ error: 'Image 6 MB से छोटी होनी चाहिए। बड़ी image को पहले crop करें।' }, { status: 413 });

    const prompt = `Edit this exact uploaded school banner/poster image. The ONLY requested change is to replace every occurrence of the old school/institution name with this exact new name: "${newName}".

Carefully inspect the entire image and identify all occurrences of the school name, including small text near the top, bottom, corners, headers, footers and any repeated labels. Replace only those school-name words. Do NOT replace unrelated headings, slogans, scheme names, district/block text, explanatory text, phone numbers, logos or illustrations.

Most important: preserve the original design and composition. Keep the same colours, gradients, patterns, borders, background illustrations, characters, icons, spacing, typography style, text effects and layout. Reconstruct the pixels behind the old name naturally so there is no plain colour rectangle, patch, blur, seam or visible editing mark. Make the new name look originally printed in the design, with matching perspective, font weight, colour, outline, shadow, alignment and size. Fit the exact new name into the original name area; if necessary slightly reduce font size rather than overlapping nearby content.

Do not redesign the whole poster. Do not invent new text. Preserve all other visible content exactly as much as possible. Return the edited full image, not a description. This is a print design, so keep edges crisp and retain the input aspect ratio and as much resolution/detail as the model supports.`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '1K' } }
      }),
      signal: AbortSignal.timeout(50000)
    });
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: result?.error?.message || 'Gemini image editing failed. Please check the model access and API key.' }, { status: 502 });
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
    const data = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    const mime = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || 'image/png';
    if (!data) {
      const explanation = parts.map((p: any) => p?.text || '').filter(Boolean).join(' ').slice(0, 500);
      return NextResponse.json({ error: explanation || 'Gemini returned no edited image. Try a smaller image or another name.' }, { status: 502 });
    }
    return NextResponse.json({ editedImageDataUrl: 'data:' + mime + ';base64,' + data, note: 'AI-generated edit ready. Review every line of text and all artwork before printing.' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'Gemini image editing timed out. Try cropping the banner or using a smaller image, then retry.' : (error instanceof Error ? error.message : 'Unable to edit this image right now. Please try again.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
