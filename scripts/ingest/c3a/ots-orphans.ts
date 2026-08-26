/**
 * ots-orphans.ts — ADDENDUM C3 §1.4. What actually leaves the corpus when the 421 go.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "Of the 421 leaving, 273 are duplicates of collections that hold them properly. ~148 are held
 *  nowhere else, and ~50 of those are substantive. Do not retain them under a false label; list
 *  them, and re-ingest them into `consultations` or `govuk-content` from the right source as a
 *  separate item."
 *
 * This is the list. It is produced from THIS session's classification file, not the 24 Aug one, and
 * the overlap is re-derived against the live database rather than quoted.
 *
 * ── WHAT "HELD NOWHERE ELSE" MEANS HERE, EXACTLY ───────────────────────────────────────────────
 * The same `sourceUrl` appearing in any collection other than `ots-reports`. That is the publisher's
 * own identity for the document, so it cannot merge two things that merely look alike — the
 * similarity trap B5 spent a session avoiding.
 *
 * ⚠ IT IS A URL TEST, AND A URL TEST WAS WRONG ONE TIME IN SEVEN ON THIS COLLECTION. So the count
 * is reported with its instrument named, and the near-miss class is printed: rows whose PATH is
 * held elsewhere under a different scheme or a trailing slash are listed separately rather than
 * being quietly counted as either.
 *
 * ── AND "SUBSTANTIVE" IS NOT AN OPINION ────────────────────────────────────────────────────────
 * gov.uk types its own documents. The split is by `document_type`, declared in the table below —
 * a government PUBLICATION (policy paper, corporate report, consultation outcome, research…) is
 * substantive; a MAINSTREAM service page (transaction, guide, answer, "Renew your driving licence")
 * is not. Every type is named in one list or the other, and an unrecognised type is reported as
 * UNCLASSIFIED rather than being swept into either — the word counts we hold are printed beside the
 * verdict so the split can be argued with.
 *
 * Usage: tsx c3a/ots-orphans.ts
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from '../c2/db'

const n = (x: number) => x.toLocaleString('en-GB')

/** gov.uk document types that are a government PUBLICATION — the substantive class. */
const SUBSTANTIVE = new Set([
  'policy_paper', 'corporate_report', 'consultation_outcome', 'open_consultation', 'closed_consultation',
  'call_for_evidence', 'closed_call_for_evidence', 'call_for_evidence_outcome', 'independent_report',
  'research', 'statistics', 'national_statistics', 'official_statistics', 'impact_assessment',
  'guidance', 'detailed_guide', 'statutory_guidance', 'regulation', 'notice', 'form',
  'international_treaty', 'decision', 'map', 'foi_release', 'transparency', 'transparency_data',
  'document_collection', 'correspondence', 'speech', 'written_statement',
])
/** gov.uk types that are a service page, a news item, or another collection's business. */
const NOT_SUBSTANTIVE = new Set([
  'transaction', 'guide', 'answer', 'smart_answer', 'local_transaction', 'licence', 'place',
  'calculator', 'simple_smart_answer', 'completed_transaction', 'help_page', 'homepage',
  'algorithmic_transparency_record', 'news_story', 'press_release', 'world_news_story',
  'utaac_decision', 'employment_tribunal_decision', 'employment_appeal_tribunal_decision',
  'asylum_support_decision', 'residential_property_tribunal_decision', 'service_standard_report',
  'cma_case', 'tax_tribunal_decision', 'drug_safety_update', 'medical_safety_alert', 'fatality_notice',
])

/** Where a substantive orphan belongs, if it is re-ingested. Keyed on the type, then the publisher. */
function proposedHome(documentType: string | null, orgs: string[]): string {
  const t = documentType ?? ''
  if (/consultation|call_for_evidence/.test(t)) return 'consultations'
  if (t === 'impact_assessment') return 'impact-assessments'
  if (orgs.includes('hm-revenue-customs')) return 'hmrc-codes-guidance'
  if (/^(utaac_decision|employment_)/.test(t)) return 'tax-tribunals / et-decisions (a tribunal collection, not a publication one)'
  return '⚠ NO COLLECTION EXISTS — there is no `govuk-content` corpus in the database; this needs a target before it can be re-ingested'
}

