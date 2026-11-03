/**
 * heading-split.ts — decision 296 / brief 307. Split a document's full text at its own headings
 * so each heading becomes one corpus_section: "Ministerial Code › Chapter 7 › …" is addressable,
 * where one 12,000-word PDF blob is not.
 *
 * Two sources:
 *   - gov.uk HTML (html_publication bodies, detailed_guide bodies): split at <h2>/<h3>. An <h3>'s
 *     path carries its <h2>; text under an <h2> before its first <h3> is the <h2>'s own section.
 *     The heading's id="" is kept so the section's sourceUrl can carry a #fragment.
 *   - Word .docx with NO paragraph styles (Civil Service Management Code, Nov 2016: 3,501
 *     paragraphs, every one unstyled). Headings are literal numbered text — chapter "1. TAKING UP
 *     APPOINTMENT", section "1.1 Recruitment", paragraph "1.1.1 Within the…". We split at the
 *     section (N.N) level; "N.N.N" lines are paragraphs, never headings.
 *
 * Paragraph breaks are kept as "\n" (rawToText alone collapses a whole section to one line).
 */
import AdmZip from 'adm-zip'
import { rawToText } from './compile'

export interface HeadedSection {
  path: string[]          // e.g. ['Chapter 1: Ministers of the Crown', 'General principle']
  anchor: string | null   // heading id="" for a #fragment, where the source has one
  text: string            // heading path line + body, paragraphs separated by \n
}

const BLOCK_END = /<\/(p|li|h[1-6]|tr|div|blockquote|pre|table|ul|ol)>|<br\s*\/?>/gi

/** HTML fragment → text with one line per block element. */
export function htmlBlocksToText(html: string): string {
  return html
    .replace(BLOCK_END, m => `${m}\u0000`)
    .split('\u0000')
    .map(b => rawToText(b))
    .filter(Boolean)
    .join('\n')
}

/**
 * Split gov.uk body HTML at <h2>/<h3>. Returns [] when the body has fewer than `minHeadings`
 * headings — the caller then keeps the body as one section (a landing page is not a document).
 */
export function splitHtmlByHeadings(html: string, minHeadings = 3): HeadedSection[] {
  const re = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi
  const marks: { level: number; title: string; anchor: string | null; start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const title = rawToText(m[3])
    if (!title) continue
    marks.push({ level: Number(m[1]), title, anchor: /\bid="([^"]+)"/.exec(m[2])?.[1] ?? null, start: m.index, end: re.lastIndex })
  }
  if (marks.length < minHeadings) return []

  const out: HeadedSection[] = []
  const pre = htmlBlocksToText(html.slice(0, marks[0].start))
  if (pre.length >= 20) out.push({ path: ['Introduction'], anchor: null, text: pre })

  let h2: string | null = null
  for (let i = 0; i < marks.length; i++) {
    const k = marks[i]
    if (k.level === 2) h2 = k.title
    const path = k.level === 3 && h2 ? [h2, k.title] : [k.title]
    const body = htmlBlocksToText(html.slice(k.end, i + 1 < marks.length ? marks[i + 1].start : html.length))
    // An <h2> immediately followed by its first <h3> has no text of its own: no section.
    if (body.length < 20) continue
    out.push({ path, anchor: k.anchor, text: `${path.join(' › ')}\n${body}` })
  }
  return out
}

// ── .docx ─────────────────────────────────────────────────────────────────────

