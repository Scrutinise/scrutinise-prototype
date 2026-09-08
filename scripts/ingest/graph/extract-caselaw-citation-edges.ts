/**
 * extract-caselaw-citation-edges.ts — BRIEF_GRAPH_5 §2. CASE LAW TO LEGISLATION.
 *
 * ── WHAT §2.1's AUDIT DECIDED, AND WHY THIS FILE LOOKS NOTHING LIKE ITS SIBLING ──
 *
 * `extract-citation-edges.ts` needs a TEXT detector because legislation's own `<Citation URI>`
 * markup covers only 2–5% of the act-name mentions in the corpus. **Case law is the opposite.**
 * The §2.1 audit measured TNA's Akoma Ntoso at ~90% of act-name spans already carrying a
 * `<ref uk:type="legislation" href="…">`, and — the finding that mattered most —
 *
 *   ⚠⚠ **THE PUBLISHER RESOLVES THE BACK-REFERENCE FOR US.** 59% of legislation refs are words
 *   that name only a provision ("Section 11(2)", "s. 31(7)"), and in 100% of those the href
 *   nonetheless carries the Act. The form §2.1 warned about — "the bare provision once the Act
 *   has been named earlier" — needs no resolver of ours at all. Neither does "the 1994 Act".
 *
 * So this extractor is markup-only, and that is a measured decision rather than a shortcut.
 * ⚠ What it costs is stated in the coverage block, not buried: the ~10% of act names carrying no
 * ref are NOT extracted, and a text detector for case law is named as not done.
 *
 * ── ⚠⚠ THE PROVENANCE CAVEAT THAT MUST TRAVEL WITH EVERY ROW ─────────────────
 *
 * Every legislation ref in this corpus carries `uk:origin="TNA"` — 100% of them. **The court did
 * not mark these up; The National Archives' enrichment did.** That is still strong evidence, and
 * it is stronger than our own name-matching, but it is NOT the source asserting its own meaning
 * the way a CLML `<Citation URI>` is. Hence `detection = 'caselaw-markup'` and not `'markup'`:
 * a reader must be able to tell the two apart in a count, and 4A's rule is that a measured fact
 * and an inferred one must never look identical on the page.
 *
 * ⚠ The WORDS are the court's own and are quoted verbatim. The IDENTITY is TNA's assertion.
 * `citation_text` holds the first; `target_uri` holds the second, unmodified, so a bad
 * normalisation is recoverable without re-reading 74,896 documents.
 *
 * ── §2.3, THE RULES THAT CARRY OVER ──────────────────────────────────────────
 *
 *  · Every edge quotes the words that make it — `citation_text` and `raw_fragment` are NOT NULL.
 *  · ⚠⚠ THE IDENTITY RESOLVER IS SHARED, NOT REIMPLEMENTED. `parseLegUri` and `identitiesFor` are
 *    imported. The regnal-year trap has appeared in FOUR separate code paths, every time because a
 *    fix went into one of two places that had to agree. This file adds no fifth.
 *  · Never merge two identities on similarity. An unresolved target is counted, not guessed.
 *
 *   npx tsx graph/extract-caselaw-citation-edges.ts --pilot 500     # no writes, prints a sample
 *   npx tsx graph/extract-caselaw-citation-edges.ts                 # full, resumable
 *   npx tsx graph/extract-caselaw-citation-edges.ts --reset
 */
import fs from 'fs'
import path from 'path'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { parseLegUri } from './graph-common'
import { identitiesFor, loadIdentityBridge } from './identity'
import { CITATION_TABLE } from './setup-citation-edge-table'

const CORPUS = 'tna-caselaw'
const DETECTION = 'caselaw-markup'
const SOURCE_TYPE = 'caselaw'
const CITATION_TEXT_MAX = 300
const RAW_FRAGMENT_MAX = 600
const CHECKPOINT = path.join(__dirname, 'caselaw-citation-checkpoint.json')
const CONCURRENCY = parseInt(process.env.G5_CONCURRENCY ?? '32', 10)
/** ⚠ The legislation corpora, so `resolved` means "we hold the text", not "the URI parsed". */
const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']

