// Builds the fetch manifest from the .info.json files and answers CCW-B7
// Phase 1: which of the 285 are the "David Starkey thesis" series, what was
// retrieved, and what failed.
import * as fs from 'fs'
import * as path from 'path'

export const ROOT = path.resolve(__dirname, '../../docs/report_run/sources/youtube')
export const META_DIR = path.join(ROOT, 'meta')
export const RAW_DIR = path.join(ROOT, 'raw')
export const IDS_FILE = path.join(ROOT, 'video_ids.txt')

export interface Meta {
  videoId: string
  url: string
  title: string
  uploadDate: string | null   // YYYY-MM-DD
  durationS: number | null
  isShort: boolean
  /** en* keys under `subtitles` — human-authored captions. */
  humanLangs: string[]
  /** en* keys under `automatic_captions` — YouTube ASR. */
  autoLangs: string[]
}

// The four Shorts named in the brief. Duration does not separate them (two run
// over 60s); portrait aspect does. Both signals are used so a mis-sized upload
// cannot silently reclassify one.
const KNOWN_SHORTS = new Set(['aRO-UdLC3L8', '5MQq_WlGpe0', 'qnyeiHLhroQ', 'Ef5yktOArxc'])

export function readIds(): string[] {
  return fs.readFileSync(IDS_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
}

export function readMeta(videoId: string): Meta | null {
  const f = path.join(META_DIR, `${videoId}.info.json`)
  if (!fs.existsSync(f)) return null
  const d = JSON.parse(fs.readFileSync(f, 'utf8'))
  const ud: string | undefined = d.upload_date
  const w = Number(d.width) || 0, h = Number(d.height) || 0
  return {
    videoId: d.id,
    url: d.webpage_url ?? `https://www.youtube.com/watch?v=${d.id}`,
    title: d.title ?? '',
    uploadDate: ud && /^\d{8}$/.test(ud) ? `${ud.slice(0, 4)}-${ud.slice(4, 6)}-${ud.slice(6, 8)}` : null,
    durationS: Number.isFinite(d.duration) ? Math.round(d.duration) : null,
    isShort: KNOWN_SHORTS.has(d.id) || (h > w && (d.duration ?? 0) <= 180),
    humanLangs: Object.keys(d.subtitles ?? {}).filter(k => k.toLowerCase().startsWith('en')),
    autoLangs: Object.keys(d.automatic_captions ?? {}).filter(k => k.toLowerCase().startsWith('en')),
  }
}

export function readAllMeta(): { metas: Meta[]; missing: string[] } {
  const metas: Meta[] = []
  const missing: string[] = []
  for (const id of readIds()) {
    const m = readMeta(id)
    if (m) metas.push(m); else missing.push(id)
  }
  return { metas, missing }
}

/** Which VTT file to load for a video, and how to label it. */
export function pickCaptionFile(m: Meta): { file: string; source: 'human' | 'asr'; engine: string; lang: string } | null {
  const exists = (lang: string) => {
    const f = path.join(RAW_DIR, `${m.videoId}.${lang}.vtt`)
    return fs.existsSync(f) ? f : null
  }
  // Human captions always beat ASR: yt-dlp writes them to the same <lang>.vtt
  // name and prefers them, so a lang listed under `subtitles` IS the human file.
  const order = (langs: string[]) => [...langs].sort((a, b) =>
    (a === 'en' ? -2 : a === 'en-GB' ? -1 : 0) - (b === 'en' ? -2 : b === 'en-GB' ? -1 : 0))
  for (const l of order(m.humanLangs)) { const f = exists(l); if (f) return { file: f, source: 'human', engine: 'youtube-manual', lang: l } }
  // 'en-orig' is the auto track in the original language; 'en' is its copy.
  for (const l of order(m.autoLangs)) { const f = exists(l); if (f) return { file: f, source: 'asr', engine: 'youtube-asr', lang: l } }
  // Fall back to whatever is actually on disk, in case info.json and files disagree.
  const any = fs.existsSync(RAW_DIR) ? fs.readdirSync(RAW_DIR).filter(f => f.startsWith(`${m.videoId}.`) && f.endsWith('.vtt')) : []
  if (any.length) return { file: path.join(RAW_DIR, any[0]), source: 'asr', engine: 'youtube-asr', lang: any[0].split('.').slice(-2)[0] }
  return null
}

function main() {
  const ids = readIds()
  const { metas, missing } = readAllMeta()
  console.log(`ids in video_ids.txt:        ${ids.length}`)
  console.log(`metadata retrieved:          ${metas.length}`)
  console.log(`metadata FAILED (report these to CCW — a typo in the ID list shows up here as a 404):`)
  console.log(missing.length ? missing.map(i => `  ${i}  https://www.youtube.com/watch?v=${i}`).join('\n') : '  (none)')

  const human = metas.filter(m => m.humanLangs.length)
  console.log(`\nhuman-authored English captions: ${human.length}`)
  console.log(`ASR-only:                        ${metas.filter(m => !m.humanLangs.length && m.autoLangs.length).length}`)
  console.log(`no English captions at all:      ${metas.filter(m => !m.humanLangs.length && !m.autoLangs.length).length}`)
  const noneList = metas.filter(m => !m.humanLangs.length && !m.autoLangs.length)
  for (const m of noneList) console.log(`  ${m.videoId}  ${m.title}`)

  console.log(`\nShorts: ${metas.filter(m => m.isShort).map(m => m.videoId).join(', ') || '(none)'}`)

  const thesis = metas.filter(m => /thesis/i.test(m.title))
  console.log(`\n=== titles containing "thesis" (case-insensitive): ${thesis.length} ===`)
  for (const m of thesis.sort((a, b) => (a.uploadDate ?? '').localeCompare(b.uploadDate ?? ''))) {
    const mins = m.durationS ? `${Math.floor(m.durationS / 60)}m${String(m.durationS % 60).padStart(2, '0')}s` : '?'
    console.log(`  ${m.videoId}  ${m.uploadDate ?? '?'}  ${mins.padStart(7)}  ${m.title}`)
  }

  // Second net: the six may not all carry the word. Show near-misses so the
  // series can be identified even if the titles are inconsistent.
  const near = metas.filter(m => !/thesis/i.test(m.title) && /\bpart\s*(one|two|three|four|five|six|[1-6])\b|restoring the english constitution/i.test(m.title))
  if (near.length) {
    console.log(`\n=== near-misses: "part N" or "restoring the english constitution" in the title, no "thesis" ===`)
    for (const m of near.sort((a, b) => (a.uploadDate ?? '').localeCompare(b.uploadDate ?? ''))) {
      const mins = m.durationS ? `${Math.floor(m.durationS / 60)}m${String(m.durationS % 60).padStart(2, '0')}s` : '?'
      console.log(`  ${m.videoId}  ${m.uploadDate ?? '?'}  ${mins.padStart(7)}  ${m.title}`)
    }
  }
}

if (require.main === module) main()
