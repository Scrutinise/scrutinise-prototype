'use client';

import { SignedIn } from '../clerk/nextjs';
import Link from 'next/link';

export default function ProtectedDemo() {
  return (
    <SignedIn>
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8" style={{ color: '#D4AF37' }}>Demo: Abolish the College of Policing</h1>
          {/* ... all your demo content ... */}
          <Link href="/" className="text-yellow-400 underline">Back</Link>
        </div>
      </div>
    </SignedIn>
  );
}