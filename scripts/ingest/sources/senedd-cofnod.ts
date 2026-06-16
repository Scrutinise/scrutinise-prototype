/**
 * senedd-cofnod.ts — Senedd Cymru / Welsh Parliament Cofnod (Record of
 * Proceedings), Plenary, via record.senedd.wales (V25 §2).
 *
 * Licence: Crown copyright, reproducible under the Open Government Licence v3.0
 * with source acknowledgement (Charlie verified the Senedd copyright page —
 * senedd.wales/commission/access-to-information/copyright/ — V25 brief §2).
 * licence='ogl-3.0' (see shared/licence-map.ts; the V24 "ogl" footer false
 * positive from "g**oogl**e" is superseded by the explicit page verification).
 *
 * Host: record.senedd.wales — custom .NET site, NO Cloudflare. Each plenary is a
 * transcript page at /Plenary/{meetingId}; the generic /Meeting/{id} 302-redirects
 * to /Plenary/{id} (plenary) or /Committee/{id} (committee). Enumeration walks the
 * meeting-id space and keeps the ids that redirect to /Plenary/ — the on-site
 * search is JS-driven and unreliable for bulk listing.
 *
 * Granularity mirrors pwdata/niassembly: one section per speaker contribution.
 * The page is bilingual — each contribution carries `verbatim` (as spoken, Welsh
 * or English) and, when spoken in Welsh, an English `translation`. We take the
 * ENGLISH text: translation if present, else verbatim (English-spoken turns have
 * no translation div). `subHeading` items carry the running section heading.
 */

const BASE = 'https://record.senedd.wales'
const UA = 'Mozilla/5.0 (compatible; Scrutinise-Ingest/1.0; +https://scrutinise.org; OGL Senedd Cofnod)'

export interface SeneddContribution {
  seq: number
  heading: string           // running subHeading chain
  speaker: string | null
  role: string | null       // memberTitle (e.g. "Llywydd")
  text: string              // English plain text
}
export interface SeneddPlenary { meetingId: number; date: string; items: SeneddContribution[] }

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

// Strip tags from an HTML fragment → clean single/multi-line text.
function htmlToText(frag: string): string {
  let t = frag.replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<[^>]+>/g, ' ')
  t = decodeEntities(t)
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
  t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ')
  return t.trim()
}

// Returns 'plenary' (id redirects to /Plenary/), 'other' (committee/200 page), or
// 'gap' (404). Uses a redirect-only request — no body fetched.
export async function classifyMeeting(meetingId: number): Promise<'plenary' | 'other' | 'gap'> {
  let res: Response
  try {
    res = await fetch(`${BASE}/Meeting/${meetingId}`, {
      headers: { 'User-Agent': UA }, redirect: 'manual',
    })
  } catch { return 'gap' }
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location') ?? ''
    if (/\/Plenary\//i.test(loc)) return 'plenary'
    return 'other'
  }
  if (res.status === 404) return 'gap'
  return 'other'
}

// Pull the English text from a contributionText fragment: prefer the translation
// div, fall back to verbatim (English-spoken turns have no translation).
function contributionEnglish(block: string): string {
  const trans = /<div class="translation"\s*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(block)
    ?? /<div class="translation"\s*>([\s\S]*?)<\/div>/i.exec(block)
  if (trans) {
    const t = htmlToText(trans[1])
    if (t) return t
  }
  const verb = /<div class="verbatim\s*"\s*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(block)
    ?? /<div class="verbatim\s*"\s*>([\s\S]*?)<\/div>/i.exec(block)
  if (verb) return htmlToText(verb[1])
  // No bilingual wrapper — take the whole contributionText.
  const ct = /<div class="contributionText"\s*>([\s\S]*?)$/i.exec(block)
  return ct ? htmlToText(ct[1]) : ''
}

function firstTag(block: string, cls: string): string | null {
  const m = new RegExp(`<span class="${cls}"\\s*>([\\s\\S]*?)<\\/span>`, 'i').exec(block)
  return m ? htmlToText(m[1]) || null : null
}

// Fetch + parse one plenary transcript. Returns null on fetch failure (worker
// marks the row failed → retried, not a false empty-marker).
export async function fetchPlenary(meetingId: number): Promise<SeneddPlenary | null> {
  let html: string
  try {
    const res = await fetch(`${BASE}/Plenary/${meetingId}`, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    html = await res.text()
  } catch { return null }

  const dateM = /<title>\s*Plenary\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(html)
  const date = dateM ? `${dateM[3]}-${dateM[2]}-${dateM[1]}` : ''

  // Split into itemContent blocks. Each starts with
  // <div class="itemContent {type}" id="C{n}">. We slice between successive
  // item starts so each block holds exactly one contribution's markup.
  const startRx = /<div class="itemContent ([a-zA-Z]+)" id="C\d+">/g
  const starts: Array<{ idx: number; type: string }> = []
  let sm: RegExpExecArray | null
  while ((sm = startRx.exec(html)) !== null) starts.push({ idx: sm.index, type: sm[1] })

  const items: SeneddContribution[] = []
  let heading = ''
  let seq = 0
  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i].idx, i + 1 < starts.length ? starts[i + 1].idx : html.length)
    const type = starts[i].type

    if (type === 'subHeading' || type === 'heading') {
      const h = contributionEnglish(block)
      if (h) heading = h
      continue
    }

    const speaker = firstTag(block, 'name')
    const roleM = /<div class="memberTitle">\s*<span>([\s\S]*?)<\/span>/i.exec(block)
    const role = roleM ? htmlToText(roleM[1]) || null : null
    const text = contributionEnglish(block)
    if (!text) continue
    items.push({ seq: ++seq, heading, speaker, role, text })
  }

  return { meetingId, date, items }
}
