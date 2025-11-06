'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function AuthButtons() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="bg-yellow-400 text-black px-6 py-2 rounded-full font-semibold">Sign In</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-4">
          <Link href="/demo" className="bg-yellow-400 text-black px-6 py-2 rounded-full font-semibold">Demo</Link>
          <UserButton />
        </div>
      </SignedIn>
    </>
  );
}