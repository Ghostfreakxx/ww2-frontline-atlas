import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  // The presenter (iPad) and display (computer) usually reach the dev server over the LAN.
  allowedDevOrigins: ['*.local', '192.168.*.*', '10.*.*.*', '172.16.*.*'],
  headers: async () => [
    { source: '/geo/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
    // The service worker must always be revalidated so updates reach installed apps.
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }] },
  ],
};

export default nextConfig;
