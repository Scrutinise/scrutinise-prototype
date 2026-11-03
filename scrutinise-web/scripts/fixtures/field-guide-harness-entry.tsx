// LEX 26-W-b — THE PAGE check:lex-26w-b LOADS (bundled with esbuild). The REAL ActionsWorkspace with one record opened and the REAL
// ActionCard inside it, or the REAL DocumentView, every request answered by the real route handlers on a scratch copy.
// It also exposes the label tables and the field guide FROM THIS SAME BUNDLE, so the check can rename a label before mounting and ask
// the guide about the new word: the screen and the guide must move together.
//   window.__fg = { mode: 'record' | 'view', ideaId, actionId?, documentId?, step? } is set by the check; window.__mount() renders.

import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import DocumentView from '@/components/lex/DocumentView'
import ActionsWorkspace from '@/components/lex/ActionsWorkspace'
import { ActionCard } from '@/components/lex/FieldsPanel'
import * as LABELS from '@/lib/lex/screen-labels'
import { explainField, guideEntries, normLabel } from '@/lib/lex/field-guide'

type Fg = { mode: 'record' | 'view'; ideaId: string; actionId?: string; documentId?: string; step?: 1 | 2 | 3 | 4 }
const w = window as unknown as { __fg: Fg; __labels: typeof LABELS; __guide: unknown; __mount: () => void }
w.__labels = LABELS
w.__guide = { explainField, guideEntries, normLabel }

type S = { actions: never[]; setAsideActions: never[]; actionHeadings: never[]; conditions: never; costLines: never[]; benchmarks: never[] }
function Record_() {
  const fg = w.__fg
  const [s, setS] = useState<S | null>(null)
  const reread = useCallback(async (): Promise<boolean> => {
    const res = await fetch(`/api/ideas/${fg.ideaId}/canonical-for-check`)
    if (!res.ok) return false
    setS(await res.json())
    return true
  }, [fg.ideaId])
  useEffect(() => { void reread() }, [reread])
  if (!s) return <p>loading</p>
  const noop = (() => undefined) as never
  return (
    <ActionsWorkspace ideaId={fg.ideaId} actions={s.actions} setAside={s.setAsideActions} headings={s.actionHeadings} causes={[]} busy={false} step={fg.step ?? 1}
      onChanged={reread} initiallyOpen={[fg.actionId!]} costLineActionIds={[]}
      renderFull={(a, st, between) => <ActionCard action={a as never} step={st as never} between={between} benchmarks={s.benchmarks} costLines={(s.costLines as Array<{ actionId: string }>).filter((l) => l.actionId === (a as { id: string }).id) as never} busy={false}
        api={{ update: noop, add: noop, remove: noop } as never} costLinesApi={{ add: noop, remove: noop, suggest: async () => null } as never} />}
      structure={{ conditions: s.conditions, headingPlan: null, archivedHeadings: [], resortUndoable: 0 }} />
  )
}

w.__mount = () => {
  const fg = w.__fg
  createRoot(document.getElementById('root')!).render(
    fg.mode === 'view' ? <DocumentView ideaId={fg.ideaId} documentId={fg.documentId!} /> : <Record_ />,
  )
}
