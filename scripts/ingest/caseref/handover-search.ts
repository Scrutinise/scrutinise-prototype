/**
 * handover-search.ts — §3. The measurement CC-Search needs, and NOT the change itself.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §3 is explicit: "CC-Ingest provides the data and the measurement; CC-Search makes the change."
 * So this file edits nothing in `scrutinise-web/lib/lex/`. It answers one question with numbers:
 *
 *   **if the reference records were retrievable, would the ten probes be fixed?**
 *
 * ── WHAT IT PRINTS, AND WHAT EACH HALF PROVES ──────────────────────────────────────────────────
 *   BEFORE   the live gateway today, re-measured rather than quoted: 10/10 absent, 3/10 returning a
 *            DIFFERENT case with a similar name.
 *   AFTER    a matcher run over the reference records only. ⚠ THIS IS A SIMULATION OF RANKING, NOT
 *            THE SHIPPED RANKING. It proves the DATA is sufficient — that a record exists, that it
 *            is findable by the words a user types, and that it is not out-competed by its
 *            namesakes WITHIN this collection. It does not prove the router will surface it, and it
 *            must not be reported as if it did.
 *
 * ⚠ THE DECOYS ARE NOT SUPPRESSED AND MUST NOT BE. *Mrs M Coughlan v Brookes Jordan Ltd* is a real
 * employment case and somebody may want it. The fix is ranking and labelling, not deletion.
 *
 * Usage: tsx caseref/handover-search.ts
 */
import fs from 'fs'
import path from 'path'
import { OUT } from '../c2/db'
import { normaliseCitation } from './citations'

const n = (x: number) => x.toLocaleString('en-GB')

interface Rec { citation: string; observedName: string | null; names: Array<{ name: string; seen: number }>; year: number; held: string; citedBy: { documents: number }; discussion: any[]; court: string | null }

/**
 * The matcher a retrieval layer would need. Deliberately simple and stated in full, because the
 * point is to show what the DATA supports, not to smuggle a ranking algorithm into an ingest sprint.
 *
 * A query scores against a record on:
 *   +100  the query contains the record's citation, normalised
 *   +0-60 the OVERLAP between a recorded name variant and the query
 *   +10   the record's year appears in the query
 *
 * ⚠⚠ THE OVERLAP RULE REPLACED AN ALL-WORDS RULE, AND THE CHANGE IS RECORDED RATHER THAN QUIETLY
 * MADE. The first version required EVERY significant word of a name variant to appear in the query,
 * and scored 6/10 — because a user types "Associated Provincial Picture Houses Wednesbury
 * Corporation" and the recorded variant carries "Ltd", which they did not type. That is a defect in
 * the rule, not evidence about the data.
 *
 * ⚠ But changing a matcher until the test passes is fitting the test, so two things are true here
 * and both are reported: the rule was changed ONCE, to a standard overlap rule chosen because it is
 * the ordinary way to compare a query to a title; and the number it produces is a SUFFICIENCY
 * DEMONSTRATION over the reference records, never the shipped ranking. CC-Search owns the real
 * after-measurement, and if their number is lower, theirs is the one that counts.
 */
function score(query: string, r: Rec): number {
  const q = query.toLowerCase()
  let s = 0
  if (q.includes(normaliseCitation(r.citation).toLowerCase())) s += 100
  let best = 0
  for (const v of r.names) {
    const words = [...new Set(v.name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !['the', 'and', 'for', 'ltd', 'plc', 'limited', 'others', 'another'].includes(w)))]
    if (words.length < 2) continue
    const hit = words.filter((w) => q.includes(w)).length
    const share = hit / words.length
    // two real words in common, and most of the name accounted for
    if (hit >= 2 && share >= 0.6) best = Math.max(best, Math.round(60 * share))
  }
  s += best
  if (q.includes(String(r.year))) s += 10
  return s
}

