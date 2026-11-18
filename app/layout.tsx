import type { Metadata, Viewport } from 'next';
import React from 'react';
import ServiceWorkerRegistration from './ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'Moneta — Personal Finance',
  description: 'A thoughtful personal finance tracker.',
  applicationName: 'Moneta',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Moneta', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/moneta-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/moneta-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/moneta-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#10131a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ margin: 0 }}><ServiceWorkerRegistration />{children}</body></html>;
}
