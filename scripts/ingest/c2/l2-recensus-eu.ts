/**
 * l2-recensus-eu.ts — LANE 2 item 4. Re-census retained-eu with the corrected guard.
 *
 * WRITES: inserts into `section_repeals` only, ON CONFLICT DO NOTHING. Deletes nothing,
 * updates nothing, touches no other collection. Resumable via its own checkpoint.
 *
 * Why only retained-eu: the corrected guard changes the verdict for exactly one shape,
 * "Article N . . . .", and a 500-row body sample of each of the other five legislation
 * collections found 0% missed. Re-reading 1.4M R2 objects to confirm a measured zero is
 * not a good use of the source or the clock — but the sample is n=500 per collection, not
 * a proof, and that is recorded rather than smoothed over.
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { r2Get } from '../shared/r2-client'
import { isRepealedPlaceholder } from '../shared/compile'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

const CKPT = path.join(__dirname, 'recensus-eu-checkpoint.json')
const PAGE = 5_000, CONC = 24
interface Ckpt { cursor: string; read: number; hits: number; inserted: number; updatedAt: string }
const load = (): Ckpt => fs.existsSync(CKPT) ? JSON.parse(fs.readFileSync(CKPT, 'utf8'))
  : { cursor: '', read: 0, hits: 0, inserted: 0, updatedAt: '' }
const save = (c: Ckpt) => { c.updatedAt = new Date().toISOString(); fs.writeFileSync(CKPT, JSON.stringify(c, null, 1)) }

async function mapPool<T>(it: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < it.length) await fn(it[i++]) }))
}

;(async () => {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 1_800_000, query_timeout: 1_800_000 })

  const { rows: edges } = await pool.query(
    `SELECT to_id, min(split_part(from_id, ':', 2)) AS by_gid
     FROM legislation_edges WHERE edge_type='repeals' GROUP BY 1`)
  const repealedBy = new Map<string, string>(edges.map((r: any) => [r.to_id, r.by_gid]))
  console.log(`[recensus] ${repealedBy.size.toLocaleString()} sections have a known repealing instrument`)

  const before = (await pool.query(
    `select count(*)::int n from section_repeals where corpus='retained-eu'`)).rows[0].n
  console.log(`[recensus] retained-eu flagged BEFORE: ${before}`)

  const cp = load()
  console.log(`[recensus] resuming at "${cp.cursor}" — ${cp.read.toLocaleString()} read, ${cp.hits.toLocaleString()} hits`)
  const t0 = Date.now()

  for (;;) {
    const { rows } = await pool.query(
      `SELECT id, "r2Key", "sourceUrl" FROM corpus_sections
       WHERE corpus='retained-eu' AND status='compiled' AND "r2Key" IS NOT NULL AND id > $1
       ORDER BY id LIMIT $2`, [cp.cursor, PAGE])
    if (!rows.length) { console.log('[recensus] cursor exhausted — COMPLETE'); break }

    const hits: any[] = []
    await mapPool(rows, CONC, async (r: any) => {
      const body = await r2Get(r.r2Key)
      if (body === null) return
      cp.read++
      if (!isRepealedPlaceholder(body)) return
      cp.hits++
      const parts = r.id.split(':')
      hits.push([r.id, parts[1], parts.slice(2).join(':'), 'retained-eu',
        repealedBy.get(r.id) ?? null, r.sourceUrl ?? null])
    })

    if (hits.length) {
      const vals = hits.map((_, i) => {
        const b = i * 6
        return `($${b+1},$${b+2},$${b+3},$${b+4},'dot-leader-placeholder',$${b+5},$${b+6})`
      })
      const res = await pool.query(
        `INSERT INTO section_repeals (section_id, gid, section_ref, corpus, evidence, repealed_by, source_url)
         VALUES ${vals.join(',')} ON CONFLICT (section_id) DO NOTHING`, hits.flat())
      cp.inserted += res.rowCount ?? 0
    }
    cp.cursor = rows[rows.length - 1].id
    save(cp)
    const rate = cp.read / ((Date.now() - t0) / 1000)
    console.log(`[recensus] ${cp.read.toLocaleString()} read · ${cp.hits.toLocaleString()} placeholders (${(100*cp.hits/Math.max(1,cp.read)).toFixed(2)}%) · ${cp.inserted.toLocaleString()} inserted · ${rate.toFixed(0)}/s · cursor ${cp.cursor}`)
  }

  const after = (await pool.query(
    `select count(*)::int n from section_repeals where corpus='retained-eu'`)).rows[0].n
  const total = (await pool.query(`select count(*)::int n from section_repeals`)).rows[0].n
  console.log(`\n[recensus] retained-eu flagged: ${before} → ${after}  (+${after - before})`)
  console.log(`[recensus] section_repeals total: ${total.toLocaleString()}`)
  await pool.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
