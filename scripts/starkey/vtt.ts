// WebVTT parsing for the Starkey corpus.
//
// The only non-obvious part is YouTube's auto-caption format, which is a
// ROLLING display, not a list of cues. Each real cue repeats the previous
// line above its new one, and between every pair sits a 10ms filler cue
// showing the completed line:
//
//   00:07.590 --> 00:07.600   "Ladies and gentlemen, I floated these"      <- filler
//   00:07.600 --> 00:09.190   "Ladies and gentlemen, I floated these"      <- carry-over
//                             "ideas<00:08.200><c> which</c>..."           <- the new words
//
// Stored verbatim that would triple the text and put the wrong start time on
// every line. So carry-over lines are dropped and filler cues skipped. That is
// de-duplication of the display, not correction of the words: no token is ever
// substituted, and a wrong ASR word stays wrong (brief: "What NOT to do").
//
// Human-authored captions have no carry-over and no <c> tags, so the same code
// path is a no-op on them.

export interface Cue {
  startS: number
  endS: number
  text: string
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent: string) => {
    const key = ent.toLowerCase()
    if (ENTITIES[key] !== undefined) return ENTITIES[key]
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16))
    if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10))
    return m
  })
}

function stripTags(s: string): string {
  // <00:00:05.120> word timings and <c>/<c.colour> spans, plus any other
  // WebVTT span markup. Only the markup goes; the words are untouched.
  return s.replace(/<[^>]*>/g, '')
}

export function parseTimestamp(t: string): number {
  const m = t.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/)
  if (!m) throw new Error(`unparseable timestamp: ${JSON.stringify(t)}`)
  const [, h, mm, ss, ms] = m
  return (h ? Number(h) * 3600 : 0) + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, '0')) / 1000
}

const TIMING_LINE = /^\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/

export function parseVtt(raw: string): Cue[] {
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/)
  const cues: Cue[] = []
  // Last two emitted lines: two-line rolling repeats one, three-line repeats two.
  const recent: string[] = []

  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(TIMING_LINE)
    if (!m) { i++; continue }
    const startS = parseTimestamp(m[1])
    const endS = parseTimestamp(m[2])
    i++

    // A cue body ends at a TRULY empty line. YouTube pads its rolling cues with
    // a line containing a single space — treating that as the terminator drops
    // the block, and with it the real start time of the line that follows.
    const body: string[] = []
    while (i < lines.length && !TIMING_LINE.test(lines[i]) && lines[i] !== '') {
      body.push(lines[i]); i++
    }

    let text = body
      .map(l => decodeEntities(stripTags(l)).replace(/\s+/g, ' ').trim())
      .filter(l => l.length > 0)

    // Drop carry-over: leading lines identical to something just emitted.
    while (text.length && recent.includes(text[0])) text = text.slice(1)
    if (!text.length) continue

    for (const l of text) { recent.push(l); if (recent.length > 2) recent.shift() }

    const joined = text.join(' ').trim()
    if (!joined) continue
    if (endS < startS) continue
    cues.push({ startS, endS, text: joined })
  }
  return cues
}

export interface Passage { startS: number; endS: number; text: string }

/**
 * Glue consecutive cues into readable chunks. A 5-second cue is too short to
 * contain an argument; a whole transcript is too long to be a search result.
 * Target ~75s, which lands inside the brief's 60-90s with 2-5s cues.
 */
export function buildPassages(cues: Cue[], targetS = 75, maxS = 90): Passage[] {
  const out: Passage[] = []
  let cur: Cue[] = []
  const flush = () => {
    if (!cur.length) return
    out.push({ startS: cur[0].startS, endS: cur[cur.length - 1].endS, text: cur.map(c => c.text).join(' ') })
    cur = []
  }
  for (const c of cues) {
    if (cur.length && c.endS - cur[0].startS > maxS) flush()
    cur.push(c)
    if (c.endS - cur[0].startS >= targetS) flush()
  }
  flush()
  return out
}

export function wordCount(cues: Cue[]): number {
  return cues.reduce((n, c) => n + c.text.split(/\s+/).filter(Boolean).length, 0)
}
