/**
 * probe-committee-conclusions.ts — do candidate CONCLUSION phrases exist INSIDE the committee
 * corpora, and are they absent from the surrounding Hansard?
 *
 * Both halves matter, and the second is the one the current CM1–CM4 failed.
 *
 *   present in committees-*  → the question is answerable from this stream
 *   ABSENT from Hansard      → the question DISCRIMINATES; a debate about the same subject
 *                              cannot satisfy the answer key by accident
 *
 * That second condition is exactly what CM1 lacks. probe-committee-yield.ts measured CM1
 * returning 0/20 committee documents while GOLD_TEST_05 scores it 100% — because its expected
 * patterns ('carillion', 'reverse factoring') are matched by Hansard debates ABOUT the Carillion
 * report rather than by the report. A phrase that appears in both corpora tests subject matter;
 * only a phrase concentrated in the committee text tests the committee.
 *
 * METHOD, and why it is not a `LIKE` scan. The first version of this file ran
 * `where(... AND lower(body) LIKE '%phrase%')` over the whole parliamentary tier. That is a full
 * scan of 14.17M rows per phrase with no index to help it, and it had not returned a single line
 * after ten minutes. Instead: BM25 the phrase (which IS indexed), take a deep result set, and
 * check LITERAL containment in what comes back, bucketed by corpus. Literal containment is the
 * part that matters — a BM25 hit on a multi-word phrase can be carried entirely by its common
 * words, which is how "cosy club" looked present when the matches were 1983 debates on data
 * protection.
 *
 * This measures concentration in the retrievable top-K, not corpus-wide frequency. That is the
 * right question anyway: a phrase that exists but never ranks cannot serve as an answer key.
 *
 * Read-only.  Usage: tsx search/probe-committee-conclusions.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'

const DEPTH = 200
const isCommittee = (id: string) => id.startsWith('committees')

const CANDIDATES: { phrase: string; note: string }[] = [
  { phrase: 'recklessness, hubris and greed', note: 'CQ1 Carillion — the BEIS/Work&Pensions verdict on the directors' },
  { phrase: 'hubris and greed', note: 'CQ1 shorter variant' },
  { phrase: 'rotten corporate culture', note: 'CQ1 alternative wording' },
  { phrase: 'cosy club', note: 'CQ1 — the Big Four verdict' },
  { phrase: 'most important public health failures', note: 'CQ2 Covid — the lessons-learned verdict' },
  { phrase: 'public health failures', note: 'CQ2 shorter variant' },
  { phrase: 'gradual and incremental', note: 'CQ2 — the report on the initial covid strategy' },
  { phrase: 'unimaginable cost', note: 'CQ3 — PAC on Test and Trace' },
  { phrase: 'measurable difference', note: 'CQ3 — PAC on whether T&T met its objective' },
  { phrase: 'eye-watering', note: 'CQ3 variant' },
]

async function main() {
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)
  console.log(`[conclusions] BM25 depth-${DEPTH} over tier='parliamentary', literal containment bucketed by corpus\n`)

  for (const c of CANDIDATES) {
    const hits = await rankedSearch(tbl, c.phrase, { limit: DEPTH, tier: 'parliamentary' })
    const needle = c.phrase.toLowerCase()
    const literal = hits.filter((h) => `${h.sectionTitle ?? ''} ${h.body ?? ''}`.toLowerCase().includes(needle))
    const cm = literal.filter((h) => isCommittee(h.id))
    const hz = literal.filter((h) => !isCommittee(h.id))

    const verdict = cm.length === 0 ? '❌ NOT FOUND in committee text'
      : hz.length === 0 ? '✅ DISCRIMINATES — committee-only'
      : cm.length >= hz.length ? '⚠ mostly committee, some Hansard'
      : '❌ dominated by Hansard — would score on debates'
    console.log(`${verdict}   "${c.phrase}"`)
    console.log(`      literal hits: committees=${cm.length}  hansard=${hz.length}  (of ${hits.length} retrieved)`)
    console.log(`      ${c.note}`)
    for (const h of cm.slice(0, 2)) console.log(`      cttee → ${h.id}  ${(h.sectionTitle ?? '').slice(0, 80)}`)
    for (const h of hz.slice(0, 1)) console.log(`      hans  → ${h.id}  ${(h.sectionTitle ?? '').slice(0, 80)}`)
    console.log()
  }
}

main().catch((e) => { console.error('[conclusions] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
