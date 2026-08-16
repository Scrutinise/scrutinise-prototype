/**
 * audit-s4-tier-scope.ts — BRIEF_SEARCH_S4 §1. Establish whether the tier scope on the three
 * legacy surfaces is correct AT ALL, and report before changing anything.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A MEASUREMENT AND NOT A CODE READ
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §1: *"Establish this behaviourally — ask Lex a committee question through the running product and
 * see what comes back — rather than by reading the code alone."*
 *
 * This exercises the EXACT functions the three routes call, with the EXACT arguments they pass,
 * against the live index. What it does not exercise is the HTTP layer (Clerk auth, Zod, the JSON
 * envelope), which adds no retrieval behaviour — every route's search is one call into
 * `gateway-legacy.ts` and the difference between this harness and the running product is
 * authentication. That distinction is stated rather than glossed: this is the retrieval path
 * measured directly, not a browser walk.
 *
 * ⚠ AND THE FINDING DOES NOT DEPEND ON FLAG STATE, which matters because production's flags cannot
 * be read from this machine (docs/CLAUDE.md §19 — VERCEL_TOKEN is SAML-blocked). `tier:
 * 'legislation'` and the `LEGISLATION_TYPES` filter are both unconditional in `gateway-legacy.ts`:
 * no environment variable turns either off. The flags change how well the legislation tier is
 * searched, never whether anything outside it can be returned.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE LAYERS THIS SEPARATES — and the second one is not in the brief
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   A  what the caller actually receives   `searchLegislationViaGateway(...)`
 *   B  what the gateway returned to it     `runSearch({ tier: 'legislation' })`
 *   C  what the corpus would have offered  `runSearch({})`  — no tier
 *
 * A→B is the `LEGISLATION_TYPES` filter: `gateway-legacy.ts` drops every result that is not
 * PRIMARY_LEGISLATION / STATUTORY_INSTRUMENT / EU_LEGISLATION, AFTER the tier scope has already
 * been applied. **There are two gates in series, not one.** S4 §1 treats the tier as the scope; if
 * only the tier were widened, this second filter would discard everything the widening admitted and
 * the change would measure as a no-op. That is worth knowing before anyone widens anything.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw,guidance \
 *   LEX_QUERY_ROUTER=true \
 *     npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s4-tier-scope.ts
 */
import { searchLegislationViaGateway, searchPanelViaGateway } from '../lib/lex/gateway-legacy'
import { runSearch, type SearchIntent } from '../lib/lex/search-gateway'
import { routeQuery } from '../lib/lex/query-expansion'
import { resolvedConfigLine, assertRetrievalConfig } from '../lib/lex/harness-preflight'
import type { SearchResult } from '../lib/lex/page1-config'

const LIMIT = 12

/**
 * The questions matter more than the count. Each names the surface a user would be on and what
 * they would reasonably expect it to search — which is precisely what §1 asks to be established.
 */
type Probe = { q: string; expect: string; shape: 'legislation' | 'not-legislation' }
const PROBES: Probe[] = [
  // ── legislation-shaped: the scope should cost these nothing ────────────────────────────────
  { q: 'companies act 2006 directors duties', expect: 'the Act itself', shape: 'legislation' },
  { q: 'data protection lawful basis for processing personal data', expect: 'UK GDPR / DPA 2018', shape: 'legislation' },
  { q: 'equality act public sector equality duty', expect: 'EA 2010 s.149', shape: 'legislation' },

  // ── NOT legislation-shaped: these are the ones §1 is about ─────────────────────────────────
  { q: 'what have select committees said about water company sewage discharge', expect: 'committee evidence and reports', shape: 'not-legislation' },
  { q: 'what did MPs argue in the debate on assisted dying', expect: 'Hansard', shape: 'not-legislation' },
  { q: 'how have the courts interpreted the duty to make reasonable adjustments', expect: 'case law', shape: 'not-legislation' },
  { q: 'government guidance on procurement social value', expect: 'guidance', shape: 'not-legislation' },
  { q: 'what evidence did witnesses give on leasehold reform', expect: 'committee evidence', shape: 'not-legislation' },
  { q: 'has parliament scrutinised the rollout of universal credit', expect: 'committees and Hansard', shape: 'not-legislation' },
  { q: 'what was said about buy now pay later regulation in parliament', expect: 'Hansard and committees', shape: 'not-legislation' },
]

