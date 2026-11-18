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

const themeBootstrap = `(function(){var theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';try{var saved=localStorage.getItem('moneta-theme');if(saved==='light'||saved==='dark')theme=saved}catch(_){}var root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#111113':'#f2eee4';})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head>
    <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
  </head><body style={{ margin: 0 }}><ServiceWorkerRegistration />{children}</body></html>;
}
