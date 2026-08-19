// ─────────────────────────────────────────────────────────────────────────────
// measure-s8-attribution.ts — BRIEF_SEARCH_S8 §2's verification.
//
// "the S5 ten-question set re-run; count results carrying attribution per collection and report
//  the rate against the audit's coverage estimate — if the two diverge, that is the finding."
//
// ⚠ THE AUDIT AND THIS ARE MEASURING DIFFERENT DENOMINATORS ON PURPOSE. The audit
// (scripts/audit-s8-attribution.ts) samples the STORE — what fraction of rows in a collection
// hold the column. This samples what RETRIEVAL RETURNS — what fraction of the documents ten real
// questions actually surface carry it. The second is what a user experiences, and it can differ
// sharply from the first: retrieval is not a uniform sample of a collection, and modern Hansard
// (99.5% attributed) outranks 1919 Hansard (4.0%) on almost every query a user would ask.
//
// ⚠ Run against a CONFIGURED stack, and the harness prints what it resolved AND reads `served`
// off the services either side of the run (S8 §3's positive readback). A run where `served` does
// not move did not measure retrieval, whatever the env said.
//
//   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation,caselaw,guidance \
//     npx tsx --env-file=.env scripts/measure-s8-attribution.ts
// ─────────────────────────────────────────────────────────────────────────────

import { retrieveForChat, evidenceBlock } from '../lib/lex/chat-retrieval'
import {
  assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta,
} from '../lib/lex/harness-preflight'
import { attributionLine } from '../lib/lex/attribution'

export {}

/** ⚠ THE SAME TEN QUESTIONS S4 AUDITED AND S5 RE-RAN, verbatim, so the three are comparable. */
const PROBES = [
  'companies act 2006 directors duties',
  'data protection lawful basis for processing personal data',
  'equality act public sector equality duty',
  'what have select committees said about water company sewage discharge',
  'what did MPs argue in the debate on assisted dying',
  'how have the courts interpreted the duty to make reasonable adjustments',
  'government guidance on procurement social value',
  'what evidence did witnesses give on leasehold reform',
  'has parliament scrutinised the rollout of universal credit',
  'what was said about buy now pay later regulation in parliament',
]

/**
 * The audit's per-collection estimate, transcribed from docs/S8_ATTRIBUTION_AUDIT.txt so the
 * comparison §2 asks for is made by the script rather than by a reader holding two documents.
 * Keyed by DISPLAY TYPE, because that is what a retrieved result carries — one type can be
 * served by several collections, and where it is, the range is given.
 */
const AUDIT_ESTIMATE: Record<string, string> = {
  COMMITTEE: '0% — no structured attribution on either column (0 of 800 rows, 4 id offsets)',
  DEBATE: '4.0–99.5% — pwdata-debates `speaker`, rising with date; scottish-parliament-or 100%',
  CASE_LAW: '0% — court named only in a title prefix on scottish-courts; nothing structural',
  GUIDANCE: '0% across all seven regulator collections sampled',
  IMPACT_ASSESSMENT: '100% — `attribution` = "{department} — {stage}"',
  CONSULTATION: '100% — `attribution` = organisation, sometimes with a stage suffix',
  EXPLANATORY_NOTE: '0%',
  DIVISION: '0%',
  BILL: 'not sampled',
  TREATY: 'not sampled',
}

const pct = (a: number, b: number) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(0)}%`)

async function main() {
  assertRetrievalConfig('measure-s8-attribution')
  const before = await readServiceConfig()
  console.log(resolvedConfigLine())
  for (const s of before) console.log(`[readback:before] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)

  const byType = new Map<string, { total: number; attributed: number; egName: string | null; egRole: string | null }>()
  let evidenceTotal = 0
  let evidenceAttributed = 0
  let firstBlock: string | null = null

  for (const q of PROBES) {
    const r = await retrieveForChat({ query: q, limit: 10 })
    const withAttr = r.evidence.filter((e) => e.attribution).length
    evidenceTotal += r.evidence.length
    evidenceAttributed += withAttr
    for (const e of r.evidence) {
      const k = String(e.kind)
      const cur = byType.get(k) ?? { total: 0, attributed: 0, egName: null, egRole: null }
      cur.total++
      if (e.attribution) {
        cur.attributed++
        cur.egName ??= e.attribution.name
        cur.egRole ??= e.attribution.role
      }
      byType.set(k, cur)
    }
    console.log(`\nQ: ${q}`)
    console.log(`   legislation ${r.legislation.length} · evidence ${r.evidence.length} · attributed ${withAttr}/${r.evidence.length} (${pct(withAttr, r.evidence.length)})${r.failed ? '  ⚠ SEARCH FAILED' : ''}`)
    for (const e of r.evidence.slice(0, 3)) {
      console.log(`     [${e.kindLabel}] ${e.title.slice(0, 78)}`)
      console.log(`        ${attributionLine(e.attribution) ?? '(no attribution held for this collection)'}`)
    }
    if (!firstBlock && r.evidence.length) firstBlock = evidenceBlock(r.evidence)
  }

  const after = await readServiceConfig()
  for (const s of after) console.log(`[readback:after ] ${s.name} ${s.reachable ? 'OK' : 'UNREACHABLE'} ${s.detail}`)
  console.log(`[engagement] ${servedDelta(before, after)}`)

  console.log('\n════ ATTRIBUTION RATE, RETRIEVED vs AUDITED ════')
  console.log(`overall evidence-channel results: ${evidenceAttributed}/${evidenceTotal} attributed (${pct(evidenceAttributed, evidenceTotal)})`)
  console.log('\n  display type        retrieved   attributed   rate     the audit said')
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${k.padEnd(20)}${String(v.total).padStart(6)}${String(v.attributed).padStart(13)}${pct(v.attributed, v.total).padStart(9)}     ${AUDIT_ESTIMATE[k] ?? '(not in the audit)'}`)
    if (v.egName) console.log(`  ${''.padEnd(20)}e.g. ${v.egName} — ${v.egRole}`)
  }

  if (firstBlock) {
    console.log('\n════ ONE RENDERED EVIDENCE BLOCK, AS LEX RECEIVES IT ════')
    console.log(firstBlock.slice(0, 2200))
  }
  console.log(`\n${resolvedConfigLine()}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
