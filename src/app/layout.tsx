import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frontline Atlas — WWII podcast map',
  description: 'iPad-controlled historical war-map presentation system for history podcasts.',
  applicationName: 'Frontline Atlas',
  appleWebApp: { capable: true, title: 'Frontline Atlas', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1c1d1f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
