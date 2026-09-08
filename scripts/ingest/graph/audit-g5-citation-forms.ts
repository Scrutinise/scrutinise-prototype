/**
 * audit-g5-citation-forms.ts — BRIEF_GRAPH_5 §2.1. HOW JUDGMENTS ACTUALLY CITE LEGISLATION.
 *
 * ⚠⚠ THIS RUNS BEFORE THE EXTRACTOR AND DECIDES ITS DESIGN. GRAPH 4A asked the equivalent question
 * of legislation and the answer was counter-intuitive — of unresolved act names, 59.2% were Acts we
 * do not hold, 31.6% were title mismatches, and only 9.3% were short forms, so the "obvious" lever
 * (short-form resolution) addressed under a tenth of the problem. The brief's instruction is to
 * measure the same breakdown here rather than assume it carries over.
 *
 * ── WHAT IS SHARED, AND WHY NOTHING HERE IS RE-IMPLEMENTED ───────────────────
 *
 * `ACT_NAME_RX`, `resolveActName`, `loadActTitles` and `normTitle` are IMPORTED from
 * `extract-citation-edges.ts`. They are exported for exactly this reason (GRAPH 4A §3): the
 * unresolved count is DEFINED relative to that title map, so a second copy built from the same
 * query drifts the moment either side changes.
 *
 * ⚠ A first draft of this file carried its own act-title regex. It reported "Senior Courts Act
 * 1985" (the Act is 1981) and "A of the Criminal Justice Act 2003" as unmarked act names — its own
 * artefacts, counted as findings. The shared regex exists because two separate truncation bugs
 * have already lived in this shape.
 *
 * WRITES NOTHING TO THE DATABASE.
 *
 *   npx tsx graph/audit-g5-citation-forms.ts [--limit N] [--json <path>]
 */
import fs from 'fs'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { ACT_NAME_RX, resolveActName, loadActTitles, normTitle } from './extract-citation-edges'

const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : Infinity })()
const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()
const CONCURRENCY = parseInt(process.env.G5_CONCURRENCY ?? '24', 10)

const strip = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&#\d+;|&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()

/** ⚠ The five forms §2.1 says to expect. A ref is classified by ITS OWN WORDS, never by its href —
 *  the href is what the publisher resolved it to, which is the answer, not the question. */
type Form = 'full-title' | 'short-form' | 'bare-provision' | 'provision-of-title' | 'other'
const BARE_PROVISION = /^(s\.?|ss\.?|section|sections|reg\.?|regulation|regulations|art\.?|article|para\.?|paragraph|sch\.?|schedule|rule|order)s?\s*\.?\s*\d/i
const HAS_FULL_TITLE = /\b(Act|Measure|Order|Regulations|Rules|Scheme)\s*(?:\((?:Northern Ireland|Scotland|Wales|N\.I\.)\)\s*)?\d{4}\b/
/** "the 1998 Act", "the principal Act", "the 1998 Regulations" — a back-reference to something named earlier. */
const BACK_REFERENCE = /^(the\s+)?(\d{4}|principal|said|relevant|new|old|former)\s+(Act|Measure|Order|Regulations|Rules)\b/i

function formOf(words: string): Form {
  if (BARE_PROVISION.test(words)) return HAS_FULL_TITLE.test(words) ? 'provision-of-title' : 'bare-provision'
  if (HAS_FULL_TITLE.test(words)) return 'full-title'
  if (BACK_REFERENCE.test(words)) return 'short-form'
  return 'other'
}

async function mapPool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i], i) }
  }))
}

type Out = {
  generatedAt: string
  documentsRead: number
  documentsWithLegRef: number
  refs: { total: number; byForm: Record<string, number>; hrefNamesProvision: number; hrefNamesActOnly: number }
  backReferenceResolvedByPublisher: { bare: number; hrefCarriesAct: number }
  markupCompleteness: { actNameSpans: number; marked: number; unmarked: number; pct: number }
  structure: { documentsWithAnyDivision: number; divisions: Record<string, number>; decisionOnly: number }
  unresolved: { total: number; distinct: number; top: Array<[string, number]> }
  volume: { refsPerJudgment: number; judgments: number; projectedRows: number; projectedGB: number; projectedUsdPerMonth: number }
  examples: Array<{ id: string; form: Form; words: string; href: string; sentence: string }>
}

