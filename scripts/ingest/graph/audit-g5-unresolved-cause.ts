/**
 * audit-g5-unresolved-cause.ts — BRIEF_GRAPH_5 §2.1 item 2.
 *
 * GRAPH 4A classified legislation's unresolved act names by cause and got a counter-intuitive
 * answer: 59.2% were Acts we do not hold, 31.6% were title mismatches, and only 9.3% were short
 * forms — so the lever everyone expected (short-form resolution) addressed under a tenth of it.
 * The brief's instruction is to measure the same breakdown here rather than assume it carries over.
 *
 * ── ⚠⚠ A DEFECT IN THIS FILE'S FIRST VERSION, FOUND BY READING ITS OWN OUTPUT ──
 *
 * The first version asked `corpus_acts` with `lower(title) LIKE '%' || span`. The SPAN is
 * normalised (`normTitle` collapses whitespace, folds curly apostrophes, strips full stops and
 * commas); the TITLE in that comparison is raw. So every name differing by punctuation failed to
 * match and was filed as **title-absent** — "magistrates courts act 1980" reported as an Act we do
 * not hold, when the Magistrates' Courts Act 1980 is right there and the judgment simply omitted
 * the apostrophe. `title-absent` came out at 78.1% and `title-mismatch` at **0.0%**, which is the
 * shape of an instrument that cannot produce one of its own answers.
 *
 * ⚠ Two literal comparisons agreeing with each other is not corroboration when they share the
 * assumption. So this version compares **normalised to normalised, through the SAME title map the
 * detector uses** — `loadActTitles()`, whose keys are already `normTitle`d — and adds a LOOSE
 * form (punctuation removed entirely) as a separate, named test for the mismatch bucket.
 *
 * ⚠⚠ AND ONE CAUSE IS ADDED BEYOND 4A'S THREE, because the data demanded it: several of the
 * commonest names are **the right Act with the wrong year** ("human rights act 1988", "crime and
 * disorder act 1988"), written by a judge or introduced by OCR. 4A's scheme files those as
 * `title-absent` and thereby reports a corpus coverage gap where the real fact is a mis-citation
 * in the source. The 4A-comparable three-bucket figure is reported alongside, so the extra bucket
 * cannot be mistaken for a difference in the corpus.
 *
 * WRITES NOTHING.
 *   npx tsx graph/audit-g5-unresolved-cause.ts [--json <path>]
 */
import fs from 'fs'
import path from 'path'
import { endNamesPool } from '../names/names-pool'
import { loadActTitles, normTitle } from './extract-citation-edges'
import { endNeonPool } from '../shared/neon-pool'

type Cause = 'short-form' | 'title-absent' | 'title-mismatch' | 'mis-cited-year'
const JSON_OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null })()

/** ⚠ LOOSER than `normTitle`: punctuation gone entirely, so "magistrates' courts" and
 *  "magistrates courts" become the same key. Used ONLY to diagnose a mismatch — never to resolve
 *  one. Resolving on this would merge identities on resemblance, which §2.3 forbids outright. */
const loose = (s: string) => normTitle(s).replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim()

