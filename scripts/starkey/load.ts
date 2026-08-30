// Loads the raw VTT files into starkey.video / transcript / cue / passage.
//
// The database is DERIVED. Every row here is rebuildable from
// docs/report_run/sources/youtube/ without going back to YouTube, which is the
// whole point of keeping the raw files: a schema change is a re-run, not a
// re-scrape. So the load is idempotent — it replaces the cues and passages for
// each (video_id, source) it touches rather than appending.
//
// Usage:
//   tsx load.ts            load everything on disk
//   tsx load.ts <id> ...   load only these video ids
import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'
import { parseVtt, buildPassages, wordCount, Cue } from './vtt'
import { readAllMeta, pickCaptionFile, RAW_DIR, Meta } from './manifest'

// Vendor watermark injected into the first cue by TurboScribe's free tier. It
// is not speech, and it is a fixed literal — removing it is not the "guessing
// at words" the brief forbids, and it is declared here so it is never silent.
const VENDOR_BANNERS = [
  /\(Transcribed by TurboScribe\.[^)]*\)\s*/gi,
  /\(Transcription by TurboScribe\.[^)]*\)\s*/gi,
]

function stripVendorBanner(cues: Cue[]): { cues: Cue[]; stripped: number } {
  let stripped = 0
  const out = cues.map(c => {
    let t = c.text
    for (const re of VENDOR_BANNERS) t = t.replace(re, '')
    t = t.trim()
    if (t !== c.text) stripped++
    return { ...c, text: t }
  }).filter(c => c.text.length > 0)
  return { cues: out, stripped }
}

interface Job { meta: Meta; file: string; source: string; engine: string }

/** External-engine files: <video_id>.<source>.vtt where <source> is not a caption language. */
function externalJobs(metas: Meta[]): Job[] {
  const byId = new Map(metas.map(m => [m.videoId, m]))
  const jobs: Job[] = []
  if (!fs.existsSync(RAW_DIR)) return jobs
  for (const f of fs.readdirSync(RAW_DIR)) {
    const m = f.match(/^([A-Za-z0-9_-]{11})\.(.+)\.vtt$/)
    if (!m) continue
    const [, id, tag] = m
    const meta = byId.get(id)
    if (!meta) { console.log(`  ! ${f}: no metadata for ${id}, skipped`); continue }
    if (meta.humanLangs.includes(tag) || meta.autoLangs.includes(tag)) continue // a YouTube track
    jobs.push({ meta, file: path.join(RAW_DIR, f), source: tag, engine: tag })
  }
  return jobs
}

async function main() {
  banner('load raw VTT -> starkey.* (CCW-B7 Phase 3)')
  const only = new Set(process.argv.slice(2))
  const { metas, missing } = readAllMeta()
  if (missing.length) console.log(`note: ${missing.length} ids have no metadata and are not loaded: ${missing.join(', ')}`)

  const wanted = only.size ? metas.filter(m => only.has(m.videoId)) : metas

  const jobs: Job[] = []
  const noCaptions: Meta[] = []
  for (const m of wanted) {
    const pick = pickCaptionFile(m)
    if (pick) jobs.push({ meta: m, file: pick.file, source: pick.source, engine: pick.engine })
    else noCaptions.push(m)
  }
  jobs.push(...externalJobs(wanted))

  const p = pool()
  const client = await p.connect()
  const thin: string[] = []
  let cuesTotal = 0, passagesTotal = 0, words = 0, bannersStripped = 0

  try {
    for (const job of jobs) {
      const { meta } = job
      let cues = parseVtt(fs.readFileSync(job.file, 'utf8'))
      const b = stripVendorBanner(cues)
      cues = b.cues; bannersStripped += b.stripped
      const passages = buildPassages(cues)
      const wc = wordCount(cues)

      await client.query('BEGIN')
      await client.query(
        `INSERT INTO starkey.video (video_id, url, title, published_on, duration_s, is_short)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (video_id) DO UPDATE SET
           url=EXCLUDED.url, title=EXCLUDED.title, published_on=EXCLUDED.published_on,
           duration_s=EXCLUDED.duration_s, is_short=EXCLUDED.is_short`,
        [meta.videoId, meta.url, meta.title, meta.uploadDate, meta.durationS, meta.isShort])

      await client.query(`DELETE FROM starkey.cue     WHERE video_id=$1 AND source=$2`, [meta.videoId, job.source])
      await client.query(`DELETE FROM starkey.passage WHERE video_id=$1 AND source=$2`, [meta.videoId, job.source])

      for (let i = 0; i < cues.length; i += 500) {
        const batch = cues.slice(i, i + 500)
        const vals: unknown[] = []
        const rows = batch.map((c, k) => {
          vals.push(meta.videoId, job.source, c.startS, c.endS, c.text)
          return `($${k * 5 + 1},$${k * 5 + 2},$${k * 5 + 3},$${k * 5 + 4},$${k * 5 + 5})`
        })
        await client.query(`INSERT INTO starkey.cue (video_id, source, start_s, end_s, text) VALUES ${rows.join(',')}`, vals)
      }
      for (let i = 0; i < passages.length; i += 200) {
        const batch = passages.slice(i, i + 200)
        const vals: unknown[] = []
        const rows = batch.map((c, k) => {
          vals.push(meta.videoId, job.source, c.startS, c.endS, c.text)
          return `($${k * 5 + 1},$${k * 5 + 2},$${k * 5 + 3},$${k * 5 + 4},$${k * 5 + 5})`
        })
        await client.query(`INSERT INTO starkey.passage (video_id, source, start_s, end_s, text) VALUES ${rows.join(',')}`, vals)
      }

      await client.query(
        `INSERT INTO starkey.transcript (video_id, source, engine) VALUES ($1,$2,$3)
         ON CONFLICT (video_id, source) DO UPDATE SET engine=EXCLUDED.engine, loaded_at=now()`,
        [meta.videoId, job.source, job.engine])
      await client.query('COMMIT')

      cuesTotal += cues.length; passagesTotal += passages.length; words += wc
      if (wc < 200) thin.push(`${meta.videoId} [${job.source}] ${wc} words  ${meta.title}`)
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }

  // Videos with no caption file still belong in starkey.video: the corpus has
  // to say "we have this video and it has no transcript", not omit it silently.
  for (const m of noCaptions) {
    await p.query(
      `INSERT INTO starkey.video (video_id, url, title, published_on, duration_s, is_short)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (video_id) DO UPDATE SET
         url=EXCLUDED.url, title=EXCLUDED.title, published_on=EXCLUDED.published_on,
         duration_s=EXCLUDED.duration_s, is_short=EXCLUDED.is_short`,
      [m.videoId, m.url, m.title, m.uploadDate, m.durationS, m.isShort])
  }

  console.log(`\ntranscripts loaded: ${jobs.length}`)
  console.log(`videos with no caption file: ${noCaptions.length}${noCaptions.length ? ' -> ' + noCaptions.map(m => m.videoId).join(', ') : ''}`)
  console.log(`cues: ${cuesTotal.toLocaleString()}   passages: ${passagesTotal.toLocaleString()}   words: ${words.toLocaleString()}`)
  console.log(`vendor-banner cues stripped: ${bannersStripped}`)
  console.log(`\nunder 200 words — FLAGGED, not excluded (${thin.length}):`)
  console.log(thin.length ? thin.map(t => '  ' + t).join('\n') : '  (none)')
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