const PILOT = (() => { const i = process.argv.indexOf('--pilot'); return i >= 0 ? parseInt(process.argv[i + 1] ?? '500', 10) : 0 })()

/**
 * ⚠⚠ A SLICE OF XML CAN BEGIN IN THE MIDDLE OF A TAG, AND `/<[^>]*>/` CANNOT SEE IT.
 *
 * The evidence quote is built from the 400 characters BEFORE the ref, and that window lands
 * wherever it lands — very often inside an attribute list. The tag-stripping regex needs an
 * opening `<`, so a slice starting mid-tag leaves the tail of the tag in the text and the stored
 * quote reads:
 *
 *   uk:origin="TNA" uk:type="legislation">section 138D of the Act (and each of those rules…
 *
 * **193,226 rows — 15.0%, one in seven — were stored like that by the first full run.** Nothing
 * failed: the words were all present, the row passed every NOT NULL and every CHECK, and the
 * count reconciled exactly. It was caught only by the round-trip assertion that looks for the
 * quote IN the judgment, which is why that assertion exists.
 *
 * ⚠ `citation_text` is the column that makes an edge a fact rather than a claim. A quote a
 * reader has to look past is a quote they will stop trusting.
 */
function dropLeadingTagRemnant(s: string): string {
  const gt = s.indexOf('>'), lt = s.indexOf('<')
  return gt >= 0 && (lt < 0 || gt < lt) ? s.slice(gt + 1) : s
}

const plain = (s: string) => dropLeadingTagRemnant(s)
  .replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ')
  .replace(/\s+/g, ' ').trim()

export type CaseCitationRow = {
  sourceDocUri: string; sourceProvisionRef: string | null
  targetUri: string; targetActId: string | null; targetProvisionRef: string | null
  citationText: string; rawFragment: string; resolved: boolean
  sourceType: string; sourceGid: string; detection: string
}

export const stats = {
  docs: 0, refs: 0, badUri: 0, rows: 0,
  withParagraph: 0, paragraphUnnumbered: 0,
  withTargetProvision: 0, resolvedRows: 0, bridgedByAlias: 0,
}

/**
 * ⚠ Paragraph anchors, built ONCE per document as offset marks — the same shape as the sibling
 * extractor's `provisionMarks`. A per-ref backwards search over the whole XML is quadratic, and
 * the §1 audit of the case-law text already lost twelve minutes to exactly that mistake.
 *
 * ⚠⚠ 49% of the paragraphs holding a ref carry NO <num>. That is recorded as null and COUNTED
 * (`paragraphUnnumbered`), never back-filled with a running index — a paragraph number a reader
 * could check against the judgment is a different fact from one we invented.
 */
function paragraphMarks(xml: string): Array<{ at: number; end: number; num: string | null }> {
  const marks: Array<{ at: number; end: number; num: string | null }> = []
  for (const m of xml.matchAll(/<paragraph\b[^>]*>([\s\S]*?)<\/paragraph>/g)) {
    const num = m[1].match(/<num>([\s\S]*?)<\/num>/)?.[1]
    marks.push({ at: m.index!, end: m.index! + m[0].length, num: num ? plain(num).replace(/\.$/, '') || null : null })
  }
  return marks
}

