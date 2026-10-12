import type { MetadataRoute } from 'next';

// Installable web app. The home-screen app opens the iPad presenter; the audience display stays a
// browser tab or OBS browser source on the computer (shortcut below).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Frontline Atlas',
    short_name: 'Atlas',
    description: 'iPad-controlled historical war-map presentation system for history podcasts.',
    start_url: '/presenter',
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'any',
    background_color: '#161718',
    theme_color: '#161718',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Presenter', url: '/presenter', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Audience display', url: '/display', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'New session', url: '/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
