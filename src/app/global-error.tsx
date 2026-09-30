'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Global application error:', error); }, [error]);

  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Arial, Helvetica, sans-serif', background: '#f6f7f9', color: '#17202a' }}>
          <section style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 16, border: '1px solid #e5e7eb', background: '#fff', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>Guru Kalyanam needs to restart</h1>
            <p style={{ color: '#64748b', lineHeight: 1.6 }}>A temporary application error occurred. Please retry.</p>
            <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: '10px 18px', border: 0, borderRadius: 12, background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </section>
        </main>
      </body>
    </html>
  );
}
