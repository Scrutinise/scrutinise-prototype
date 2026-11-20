// LEX 26-AA item 5 — THE PAGE check:lex-26aa LOADS (bundled with esbuild): the REAL SourceBrowser (the Sources list's controls, in "list"
// mode as the research panel mounts it and in "pick" mode as Add research's picker does) and the REAL AddResearch (as a dialog, and bare),
// every request answered by the real route handlers on a scratch copy. It exposes the label tables and the field guide FROM THIS SAME
// BUNDLE, so the check can rename a label before mounting and ask the guide about the new word.
//   window.__rh = { mode: 'sources' | 'pick' | 'dialog' | 'bare', ideaId } is set by the check; window.__mount() renders.
// (scripts/fixtures/research-harness-entry.tsx is a different page: 26-S2's research panel against a stand-in store.)

import React from 'react'
import { createRoot } from 'react-dom/client'
import SourceBrowser from '@/components/lex/SourceBrowser'
import AddResearch from '@/components/lex/AddResearch'
import * as LABELS from '@/lib/lex/screen-labels'
import { explainField, guideEntries, normLabel } from '@/lib/lex/field-guide'

type Rh = { mode: 'sources' | 'pick' | 'dialog' | 'bare'; ideaId: string }
const w = window as unknown as { __rh: Rh; __labels: typeof LABELS; __guide: unknown; __mount: () => void }
w.__labels = LABELS
w.__guide = { explainField, guideEntries, normLabel }

w.__mount = () => {
  const rh = w.__rh
  const el = rh.mode === 'sources'
    // the research panel draws its own cards from what the list hands it; the cards are SourcesRegistry's, not this component's
    ? <SourceBrowser ideaId={rh.ideaId} mode="list">{(shown) => <ul data-host-cards>{shown.map((s) => <li key={s.id}>{s.title}</li>)}</ul>}</SourceBrowser>
    : rh.mode === 'pick' ? <SourceBrowser ideaId={rh.ideaId} mode="pick" onPick={() => undefined} />
      : <AddResearch ideaId={rh.ideaId} defaultOpen bare={rh.mode === 'bare'} />
  createRoot(document.getElementById('root')!).render(el)
}
