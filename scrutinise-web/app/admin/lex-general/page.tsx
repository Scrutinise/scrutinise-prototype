import Link from 'next/link'
import LexGeneralChat from '@/components/admin/LexGeneralChat'

// /admin/lex-general — the Lex thread with no idea attached.
//
// Placed under /admin so that app/admin/layout.tsx's Clerk + role gate applies
// without a second gating path to keep in step with the first; the API route
// re-checks the role independently. The brief allows either this or a bare
// /lex-general, and one gate that is already load-bearing beats a new one.
export const metadata = {
  title: 'Corpus chat — Admin',
}

export default function LexGeneralPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← Admin Panel
          </Link>
          <h1 className="mt-1 text-lg font-semibold">Corpus chat</h1>
          <p className="text-xs text-muted-foreground">
            Ask the whole corpus anything, through the search gateway, untiered. Admin-only: it
            bypasses the idea structure entirely. Read-only — no idea data is read or written, and
            the transcript is not saved.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <LexGeneralChat />
      </div>
    </div>
  )
}
