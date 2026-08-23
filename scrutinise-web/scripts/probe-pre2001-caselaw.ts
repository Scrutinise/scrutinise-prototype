/**
 * probe-pre2001-caselaw.ts — ten questions whose governing authority is pre-2001, asked of the
 * LIVE retrieval path. `BRIEF_CASELAW_PRE2001_SCOPE.md` §3.
 *
 * WHY IT EXISTS. The scoping brief forbids asserting the benefit of a pre-2001 case-law ingest and
 * requires it to be DEMONSTRATED: take ten questions a reformer would plausibly ask where the case
 * everyone in the field would name first was decided before 2001, run each through `runSearch()`
 * today, and record what comes back. The brief's own framing is that the interesting failure is not
 * the empty result — it is the CONFIDENT WRONG one, where something post-2001 is returned and looks
 * like an answer.
 *
 * ⚠ TWO ARMS PER QUESTION, AND THEY ANSWER DIFFERENT THINGS.
 *   · LAY   — the question as a reformer would type it. This is what a user experiences.
 *   · NAMED — the case name and citation typed in directly, scoped to `tier=caselaw`. This is the
 *             corpus's BEST CHANCE. If the judgment is held at all, this arm finds it; if this arm
 *             returns only later judgments that CITE the case, that is positive evidence of absence
 *             rather than an inference from a lay query that could simply have ranked badly.
 *
 * ⚠ NOT A SCORE, AND NOT GOLD. n=10, chosen by hand to illustrate one gap. Nothing here may be
 * presented as recall, and the report that consumes it says so.
 *
 * ⚠ It calls `runSearch()` — the real gateway, not a copy — behind `harness-preflight`, and reads
 * the `served` counters either side: a run that reached no service returns zeros that look exactly
 * like the absence this probe is looking for (`docs/CORPUS_COVERAGE_AUDIT_22_AUG.md` §1).
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation,caselaw \
 *     npx tsx --env-file=.env scripts/probe-pre2001-caselaw.ts [--json out.json]
 */
import fs from 'node:fs'
import { runSearch, type SearchIntent } from '../lib/lex/search-gateway'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'

interface Probe {
  /** The authority a lawyer would name first. */
  authority: string
  citation: string
  year: number
  court: string
  /** What a reformer types. */
  lay: string
  /** The case name typed in directly — the corpus's best chance of returning the judgment. */
  named: string
  /** Lower-cased substrings that identify the judgment ITSELF in a title or citation. */
  markers: string[]
}

const PROBES: Probe[] = [
  {
    authority: 'Anisminic Ltd v Foreign Compensation Commission',
    citation: '[1969] 2 AC 147', year: 1969, court: 'House of Lords',
    lay: 'can a court review a decision when the Act says it is final and shall not be questioned in any court',
    named: 'Anisminic Foreign Compensation Commission ouster clause error of law jurisdiction',
    markers: ['anisminic'],
  },
  {
    authority: 'Pepper (Inspector of Taxes) v Hart',
    citation: '[1993] AC 593', year: 1992, court: 'House of Lords',
    lay: 'can a court look at what a minister said in Parliament to interpret an ambiguous Act',
    named: 'Pepper v Hart Hansard statutory interpretation ambiguous statute ministerial statement',
    markers: ['pepper v hart', 'pepper (inspector'],
  },
  {
    authority: 'Associated Provincial Picture Houses Ltd v Wednesbury Corporation',
    citation: '[1948] 1 KB 223', year: 1947, court: 'Court of Appeal',
    lay: 'what is the legal test for an unreasonable decision by a public body',
    named: 'Associated Provincial Picture Houses Wednesbury Corporation unreasonableness',
    markers: ['wednesbury corporation', 'associated provincial picture'],
  },
  {
    authority: 'Council of Civil Service Unions v Minister for the Civil Service (GCHQ)',
    citation: '[1985] AC 374', year: 1984, court: 'House of Lords',
    lay: 'can the exercise of prerogative powers by a minister be challenged by judicial review',
    named: 'Council of Civil Service Unions Minister for the Civil Service GCHQ prerogative',
    markers: ['council of civil service unions', 'gchq'],
  },
  {
    authority: 'Caparo Industries plc v Dickman',
    citation: '[1990] 2 AC 605', year: 1990, court: 'House of Lords',
    lay: 'when does someone owe a duty of care for negligent advice that causes financial loss',
    named: 'Caparo Industries v Dickman duty of care proximity fair just and reasonable',
    markers: ['caparo'],
  },
  {
    authority: 'Donoghue v Stevenson',
    citation: '[1932] AC 562', year: 1932, court: 'House of Lords',
    lay: 'does a manufacturer owe a duty to the ultimate consumer of a defective product',
    named: 'Donoghue v Stevenson neighbour principle manufacturer consumer duty of care',
    markers: ['donoghue v stevenson', 'm’alister'],
  },
  {
    authority: 'R v Secretary of State for Transport, ex p Factortame (No 2)',
    citation: '[1991] 1 AC 603', year: 1990, court: 'House of Lords',
    lay: 'can a United Kingdom court disapply or suspend an Act of Parliament that conflicts with European law',
    named: 'Factortame Secretary of State for Transport interim relief disapply Act of Parliament',
    markers: ['factortame'],
  },
  {
    authority: 'M v Home Office',
    citation: '[1994] 1 AC 377', year: 1993, court: 'House of Lords',
    lay: 'can a government minister be held in contempt of court for disobeying a court order',
    named: 'M v Home Office contempt of court minister of the Crown injunction',
    markers: ['m v home office', 'm. v home office'],
  },
  {
    authority: 'R v North and East Devon Health Authority, ex p Coughlan',
    citation: '[2001] QB 213', year: 1999, court: 'Court of Appeal',
    lay: 'when is a public authority bound by a promise it made to someone about their care',
    named: 'Coughlan North and East Devon Health Authority substantive legitimate expectation home for life',
    markers: ['coughlan'],
  },
  {
    authority: 'Ridge v Baldwin',
    citation: '[1964] AC 40', year: 1963, court: 'House of Lords',
    lay: 'must a public body give someone a hearing before dismissing them from office',
    named: 'Ridge v Baldwin natural justice right to be heard dismissal chief constable',
    markers: ['ridge v baldwin'],
  },
]

