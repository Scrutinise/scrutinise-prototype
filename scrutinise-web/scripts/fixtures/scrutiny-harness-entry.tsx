// LEX 26-AC (a) — THE PAGE check:lex-26ac LOADS (bundled with esbuild): the REAL EditionReader, given a view the check built from a real
// edition (or the pure fixture), and the REAL ScrutinyOwner (the owner's page), given a draft built from the same view. Nothing reads or
// writes a database: the owner's page's calls to /api/ideas/fx/scrutiny are answered by the check (page.route).
//   window.__view, window.__banner, window.__draft are set by the check; window.__mount() / window.__mountOwner() render.

import React from 'react'
import { createRoot } from 'react-dom/client'
import EditionReader from '@/components/lex/scrutiny/EditionReader'
import ScrutinyOwner, { type OwnerDraft } from '@/components/lex/scrutiny/ScrutinyOwner'
import * as LABELS from '@/lib/lex/screen-labels'
import type { EditionView } from '@/lib/lex/scrutiny-edition-pure'

const w = window as unknown as { __view: EditionView; __banner: 'preview' | 'draft' | null; __draft: OwnerDraft; __labels: typeof LABELS; __mount: () => void; __mountOwner: () => void }
w.__labels = LABELS
w.__mount = () => {
  createRoot(document.getElementById('root')!).render(<EditionReader view={w.__view} banner={w.__banner} />)
}
w.__mountOwner = () => {
  createRoot(document.getElementById('root')!).render(
    <ScrutinyOwner ideaId="fx" title="Landlord registration (fixture)" owner editions={[
      { id: w.__draft.id, number: w.__draft.number, status: 'DRAFT', versionNumber: w.__draft.versionNumber, createdAt: '2026-11-23T00:00:00Z', publishedAt: null, blind: false, publishedAnyway: false, checklist: null },
      { id: 'ed-0', number: w.__draft.number - 1, status: 'PUBLISHED', versionNumber: 1, createdAt: '2026-11-01T00:00:00Z', publishedAt: '2026-11-02T00:00:00Z', blind: false, publishedAnyway: true, checklist: { ...w.__draft.checklist, publishedAnyway: true, at: '2026-11-02T00:00:00Z' } },
    ]} draft={w.__draft} />,
  )
}
