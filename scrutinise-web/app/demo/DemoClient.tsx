'use client';

import Link from 'next/link';

export default function ProtectedDemo() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Scrutinise demo</h1>
        <p className="text-gray-400">
          This is the demo area. Authentication with Clerk will be added later.
        </p>
        <Link href="/" className="underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
