/**
 * probe-committee-content.ts — what is actually IN committees-reports / committees-evidence?
 *
 * probe-committee-conclusions.ts tested ten candidate conclusion phrases and found all ten
 * absent from the committee corpora — including "recklessness, hubris and greed", which a 2020
 * Hansard debate quotes verbatim FROM the Carillion report. A phrase that exists in a debate
 * quoting the report but not in the report itself is evidence about the corpus, not about the
 * phrase, and the honest next step is to look at what the committee corpora contain rather than
 * to keep guessing wordings.
 *
 * Two hypotheses this separates:
 *   (a) the specific inquiries are not ingested (Carillion 2018, Covid lessons-learned 2021,
 *       PAC Test & Trace 2021), so no question about them can be answered from this stream;
 *   (b) they ARE ingested and my recalled phrasings are simply wrong — likely, since they were
 *       recalled from memory rather than read from the source.
 *
 * Distinguishing them decides whether the committees stream needs better QUESTIONS or more
 * INGEST, and those are different pieces of work. Print titles rather than judging wording.
 *
 * Read-only.  Usage: tsx search/probe-committee-content.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

const DEPTH = 300
const isCommittee = (id: string) => id.startsWith('committees')

const SUBJECTS = ['Carillion', 'coronavirus lessons learned', 'NHS Test and Trace', 'Post Office Horizon', 'two-child limit']

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  // What does the committee corpus look like at all? Sample titles, no query bias.
  const sample = await tbl.query()
    .where(`tier = 'parliamentary' AND (corpus = 'committees-reports' OR corpus = 'committees-evidence')`)
    .select(['id', 'sectionTitle'])
    .limit(15)
    .toArray() as any[]
  console.log(`[content] 15 arbitrary rows from the committee corpora:\n`)
  for (const r of sample) console.log(`   ${r.id}\n      title: ${JSON.stringify(r.sectionTitle)}`)

  for (const s of SUBJECTS) {
    const hits = await rankedSearch(tbl, s, { limit: DEPTH, tier: 'parliamentary' })
    const cm = hits.filter((h) => isCommittee(h.id))
    const withTerm = cm.filter((h) => `${h.sectionTitle ?? ''} ${h.body ?? ''}`.toLowerCase().includes(s.split(' ')[0].toLowerCase()))
    console.log(`\n[content] "${s}" — ${cm.length}/${hits.length} committee hits, ${withTerm.length} literally containing "${s.split(' ')[0]}"`)
    for (const h of withTerm.slice(0, 4)) {
      console.log(`   ${h.id}`)
      console.log(`      title: ${JSON.stringify((h.sectionTitle ?? '').slice(0, 110))}`)
      console.log(`      body : ${JSON.stringify((h.body ?? '').replace(/\s+/g, ' ').slice(0, 160))}`)
    }
    if (!withTerm.length && cm.length) console.log(`   (committee hits exist but none contain the term — e.g. ${cm[0].id})`)
  }
}

main().catch((e) => { console.error('[content] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
