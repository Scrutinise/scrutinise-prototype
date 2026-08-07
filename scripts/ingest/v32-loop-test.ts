/**
 * v32-loop-test.ts — §4 / ADDENDUM §E: prove the scrutiny loop end-to-end for one inquiry.
 *
 * The base brief's acceptance was "the ten phrases are present". That is necessary and not
 * sufficient: a phrase can be present in a corpus nobody can join up. The product capability the
 * H1 persona actually asks for is *"what did the committee recommend, and did the government act
 * on it?"* — which needs all four parts of the loop retrievable AND tied to one inquiry:
 *
 *     inquiry → evidence → report conclusions → government response
 *
 * Carillion is the natural case: its "recklessness, hubris and greed" verdict is the canonical
 * phrase the audit found missing, and it has evidence, a report and a Cabinet Office response.
 *
 * This asserts each leg separately and reports which are present, so a partial result says WHICH
 * half of the loop is missing rather than just failing. Read-only.
 *
 * Usage: tsx v32-loop-test.ts [--inquiry="Carillion"]
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const SUBJECT = (() => { const a = process.argv.find(x => x.startsWith('--inquiry=')); return a ? a.split('=')[1] : 'Carillion' })()
/** The report's own verdict — the phrase GOLD_TEST_09 proved absent and this sprint exists to land. */
const VERDICT = 'recklessness, hubris and greed'

let pass = 0, fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()

async function main() {
  console.log(`\n═══ §E LOOP TEST — "${SUBJECT}" ════════════════════════════════════════════\n`)
  const p = getNeonPool()

  // ── leg 1: evidence submitted to the inquiry
  const { rows: evidence } = await p.query<{ id: string; sectionTitle: string; wordCount: number }>(
    `SELECT id, "sectionTitle", "wordCount" FROM corpus_sections
     WHERE corpus='committees-evidence' AND status='compiled' AND "sectionTitle" ILIKE $1
     ORDER BY "wordCount" DESC`, [`%${SUBJECT}%`])
  check('EVIDENCE is retrievable', evidence.length > 0, `${evidence.length} rows`)
  for (const e of evidence.slice(0, 2)) console.log(`      ${e.id}  ${e.wordCount}w  ${e.sectionTitle.slice(0, 70)}`)

  // ── leg 2: the committee's own report, and its conclusions
  const { rows: report } = await p.query<{ id: string; sectionTitle: string; wordCount: number; r2Key: string; parentDocId: string; notes: string | null }>(
    `SELECT id, "sectionTitle", "wordCount", "r2Key", "parentDocId", notes FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled' AND "sectionTitle" ILIKE $1
       AND ("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%')
     ORDER BY "wordCount" DESC`, [`%${SUBJECT}%`])
  check('REPORT sections are retrievable', report.length > 0, `${report.length} sections`)
  for (const r of report.slice(0, 2)) console.log(`      ${r.id}  ${r.wordCount}w  ${r.sectionTitle.slice(0, 70)}`)

  // the verdict itself — the phrase, in the report body
  let verdictIn: string | null = null
  for (const r of report) {
    const body = await r2Get(r.r2Key)
    if (body && norm(body).includes(norm(VERDICT))) { verdictIn = r.id; break }
  }
  check(`the report's VERDICT is present ("${VERDICT}")`, verdictIn !== null, verdictIn ?? 'not found in any report section')

  // ── leg 3: the government's response
  const { rows: response } = await p.query<{ id: string; sectionTitle: string; wordCount: number; notes: string | null }>(
    `SELECT id, "sectionTitle", "wordCount", notes FROM corpus_sections
     WHERE corpus='committees-reports' AND status='compiled' AND "sectionTitle" ILIKE $1
       AND ("sectionTitle" ILIKE 'Government Response:%' OR "sectionTitle" ILIKE '%Special Report%')
     ORDER BY "wordCount" DESC`, [`%${SUBJECT}%`])
  check('GOVERNMENT RESPONSE is retrievable', response.length > 0, `${response.length} sections`)
  for (const r of response.slice(0, 2)) console.log(`      ${r.id}  ${r.wordCount}w  ${r.sectionTitle.slice(0, 70)}`)

  // ── leg 4: are they joined? The §B test is PER INQUIRY, not per subject.
  //
  // The first version asserted that every "Carillion" row shared ONE inquiry id, and failed. The
  // assertion was wrong, not the data: "Carillion" spans two genuinely separate inquiries — 5425,
  // the joint BEIS/Work & Pensions inquiry into the collapse, and 5916, PACAC's "After Carillion"
  // inquiry into public-sector outsourcing. Demanding one id across a SUBJECT could only ever pass
  // by accident. What the scrutiny loop requires is that WITHIN an inquiry, the report and the
  // government's response hang off the same id.
  const byInquiry = new Map<string, { report: number; response: number; title: string }>()
  const bucket = (rows: Array<{ notes: string | null }>, key: 'report' | 'response') => {
    for (const r of rows) {
      if (!r.notes) continue
      try {
        const n = JSON.parse(r.notes) as { inquiryId: number | null; inquiryTitle: string | null }
        if (n.inquiryId == null) continue
        const k = String(n.inquiryId)
        const cur = byInquiry.get(k) ?? { report: 0, response: 0, title: n.inquiryTitle ?? '' }
        cur[key]++
        byInquiry.set(k, cur)
      } catch { /* notes is not the metadata JSON */ }
    }
  }
  bucket(report, 'report')
  bucket(response, 'response')

  console.log('')
  for (const [id, c] of byInquiry) {
    console.log(`  inquiry ${id}: ${c.report} report section(s), ${c.response} response section(s) — ${c.title.slice(0, 55)}`)
  }
  const joined = [...byInquiry.entries()].filter(([, c]) => c.report > 0 && c.response > 0)
  check('an inquiry has BOTH its report and the government response under one id (§B join)',
    joined.length > 0,
    joined.length ? `${joined.length} complete loop(s): inquiry ${joined.map(([id]) => id).join(', ')}`
      : 'no inquiry has both halves — run the §3 metadata pass')

  // Stated rather than quietly skipped: the §3 pass covers `committees-reports` only, so the
  // evidence rows in leg 1 do not yet carry an inquiry id. Evidence→inquiry needs the API's
  // `committeeBusiness` on the evidence items, which is a separate pass.
  console.log('\n  ⚠ evidence rows do not yet carry the inquiry id — the §3 pass covered')
  console.log('    committees-reports only. Evidence↔inquiry is a follow-on pass.')

  console.log(`\n${fail === 0 ? '✅ THE LOOP IS COMPLETE' : `❌ ${fail} leg(s) of the loop missing`} — ${pass}/${pass + fail} checks`)
  await endNeonPool()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[loop] FATAL', e); process.exit(1) })
