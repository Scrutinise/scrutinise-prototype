/**
 * niassembly-hansard.ts — Northern Ireland Assembly plenary Hansard via the
 * AIMS Open Data service (data.niassembly.gov.uk/hansard.asmx). Microsoft-IIS,
 * NO Cloudflare (server header verified 14 Jun 2026) — Railway-egress safe.
 * Licence: OGL v3.0 (footer: "Contains Parliamentary information licensed under
 * the Open Government Licence v3.0", verified live 14 Jun 2026).
 *
 * Endpoints:
 *   GetAllHansardReports                      → every plenary report (id + date)
 *   GetHansardComponentsByReportId?reportId=  → that report's flat component list
 *
 * Granularity mirrors pwdata/historic-hansard: one section per speaker-turn. The
 * component list is a flat, document-ordered sequence:
 *   - `Header` / `Document Title`  → running section title (level 1 = top)
 *   - `Speaker (*)`                → ComponentText is the speaker name ("Mr X:")
 *   - `Spoken Text` / `Quote` / `Bill Text` / `Question` → that turn's words
 * A turn is flushed (→ one section) when the next Speaker or Header appears.
 * ComponentText is XML-encoded HTML (e.g. "&lt;BR /&gt;") — decoded then cleaned.
 */

const BASE = 'http://data.niassembly.gov.uk/hansard.asmx'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; OGL NI Assembly Hansard)'

export interface NiReport { reportId: string; date: string } // date = YYYY-MM-DD
export interface NiSpeechItem {
  seq: number
  heading: string          // running header chain ("Top — Sub")
  speaker: string | null
  text: string             // cleaned plain text
  itemDate: string         // YYYY-MM-DD
}

async function fetchXml(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/xml' } })
  if (!res.ok) return null
  return res.text()
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)
  return m ? m[1] : null
}

// ComponentText is XML-encoded; decode the entities the API emits. &amp; last so
// an already-decoded "&" is not re-interpreted.
function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

function cleanText(raw: string): string {
  let t = xmlDecode(raw)
  t = t.replace(/<br\s*\/?>/gi, '\n')   // the embedded HTML breaks → newlines
  t = t.replace(/<[^>]+>/g, ' ')        // strip any other inline HTML
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ')
  return t.trim()
}

export async function listHansardReports(): Promise<NiReport[]> {
  const xml = await fetchXml(`${BASE}/GetAllHansardReports`)
  if (!xml) return []
  const out: NiReport[] = []
  const re = /<HansardComponent>([\s\S]*?)<\/HansardComponent>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const id = tag(m[1], 'ReportDocId')
    const date = tag(m[1], 'PlenaryDate')
    if (id && date) out.push({ reportId: id.trim(), date: date.trim().slice(0, 10) })
  }
  return out
}

const TEXT_TYPES = new Set(['Spoken Text', 'Quote', 'Bill Text', 'Question'])

// Returns the report's speaker-turn sections, or null if the components fetch
// failed (so the worker can mark the row failed and retry, not write an empty
// marker over a transient outage).
export async function fetchReportSpeeches(reportId: string, date: string): Promise<NiSpeechItem[] | null> {
  const xml = await fetchXml(`${BASE}/GetHansardComponentsByReportId?reportId=${encodeURIComponent(reportId)}`)
  if (xml === null) return null

  const items: NiSpeechItem[] = []
  let seq = 0
  let topHeading = ''
  let subHeading = ''
  let curSpeaker: string | null = null
  let buf: string[] = []

  const flush = () => {
    const text = buf.join('\n\n').trim()
    if (text) {
      const heading = [topHeading, subHeading].filter(Boolean).join(' — ')
      items.push({ seq: ++seq, heading, speaker: curSpeaker, text, itemDate: date })
    }
    buf = []
  }

  const re = /<HansardComponent>([\s\S]*?)<\/HansardComponent>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const type = (tag(block, 'ComponentType') ?? '').trim()
    const rawText = tag(block, 'ComponentText') ?? ''

    if (type === 'Header' || type === 'Document Title') {
      flush()
      const htext = cleanText(rawText)
      const level = (tag(block, 'ComponentHeader') ?? '').toLowerCase()
      if (type === 'Document Title' || level.includes('level 1')) { topHeading = htext; subHeading = '' }
      else subHeading = htext
      curSpeaker = null
      continue
    }
    if (/^Speaker \(/.test(type)) {
      flush()
      curSpeaker = cleanText(rawText).replace(/[:\s]+$/, '').trim() || null
      continue
    }
    if (TEXT_TYPES.has(type)) {
      const t = cleanText(rawText)
      if (t) buf.push(t)
      continue
    }
    // Procedure Line / Division / etc. — a speakerless procedural note. Flush the
    // current turn, then emit the note as its own speakerless section so nothing
    // in the official record is dropped.
    if (type === 'Procedure Line' || type === 'Division') {
      flush()
      const t = cleanText(rawText)
      if (t) { buf.push(t); curSpeaker = null; flush() }
      curSpeaker = null
    }
  }
  flush()
  return items
}
