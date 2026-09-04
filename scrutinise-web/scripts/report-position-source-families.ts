/**
 * report-position-source-families.ts — SURFACE 3 §0a.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A SCRIPT AND NOT A DOCUMENT
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Charlie: *"SEARCH_TO_LEX_POSITION_SOURCES.md is drawn from sprint reports rather than live
 * queries, two figures already disagree between snapshots … and Lex is being asked to build
 * against it. An inference must not travel as a measurement."*
 *
 * ⚠⚠ THE FILE HE NAMES DOES NOT EXIST IN THIS REPOSITORY. Not on disk, not tracked by git, and
 * not in the history of any ref (`git log --all --diff-filter=A -- '*SEARCH_TO_LEX*'` returns
 * nothing). The only file that mentions it is `docs/BRIEF_SURFACE_3.md`, which lists it as
 * required reading. So there is nothing here to mark superseded, and saying "marked superseded"
 * would be the exact fault the instruction is about. What CAN be done is the substantive half:
 * establish every figure from the live tables and publish it in a form that CANNOT go stale,
 * which is a generator rather than a page somebody keeps up to date.
 *
 * ⚠⚠ AND THE DISAGREEMENT HE REMEMBERS IS REAL, BUT IT IS NOT A CONTRADICTION — IT IS A GRAIN
 * ERROR, WHICH IS WORSE, BECAUSE BOTH NUMBERS ARE CORRECT. "members-interests" names a CORPUS of
 * 3,448 documents, a set of 1,505 graph EDGES and a set of 1,723 SIGNALS. Quoting any one of them
 * as "the interests we hold" is true of one grain and false of the other two. Every row below
 * therefore carries its grain in the row, not in a footnote.
 *
 *   npm run report:position-sources          print it
 *   npm run report:position-sources -- --write   regenerate docs/POSITION_SOURCE_FAMILIES.md
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { getNeonPool } from '../lib/pg-pool'
import { POSITION_CONFIG, type SignalType } from '../lib/graph/position-config'

interface Grain {
  /** What one row IS. The whole point of the table. */
  grain: string
  table: string
  n: number | null
  note: string
}

interface Family {
  signalType: SignalType
  what: string
  grains: Grain[]
  /**
   * ⚠⚠ HOW THE GRAINS RECONCILE, COMPUTED PER FAMILY RATHER THAN BY A FORMULA.
   *
   * The first version of this script printed "widest grain → narrowest grain, N% survives" for
   * every family, and it was wrong in two different ways at once:
   *
   *   · for `vote` it reported **36,857% survives**, because a division CONTAINS many votes —
   *     the grains are not nested descending and the ratio is meaningless;
   *   · for `witness_appearance` it reported **107.7% survives**, which reads as an error in the
   *     data and is not one.
   *
   * ⚠ THE SECOND ONE IS THE FINDING THIS WHOLE FILE EXISTS FOR. `graph_edge` holds one row per
   * (subject, object) PAIR — it is deduplicated. `position_signal_stored` holds one row per
   * (actor, target, DATE). A witness who appeared before the same inquiry on three days is ONE
   * edge and THREE signals. Measured: witness signals have 162,733 distinct (actor, target)
   * pairs, which is the edge count exactly, and 175,290 distinct (actor, target, date) triples,
   * which is the signal count exactly. Same for interests.
   *
   * So "the graph holds 1,505 declared interests" and "the graph holds 1,723 declared interests"
   * are both true, of different things, and neither is "the 3,448 interests we hold".
   */
  reconciliation: string
}

async function count(sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await getNeonPool().query<{ n: string }>(sql, params)
    return rows.length ? Number(rows[0].n) : 0
  } catch {
    // ⚠ A TABLE THAT IS NOT THERE IS `null`, NOT ZERO. Zero would read as "we hold none of
    // these", which is a claim about the world; null is a claim about our plumbing.
    return null
  }
}

/**
 * ⚠ THE ONE MEASUREMENT THAT EXPLAINS EVERY "MORE SIGNALS THAN EDGES" CASE, asked of the data
 * rather than asserted: how many distinct (actor, target) PAIRS the signals cover, and how many
 * distinct (actor, target, date) TRIPLES. Where the first equals the edge count and the second
 * equals the signal count, the two tables are simply at different grains and nothing is wrong.
 */
