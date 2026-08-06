/**
 * probe-committee-phrases.ts — does the corpus actually CONTAIN the answer?
 *
 * A throwaway diagnostic for drafting committee gold questions, kept because the check it
 * performs is the one that was skipped when the current CM1–CM4 were written.
 *
 * THE PROBLEM IT EXISTS FOR. CM1–CM4 score 100% at every fusion weight, so they cannot tell
 * BM25, vector and fusion apart — a test everything passes measures nothing. The diagnosis is
 * that they ask about a committee's SUBJECT ("the causes of the collapse of Carillion") and
 * expect patterns that are themselves subject words ('carillion', 'kpmg'). Inside
 * tier='parliamentary', anything about Carillion matches, so every engine wins for free.
 *
 * The fix is to expect a committee's distinctive CONCLUSION — wording only the right report
 * uses. But that fix introduces a new failure mode: a conclusion phrase that isn't in the
 * corpus at all scores 0% at every weight, which is equally undiscriminating and looks like
 * "retrieval is broken" rather than "the answer key is wrong". So each candidate phrase is
 * probed here BEFORE the question is put to Charlie.
 *
 * Read-only. No scoring, no report, no answer key is changed by running this.
 *
 * Usage: tsx search/probe-committee-phrases.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

const TIER = 'parliamentary'

/** phrase → the question it would serve as an expected-source pattern for */
const PROBES: { phrase: string; forQuestion: string }[] = [
  { phrase: 'recklessness, hubris and greed', forQuestion: 'CQ1 Carillion — the committees\' verdict on the directors' },
  { phrase: 'cosy club', forQuestion: 'CQ1 Carillion — the verdict on the Big Four auditors' },
  { phrase: 'reverse factoring', forQuestion: 'CQ1 Carillion — the mechanism the inquiry named' },
  { phrase: 'one of the most important public health failures', forQuestion: 'CQ2 Covid — the lessons-learned verdict on lockdown delay' },
  { phrase: 'herd immunity', forQuestion: 'CQ2 Covid — the disputed strategy the report identified' },
  { phrase: 'unimaginable', forQuestion: 'CQ3 Test and Trace — the PAC\'s wording on the cost' },
  { phrase: 'test and trace', forQuestion: 'CQ3 Test and Trace — the subject anchor' },
  { phrase: 'muddled and unclear', forQuestion: 'CQ3 alternative PAC wording' },
]

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(`[probe] tier='${TIER}', table=${FTS_TABLE}\n`)

  for (const p of PROBES) {
    // BM25 the phrase, then check whether the phrase LITERALLY appears in the returned text.
    // A BM25 hit alone is not evidence: it will happily return documents sharing only the
    // common words ("club", "greed"), which is exactly the false-confidence this probe is
    // meant to prevent.
    const hits = await rankedSearch(tbl, p.phrase, { limit: 25, tier: TIER })
    const needle = p.phrase.toLowerCase()
    const literal = hits.filter((h) => `${h.sectionTitle ?? ''} ${h.body ?? ''}`.toLowerCase().includes(needle))
    const verdict = literal.length ? `✅ ${literal.length}/${hits.length} contain it literally` : `❌ 0/${hits.length} contain it literally`
    console.log(`${verdict}  "${p.phrase}"`)
    console.log(`      ${p.forQuestion}`)
    for (const h of literal.slice(0, 2)) console.log(`      → ${h.id}  ${(h.sectionTitle ?? '').slice(0, 90)}`)
    console.log()
  }
}

main().catch((e) => { console.error('[probe] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
