// LEX 26-V1b — THE PAGE THE DOCUMENT-VIEW BROWSER CHECK LOADS (scripts/check-lex-26v1b.ts bundles this with esbuild).
// The REAL DocumentView and the REAL JumpBand, in a real browser; every request is answered by the REAL route handlers on a scratch copy.
// `window.__dv = { mode, ideaId, documentId, width }` is set by the check before this runs.

import React from 'react'
import { createRoot } from 'react-dom/client'
import DocumentView from '@/components/lex/DocumentView'
import { JumpBand } from '@/components/lex/ActionRecordSections'
import { bandStates } from '@/lib/lex/record-layout-pure'

const dv = (window as unknown as { __dv: { mode: 'view' | 'band'; ideaId: string; documentId: string; width: number } }).__dv
const states = bandStates({ detail: 'Some detail.', documents: { needed: 2, drafted: 1, accepted: 0, total: 1 }, lawRows: 7, whoAnswered: 1, whoOf: 7, costs: 'not answered', after: [59], comments: 3 })
createRoot(document.getElementById('root')!).render(
  dv.mode === 'view'
    ? <DocumentView ideaId={dv.ideaId} documentId={dv.documentId} />
    : <div style={{ width: dv.width }}><JumpBand states={states} onJump={() => {}} headingSelect={<select aria-label="Heading"><option>Primary legislation</option></select>} /></div>,
)
