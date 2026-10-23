// LEX 26-V1 — THE PAGE THE DOCUMENTS-TREE BROWSER CHECK LOADS (scripts/check-lex-26v.ts bundles this with esbuild).
// The REAL DocumentsTree, in a real browser; every request it makes is answered by the REAL route handlers on a scratch copy (the check
// routes them). `window.__tree = { ideaId, readOnly }` is set by the check before this runs.

import React from 'react'
import { createRoot } from 'react-dom/client'
import DocumentsTree from '@/components/lex/DocumentsTree'

const { ideaId, readOnly } = (window as unknown as { __tree: { ideaId: string; readOnly: boolean } }).__tree
createRoot(document.getElementById('root')!).render(<DocumentsTree ideaId={ideaId} readOnly={readOnly} />)
