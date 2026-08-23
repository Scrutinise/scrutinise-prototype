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

// Returns 'plenary' (id redirects to /Plenary/), 'other' (committee/200 page),
// 'gap' (genuine 404), or 'error' (transient failure after retries — the caller
// MUST retry these, never treat as not-a-plenary). Uses a redirect-only request
// — no body fetched. WHY the retry: a high-throughput id scan provokes host
// throttling (timeouts / 429 / 5xx); conflating those with 'gap' silently
// false-negatives real plenaries (the V25 first run missed id 5000 this way).
export async function classifyMeeting(meetingId: number, retries = 3): Promise<'plenary' | 'other' | 'gap' | 'error'> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}/Meeting/${meetingId}`, {
        headers: { 'User-Agent': UA }, redirect: 'manual',
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location') ?? ''
        return /\/Plenary\//i.test(loc) ? 'plenary' : 'other'
      }
      if (res.status === 404) return 'gap'
      if (res.status === 200 || (res.status >= 300 && res.status < 400)) return 'other'
      // 429/5xx → transient; back off and retry
    } catch { /* network error → transient; retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
  }
  return 'error'
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE SELECTION (INGEST-LABELS §4.3)
//
// ⚠ THE PREVIOUS RULE HERE WAS BACKWARDS, AND ITS COMMENT STATED THE PREMISE THAT MADE IT SO:
// *"prefer the translation div, fall back to verbatim (English-spoken turns have no translation)"*.
// English-spoken turns DO have a translation — into Welsh. The Cofnod publishes every contribution
// twice:
//     <div class="verbatim">     AS SPOKEN — either language
//     <div class="translation">  THE OTHER LANGUAGE
// so preferring `translation` stores the WELSH rendering of every English speech. Measured over
// 12 plenaries, 2,050 contributions with both divs and a confident reading: 80.0% were spoken in
// English, so 80.0% were being stored in Welsh. That is the whole of the "a Welsh devolved question
// is not askable in English" finding — it is a defect here, not a property of the record.
//
// ⚠ AND "JUST TAKE VERBATIM INSTEAD" IS ALSO WRONG: it stores Welsh for the 20.0% actually spoken
// in Welsh. NEITHER div is the English one. The language has to be decided per div, which is what
// this does.
//
// Ambiguity is resolved toward `verbatim` DELIBERATELY: a passage too short to classify is most
// often a one-line procedural turn, and verbatim is the as-spoken text, correct for the 80% spoken
// in English. That makes the fallback a strict improvement on the old default rather than a coin
// toss. Welsh-language retention is deliberately NOT attempted here — we store one language, and
// the brief's scope is that it should be the English one.

/** Welsh and English function words. Function words, not content words: they are the highest-
 *  frequency tokens in each language and do not overlap, so the ratio separates cleanly without a
 *  dictionary. */
const CY_STOP = new Set(['yr', 'yn', 'y', 'ac', 'mae', 'bod', 'wedi', 'hynny', 'ddim', 'sydd', 'ni', 'fod', 'gan', 'gyda', 'iawn', 'rwy', 'yng', 'ei', 'eu', 'fel', 'hyn', 'oedd', 'byddai', 'am', 'yna', 'hefyd', 'ond', 'felly', 'nhw', 'ydy', 'ydw', 'sy'])
const EN_STOP = new Set(['the', 'of', 'and', 'that', 'is', 'to', 'in', 'we', 'it', 'for', 'have', 'are', 'this', 'be', 'on', 'with', 'as', 'was', 'not', 'which', 'you', 'they', 'there', 'would', 'has', 'but', 'from'])

/** 'cy' | 'en' | '?' — abstains rather than guessing on a short or balanced passage. Exported so
 *  `check-senedd-labels.ts` can assert it against real bodies rather than a fixture. */
export function classifyLanguage(text: string): 'cy' | 'en' | '?' {
  const words = text.toLowerCase().match(/[a-zâêîôûŵŷáéíóúàèìòùäëïöü']+/g) ?? []
  if (words.length < 20) return '?'
  let cy = 0, en = 0
  for (const w of words) { if (CY_STOP.has(w)) cy++; if (EN_STOP.has(w)) en++ }
  if (cy === en) return '?'
  return cy > en ? 'cy' : 'en'
}

function divText(block: string, cls: string): string {
  const m = new RegExp(`<div class="${cls}\\s*"\\s*>`, 'i').exec(block)
  if (!m) return ''
  // Cut at the next sibling wrapper rather than at the first </div>: these fragments contain
  // nested <p>/<div> and a lazy `([\s\S]*?)</div>` truncates a long contribution at its first
  // inner close tag.
  const rest = block.slice(m.index + m[0].length)
  const cut = rest.split(/<div class="(?:verbatim|translation|contributionText)/i)[0]
  return htmlToText(cut)
}

/** The ENGLISH text of a contribution block, whichever div holds it. */
function contributionEnglish(block: string): string {
  const verbatim = divText(block, 'verbatim')
  const translation = divText(block, 'translation')
  const lv = verbatim ? classifyLanguage(verbatim) : '?'
  const lt = translation ? classifyLanguage(translation) : '?'
  if (lv === 'en') return verbatim
  if (lt === 'en') return translation
  // Neither classified as English: one may be Welsh and confident, in which case take the other.
  if (lv === 'cy' && translation) return translation
  if (lt === 'cy' && verbatim) return verbatim
  // Too short to tell. Verbatim is as-spoken and is English for 80% of contributions.
  if (verbatim) return verbatim
  if (translation) return translation
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
  // ─────────────────────────────────────────────────────────────────────────
  // HEADINGS (INGEST-LABELS §4.2). The Cofnod publishes TWO levels and this parser knew about one.
  //
  //   agendaItem  "3. Statement by the Minister for Health and Social Services: Coronavirus Update"
  //   subHeading  "Coronavirus Restrictions"            (a topic within the agenda item)
  //
  // ⚠ `agendaItem` was not in the heading branch, so it fell through and was stored AS A SPEECH —
  // and, worse, the running `subHeading` was never reset when the agenda moved on. Every speech
  // under an agenda item with no sub-headings inherited the last sub-heading of the PREVIOUS item.
  // That is how two speeches about oesophageal and stomach cancers came to be titled "Senedd
  // Plenary: The 20 mph Speed Limit" (GOLD V2), and measured over 12 plenaries it puts the WRONG
  // heading on 1,609 of 2,915 judged contributions — 55.2%.
  //
  // ⚠ An agendaItem RESETS the sub-heading. Carrying it forward is the bug; the reset is the fix.
  let agenda = ''
  let sub = ''
  let seq = 0
  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i].idx, i + 1 < starts.length ? starts[i + 1].idx : html.length)
    const type = starts[i].type

    if (type === 'agendaItem') {
      const h = contributionEnglish(block)
      if (h) { agenda = h; sub = '' }
      continue
    }
    if (type === 'subHeading' || type === 'heading') {
      const h = contributionEnglish(block)
      if (h) sub = h
      continue
    }
    // Both levels, most specific last, so the title reads as a path and a speech under an agenda
    // item with no sub-heading is labelled by the agenda item rather than by a stale neighbour.
    const heading = [agenda, sub].filter(Boolean).join(' — ')

    const speaker = firstTag(block, 'name')
    const roleM = /<div class="memberTitle">\s*<span>([\s\S]*?)<\/span>/i.exec(block)
    const role = roleM ? htmlToText(roleM[1]) || null : null
    const text = contributionEnglish(block)
    if (!text) continue
    items.push({ seq: ++seq, heading, speaker, role, text })
  }

  return { meetingId, date, items }
}
