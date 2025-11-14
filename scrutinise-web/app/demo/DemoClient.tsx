'use client';

import dynamic from 'next/dynamic';

const ProtectedDemo = dynamic(
  () => import('../../components/ProtectedDemo.client'),
  { ssr: false }
);

export default function DemoClient() {
  return <ProtectedDemo />;
}
