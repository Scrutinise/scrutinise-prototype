import Link from 'next/link'
import PositionGraphExplorer from '@/components/admin/PositionGraphExplorer'

// /admin/positions — GRAPH 3A §6.
//
// Under /admin so that app/admin/layout.tsx's Clerk + role gate applies, exactly as
// /admin/lex-general does; the API route re-checks the role independently. Design §8 requires
// this to be admin-only until the hand-labelled validation set has scored the estimates, and the
// page says so on its face rather than only in a document.
export const metadata = {
  title: 'Position graph — Admin',
}

export default function PositionsAdminPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-900">← Admin Panel</Link>
          <h1 className="mt-1 text-lg font-semibold">Position graph</h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-500">
            Who has a recorded position on a specific division, motion, inquiry or organisation —
            with the dated evidence behind every line. Built from votes, EDM signatures, witness
            appearances and declared interests; nothing here is extracted by a model.
          </p>
          <p className="mt-2 max-w-3xl rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Estimates, not verdicts, and not yet validated.</strong> The weights, half-lives
            and the free-vote heuristic are provisional starting values. None has been scored
            against a hand-labelled answer key, which is the gate on any of this reaching a user
            (design §8). This page exists so the graph can be argued with before that happens.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <PositionGraphExplorer />
      </div>
    </div>
  )
}
