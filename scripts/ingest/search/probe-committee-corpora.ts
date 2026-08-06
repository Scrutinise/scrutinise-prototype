/**
 * probe-committee-corpora.ts — WHICH corpora sit under tier='parliamentary', and is any of
 * them actually select-committee material?
 *
 * Written because probe-committee-phrases.ts found that distinctive select-committee REPORT
 * wording ("recklessness, hubris and greed", "one of the most important public health
 * failures") returns zero literal matches in tier='parliamentary', while the hits that do come
 * back are 1940s debates and PMQs. That is the signature of a corpus containing Hansard but
 * not committee reports — in which case the committees stream's 100%-at-every-weight score is
 * not a bad answer key, it is a stream with no distinguishing content behind it, and drafting
 * better questions would not fix it.
 *
 * Distinguishing those two diagnoses matters: one is answered by rewriting four questions, the
 * other by an ingest. So count the rows per corpus rather than inferring from search hits.
 *
 * Read-only.  Usage: tsx search/probe-committee-corpora.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  // Cheap, exact: group by corpus over the tier, reading only the corpus column.
  const rows = await tbl.query().where(`tier = 'parliamentary'`).select(['corpus']).toArray() as any[]
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.corpus, (counts.get(r.corpus) ?? 0) + 1)

  console.log(`[probe] tier='parliamentary' — ${rows.length.toLocaleString()} rows across ${counts.size} corpora\n`)
  for (const [c, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(12)}  ${c}`)
  }

  // And the whole-table picture, so "is there a committee corpus anywhere?" is answered too —
  // it may exist under a different tier, which would be a routing bug rather than a gap.
  const all = await tbl.query().select(['tier', 'corpus']).toArray() as any[]
  const byTier = new Map<string, Map<string, number>>()
  for (const r of all) {
    if (!byTier.has(r.tier)) byTier.set(r.tier, new Map())
    const m = byTier.get(r.tier)!
    m.set(r.corpus, (m.get(r.corpus) ?? 0) + 1)
  }
  console.log(`\n[probe] every tier/corpus in ${FTS_TABLE} (${all.length.toLocaleString()} rows):`)
  for (const [t, m] of [...byTier.entries()].sort()) {
    console.log(`\n  tier='${t}'`)
    for (const [c, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(12)}  ${c}`)
  }

  const committeeish = [...byTier.entries()].flatMap(([t, m]) => [...m.keys()].filter((c) => /committee|select|inquiry|evidence|pac\b/i.test(c)).map((c) => `${t}/${c}`))
  console.log(`\n[probe] corpora whose NAME suggests committee content: ${committeeish.length ? committeeish.join(', ') : 'NONE'}`)
}

main().catch((e) => { console.error('[probe] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
