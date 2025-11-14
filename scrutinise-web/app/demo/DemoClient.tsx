'use client';

import dynamic from 'next/dynamic';

// Ensure the file exists at the specified path, or update the path below if needed.
const ProtectedDemo = dynamic(
  () => import('../../components/ProtectedDemo.client'),
  { ssr: false }
);

export function DemoClient() {
  return <ProtectedDemo />;
}