export function extractJudgment(sectionId: string, xml: string, held: Set<string>): CaseCitationRow[] {
  stats.docs++
  const rows: CaseCitationRow[] = []
  // the court's own uri for itself; falls back to the corpus id so the column is never empty
  const sourceDocUri = xml.match(/<FRBRWork>[\s\S]*?<FRBRthis value="([^"]*)"/)?.[1] ?? sectionId
  // ⚠ the body only: <meta> carries the enrichment's own references and the stylesheet's leftovers
  const bodyAt = xml.indexOf('<judgmentBody')
  const body = bodyAt >= 0 ? xml.slice(bodyAt) : xml
  const offset = bodyAt >= 0 ? bodyAt : 0
  const marks = paragraphMarks(body)

  for (const m of body.matchAll(/<ref\b([^>]*uk:type="legislation"[^>]*)>([\s\S]*?)<\/ref>/g)) {
    stats.refs++
    const at = m.index!
    const uri = m[1].match(/href="([^"]*)"/)?.[1] ?? ''
    const target = parseLegUri(uri)
    if (!target) { stats.badUri++; continue }

    // where in the judgment — the judge's own numbering where the document carries it
    const mk = marks.find(k => at >= k.at && at < k.end)
    if (mk) { stats.withParagraph++; if (!mk.num) stats.paragraphUnnumbered++ }
    const sourceProvisionRef = mk?.num ? `paragraph-${mk.num}` : null

    // ⚠ identity through the SHARED bridge. The raw uri is kept untouched beside it.
    let targetActId: string | null = target.gid
    let resolved = false
    if (held.has(target.gid)) resolved = true
    else {
      const alias = identitiesFor(target.gid).find(id => held.has(id))
      if (alias) { targetActId = alias; resolved = true; stats.bridgedByAlias++ }
    }
    if (resolved) stats.resolvedRows++
    if (target.sectionRef) stats.withTargetProvision++

    const inner = plain(m[2])
    const before = plain(body.slice(Math.max(0, at - 400), at))
    const citationText = ((before + ' ' + inner).slice(-CITATION_TEXT_MAX)).replace(/^\S*\s/, '').trim() || inner || uri
    const fragStart = Math.max(0, at - Math.floor(RAW_FRAGMENT_MAX / 2))
    const rawFragment = body.slice(fragStart, Math.min(body.length, fragStart + RAW_FRAGMENT_MAX))

    // ⚠ NOT NULL is a shape contract, never a content one (docs/CLAUDE.md §24). An edge whose
    // evidence came out blank is DROPPED and counted, not stored with an empty quote — a
    // citation nobody can check is exactly what this table exists not to hold.
    if (!citationText.trim() || !rawFragment.trim()) continue

    rows.push({
      sourceDocUri, sourceProvisionRef,
      targetUri: uri, targetActId,
      targetProvisionRef: target.sectionRef,
      citationText, rawFragment, resolved,
      sourceType: SOURCE_TYPE, sourceGid: sectionId, detection: DETECTION,
    })
    void offset
  }
  stats.rows += rows.length
  return rows
}

