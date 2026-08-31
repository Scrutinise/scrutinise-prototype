// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — DocumentModel → PDF, via pdf-lib.
//
// pdf-lib over pdfkit deliberately: pdfkit reads .afm font metrics off disk,
// which is exactly the kind of thing that works locally and fails in a Vercel
// serverless bundle. pdf-lib's standard fonts are embedded in the library.
//
// The cost of standard fonts is WinAnsi encoding: pdf-lib THROWS on any codepoint
// outside it, and Lex's prose is full of typographic characters (curly quotes,
// dashes, §, £). `toWinAnsi` maps those and replaces anything left over, so an
// arrow or an emoji in a briefing degrades one character rather than failing the
// whole export. (docs/CLAUDE.md §14 — encoding boundaries are made explicit.)
// ─────────────────────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Block, DocumentModel, Run, SourceRef } from './model'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 56
const CONTENT_WIDTH = A4[0] - MARGIN * 2

const INK = rgb(0.09, 0.09, 0.11)
const MUTED = rgb(0.44, 0.44, 0.47)
const LINK = rgb(0.15, 0.39, 0.92)
const RULE = rgb(0.83, 0.83, 0.85)

// The WinAnsi 0x80-0x9F typographic block, listed by codepoint so this file has
// no reliance on its own encoding surviving an editor or a pipe.
const WINANSI_EXTRA = [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
].map((c) => String.fromCodePoint(c)).join('')

// Codepoints OUTSIDE WinAnsi that pdf-lib would throw on, mapped to their
// nearest sane form, plus the whitespace oddities that break word measurement.
const CHAR_MAP: Record<string, string> = {
  '‛': "'", '−': '-', '‐': '-', '‑': '-', '‒': '-', '―': '-',
  '…': '...', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  '→': '->', '←': '<-', '⇒': '=>', '⟶': '->',
  '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '⚠': '!',
  '≤': '<=', '≥': '>=', '≈': '~', '≠': '!=',
  '─': '-', '━': '-', '│': '|', '●': '-', '▪': '-', '◦': '-', '‣': '-',
}

/** Make a string safe for a WinAnsi standard font, losing as little as possible. */
export function toWinAnsi(input: string): string {
  let out = ''
  for (const ch of input) {
    if (CHAR_MAP[ch] !== undefined) { out += CHAR_MAP[ch]; continue }
    const code = ch.codePointAt(0) ?? 0
    // Printable ASCII and the Latin-1 range WinAnsi covers.
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) { out += ch; continue }
    // WinAnsi's 0x80-0x9F block is not Latin-1: it holds the typographic set
    // (curly quotes, dashes, ellipsis, bullet, euro, dagger, trademark), which
    // is exactly what Lex's British-English prose is full of. pdf-lib encodes
    // these correctly, so they pass through as themselves.
    if (WINANSI_EXTRA.includes(ch)) { out += ch; continue }
    if (code === 0x9 || code === 0xa) { out += ' '; continue }
    // Anything else: drop it rather than fail the export. Losing one glyph is
    // recoverable; a 500 on "download my briefing" is not.
    out += ''
  }
  return out
}

interface Cursor {
  page: PDFPage
  y: number
  annots: { page: PDFPage; rect: [number, number, number, number]; url: string }[]
}

type FontSet = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }

function fontFor(fonts: FontSet, run: Run): PDFFont {
  if (run.bold && run.italic) return fonts.boldItalic
  if (run.bold) return fonts.bold
  if (run.italic) return fonts.italic
  return fonts.regular
}

/** One laid-out word: which run it came from, so styling survives wrapping. */
interface Word { text: string; run: Run; width: number; font: PDFFont }

function layout(runs: Run[], fonts: FontSet, size: number): Word[] {
  const words: Word[] = []
  for (const run of runs) {
    const font = fontFor(fonts, run)
    const text = toWinAnsi(run.text)
    // Keep the spaces: splitting on /(\s+)/ preserves the gaps between runs, so
    // "**bold**text" does not gain a space it never had.
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue
      words.push({ text: piece, run, font, width: font.widthOfTextAtSize(piece, size) })
    }
  }
  return words
}