function docxParagraphs(buf: Buffer): string[] {
  const xml = new AdmZip(buf).readAsText('word/document.xml')
  const paras: string[] = []
  for (const p of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    // <w:tab/> inside a run is a visible gap ("Section 1.1<tab>Recruitment").
    const runs = p[0].replace(/<w:tab\/>/g, '<w:t> </w:t>')
    const text = [...runs.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(r => r[1]).join('')
    const clean = rawToText(text)
    if (clean) paras.push(clean)
  }
  return paras
}

// ── numbered documents (.docx paragraphs or PDF text lines) ───────────────────
//
// Both the Civil Service Management Code (.docx) and Managing Public Money (PDF) number their own
// text in three levels — section "3.3", paragraph "3.3.1" — and that numbering is what a reader
// cites. So we split at N.N, with these rules, learnt from the two documents:
//   chapter   "1. TAKING UP APPOINTMENT" (docx), or a line "Chapter 6" + its title line (PDF)
//   annex     a line "Annex  1.1" + title lines up to its first "A1.1.1" paragraph (MPM)
//   section   "N.N Title". In a PDF a line can be anything ("6.2 shows how this can work." is a
//             sentence that wrapped), so a PDF section heading COUNTS ONLY when an "N.N.1"
//             paragraph follows within 3 lines; lines between are the title's wrap ("3.3 Special
//             responsibilities of Accounting" / "Officers"). A docx paragraph is whole, so there
//             "N.N Title" alone counts (CSMC's "4.3 ANNEX A: …" headings have no 4.3.1 after them).
//   unnumbered  a short line directly before an "N.N.1" paragraph of a NEW N.N is that section's
//             heading — CSMC prints "Attendance During National Emergencies" with no "9.4".
// Contents-list lines ("CHAPTER 1 …", "Section 1.1 …", "Annex 1.1 … 88") are dropped from the
// Introduction, which is everything before the first heading.

const NUM_CHAPTER = /^(\d{1,2})\.\s+([A-Z][A-Z0-9 ,&'’()\-–:/]{2,})$/          // "1. TAKING UP APPOINTMENT"
const WORD_CHAPTER = /^Chapter\s+(\d{1,2})$/i                                   // "Chapter 6" (title on next line)
const ANNEX = /^Annex\s+(\d{1,2}\.\d{1,2})$/i                                   // "Annex  1.1"
const SECTION = /^(\d{1,2}\.\d{1,2})\s+(?!\d)(\S.{0,110})$/                       // "1.1 Recruitment", not "1.1.1 …"
const PARA_ONE = /^(\d{1,2}\.\d{1,2})\.1\s/                                      // "9.4.1 Special provisions…"
const CONTENTS_LINE = /^(CHAPTER\s+\d+|Section\s+\d+\.\d+|Annex\s+\d+\.\d+\s+\S)/i

export function splitNumberedLines(lines: string[], mode: 'para' | 'line', minSections = 3): HeadedSection[] {
  // A PDF's own contents list ("Chapter 4 Governance and Management 38", "Annex  3.1 The
  // Governance Statement 122") is the only place a wrapped title is whole and nothing else is
  // glued to it. Where it names a chapter/annex, that is the title; the heading's lines stay body.
  const tocChapter = new Map<string, string>()
  const tocAnnex = new Map<string, string>()
  for (const l of lines) {
    const tc = /^Chapter\s+(\d{1,2})\s+(\S.*?)\s+\d{1,4}$/i.exec(l)
    if (tc && !tocChapter.has(tc[1])) tocChapter.set(tc[1], tc[2])
    const ta = /^Annex\s+(\d{1,2}\.\d{1,2})\s+(\S.*?)\s+\d{1,4}$/i.exec(l)
    if (ta && !tocAnnex.has(ta[1])) tocAnnex.set(ta[1], ta[2])
  }
  const out: HeadedSection[] = []
  const intro: string[] = []
  let chapter: string | null = null
  let cur: { path: string[]; num: string | null; lines: string[] } | null = null
  let sections = 0
  const flush = () => {
    if (cur && cur.lines.join(' ').length >= 20) out.push({ path: cur.path, anchor: null, text: `${cur.path.join(' › ')}\n${cur.lines.join('\n')}` })
    cur = null
  }
  const open = (path: string[], num: string | null) => { flush(); sections++; cur = { path, num, lines: [] } }

  for (let i = 0; i < lines.length; i++) {
    const p = lines[i]
    const next = lines[i + 1] ?? ''

    const c = mode === 'para' ? NUM_CHAPTER.exec(p) : null
    if (c) { flush(); chapter = `${c[1]}. ${c[2]}`; cur = { path: [chapter], num: null, lines: [] }; continue }
    const wc = WORD_CHAPTER.exec(p)
    if (wc && next && !PARA_ONE.test(next)) {
      flush()
      const toc = tocChapter.get(wc[1])
      chapter = `Chapter ${wc[1]}: ${toc ?? next}`
      cur = { path: [chapter], num: null, lines: [] }
      if (!toc) i++   // no contents entry: the next line was the title
      else while (i + 1 < lines.length && i < lines.length && toc.includes(lines[i + 1]) && lines[i + 1].length > 2) i++   // skip its wrapped lines
      continue
    }

    const a = ANNEX.exec(p)
    if (a) {
      const title: string[] = []
      let j = i + 1
      while (j < lines.length && j <= i + 4 && !/^A\d/.test(lines[j])) title.push(lines[j++])
      if (j < lines.length && lines[j].startsWith(`A${a[1]}.`)) {
        chapter = null
        const toc = tocAnnex.get(a[1])
        open([`Annex ${a[1]}${toc ? ' ' + toc : title.length ? ' ' + title.join(' ') : ''}`], a[1])
        if (toc) cur!.lines.push(...title)   // title lines (+ any sub-heading glued on) kept as text
        i = j - 1
        continue
      }
    }

    const s = SECTION.exec(p)
    if (s) {
      if (mode === 'para') { open(chapter ? [chapter, `${s[1]} ${s[2].trim()}`] : [`${s[1]} ${s[2].trim()}`], s[1]); continue }
      let j = i + 1
      while (j < lines.length && j <= i + 3 && !lines[j].startsWith(`${s[1]}.1 `)) j++
      if (j < lines.length && j <= i + 3) {
        const title = [s[2].trim(), ...lines.slice(i + 1, j)].join(' ')
        open(chapter ? [chapter, `${s[1]} ${title}`] : [`${s[1]} ${title}`], s[1])
        i = j - 1
        continue
      }
    }

    const p1 = PARA_ONE.exec(next)
    if (p1 && p1[1] !== cur?.num && p.length < 100 && !/[.;:,]$/.test(p) && !/^\d/.test(p) && sections > 0) {
      open(chapter ? [chapter, `${p1[1]} ${p}`] : [`${p1[1]} ${p}`], p1[1])
      continue
    }

    if (sections === 0 && !cur) { if (!CONTENTS_LINE.test(p)) intro.push(p); continue }
    if (!cur) cur = { path: [chapter ?? 'Introduction'], num: null, lines: [] }
    cur.lines.push(p)
  }
  flush()
  if (sections < minSections) return []
  if (intro.join(' ').length >= 20) out.unshift({ path: ['Introduction'], anchor: null, text: `Introduction\n${intro.join('\n')}` })
  return out
}

/** Split an unstyled numbered .docx (CSMC) — see the rules above. [] if it is not numbered. */
export function splitNumberedDocx(buf: Buffer, minSections = 3): HeadedSection[] {
  return splitNumberedLines(docxParagraphs(buf), 'para', minSections)
}

/** Split PDF text (MPM) at its N.N numbering — see the rules above. [] if it is not numbered. */
export function splitNumberedPdfText(text: string, minSections = 3): HeadedSection[] {
  return splitNumberedLines(text.split('\n').map(l => l.trim()).filter(Boolean), 'line', minSections)
}

// ── attachment twins ──────────────────────────────────────────────────────────

/**
 * gov.uk often publishes one document twice: "Ministerial Code (PDF)" and "Ministerial Code
 * (HTML)", "PACE Code B 2023" and "PACE Code B 2023 (accessible)". Normalise away the format words
 * only — NOT whole parentheticals, or "(Welsh)" and the English original would collapse together.
 */
export function attachmentTwinKey(title: string | null): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/\b(pdf|html|accessible|version|hygyrch)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