;(async () => {
  const audit = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-g5-citation-forms.json'), 'utf8'))
  const top: Array<[string, number]> = audit.unresolved.top
  const totalSpans: number = audit.unresolved.total

  // the DETECTOR'S OWN map — so "unresolved" and "why" are defined against the same thing
  const titles = await loadActTitles()
  const looseIndex = new Map<string, string>()
  const stemsByYear = new Map<string, Set<string>>()   // loose stem → years it exists in
  for (const [k, gid] of titles) {
    looseIndex.set(loose(k), gid)
    const yr = k.match(/\b(\d{4})\b\s*$/)?.[1]
    if (yr) {
      const stem = loose(k.replace(/\s*\d{4}\s*$/, ''))
      if (stem.length > 6) {
        if (!stemsByYear.has(stem)) stemsByYear.set(stem, new Set())
        stemsByYear.get(stem)!.add(yr)
      }
    }
  }
  // suffix lookup for the short-form test: last-3-words key → full normalised titles
  const bySuffix = new Map<string, string[]>()
  for (const k of titles.keys()) {
    const w = k.split(' ')
    for (let take = 3; take <= Math.min(6, w.length); take++) {
      const key = w.slice(-take).join(' ')
      if (!bySuffix.has(key)) bySuffix.set(key, [])
      if (bySuffix.get(key)!.length < 8) bySuffix.get(key)!.push(k)
    }
  }

  console.log(`[g5-cause] ${titles.size.toLocaleString()} titles indexed; classifying ${top.length} names ` +
    `(${top.reduce((n, t) => n + t[1], 0).toLocaleString()} of ${totalSpans.toLocaleString()} spans)\n`)

  const totals: Record<Cause, number> = { 'short-form': 0, 'title-absent': 0, 'title-mismatch': 0, 'mis-cited-year': 0 }
  const rows: Array<{ span: string; spans: number; cause: Cause; evidence: string }> = []

  for (const [span, n] of top) {
    const yr = span.match(/\b(\d{4})\b\s*$/)?.[1] ?? null
    const l = loose(span)
    let cause: Cause, evidence: string

    const looseHit = looseIndex.get(l)
    // ⚠ a STRICT suffix of a held title, normalised both sides — 4A's short-form test
    const suffixHit = bySuffix.get(span.split(' ').slice(-3).join(' '))
      ?.find(t => t.length > span.length + 3 && t.endsWith(span))
    const stem = loose(span.replace(/\s*\d{4}\s*$/, ''))
    const yearsHeld = stemsByYear.get(stem)

    if (looseHit) {
      // held, and only punctuation or spacing separates the two — a normalisation failure
      cause = 'title-mismatch'
      evidence = `held as ${looseHit}; differs from the span only by punctuation/spacing`
    } else if (suffixHit) {
      cause = 'short-form'
      evidence = `strict suffix of "${suffixHit.slice(0, 70)}" (${titles.get(suffixHit)})`
    } else if (yearsHeld && yr && !yearsHeld.has(yr)) {
      cause = 'mis-cited-year'
      evidence = `⚠ no "${stem}" Act of ${yr}; we hold that name for ${[...yearsHeld].sort().slice(0, 5).join(', ')}`
    } else {
      cause = 'title-absent'
      evidence = 'no instrument of that name in corpus_acts under any title, normalised or loose'
    }
    totals[cause] += n
    rows.push({ span, spans: n, cause, evidence })
  }

  for (const r of rows.slice(0, 30)) {
    console.log(`  ${String(r.spans).padStart(5)}  ${r.cause.padEnd(15)} ${r.span}`)
    console.log(`         ${r.evidence}`)
  }

  const counted = Object.values(totals).reduce((a, b) => a + b, 0)
  console.log(`\n══ CAUSE, weighted by spans (top ${top.length} names = ${counted.toLocaleString()} spans) ══`)
  for (const [k, v] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${String(v).padStart(6)}  ${(100 * v / counted).toFixed(1)}%`)
  }
  const asFour = 100 * totals['short-form'] / counted
  const asThree = 100 * totals['short-form'] / Math.max(counted - totals['mis-cited-year'], 1)
  console.log(`\n  ▶ short-form resolution addresses ${asFour.toFixed(1)}% of these spans.`)
  console.log(`    On 4A's THREE-bucket scheme (mis-cited years folded into title-absent, as 4A would`)
  console.log(`    have filed them) the comparable figure is ${asThree.toFixed(1)}% — against 4A's 9.3%.`)
  console.log(`\n  ⚠ These spans are the residual AFTER the markup: ${totalSpans.toLocaleString()} of ` +
    `${audit.markupCompleteness.actNameSpans.toLocaleString()} act-name spans ` +
    `(${(100 * totalSpans / audit.markupCompleteness.actNameSpans).toFixed(1)}%). ` +
    `Unlike 4A, this is not the main population — it is what is left over.`)

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), totals, counted, rows }, null, 2))
    console.log(`\n  → ${JSON_OUT}`)
  }
  await endNamesPool(); await endNeonPool()
})().catch(async e => { console.error(e); await endNamesPool(); await endNeonPool(); process.exit(1) })
