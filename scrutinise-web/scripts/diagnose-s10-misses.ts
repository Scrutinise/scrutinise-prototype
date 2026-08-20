/**
 * diagnose-s10-misses.ts — S10 §1. WHY THE NOT-RETRIEVED MISSES ARE NOT RETRIEVED.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `measure-s10-recall.ts --score` splits every miss into NOT-ROUTED / NOT-RETRIEVED / DILUTED and
 * finds fourteen NOT-RETRIEVED — the stream ran, returned sixty results, and the key was not among
 * them. Seven of those fourteen are guidance, from a stream that scores 8/9 on consultations sitting
 * in the SAME tier. That is not a plausible search-quality story on its own, so this asks the index
 * directly rather than reasoning about it.
 *
 * ⚠ BYTES BEFORE HYPOTHESES (docs/CLAUDE.md §13, generalised). Four things could each produce a
 * NOT-RETRIEVED and they are indistinguishable from the outside:
 *
 *   1. THE ROW IS NOT IN THE FTS INDEX AT ALL. `corpus_sections` and the built index are different
 *      artefacts; a row seeded after the last build is in Neon and nowhere else. `verify-s10-keys`
 *      proved the row exists in Neon — that is NOT the same claim.
 *   2. THE ROW IS INDEXED UNDER A DIFFERENT TIER than the stream prefilters on. The tier is BAKED
 *      IN at build time, and stream-scopes.ts already records two collections in exactly this state.
 *   3. THE ADAPTER DROPS IT. `corpusToType` returns null for corpus families with no display type,
 *      and `runFtsSearch` filters those out before anything sees them.
 *   4. IT IS GENUINELY OUT-RANKED — the honest retrieval miss, and the only one of the four that
 *      a fusion weight or a better query could fix.
 *
 * Each is checked with a separate probe, weakest assumption first. The probes go to the SERVICE,
 * not to Postgres, because the service is what retrieval actually reads.
 *
 * Usage:  FTS_SEARCH_URL=… npx tsx --env-file=.env scripts/diagnose-s10-misses.ts
 */
import { corpusToType } from '../lib/lex/corpus-type-map'
import { STREAM_SCOPES, streamCanSelect } from '../lib/lex/stream-scopes'

export {}

const FTS = process.env.FTS_SEARCH_URL
if (!FTS) { console.error('FTS_SEARCH_URL is required — this probes the SERVICE, which is what retrieval reads.'); process.exit(1) }

/** The fourteen NOT-RETRIEVED keys, with the stream that ran and failed to return them. */
const MISSES: Array<{ q: string; key: string; owner: string; title: string }> = [
  { q: 'Q5 C5', owner: 'committees', key: 'committees-reports:publication:34123:187763', title: 'leasehold reform, Minister of State for Housing' },
  { q: 'Q6 C6', owner: 'committees', key: 'committees-evidence:writtenevidence:112256:179384', title: 'Governance of artificial intelligence (AI)' },
  { q: 'Q8 C8', owner: 'committees', key: 'committees-evidence:writtenevidence:100004:146799', title: 'Special educational needs and disabilities (SCN0679)' },
  { q: 'Q10 C10', owner: 'committees', key: 'committees-reports:publication:50376:272506', title: 'NHS waiting times for elective care' },
  { q: 'Q16 K6', owner: 'caselaw', key: 'tna-caselaw:[2011] UKSC 20:1', title: 'In re McCaughey' },
  { q: 'Q22 G2', owner: 'guidance', key: 'cps-guidance:prosecution-guidance/domestic-abuse:1', title: 'Domestic Abuse' },
  { q: 'Q23 G3', owner: 'guidance', key: 'cps-guidance:prosecution-guidance/perverting-course-justice-and-wasting-police-time-cases-involving-allegedly:1', title: 'Perverting the course of justice' },
  { q: 'Q25 G5', owner: 'guidance', key: 'cps-guidance:prosecution-guidance/abuse-process:1', title: 'Abuse of Process' },
  { q: 'Q26 G6', owner: 'guidance', key: 'cps-guidance:prosecution-guidance/allocation-sending-and-committal-sentence:1', title: 'Allocation, sending and committal for sentence' },
  { q: 'Q27 G7', owner: 'guidance', key: 'cps-guidance:prosecution-guidance/appeals-administrative-court:1', title: 'Appeals to the Administrative Court' },
  { q: 'Q28 G8', owner: 'guidance', key: 'hmrc-manuals:hmrc-internal-manuals/money-laundering-regulations-compliance/mlr3cupdate001:1', title: 'MLR3C update' },
  { q: 'Q30 G10', owner: 'guidance', key: 'hmrc-manuals:hmrc-internal-manuals/admin-law-manual/adml1800:1', title: 'Incorrect Advice to Customers: Unsolicited Advice' },
  { q: 'Q31 I1', owner: 'legislation', key: 'impact-assessments:2020-57:1', title: 'Plastic Straws, Cotton Buds and Stirrers' },
  { q: 'Q32 I2', owner: 'legislation', key: 'impact-assessments:2023-77:1', title: 'Building Safety Responsible Actors Scheme' },
]

