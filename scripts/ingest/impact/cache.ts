/**
 * cache.ts — pull every held impact assessment out of R2 into one local file per assessment, so
 * every later pass reads the SAME bytes and no measurement depends on a network round trip.
 *
 * The cache is the whole document, sections concatenated in section order — because the summary
 * sheet's headline table is SPLIT ACROSS SECTION BOUNDARIES (measured: `ukia/2018/132` keeps
 * "Total Net Present Value / Business Net Present Value" in its `RPC opinion` section and the
 * matching values row `-£54m -£0.1m £0.01m` in its `Costs and benefits` section). Any extractor
 * that reads one section at a time reads headers without values, or values without headers.
 *
 * Cache lives OUTSIDE the repository — ~110MB of text is not a repository artefact.
 *
 * Usage: tsx impact/cache.ts [--force]
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../c2/db'
import { r2Get } from '../shared/r2-client'

export const CACHE = process.env.IMPACT_CACHE ??
  path.join(process.env.LOCALAPPDATA ?? '/tmp', 'Temp/claude/C--Code-scrutinise-prototype/impact_cache')

export function slugOf(url: string) { return url.replace(/^.*\/ukia\//, '').replace(/\//g, '-') }
export function cachePath(url: string) { return path.join(CACHE, `${slugOf(url)}.txt`) }

/** Every assessment we hold, with its metadata. The single list every pass iterates. */
export interface Doc {
  url: string; ukia: string; sections: number; words: number
  date: string | null; instrument: string | null
}

export async function docList(): Promise<Doc[]> {
  const p = pool()
  const rows = (await p.query(
    `SELECT "sourceUrl" url, count(*) sections, sum("wordCount") words,
            min("itemDate")::text date,
            (array_agg("parentDocId") FILTER (WHERE "parentDocId" IS NOT NULL))[1] instrument
       FROM corpus_sections WHERE corpus='impact-assessments' AND status='compiled'
      GROUP BY 1 ORDER BY 1`)).rows as any[]
  await p.end()
  return rows.map(r => ({
    url: r.url, ukia: r.url.replace(/^.*\/ukia\//, 'ukia/'),
    sections: Number(r.sections), words: Number(r.words),
    date: r.date, instrument: r.instrument,
  }))
}

export function readCached(url: string): string | null {
  try { return fs.readFileSync(cachePath(url), 'utf8') } catch { return null }
}

async function main() {
  const force = process.argv.includes('--force')
  fs.mkdirSync(CACHE, { recursive: true })
  const p = pool()
  const docs = (await p.query(
    `SELECT "sourceUrl" url FROM corpus_sections
      WHERE corpus='impact-assessments' AND status='compiled' GROUP BY 1 ORDER BY 1`)).rows as any[]

  let done = 0, skipped = 0, empty = 0
  const queue = [...docs]
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const d = queue.shift()
      if (!d) return
      if (!force && fs.existsSync(cachePath(d.url))) { skipped++; continue }
      const keys = (await p.query(
        `SELECT "r2Key" FROM corpus_sections
          WHERE corpus='impact-assessments' AND "sourceUrl"=$1 AND "r2Key" IS NOT NULL
          ORDER BY (regexp_replace(id, '^.*:', ''))::int`, [d.url])).rows as any[]
      const parts = await Promise.all(keys.map(k => r2Get(k.r2Key)))
      const text = parts.filter(Boolean).join('\n\n')
      if (!text) empty++
      fs.writeFileSync(cachePath(d.url), text)
      if (++done % 100 === 0) console.log(`  cached ${done}…`)
    }
  })
  await Promise.all(workers)
  console.log(`cached ${done}, already present ${skipped}, EMPTY ${empty}, of ${docs.length}`)
  console.log(`→ ${CACHE}`)
  await p.end()
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