interface ArmRow { rank: number; id: string; type: string; date: string; title: string; citation: string }
interface ArmOut {
  arm: 'lay' | 'named'
  query: string
  returned: number
  failed: boolean
  streams: string[]
  /** Rank of a row whose title/citation/id CONTAINS the case name, or -1. A name match is NOT
   *  the authority — see `verdict`. */
  nameMatchRank: number
  /** The matched row, so the classification can be adjudicated by a human rather than trusted. */
  nameMatchRow: ArmRow | null
  /**
   * ⚠ THE CLASSIFIER THAT THE FIRST RUN OF THIS SCRIPT DID NOT HAVE, AND WHY.
   * Run 1 matched on the case name alone and reported 3 of 10 authorities HELD. All three were
   * false: `Caparo` matched a 2017 employment-tribunal claim against Caparo Atlas Fastenings,
   * `Coughlan` matched a 2020 claim by a Mrs M Coughlan, and `GCHQ` matched the STRASBOURG sequel
   * (CCSU v United Kingdom, ECtHR 1987) rather than the House of Lords judgment. A name match is
   * evidence of a DECOY as often as of a holding, which is precisely the failure this sprint is
   * measuring — so the probe must not be able to report HELD on a name alone.
   *   HELD   — a name match dated within [year-1, year+3] and NOT in a tribunal/Strasbourg
   *            collection, i.e. plausibly the judgment itself. Still printed for adjudication.
   *   DECOY  — a name match that is some other case bearing the same name.
   *   ABSENT — no row carrying the name at all.
   */
  verdict: 'HELD' | 'DECOY' | 'ABSENT'
  /** How many of the returned rows are case law at all. */
  caselawRows: number
  /** How many returned rows carry a date before 2001 — ANY type. */
  pre2001Rows: number
  /** ⚠ The one that means something: pre-2001 rows that are CASE LAW. A pre-2001 date on a
   *  legislation row is just the year of an Act and is no evidence of case-law coverage. */
  pre2001CaseRows: number
  top: ArmRow[]
}

const YEAR = (d: string): number | null => {
  const m = /(\d{4})/.exec(d ?? '')
  return m ? Number(m[1]) : null
}