interface Hit { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

async function fts(query: string, opts: { corpora?: string[]; tier?: string; limit?: number } = {}): Promise<Hit[]> {
  const res = await fetch(`${FTS!.replace(/\/$/, '')}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit: opts.limit ?? 60, ...(opts.tier ? { tier: opts.tier } : {}), ...(opts.corpora ? { corpora: opts.corpora } : {}) }),
  })
  if (!res.ok) throw new Error(`fts ${res.status}: ${await res.text()}`)
  return ((await res.json()) as { results?: Hit[] }).results ?? []
}

async function main() {
  console.log('═'.repeat(100))
  console.log('S10 — WHY THE 14 NOT-RETRIEVED MISSES ARE NOT RETRIEVED')
  console.log('═'.repeat(100))
  console.log('  Four candidate causes, probed weakest-assumption-first against the SERVICE.\n')

  const byCorpus = new Map<string, { indexed: number; absent: number; tiers: Set<string>; types: Set<string> }>()

  for (const m of MISSES) {
    const corpus = m.key.split(':')[0]
    console.log(`── ${m.q}  ${m.key}`)
    // PROBE 1+2: is the row in the INDEX, and under which tier? Searched corpus-scoped with the
    // document's own title words, which is the most generous query it will ever get. If a
    // corpus-scoped search using its own title cannot find it, no user query ever will.
    let hits: Hit[] = []
    try {
      hits = await fts(m.title, { corpora: [corpus], limit: 60 })
    } catch (e) {
      console.log(`   probe failed: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    const self = hits.find((h) => h.id === m.key)
    const e = byCorpus.get(corpus) ?? { indexed: 0, absent: 0, tiers: new Set<string>(), types: new Set<string>() }
    if (!self) {
      e.absent++
      console.log(`   ✗ NOT RETURNED scoped to its own corpus on its own title, in ${hits.length} hits.`)
      // ⚠ THIS IS NOT PROOF OF ABSENCE, and an earlier draft of this script said it was. There is no
      // by-id endpoint on fts-serve, so index membership cannot be read directly. What discriminates
      // is the SIBLINGS: `{corpus}:{docId}:{sectionRef}`, so a hit on another section of the SAME
      // document proves the document is indexed and that this particular section is merely
      // out-ranked — which is what a 37-word section titled "Summary" would look like. No sibling at
      // all is consistent with absence AND with a document nothing about the title matches.
      const docPrefix = m.key.split(':').slice(0, -1).join(':')
      const siblings = hits.filter((h) => h.id.startsWith(`${docPrefix}:`))
      if (!hits.length) {
        console.log(`     and the corpus returned NOTHING at all → the whole collection may be absent from the index.`)
      } else if (siblings.length) {
        console.log(`     but ${siblings.length} SIBLING section(s) of the same document came back (e.g. ${siblings[0].id}, tier=${siblings[0].tier}).`)
        console.log(`     → the document IS indexed. This SECTION is out-ranked, not missing. Cause: not isolated`)
        console.log(`       (a short section under an internal heading is the leading candidate — the key rows`)
        console.log(`        for this collection average 37 words, measured by verify-s10-keys).`)
      } else {
        console.log(`     the corpus IS indexed (top hit ${hits[0].id}, tier=${hits[0].tier}) and NO sibling section`)
        console.log(`     of this document came back. Consistent with absence from the index AND with a document`)
        console.log(`     whose title matches nothing. ⚠ NOT DISCRIMINATED — there is no by-id endpoint to settle it.`)
      }
    } else {
      e.indexed++
      e.tiers.add(self.tier)
      const type = corpusToType(self.corpus, self.tier, self.id)
      e.types.add(String(type))
      const rank = hits.indexOf(self)
      // PROBE 3: does the adapter keep it? A null type is dropped before any stream sees it.
      // PROBE 2 proper: can the owning stream's scope actually select it, given the INDEXED tier?
      const scope = STREAM_SCOPES.find((s) => s.name === m.owner)!
      const selectable = streamCanSelect(scope, self.corpus, self.tier, type)
      console.log(`   ✓ indexed. tier=${self.tier}  displayType=${type}  rank=${rank} of ${hits.length} on its own title`)
      console.log(`     stream '${m.owner}' can select it? ${selectable ? 'YES' : 'NO ✗ — the scope excludes it, so no query could ever return it'}`)
      if (!selectable) {
        console.log(`     scope: tier=${scope.tier} corpora=${JSON.stringify(scope.corpora ?? null)} types=${JSON.stringify(scope.types ?? null)} extraCorpora=${JSON.stringify(scope.extraCorpora ?? null)}`)
      }
    }
    byCorpus.set(corpus, e)
    // PROBE 4: the honest-miss case — search the stream's real scope with the title and see where
    // this row lands against the competition it actually faces.
    const scope = STREAM_SCOPES.find((s) => s.name === m.owner)!
    try {
      const inStream = await fts(m.title, { tier: scope.tier, limit: 60 })
      const r = inStream.findIndex((h) => h.id === m.key)
      console.log(`     within tier '${scope.tier}' on its own title: ${r < 0 ? 'STILL ABSENT from 60 results' : `rank ${r}`}`)
      if (r < 0 && inStream.length) console.log(`       out-ranked by e.g. ${inStream.slice(0, 2).map((h) => `${h.corpus}(${(h.score ?? 0).toFixed(1)})`).join(', ')}`)
    } catch { /* reported by the throw above if systemic */ }
    console.log('')
  }

  console.log('═'.repeat(100))
  console.log('SUMMARY BY COLLECTION')
  console.log('═'.repeat(100))
  for (const [corpus, e] of [...byCorpus].sort()) {
    console.log(`  ${corpus.padEnd(22)} returned-on-own-title=${e.indexed}  not-returned=${e.absent}  indexedTier=${[...e.tiers].join('/') || '—'}  displayType=${[...e.types].join('/') || '—'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
