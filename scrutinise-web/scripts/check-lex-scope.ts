/**
 * check-lex-scope.ts — BRIEF_SEARCH_S5's guard.
 *
 * ⚠ THE THING MOST LIKELY TO GO WRONG IS NOT A BUG. It is somebody merging the two channels back
 * into one, reasonably, to tidy up — and a committee transcript then reaches the user through a
 * field called `actTitle` and is presented as a section of an Act. S5 §1 calls that outcome worse
 * than doing nothing, and it is the never-claim rule broken in the most damaging place available.
 *
 * So this asserts the SEPARATION structurally, asserts that the panel kept its scope, and asserts
 * that the honest-gap machinery is wired rather than merely written.
 *
 * ⚠ Every assertion was watched failing first; the ones with a mechanical negative control run it.
 *
 * Usage (from scrutinise-web):  npx tsx scripts/check-lex-scope.ts
 */
import fs from 'fs'
import path from 'path'
import { kindsPlainlyAskedFor, EVIDENCE_KINDS, gapNote, evidenceBlock } from '../lib/lex/chat-retrieval'
import { mapWithLimit, STREAM_CONCURRENCY } from '../lib/lex/stream-batch'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

const ROOT = path.join(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

async function main() {
  console.log('\n════ check:lex-scope (SEARCH S5) ════')

  const chat = read('lib/lex/chat-retrieval.ts')
  const route = read('app/api/ai/[ideaId]/route.ts')
  const legacy = read('lib/lex/gateway-legacy.ts')

  // ── GATE 1 — the chat route no longer overrules the router ──────────────────────────────────
  console.log('\n  gate 1 — route rather than widen')
  check(!/tier:/.test(chat.slice(chat.indexOf('export async function retrieveForChat'), chat.indexOf('function toLegacy'))),
    '⚠ retrieveForChat passes NO tier — the router picks the streams (§2: "stop overruling it")')
  check(/retrieveForChat/.test(route), 'the chat route calls it')
  check(!/searchLegislationViaGateway\s*\(/.test(
    route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
  '⚠ and no longer calls the tier-scoped legislation search for grounding')

  // ── GATE 2/3 — the channels are SEPARATE, structurally ──────────────────────────────────────
  console.log('\n  gates 2 and 3 — two channels, and a transcript cannot wear an Act\'s clothes')
  const evidenceIface = chat.slice(chat.indexOf('export interface EvidenceResult'), chat.indexOf('export interface ChatRetrieval'))
  for (const forbidden of ['actId', 'actTitle', 'sectionNumber']) {
    check(!new RegExp(`\\b${forbidden}\\b`).test(evidenceIface),
      `⚠⚠ EvidenceResult has NO \`${forbidden}\` — the misrendering is impossible by shape, not by convention`)
  }
  check(/legislation: LegacySearchResult\[\]/.test(chat) && /evidence: EvidenceResult\[\]/.test(chat),
    'the two channels are separate fields, not one widened list')
  check(/=== OTHER EVIDENCE FROM OUR CORPUS \(NOT legislation\) ===/.test(route),
    '⚠ the prompt renders them as SEPARATE blocks, and says the second is not legislation')
  check(/EVIDENCE_INSTRUCTION/.test(chat) && /never cite one with a section number/i.test(chat),
    '   …with an instruction forbidding a section number on a non-legislation source')

  // Every non-legislation display type has a plain-English label.
  const TYPES = ['DEBATE', 'COMMITTEE', 'CASE_LAW', 'GUIDANCE', 'BILL', 'TREATY',
    'EXPLANATORY_NOTE', 'DIVISION', 'IMPACT_ASSESSMENT', 'CONSULTATION']
  const missing = TYPES.filter((t) => !EVIDENCE_KINDS[t])
  check(missing.length === 0, 'every non-legislation display type has a label and a "what it is"', missing.join(', '))
  check(!!EVIDENCE_KINDS.BILL && /PROPOSAL/.test(EVIDENCE_KINDS.BILL.whatItIs),
    '⚠ a BILL is labelled a proposal, not law — it is in the evidence channel, not the legislation one')

  // ── THE PANEL KEEPS ITS SCOPE ───────────────────────────────────────────────────────────────
  console.log('\n  the legislation panel is NOT widened (§2: that would be a regression dressed as a fix)')
  check(/const LEGISLATION_TIER = 'legislation'/.test(legacy) && /tier: LEGISLATION_TIER/.test(legacy),
    'gateway-legacy still scopes to the legislation tier')
  check(/LEGISLATION_TYPES\.has\(r\.type\)/.test(legacy), '   …and still applies its type filter')

  // ── §4 — THE HONEST GAP ─────────────────────────────────────────────────────────────────────
  console.log('\n  §4 — a gap that announces itself')
  check(/GAP_INSTRUCTION/.test(route), 'the never-claim instruction reaches the prompt')
  check(/don\\'t have information on that|do not have information/i.test(chat),
    "⚠ the instruction forbids the vague deflection BY NAME, not just in spirit")
  check(/NEVER answer from your own general knowledge/i.test(chat),
    '⚠⚠ and forbids general knowledge presented as though it came from the corpus')
  check(/logUnmet/.test(route) && /LexUnmetRequest/.test(chat),
    '§4 — every unmet request is logged for V37\'s gap-filler')
  check(!/question|message/.test(chat.slice(chat.indexOf('INSERT INTO "LexUnmetRequest"'), chat.indexOf('INSERT INTO "LexUnmetRequest"') + 240)),
    '⚠ and the user\'s question text is NOT stored — a Stage-1 idea is private')

  // the detector, run rather than asserted
  const asked = kindsPlainlyAskedFor('what have select committees said about sewage')
  check(asked.includes('COMMITTEE'), 'a committee question is detected as asking for committee material')
  check(!kindsPlainlyAskedFor('what does the companies act say about directors').length,
    '⚠ a plain legislation question triggers NO gap note — noise is how a real gap notice gets ignored')
  const gap = gapNote({
    legislation: [], evidence: [], unhandled: [], failed: false,
    askedForButEmpty: ['COMMITTEE'], totalBeforeSplit: 12,
  })
  check(!!gap && /Committee evidence/.test(gap), 'the gap note names the kind that was missing')
  const failGap = gapNote({
    legislation: [], evidence: [], unhandled: [], failed: true,
    askedForButEmpty: [], totalBeforeSplit: 0,
  })
  check(!!failGap && /not consulted at all/.test(failGap),
    '⚠ a FAILED search says so distinctly — "we could not look" is not "we looked and found nothing"')
  check(gapNote({ legislation: [], evidence: [], unhandled: [], failed: false, askedForButEmpty: [], totalBeforeSplit: 5 }) === null,
    '   …and nothing is said when there is nothing to say')

  // ── §2 — BATCHING ───────────────────────────────────────────────────────────────────────────
  console.log('\n  §2 — batching, a prerequisite rather than an optimisation')
  const router = read('lib/lex/query-router.ts')
  check(/mapWithLimit/.test(router), 'runRoutedSearch batches its stream calls')
  // ⚠ Comments stripped: this file's own explanation of what the old code did CONTAINS the old
  // code, so an unstripped grep fires on the sentence describing the fix. Third time this shape
  // has appeared in two days.
  const routerCode = router.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  check(!/Promise\.all\(active\.map/.test(routerCode),
    '⚠ and no longer fires every stream at once — five streams against a four-wide service')
  check(STREAM_CONCURRENCY <= 4, `the cap is under the service's width`, `cap=${STREAM_CONCURRENCY}`)
  // negative control, RUN: the limiter must actually limit
  const seen: number[] = []
  let live = 0
  await mapWithLimit([1, 2, 3, 4, 5], 2, async () => {
    live++; seen.push(live)
    await new Promise((r) => setTimeout(r, 5))
    live--
    return 0
  })
  check(Math.max(...seen) <= 2, '   …and the limiter really limits (negative control, observed)', `max in flight ${Math.max(...seen)}`)

  // ── rendering ───────────────────────────────────────────────────────────────────────────────
  const block = evidenceBlock([{
    id: 'x', kind: 'COMMITTEE', kindLabel: EVIDENCE_KINDS.COMMITTEE.label,
    whatItIs: EVIDENCE_KINDS.COMMITTEE.whatItIs, title: 'Water quality in rivers',
    date: '2022-01-13', url: null, snippet: 'a huge chemical cocktail', score: 1,
    // S8 §2 — committee evidence holds no structured attribution (0 of 800 rows sampled), so
    // null here is the REAL value for this collection, not a placeholder. See
    // scripts/check-s8-attribution.ts for the assertions that keep it honest.
    attribution: null,
  }])
  check(!!block && /\[Committee evidence\]/.test(block),
    'a rendered evidence item is labelled with what kind of document it is')
  check(!!block && !/s\.\d/.test(block), '   …and carries no section number')

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  if (fail) process.exit(1)
}
main()
