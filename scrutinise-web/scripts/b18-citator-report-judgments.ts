export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 §5 (plan C3) — EVERY JUDGMENT THE REPORT CITES, RUN THROUGH THE CITATOR.
//
// Per judgment: followed, applied, distinguished, doubted, not-followed, overruled,
// disapproved, read-down, per-incuriam — or no treatment recorded.
//
// ⚠⚠ EVERY NUMBER THIS PRINTS CARRIES THE SAME LINE, AND IT IS NOT DECORATION.
// `docs/GRAPH_5_REPORT.md` §5: *"§3 ships with 1,749 edges and no accuracy number at all,
// which is worse than a bad one, because a citator with an unmeasured error rate will be
// quoted."* Fifteen rows were prepared for scoring on 8 September; **one has been scored.**
// Until the other fourteen are, the error rate is unknown and every line below says so.
//
// ⚠⚠ "NO TREATMENT RECORDED" IS NOT "THIS CASE HAS NEVER BEEN DOUBTED." 16,455 of 18,211
// candidate passages (90.4%) produce no edge, because most citations are not treatments.
// Absence here is the ordinary case and is evidence of nothing.
//
// ⚠ MATCHED ON CITATION, NEVER ON NAME. 22,184 observed case names appear against more than
// one citation (mean 2.1, max 119); 13.6% of names are unusable for identity. Matching
// *Miller* by name would merge different cases.
//
// ⚠ INBOUND ONLY. This says what has cited the judgment. It cannot say what the judgment
// itself cited.
//
// ⚠ NOTHING HERE SAYS A CASE IS NO LONGER GOOD LAW. There is no column that could hold that
// conclusion and this script does not compute one.
//
// Read-only.
//   npx tsx --env-file=.env scripts/b18-citator-report-judgments.ts
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { Pool } from 'pg'

const OUT_DIR = join(__dirname, '../../docs/report_run/appendices')
const TREATMENT_TABLE = 'caselaw_treatment_edge'

/**
 * ⚠⚠ THE CITATION COMES OFF `sourceId`, NOT OFF `citation`.
 *
 * `EvidenceItem.citation` on a case-law row holds the case NAME — *"Forward v Aldwyck
 * Housing Group Ltd"* — and **0 of 2,244 citation values in the database contain a neutral
 * citation at all.** The citator is keyed on the citation and GRAPH 5 measured why: 22,184
 * case names appear against more than one citation, mean 2.1 and max 119, so a lookup by
 * name would merge different cases and report one case's treatment under another's.
 *
 * The bridge is the corpus id, which BEGINS with the neutral citation:
 * `tna-caselaw:[2017] EWHC 1152 (QB):1`.
 */
const SOURCE_ID_CITATION_RE = /^tna-caselaw:(\[(?:1[89]|20)\d{2}\][^:]*?):\d+$/

