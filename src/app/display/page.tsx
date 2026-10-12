import { Suspense } from 'react';
import DisplayClient from './DisplayClient';

export const metadata = { title: 'Audience display — Frontline Atlas' };

export default function DisplayPage() {
  return (
    <Suspense fallback={null}>
      <DisplayClient />
    </Suspense>
  );
}
