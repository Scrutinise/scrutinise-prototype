// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-25g-ui — RENDER THE BUILD SURFACES AND READ WHAT COMES OUT.
//
// ⚠ THE SAME REASONING AS `verify:lex-25e-ui`, AND 25-G NEEDS IT FOR A SPECIFIC REASON.
//
// §4b reports *"7 search queries issued" followed by seven empty bullets*. The stored data
// is not the problem — build `42d68bea` holds seven queries with 7–10 terms and a 240–290
// character purpose each. So the defect is in the RENDER, and a check that reads source
// text or database rows cannot see it. The only way to find out what a user is looking at
// is to render the component and look at the markup.
//
// ⚠ WHAT THIS IS NOT: a browser walk. Static markup covers the shape and the copy of the
// first paint. It does not cover `<details>` expansion, effects, polling or layout — and
// `<details>`/`<summary>` in particular renders its children into the HTML whether or not
// the disclosure is open, so "the terms are in the markup" is necessary and not sufficient.
// A human opening the panel is still the acceptance criterion.
//
// Usage: npx tsx scripts/verify-lex-25g-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ THE EXPLICIT React IMPORT IS LOAD-BEARING HERE. `tsx` compiles this file with the
// CLASSIC JSX transform (it does not read Next's `jsx: preserve` + automatic runtime), so
// every `<Component />` becomes `React.createElement` and fails with "React is not
// defined" without it. Watched failing exactly that way before this line was added.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BuildProgress from '../components/lex/BuildProgress'
import BuildFindings from '../components/lex/BuildFindings'
import type { BuildView } from '../app/ideas/build/BuildIdeaClient'
import type { BuildHighlights } from '../lib/lex/build-highlights'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** Strip tags so an assertion is about the WORDS a user reads, not the markup. */
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

// ── A build view shaped like the real one (`42d68bea`), with real queries ────
const QUERIES = [
  {
    by: 'ORIENT',
    terms: ['Accounting Officer', 'Carltona Principle', 'Osmotherly Rules', 'Senior Responsible Owner'],
    purpose: 'Foundational documents and key terms of art for civil service accountability.',
    provenance: 'written' as const,
  },
  {
    by: 'question:EXISTING_POWER',
    terms: ['delegated power', 'enabling provision', 'may by regulations', 'confer power'],
    purpose: 'Whether a statutory power already exists, so no new Act is needed.',
    provenance: 'written' as const,
  },
]

const BUILD: BuildView = {
  // 25-L §1 added `userCritique` to BuildView. Null here: this fixture is a build nobody
  // asked to re-run, which is the ordinary case and the one worth rendering.
  userCritique: null,
  id: 'b1', version: 2, status: 'DONE', framing: 'B_CONTEXTUALISED',
  passes: [
    {
      key: 'ORIENT', label: 'Understanding the terrain', detail: 'Searching the corpus.',
      status: 'SKIPPED', startedAt: null, completedAt: '2026-08-25T09:00:00.000Z',
      output: 'Reused from your last build — 434 retrieved, 40 read; 11 cited', failureReason: null,
    },
    {
      key: 'DIAGNOSIS', label: 'Drafting the diagnosis', detail: 'What is going wrong.',
      status: 'DONE', startedAt: null, completedAt: null,
      output: '5 causes, 4 recorded alternatives', failureReason: null,
    },
  ],
  passesComplete: 1, passesTotal: 10, currentPass: null,
  startedAt: '2026-08-25T09:00:00.000Z', completedAt: '2026-08-25T09:10:00.000Z', elapsedSeconds: 600,
  failureReason: null, cancelRequested: false,
  summaryMessage: 'I have drafted a first version of your proposal, drawing from your answers.',
  uncertainties: [], queryUsed: 'B_CONTEXTUALISED :: … :: written',
  spend: { tokensIn: 100, tokensOut: 50, pence: 12.4, line: '100 in / 50 out — estimated cost 12.4p' },
  spendByPass: [], nextPass: null, resumable: false, workerLate: false,
  incomplete: null,
  forks: [
    {
      id: 'f1', forkKey: 'diagnosis:pivotalObstacle', fieldKey: 'pivotalObstacle',
      chosen: 'The constitutional interpretation of ministerial accountability',
      alternative: 'The absence of measurable outcomes', caseForAlternative: 'Without metrics nothing can be judged.',
      alternativeIndex: 0, resolved: false,
    },
    {
      id: 'f2', forkKey: 'guidingPolicy:instrument', fieldKey: 'summaryGuidingPolicy',
      chosen: 'Organisational change and secondary legislation',
      alternative: 'Use the existing power: CRaG 2010 s.3(1)', caseForAlternative: 'The Minister may already act.',
      alternativeIndex: 0, resolved: false,
    },
  ],
  highlights: null,
  modelsByPass: [{ key: 'DIAGNOSIS', models: ['gemini-2.5-flash'] }],
  queries: QUERIES,
}

const CEILING = { budgetMs: 240000, binding: 'request', costPence: 50 }

