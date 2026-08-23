/**
 * audit-3c2-bases.ts — GRAPH 3C-2 §1. Audit every basis a validation key could rest on.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE REASONING ERROR THIS EXISTS TO CATCH, STATED ONCE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * GRAPH 3B chose amendment sponsorship as the basis for the validation key because it is
 * NON-CIRCULAR: the position graph holds zero `amendment_sponsorship` signals, and 3B proved that
 * with a query rather than an argument. That reasoning is genuinely valuable and it is also
 * INCOMPLETE.
 *
 *   **Non-circularity is necessary. It is not sufficient. The basis must ALSO determine a
 *   direction.**
 *
 * Amendment sponsorship is UNSIGNED: a wrecking amendment and a strengthening amendment are the
 * same fact — a member put their name to an amendment. So 136 of the 157 rows asserted a position
 * their own citation could not establish. Sir Edward Leigh appears sponsoring NC3 to the assisted
 * dying Bill; he is one of its most prominent opponents, and nothing in "Guidance: administration
 * of pain relief to people who are terminally ill" says so either way.
 *
 * ⚠⚠ **AN INDEPENDENT SIGNAL THAT DOES NOT SETTLE THE ANSWER IS WORSE THAN USELESS IN AN ANSWER
 * KEY, BECAUSE IT WILL MARK THE GRAPH WRONG EVERY TIME THE GRAPH IS RIGHT.** A key built on it
 * does not measure the graph; it measures the coin-flip that assigned each row its direction, and
 * it does so while looking rigorous.
 *
 * So every basis now has to pass BOTH tests, and this file asks both of them:
 *   TEST 1 · DIRECTION   — does the fact itself say which way? (reasoned; stated per basis)
 *   TEST 2 · INDEPENDENCE — does the graph hold a signal derived from it? (MEASURED, below)
 *
 * Usage (from scripts/graph):  npx tsx audit-3c2-bases.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import fs from 'fs'
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const DOC = path.join(__dirname, '../../docs/POSITION_VALIDATION_CANDIDATES.md')

interface Basis {
  name: string
  /** TEST 1 — does the fact determine a direction? */
  direction: 'YES' | 'NO' | 'PARTLY'
  /** One line, and it has to say WHY, not restate the verdict. */
  why: string
  /**
   * TEST 2 — the `position_signal.signal_type` values that would make this basis circular.
   * Empty means "nothing in the graph is derived from this", which is checked against the live
   * table rather than asserted.
   */
  circularVia: string[]
  /** Whether 3C-2 uses it. */
  use: 'USE' | 'REJECT (no direction)' | 'REJECT (no direction; also circular)' | 'EXCLUDE (circular)' | 'NOT AVAILABLE'
}

