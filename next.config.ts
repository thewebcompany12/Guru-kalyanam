import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
    ];
    return [
      { source: '/sw.js', headers: [...security,{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },{ key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/manifest.webmanifest', headers: [...security,{ key: 'Content-Type', value: 'application/manifest+json' },{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
      { source: '/(.*)', headers: security },
    ];
  },
};

export default nextConfig;