const typesOf = (rs: SearchResult[]) => {
  const m = new Map<string, number>()
  for (const r of rs) m.set(String(r.type), (m.get(String(r.type)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(' ')
}
const titleOf = (r: SearchResult) => String(r.title || r.citation || r.id).slice(0, 68)

async function main() {
  console.log('════ SEARCH S4 §1 — TIER SCOPE AUDIT ══════════════════════════════════════════')
  // The harness must not run degraded and must print what it resolved (S3 §7.2).
  assertRetrievalConfig('audit-s4-tier-scope')
  console.log(resolvedConfigLine())
  console.log('⚠ These flags were set BY THIS HARNESS. Production\'s values are unreadable from')
  console.log('  this machine (SAML-blocked Vercel token, docs/CLAUDE.md §19) and are NOT asserted.')
  console.log('  The scoping finding below does not depend on them: the tier argument and the')
  console.log('  LEGISLATION_TYPES filter are unconditional in gateway-legacy.ts.\n')

  const rows: Array<Record<string, string | number>> = []
  const lostExamples: string[] = []

  for (const p of PROBES) {
    const kw = p.q.split(/\s+/).filter(Boolean)

    // A — exactly what app/api/ai/[ideaId] and POST /api/search receive.
    const a = await searchLegislationViaGateway({ q: p.q, limit: LIMIT, intent: 'IDEA_CHAT_GROUNDING' as SearchIntent })
    // B — what the gateway handed gateway-legacy BEFORE its LEGISLATION_TYPES filter.
    const b = await runSearch({ keywords: kw, intent: 'IDEA_CHAT_GROUNDING', limit: LIMIT, tier: 'legislation' })
    // C — the same query with NO tier at all: what the corpus would have offered.
    const c = await runSearch({ keywords: kw, intent: 'GENERAL_CORPUS_CHAT', limit: LIMIT })

    // ⚠ THE ROUTER'S OWN DECISION, asked directly. The tier-scoped branch of the gateway calls
    // routeQuery for the query REWRITE and then throws the stream selection away, because the
    // caller's contract fixes the tier. So the system already knows which part of the corpus the
    // question belongs to, and the caller overrules it — which is a stronger statement of the
    // defect than "the scope is narrow", and it is the system telling us, not us telling it.
    const route = await routeQuery(kw, '')
    const routerPicked = route ? Object.keys(route).join(',') : '(no decision)'

    const aIds = new Set(a.results.map((r) => String(r.sectionId)))
    const lost = c.results.filter((r) => !aIds.has(String(r.id)))
    const lostNonLeg = lost.filter((r) => !['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION'].includes(String(r.type)))

    rows.push({
      question: p.q.slice(0, 44),
      shape: p.shape,
      'router picked': routerPicked,
      'caller forces': 'legislation',
      A: a.results.length,
      B: b.results.length,
      C: c.results.length,
      'dropped by TYPE filter': b.results.length - a.results.length,
      'non-legislation lost': lostNonLeg.length,
    })

    if (p.shape === 'not-legislation' && lostNonLeg.length) {
      lostExamples.push(
        `\n  Q: ${p.q}\n     a user on the Lex chat route would expect: ${p.expect}` +
        `\n     the route returns ${a.results.length} result(s), all legislation: ${typesOf(a.results as unknown as SearchResult[]) || '(none)'}` +
        `\n     the untiered corpus offers, and the route cannot show:` +
        lostNonLeg.slice(0, 3).map((r) => `\n       · [${r.type}] ${titleOf(r)}`).join(''))
    }
  }

  console.log('\n════ PER-QUESTION ═════════════════════════════════════════════════════════════')
  console.table(rows)

  console.log('\n════ WHAT A USER ASKING A NON-LEGISLATION QUESTION IS NOT SHOWN ═══════════════')
  console.log(lostExamples.join('\n') || '  (nothing — the scope costs nothing on these questions)')

  // ── the panel, measured separately, because §1 says it is probably RIGHT ────────────────────
  console.log('\n════ THE LEGISLATION PANEL — measured separately, because widening it would be a regression ═══')
  const panelQ = 'what have select committees said about water company sewage discharge'
  const panel = await searchPanelViaGateway(panelQ, 6)
  console.log(`  /api/ideas/[id]/legislation-search on a committee question returns ${panel.results.length} result(s).`)
  console.log(`  Its contract (PanelResult) has actTitle / sectionNumber / legislationGovUkId /`)
  console.log(`  isTnaVerified / amendmentCount and NO field a committee transcript could occupy.`)
  for (const r of panel.results.slice(0, 3)) {
    console.log(`    · ${String(r.actTitle).slice(0, 60)} — s.${r.sectionNumber || '—'} (${r.year || '—'})`)
  }

  console.log('\n════ THE TWO GATES, STATED ════════════════════════════════════════════════════')
  console.log('  1. tier: \'legislation\'          — gateway-legacy.ts:162, passed by all three callers')
  console.log('  2. LEGISLATION_TYPES filter     — gateway-legacy.ts:166, applied AFTER the tier')
  console.log('  Widening (1) alone changes nothing: (2) discards whatever (1) admits.')
  console.log(`\n  ${resolvedConfigLine()}`)
}

main().catch((e) => { console.error('[audit-s4-tier-scope] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