console.log('── verify:lex-25g-ui ──\n')
console.log('§4b — the queries are RENDERED, not just counted')
{
  const html = renderToStaticMarkup(
    <BuildProgress build={BUILD} ceiling={CEILING} busy={false} />,
  )
  const t = text(html)
  ok('the count appears', /2 search queries issued/.test(t), '2 search queries issued')
  // ⚠ THE DEFECT §4b REPORTS. A count with an empty list beneath it is a claim with
  // nothing behind it, and it is exactly what a `.map` over a field the payload does not
  // carry produces — silently, with no error.
  ok('every query\'s TERMS reach the markup',
    QUERIES.every((q) => q.terms.every((term) => t.includes(term))),
    QUERIES.flatMap((q) => q.terms).length + ' terms')
  ok('every query\'s PURPOSE reaches the markup',
    QUERIES.every((q) => t.includes(q.purpose.slice(0, 40))))
  ok('a query with NO terms cannot render as a silent empty bullet', (() => {
    const empty = { ...BUILD, queries: [{ by: 'X', terms: [], purpose: '', provenance: 'written' as const }] }
    const e = text(renderToStaticMarkup(<BuildProgress build={empty} ceiling={CEILING} busy={false} />))
    return /no terms recorded/i.test(e)
  })(), 'it says so instead')
}

console.log('\n§4a — the build summary is NOT printed twice')
{
  const html = renderToStaticMarkup(
    <BuildProgress build={BUILD} ceiling={CEILING} busy={false} />,
  )
  // The transcript (rendered by BuildIdeaClient, above this panel) already carries it.
  ok('BuildProgress does not repeat the summary the transcript shows',
    !text(html).includes('drawing from your answers'))
}

console.log('\n§4c — every fork says WHAT IS BEING DECIDED')
{
  const t = text(renderToStaticMarkup(<BuildProgress build={BUILD} ceiling={CEILING} busy={false} />))
  ok('the pivotal-obstacle fork is labelled', /pivotal obstacle/i.test(t))
  ok('the instrument fork is labelled', /instrument/i.test(t))
  // ⚠ THE CONTROL. Two forks of DIFFERENT kinds must not render identically — which is
  // exactly what "all rendered identically as bare I chose / instead of" means.
  const labels = t.match(/The (pivotal obstacle|instrument|approach|root cause|actions)/gi) ?? []
  ok('the two forks carry DIFFERENT labels', new Set(labels.map((l) => l.toLowerCase())).size >= 2,
    labels.join(' | ') || 'none found')
}

console.log('\n§1a — a REUSED pass says so rather than looking skipped')
{
  const t = text(renderToStaticMarkup(<BuildProgress build={BUILD} ceiling={CEILING} busy={false} />))
  ok('the reused pass names what it reused', /Reused from your last build/.test(t))
  ok('it is not shown as "not reached"', !/Understanding the terrain[^.]*not reached/i.test(t))
}

console.log('\n§1 — the findings panel still leads with the record')
{
  const highlights: BuildHighlights = {
    drafted: [{ key: 'summaryDiagnosis', label: 'The diagnosis', text: 'A diagnosis.', awaiting: true }],
    leading: [{
      id: 'e1', kind: 'CONTRADICTS', title: 'Carltona applies to Ministers, not civil servants',
      body: 'The principle concerns ministerial delegation.', citation: 'Civil Service (Management Functions) Bill',
      url: null, sourceType: 'legislation', heading: 'LAW_NOW', headingLabel: 'What the law says now', rank: 160,
    }],
    supporting: [], demotedCount: 3,
    vocabulary: { confirmed: ['Carltona principle (doctrine)'], unverified: [{ term: 'Fulton Report (1968)', why: 'Nothing retrieved mentions it.' }] },
    judgements: [{
      id: 'j1', kind: 'FINDING', title: 'How hard this will be to pass', body: 'Hard.',
      citation: null, url: null, sourceType: null, heading: 'AGAINST', headingLabel: 'The strongest case against', rank: 0,
    }],
    changes: [{
      id: 'c1', kind: 'CONTRADICTS', title: 'The critique rewrote summaryDiagnosis', body: 'It was saying…',
      citation: null, url: null, sourceType: null, heading: null, headingLabel: null, rank: 60,
    }],
    sources: [{ citation: 'Civil Service (Management Functions) Bill', url: null, count: 1 }],
  }
  const t = text(renderToStaticMarkup(<BuildFindings highlights={highlights} />))
  ok('a cited finding is on the screen with its citation',
    t.includes('Carltona applies to Ministers') && t.includes('Civil Service (Management Functions) Bill'))
  ok('an unverified term is marked unverified, with its reason',
    /Unverified/.test(t) && t.includes('Nothing retrieved mentions it'))
  ok('the demoted count is shown', /3 further item/.test(t))
  ok('the process notes are in their own section, not among the findings',
    /Where I changed my mind/.test(t))
}

console.log(`\n${pass} passed, ${fail} failed.`)
process.exit(fail ? 1 : 0)
