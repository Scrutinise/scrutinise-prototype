/**
 * v36-check-headline.ts — did the instruments the sprint exists for actually land?
 *
 * The recovery is measured in row counts everywhere else. This asks the only question
 * a reader actually cares about: is the Companies Act 2006 in the corpus, with text,
 * and is UK GDPR? Both were named in the brief; both are top of the citation queue;
 * both were absent for months.
 *
 * Reads back from corpus_sections rather than from the queue's `done` flag, because a
 * done row proves the worker finished, not that anything was written.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const HEADLINE = [
  ['ukpga/2006/46', 'Companies Act 2006'],
  ['uksi/1996/207', "Jobseeker's Allowance Regulations 1996"],
  ['uksi/2006/213', 'Housing Benefit Regulations 2006'],
  ['eur/2016/679', 'UK GDPR'],
  ['ukpga/1925/20', 'Law of Property Act 1925 (calendar id — corpus holds the regnal twin)'],
]

async function main() {
  const pool = getNeonPool()
  console.log('gid              queue      compiled  revoked      words   title')
  for (const [gid, title] of HEADLINE) {
    const { rows: [s] } = await pool.query(`
      SELECT count(*) FILTER (WHERE status='compiled')::int AS compiled,
             count(*) FILTER (WHERE availability_status='revoked')::int AS revoked,
             COALESCE(sum("wordCount") FILTER (WHERE status='compiled'),0)::int AS words
      FROM corpus_sections WHERE split_part(id, ':', 2) = $1`, [gid])
    const { rows: q } = await pool.query(
      `SELECT status FROM ingest_queue WHERE "docId" = $1 AND "sourceType" = 'tna-legislation'`, [gid])
    console.log(
      `${gid.padEnd(16)} ${String(q[0]?.status ?? '—').padEnd(10)} ${String(s.compiled).padStart(8)} ` +
      `${String(s.revoked).padStart(8)} ${Number(s.words).toLocaleString().padStart(10)}   ${title}`)
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
