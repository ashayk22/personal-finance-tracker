import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Moneta',
    short_name: 'Moneta',
    description: 'A thoughtful personal finance tracker.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#10131a',
    theme_color: '#10131a',
    icons: [
      { src: '/icons/moneta-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/moneta-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/moneta-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
