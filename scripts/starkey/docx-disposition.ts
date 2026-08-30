// CCW-B8 steps 2 and 3 — decide what each of the seven .docx actually is, and
// write the ones that are independent transcriptions into raw/ for loading.
//
// The identification is RE-DERIVED here rather than taken from the brief's
// table. B8 itself was revised once because its first version got this wrong,
// and the whole point of the exercise is that a scraped copy of the ASR must
// never be loaded as a second source: a single-sourced passage that looks
// double-sourced stops a human checking it. So the measurement is repeated,
// and the mapping comes from the TEXT, not from the URLs in the documents —
// two of which point at the wrong video.
//
// Metric: longest-common-subsequence ratio over the first 2,000 normalised
// words, 2*LCS/(len(a)+len(b)). It is a sequence measure, so a document that
// merely shares Starkey's vocabulary with a different video scores low.
//
// Run scripts/starkey/docx-extract.py first.
import * as fs from 'fs'
import * as path from 'path'
import { pool, banner } from './db'
import { parseVtt } from './vtt'
import { RAW_DIR, ROOT } from './manifest'
import { norm, lcsRatio } from './text'

const EXTRACT = path.join(ROOT, '_docx_extract')
const WINDOW = 2000

// The eight videos any of these documents could plausibly be: the six numbered
// parts, the September lecture, and the Q&A interview.
const CANDIDATES = [
  'soNnF0sjF5Y', 'jnsiLNNL8s8', '8veLovq5NWQ', 'okJNAMPBRqg',
  'q1Mto3BxMcA', 'Mwf_SwRa2F0', 'EMbRv6aaQrs', '2Khgz5sMMBU',
]


