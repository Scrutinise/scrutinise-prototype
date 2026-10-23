// ─────────────────────────────────────────────────────────────────────────────
// The briefing body is stored as markdown (it is what the panel renders with
// react-markdown). Exporting it means turning that same stored string into the
// neutral block model — a RENDERING of stored state, not a regeneration of it.
//
// Scope is exactly what the panel supports today (headings, paragraphs, bullets,
// ordered lists, rules, bold/italic, links, inline code). Anything else is
// carried through as literal text rather than silently dropped: a briefing that
// loses a sentence on export would be worse than one that shows a stray asterisk.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, Run } from './model'

/** Parse inline markdown into styled runs. */
export function parseInline(input: string): Run[] {
  const runs: Run[] = []
  let rest = input
  // Links first: their label may itself contain emphasis, handled on recursion.
  const TOKEN = /(\[([^\]]+)\]\(([^)\s]+)[^)]*\))|(\*\*|__)(.+?)\4|(\*|_)(.+?)\6|`([^`]+)`/

  while (rest.length) {
    const m = TOKEN.exec(rest)
    if (!m || m.index === undefined) {
      runs.push({ text: rest })
      break
    }
    // 235 — an underscore inside a word is a letter, not emphasis (GFM's rule): "read_section and search_corpus" would otherwise italicise
    // everything between the two names. Asterisks keep their intraword meaning.
    const delim = m[4] ?? m[6]
    if (delim?.startsWith('_') && (/\w/.test(rest[m.index - 1] ?? '') || /\w/.test(rest[m.index + m[0].length] ?? ''))) {
      runs.push({ text: rest.slice(0, m.index + delim.length) })
      rest = rest.slice(m.index + delim.length)
      continue
    }
    if (m.index > 0) runs.push({ text: rest.slice(0, m.index) })

    if (m[1]) {
      // [label](url)
      for (const r of parseInline(m[2])) runs.push({ ...r, href: m[3] })
    } else if (m[4]) {
      for (const r of parseInline(m[5])) runs.push({ ...r, bold: true })
    } else if (m[6]) {
      for (const r of parseInline(m[7])) runs.push({ ...r, italic: true })
    } else if (m[8]) {
      runs.push({ text: m[8] })
    }
    rest = rest.slice(m.index + m[0].length)
  }

  return runs.filter((r) => r.text.length > 0)
}

/** Parse a stored markdown body into blocks. */
export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')

  let paragraph: string[] = []
  let bullets: string[] = []
  let bulletsOrdered = false

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ kind: 'paragraph', runs: parseInline(paragraph.join(' ').trim()) })
    paragraph = []
  }
  const flushBullets = () => {
    if (!bullets.length) return
    blocks.push({ kind: 'bullets', items: bullets.map(parseInline), ordered: bulletsOrdered })
    bullets = []
    bulletsOrdered = false
  }
  const flushAll = () => { flushParagraph(); flushBullets() }

  // 26-T2 §4d - a GitHub-style table: a header row, a delimiter row of dashes (":" allowed), then body rows. Rows are padded to the header's width.
  const cellsOf = (l: string): string[] => {
    let s = l.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
    return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim())
  }
  // a delimiter cell is dashes with optional colons (GFM: one dash is enough, ":-:" centres). The delimiter row must contain a pipe, so a horizontal rule ("---") under a line that happens to contain a pipe is not a table.
  const isDelimiter = (l: string | undefined): boolean => !!l && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && l.includes('|')

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trimEnd()

    if (!line.trim()) { flushAll(); continue }

    if (line.includes('|') && isDelimiter(lines[i + 1])) {
      flushAll()
      const header = cellsOf(line)
      const width = header.length
      const rows: Run[][][] = []
      let j = i + 2
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
        const cells = cellsOf(lines[j])
        rows.push(Array.from({ length: width }, (_, k) => parseInline(cells[k] ?? '')))
        j++
      }
      blocks.push({ kind: 'table', header: header.map((h) => parseInline(h)), rows })
      i = j - 1
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushAll()
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, runs: parseInline(heading[2].trim()) })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushAll()
      blocks.push({ kind: 'rule' })
      continue
    }

    const unordered = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (unordered) {
      flushParagraph()
      if (bullets.length && bulletsOrdered) flushBullets()
      bullets.push(unordered[1].trim())
      continue
    }

    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ordered) {
      flushParagraph()
      if (bullets.length && !bulletsOrdered) flushBullets()
      bulletsOrdered = true
      bullets.push(ordered[1].trim())
      continue
    }

    // An indented, non-blank line directly under a list item is that item's
    // continuation, not a new paragraph. Without this a wrapped bullet silently
    // splits the list in two and the second half loses its marker.
    if (bullets.length && /^\s+\S/.test(rawLine)) {
      bullets[bullets.length - 1] += ` ${line.trim()}`
      continue
    }

    flushBullets()
    paragraph.push(line.trim())
  }

  flushAll()
  return blocks
}