const BASES: Basis[] = [
  {
    name: 'amendment sponsorship',
    direction: 'NO',
    why: 'UNSIGNED. Tabling a wrecking amendment and tabling a strengthening one are the same recorded fact; the amendment text does not reliably say which, and often cannot.',
    circularVia: ['amendment_sponsorship'],
    use: 'REJECT (no direction)',
  },
  {
    name: 'bill sponsorship',
    direction: 'YES',
    why: 'A named sponsor of a Bill supports that Bill — the act and the direction are the same thing. ⚠ Two caveats that narrow it rather than break it: a government Bill is sponsored by the minister in charge, which is a public position rather than necessarily a private conviction; and the Bill may be broader than the matter it is filed under.',
    circularVia: [],
    use: 'USE',
  },
  {
    name: "the member's own words in Hansard",
    direction: 'YES',
    why: 'A member arguing a case in the chamber states a direction in the act of stating it. ⚠ Two hazards handled in the generator: material QUOTED inside a speech is not the speaker\'s own position, and a speech can be procedural or interrogative rather than positional.',
    circularVia: [],
    use: 'USE',
  },
  {
    name: 'a published statement on the web',
    direction: 'YES',
    why: 'Same property as a speech — a member setting out a view states its direction. Needed only for members who did not speak on the matter.',
    circularVia: [],
    use: 'USE',
  },
  {
    name: 'EDM signature',
    direction: 'YES',
    why: 'An Early Day Motion has an ask, and signing it endorses that ask — genuinely signed, unlike an amendment. But it fails the OTHER test.',
    circularVia: ['edm_signature'],
    use: 'EXCLUDE (circular)',
  },
  {
    name: 'division votes',
    direction: 'YES',
    why: 'An aye and a no are the clearest direction there is — and they are the single largest thing the graph is built from, so a key using them would be scoring the graph against itself.',
    circularVia: ['vote'],
    use: 'EXCLUDE (circular)',
  },
  {
    name: 'TheyWorkForYou "voted consistently for…" summaries',
    direction: 'YES',
    why: '⚠⚠ THE DANGEROUS ONE — it reads like an independent third-party judgement and is a pure function of the same division records the graph aggregates. Circular while appearing independent.',
    circularVia: ['vote'],
    use: 'EXCLUDE (circular)',
  },
  {
    name: 'committee membership',
    direction: 'NO',
    why: 'ENGAGEMENT ONLY. Sitting on a committee scrutinising a Bill says a member attended to it, not what they concluded. The graph already models it as direction 0 for exactly this reason.',
    circularVia: ['committee_membership'],
    use: 'REJECT (no direction)',
  },
  {
    name: 'witness appearance',
    direction: 'NO',
    why: 'ENGAGEMENT ONLY, and about a different actor besides — the witness, not the member. Direction 0 in the graph by design.',
    circularVia: ['witness_appearance'],
    use: 'REJECT (no direction; also circular)',
  },
  {
    name: 'declared interest',
    direction: 'NO',
    why: 'ENGAGEMENT / ALIGNMENT PRIOR. A declared interest in a sector is not a position on a Bill about that sector, and can point either way. Direction 0 in the graph.',
    circularVia: ['declared_interest'],
    use: 'REJECT (no direction; also circular)',
  },
  {
    name: 'political donation',
    direction: 'NO',
    why: 'ALIGNMENT PRIOR at best. Design §4: the signal is the PATH, not a stance — "if the aggregation is tempted to convert a funding path into a stance, that temptation is the thing this whole design exists to resist."',
    circularVia: ['political_donation'],
    use: 'REJECT (no direction; also circular)',
  },
  {
    name: 'party membership / the party manifesto',
    direction: 'PARTLY',
    why: 'It determines a direction for the PARTY, not for the member — and the entire value of this graph is telling apart members who diverge from their party from members who do not. A key built on it would score every rebel as an error.',
    circularVia: [],
    use: 'REJECT (no direction)',
  },
  {
    name: 'ministerial office held at the time',
    direction: 'PARTLY',
    why: 'A minister taking a Bill through supports it, but that is bill sponsorship under another name, and outside that it says nothing: holding an office is not a position on a matter.',
    circularVia: [],
    use: 'REJECT (no direction)',
  },
  {
    name: 'select committee report signed by the member',
    direction: 'YES',
    why: 'A report a member has put their name to states conclusions with a direction — but ⚠ committee reports are consensus documents and a member may have dissented silently. NOT AVAILABLE anyway: we hold committee reports without per-member signature data.',
    circularVia: [],
    use: 'NOT AVAILABLE',
  },
]

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    // ── what the document rests on today ────────────────────────────────────────────────────
    const md = fs.readFileSync(DOC, 'utf8')
    const counts = new Map<string, number>()
    for (const m of md.matchAll(/^- \*\*Basis:\*\* `([^`]+)`$/gm)) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    console.log(`\n════ 0 · WHAT THE CURRENT DOCUMENT RESTS ON ════`)
    for (const [k, v] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(24)} ${String(v).padStart(4)}  (${((100 * v) / total).toFixed(1)}% of ${total})`)
    }

    // ── TEST 2, measured ────────────────────────────────────────────────────────────────────
    const { rows: held } = await pool.query<{ signal_type: string; n: string }>(
      `SELECT signal_type, COUNT(*)::text AS n FROM position_signal GROUP BY 1`)
    const heldMap = new Map(held.map((r) => [r.signal_type, Number(r.n)]))
    console.log(`\n════ 1 · TEST 2 (INDEPENDENCE) IS A QUERY, NOT AN OPINION ════`)
    console.log(`  signal types the graph actually holds:`)
    for (const [k, v] of [...heldMap.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(24)} ${v.toLocaleString().padStart(11)}`)
    }
    for (const t of ['amendment_sponsorship', 'committee_membership']) {
      if (!heldMap.has(t)) console.log(`    ${t.padEnd(24)} ${'0'.padStart(11)}  ⛔ no source data (3A)`)
    }

    // ── the audit ───────────────────────────────────────────────────────────────────────────
    console.log(`\n════ 2 · EVERY BASIS, BOTH TESTS ════`)
    console.log(`  ${'basis'.padEnd(46)} ${'DIRECTION?'.padEnd(11)} ${'INDEPENDENT?'.padEnd(13)} verdict`)
    console.log(`  ${'-'.repeat(46)} ${'-'.repeat(11)} ${'-'.repeat(13)} ${'-'.repeat(20)}`)
    let usable = 0
    for (const b of BASES) {
      const circularBy = b.circularVia.filter((t) => (heldMap.get(t) ?? 0) > 0)
      const independent = circularBy.length === 0
      // ⚠ The verdict is DERIVED from the two tests, not typed in beside them — otherwise the
      // table could disagree with itself and still look tidy.
      // ⚠ THREE BASES FAIL BOTH TESTS, AND THE FIRST VERSION OF THIS LINE REPORTED ONLY ONE
      // REASON. Witness appearance, declared interest and political donation are direction-less
      // AND circular; picking circularity because it was tested first would have filed them under
      // the weaker objection. The fundamental one is that they do not determine a direction — a
      // basis that cannot answer the question is out whether or not it is independent — so that is
      // named first and the circularity is named too.
      const derived = b.use === 'NOT AVAILABLE' ? 'NOT AVAILABLE'
        : b.direction !== 'YES' ? (independent ? 'REJECT (no direction)' : 'REJECT (no direction; also circular)')
          : (independent ? 'USE' : 'EXCLUDE (circular)')
      if (derived !== b.use) {
        console.log(`  ⚠⚠ TABLE DISAGREES WITH ITSELF on "${b.name}": stated ${b.use}, derived ${derived}`)
      }
      if (derived === 'USE') usable++
      console.log(`  ${b.name.padEnd(46)} ${b.direction.padEnd(11)} ` +
        `${(independent ? 'yes' : `NO — ${circularBy.join(',')}`).padEnd(13)} ${derived}`)
    }
    console.log(`\n  ${usable} of ${BASES.length} bases pass BOTH tests.`)

    console.log(`\n════ 3 · THE ONE-LINE REASONS ════`)
    for (const b of BASES) {
      console.log(`\n  ${b.direction === 'YES' ? '✓' : b.direction === 'NO' ? '✗' : '~'} ${b.name.toUpperCase()} — direction: ${b.direction}`)
      for (const line of b.why.match(/.{1,104}(\s|$)/g) ?? [b.why]) console.log(`      ${line.trim()}`)
    }

    console.log(`\n════ 4 · WHAT THAT LEAVES ════`)
    console.log(`  USE, in the brief's order of preference:`)
    console.log(`    (a) the member's own words in Hansard  — our corpus, free, and the graph holds`)
    console.log(`        no speech-derived signal, so it is independent TODAY. Rows sourced from it`)
    console.log(`        must be MARKED: folding extracted positions into the graph would retire them.`)
    console.log(`    (b) a published statement on the web   — for members who did not speak.`)
    console.log(`    (c) bill sponsorship                   — unambiguous, and already in the document.`)
    console.log(`  ⚠ Amendment sponsorship is NOT deleted. It moves to an UNSOUND BASIS — NOT SCORABLE`)
    console.log(`    section with this reasoning attached. It may be recoverable later by classifying`)
    console.log(`    what each amendment actually DID, but that is an inference and a separate job.`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[audit-3c2-bases] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