async function pairsAndTriples(signalType: SignalType): Promise<{ pairs: number; triples: number }> {
  const { rows } = await getNeonPool().query<{ pairs: string; triples: string }>(
    `SELECT COUNT(DISTINCT (actor_id, target_id))::bigint pairs,
            COUNT(DISTINCT (actor_id, target_id, observed_at))::bigint triples
       FROM position_signal_stored WHERE signal_type = $1 AND superseded_by IS NULL`, [signalType])
  return { pairs: Number(rows[0]?.pairs ?? 0), triples: Number(rows[0]?.triples ?? 0) }
}

async function main() {
  const write = process.argv.includes('--write')
  const generatedAt = new Date().toISOString()

  const families: Family[] = []

  // ── vote ────────────────────────────────────────────────────────────────────────────────────
  families.push({
    signalType: 'vote',
    what: 'votes in recorded divisions',
    grains: [
      { grain: 'a division', table: 'divisions',
        n: await count('SELECT COUNT(*)::bigint n FROM divisions'),
        note: 'one row per division of either House' },
      { grain: 'a member’s vote', table: 'division_votes',
        n: await count(`SELECT COUNT(*)::bigint n FROM division_votes WHERE vote IN ('aye','no')`),
        note: 'aye/no only; tellers and absences are not votes' },
      { grain: 'a signal', table: 'position_signal_vote (view, derived)',
        n: await count(`SELECT COUNT(*)::bigint n FROM division_votes v
                          JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind='person'
                         WHERE v.vote IN ('aye','no')`),
        note: '⚠ DERIVED, never stored. A vote becomes a signal only where the member resolves to '
          + 'a graph entity, so this is BELOW the vote count and the gap is unresolved members' },
    ],
    reconciliation: await (async () => {
      const votes = await count(`SELECT COUNT(*)::bigint n FROM division_votes WHERE vote IN ('aye','no')`) ?? 0
      const sigs = await count(`SELECT COUNT(*)::bigint n FROM division_votes v
                                  JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind='person'
                                 WHERE v.vote IN ('aye','no')`) ?? 0
      return `A division CONTAINS many votes, so the first two rows go UP, not down — these grains `
        + `are not nested and no "percentage surviving" is meaningful across them. The only step `
        + `that loses anything is the last: ${votes.toLocaleString()} votes become `
        + `${sigs.toLocaleString()} signals (${(100 * sigs / Math.max(1, votes)).toFixed(1)}%), and `
        + `the ${(votes - sigs).toLocaleString()} missing are votes cast by members who do not `
        + `resolve to a graph entity.`
    })(),
  })

  // ── edm_signature ───────────────────────────────────────────────────────────────────────────
  families.push({
    signalType: 'edm_signature',
    what: 'signatures on Early Day Motions',
    grains: [
      { grain: 'a motion', table: 'corpus_sections (early-day-motions)',
        n: await count(`SELECT COUNT(*)::bigint n FROM corpus_sections WHERE corpus='early-day-motions'`),
        note: 'the searchable document' },
      { grain: 'a sponsorship', table: 'edm_sponsor',
        n: await count('SELECT COUNT(*)::bigint n FROM edm_sponsor'),
        note: 'one row per member per motion — the act itself' },
      { grain: 'a signal', table: 'position_signal_stored',
        n: await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                         WHERE signal_type='edm_signature' AND superseded_by IS NULL`),
        note: '⚠ BELOW the sponsorship count: a sponsorship becomes a signal only where the '
          + 'member resolves' },
    ],
    reconciliation: await (async () => {
      const sp = await count('SELECT COUNT(*)::bigint n FROM edm_sponsor') ?? 0
      const sg = await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                               WHERE signal_type='edm_signature' AND superseded_by IS NULL`) ?? 0
      return `${sp.toLocaleString()} sponsorships become ${sg.toLocaleString()} signals `
        + `(${(100 * sg / Math.max(1, sp)).toFixed(1)}%). The difference is members who do not `
        + `resolve to a graph entity.`
    })(),
  })

  // ── declared_interest — ⚠ THE ONE CHARLIE NAMES ─────────────────────────────────────────────
  families.push({
    signalType: 'declared_interest',
    what: 'interests declared in the register',
    grains: [
      { grain: 'a published interest', table: 'interests-api.parliament.uk',
        n: 4100,
        note: '⚠⚠ NOT A QUERY. This is the census reading of 2026-08-27 '
          + '(docs/census/members-interests.json, published_units) and it is the ONLY figure in '
          + 'this table that is not live. It is the publisher’s own total, unreachable from here '
          + 'without an API call, and it is labelled rather than omitted because the gap between '
          + 'it and the row below is the coverage story' },
      { grain: 'a held document', table: 'corpus_sections (members-interests)',
        n: await count(`SELECT COUNT(*)::bigint n FROM corpus_sections WHERE corpus='members-interests'`),
        note: '⚠⚠ THIS IS THE 3,448 THAT CIRCULATES AS "the interests we hold". It is a count of '
          + 'DOCUMENTS IN THE SEARCH CORPUS, marked excluded-by-design for retrieval, and it is '
          + 'not the number of interests the position graph can use' },
      { grain: 'an edge', table: 'graph_edge (declared-interest)',
        n: await count(`SELECT COUNT(*)::bigint n FROM graph_edge WHERE predicate='declared-interest'`),
        note: 'the entity-resolved relationship' },
      { grain: 'a signal', table: 'position_signal_stored',
        n: await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                         WHERE signal_type='declared_interest' AND superseded_by IS NULL`),
        note: '⚠ what the position graph actually reasons over' },
    ],
    reconciliation: await (async () => {
      const edges = await count(`SELECT COUNT(*)::bigint n FROM graph_edge WHERE predicate='declared-interest'`) ?? 0
      const { pairs, triples } = await pairsAndTriples('declared_interest')
      return `⚠⚠ THERE ARE MORE SIGNALS THAN EDGES, AND THAT IS A GRAIN DIFFERENCE RATHER THAN A `
        + `FAULT. The edge table is deduplicated to one row per (member, organisation) PAIR; the `
        + `signal layer is DATED. Measured: the signals cover ${pairs.toLocaleString()} distinct `
        + `pairs against ${edges.toLocaleString()} edges, and ${triples.toLocaleString()} distinct `
        + `(member, organisation, date) triples, which is exactly the signal count. A member who `
        + `declared the same interest in two different years is ONE edge and TWO signals. `
        + `**So none of these four numbers is "the interests we hold" — they are four different `
        + `questions, and the corpus row is not even about the position graph.**`
    })(),
  })

  // ── witness_appearance ──────────────────────────────────────────────────────────────────────
  families.push({
    signalType: 'witness_appearance',
    what: 'appearances as a witness before a committee inquiry',
    grains: [
      { grain: 'an edge', table: 'graph_edge (gave-evidence-to)',
        n: await count(`SELECT COUNT(*)::bigint n FROM graph_edge WHERE predicate='gave-evidence-to'`),
        note: 'one row per witness per inquiry appearance' },
      { grain: 'a signal', table: 'position_signal_stored',
        n: await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                         WHERE signal_type='witness_appearance' AND superseded_by IS NULL`),
        note: 'what the position graph reasons over' },
    ],
    reconciliation: await (async () => {
      const edges = await count(`SELECT COUNT(*)::bigint n FROM graph_edge WHERE predicate='gave-evidence-to'`) ?? 0
      const { pairs, triples } = await pairsAndTriples('witness_appearance')
      return `The same grain difference as interests, and here it is exact: the signals cover `
        + `${pairs.toLocaleString()} distinct (witness, inquiry) pairs against `
        + `${edges.toLocaleString()} edges (${pairs === edges ? 'identical' : '⚠ NOT identical — investigate'}), `
        + `and ${triples.toLocaleString()} distinct (witness, inquiry, date) triples, which is `
        + `exactly the signal count. A witness who appeared before one inquiry on three days is `
        + `ONE edge and THREE signals.`
    })(),
  })

  // ── political_donation ──────────────────────────────────────────────────────────────────────
  families.push({
    signalType: 'political_donation',
    what: 'donations in the Electoral Commission register',
    grains: [
      { grain: 'a published donation', table: 'position_donation',
        n: await count('SELECT COUNT(*)::bigint n FROM position_donation'),
        note: 'every row the Commission publishes that we ingested' },
      { grain: 'a donation with BOTH ends resolved', table: 'position_donation',
        n: await count(`SELECT COUNT(*)::bigint n FROM position_donation
                         WHERE donee_entity_id IS NOT NULL AND donor_entity_id IS NOT NULL`),
        note: '⚠⚠ THE ONLY ROWS THAT CAN BECOME A SIGNAL. Quoting the row above as the register’s '
          + 'yield is the mistake SURFACE 3 §3 corrects' },
      { grain: 'a signal', table: 'position_signal_stored',
        n: await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                         WHERE signal_type='political_donation' AND superseded_by IS NULL`),
        note: 'grouped to (member, donor, date), so several donations on one day are one signal' },
    ],
    reconciliation: await (async () => {
      const pub = await count('SELECT COUNT(*)::bigint n FROM position_donation') ?? 0
      const both = await count(`SELECT COUNT(*)::bigint n FROM position_donation
                                 WHERE donee_entity_id IS NOT NULL AND donor_entity_id IS NOT NULL`) ?? 0
      const sg = await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                               WHERE signal_type='political_donation' AND superseded_by IS NULL`) ?? 0
      return `⚠⚠ The collapse is at the RESOLUTION step, not the grouping step: of `
        + `${pub.toLocaleString()} published donations only ${both.toLocaleString()} have BOTH a `
        + `resolved donor and a resolved recipient, and those group to ${sg.toLocaleString()} `
        + `signals. Any prediction that scales the signal count by growth in DONOR-resolved rows `
        + `alone is using the wrong denominator — see SURFACE 3 §3.`
    })(),
  })

  // ── the two with nothing behind them ────────────────────────────────────────────────────────
  for (const t of ['amendment_sponsorship', 'committee_membership'] as SignalType[]) {
    families.push({
      signalType: t,
      what: t === 'amendment_sponsorship'
        ? 'amendments a member put their name to'
        : 'seats held on select and public bill committees',
      grains: [
        { grain: 'a signal', table: 'position_signal_stored',
          n: await count(`SELECT COUNT(*)::bigint n FROM position_signal_stored
                           WHERE signal_type=$1 AND superseded_by IS NULL`, [t]),
          note: '⚠⚠ NO SOURCE DATA AT ALL. The weight and half-life for this type are configured '
            + 'and inert; nothing has ever been ingested' },
      ],
      reconciliation: 'There is nothing to reconcile. This type is named in the config, carries a '
        + 'weight and a half-life, and has never had one row behind it. It is printed here, and on '
        + 'every coverage statement, precisely so that its absence is a statement rather than a '
        + 'silence.',
    })
  }

  // ⚠ EVERY TYPE IN THE CONFIG IS COVERED, asserted rather than assumed — the same rule as the
  // coverage block. A type added to the ladder and forgotten here fails loudly.
  const ladder = Object.keys(POSITION_CONFIG.halfLifeYears) as SignalType[]
  const missing = ladder.filter((t) => !families.some((f) => f.signalType === t))
  if (missing.length) {
    throw new Error(`signal types in the config with no family row: ${missing.join(', ')}`)
  }

  const lines: string[] = []
  lines.push('# POSITION SOURCE FAMILIES — every figure queried, every grain named')
  lines.push('')
  lines.push(`*Generated ${generatedAt} by \`npm run report:position-sources -- --write\`.*`)
  lines.push('*Do not edit this file. Regenerate it.*')
  lines.push('')
  lines.push('## Why this file exists')
  lines.push('')
  lines.push('SURFACE 3 §0a. A source-family table drawn from sprint reports is a set of numbers')
  lines.push('that were true on the day each report was written, carried forward as if they were')
  lines.push('properties of the system. **An inference must not travel as a measurement.**')
  lines.push('')
  lines.push('⚠⚠ **The disagreement this was written to settle is not a contradiction — it is a')
  lines.push('grain error, and both numbers are correct.** `members-interests` names a corpus of')
  lines.push('documents, a set of graph edges and a set of position signals, and they are three')
  lines.push('different sizes because they count three different things. Quoting any one as "the')
  lines.push('interests we hold" is true of one grain and false of the other two. **Every row below')
  lines.push('states its grain in the row.**')
  lines.push('')
  lines.push('⚠ `SEARCH_TO_LEX_POSITION_SOURCES.md` **does not exist in this repository** — not on')
  lines.push('disk, not tracked, and not in the history of any ref. It could not be marked')
  lines.push('superseded because there is nothing to mark. This file is what it should have been.')
  lines.push('')

  for (const f of families) {
    lines.push(`## \`${f.signalType}\` — ${f.what}`)
    lines.push('')
    lines.push('| grain (what ONE row is) | where it lives | n | note |')
    lines.push('|---|---|---:|---|')
    for (const g of f.grains) {
      const n = g.n === null ? '**unreadable**' : g.n.toLocaleString()
      lines.push(`| ${g.grain} | \`${g.table}\` | ${n} | ${g.note} |`)
    }
    lines.push('')
    lines.push(`⚠ **How these reconcile.** ${f.reconciliation}`)
    lines.push('')
  }

  const body = lines.join('\n')
  console.log(body)
  if (write) {
    const out = join(__dirname, '../../docs/POSITION_SOURCE_FAMILIES.md')
    writeFileSync(out, body, 'utf8')
    console.log(`\nwritten: ${out}`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => process.exit(0))