async function main() {
  banner('docx disposition (CCW-B8 steps 2-3)')
  const p = pool()

  // ASR text per candidate video, in time order.
  const asr = new Map<string, string[]>()
  const titles = new Map<string, string>()
  for (const id of CANDIDATES) {
    const r = await p.query(
      `select string_agg(text, ' ' order by start_s) t from starkey.cue where video_id=$1 and source='asr'`, [id])
    asr.set(id, norm(r.rows[0]?.t ?? '').slice(0, WINDOW))
    const v = await p.query(`select title from starkey.video where video_id=$1`, [id])
    titles.set(id, v.rows[0]?.title ?? '?')
  }

  const stems = fs.readdirSync(EXTRACT).filter(f => f.endsWith('.prose.txt')).map(f => f.replace(/\.prose\.txt$/, ''))
  const meta = JSON.parse(fs.readFileSync(path.join(EXTRACT, '_extract.json'), 'utf8')) as Array<{
    stem: string; engines_found: string[]; video_ids_in_document: string[]; srt_timing_lines: number
  }>

  const results: Array<{ stem: string; best: string; bestScore: number; second: string; secondScore: number; engine: string; srtCues: number }> = []

  for (const stem of stems.sort()) {
    const prose = fs.readFileSync(path.join(EXTRACT, `${stem}.prose.txt`), 'utf8')
    // Strip the (M:SS) inline markers — they are structure, not words, and
    // leaving them in would depress every score equally but for no reason.
    const doc = norm(prose.replace(/\(\d{1,2}:\d{2}(?::\d{2})?\)/g, ' ')).slice(0, WINDOW)
    const scored = CANDIDATES
      .map(id => ({ id, s: lcsRatio(doc, asr.get(id) ?? []) }))
      .sort((a, b) => b.s - a.s)
    const m = meta.find(x => x.stem === stem)!
    results.push({
      stem, best: scored[0].id, bestScore: scored[0].s,
      second: scored[1].id, secondScore: scored[1].s,
      engine: m.engines_found.filter(e => !['summarize', 'tactiq'].includes(e)).join(',') || m.engines_found.join(','),
      srtCues: m.srt_timing_lines,
    })
  }

  console.log('\n--- IDENTIFICATION, re-derived from the text ---')
  console.log('document                                  engine         best match    LCS    2nd best      LCS    srt cues')
  for (const r of results) {
    console.log(`${r.stem.padEnd(41)} ${r.engine.padEnd(14)} ${r.best.padEnd(13)} ${r.bestScore.toFixed(3)}  ${r.second.padEnd(13)} ${r.secondScore.toFixed(3)}  ${String(r.srtCues).padStart(5)}`)
  }

  // The classes must separate, or the disposition is a guess. An independent
  // engine on the same audio lands well below a scraper re-formatting the ASR.
  const independent = results.filter(r => r.srtCues > 0)
  const scraped = results.filter(r => r.srtCues === 0)
  const maxInd = Math.max(...independent.map(r => r.bestScore))
  const minScr = Math.min(...scraped.map(r => r.bestScore))
  console.log(`\nindependent (has an SRT block): max LCS ${maxInd.toFixed(3)}`)
  console.log(`scraped     (prose only):       min LCS ${minScr.toFixed(3)}`)
  console.log(minScr > maxInd
    ? `SEPARATED — gap ${(minScr - maxInd).toFixed(3)}; no document sits between the two classes`
    : `!! NOT SEPARATED — the two classes overlap; do not load anything on this evidence`)

  // Also check the mapping is unambiguous: the runner-up must be far behind.
  for (const r of results) {
    if (r.bestScore - r.secondScore < 0.3) console.log(`!! ${r.stem}: best and second-best are close (${r.bestScore.toFixed(3)} vs ${r.secondScore.toFixed(3)}) — mapping not safe`)
  }

  console.log('\n--- LOAD DECISION ---')
  const toWrite: Array<{ id: string; stem: string }> = []
  for (const r of results) {
    if (r.srtCues === 0) { console.log(`  SKIP  ${r.stem} -> ${r.best} (${titles.get(r.best)?.slice(0, 40)}) — scraped copy of the ASR, LCS ${r.bestScore.toFixed(3)}`); continue }
    const already = await p.query(`select count(*)::int n from starkey.cue where video_id=$1 and source='turboscribe'`, [r.best])
    if (already.rows[0].n > 0) { console.log(`  HAVE  ${r.stem} -> ${r.best} — turboscribe already loaded (${already.rows[0].n} cues); verifying it is the same transcript`); }
    else console.log(`  LOAD  ${r.stem} -> ${r.best} — independent transcription, LCS ${r.bestScore.toFixed(3)}, ${r.srtCues} cues`)
    toWrite.push({ id: r.best, stem: r.stem })
  }

  console.log('\n--- WRITING raw/<id>.turboscribe.vtt ---')
  for (const { id, stem } of toWrite) {
    const srt = fs.readFileSync(path.join(EXTRACT, `${stem}.srt`), 'utf8')
    const cues = parseVtt(srt)
    const dest = path.join(RAW_DIR, `${id}.turboscribe.vtt`)
    if (fs.existsSync(dest)) {
      // Part 1 came from Charlie's Downloads copy. Compare rather than assume.
      const existing = parseVtt(fs.readFileSync(dest, 'utf8'))
      const a = norm(existing.map(c => c.text).join(' '))
      const b = norm(cues.map(c => c.text).join(' '))
      const same = a.length === b.length && a.every((w, i) => w === b[i])
      console.log(`  ${path.basename(dest)}: already on disk — ${existing.length} cues there, ${cues.length} in the document; text ${same ? 'IDENTICAL' : 'DIFFERS'}`)
      if (!same) console.log(`    !! not the same transcript — left the existing file alone, decide before loading`)
      continue
    }
    // Written as WebVTT so one parser serves the whole corpus. The SRT comma
    // decimal separator is the only difference and parseVtt accepts both, but
    // the file on disk should say what it is.
    const body = cues.map((c, i) =>
      `${i + 1}\n${hms(c.startS)} --> ${hms(c.endS)}\n${c.text}\n`).join('\n')
    fs.writeFileSync(dest, `WEBVTT\nKind: captions\nLanguage: en\n\n${body}`, 'utf8')
    console.log(`  ${path.basename(dest)}: written, ${cues.length} cues, last ends ${cues[cues.length - 1].endS.toFixed(1)}s`)
  }

  await p.end()
}

function hms(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
