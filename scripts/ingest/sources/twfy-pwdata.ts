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
export async function fetchPwdataFile(corpus: string, docId: string): Promise<string | null> {
  const config = PWDATA_CORPUS_CONFIG[corpus]
  if (!config) throw new Error(`Unknown pwdata corpus: ${corpus}`)

  const url = `${BASE}/${config.dir}/${docId}.xml`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`pwdata fetch ${corpus}/${docId}: HTTP ${res.status}`)
  return await res.text()
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

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
