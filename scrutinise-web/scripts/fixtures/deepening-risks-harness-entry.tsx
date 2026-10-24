// LEX 26-V2d — THE PAGE THE REVIEW / RISKS BROWSER CHECK LOADS (scripts/check-lex-26v2d.ts bundles this with esbuild).
// The Deepening page's two panels as the page mounts them: the REAL DocumentsTree, then the REAL RisksView. Every request they make is
// answered by the REAL route handlers on a scratch copy (the check routes them). `window.__tree = { ideaId, readOnly }` is set first.

import React from 'react'
import { createRoot } from 'react-dom/client'
import DocumentsTree from '@/components/lex/DocumentsTree'
import RisksView from '@/components/lex/RisksView'

const { ideaId, readOnly } = (window as unknown as { __tree: { ideaId: string; readOnly: boolean } }).__tree
createRoot(document.getElementById('root')!).render(
  <div>
    <section data-deepening="documents"><DocumentsTree ideaId={ideaId} readOnly={readOnly} /></section>
    <section data-deepening="risks"><RisksView ideaId={ideaId} readOnly={readOnly} /></section>
  </div>,
)