async function arm(p: Probe, which: 'lay' | 'named'): Promise<ArmOut> {
  const query = which === 'lay' ? p.lay : p.named
  const out = await runSearch({
    intent: 'LEGAL_LANDSCAPE' as SearchIntent,
    keywords: query.split(/\s+/),
    limit: 10,
    ...(which === 'named' ? { tier: 'caselaw' } : {}),
  } as Parameters<typeof runSearch>[0])

  const rows: ArmRow[] = out.results.map((r, i) => ({
    rank: i,
    id: r.id,
    type: r.type,
    date: r.date ?? '',
    title: r.title ?? '',
    citation: r.citation ?? '',
  }))
  const hay = (r: ArmRow) => `${r.title} ${r.citation} ${r.id}`.toLowerCase()
  const nameMatchRank = rows.findIndex((r) => p.markers.some((m) => hay(r).includes(m)))
  const nameMatchRow = nameMatchRank >= 0 ? rows[nameMatchRank] : null
  const DECOY_COLLECTIONS = ['et-decisions', 'echr-hudoc', 'tax-tribunals']
  const verdict: 'HELD' | 'DECOY' | 'ABSENT' = (() => {
    if (!nameMatchRow) return 'ABSENT'
    const y = YEAR(nameMatchRow.date)
    const rightEra = y !== null && y >= p.year - 1 && y <= p.year + 3
    const rightPlace = !DECOY_COLLECTIONS.some((c) => nameMatchRow.id.startsWith(c))
    return rightEra && rightPlace ? 'HELD' : 'DECOY'
  })()
  const isCase = (r: ArmRow) => r.type === 'CASE' || r.id.startsWith('tna-caselaw') || r.id.startsWith('ni-judgments') ||
    r.id.startsWith('scottish-courts') || r.id.startsWith('et-decisions') || r.id.startsWith('tax-tribunals') ||
    r.id.startsWith('echr-hudoc')

  return {
    arm: which,
    query,
    returned: rows.length,
    failed: out.failed,
    streams: out.meta.routedStreams ?? [],
    nameMatchRank,
    nameMatchRow,
    verdict,
    caselawRows: rows.filter(isCase).length,
    pre2001Rows: rows.filter((r) => { const y = YEAR(r.date); return y !== null && y < 2001 }).length,
    pre2001CaseRows: rows.filter((r) => { const y = YEAR(r.date); return isCase(r) && y !== null && y < 2001 }).length,
    top: rows,
  }
}

async function main() {
  assertRetrievalConfig('probe-pre2001-caselaw')
  const before = await readServiceConfig()

  const results: Array<{ probe: Probe; lay: ArmOut; named: ArmOut }> = []
  for (const p of PROBES) {
    const lay = await arm(p, 'lay')
    const named = await arm(p, 'named')
    results.push({ probe: p, lay, named })

    console.log(`\n══ ${p.authority} ${p.citation} (${p.year}, ${p.court})`)
    for (const a of [lay, named]) {
      console.log(`  [${a.arm}] "${a.query}"`)
      console.log(`     returned ${a.returned}; streams=${a.streams.join(',') || 'none'}; failed=${a.failed}; ` +
        `caselaw rows ${a.caselawRows}/${a.returned}; pre-2001 case-law rows ${a.pre2001CaseRows}/${a.returned}`)
      console.log(`     THE AUTHORITY ITSELF → ${a.verdict}` +
        (a.nameMatchRow ? `  (name match at rank ${a.nameMatchRank}: ${a.nameMatchRow.date?.slice(0, 10)} ${a.nameMatchRow.title.slice(0, 70)} [${a.nameMatchRow.id.split(':')[0]}])` : ''))
      for (const r of a.top.slice(0, 5)) {
        console.log(`       ${r.rank}. [${r.type}] ${r.date?.slice(0, 10) || '——'}  ${r.title.slice(0, 88)}`)
      }
    }
  }

  console.log('\n──────── SUMMARY (n=10; an illustration of a gap, NOT a score) ────────')
  let absent = 0
  let decoyed = 0
  let confidentlyOther = 0
  for (const { probe, lay, named } of results) {
    const held = named.verdict === 'HELD' || lay.verdict === 'HELD'
    const decoy = !held && (named.verdict === 'DECOY' || lay.verdict === 'DECOY')
    if (!held) absent++
    if (decoy) decoyed++
    // "Confidently wrong" as the brief means it: the authority is absent, yet the lay arm still
    // returned a full page of results that a model would read as the answer.
    if (!held && lay.returned > 0) confidentlyOther++
    const decoyRow = named.verdict === 'DECOY' ? named.nameMatchRow : null
    console.log(`  ${held ? 'HELD   ' : decoy ? 'DECOY  ' : 'ABSENT '} ${probe.authority} — lay returned ` +
      `${lay.returned} (${lay.caselawRows} case law, ${lay.pre2001CaseRows} of them pre-2001)` +
      (decoyRow ? `; the case-law arm's top name match: rank ${named.nameMatchRank}, ` +
        `${decoyRow.date?.slice(0, 10)} ${decoyRow.title.slice(0, 60)}` : ''))
  }
  console.log(`
  authority NOT held: ${absent}/10`)
  console.log(`  of those, a same-name DIFFERENT case was returned instead: ${decoyed}/10`)
  console.log(`  absent AND the lay query still returned a full answer set: ${confidentlyOther}/10`)

  const after = await readServiceConfig()
  console.log(`\n${resolvedConfigLine()}`)
  console.log(servedDelta(before, after))

  const i = process.argv.indexOf('--json')
  if (i >= 0 && process.argv[i + 1]) {
    fs.writeFileSync(process.argv[i + 1], JSON.stringify({ config: resolvedConfigLine(), results }, null, 2))
    console.log(`\nwrote ${process.argv[i + 1]}`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
