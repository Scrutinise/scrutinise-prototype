/**
 * probe-committee-drafting.ts — pull real committee content for three candidate inquiries, so
 * gold questions are drafted FROM the corpus rather than from memory.
 *
 * The chain of findings this closes:
 *   corpora      committees-* is 165,443 rows, 1.17% of tier='parliamentary'
 *   yield        CM1 scores 100% while returning 0/20 committee documents
 *   conclusions  all 10 candidate conclusion phrases absent from committee text
 *   composition  committees-reports is 71.6% correspondence, 10.4% "Report:"
 *   reports      2,575 'Report:' rows over 2,511 DISTINCT titles — ~1 row each, i.e. stubs
 *
 * Conclusion: the substantive committee text in this corpus is committees-EVIDENCE (what
 * witnesses submitted), not committee conclusions. So a question of the form "what did the
 * committee CONCLUDE" is unanswerable here however well it is worded, and the remaining
 * honest question shape is "what evidence was put to the committee" — which is what CM3
 * already does, and is the only one of CM1–CM4 whose premise the corpus supports.
 *
 * This prints real evidence rows for three well-populated inquiries so candidate questions can
 * be written against wording that demonstrably exists, with expected patterns checked for
 * absence from Hansard (the failure that makes CM1 undiscriminating).
 *
 * Read-only.  Usage: tsx search/probe-committee-drafting.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

const isCommittee = (id: string) => id.startsWith('committees')

/** Inquiries with enough evidence rows to be worth asking about (from the composition probe). */
const INQUIRIES = ['Women in the Armed Forces', 'Enforcing the Equality Act', 'Dangerous Dogs']

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  for (const inq of INQUIRIES) {
    console.log(`\n${'='.repeat(78)}\n[drafting] ${inq}\n${'='.repeat(78)}`)
    const rows = await tbl.query()
      .where(`tier = 'parliamentary' AND corpus = 'committees-evidence' AND sectionTitle LIKE '${inq.replace(/'/g, "''")}%'`)
      .select(['id', 'sectionTitle', 'body'])
      .limit(6)
      .toArray() as any[]
    for (const r of rows) {
      console.log(`\n  ${r.id}`)
      console.log(`  title: ${(r.sectionTitle ?? '').slice(0, 120)}`)
      console.log(`  body : ${(r.body ?? '').replace(/\s+/g, ' ').slice(0, 420)}`)
    }
    if (!rows.length) console.log('  (no rows matched that title prefix)')
  }

  // For each candidate distinctive marker, does it appear ONLY in committee text?
  console.log(`\n\n${'='.repeat(78)}\n[drafting] discrimination check on candidate markers\n${'='.repeat(78)}`)
  // Round 2. Round 1 tested topic vocabulary and nearly all of it was Hansard-dominated —
  // unsurprising in hindsight, since anything Parliament debates it also debates in the Chamber.
  // What is structurally committee-only is the machinery of WRITTEN EVIDENCE: submission
  // reference codes (WIF0002, EEA0269, DDL0002) and the first-person register of a submission.
  // Those cannot appear in Hansard because Hansard is not a submissions inbox.
  // Round 3 — the topic ANCHORS for the three candidate questions. A candidate needs both
  // halves of its answer key to survive: an anchor that identifies the inquiry and a marker
  // that is structurally committee-only. Round 2 settled the markers; this settles the anchors.
  //
  // Note on reading a 0 here: this measures LITERAL containment within a BM25 depth-200 result,
  // so 0 means "does not rank", not "does not exist" — 'knee-jerk' scored 0 in committees in
  // round 2 despite appearing verbatim in DDL0002's body, because 185 Hansard hits crowded it
  // out. And 'DDL0'/'WIF0' scored 0 everywhere because BM25 matches whole tokens: the token is
  // 'DDL0002'. Neither is evidence of absence.
  const MARKERS = ['breed specific legislation', 'written evidence submitted',
    'Women in the Armed Forces', 'Equality and Human Rights Commission',
    'Dangerous Dogs Act', 'written submission']
  for (const m of MARKERS) {
    const hits = await rankedSearch(tbl, m, { limit: 200, tier: 'parliamentary' })
    const lit = hits.filter((h) => `${h.sectionTitle ?? ''} ${h.body ?? ''}`.toLowerCase().includes(m.toLowerCase()))
    const cm = lit.filter((h) => isCommittee(h.id)).length
    const hz = lit.length - cm
    const tag = cm === 0 ? '❌ absent from committees' : hz === 0 ? '✅ committee-only' : cm >= hz ? '⚠ mostly committee' : '❌ Hansard-dominated'
    console.log(`  ${tag}  "${m}"  committees=${cm} hansard=${hz}`)
  }
}

main().catch((e) => { console.error('[drafting] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
