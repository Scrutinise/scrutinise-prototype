/**
 * audit-4a-t3-spans.ts — GRAPH 4A §3 (T3, OI-18): where do the unresolved
 * act-name spans SIT?
 *
 * 25-H counted 93,772 act-name spans that resolved to no instrument (6.6% of
 * 1,429,037). ⚠ **That number is a statistic, not a table** — the spans were
 * counted and thrown away. So the only honest way to ask "what proportion of
 * them sit in documents that also cite one of the twelve research targets?" is
 * to run the SAME detector again and watch it. This file does exactly that: it
 * imports `extractDocText` from the shipped extractor and passes the
 * `onUnresolved` callback. It re-implements nothing.
 *
 * The number decides one thing: whether short-form resolution ("the 1998 Act",
 * "the principal Act") is urgent or merely wanted. ⚠ It does NOT build it — that
 * needs document-scoped context and is its own piece of work.
 *
 * ⚠⚠ **THE TWELVE TARGETS ARE NOT DEFINED ANYWHERE IN THE REPOSITORY.** The
 * handover the brief executes is not in the tree. `TARGETS` below is therefore
 * an assumption, fixed in `CHANGE_LOG.md` at 2026-08-26 12:41 UTC *before* this
 * ran so the list could not be chosen to fit the answer, and raised as a
 * decision for Charlie in the report. Every gid is checked against `corpus_acts`
 * on startup and a miss is FATAL — a mistyped gid would silently contribute
 * zero and quietly shrink the answer.
 *
 * Writes nothing. Reads the zip and two tables.
 *
 *   npx tsx graph/audit-4a-t3-spans.ts [--json out.json] [--limit N]
 */
import fs from 'fs'
import { ZipReader } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { extractDocText, loadActTitles } from './extract-citation-edges'
import { CITATION_TABLE } from './setup-citation-edge-table'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex']

/** ⚠ ASSUMPTION — see the header. Fixed before the measurement, not after. */
const TARGETS: Array<[string, string]> = [
  ['ukpga/2010/15', 'Equality Act 2010'],
  ['ukpga/1998/42', 'Human Rights Act 1998'],
  ['ukpga/2010/25', 'Constitutional Reform and Governance Act 2010'],
  ['ukpga/2022/18', 'Down Syndrome Act 2022'],
  ['ukpga/2010/8', 'Taxation (International and Other Provisions) Act 2010'],
  ['ukpga/2018/12', 'Data Protection Act 2018'],
  ['ukpga/2006/46', 'Companies Act 2006'],
  ['ukpga/2000/36', 'Freedom of Information Act 2000'],
  ['ukpga/1998/46', 'Scotland Act 1998'],
  ['ukpga/2006/32', 'Government of Wales Act 2006'],
  ['ukpga/1998/47', 'Northern Ireland Act 1998'],
  ['ukpga/1988/1', 'Income and Corporation Taxes Act 1988'],
]

