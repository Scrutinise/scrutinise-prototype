/**
 * sweep-s12-type-reachability.ts — IS ANY COLLECTION'S FATE DECIDED BY ITS DISPLAY TYPE? S12 §4.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE QUESTION. `uk-treaties` and `tax-treaties-dta` are unreachable because they are typed
 * `TREATY`, which no stream admits. `uk-treaties-fcdo` — **seven times larger, the same kind of
 * material** — is reachable purely because it happens to be typed `DEBATE`. So reachability is
 * being decided by a field chosen for RENDERING, not for RETRIEVAL. §4 asks whether that accident
 * reaches any further than the two treaty collections.
 *
 * ── THE TWO AXES, SEPARATED ─────────────────────────────────────────────────────────────────────
 * A stream admits a row only if BOTH its tier and its display type pass (`streamCanSelect`). So a
 * collection can be blocked on either axis, and the two need completely different fixes:
 *
 *   TIER-BLOCKED  — `tierFor()` puts it somewhere no stream selects. Fixed by a map entry plus a
 *                   rewrite. **This is what S11 fixed for seven collections.**
 *   TYPE-BLOCKED  — its display type is admitted by NO stream, whatever its tier. A tier entry
 *                   cannot fix it; the stream has to admit the type, or the type has to change,
 *                   or retrieval has to stop keying on the type at all.
 *
 * Printing them apart is the whole point: S11's fix would have looked applicable to the treaties
 * and would have done nothing.
 *
 * ⚠ BASIS: computed from `tierFor()` + `corpusToType()` + the live `STREAM_SCOPES`, not from a scan
 * of the built index. That is sound HERE because S11 re-tiered the index to match the map and
 * verified it against the running service — but it is a weaker basis than `corpus-reachability.ts`
 * uses, and if the two ever disagree the INDEX is the authority. Stated rather than assumed.
 */
import { corpusToType, EXCLUDED_BY_DESIGN, DEFERRED_TO_GRAPH } from '../lib/lex/corpus-type-map'
import { STREAM_SCOPES, STREAM_SCOPES_V2, streamCanSelect } from '../lib/lex/stream-scopes'
import type { SearchResultType } from '../lib/lex/page1-config'
import fs from 'fs'
import path from 'path'

export {}

const MATRIX = path.join(__dirname, '../../docs/corpus_reachability.json')
const rows = (JSON.parse(fs.readFileSync(MATRIX, 'utf8')) as {
  rows: Array<{ collection: string; sections: number; types: string[]; tier: string; verdict: string }>
}).rows

// The tier map as it reads TODAY (post-S11), not as the matrix snapshot recorded it.
const { tierFor } = require('../../scripts/ingest/search/corpus-map') as { tierFor: (c: string) => string }

const ALL = [...STREAM_SCOPES, ...STREAM_SCOPES_V2]
const n = (v: number) => v.toLocaleString('en-GB')

/**
 * ⚠ THE FOURTH VERDICT IS NOT "BOTH AXES BLOCKED", AND CALLING IT THAT WAS WRONG. The treaties'
 * tier IS owned by a stream (`debates` owns `parliamentary`) and their type IS admitted by a
 * stream (`caselaw` applies no type filter at all). Each axis passes — just never in the SAME
 * stream. That is a materially different fault from "no stream admits TREATY", and it changes the
 * fix: admitting TREATY to `debates` would work, and so would moving the collections to a tier
 * whose owner has no type filter. Naming it precisely is the difference between a proposal that
 * works and one that addresses a fault nobody has.
 */
type Verdict = 'reachable' | 'TYPE-BLOCKED' | 'TIER-BLOCKED' | 'NO-STREAM-PASSES-BOTH' | 'by-design'

function classify(corpus: string, types: SearchResultType[]): Verdict {
  if (corpus in EXCLUDED_BY_DESIGN || corpus in DEFERRED_TO_GRAPH) return 'by-design'
  const tier = tierFor(corpus)
  if (!types.length) return 'TYPE-BLOCKED'
  const reachable = ALL.some((s) => types.some((t) => streamCanSelect(s, corpus, tier, t)))
  if (reachable) return 'reachable'
  // Would ANY stream admit this display type, if the tier were right? (ignore the tier gate)
  const typeOk = ALL.some((s) => types.some((t) => !s.types || s.types.includes(t)))
  // Would ANY stream admit this tier, if the type were right? (ignore the type gate)
  const tierOk = ALL.some((s) => s.tier === tier || s.extraCorpora?.includes(corpus))
  if (typeOk && !tierOk) return 'TIER-BLOCKED'
  if (!typeOk && tierOk) return 'TYPE-BLOCKED'
  return 'NO-STREAM-PASSES-BOTH'
}

function main() {
  console.log('═'.repeat(104))
  console.log('S12 §4 — IS REACHABILITY BEING DECIDED BY THE DISPLAY TYPE?')
  console.log('═'.repeat(104))
  console.log('  basis: tierFor() + corpusToType() + live STREAM_SCOPES (see the header note)\n')

  const out: Record<Verdict, Array<{ c: string; t: string; tier: string; sections: number }>> = {
    reachable: [], 'TYPE-BLOCKED': [], 'TIER-BLOCKED': [], 'NO-STREAM-PASSES-BOTH': [], 'by-design': [],
  }
  for (const r of rows) {
    const types = r.types.filter(Boolean) as SearchResultType[]
    const v = classify(r.collection, types)
    out[v].push({ c: r.collection, t: types.join('+') || 'NULL', tier: tierFor(r.collection), sections: r.sections })
  }

  for (const v of ['TYPE-BLOCKED', 'TIER-BLOCKED', 'NO-STREAM-PASSES-BOTH', 'by-design'] as Verdict[]) {
    const g = out[v]
    console.log(`── ${v} — ${g.length} collection(s), ${n(g.reduce((a, b) => a + b.sections, 0))} sections`)
    for (const x of g) console.log(`     ${x.c.padEnd(26)} type=${x.t.padEnd(20)} tier=${x.tier}   ${n(x.sections)} sections`)
    console.log('')
  }
  console.log(`── reachable — ${out.reachable.length} collections, ${n(out.reachable.reduce((a, b) => a + b.sections, 0))} sections\n`)

  // ⚠ The whole-population statement §6 asks for: every collection is classified, and the counts
  // add up to the total, so nothing has been silently dropped by a filter.
  const total = rows.reduce((a, b) => a + b.sections, 0)
  const classified = Object.values(out).flat().reduce((a, b) => a + b.sections, 0)
  console.log('─'.repeat(104))
  console.log(`  collections classified: ${rows.length} of ${rows.length}   sections: ${n(classified)} of ${n(total)}` +
    (classified === total ? '  ✅ every collection accounted for' : '  ❌ MISMATCH — a collection was dropped'))

  // The type axis, stated directly.
  const byType = new Map<string, { reach: number; blocked: number }>()
  for (const [v, g] of Object.entries(out)) {
    for (const x of g) {
      const e = byType.get(x.t) ?? { reach: 0, blocked: 0 }
      if (v === 'reachable') e.reach++; else if (v === 'TYPE-BLOCKED' || v === 'NO-STREAM-PASSES-BOTH') e.blocked++
      byType.set(x.t, e)
    }
  }
  console.log('\n  display types NO stream admits (the axis §4 is about):')
  let any = false
  for (const [t, e] of [...byType].sort()) {
    if (e.reach === 0 && e.blocked > 0) { console.log(`    ⚠ ${t} — 0 reachable, ${e.blocked} blocked`); any = true }
  }
  if (!any) console.log('    (none)')
  console.log('─'.repeat(104))
}

main()
