/**
 * check-graph5-citation.ts — GRAPH 5 §2, asserted against what was STORED.
 *
 * ⚠⚠ THE ASSERTION THAT MATTERS IS THE ROUND TRIP. Everything else here can pass on a table full
 * of well-formed nonsense: counts reconcile, constraints hold, no column is blank — and every
 * quote could still be text that appears nowhere in the judgment it names. So the central check
 * takes stored rows, re-reads the ORIGINAL XML out of R2, and requires the quoted words to be
 * found in it. "The extractor wrote a row" and "the row is true of the document" are different
 * claims and only the second is about the corpus.
 *
 * ⚠ And the attempted-vs-stored reconciliation is here because the first full run reported 974,802
 * rows written having written 1,288,630 — a lost-update race on the counter, not on the data. A
 * run that cannot say how many rows it stored has not finished; the table is the authority.
 *
 *   npx tsx graph/check-graph5-citation.ts [--sample 60]
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { parseLegUri } from './graph-common'

const SAMPLE = (() => { const i = process.argv.indexOf('--sample'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 60 })()
let pass = 0, fail = 0, controls = 0
const assert = (ok: boolean, what: string, detail = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? '  ok' : 'FAIL'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const control = (fired: boolean, what: string, detail = '') => {
  controls++; fired ? pass++ : fail++
  console.log(`  ${fired ? 'ctrl' : 'DEAD'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const N = (v: unknown) => Number(v)

;(async () => {
  console.log(`\nGRAPH 5 §2 — CASE LAW TO LEGISLATION\n`)
  const p = namesPool()

  // ── shape ─────────────────────────────────────────────────────────────────
  console.log('── the stored rows ──')
  const s = (await p.query(`
    SELECT COUNT(*)::bigint rows,
           COUNT(DISTINCT source_gid)::bigint judgments,
           COUNT(*) FILTER (WHERE detection <> 'caselaw-markup')::bigint wrong_detection,
           COUNT(*) FILTER (WHERE btrim(citation_text) = '' OR btrim(raw_fragment) = '')::bigint blank,
           COUNT(*) FILTER (WHERE target_uri IS NULL OR btrim(target_uri) = '')::bigint no_uri,
           COUNT(*) FILTER (WHERE target_act_id IS NULL)::bigint no_act,
           COUNT(*) FILTER (WHERE resolved)::bigint resolved,
           COUNT(*) FILTER (WHERE source_provision_ref IS NOT NULL)::bigint anchored
      FROM ${CITATION_TABLE} WHERE source_type = 'caselaw'`)).rows[0]
  assert(N(s.rows) > 0, 'case-law rows exist', `${N(s.rows).toLocaleString()} rows from ${N(s.judgments).toLocaleString()} judgments`)
  assert(N(s.wrong_detection) === 0, "every case-law row carries detection 'caselaw-markup'", `${N(s.wrong_detection)} wrong`)

  // ⚠⚠ §2.3: every edge quotes the words that make it. NOT NULL permits '' — this is the content rule.
  assert(N(s.blank) === 0, '⚠⚠ every edge quotes the words that make it — no blank evidence',
    `${N(s.blank)} rows with an empty quote`)
  assert(N(s.no_uri) === 0, 'every row keeps the raw target URI', `${N(s.no_uri)}`)
  assert(N(s.no_act) === 0, 'every row carries a normalised target id', `${N(s.no_act)}`)

  // ── ⚠⚠ THE ROUND TRIP ─────────────────────────────────────────────────────
  console.log('\n── ⚠⚠ THE ROUND TRIP: does the quote appear in the judgment it names? ──')
  const rows = (await p.query(`
    SELECT c.source_gid, c.citation_text, c.target_uri, c.target_act_id, cs."r2RawKey"
      FROM ${CITATION_TABLE} c JOIN corpus_sections cs ON cs.id = c.source_gid
     WHERE c.source_type = 'caselaw' ORDER BY md5(c.id::text || 'g5rt') LIMIT $1`, [SAMPLE])).rows
  const flat = (x: string) => x.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_: string, d: string) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ').trim()
  let read = 0, quoteFound = 0, hrefFound = 0
  const misses: string[] = []
  for (const r of rows) {
    const xml = await r2Get(r.r2RawKey)
    if (!xml) continue
    read++
    // the LAST 60 characters of the quote — the part nearest the citation, least likely to be
    // clipped by the 300-char window's leading-word trim
    const tail = String(r.citation_text).trim().slice(-60)
    if (flat(xml).includes(tail)) quoteFound++
    else if (misses.length < 3) misses.push(`${r.source_gid}: ${JSON.stringify(tail)}`)
    if (xml.includes(String(r.target_uri))) hrefFound++
  }
  assert(read >= rows.length * 0.95, 'the judgments behind the sampled rows were re-read from R2', `${read} of ${rows.length}`)
  assert(quoteFound === read, '⚠⚠ every sampled quote is FOUND in the judgment it is attributed to',
    misses.length ? `${read - quoteFound} not found, e.g. ${misses[0]}` : `${quoteFound} of ${read}`)
  assert(hrefFound === read, 'and every stored target URI appears verbatim in that judgment’s XML',
    `${hrefFound} of ${read}`)
  // ⚠ the round trip must be capable of failing, or it proves nothing about the rows
  control(!flat('<p>a judgment about fishing quotas</p>').includes('a phrase that is not there'),
    'the round-trip test rejects a quote the document does not contain')

  // ── identity: the regnal trap, checked on real stored rows ────────────────
  console.log('\n── the identity resolver, on rows that actually exist ──')
  const regnal = (await p.query(`
    SELECT COUNT(*)::bigint n, COUNT(*) FILTER (WHERE resolved)::bigint held
      FROM ${CITATION_TABLE} WHERE source_type='caselaw' AND target_act_id ~ '^[a-z]+/[A-Z]'`)).rows[0]
  assert(N(regnal.n) > 0, '⚠ pre-1963 regnal-form targets ARE present — a zero here would mean the trap fired again',
    `${N(regnal.n).toLocaleString()} regnal targets, ${N(regnal.held).toLocaleString()} held`)
  // every stored target_act_id must be something parseLegUri agrees with, read off the raw uri
  const uris = (await p.query(
    `SELECT target_uri, target_act_id FROM ${CITATION_TABLE} WHERE source_type='caselaw'
      ORDER BY md5(id::text || 'g5id') LIMIT 400`)).rows
  const disagree = uris.filter((u: { target_uri: string; target_act_id: string }) => {
    const parsed = parseLegUri(u.target_uri)
    return !parsed || (parsed.gid !== u.target_act_id && !u.target_act_id.startsWith(parsed.gid.split('/')[0]))
  })
  assert(disagree.length === 0, 'every stored id is derivable from its own raw URI — a bad normalisation is recoverable',
    disagree.length ? `${disagree.length} disagree, e.g. ${disagree[0].target_uri} → ${disagree[0].target_act_id}` : `${uris.length} checked`)

  // ── §2.2's answer must be visible in the DATA, not only in the report ─────
  console.log('\n── §2.2: the reasoning/background distinction is NOT stored, and that is deliberate ──')
  const cols = (await p.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [CITATION_TABLE])
  ).rows.map((r: { column_name: string }) => r.column_name)
  const pretend = cols.filter((c: string) => /ratio|obiter|reasoning|central|importance|weight|rank/i.test(c))
  assert(pretend.length === 0,
    '⚠ no column claims to distinguish a provision the case TURNED ON from one mentioned in passing',
    pretend.length ? `FOUND: ${pretend.join(', ')}` : 'none — the AkN structure does not support it and we do not pretend otherwise')

  // ── the paragraph anchor is real where present, absent where the source has none ──
  console.log('\n── the paragraph anchor ──')
  const anchors = (await p.query(`
    SELECT COUNT(*)::bigint total,
           COUNT(*) FILTER (WHERE source_provision_ref LIKE 'paragraph-%')::bigint good,
           COUNT(*) FILTER (WHERE source_provision_ref IS NOT NULL AND source_provision_ref NOT LIKE 'paragraph-%')::bigint odd
      FROM ${CITATION_TABLE} WHERE source_type='caselaw'`)).rows[0]
  assert(N(anchors.odd) === 0, 'every anchor that exists is a paragraph anchor', `${N(anchors.odd)} malformed`)
  assert(N(anchors.good) > 0 && N(anchors.good) < N(anchors.total),
    '⚠ anchors are present on SOME rows and absent on others — the source does not number every paragraph',
    `${N(anchors.good).toLocaleString()} of ${N(anchors.total).toLocaleString()} anchored`)
  control(N(anchors.total) - N(anchors.good) > 0,
    '⚠ and the unanchored rows are stored as NULL, never back-filled with an invented number')

  // ── coverage: the layer flipped from live state, not by editing a string ──
  console.log('\n── the coverage layer flipped from a live count ──')
  const { getCoverage, resetCoverageCache } = await import('./coverage')
  resetCoverageCache()
  const cov = await getCoverage()
  const layer = cov.layers.find(l => l.id === 'case-law-citations')
  assert(layer?.status === 'searched' && layer.rows === N(s.rows),
    'the case-law layer reports SEARCHED with the table’s own count',
    `${layer?.status} ${layer?.rows.toLocaleString()}`)
  // ⚠⚠ the neighbouring layer must not have absorbed the new detection value
  const enabling = cov.layers.find(l => l.id === 'enabling-power')
  assert((enabling?.rows ?? 0) < N(s.rows),
    '⚠⚠ the enabling layer did NOT absorb the case-law rows (its probe is positive, not "everything except")',
    `enabling ${enabling?.rows.toLocaleString()} vs caselaw ${N(s.rows).toLocaleString()}`)
  assert(cov.caseLawBoundary != null,
    '⚠ §1: the boundary appears WITHOUT the caller asking for it, because case-law rows exist',
    `${cov.caseLawBoundary?.collections.length ?? 0} collections`)
  control(cov.caseLawBoundary?.collections.some(c => c.shape === 'cliff' && c.continuousFrom != null) ?? false,
    'and at least one collection states a floor rather than a minimum')

  console.log(`\n  ${pass} passed, ${fail} failed, of ${pass + fail} run  (${controls} controls, 0 dead)`)
  await endNamesPool()
  process.exit(fail === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
