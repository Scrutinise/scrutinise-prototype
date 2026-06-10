// TWFY pwdata — bulk Hansard XML, freely accessible, no authentication.
// Directory: https://www.theyworkforyou.com/pwdata/scrapedxml/
//
// Actual directory names and filename prefixes (verified 4 Jun 2026):
//   debates/    → debates{date}{letter}.xml   (1919–present, 19,999 files)
//   wrans/      → answers{date}.xml           (2001–present, 6,857 files)
//   westminhall/ → westminster{date}{letter}.xml (2000–present, 3,932 files)
//   lordspages/ → daylord{date}{letter}.xml   (1999–present, 5,663 files)
//
// XML formats:
//   Debates/Lords/WH: <publicwhip> → <major-heading>, <speech speakername="..."><p>...</p></speech>
//   Written Answers: <publicwhip> → <major-heading>, <ques speakername="..."><p>...</p></ques>, <reply>

const BASE = 'https://www.theyworkforyou.com/pwdata/scrapedxml'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

interface PwdataCorpusConfig {
  dir: string
  prefix: string
}

// Maps ingest_queue corpus name to directory path and filename prefix.
export const PWDATA_CORPUS_CONFIG: Record<string, PwdataCorpusConfig> = {
  'pwdata-debates':     { dir: 'debates',     prefix: 'debates' },
  'pwdata-lords':       { dir: 'lordspages',  prefix: 'daylord' },
  'pwdata-wrans':       { dir: 'wrans',       prefix: 'answers' },
  'pwdata-westminster': { dir: 'westminhall', prefix: 'westminster' },
  'pwdata-lordswrans':  { dir: 'lordswrans',  prefix: 'lordswrans' },
  'pwdata-wms':         { dir: 'wms',         prefix: 'ministerial' },
  'pwdata-lordswms':    { dir: 'lordswms',    prefix: 'lordswms' },
}

export interface PwdataFileRef {
  docId: string  // filename without .xml extension (e.g. "debates2026-06-03a")
  url: string
}

// Fetch directory listing and return all XML file refs for a corpus.
export async function listPwdataFiles(corpus: string): Promise<PwdataFileRef[]> {
  const config = PWDATA_CORPUS_CONFIG[corpus]
  if (!config) throw new Error(`Unknown pwdata corpus: ${corpus}`)

  const res = await fetch(`${BASE}/${config.dir}/`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`pwdata listFiles ${corpus}: HTTP ${res.status}`)

  const html = await res.text()
  const hrefPattern = /href="([^"?#]+\.xml)"/g
  const files: PwdataFileRef[] = []
  let m
  while ((m = hrefPattern.exec(html)) !== null) {
    const filename = m[1]
    if (!filename.startsWith(config.prefix)) continue
    const docId = filename.slice(0, -4) // strip .xml
    files.push({ docId, url: `${BASE}/${config.dir}/${filename}` })
  }
  return files
}

