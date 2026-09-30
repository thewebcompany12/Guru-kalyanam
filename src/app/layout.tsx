import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import PWARegister from '@/components/PWARegister';
import OfflineBanner from '@/components/OfflineBanner';
import InstallPrompt from '@/components/InstallPrompt';
import AuthGate from '@/components/AuthGate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'School Supply Ops',
  description: 'Government school supply business management',
  applicationName: 'School Supply Ops',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon-192.svg', type: 'image/svg+xml', sizes: '192x192' }, { url: '/icons/icon-512.svg', type: 'image/svg+xml', sizes: '512x512' }] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#17202a' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><PWARegister/><OfflineBanner/><InstallPrompt/><AuthGate>{children}</AuthGate></body></html>;
}
