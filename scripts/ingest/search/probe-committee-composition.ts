/**
 * probe-committee-composition.ts — what KIND of document is in committees-reports?
 *
 * probe-committee-content.ts found that searching the committee corpora for the best-known
 * inquiries returns written evidence from academics, letters from ministers, and "Government
 * response to the Committee's Nth Report" — but not the inquiry reports' own conclusions. If
 * that generalises, the committees stream cannot be fixed by writing better questions: no
 * question about what a committee CONCLUDED is answerable from a corpus of correspondence,
 * and the fix is an ingest gap, not an answer-key gap.
 *
 * "If that generalises" is the part that needs measuring rather than asserting — four searches
 * are an anecdote. Titles in `committees-reports` are prefixed with their document kind
 * ("Correspondence: …", "Special Report: …"), so bucketing on that prefix counts the corpus
 * directly.
 *
 * Read-only.  Usage: tsx search/probe-committee-composition.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  for (const corpus of ['committees-reports', 'committees-evidence']) {
    const rows = await tbl.query()
      .where(`tier = 'parliamentary' AND corpus = '${corpus}'`)
      .select(['id', 'sectionTitle'])
      .toArray() as any[]

    const kinds = new Map<string, number>()
    let untitled = 0
    for (const r of rows) {
      const t = (r.sectionTitle ?? '').trim()
      if (!t) { untitled++; continue }
      // Title kind is the text before the first colon, when it looks like a label rather
      // than prose (short, no sentence punctuation).
      const m = t.match(/^([^:]{3,40}):/)
      const kind = m ? m[1].trim() : '(no kind prefix)'
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    }

    console.log(`\n[composition] ${corpus} — ${rows.length.toLocaleString()} rows, ${untitled.toLocaleString()} with no title`)
    const sorted = [...kinds.entries()].sort((a, b) => b[1] - a[1])
    for (const [k, n] of sorted.slice(0, 18)) {
      console.log(`   ${String(n).padStart(8)}  ${((n / rows.length) * 100).toFixed(1).padStart(5)}%  ${k}`)
    }
    if (sorted.length > 18) console.log(`   … and ${sorted.length - 18} more kinds`)
  }
}

main().catch((e) => { console.error('[composition] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