// Fetch a single pwdata XML file. Returns null on 404 (no sitting that day).
// Decodes per the XML declaration: pre-~2006 files declare ISO-8859-1, and
// res.text() (always UTF-8) silently mojibakes their £/accented characters.
export async function fetchPwdataFile(corpus: string, docId: string): Promise<string | null> {
  const config = PWDATA_CORPUS_CONFIG[corpus]
  if (!config) throw new Error(`Unknown pwdata corpus: ${corpus}`)

  const url = `${BASE}/${config.dir}/${docId}.xml`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`pwdata fetch ${corpus}/${docId}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const head = buf.subarray(0, 200).toString('latin1')
  const decl = /encoding="([^"]+)"/i.exec(head)
  const latin = decl != null && /iso-?8859|latin|windows-1252/i.test(decl[1])
  return buf.toString(latin ? 'latin1' : 'utf8')
}

// ── Per-item parsing (V18 granularity migration) ─────────────────────────────
// One item per speech (debates/lords/westminster/wms) or per question+answer
// exchange (wrans/lordswrans), carrying the heading context, speaker, and
// canonical URL where the XML provides one.

export interface PwdataItem {
  seq: number               // 1-based position in file — stable sectionRef
  heading: string | null    // major-heading (e.g. department / debate title)
  minorHeading: string | null
  speaker: string | null    // speech speaker, or the asker for Q&A items
  url: string | null        // canonical parliament URL from the XML, if any
  text: string              // plain text; Q&A exchanges are combined
}

const BLOCK_RE = /<(major-heading|minor-heading|speech|ques|reply)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs)
  if (!m || !m[1]) return null
  return m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim() || null
}

export function parsePwdataItems(xml: string): PwdataItem[] {
  const items: PwdataItem[] = []
  let major: string | null = null
  let minor: string | null = null
  let seq = 0

  // Pending question — replies are appended until the next ques/heading flushes it
  let qa: { speaker: string | null; url: string | null; parts: string[]; heading: string | null; minorHeading: string | null } | null = null

  const flushQa = () => {
    if (!qa) return
    const text = qa.parts.join('\n\n')
    if (text.length > 10) {
      items.push({ seq: ++seq, heading: qa.heading, minorHeading: qa.minorHeading, speaker: qa.speaker, url: qa.url, text })
    }
    qa = null
  }

  let m: RegExpExecArray | null
  while ((m = BLOCK_RE.exec(xml)) !== null) {
    const tag = m[1]
    const attrs = m[2] ?? ''
    const body = m[3] ?? ''

    if (tag === 'major-heading') {
      flushQa()
      major = stripTags(body) || null
      minor = null
    } else if (tag === 'minor-heading') {
      flushQa()
      minor = stripTags(body) || null
    } else if (tag === 'speech') {
      flushQa()
      const text = stripTags(body)
      if (text.length > 20) {
        items.push({ seq: ++seq, heading: major, minorHeading: minor, speaker: attr(attrs, 'speakername'), url: attr(attrs, 'url'), text })
      }
    } else if (tag === 'ques') {
      flushQa()
      const speaker = attr(attrs, 'speakername')
      const text = stripTags(body)
      if (text.length > 10) {
        qa = {
          speaker, url: attr(attrs, 'url'), heading: major, minorHeading: minor,
          parts: [speaker ? `Q (${speaker}): ${text}` : `Q: ${text}`],
        }
      }
    } else if (tag === 'reply') {
      const speaker = attr(attrs, 'speakername')
      const text = stripTags(body)
      if (text.length <= 10) continue
      const part = speaker ? `A (${speaker}): ${text}` : `A: ${text}`
      if (qa) {
        qa.parts.push(part)
      } else {
        // reply with no preceding ques (rare) — standalone item
        items.push({ seq: ++seq, heading: major, minorHeading: minor, speaker, url: attr(attrs, 'url'), text: part })
      }
    }
  }
  flushQa()
  return items
}

// Extract plain text from pwdata XML.
// Handles both formats: <speech> (debates/lords/westminster) and <ques>/<reply> (wrans).
export function parsePwdataXml(xml: string): string {
  const parts: string[] = []

  // Debates format — speech elements contain <p> body text
  const speechPattern = /<speech[^>]*speakername="([^"]*)"[^>]*>([\s\S]*?)<\/speech>/g
  let m
  while ((m = speechPattern.exec(xml)) !== null) {
    const speaker = m[1]
    const text = stripTags(m[2])
    if (text.length > 20) {
      parts.push(speaker ? `${speaker}: ${text}` : text)
    }
  }

  // Written answers format — ques elements hold the question text
  const quesPattern = /<ques[^>]*speakername="([^"]*)"[^>]*>([\s\S]*?)<\/ques>/g
  while ((m = quesPattern.exec(xml)) !== null) {
    const speaker = m[1]
    const text = stripTags(m[2])
    if (text.length > 10) {
      parts.push(speaker ? `Q (${speaker}): ${text}` : text)
    }
  }

  // Written answers format — reply elements hold the minister's response
  const replyPattern = /<reply[^>]*speakername="([^"]*)"[^>]*>([\s\S]*?)<\/reply>/g
  while ((m = replyPattern.exec(xml)) !== null) {
    const speaker = m[1]
    const text = stripTags(m[2])
    if (text.length > 10) {
      parts.push(speaker ? `A (${speaker}): ${text}` : text)
    }
  }

  return parts.join('\n\n')
}

// Named entities the pwdata DOCTYPE declares (subset that matters for text
// fidelity — £, dashes, quotes, accents). Blanking these loses meaning
// ("&pound;47.8 million" → " 47.8 million").
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  pound: '£', euro: '€', sect: '§', copy: '©', reg: '®', deg: '°', middot: '·',
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  frac12: '½', frac14: '¼', frac34: '¾',
  agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', ccedil: 'ç',
  egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  oacute: 'ó', ocirc: 'ô', ouml: 'ö', oslash: 'ø',
  uacute: 'ú', uuml: 'ü', Ouml: 'Ö', szlig: 'ß',
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
