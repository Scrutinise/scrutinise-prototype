// LEX 26-V1b — THE PAGE THE DOCUMENT-VIEW BROWSER CHECK LOADS (scripts/check-lex-26v1b.ts bundles this with esbuild).
// The REAL DocumentView, the REAL JumpBand and (V1b-b) the REAL ActionsWorkspace, in a real browser; every request is answered by the REAL route
// handlers on a scratch copy. `window.__dv = { mode, ideaId, documentId, width, step }` is set by the check before this runs.
//   mode 'workspace': the list / board on the copy; its re-read is `/api/ideas/<id>/canonical-for-check`, which the check answers with
//   computeCanonicalState — the reader the page itself uses.

import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import DocumentView from '@/components/lex/DocumentView'
import ActionsWorkspace from '@/components/lex/ActionsWorkspace'
import { JumpBand } from '@/components/lex/ActionRecordSections'
import { bandStates } from '@/lib/lex/record-layout-pure'

type Dv = { mode: 'view' | 'band' | 'workspace'; ideaId: string; documentId: string; width: number; step?: 1 | 2 | 3 | 4 }
const dv = (window as unknown as { __dv: Dv }).__dv
const states = bandStates({ detail: 'Some detail.', documents: { needed: 2, drafted: 1, accepted: 0, total: 1 }, lawRows: 7, whoAnswered: 1, whoOf: 7, costs: 'not answered', after: [59], comments: 3 })

type S = { actions: never[]; setAsideActions: never[]; actionHeadings: never[]; conditions: never }
function Workspace() {
  const [s, setS] = useState<S | null>(null)
  const reread = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/ideas/${dv.ideaId}/canonical-for-check`)
    if (!res.ok) return false
    setS(await res.json())
    return true
  }, [])
  useEffect(() => { void reread() }, [reread])
  if (!s) return <p>loading</p>
  return <ActionsWorkspace ideaId={dv.ideaId} actions={s.actions} setAside={s.setAsideActions} headings={s.actionHeadings} causes={[]} busy={false} step={dv.step ?? 1}
    onChanged={reread} renderFull={(_a, _st, between) => <div data-full-card>{between}</div>} structure={{ conditions: s.conditions, headingPlan: null, archivedHeadings: [], resortUndoable: 0 }} />
}

createRoot(document.getElementById('root')!).render(
  dv.mode === 'view'
    ? <DocumentView ideaId={dv.ideaId} documentId={dv.documentId} />
    : dv.mode === 'workspace' ? <Workspace />
    : <div style={{ width: dv.width }}><JumpBand states={states} onJump={() => {}} headingSelect={<select aria-label="Heading"><option>Primary legislation</option></select>} /></div>,
)