export async function renderPdf(model: DocumentModel): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(model.title)
  if (model.subtitle) pdf.setSubject(model.subtitle)
  pdf.setProducer('Scrutinise')
  pdf.setCreator('Scrutinise')

  const fonts: FontSet = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  }

  const cur: Cursor = { page: pdf.addPage(A4), y: A4[1] - MARGIN, annots: [] }

  /**
   * ══ 25-N §5c — THE RUNNING SECTION HEADER ════════════════════════════════════
   *
   * ⚠ DRAWN BY `newPage`, WHICH IS THE ONLY PLACE A PAGE IS EVER CREATED. Stamping it at each
   * `section` block instead would put it on the first page of a section and nowhere else,
   * which is the opposite of what §5c is for — a reader leafing through a hundred pages needs
   * it on page 87, not on page 1.
   */
  let section: string | null = null
  const stampSection = () => {
    if (!section) return
    cur.page.drawText(section, {
      x: MARGIN,
      y: A4[1] - MARGIN + 6,
      size: 12,
      font: fonts.bold,
      color: MUTED,
    })
    // ⚠ THE BODY STARTS BELOW IT. Without this the first line of the page is drawn under the
    // header, which on a printed page is a page nobody can read rather than a missing header.
    cur.y -= 14
  }

  const newPage = () => { cur.page = pdf.addPage(A4); cur.y = A4[1] - MARGIN; stampSection() }
  const need = (h: number) => { if (cur.y - h < MARGIN) newPage() }

  /** Draw wrapped, styled text at the cursor and advance it. */
  function drawRuns(runs: Run[], opts: { size: number; leading: number; indent?: number; colour?: ReturnType<typeof rgb>; after?: number }) {
    const indent = opts.indent ?? 0
    const maxWidth = CONTENT_WIDTH - indent
    const words = layout(runs, fonts, opts.size)

    let line: Word[] = []
    let lineWidth = 0

    const flush = () => {
      if (!line.length) return
      need(opts.leading)
      let x = MARGIN + indent
      for (const w of line) {
        const colour = w.run.href ? LINK : (opts.colour ?? INK)
        cur.page.drawText(w.text, { x, y: cur.y - opts.size, size: opts.size, font: w.font, color: colour })
        if (w.run.href && w.text.trim()) {
          cur.annots.push({
            page: cur.page,
            rect: [x, cur.y - opts.size - 2, x + w.width, cur.y + 2],
            url: w.run.href,
          })
        }
        x += w.width
      }
      cur.y -= opts.leading
      line = []
      lineWidth = 0
    }

    for (const w of words) {
      // A leading space on a wrapped line is dropped, as in any typesetter.
      if (lineWidth + w.width > maxWidth && line.length) {
        flush()
        if (!w.text.trim()) continue
      }
      line.push(w)
      lineWidth += w.width
    }
    flush()
    cur.y -= opts.after ?? 0
  }

  function drawRule() {
    need(16)
    cur.page.drawLine({
      start: { x: MARGIN, y: cur.y - 6 },
      end: { x: A4[0] - MARGIN, y: cur.y - 6 },
      thickness: 0.75,
      color: RULE,
    })
    cur.y -= 20
  }

  function drawSources(label: string, refs: SourceRef[]) {
    drawRuns([{ text: label.toUpperCase(), bold: true }], { size: 8.5, leading: 13, colour: MUTED, after: 4 })
    for (const ref of refs) {
      need(46)
      drawRuns([{ text: ref.title, bold: true }], { size: 10, leading: 14 })
      const meta = [ref.citation, ref.date].filter(Boolean).join(' · ')
      if (meta) drawRuns([{ text: meta }], { size: 8.5, leading: 12, colour: MUTED })
      if (ref.snippet) drawRuns([{ text: ref.snippet, italic: true }], { size: 8.5, leading: 12, colour: MUTED })
      if (ref.url) drawRuns([{ text: ref.url, href: ref.url }], { size: 8.5, leading: 12, after: 8 })
      else cur.y -= 8
    }
  }

  // ── Title block ──────────────────────────────────────────────────────────
  drawRuns([{ text: model.title, bold: true }], { size: 20, leading: 25, after: 2 })
  if (model.subtitle) drawRuns([{ text: model.subtitle }], { size: 11, leading: 15, colour: MUTED })
  drawRuns(
    [{ text: `Generated ${model.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC from ${model.sourceLabel}.`, italic: true }],
    { size: 8.5, leading: 12, colour: MUTED, after: 14 },
  )

  for (const block of model.blocks) {
    switch (block.kind) {
      // 25-N §5c — a new section starts a page and changes the running header.
      case 'section': {
        section = block.title
        newPage()
        // The section's own name, once, in full size, where the section begins.
        drawRuns([{ text: block.title, bold: true }], { size: 17, leading: 24, after: 10 })
        break
      }
      case 'heading': {
        const size = block.level === 1 ? 15 : block.level === 2 ? 12.5 : 10.5
        need(size + 14)
        cur.y -= 6
        drawRuns(block.runs.map((r) => ({ ...r, bold: true })), { size, leading: size + 5, after: 3 })
        break
      }
      case 'paragraph':
        drawRuns(block.runs, { size: 10, leading: 14.5, after: 6 })
        break
      case 'bullets':
        block.items.forEach((item, i) => {
          const marker = block.ordered ? `${i + 1}. ` : '•  '
          drawRuns([{ text: marker }, ...item], { size: 10, leading: 14.5, indent: 12, after: 2 })
        })
        cur.y -= 4
        break
      case 'note':
        drawRuns([{ text: block.text, italic: true }], { size: 9.5, leading: 13.5, colour: MUTED, after: 8 })
        break
      case 'rule':
        drawRule()
        break
      case 'sources':
        drawSources(block.label, block.refs)
        break
    }
  }

  // Link annotations, added per page once the layout is settled. Without these
  // the URLs are visible but dead — the citation links are half the point.
  const byPage = new Map<PDFPage, typeof cur.annots>()
  for (const a of cur.annots) {
    const list = byPage.get(a.page) ?? []
    list.push(a)
    byPage.set(a.page, list)
  }
  for (const [page, list] of byPage) {
    const annots = list.map((a) =>
      pdf.context.register(
        pdf.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: a.rect,
          Border: [0, 0, 0],
          A: pdf.context.obj({ Type: 'Action', S: 'URI', URI: PDFString.of(a.url) }),
        }),
      ),
    )
    page.node.set(PDFName.of('Annots'), pdf.context.obj(annots))
  }

  return Buffer.from(await pdf.save())
}