const L: string[] = []
const w = (s = '') => L.push(s)

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  // ── 1. the judgments the report cites, off the evidence rows the builds wrote ──────────
  const rows = await prisma.evidenceItem.findMany({
    where: { sourceType: 'CASE_LAW' },
    select: { ideaId: true, citation: true, title: true, url: true, sourceId: true },
  })
  const ideas = await prisma.idea.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.ideaId))] } },
    select: { id: true, title: true },
  })
  const ideaTitle = new Map(ideas.map((i) => [i.id, i.title]))

  /** citation → the measures that cite it, and the name we saw it under. */
  const cited = new Map<string, { measures: Set<string>; name: string; url: string | null }>()
  /** ⚠⚠ THE THIRD STATE. Judgments the citator does not cover at all — Northern Ireland, the
   *  Scottish courts and the employment tribunals are separate corpora with their own id
   *  shapes, and the treatment extraction ran over `tna-caselaw` only. Reporting these as
   *  "no treatment recorded" would say we looked and found nothing, when we did not look. */
  const notCovered = new Map<string, { measures: Set<string>; corpus: string }>()

  for (const r of rows) {
    const m = (r.sourceId ?? '').match(SOURCE_ID_CITATION_RE)
    const measure = ideaTitle.get(r.ideaId) ?? r.ideaId
    if (m) {
      const c = m[1].replace(/\s+/g, ' ').trim()
      const e = cited.get(c) ?? { measures: new Set<string>(), name: r.citation ?? r.title, url: r.url }
      e.measures.add(measure)
      cited.set(c, e)
    } else {
      const key = r.citation ?? r.title
      const corpus = (r.sourceId ?? '').split(':')[0] || 'unknown'
      const e = notCovered.get(key) ?? { measures: new Set<string>(), corpus }
      e.measures.add(measure)
      notCovered.set(key, e)
    }
  }
  console.log(`  ${rows.length} case-law evidence rows → ${cited.size} addressable citations, `
    + `${notCovered.size} from corpora the citator does not cover`)

  // ── 2. ask the citator about each one ─────────────────────────────────────────────────
  const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })
  const totals = await pool.query(`SELECT count(*)::int AS n FROM ${TREATMENT_TABLE}`)
  const byTreatment = new Map<string, number>()

  interface Hit {
    treatment: string; court: string | null; judgment_date: Date | null
    judgment_uri: string; sentence: string; paragraph_num: string | null
  }
  const results: Array<{ citation: string; measures: string[]; hits: Hit[] }> = []

  for (const [citation, meta] of cited) {
    const q = await pool.query<Hit>(
      `SELECT treatment, court, judgment_date, judgment_uri, sentence, paragraph_num
         FROM ${TREATMENT_TABLE}
        WHERE subject_type = 'case' AND subject_citation = $1
        ORDER BY judgment_date DESC NULLS LAST
        LIMIT 25`,
      [citation],
    )
    for (const h of q.rows) byTreatment.set(h.treatment, (byTreatment.get(h.treatment) ?? 0) + 1)
    results.push({ citation, measures: [...meta.measures].sort(), hits: q.rows })
  }

  const withTreatment = results.filter((r) => r.hits.length)

  // ── 3. render ─────────────────────────────────────────────────────────────────────────
  w('# Appendix — every judgment the report cites, run through the citator')
  w('')
  w(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  w('')
  w('> ⚠ **The treatment edges are unvalidated; the error rate has not been measured.** A '
    + 'validation set of fifteen rows was prepared on 8 September 2026 and one of the fifteen has '
    + 'been scored. Until the remaining fourteen are scored, nothing in this appendix has a known '
    + 'accuracy, and no statement here should be relied on without reading the quoted passage.')
  w('')
  w('**How to read it.**')
  w('')
  w('- **"No treatment recorded" does not mean the case has never been doubted or distinguished.** '
    + 'Across the corpus, 16,455 of 18,211 candidate passages (90.4%) produce no treatment record, '
    + 'because most citations of a case are not treatments of it. Absence here is the ordinary case.')
  w('- **The index looks inward only.** It reports what has cited each judgment. It cannot report '
    + 'what that judgment itself cited.')
  w('- **Cases are matched by citation, never by name.** 22,184 case names in the corpus appear '
    + 'against more than one citation, so matching *Miller* or *Wednesbury* by name would merge '
    + 'different cases.')
  w('- **Nothing here says a case is no longer good law.** No field in this index can hold that '
    + 'conclusion, and none is computed.')
  w('')
  w('## Summary')
  w('')
  w('| | |')
  w('|---|---|')
  w(`| Case-law sources cited across the twelve measures | **${rows.length}** |`)
  w(`| …addressable by the citator (a neutral citation) | **${cited.size}** |`)
  w(`| …**NOT CHECKED** — from corpora the citator does not cover | **${notCovered.size}** |`)
  w(`| Of the addressable, with at least one treatment recorded | **${withTreatment.length}** |`)
  w(`| Of the addressable, with no treatment recorded | **${cited.size - withTreatment.length}** |`)
  w(`| Treatment records in the whole index | ${totals.rows[0].n.toLocaleString()} |`)
  w(`| Of those, validated | **1** |`)
  w('')
  w('⚠ **The third row is not a subset of the last two, and must not be added to them.** The '
    + 'citator was built over the National Archives\' judgments of England and Wales. Judgments of '
    + 'the Northern Ireland courts, the Scottish courts and the employment tribunals are held in '
    + 'separate corpora with their own identifiers and were never passed through the treatment '
    + 'extraction. For those the answer is *not looked at*, which is a different fact from *looked '
    + 'at and nothing found*.')
  w('')
  if (byTreatment.size) {
    w('Treatments found, by kind:')
    w('')
    w('| Treatment | Records |')
    w('|---|---|')
    for (const [t, n] of [...byTreatment].sort((a, b) => b[1] - a[1])) w(`| ${t} | ${n} |`)
    w('')
  }

  w('## Judgments with a treatment recorded')
  w('')
  if (!withTreatment.length) {
    w('*None of the citations in the report appears as the subject of a treatment record.* '
      + 'Given that 90.4% of citations produce no record at all, and that the index covers '
      + 'judgments from 2003 onward only, this is a plausible result rather than a surprising one.')
    w('')
  }
  for (const r of withTreatment) {
    w(`### \`${r.citation}\``)
    w('')
    w(`Cited in: ${r.measures.join(' · ')}`)
    w('')
    for (const h of r.hits) {
      w(`- **${h.treatment.toUpperCase()}** — ${h.court ?? 'court not stated in the document'}`
        + `${h.judgment_date ? `, ${new Date(h.judgment_date).toISOString().slice(0, 10)}` : ''}`
        + `${h.paragraph_num ? `, at paragraph ${h.paragraph_num}` : ''}`)
      w(`  <br>\`${h.judgment_uri}\``)
      if (h.sentence) w(`  <br>> ${h.sentence.replace(/\s+/g, ' ').slice(0, 600)}`)
    }
    w('')
  }

  w('## Judgments with no treatment recorded')
  w('')
  w('*Listed so the absence is visible. See the note above: this is the ordinary result and is '
    + 'evidence of nothing about the standing of these cases.*')
  w('')
  for (const r of results.filter((x) => !x.hits.length)) {
    w(`- \`${r.citation}\` — ${r.measures.join(' · ')}`)
  }
  w('')

  w('## ⚠ NOT CHECKED — judgments from corpora the citator does not cover')
  w('')
  w('These are cited by the report and have **not been put through the citator at all.** Nothing '
    + 'below should be read as "no adverse treatment found".')
  w('')
  const byCorpus = new Map<string, string[]>()
  for (const [name, meta] of notCovered) {
    const list = byCorpus.get(meta.corpus) ?? []
    list.push(`${name} — ${[...meta.measures].sort().join(' · ')}`)
    byCorpus.set(meta.corpus, list)
  }
  for (const [corpus, list] of [...byCorpus].sort((a, b) => b[1].length - a[1].length)) {
    w(`### \`${corpus}\` — ${list.length} judgment(s)`)
    w('')
    for (const l of list.sort()) w(`- ${l}`)
    w('')
  }

  const out = join(OUT_DIR, 'CITATOR_report_judgments.md')
  writeFileSync(out, L.join('\n'), 'utf8')
  console.log(`  ${withTreatment.length} of ${cited.size} citations have a treatment recorded`)
  console.log(`\nwritten: ${out}`)

  await pool.end()
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
