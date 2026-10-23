'use client'

// LEX 26-V1 §6 (decision 244) — the law table at the top of the Deepening page: the same GRAPH 7 panel the Overview's Law tab shows,
// read through /api/ideas/[id]/law-set. ⚠ A failed read is said, never shown as "no law attached".

import { useEffect, useState } from 'react'
import IdeaLawPanel from './IdeaLawPanel'
import type { IdeaLawSet } from '@/lib/lex/idea-law-pure'

export default function DeepeningLawTable({ ideaId }: { ideaId: string }) {
  const [data, setData] = useState<{ set: IdeaLawSet | null; error: string | null } | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/ideas/${ideaId}/law-set`).then(async (r) => {
      const b = await r.json().catch(() => null)
      if (live) setData(r.ok && b ? b : { set: null, error: `the server answered ${r.status}` })
    }).catch((e) => live && setData({ set: null, error: e instanceof Error ? e.message : String(e) }))
    return () => { live = false }
  }, [ideaId])
  if (!data) return <p className="text-xs text-zinc-500">Reading the law this idea concerns…</p>
  return <IdeaLawPanel set={data.set} error={data.error} />
}