async function insertRows(rows: CaseCitationRow[], provenance: string): Promise<number> {
  if (rows.length === 0) return 0
  const pool = namesPool()
  let written = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.sourceDocUri, r.sourceProvisionRef, r.targetUri, r.targetActId, r.targetProvisionRef,
        r.citationText, r.rawFragment, r.resolved, r.sourceType, r.sourceGid, r.detection, provenance)
      const b = j * 12
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12})`
    })
    const res = await pool.query(
      `INSERT INTO ${CITATION_TABLE}
       (source_doc_uri, source_provision_ref, target_uri, target_act_id, target_provision_ref,
        citation_text, raw_fragment, resolved, source_type, source_gid, detection, extracted_from)
       VALUES ${tuples.join(',')}`, values)
    written += res.rowCount ?? 0
  }
  return written
}

async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i]) }
  }))
}

async function main() {
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done: Set<string> = PILOT || !fs.existsSync(CHECKPOINT)
    ? new Set() : new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done)

  const pool = namesPool()
  console.log('[g5-cite] loading held gids…')
  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  const bridge = loadIdentityBridge()
  if (bridge.stats.degraded) {
    console.warn(`[g5-cite] ⚠⚠ identity bridge DEGRADED (no ${bridge.stats.sourcePath}) — regnal targets will read as unheld, and the unresolved count would be a statement about this file rather than about the corpus.`)
  }
  console.log(`[g5-cite] ${held.size.toLocaleString()} held instruments · ${bridge.stats.bridgedForms.toLocaleString()} bridged id forms`)

  const all = (await pool.query(
    `SELECT id, "r2RawKey", "itemDate" FROM corpus_sections
      WHERE corpus=$1 AND "r2RawKey" IS NOT NULL ORDER BY id`, [CORPUS])).rows
  const provenance = `${CORPUS}:akn-ref@${new Date().toISOString().slice(0, 10)}`
  let scope = all.filter((r: { id: string }) => !done.has(r.id))
  if (PILOT) { const step = Math.max(1, Math.floor(all.length / PILOT)); scope = all.filter((_: unknown, i: number) => i % step === 0).slice(0, PILOT) }
  console.log(`[g5-cite] ${scope.length.toLocaleString()} of ${all.length.toLocaleString()} judgments in scope${PILOT ? ` (PILOT — NO WRITES)` : ''}`)

  // ⚠⚠ `written` MUST NOT be updated as `written += await …`. Read-modify-write across an await,
  // with 32 concurrent workers, loses updates: the first full run built 1,288,630 rows, stored all
  // of them, and REPORTED 974,802 — a 24% shortfall that existed only in the counter. A run that
  // reports fewer rows than it wrote looks exactly like a run that dropped them, and the only way
  // to tell was to count the table. The accumulator is now a closure over a synchronous add.
  let written = 0, misses = 0, batch: CaseCitationRow[] = []
  const addWritten = (n: number) => { written += n }
  const sample: CaseCitationRow[] = []
  await mapPool(scope, CONCURRENCY, async (r: { id: string; r2RawKey: string }) => {
    const xml = await r2Get(r.r2RawKey)
    if (!xml) { misses++; return }
    const rows = extractJudgment(r.id, xml, held)
    if (PILOT) { if (sample.length < 12 && rows.length) sample.push(rows[0]); done.add(r.id); return }
    batch.push(...rows)
    done.add(r.id)
    if (batch.length >= 2000) {
      const b = batch; batch = []
      addWritten(await insertRows(b, provenance))
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))
      if (stats.docs % 5000 < CONCURRENCY) console.log(`  … ${stats.docs.toLocaleString()} judgments, ${written.toLocaleString()} rows`)
    }
  })
  if (!PILOT && batch.length) addWritten(await insertRows(batch, provenance))
  if (!PILOT) fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))

  const pc = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '—'
  console.log(`\n══ EXTRACTION ══`)
  console.log(`  judgments read              ${stats.docs.toLocaleString()}   (R2 misses ${misses})`)
  console.log(`  legislation <ref> elements  ${stats.refs.toLocaleString()}`)
  console.log(`  href did not parse to a gid ${stats.badUri.toLocaleString()}  ${pc(stats.badUri, stats.refs)}`)
  console.log(`  rows built                  ${stats.rows.toLocaleString()}`)
  console.log(`    naming a target provision ${stats.withTargetProvision.toLocaleString()}  ${pc(stats.withTargetProvision, stats.rows)}`)
  console.log(`    target held in the corpus ${stats.resolvedRows.toLocaleString()}  ${pc(stats.resolvedRows, stats.rows)}`)
  console.log(`      of which via the identity bridge (regnal/alias)  ${stats.bridgedByAlias.toLocaleString()}`)
  console.log(`    anchored to a paragraph   ${stats.withParagraph.toLocaleString()}  ${pc(stats.withParagraph, stats.rows)}`)
  console.log(`      ⚠ paragraph carries no number, so no anchor stored  ${stats.paragraphUnnumbered.toLocaleString()}`)
  if (PILOT) {
    console.log(`\n  PILOT — nothing written. Sample rows:`)
    sample.forEach((s, i) => {
      console.log(`\n   ${i + 1}. ${s.sourceGid}  ${s.sourceProvisionRef ?? '(no paragraph number)'}`)
      console.log(`      target : ${s.targetUri}   → ${s.targetActId} ${s.resolved ? '(held)' : '⚠ NOT HELD'}`)
      console.log(`      words  : …${s.citationText.slice(-150)}`)
    })
  } else {
    console.log(`\n  rows written to ${CITATION_TABLE}: ${written.toLocaleString()}  (provenance ${provenance})`)
  }
  await endNamesPool()
}

if (require.main === module) main().catch(async e => { console.error('[g5-cite] FATAL', e); await endNamesPool(); process.exit(1) })
