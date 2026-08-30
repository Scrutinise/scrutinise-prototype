// CCW-B7 Phase 4 check 2 — timestamp alignment.
//
// "Open the video at a passage's start_s and confirm the words match" tests the
// one thing the report depends on. This does it mechanically and independently:
// it re-fetches the SAME videos from YouTube in the json3 caption format, which
// carries YouTube's own per-event millisecond timings in a completely different
// container, parses it with different code, and asks whether the words YouTube
// places in [start_s, end_s] are the words we stored for that window.
//
// It is deliberately not a re-run of parse-the-vtt-again: a bug in vtt.ts would
// reproduce itself and the check would pass. json3 shares no code path with it.
//
// A drifted or mis-scaled timestamp collapses the overlap score. Identical text
// at a shifted time still scores near zero, because the comparison is windowed.
//
// Usage: tsx align-check.ts [n=3] [seed]
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pool, banner } from './db'

interface Ev { startS: number; endS: number; text: string }

function parseJson3(raw: string): Ev[] {
  const d = JSON.parse(raw)
  const out: Ev[] = []
  for (const e of d.events ?? []) {
    if (!e.segs) continue
    const text = e.segs.map((s: { utf8?: string }) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim()
    if (!text || text === '\n') continue
    const startS = (e.tStartMs ?? 0) / 1000
    out.push({ startS, endS: startS + (e.dDurationMs ?? 0) / 1000, text })
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)

/** Fraction of our stored words that appear, with multiplicity, in YouTube's own window. */
function overlap(ours: string[], theirs: string[]): number {
  if (!ours.length) return 0
  const bag = new Map<string, number>()
  for (const w of theirs) bag.set(w, (bag.get(w) ?? 0) + 1)
  let hit = 0
  for (const w of ours) { const n = bag.get(w) ?? 0; if (n > 0) { hit++; bag.set(w, n - 1) } }
  return hit / ours.length
}

async function main() {
  const n = Number(process.argv[2] ?? 3)
  const seed = process.argv[3] ?? 'b7'
  banner(`align-check: ${n} videos, seed=${seed}`)
  const p = pool()

  // md5-ordered, not id-ordered: YouTube ids are not random enough to trust for
  // sampling, and ordering by id has picked a biased sample on this project before.
  const vids = (await p.query(
    `select v.video_id, v.title from starkey.video v
     join starkey.transcript t on t.video_id = v.video_id and t.source in ('asr','human')
     order by md5(v.video_id || $1) limit $2`, [seed, n])).rows

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starkey-align-'))
  let worst = 1
  for (const v of vids) {
    console.log(`\n=== ${v.video_id}  ${v.title}`)
    try {
      execFileSync(process.platform === 'win32' ? 'python' : 'python3',
        ['-m', 'yt_dlp', '--skip-download', '--write-auto-subs', '--write-subs',
         '--sub-langs', 'en.*', '--sub-format', 'json3', '--no-progress', '--no-colors',
         '-o', path.join(tmp, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${v.video_id}`],
        { stdio: 'ignore', timeout: 120000 })
    } catch {
      console.log('  ! re-fetch failed — NOT CHECKED (this is not a pass)')
      continue
    }
    const f = fs.readdirSync(tmp).find(x => x.startsWith(v.video_id) && x.endsWith('.json3'))
    if (!f) { console.log('  ! no json3 track returned — NOT CHECKED (this is not a pass)'); continue }
    const evs = parseJson3(fs.readFileSync(path.join(tmp, f), 'utf8'))

    // Three passages spread across the video: an alignment error that only bites
    // late (drift) looks fine if you only ever check the opening.
    const passages = (await p.query(
      `select start_s::float s, end_s::float e, text from starkey.passage
       where video_id=$1 and source in ('asr','human') order by start_s`, [v.video_id])).rows
    if (!passages.length) { console.log('  ! no passages'); continue }
    const picks = [0, Math.floor(passages.length / 2), passages.length - 1]
      .filter((x, i, a) => a.indexOf(x) === i).map(i => passages[i])

    for (const pg of picks) {
      const theirs = evs.filter(e => e.endS > pg.s - 1 && e.startS < pg.e + 1).flatMap(e => norm(e.text))
      const ours = norm(pg.text)
      const score = overlap(ours, theirs)
      worst = Math.min(worst, score)
      const t = Math.floor(pg.s)
      console.log(`  [${new Date(t * 1000).toISOString().slice(11, 19)}] overlap ${(score * 100).toFixed(1)}%  ${ours.length} words`
        + `  https://www.youtube.com/watch?v=${v.video_id}&t=${t}s`)
      if (score < 0.9) {
        console.log(`    ours:   ${pg.text.slice(0, 160)}`)
        console.log(`    theirs: ${theirs.slice(0, 28).join(' ')}`)
      }
    }

    // The control that makes the score mean something: the SAME passage text
    // compared against a window 120s away must score badly. If a shifted window
    // also scores high, the metric is measuring Starkey's vocabulary, not time.
    const pg = picks[0]
    const shifted = evs.filter(e => e.endS > pg.s + 119 && e.startS < pg.e + 121).flatMap(e => norm(e.text))
    if (shifted.length) {
      console.log(`  control (same text vs a window +120s away): ${(overlap(norm(pg.text), shifted) * 100).toFixed(1)}% — must be LOW`)
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\nworst overlap across all checked windows: ${(worst * 100).toFixed(1)}%`)
  await p.end()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
