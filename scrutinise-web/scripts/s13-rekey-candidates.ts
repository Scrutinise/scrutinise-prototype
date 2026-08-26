/**
 * s13-rekey-candidates.ts — SEARCH S13 §4. CANDIDATE PARAGRAPHS FOR THE DEBATES RE-KEY.
 *
 * ⚠⚠ THIS SCRIPT DOES NOT CHOOSE A KEY. It prints candidate passages out of the STORED body of
 * each currently-keyed speech, ranked by how many of the question's own content terms they carry,
 * so that a human choice is made against text rather than against a memory of what a debate was
 * about. Four wrong keys in the first gold set and 138 unsound rows in the position validation set
 * both came from claims asserted without reading the source; the point of this file is that the
 * source is on the page when the claim is written.
 *
 * ⚠ IT NEVER CALLS `runSearch()`. Keying a question on what retrieval returns makes recall 100% by
 * construction and measures nothing (BRIEF_GOLD_V2 §1 trap 4). Bodies come from R2, metadata from
 * Neon.
 *
 * ⚠ TERM RANKING IS A READING AID, NOT A SELECTION RULE. The passage that makes an argument is
 * often not the one with the most keyword hits — the whole reason this sprint exists is that
 * keyword density and "answers the question" are different things. So the head and the tail of
 * every speech are printed as well, unranked, and the ranking is labelled as an ordering of
 * candidates rather than a verdict.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/s13-rekey-candidates.ts [--q Q1,Q9] [--top 3] [--width 700]
 */
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { SCOREABLE_V2 } from './gold/gold-v2-set'
import { contentTerms, coverageOf } from '../lib/lex/term-coverage'

export {}

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : dflt
}
const ONLY = (() => { const v = arg('--q', ''); return v ? new Set(v.split(',')) : null })()
const TOP = parseInt(arg('--top', '3'), 10)
const WIDTH = parseInt(arg('--width', '700'), 10)

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Non-overlapping windows over the normalised body, snapped forward to a sentence end so each
 *  candidate reads as prose rather than as a slice. */
function windows(body: string, width: number): Array<{ i: number; start: number; text: string }> {
  const t = norm(body)
  const out: Array<{ i: number; start: number; text: string }> = []
  let start = 0, i = 0
  while (start < t.length) {
    let end = Math.min(start + width, t.length)
    if (end < t.length) {
      const dot = t.indexOf('. ', end)
      if (dot >= 0 && dot - end < 220) end = dot + 1
      else { const sp = t.lastIndexOf(' ', end); if (sp > start) end = sp }
    }
    out.push({ i: i++, start, text: t.slice(start, end).trim() })
    start = end
  }
  return out
}

async function main() {
  const qs = SCOREABLE_V2.filter((q) => q.collection === 'debates' && (!ONLY || ONLY.has(q.id)))
  const ids = qs.flatMap((q) => q.keys)
  const rows = await prisma.corpusSection.findMany({
    where: { id: { in: ids } }, select: { id: true, r2Key: true, wordCount: true },
  })
  const meta = new Map(rows.map((r) => [r.id, r]))
  const extra = await prisma.$queryRawUnsafe<Array<{ id: string; sectionTitle: string | null; speaker: string | null; itemDate: string | null }>>(
    `SELECT id, "sectionTitle", speaker, "itemDate"::text AS "itemDate" FROM corpus_sections WHERE id = ANY($1::text[])`, ids)
  const ex = new Map(extra.map((r) => [r.id, r]))

  for (const q of qs) {
    console.log('\n' + '█'.repeat(112))
    console.log(`${q.id}  ${q.query}`)
    const terms = contentTerms(q.query)
    console.log(`  content terms: ${terms.join(' ')}`)
    for (const id of q.keys) {
      const m = meta.get(id); const e = ex.get(id)
      console.log('\n' + '═'.repeat(112))
      console.log(`  KEY ${id}`)
      console.log(`  ${e?.speaker ?? '(no speaker)'} · ${e?.itemDate ?? '(no date)'} · ${e?.sectionTitle ?? '(no title)'} · ${m?.wordCount ?? '?'}w`)
      if (!m?.r2Key) { console.log('  ⚠ no r2Key'); continue }
      const body = await r2Get(m.r2Key)
      if (body == null) { console.log(`  ⚠ R2 miss on ${m.r2Key}`); continue }
      const t = norm(body)
      const ws = windows(t, WIDTH)
      const scored = ws
        .map((w) => ({ w, cov: coverageOf({ title: '', citation: '', snippet: w.text } as any, terms) }))
        .sort((a, b) => b.cov - a.cov || a.w.i - b.w.i)
      console.log(`  ${t.length} chars → ${ws.length} window(s) of ~${WIDTH}`)
      console.log(`  ── top ${Math.min(TOP, scored.length)} by term coverage (⚠ an ordering of CANDIDATES, not a verdict) ──`)
      for (const s of scored.slice(0, TOP)) {
        console.log(`\n  [w${s.w.i}] coverage ${(s.cov * 100).toFixed(0)}%  offset ${s.w.start}/${t.length} (${Math.round((s.w.start / t.length) * 100)}% in)`)
        console.log(`      ${s.w.text}`)
      }
      console.log(`\n  ── head (w0), unranked, because the argument is often not the densest window ──`)
      console.log(`      ${ws[0].text}`)
      if (ws.length > 1) {
        console.log(`\n  ── tail (w${ws.length - 1}) ──`)
        console.log(`      ${ws[ws.length - 1].text}`)
      }
    }
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