async function main() {
  const pool = getNeonPool()
  const limitIx = process.argv.indexOf('--limit')
  const limit = limitIx >= 0 ? parseInt(process.argv[limitIx + 1] ?? '0', 10) : 0

  // ── the twelve must exist, or the denominator lies ────────────────────────
  const { rows: found } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE gid = ANY($1::text[])`, [TARGETS.map(t => t[0])])
  const have = new Map(found.map((r: { gid: string; title: string }) => [r.gid, r.title]))
  const missing = TARGETS.filter(([g]) => !have.has(g))
  console.log(`[4a-T3] the twelve targets, checked against corpus_acts:`)
  for (const [g, name] of TARGETS) console.log(`   ${have.has(g) ? 'ok  ' : 'MISS'} ${g.padEnd(15)} ${have.get(g) ?? name}`)
  if (missing.length) throw new Error(`${missing.length} target gid(s) not in corpus_acts: ${missing.map(m => m[0]).join(', ')} — a mistyped gid contributes zero silently`)

  // ── which documents cite one of the twelve, per citation_edge ─────────────
  // ⚠ Kept PER TARGET, not merged. A short form is a short form OF something:
  // "the Taxes Act 1988" is ICTA 1988, which is target #12, so a document that
  // cites ICTA properly once and abbreviates it thereafter contributes
  // unresolved spans to its own target's bucket. That is arguably the right
  // answer — it is exactly what short-form resolution would fix — but it makes
  // the headline sensitive to the list, so the leave-one-out below reports how
  // much of the result any single target is carrying.
  const targetCiters = new Map<string, Set<string>>()
  for (const [gid] of TARGETS) {
    const { rows } = await pool.query(
      `SELECT DISTINCT source_gid FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [gid])
    targetCiters.set(gid, new Set<string>(rows.map((r: { source_gid: string }) => r.source_gid)))
  }
  const citesATarget = new Set<string>()
  for (const s of targetCiters.values()) for (const g of s) citesATarget.add(g)
  console.log(`[4a-T3] ${citesATarget.size.toLocaleString()} documents carry a resolved citation to one of the twelve`)
  for (const [gid, name] of TARGETS) console.log(`     ${String(targetCiters.get(gid)!.size).padStart(6)}  ${name}`)

  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid
     FROM corpus_sections WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  const titles = await loadActTitles()

  // ── the pass ──────────────────────────────────────────────────────────────
  console.log(`[4a-T3] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  let entries = zip.entries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: typeof zip.entries[0]; m: RegExpMatchArray } => x.m != null)
  if (limit) entries = entries.filter((_, i) => i % Math.floor(entries.length / limit) === 0).slice(0, limit)
  console.log(`[4a-T3] ${entries.length.toLocaleString()} documents${limit ? ' (SAMPLED — the proportion is estimated, the totals are not comparable to 25-H)' : ''}`)

  let docs = 0, docErrors = 0, unresolvedTotal = 0, unresolvedInCiters = 0
  let docsWithUnresolved = 0, citerDocsWithUnresolved = 0
  const nameTally = new Map<string, number>()
  const citerNameTally = new Map<string, number>()
  /** per-document unresolved count — the leave-one-out needs it after the pass */
  const unresolvedByDoc = new Map<string, number>()
  const t0 = Date.now()

  for (const { e, m } of entries) {
    const gid = gidFromEntry(m)
    const isCiter = citesATarget.has(gid)
    let n = 0
    try {
      extractDocText(gid, zip.readText(e), titles, held, (span) => {
        n++
        const k = span.replace(/\s+/g, ' ').trim().toLowerCase().slice(-60)
        nameTally.set(k, (nameTally.get(k) ?? 0) + 1)
        if (isCiter) citerNameTally.set(k, (citerNameTally.get(k) ?? 0) + 1)
      })
    } catch (err) {
      docErrors++
      continue
    }
    docs++
    unresolvedTotal += n
    if (n > 0) {
      docsWithUnresolved++
      unresolvedByDoc.set(gid, n)
      if (isCiter) citerDocsWithUnresolved++
    }
    if (isCiter) unresolvedInCiters += n
    if (docs % 5000 === 0) {
      console.log(`  ${docs}/${entries.length} docs, unresolved=${unresolvedTotal.toLocaleString()}, ` +
        `inCiters=${unresolvedInCiters.toLocaleString()} (${(100 * unresolvedInCiters / Math.max(1, unresolvedTotal)).toFixed(1)}%), ` +
        `${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  zip.close()

  const pct = 100 * unresolvedInCiters / Math.max(1, unresolvedTotal)

  // ── leave-one-out: how much of the headline does one target carry? ────────
  const loo = TARGETS.map(([gid, name]) => {
    const others = new Set<string>()
    for (const [g, s] of targetCiters) if (g !== gid) for (const d of s) others.add(d)
    let spans = 0
    for (const [doc, n] of unresolvedByDoc) if (others.has(doc)) spans += n
    return { gid, name, pctWithout: 100 * spans / Math.max(1, unresolvedTotal), spansWithout: spans }
  }).sort((a, b) => a.pctWithout - b.pctWithout)
  console.log(`\n══ T3 RESULT ══`)
  console.log(`  documents read                       : ${docs.toLocaleString()} (${docErrors} errors)`)
  console.log(`  unresolved act-name spans            : ${unresolvedTotal.toLocaleString()}`)
  console.log(`    (25-H's shipped counter said 93,772 over the full corpus)`)
  console.log(`  documents carrying at least one      : ${docsWithUnresolved.toLocaleString()}`)
  console.log(`  ── of those spans, sitting in a document that also cites one of the twelve:`)
  console.log(`  spans     : ${unresolvedInCiters.toLocaleString()}  →  ${pct.toFixed(1)}%`)
  console.log(`  documents : ${citerDocsWithUnresolved.toLocaleString()} of ${docsWithUnresolved.toLocaleString()}`)
  console.log(`\n  DECISION RULE, fixed in CHANGE_LOG before this ran: urgent above 40%.`)
  console.log(`  → short-form resolution is ${pct > 40 ? 'URGENT' : 'WANTED, NOT URGENT'} at ${pct.toFixed(1)}%.`)

  console.log(`\n  ⚠ LEAVE-ONE-OUT — the headline with each target REMOVED from the twelve.`)
  console.log(`    A big drop means that one target is carrying the result, which matters because`)
  console.log(`    a short form is a short form OF something: drop the Act and you drop its own`)
  console.log(`    abbreviations from the numerator too.`)
  for (const l of loo) console.log(`    ${l.pctWithout.toFixed(1).padStart(5)}%  without ${l.name}`)
  const worst = loo[0]
  console.log(`    → most load-bearing: ${worst.name} (${pct.toFixed(1)}% → ${worst.pctWithout.toFixed(1)}%).`)
  console.log(`    → the decision ${loo.every(l => l.pctWithout > 40) === (pct > 40) ? 'SURVIVES every leave-one-out' : 'FLIPS on at least one leave-one-out — it is a property of the list, not of the corpus'}.`)

  console.log(`\n  the twenty commonest unresolved names, corpus-wide:`)
  for (const [k, n] of [...nameTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`    ${String(n).padStart(6)}  ${k}${citerNameTally.has(k) ? `   [${citerNameTally.get(k)} in target-citing docs]` : ''}`)
  }

  const out = {
    at: new Date().toISOString(), sampled: limit > 0, docs, docErrors,
    targets: TARGETS.map(([gid, name]) => ({ gid, name, corpusTitle: have.get(gid) })),
    documentsCitingATarget: citesATarget.size,
    unresolvedTotal, unresolvedInCiters, pctInCiters: pct,
    docsWithUnresolved, citerDocsWithUnresolved,
    urgent: pct > 40, leaveOneOut: loo,
    decisionSurvivesLeaveOneOut: loo.every(l => (l.pctWithout > 40) === (pct > 40)),
    topUnresolvedNames: [...nameTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60),
  }
  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[4a-T3] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-T3] FATAL', e); process.exit(1) })
}
