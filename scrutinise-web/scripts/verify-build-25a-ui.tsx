// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — verifying the PROGRESS DISPLAY by rendering it.
//
// ⚠ WHY THIS EXISTS, AND WHAT IT IS NOT. The standing rule is browser-verify before
// reporting done, and §2's progress display cannot be judged any other way. An authed
// browser walk was not possible from this session:
//
//   · the Chrome extension has no host permission for localhost:3000, so it cannot
//     read or screenshot the dev server (screenshot → "Extension manifest must request
//     permission to access the respective host"); and
//   · the browser has no Clerk session on production (`/dashboard` redirects to `/`),
//     and the local instance is a separate DEV Clerk instance.
//
// So this renders the component to static markup with fixture props and asserts what a
// user would see. It covers the SHAPE and the COPY. It does NOT cover click handling,
// polling, or layout, and it is reported as such — a render assertion presented as a
// browser walk would be the same dishonesty this sprint's guards exist to prevent.
//
// Usage: npx tsx scripts/verify-build-25a-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { renderToStaticMarkup } from 'react-dom/server'
import BuildProgress from '../components/lex/BuildProgress'
import type { BuildView } from '../app/ideas/build/BuildIdeaClient'
import { BUILD_PASSES } from '../lib/lex/build-config'

let pass = 0
let fail = 0
function assert(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  ✓  ${name}`) }
  else { fail++; console.log(`  ✗  ${name}${detail ? `\n       ${detail}` : ''}`) }
}

const CEILING = { budgetMs: 270000, binding: 'request', costPence: 50 }

function view(over: Partial<BuildView> = {}): BuildView {
  return {
    id: 'b1', version: 1, status: 'RUNNING', framing: 'B_CONTEXTUALISED',
    passes: BUILD_PASSES.map((p, i) => ({
      key: p.key, label: p.label, detail: p.detail,
      status: i === 0 ? 'DONE' : i === 1 ? 'RUNNING' : 'PENDING',
      startedAt: '2026-08-17T14:00:00.000Z',
      completedAt: i === 0 ? '2026-08-17T14:00:12.000Z' : null,
      output: i === 0 ? '38 sources read; 6 cited' : null,
      failureReason: null,
    })),
    passesComplete: 1, passesTotal: 4, currentPass: 'DIAGNOSIS',
    startedAt: '2026-08-17T14:00:00.000Z', completedAt: null, elapsedSeconds: 95,
    failureReason: null, cancelRequested: false, summaryMessage: null,
    uncertainties: [], queryUsed: 'B_CONTEXTUALISED :: bins council :: context(412 chars)',
    spend: { tokensIn: 120000, tokensOut: 5000, pence: 4.2, line: '120,000 in / 5,000 out — estimated cost 4.2p' },
    forks: [],
    ...over,
  }
}

function render(v: BuildView, onCancel?: () => void) {
  return renderToStaticMarkup(
    <BuildProgress build={v} ceiling={CEILING} onCancel={onCancel} busy={false} />,
  )
}

function main() {
  console.log('── verify:build-25a-ui (render assertions, NOT a browser walk) ──')

  // ── §2 named passes, not a spinner ────────────────────────────────────────
  const running = render(view(), () => {})
  for (const p of BUILD_PASSES) {
    assert(running.includes(p.label), `§2 the progress display names the pass "${p.label}"`)
    assert(running.includes(p.detail.slice(0, 40)), `   …and says what it is doing`)
  }
  assert(running.includes('1 of 4 passes'), '§2 it says how many passes are done')
  assert(running.includes('1m 35s'), '§2 elapsed time is visible', running.slice(0, 200))
  assert(running.includes('38 sources read; 6 cited'), '§2 a finished pass shows what it produced')
  assert(running.includes('Stop'), '§2 Cancel is offered WHILE RUNNING')
  assert(/estimated cost 4\.2p/.test(running), '§2 the spend is shown to the user')
  assert(running.includes('ceiling 270s (request)'), '§2 the ceiling in force is shown, and which one binds')
  assert(!/\d+%/.test(running.replace(/#[0-9a-f]{3,6}/gi, '')), '§2 there is NO percentage — the row stores passes, not a fraction')

  // ── the control: no cancel when nothing is running ────────────────────────
  const done = render(view({
    status: 'DONE', currentPass: null, passesComplete: 4, elapsedSeconds: 47,
    completedAt: '2026-08-17T14:00:47.000Z',
    passes: BUILD_PASSES.map((p) => ({
      key: p.key, label: p.label, detail: p.detail, status: 'DONE' as const,
      startedAt: '2026-08-17T14:00:00.000Z', completedAt: '2026-08-17T14:00:47.000Z',
      output: 'done', failureReason: null,
    })),
    summaryMessage: 'I drafted the whole thing from your four answers.',
    uncertainties: [{ fieldKey: 'summaryGuidingPolicy', sentence: 'I assumed the charge applies at the till.' }],
    forks: [
      { id: 'f1', forkKey: 'guidingPolicy:instrument', fieldKey: 'summaryGuidingPolicy', chosen: 'secondary legislation · national · reserved', alternative: 'primary legislation', caseForAlternative: 'A stronger legal basis, harder to unpick later.', alternativeIndex: 0, resolved: false },
      { id: 'f2', forkKey: 'guidingPolicy:instrument', fieldKey: 'summaryGuidingPolicy', chosen: 'secondary legislation · national · reserved', alternative: 'regulator guidance', caseForAlternative: 'Quicker, and needs no parliamentary time.', alternativeIndex: 1, resolved: false },
    ],
  }))
  assert(!done.includes('>Stop<'), '§2 CONTROL — Cancel is NOT offered on a finished build')
  assert(done.includes('Done'), '§2 a completed build says Done')
  assert(done.includes('I drafted the whole thing'), '§5 the build summary is shown')
  assert(done.includes('What I’m least sure about'), '§4.2 the per-field uncertainties are shown')
  assert(done.includes('I assumed the charge applies at the till.'), '   …with the sentence itself')
  assert(done.includes('Where I had to choose'), '§4.1 the forks are shown')
  assert(done.includes('1 decisions') || done.includes('(1 decision'), '   …grouped by decision point, not by row', done.match(/Where I had to choose[^<]*/)?.[0] ?? '')
  assert(done.includes('A stronger legal basis'), '   …with the case FOR each alternative')

  // ── a stopped build tells the truth about itself ──────────────────────────
  const stopped = render(view({
    status: 'FAILED', currentPass: null, passesComplete: 2, elapsedSeconds: 271,
    failureReason: 'The build ran out of time after 271 seconds and stopped.',
    passes: BUILD_PASSES.map((p, i) => ({
      key: p.key, label: p.label, detail: p.detail,
      status: (i < 2 ? 'DONE' : 'NOT_REACHED') as 'DONE' | 'NOT_REACHED',
      startedAt: '2026-08-17T14:00:00.000Z', completedAt: '2026-08-17T14:04:31.000Z',
      output: i < 2 ? 'done' : null, failureReason: null,
    })),
  }))
  assert(stopped.includes('Stopped'), '§2 a build that hit a ceiling says Stopped, not Done')
  assert(stopped.includes('ran out of time'), '   …and gives the plain reason')
  assert(stopped.includes('not reached'), '   …and marks the passes it never got to as NOT REACHED')
  assert(stopped.includes('2 of 4 passes'), '   …and reports which passes DID complete')

  // ── unpriced spend must not read as free ─────────────────────────────────
  const unpriced = render(view({
    spend: { tokensIn: 1000, tokensOut: 100, pence: null, line: '1,000 in / 100 out — cost not estimated (no rate on file for x)' },
  }))
  assert(unpriced.includes('cost not estimated'), 'an unpriced run says so in the UI rather than showing 0p')
  assert(!unpriced.includes('0.0p') && !unpriced.includes('£0'), '   …and shows no zero')

  // ── cancel-requested is explained ─────────────────────────────────────────
  const cancelling = render(view({ cancelRequested: true }), () => {})
  assert(cancelling.includes('Stopping…'), '§2 a requested cancel shows as in progress')
  assert(
    cancelling.includes('at the end of the pass that’s running'),
    '   …and says plainly that it is co-operative, so the button does not read as broken',
  )

  console.log(`\n${pass} passed, ${fail} failed.`)
  console.log('⚠ Render assertions only. Click handling, polling and layout are NOT covered here.')
  process.exit(fail ? 1 : 0)
}

main()
