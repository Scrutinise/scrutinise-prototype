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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (!line.trim()) { flushAll(); continue }

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
