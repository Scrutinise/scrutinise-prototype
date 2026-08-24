/** c3-whichdb.ts — mandatory §16 check: which database am I about to touch, and what is in it. */
import { pool } from './db'

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL || ''
  const host = url.replace(/^[^@]*@/, '').split('/')[0]
  const db = (await q(`SELECT current_database() d, current_user u, version() v`))[0]
  console.log(`host      : ${host}`)
  console.log(`database  : ${db.d}   user: ${db.u}`)
  console.log(`server    : ${String(db.v).slice(0, 60)}`)
  console.log('')
  const compiled = (await q(`SELECT count(*)::bigint n FROM corpus_sections WHERE status='compiled'`))[0].n
  const all = (await q(`SELECT count(*)::bigint n FROM corpus_sections`))[0].n
  console.log(`corpus_sections total    : ${Number(all).toLocaleString()}`)
  console.log(`corpus_sections compiled : ${Number(compiled).toLocaleString()}`)
  console.log('')
  const keys = ['et-decisions','lda-lordswrittenquestions','lda-commonswrittenquestions','written-statements','lda-commonsdivisions','lda-lordsdivisions','written-answers','oecd','ots-reports']
  const rows = await q(
    `SELECT corpus, count(*)::int n, count(*) FILTER (WHERE format='html')::int html
       FROM corpus_sections WHERE corpus = ANY($1) GROUP BY corpus ORDER BY corpus`, [keys])
  for (const k of keys) {
    const r = rows.find((x: any) => x.corpus === k)
    console.log(`  ${k.padEnd(32)} ${r ? String(r.n).padStart(9) : '        0'}   (html: ${r ? r.html : 0})`)
  }
  await p.end()
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
