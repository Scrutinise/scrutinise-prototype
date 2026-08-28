// ─────────────────────────────────────────────────────────────────────────────
// 25-M §1 — RENDER the Outputs panel and read the markup.
//
// ⚠ EVERYTHING §1 ADDS IS BEHIND SIGN-IN, so a route probe proves nothing: Clerk answers a
// 307 for the subject and the control alike, which is a known non-check in this codebase.
// Rendering the component is what can actually be asserted from here — and §0 asks for
// exactly this, with the rest said plainly as Charlie's to confirm.
//
// ⚠ AND IT IMPORTS REACT. Two harnesses in this directory have now been found never to have
// executed for want of this one line (`verify-lex-25e-ui`, 25-L; `verify-build-25a-ui`,
// 25-M). `tsx` compiles with the classic JSX runtime.
//
// Usage: tsx scripts/verify-outputs-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OutputsPanel from '../components/lex/OutputsPanel'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}

/**
 * ⚠ THE COMPONENT FETCHES ON MOUNT, and `renderToStaticMarkup` runs no effects — so what it
 * produces is the PRE-LOAD state. That is a real state a user sees for a moment and it is
 * worth asserting on its own terms; it is not a substitute for the loaded one, and this
 * file says so rather than implying otherwise.
 */
console.log('── verify:outputs-ui (render assertions, NOT a browser walk) ──')

const html = renderToStaticMarkup(<OutputsPanel ideaId="abc-123" />)
const text = html.split(/<[^>]+>/).join(' ').split(/\s+/).join(' ').trim()

ok('the pre-load state says what it is doing rather than showing an empty box',
  /Reading what you can take away/.test(text), text.slice(0, 160))

// ⚠ THE THINGS THAT MUST BE TRUE OF THE SOURCE, asserted here because the loaded state
// cannot be rendered without a server. Kept in this file rather than in `check:lex-25m` so
// that "the outputs panel" has one place a reader goes to see what is guaranteed about it.
const src = require('node:fs').readFileSync('components/lex/OutputsPanel.tsx', 'utf8') as string

ok('it calls the SAME endpoint the Documents tab calls — one generator, two doors',
  /\/api\/ideas\/\$\{ideaId\}\/document`/.test(src))
ok('it renders no document itself',
  !/buildProposalDocument|renderPdf|renderDocx|buildFor\(/.test(src))
ok('it says WHEN each was last generated, and whether it is now out of date',
  /Last generated \$\{when\(d\.generatedAt\)\}/.test(src) && /d\.stale/.test(src))
ok('an unavailable output states the reason rather than showing a dead button',
  /d\.unavailableReason/.test(src))
ok('both formats are offered once a document exists',
  /d\.docxUrl/.test(src) && /d\.pdfUrl/.test(src))
// ⚠ §21 — staleness is a SENTENCE, not a colour. Charlie is colour blind, and "this file is
// out of date" is the one fact a user needs before sending it to an MP.
ok('staleness is stated in words, not signalled by colour',
  /out of date\. Generate it again before you send it/.test(src))

console.log(`\n${pass} passed, ${fail} failed.`)
console.log('⚠ Render assertions only. The loaded state, the generate round-trip and the '
  + 'download links need a signed-in browser — Charlie’s to confirm.')
process.exit(fail ? 1 : 0)
