'use client';

import dynamic from 'next/dynamic';

const AuthButtons = dynamic(() => import('./AuthButtons.client'), { ssr: false });

export function HomeClient() {
  return <AuthButtons />;
}