'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <main className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-yellow-600 mb-4">Scrutinise</h1>
        <p className="text-xl text-gray-800 mb-8">
          Master legislation. Shape the nation.
        </p>

        <h2 className="text-2xl font-bold text-yellow-600 mb-6">
          The 7 Stages to Better Law
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {[
                { stage: 1, name: 'Idea', color: 'bg-yellow-100' },
                { stage: 2, name: 'Refine', color: 'bg-yellow-200' },
                { stage: 3, name: 'Link', color: 'bg-yellow-300' },
                { stage: 4, name: 'Amend', color: 'bg-yellow-400' },
                { stage: 5, name: 'Evidence', color: 'bg-yellow-500' },
                { stage: 6, name: 'Assemble', color: 'bg-yellow-600' },
                { stage: 7, name: 'Promote', color: 'bg-yellow-700' },
              ].map(({ stage, name, color }) => (
                <tr key={stage} className="border-b">
                  <td className="p-4 text-right font-bold text-gray-800 w-16">
                    {stage}
                  </td>
                  <td className={`p-4 font-medium text-gray-900 ${color}`}>
                    {name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </main>
  );
}
