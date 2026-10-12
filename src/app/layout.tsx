import type { Metadata, Viewport } from 'next';
import './fonts.css';
import './globals.css';
import PwaRegister from './PwaRegister';

export const metadata: Metadata = {
  title: 'Frontline Atlas — WWII podcast map',
  description: 'iPad-controlled historical war-map presentation system for history podcasts.',
  applicationName: 'Frontline Atlas',
  appleWebApp: { capable: true, title: 'Atlas', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#161718',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
