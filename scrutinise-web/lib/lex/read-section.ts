// 212 (21 Oct, CCh) — READ THE WHOLE SECTION. A corpus result id (`primary-acts-2000plus:ukpga/2010/25:section-5`)
// is the primary key of `corpus_sections`, and the section's full compiled text is ONE R2 object at its `r2Key`
// (schema.prisma: "Never store compiled text in this table"). So the reader is: id → row → r2Key → r2Get. It works the
// same for every collection because the full id is the key; the id is never parsed to build an R2 key (committees ids
// differ — scripts/ingest/v32-check-report-sections.ts).
//
// Why it exists: search_corpus hands Lex a 320-character excerpt, and on 21 Oct Lex (rightly) labelled what it had not
// read rather than guessing — but it had no way to read the rest. The fix is reach, not candour: every state below is
// distinct, so "I could not read it" is only ever said with the reason the store gave.
//
// ⚠ FAILED ≠ EMPTY ≠ NOT HELD. `no-row`, `no-text`, `storage-miss` and `text` are four different claims about the corpus.

import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { LEGISLATION_CORPORA, amendingText, refFromEdgeId } from './amending-text'

/** One call returns at most this many characters; a longer section is read in pages with `from`. ≈ 7,500 tokens. */
export const READ_SECTION_PAGE_CHARS = 30_000

export type ReadSectionStatus = 'text' | 'no-row' | 'no-text' | 'storage-miss' | 'bad-id'

export interface ReadSectionResult {
  status: ReadSectionStatus
  /** The id asked for, with any vector-chunk suffix (`#3`) removed. */
  id: string
  /** The id actually read — differs only when a legislation provision was found within its parent section. */
  readId?: string
  title?: string | null
  url?: string | null
  date?: string | null
  speaker?: string | null
  wordCount?: number | null
  /** This page of the text. */
  text?: string
  /** Characters in the WHOLE held text, and where this page starts and ends. */
  totalChars?: number
  from?: number
  to?: number
  /** Set when more of the section remains: pass it as `from` to read on. */
  nextFrom?: number
  /** One plain sentence — the store's own reason on every non-text status, never composed from a guess. */
  reason: string
}

interface Row { id: string; r2Key: string | null; status: string | null; wordCount: number | null; sectionTitle: string | null; sourceUrl: string | null; itemDate: string | null; speaker: string | null }

async function rowFor(id: string): Promise<Row | null> {
  // `sectionTitle`, `sourceUrl`, `itemDate`, `speaker` exist in the table but not in the Prisma model — raw SQL.
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, "r2Key", status, "wordCount", "sectionTitle", "sourceUrl", "itemDate"::text AS "itemDate", speaker
    FROM corpus_sections WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

export async function readSection(rawId: string, opts: { from?: number; maxChars?: number } = {}): Promise<ReadSectionResult> {
  const id = rawId.trim().replace(/#\d+$/, '')
  if (id.split(':').length < 3) return { status: 'bad-id', id, reason: `“${rawId}” is not a corpus section id — those have the form collection:document:section, as search_corpus returns them.` }
  const maxChars = Math.min(Math.max(opts.maxChars ?? READ_SECTION_PAGE_CHARS, 1_000), READ_SECTION_PAGE_CHARS)
  const from = Math.max(0, Math.floor(opts.from ?? 0))

  let row = await rowFor(id)
  let readId = id
  let via = ''
  if (!row && (LEGISLATION_CORPORA as readonly string[]).includes(id.split(':')[0])) {
    // A legislation provision cited at a grain the corpus does not hold (`section-45-5` when it holds `section-45`),
    // or an instrument held only as one whole-document row: amendingText's climb finds the row that contains it.
    const ref = refFromEdgeId(id)
    const found = ref ? await amendingText(ref, { readText: false, maxSections: 1 }) : null
    const s = found?.status === 'text' ? found.sections[0] : null
    if (s && (found!.matchedAt === 'parent' || found!.matchedAt === 'document')) {
      row = await rowFor(s.id)
      readId = s.id
      via = found!.matchedAt === 'parent'
        ? ` The corpus holds “${found!.resolvedProvision}”, not “${ref!.provision}”; this is the whole of ${found!.resolvedProvision}, and the words asked for are within it.`
        : ' The instrument is held only as one whole-document row; the provision asked for is somewhere inside it.'
    } else if (found && found.status !== 'text') {
      return { status: 'no-row', id, reason: found.reason }
    }
  }
  if (!row) return { status: 'no-row', id, reason: `No section with the id “${id}” is held in the corpus.` }

  const meta = { id, readId: readId === id ? undefined : readId, title: row.sectionTitle, url: row.sourceUrl, date: row.itemDate?.slice(0, 10) ?? null, speaker: row.speaker, wordCount: row.wordCount }
  if (!row.r2Key || row.status !== 'compiled') {
    return { status: 'no-text', ...meta, reason: `The section is held but has no stored text (status: ${row.status ?? 'none'}${row.r2Key ? '' : ', no storage key'}).` }
  }
  const body = await r2Get(row.r2Key)
  if (body == null) return { status: 'storage-miss', ...meta, reason: 'The section is held, but its text would not read from storage just now.' }

  const total = body.length
  if (from >= total && total > 0) return { status: 'text', ...meta, text: '', totalChars: total, from, to: total, reason: `The section has ${total} characters; nothing remains after character ${from}.` }
  const to = Math.min(total, from + maxChars)
  const more = to < total
  return {
    status: 'text', ...meta, text: body.slice(from, to), totalChars: total, from, to, nextFrom: more ? to : undefined,
    reason: (more
      ? `Characters ${from}–${to} of ${total}; the rest remains — read on with from=${to}.`
      : from > 0 ? `Characters ${from}–${to} of ${total}: the end of the section.` : `The whole held text of the section (${total} characters).`) + via,
  }
}
