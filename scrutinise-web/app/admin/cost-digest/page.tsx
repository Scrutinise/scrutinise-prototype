import Link from 'next/link'
import CostDigestRaw from '@/components/admin/CostDigestRaw'

// /admin/cost-digest — S25 §4. The raw-counters link the daily cost digest email points to
// ("raw counters move to a link, not the email body"). Under /admin so app/admin/layout.tsx's
// Clerk + role gate applies, exactly as /admin/positions and /admin/lex-general do; the API
// route re-checks the role independently.
export const metadata = {
  title: 'Cost digest — Admin',
}

export default function CostDigestAdminPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-900">← Admin Panel</Link>
          <h1 className="mt-1 text-lg font-semibold">Cost digest — raw counters</h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-500">
            Everything the daily cost digest email computed, unsummarised. The email carries
            the £ totals and splits; this is the same data underneath it, for when the
            summary alone doesn&apos;t answer the question.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <CostDigestRaw />
      </div>
    </div>
  )
}