;(async () => {
  const p = namesPool()
  const titles = await loadActTitles()

  const all = (await p.query(
    `SELECT id, "r2RawKey" FROM corpus_sections
      WHERE corpus='tna-caselaw' AND "r2RawKey" IS NOT NULL ORDER BY md5(id || 'g5forms')`)).rows
  const judgmentsTotal = all.length
  const rows = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all
  console.log(`[g5-forms] ${rows.length.toLocaleString()} of ${judgmentsTotal.toLocaleString()} judgments\n`)

  let docs = 0, docsWithLegRef = 0, refTotal = 0, hrefProvision = 0, hrefActOnly = 0
  let bareWords = 0, bareWithActHref = 0
  let spanTotal = 0, spanMarked = 0
  let docsWithDivision = 0, decisionOnly = 0
  const byForm: Record<string, number> = {}
  const divisions: Record<string, number> = {}
  const unresolvedNames = new Map<string, number>()
  const examples: Out['examples'] = []
  /** one example per form, then fill — so the printed twenty show the RANGE, not the commonest */
  const formSeen = new Map<Form, number>()

  let done = 0
  await mapPool(rows, CONCURRENCY, async (r: { id: string; r2RawKey: string }) => {
    const xml = await r2Get(r.r2RawKey)
    if (++done % 5000 === 0) console.log(`  … ${done.toLocaleString()} read`)
    if (!xml) return
    docs++

    const body = xml.match(/<judgmentBody\b[\s\S]*?<\/judgmentBody>/)?.[0] ?? xml

    // ── structure: §2.2's question, counted rather than eyeballed ───────────
    let anyDivision = false, sawDecision = false
    for (const m of body.matchAll(/<(introduction|background|motivation|decision|arguments|remedies|conclusions)\b/g)) {
      divisions[m[1]] = (divisions[m[1]] ?? 0) + 1
      if (m[1] === 'decision') sawDecision = true
      else anyDivision = true
    }
    if (anyDivision) docsWithDivision++
    else if (sawDecision) decisionOnly++

    // ── the refs, and their FORM ────────────────────────────────────────────
    const legRefs = [...body.matchAll(/<ref\b([^>]*uk:type="legislation"[^>]*)>([\s\S]*?)<\/ref>/g)]
    if (legRefs.length) docsWithLegRef++
    const markedSpans = new Set<string>()
    for (const m of legRefs) {
      refTotal++
      const href = m[1].match(/href="([^"]*)"/)?.[1] ?? ''
      const words = strip(m[2])
      markedSpans.add(words)
      const form = formOf(words)
      byForm[form] = (byForm[form] ?? 0) + 1
      const namesProvision = /\/(section|regulation|article|schedule|paragraph|rule|part|chapter)\//.test(href)
      if (namesProvision) hrefProvision++; else hrefActOnly++
      // ⚠⚠ THE MEASUREMENT §2.1 ITEM 1 TURNS ON: words that name only a provision, whose href
      //    nonetheless carries the Act — i.e. the publisher resolved the back-reference for us.
      if (form === 'bare-provision') {
        bareWords++
        if (/legislation\.gov\.uk\/id\/[a-z]+\/[^/]+\/\d+/.test(href)) bareWithActHref++
      }
      if (examples.length < 20 && (formSeen.get(form) ?? 0) < 5) {
        formSeen.set(form, (formSeen.get(form) ?? 0) + 1)
        // the sentence around it, from the plain text, so the form can be checked by eye
        const plain = strip(body)
        const at = plain.indexOf(words)
        const sentence = at < 0 ? '(not located in the flattened text)'
          : plain.slice(Math.max(0, at - 130), at + words.length + 130).trim()
        examples.push({ id: r.id, form, words: words.slice(0, 80), href, sentence })
      }
    }

    // ── markup completeness, with the SHARED act-name detector ──────────────
    const plain = strip(body)
    for (const m of plain.matchAll(ACT_NAME_RX)) {
      spanTotal++
      const span = m[0].trim()
      // marked if the publisher wrapped this exact name, or a suffix of it, in a ref
      const isMarked = markedSpans.has(span) ||
        [...markedSpans].some(s => s.length > 6 && (span.endsWith(s) || s.endsWith(span)))
      if (isMarked) { spanMarked++; continue }
      // an UNMARKED name: can we resolve it ourselves against the shared title map?
      if (!resolveActName(span, titles)) {
        const key = normTitle(span).slice(0, 70)
        unresolvedNames.set(key, (unresolvedNames.get(key) ?? 0) + 1)
      }
    }
  })

  const pctOf = (a: number, b: number) => b ? (100 * a / b) : 0
  const perJudgment = refTotal / Math.max(docs, 1)
  const projectedRows = Math.round(perJudgment * judgmentsTotal)
  const BYTES_PER_ROW = 1160   // measured on the live citation_edge in GRAPH 4A §4
  const projectedGB = projectedRows * BYTES_PER_ROW / 1e9

  const out: Out = {
    generatedAt: new Date().toISOString(),
    documentsRead: docs,
    documentsWithLegRef: docsWithLegRef,
    refs: { total: refTotal, byForm, hrefNamesProvision: hrefProvision, hrefNamesActOnly: hrefActOnly },
    backReferenceResolvedByPublisher: { bare: bareWords, hrefCarriesAct: bareWithActHref },
    markupCompleteness: { actNameSpans: spanTotal, marked: spanMarked, unmarked: spanTotal - spanMarked, pct: pctOf(spanMarked, spanTotal) },
    structure: { documentsWithAnyDivision: docsWithDivision, divisions, decisionOnly },
    unresolved: {
      total: [...unresolvedNames.values()].reduce((a, b) => a + b, 0),
      distinct: unresolvedNames.size,
      top: [...unresolvedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60),
    },
    volume: {
      refsPerJudgment: perJudgment, judgments: judgmentsTotal, projectedRows,
      projectedGB, projectedUsdPerMonth: projectedGB * 0.35,
    },
    examples,
  }

  console.log(`\n══ §2.1 — HOW JUDGMENTS CITE LEGISLATION ══`)
  console.log(`  judgments read                          ${docs.toLocaleString()}`)
  console.log(`  carrying at least one legislation ref   ${docsWithLegRef.toLocaleString()}  (${pctOf(docsWithLegRef, docs).toFixed(1)}%)`)
  console.log(`  legislation refs                        ${refTotal.toLocaleString()}`)
  console.log(`\n  BY FORM — classified by the ref's OWN WORDS, not by what the publisher resolved it to:`)
  for (const [k, v] of Object.entries(byForm).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${String(v).padStart(8)}  ${pctOf(v, refTotal).toFixed(1)}%`)
  }
  console.log(`\n  href names a PROVISION                  ${hrefProvision.toLocaleString()}  (${pctOf(hrefProvision, refTotal).toFixed(1)}%)`)
  console.log(`  href names the ACT only                 ${hrefActOnly.toLocaleString()}  (${pctOf(hrefActOnly, refTotal).toFixed(1)}%)`)
  console.log(`\n  ⚠⚠ THE BACK-REFERENCE, RESOLVED BY THE PUBLISHER:`)
  console.log(`     refs whose WORDS name only a provision   ${bareWords.toLocaleString()}`)
  console.log(`     of those, href carries the Act too       ${bareWithActHref.toLocaleString()}  (${pctOf(bareWithActHref, bareWords).toFixed(1)}%)`)

  console.log(`\n══ MARKUP COMPLETENESS — the GRAPH 4A question ══`)
  console.log(`  act-name spans in the text (shared ACT_NAME_RX)   ${spanTotal.toLocaleString()}`)
  console.log(`  already wearing a <ref>                           ${spanMarked.toLocaleString()}  ${out.markupCompleteness.pct.toFixed(1)}%`)
  console.log(`  NOT marked up                                     ${(spanTotal - spanMarked).toLocaleString()}`)

  console.log(`\n══ §2.2 — DOES THE STRUCTURE SEPARATE REASONING FROM BACKGROUND? ══`)
  console.log(`  documents carrying a division other than <decision>  ${docsWithDivision.toLocaleString()}  (${pctOf(docsWithDivision, docs).toFixed(2)}%)`)
  console.log(`  documents carrying ONLY <decision>                    ${decisionOnly.toLocaleString()}  (${pctOf(decisionOnly, docs).toFixed(2)}%)`)
  console.log(`  every division seen: ${Object.entries(divisions).map(([k, v]) => `${k}=${v.toLocaleString()}`).join('  ') || '(none)'}`)

  console.log(`\n══ UNRESOLVED ACT NAMES (unmarked AND not in the shared title map) ══`)
  console.log(`  spans ${out.unresolved.total.toLocaleString()} over ${out.unresolved.distinct.toLocaleString()} distinct names`)
  out.unresolved.top.slice(0, 20).forEach(([n, c]) => console.log(`    ${String(c).padStart(5)}  ${n}`))

  console.log(`\n══ VOLUME ══`)
  console.log(`  refs per judgment       ${perJudgment.toFixed(2)}`)
  console.log(`  × ${judgmentsTotal.toLocaleString()} judgments = ${projectedRows.toLocaleString()} rows`)
  console.log(`  at 1,160 bytes/row (measured on citation_edge) = ${projectedGB.toFixed(2)} GB = $${(projectedGB * 0.35).toFixed(2)}/month`)
  console.log(`  ⚠ storage is a bill, not a wall. No alarm is raised and no threshold is implied.`)

  console.log(`\n══ TWENTY REAL EXAMPLES, WITH THE WORDS THAT MAKE THEM ══`)
  examples.forEach((e, i) => {
    console.log(`\n  ${String(i + 1).padStart(2)}. [${e.form}]  ${e.id}`)
    console.log(`      words : "${e.words}"`)
    console.log(`      href  : ${e.href}`)
    console.log(`      text  : …${e.sentence.slice(0, 240)}…`)
  })

  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log(`\n  → ${JSON_OUT}`) }
  await endNamesPool()
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
