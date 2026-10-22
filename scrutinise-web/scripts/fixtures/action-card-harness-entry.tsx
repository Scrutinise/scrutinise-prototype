// 26-U §2 (22 Oct 2026) - THE PAGE check:lex-26u's browser part loads (bundled with esbuild). The REAL ActionCard (the opened record's
// statement, as Charlie edits it) mounted with an action whose statement is over the limit. `window.__card.updates` records every Save
// that reached the API; nothing else is stood in for.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { ActionCard } from '@/components/lex/FieldsPanel'

type A = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const hooks: A = { updates: [] as unknown[] }
;(window as A).__card = hooks

;(window as A).__mountCard = (statement: string) => {
  const action: A = {
    id: 'a38', number: 38, title: 'Legislate a single named-owner duty', practicalStep: statement, commentary: 'Parts of this action, quoted\n• [#34] “A part.”',
    mechanismType: null, targetOrganisation: null, wording: null, whoImplements: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null,
  }
  const api: A = { update: (id: string, d: unknown) => { hooks.updates.push({ id, d }) } }
  createRoot(document.getElementById('root')!).render(
    <ActionCard action={action as never} benchmarks={[]} costLines={[]} busy={false} api={api as never} costLinesApi={{ add: () => {}, remove: () => {} } as never} step={1} />,
  )
}
