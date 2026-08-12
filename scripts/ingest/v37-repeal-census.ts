/**
 * v37-repeal-census.ts — count the dot leaders properly, and turn them into an answer.
 *
 * ── PART ONE: the census (ADDENDUM_V36_SEED_ORDER §3) ──────────────────────────
 * A 400-section sample put dot-leader placeholders at 9.75% of the compiled
 * legislation corpus, extrapolating to ~171,700 sections. An extrapolation is not
 * grounds for flipping 171,700 rows, so this reads every compiled legislation object
 * out of R2 and counts them. Checkpointed, resumable, and it writes the count before
 * it writes anything else.
 *
 * ── PART TWO: the capability, which is the point ───────────────────────────────
 * Those dots are the source telling us **which provisions have been repealed**. The
 * platform currently cannot tell a user that a section is no longer in force — the
 * addendum calls that the most serious unexamined risk in the corpus. Suppressing the
 * empty text fixes a retrieval nuisance; CAPTURING it answers a question we could not
 * previously answer at all.
 *
 * So each detection is written to `section_repeals` as structured data, and joined —
 * where the evidence exists — against the `repeals` edges already in
 * `legislation_edges`, which carry the repealing instrument. **The dots say THAT it
 * was repealed; the edges say BY WHAT.** Where no edge exists the row still lands,
 * with `repealed_by` NULL, because "repealed, repealer unknown" is a fact and a
 * guessed repealer is not.
 *
 * ⚠ WHAT THIS DOES NOT CLAIM. A dot-leader placeholder is evidence the provision has
 * been repealed or otherwise removed from the revised text. It is not a commencement
 * date, and this records no date it has not been given. `evidence` names the basis on
 * every row so a later reader can tell a detection from a citation.
 *
 * Read-only against R2 and corpus_sections; the only writes are to `section_repeals`.
 * It does NOT flip corpus_sections rows — that is `v36-retract-placeholders.ts`, and
 * it should run off this census rather than off a sample.
 *
 * Usage:
 *   tsx v37-repeal-census.ts [--concurrency 24] [--limit N]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { r2Get } from './shared/r2-client'
import { isRepealedPlaceholder } from './shared/compile'

// Its own pool, not shared/neon-pool: that one carries query_timeout 60s, and the
// keyset page below scans a 15M-row table. The first run of this timed out there
// rather than doing anything wrong.
function makePool() {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })
}

const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']
const CKPT = path.join(__dirname, 'v36', 'repeal-census-checkpoint.json')
const PAGE = 5_000

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const CONCURRENCY = Number(arg('concurrency') ?? 24)
const LIMIT = arg('limit') ? Number(arg('limit')) : Infinity

const DDL = `
CREATE TABLE IF NOT EXISTS section_repeals (
  section_id   text PRIMARY KEY,
  gid          text NOT NULL,
  section_ref  text NOT NULL,
  corpus       text NOT NULL,
  evidence     text NOT NULL,          -- 'dot-leader-placeholder'
  repealed_by  text,                   -- gid of the repealing instrument, from legislation_edges; NULL when unknown
  source_url   text,
  detected_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS section_repeals_gid ON section_repeals (gid);`

interface Ckpt { cursor: string; read: number; hits: number; byCorpus: Record<string, [number, number]>; updatedAt: string }
const FRESH: Ckpt = { cursor: '', read: 0, hits: 0, byCorpus: {}, updatedAt: '' }

function load(): Ckpt {
  try { return JSON.parse(fs.readFileSync(CKPT, 'utf8')) } catch { return { ...FRESH } }
}
function save(c: Ckpt) {
  fs.mkdirSync(path.dirname(CKPT), { recursive: true })
  c.updatedAt = new Date().toISOString()
  fs.writeFileSync(CKPT, JSON.stringify(c, null, 1))
}

async function mapPool<T>(items: T[], k: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    for (;;) { const j = i++; if (j >= items.length) return; await fn(items[j]) }
  }))
}

async function main() {
  const pool = makePool()
  await pool.query(DDL)

  // The repealing instrument, where the amendments dataset knows it. Loaded once:
  // 157,960 section-section + 31,974 section-act repeals edges is a big join to do
  // per row and a small map to hold.
  console.log('[census] loading repeals edges…')
  const { rows: edgeRows } = await pool.query(
    `SELECT to_id, min(split_part(from_id, ':', 2)) AS by_gid
     FROM legislation_edges WHERE edge_type = 'repeals' GROUP BY 1`)
  const repealedBy = new Map<string, string>(edgeRows.map(r => [r.to_id as string, r.by_gid as string]))
  console.log(`[census] ${repealedBy.size.toLocaleString()} sections have a known repealing instrument`)

  const cp = load()
  console.log(`[census] resuming from cursor "${cp.cursor}" — ${cp.read.toLocaleString()} read, ${cp.hits.toLocaleString()} placeholders so far`)

  for (;;) {
    if (cp.read >= LIMIT) { console.log('[census] --limit reached'); break }
    const { rows } = await pool.query(
      `SELECT id, corpus, "r2Key", "sourceUrl" FROM corpus_sections
       WHERE corpus = ANY($1::text[]) AND status = 'compiled' AND "r2Key" IS NOT NULL AND id > $2
       ORDER BY id LIMIT $3`, [LEG_CORPORA, cp.cursor, PAGE])
    if (!rows.length) { console.log('[census] cursor exhausted — census COMPLETE'); break }

    const hits: Record<string, unknown>[] = []
    await mapPool(rows, CONCURRENCY, async (r) => {
      const body = await r2Get(r.r2Key as string)
      if (body === null) return              // object missing: not a placeholder, and not this script's business
      cp.read++
      const c = (cp.byCorpus[r.corpus as string] ??= [0, 0])
      c[0]++
      if (!isRepealedPlaceholder(body)) return
      cp.hits++; c[1]++
      const id = r.id as string
      const parts = id.split(':')
      hits.push({
        section_id: id, gid: parts[1], section_ref: parts.slice(2).join(':'), corpus: r.corpus,
        repealed_by: repealedBy.get(id) ?? null, source_url: r.sourceUrl ?? null,
      })
    })

    if (hits.length) {
      const vals: string[] = []
      const params: unknown[] = []
      hits.forEach((h, i) => {
        const b = i * 6
        vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},'dot-leader-placeholder',$${b + 5},$${b + 6})`)
        params.push(h.section_id, h.gid, h.section_ref, h.corpus, h.repealed_by, h.source_url)
      })
      await pool.query(
        `INSERT INTO section_repeals (section_id, gid, section_ref, corpus, evidence, repealed_by, source_url)
         VALUES ${vals.join(',')} ON CONFLICT (section_id) DO NOTHING`, params)
    }

    cp.cursor = rows[rows.length - 1].id as string
    save(cp)
    const pct = ((100 * cp.hits) / Math.max(1, cp.read)).toFixed(2)
    console.log(`[census] ${cp.read.toLocaleString()} read · ${cp.hits.toLocaleString()} repealed (${pct}%) · cursor ${cp.cursor.slice(0, 46)}`)
  }

  console.log(`\n[census] ── RESULT ──`)
  console.log(`[census] sections read      : ${cp.read.toLocaleString()}`)
  console.log(`[census] dot-leader repeals : ${cp.hits.toLocaleString()} (${((100 * cp.hits) / Math.max(1, cp.read)).toFixed(2)}%)`)
  for (const [c, [n, d]] of Object.entries(cp.byCorpus).sort((a, b) => b[1][1] - a[1][1])) {
    console.log(`[census]   ${c.padEnd(24)} ${String(d).padStart(7)}/${String(n).padEnd(8)} ${((100 * d) / Math.max(1, n)).toFixed(2)}%`)
  }
  const { rows: [w] } = await pool.query(
    `SELECT count(*)::int AS n, count(repealed_by)::int AS with_repealer FROM section_repeals`)
  console.log(`[census] section_repeals    : ${w.n.toLocaleString()} rows, ${w.with_repealer.toLocaleString()} with a known repealing instrument`)
  await pool.end()
}

main().catch(e => { console.error('[census] FATAL', e); process.exitCode = 1 })
