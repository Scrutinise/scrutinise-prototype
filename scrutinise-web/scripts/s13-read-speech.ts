/**
 * s13-read-speech.ts — READ A KEYED SPEECH OUT OF THE STORE AND PRINT IT AS NUMBERED PARAGRAPHS.
 *
 * SEARCH S13 §4 needs each debates question re-keyed to THE PARAGRAPH that makes the argument. A
 * paragraph cannot be chosen from a title, a snippet, or a memory of what a debate was about —
 * four wrong keys in the first gold set and 138 unsound rows in the position validation set both
 * came from claims asserted without reading the source. So this prints the stored body, numbered,
 * and the re-key is written against what it prints.
 *
 * ⚠ IT READS R2 AND NEON DIRECTLY, NEVER `runSearch()`. Keying a question on what retrieval
 * returns for it makes recall 100% by construction (BRIEF_GOLD_V2 §1 trap 4).
 *
 * ⚠ It uses `scrutinise-web/lib/r2.ts`, NOT `scripts/ingest/shared/r2-client.ts`. The two are
 * equivalent; the second is across the package boundary that failed every Vercel build for two
 * days (CLAUDE.md §20 check 0), and this sprint adds no new crossing.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/s13-read-speech.ts <sectionId> [<sectionId> …] [--full]
 *   npx tsx --env-file=.env scripts/s13-read-speech.ts --all-debates-keys
 */
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { SCOREABLE_V2 } from './gold/gold-v2-set'

export {}

const FULL = process.argv.includes('--full')
const ALL = process.argv.includes('--all-debates-keys')
const ids = ALL
  ? SCOREABLE_V2.filter((q) => q.collection === 'debates').flatMap((q) => q.keys)
  : process.argv.slice(2).filter((a) => !a.startsWith('--'))

/** Paragraphs as the store holds them: blank-line separated, then single-newline as a fallback for
 *  bodies that use one newline per paragraph. Never re-wrapped — a paragraph key has to be quotable
 *  back out of the stored text verbatim or the scoring rule cannot be applied. */
export function paragraphsOf(body: string): string[] {
  const byBlank = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  return body.split(/\n/).map((p) => p.trim()).filter(Boolean)
}

async function main() {
  if (!ids.length) { console.error('give at least one section id, or --all-debates-keys'); process.exit(1) }
  const rows = await prisma.corpusSection.findMany({
    where: { id: { in: ids } },
    select: { id: true, corpus: true, r2Key: true, wordCount: true, status: true },
  })
  const meta = new Map(rows.map((r) => [r.id, r]))
  // The speaker/date/title columns are what §3 must display beside a paragraph, so they are read
  // here too — a paragraph without its speaker is worth much less than one with.
  const extra = await prisma.$queryRawUnsafe<Array<{ id: string; sectionTitle: string | null; speaker: string | null; itemDate: string | null; sourceUrl: string | null }>>(
    `SELECT id, "sectionTitle", speaker, "itemDate"::text AS "itemDate", "sourceUrl"
     FROM corpus_sections WHERE id = ANY($1::text[])`, ids)
  const ex = new Map(extra.map((r) => [r.id, r]))

  for (const id of ids) {
    const m = meta.get(id)
    const e = ex.get(id)
    console.log('\n' + '═'.repeat(112))
    console.log(`${id}`)
    if (!m) { console.log('  ⚠⚠ NO ROW IN corpus_sections — this key does not exist.'); continue }
    console.log(`  corpus ${m.corpus}   status ${m.status}   wordCount ${m.wordCount ?? '—'}`)
    console.log(`  title  ${e?.sectionTitle ?? '(none)'}`)
    console.log(`  speaker ${e?.speaker ?? '(none)'}   date ${e?.itemDate ?? '(none)'}`)
    console.log(`  url    ${e?.sourceUrl ?? '(none)'}`)
    if (!m.r2Key) { console.log('  ⚠ no r2Key — body not retrievable from R2.'); continue }
    const body = await r2Get(m.r2Key)
    if (body == null) { console.log(`  ⚠ R2 miss on ${m.r2Key}`); continue }
    const paras = paragraphsOf(body)
    console.log(`  ${body.length} chars, ${paras.length} paragraph(s)`)
    console.log('─'.repeat(112))
    paras.forEach((p, i) => {
      const shown = FULL ? p : p.length > 700 ? p.slice(0, 700) + ` … [+${p.length - 700} chars]` : p
      console.log(`  [${String(i).padStart(3)}] (${p.split(/\s+/).length}w) ${shown}\n`)
    })
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
