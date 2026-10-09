'use client'

import { useState } from 'react'
import AddResearch from '@/components/lex/AddResearch'

export default function AddResearchWindow({ ideaId, ideaTitle, initial }: { ideaId: string; ideaTitle: string; initial: { url?: string; title?: string; text?: string } }) {
  const [saved, setSaved] = useState(false)
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="text-base font-semibold text-zinc-900">Add research</h1>
      <p className="text-xs text-zinc-600 mb-3">To <strong>{ideaTitle}</strong>. {initial.text ? 'The passage you selected is filled in as the quote.' : 'Select text on the page before pressing the bookmark and it arrives as the quote.'}</p>
      <AddResearch ideaId={ideaId} bare initial={initial} onSaved={() => setSaved(true)} />
      {saved && <p className="text-xs text-zinc-600 mt-2">You can close this tab and carry on reading.</p>}
    </main>
  )
}