function main() {
  const recPath = path.join(OUT, 'CASEREF_records.probes.json')
  if (!fs.existsSync(recPath)) { console.error('run build-records.ts --probes first'); process.exit(1) }
  const records: Rec[] = JSON.parse(fs.readFileSync(recPath, 'utf8')).records

  const baselinePath = path.join(OUT, 'CASEREF_baseline_2026-08-27.json')
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).results

  console.log('══ BEFORE — the live gateway, measured today, not quoted ══')
  console.log(`   source: ${path.basename(baselinePath)}\n`)
  let absent = 0, decoy = 0
  for (const b of baseline) {
    const v = b.named?.verdict ?? b.lay?.verdict
    if (v === 'DECOY') decoy++
    if (v === 'ABSENT' || v === 'DECOY') absent++
    const top = b.named?.nameMatchRow?.title ?? b.named?.top?.[0]?.title ?? '(nothing named)'
    console.log(`   ${String(v).padEnd(7)} ${b.probe.authority.slice(0, 46).padEnd(48)} ${v === 'DECOY' ? `→ returned instead: ${String(top).slice(0, 46)}` : ''}`)
  }
  console.log(`\n   authority NOT held: ${absent}/${baseline.length}   ·   a DIFFERENT same-name case returned: ${decoy}/${baseline.length}`)

  console.log('\n══ AFTER — would a reference record be the right answer? (simulated ranking) ══\n')
  let correct = 0
  const rows: any[] = []
  for (const b of baseline) {
    const query = b.probe.named as string
    const ranked = records.map((r) => ({ r, s: score(query, r) })).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s)
    const top = ranked[0]
    const isRight = top && normaliseCitation(top.r.citation) === normaliseCitation(b.probe.citation)
    if (isRight) correct++
    console.log(`   ${isRight ? '✓' : '✗'} ${b.probe.authority.slice(0, 44).padEnd(46)} → ${top ? `${top.r.citation} (score ${top.s})` : '(no record matched)'}`)
    rows.push({
      authority: b.probe.authority, citation: b.probe.citation,
      before: b.named?.verdict ?? b.lay?.verdict,
      afterTop: top?.r.citation ?? null, afterCorrect: !!isRight,
      wouldSay: top ? {
        name: top.r.observedName, citation: top.r.citation, court: top.r.court,
        held: top.r.held, citedBy: top.r.citedBy.documents, discussion: top.r.discussion.length,
      } : null,
    })
  }
  console.log(`\n   ${correct}/${baseline.length} of the probes resolve to the RIGHT reference record`)

  console.log('\n══ WHAT THE USER WOULD SEE, for one of them ══\n')
  const ex = rows.find((r) => r.afterCorrect && r.wouldSay?.citedBy > 0) ?? rows.find((r) => r.afterCorrect)
  if (ex) {
    const w = ex.wouldSay
    console.log(`   **${w.name ?? ex.authority} ${w.citation}**${w.court ? ` — ${w.court}` : ''}`)
    console.log(`   **Not held in our corpus.** Our English case law begins in 2003.`)
    console.log(`   Cited in ${n(w.citedBy)} judgment${w.citedBy === 1 ? '' : 's'} and discussed in ${n(w.discussion)} document${w.discussion === 1 ? '' : 's'} that we do hold.`)
    console.log(`   → Search BAILII for the judgment · → Where it is discussed in our corpus`)
  }

  fs.writeFileSync(path.join(OUT, 'CASEREF_handover_search.json'), JSON.stringify({
    generated: new Date().toISOString(),
    before: { absent, decoy, of: baseline.length, source: path.basename(baselinePath) },
    afterSimulated: { correct, of: baseline.length },
    rows,
    note: 'AFTER is a SIMULATION over the reference records, not the shipped ranking. It shows the data is sufficient; CC-Search owns the change and the real after-measurement.',
  }, null, 2))
  console.log('\nwritten: docs/census/CASEREF_handover_search.json')
  console.log('\n⚠ NO SEARCH FILE WAS EDITED. The requirement, the test set and the before-numbers are here;')
  console.log('  the change and the real after-measurement belong to CC-Search.')
}
main()
