/**
 * probe-title-retrieval.ts — INGEST-LABELS §4.1: WHAT DOES A WRONG TITLE COST A USER?
 *
 * The rate says how common the defect is. This says whether it matters, which is the number the
 * brief asks for: *"take ten sections with a known-wrong title and ask whether the right query
 * returns them."*
 *
 * Two arms, and the CONTROL is what makes the number readable:
 *   BROKEN  — the sections `audit-section-titles.ts` proved carry a wrong title.
 *   CONTROL — sections from the same collections whose title was proved CORRECT.
 * Both are queried the same way, with the section's TRUE heading plus its Act title — the query a
 * user who knows what they are looking for would type. Without the control arm "4 of 11 found" is
 * unreadable: it could be the defect, or it could be that section-level retrieval is simply hard.
 *
 * Also measured, because it is the other half of the harm: does the WRONG title pull the section up
 * for a query about something it has nothing to do with? A section on police detention answering to
 * "Taking of Hostages Act 1982" is a false positive a user cannot detect.
 *
 * ⚠ Queries the LIVE index through the same service the platform uses, scoped to the section's own
 * collection. Scoping makes the test EASIER than production, deliberately: a section that cannot be
 * found inside its own collection certainly cannot be found from an open query.
 *
 * Usage: FTS_SEARCH_URL=… tsx labels/probe-title-retrieval.ts [--limit 20]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const AUDIT = path.join(__dirname, '../../../docs/label_audit.json')
const OUT = path.join(__dirname, '../../../docs/label_retrieval_probe.json')
const FTS = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app'
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 50 })()

interface AuditRow {
  id: string; corpus: string; gid: string; ref: string
  stored: string; published: string | null; verdict: string
}

async function search(query: string, corpus: string): Promise<string[]> {
  const res = await fetch(`${FTS.replace(/\/$/, '')}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit: LIMIT, corpora: [corpus] }),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}`)
  const j = await res.json() as { results?: Array<{ id: string }> }
  return (j.results ?? []).map(r => r.id)
}

async function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8')) as { results: AuditRow[] }
  const broken = audit.results.filter(r => r.verdict === 'MISMATCH')
  // Control: same collections, same size, proved-correct titles. Take them in the order they were
  // sampled so the control is not itself hand-picked.
  const byCorpus = new Map<string, number>()
  for (const b of broken) byCorpus.set(b.corpus, (byCorpus.get(b.corpus) ?? 0) + 1)
  const control: AuditRow[] = []
  for (const [c, n] of byCorpus) control.push(...audit.results.filter(r => r.verdict === 'match' && r.corpus === c).slice(0, n))

  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 })
  const actTitle = new Map<string, string>()
  const gids = [...new Set([...broken, ...control].map(r => r.gid))]
  const { rows } = await pool.query<{ gid: string; title: string }>(
    `SELECT "legislationGovUkId" gid, title FROM "LegislationItem" WHERE "legislationGovUkId" = ANY($1::text[])`, [gids])
  for (const r of rows) actTitle.set(r.gid, r.title)
  await pool.end()

  const out: Record<string, unknown>[] = []
  for (const arm of [{ name: 'BROKEN', rows: broken }, { name: 'CONTROL', rows: control }]) {
    for (const r of arm.rows) {
      // ⚠ THE QUERY IS THE HEADING ALONE, AND THE FIRST VERSION OF THIS SCRIPT GOT IT WRONG.
      // It asked `"{heading} {act title}"` at limit 20 and scored CONTROL at 4/11, which read as
      // "section retrieval is just weak". It is not: adding "section N" puts every one of those
      // sections at RANK 0. Naming the Act and the section number turns the probe into a lookup
      // that both arms pass, and measures nothing about the title. The heading ALONE is the only
      // query whose success depends on the field under test.
      const truth = arm.name === 'BROKEN' ? (r.published ?? '') : r.stored
      const act = actTitle.get(r.gid) ?? r.gid
      const q = truth.trim()
      void act
      let hits: string[] = []
      let err: string | null = null
      try { hits = await search(q, r.corpus) } catch (e) { err = (e as Error).message }
      const rank = hits.indexOf(r.id)

      // The false-positive arm: does the WRONG title pull it up for a query about that subject?
      let fpRank = -1
      if (arm.name === 'BROKEN') {
        try { fpRank = (await search(r.stored, r.corpus)).indexOf(r.id) } catch { /* reported as -1 */ }
      }
      out.push({ arm: arm.name, id: r.id, corpus: r.corpus, query: q, rank, found: rank >= 0, err, wrongTitleRank: fpRank })
      console.log(`${arm.name.padEnd(8)} ${rank >= 0 ? `rank ${String(rank).padStart(2)}` : 'NOT FOUND'}  ${r.id}\n         q: "${q.slice(0, 96)}"` +
        (arm.name === 'BROKEN' ? `\n         wrong-title query returns it at: ${fpRank >= 0 ? `rank ${fpRank}  ⚠ FALSE POSITIVE` : 'not in top ' + LIMIT}` : ''))
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), limit: LIMIT, results: out }, null, 1))

  const b = out.filter(r => r.arm === 'BROKEN'), c = out.filter(r => r.arm === 'CONTROL')
  const bf = b.filter(r => r.found).length, cf = c.filter(r => r.found).length
  const fp = b.filter(r => (r.wrongTitleRank as number) >= 0).length
  console.log('\n=== §4.1 RETRIEVAL COST ===')
  console.log(`  BROKEN  (right query, wrong stored title): found ${bf} of ${b.length}  = ${(100 * bf / b.length).toFixed(0)}%`)
  console.log(`  CONTROL (right query, correct title)     : found ${cf} of ${c.length}  = ${(100 * cf / c.length).toFixed(0)}%`)
  console.log(`  FALSE POSITIVES — querying the WRONG title alone returns the section: ${fp} of ${b.length}`)
  console.log(`
  Read as: both arms query the SECTION HEADING ALONE, scoped to the section's own collection,`)
  console.log(`  limit ${LIMIT}. The only difference between the arms is whether the stored title matches that heading.`)
  console.log(`\n[probe] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
