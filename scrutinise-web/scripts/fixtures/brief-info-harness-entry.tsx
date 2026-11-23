// LEX 26-AB — THE PAGE check:lex-26ab LOADS (bundled with esbuild): the REAL BriefSection, one block per Brief kind, its view answered
// by the check (page.route on action-documents), so nothing reads or writes a database. It exposes the label tables, the ⓘ text and the
// field guide FROM THIS SAME BUNDLE, so the check reads the words the screen was built with.
//   window.__bv = <a BriefView> is set by the check; window.__mount() renders.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { keepForUser } from '@/lib/lex/offline'
import BriefSection from '@/components/lex/BriefSection'
import * as LABELS from '@/lib/lex/screen-labels'
import * as INFO from '@/lib/lex/brief-info'
import { KIND_FIELDS } from '@/lib/lex/action-brief-pure'
import { explainField, guideEntries, normLabel } from '@/lib/lex/field-guide'
import type { BriefView } from '@/lib/lex/action-brief'

const w = window as unknown as { __bv: BriefView; __labels: typeof LABELS; __info: typeof INFO; __kindFields: typeof KIND_FIELDS; __guide: unknown; __mount: () => void }
w.__labels = LABELS
w.__info = INFO
w.__kindFields = KIND_FIELDS
w.__guide = { explainField, guideEntries, normLabel }

w.__mount = () => {
  void keepForUser('u-harness') // as the page: the kept typing is keyed by the confirmed user
  createRoot(document.getElementById('root')!).render(
    <div style={{ padding: 16 }}>
      <BriefSection ideaId="zz-harness" a={{ id: 'a1', number: 7, avenue: 'ORGANISATIONAL' }} disabled={false} onChanged={() => undefined} initialView={w.__bv} />
    </div>,
  )
}
