'use client'

import { use } from 'react'
import Link from 'next/link'
import { MOCK_IDEAS } from '@/lib/mockData'
import DiffView from '@/components/DiffView'

type Props = { params: Promise<{ id: string }> }

export default function AmendmentPage({ params }: Props) {
  const { id } = use(params)

  // Find the amendment across all ideas
  let amendment = null
  let idea = null
  for (const i of MOCK_IDEAS) {
    const a = i.amendments.find(a => a.id === id)
    if (a) { amendment = a; idea = i; break }
  }

  if (!amendment || !idea) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-gray-400">Amendment not found.</p>
        <Link href="/prototype/dashboard" className="text-revolutBlue hover:underline text-sm">
          &#8592; Back to dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-2">
        <Link href="/prototype/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          &#8592; Back to dashboard
        </Link>
      </div>

      <div className="mt-6 mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Amendment Proposed</div>
        <h1 className="text-2xl font-bold text-white mb-2 leading-snug">{idea.title}</h1>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Proposed by <strong className="text-gray-300">{amendment.proposedBy}</strong></span>
          <span>&middot;</span>
          <span>{amendment.createdAt}</span>
          <span className="px-2 py-0.5 bg-amber-900 text-amber-300 rounded-full font-medium capitalize">
            {amendment.status}
          </span>
        </div>
      </div>

      <DiffView
        current={amendment.currentWording}
        proposed={amendment.proposedWording}
      />
    </main>
  )
}