async function main() {
  // the newest classification, so this can never describe a stale verdict list
  const files = fs.readdirSync(OUT)
    .filter((f) => /^C3_ots_classification\..*\.jsonl$/.test(f) || f === 'C3_ots_classification.jsonl')
    .map((f) => ({ f, m: fs.statSync(path.join(OUT, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  const src = path.join(OUT, files[0].f)
  const vs = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  console.log(`classification: ${files[0].f}   (${vs.length} rows)`)

  const del = vs.filter((v: any) => v.verdict === 'DELETE')
  const urls = del.map((v: any) => v.url).filter(Boolean)
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  // ── exact-URL overlap
  const held = await q(
    `SELECT "sourceUrl" u, array_agg(DISTINCT corpus) cs FROM corpus_sections
      WHERE "sourceUrl" = ANY($1) AND corpus <> 'ots-reports' GROUP BY 1`, [urls])
  const heldSet = new Set(held.map((h: any) => h.u))

  // ── the near-miss class: same PATH, different exact string (scheme, host, trailing slash)
  const paths = urls.map((u: string) => { try { return new URL(u).pathname.replace(/\/$/, '') } catch { return null } }).filter(Boolean) as string[]
  const pathHeld = await q(
    `SELECT DISTINCT regexp_replace(regexp_replace("sourceUrl", '^https?://[^/]+', ''), '/$', '') pth
       FROM corpus_sections WHERE corpus <> 'ots-reports'
        AND regexp_replace(regexp_replace("sourceUrl", '^https?://[^/]+', ''), '/$', '') = ANY($1)`, [paths])
  const pathSet = new Set(pathHeld.map((r: any) => r.pth))

  const orphans = del.filter((v: any) => !heldSet.has(v.url))
  const nearMiss = orphans.filter((v: any) => { try { return pathSet.has(new URL(v.url).pathname.replace(/\/$/, '')) } catch { return false } })

  console.log(`\n── OF THE ${n(del.length)} ROWS LEAVING`)
  console.log(`   held elsewhere by exact sourceUrl : ${n(heldSet.size)}  (${(heldSet.size / del.length * 100).toFixed(1)}%)`)
  console.log(`   held NOWHERE else                 : ${n(orphans.length)}`)
  console.log(`     of which the same PATH is held elsewhere under a different string: ${n(nearMiss.length)}`)
  console.log(`     ⚠ the instrument is the publisher's own URL. It is not a title match, and it is`)
  console.log('       reported as a URL test because a URL test on this collection was wrong 1 in 7.')

  const where = new Map<string, number>()
  for (const h of held) for (const c of h.cs) where.set(c, (where.get(c) ?? 0) + 1)
  console.log('\n── where the duplicates already live')
  for (const [c, k] of [...where].sort((a, b) => b[1] - a[1])) console.log(`   ${String(k).padStart(4)}  ${c}`)

  // ── word counts we actually hold, as corroboration for the type split
  const wc = new Map<string, number>()
  if (orphans.length) {
    for (const r of await q(`SELECT id, "wordCount" w FROM corpus_sections WHERE id = ANY($1)`, [orphans.map((o: any) => o.id)])) {
      wc.set(r.id, r.w ?? 0)
    }
  }

  const sub: any[] = [], nonSub: any[] = [], unclassified: any[] = []
  for (const o of orphans) {
    const t = o.documentType ?? '(none)'
    const row = { ...o, wordCount: wc.get(o.id) ?? null, proposedHome: proposedHome(o.documentType, o.orgs ?? []) }
    if (SUBSTANTIVE.has(t)) sub.push(row)
    else if (NOT_SUBSTANTIVE.has(t)) nonSub.push(row)
    else unclassified.push(row)
  }

  const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0
  console.log(`\n── THE ${n(orphans.length)} HELD NOWHERE ELSE, SPLIT BY THE PUBLISHER'S OWN TYPE`)
  console.log(`   SUBSTANTIVE    ${String(sub.length).padStart(4)}   median ${n(med(sub.map((r) => r.wordCount ?? 0)))} words`)
  console.log(`   NOT            ${String(nonSub.length).padStart(4)}   median ${n(med(nonSub.map((r) => r.wordCount ?? 0)))} words   (service pages, news, other tribunals)`)
  console.log(`   UNCLASSIFIED   ${String(unclassified.length).padStart(4)}   median ${n(med(unclassified.map((r) => r.wordCount ?? 0)))} words   ⚠ named in neither list — decide, do not sweep`)
  if (unclassified.length) {
    const t = new Map<string, number>()
    for (const u of unclassified) t.set(u.documentType ?? '(none)', (t.get(u.documentType ?? '(none)') ?? 0) + 1)
    for (const [k, c] of [...t].sort((a, b) => b[1] - a[1])) console.log(`        ${String(c).padStart(3)}  ${k}`)
  }

  console.log(`\n── the ${n(sub.length)} substantive orphans, and where each would go`)
  const home = new Map<string, number>()
  for (const r of sub) home.set(r.proposedHome, (home.get(r.proposedHome) ?? 0) + 1)
  for (const [h, c] of [...home].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(4)}  ${h}`)
  console.log('')
  for (const r of sub.slice(0, 25)) console.log(`   [${r.documentType}] ${r.title}\n        ${r.url}   ${r.wordCount ?? '?'} words → ${r.proposedHome}`)
  if (sub.length > 25) console.log(`   … and ${n(sub.length - 25)} more, all of them in the artefact`)

  const outPath = path.join(OUT, 'C3A_ots_orphans.json')
  fs.writeFileSync(outPath, JSON.stringify({
    generated: new Date().toISOString(),
    classification: files[0].f,
    deleting: del.length,
    heldElsewhere: heldSet.size,
    heldNowhereElse: orphans.length,
    samePathDifferentString: nearMiss.map((r: any) => r.url),
    substantive: sub, notSubstantive: nonSub, unclassified,
    duplicatesLiveIn: Object.fromEntries(where),
  }, null, 2))
  console.log(`\nwritten: docs/census/C3A_ots_orphans.json`)
  console.log('⚠ NOTHING IS DELETED OR RE-INGESTED BY THIS SCRIPT. It is the list §1.4 asks for.')
  await p.end()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
