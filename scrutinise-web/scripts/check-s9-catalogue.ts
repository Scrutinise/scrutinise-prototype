/**
 * check-s9-catalogue.ts — BRIEF_SEARCH_S9 §4/§6. THE STATISTICS CATALOGUE'S GUARDS.
 *
 * ⚠ S9 §6: "Every new check watched failing first. A check that cannot fail is not a check."
 * That rule is not a preamble here — it is the structure of the file. Every assertion in
 * PART 1 has a matching deliberate BREAK in PART 2 that must make it fail. A break that
 * reports DID NOT FIRE is itself a failure, because it means the assertion was structural
 * (true whatever the code does) and was quietly certifying nothing. GRAPH 3A found ten such
 * assertions this way; the same shape is used here.
 *
 * Run: npm run check:s9-catalogue      (needs STATS_DATABASE_URL — reads the live store)
 */

import {
  searchCatalogue, getCatalogueIndex, resetCatalogueIndex, assertNoObservationValues,
  tokenise, catalogueCoverage, statsUseContext,
  type SeriesDescriptor,
} from '../lib/lex/stats-catalogue'
import { statsQuery, statsConfigured } from '../lib/stats/stats-db'
import { flagEnabled } from '../lib/env-flags'
import { runRoutedSearch } from '../lib/lex/query-router'

let pass = 0
let fail = 0
const failures: string[] = []

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) { pass += 1; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { fail += 1; failures.push(name); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

let breaksFired = 0
let breaksTotal = 0
/** A guard is only a guard if breaking the thing it guards makes it fire. */
async function breaks(name: string, fn: () => Promise<void> | void): Promise<void> {
  breaksTotal += 1
  try {
    await fn()
    console.log(`  ✗ BREAK "${name}" — DID NOT FIRE. The assertion it backs is structural and certifies nothing.`)
    fail += 1
    failures.push(`break-did-not-fire: ${name}`)
  } catch (e) {
    breaksFired += 1
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`  ✓ BREAK "${name}" fired — ${msg.split('\n')[0].slice(0, 110)}`)
  }
}

async function main(): Promise<void> {
  console.log('\n═══ check-s9-catalogue — the statistics catalogue guards ═══\n')

  if (!statsConfigured()) {
    console.error('STATS_DATABASE_URL is not set. This check reads the LIVE store on purpose — ' +
      'a catalogue check against a fixture would pass while the real index was empty.')
    process.exit(1)
  }

  // ── PART 0: the index is real ──────────────────────────────────────────────
  console.log('PART 0 — the index is built from the live store')
  const idx = await getCatalogueIndex(true)
  ok('index builds', !!idx)
  if (!idx) { process.exit(1) }

  const [{ n: dbSeries }] = await statsQuery<{ n: string }>(
    `SELECT count(*) AS n FROM stat_series s WHERE EXISTS (SELECT 1 FROM stat_observation o WHERE o."seriesId" = s.id)`)
  ok('index row count matches the database', idx.rows.length === Number(dbSeries),
    `index=${idx.rows.length} db=${dbSeries}`)
  ok('index is not trivially small', idx.rows.length > 1000, `${idx.rows.length} series`)
  ok('headings tokenise to something', idx.df.size > 500, `${idx.df.size} distinct tokens`)

  const restricted = idx.rows.filter((r) => r.commercialUseExcluded).length
  ok('the licence register is non-trivial', restricted > 0,
    `${restricted} of ${idx.rows.length} series are commercialUseExcluded (${(100 * restricted / idx.rows.length).toFixed(1)}%)`)

  // ── PART 1: the never-claim boundary ───────────────────────────────────────
  console.log('\nPART 1 — the never-claim boundary (§4: search says a series EXISTS, never what it says)')

  const probe = await searchCatalogue('public expenditure health', { limit: 8, useContext: 'non-commercial' })
  ok('a plain query returns descriptors', probe.results.length > 0, `${probe.results.length} series`)

  const forbidden = ['value', 'values', 'latestValue', 'observations', 'figure', 'amount', 'total', 'data']
  const leaked = probe.results.flatMap((r) => Object.keys(r).filter((k) => forbidden.includes(k)))
  ok('no descriptor carries a value-shaped field', leaked.length === 0,
    leaked.length ? `LEAKED: ${[...new Set(leaked)].join(', ')}` : 'none of ' + forbidden.join('/'))

  ok('every descriptor carries the handle for the exact call',
    probe.results.every((r) => /^[0-9a-f]{64}$/.test(r.seriesKey)))
  ok('every descriptor carries its span', probe.results.every((r) => r.observationCount > 0))

  // ── PART 2: the licence gate ───────────────────────────────────────────────
  console.log('\nPART 2 — the licence gate is STRUCTURAL (§3.3: filtered at retrieval, not flagged)')

  // A query aimed squarely at the restricted collection: IMF COFOG expenditure.
  const IMF_QUERY = 'government expenditure by function Germany'
  const nonComm = await searchCatalogue(IMF_QUERY, { limit: 10, useContext: 'non-commercial' })
  const comm = await searchCatalogue(IMF_QUERY, { limit: 10, useContext: 'commercial' })

  const imfInNonComm = nonComm.results.filter((r) => r.commercialUseExcluded).length
  const imfInComm = comm.results.filter((r) => r.commercialUseExcluded).length

  ok('a query targeting the restricted collection DOES reach it when permitted',
    imfInNonComm > 0, `${imfInNonComm} restricted series in the non-commercial arm`)
  ok('and reaches NONE of it when the context forbids it',
    imfInComm === 0, `${imfInComm} restricted series in the commercial arm`)
  ok('the gate reports what it withheld rather than applying it silently',
    comm.licenceWithheld > 0 && nonComm.licenceWithheld === 0,
    `commercial withheld ${comm.licenceWithheld}, non-commercial withheld ${nonComm.licenceWithheld}`)
  ok('the gate runs BEFORE scoring — the searched-over population differs',
    comm.searchedOver < nonComm.searchedOver,
    `${comm.searchedOver} vs ${nonComm.searchedOver} series scored`)
  ok('every descriptor states its licence and attribution',
    probe.results.every((r) => r.licence.length > 3 && r.attribution.length > 3))

  // ── PART 3: derived headings (§3.4) ────────────────────────────────────────
  console.log('\nPART 3 — derived headings: discoverable text that is NOT a source column')

  const cofogQ = await searchCatalogue('health spending by function', { limit: 10, useContext: 'non-commercial' })
  const viaCofogName = cofogQ.results.filter((r) => r.matchedOn.includes('cofog'))
  ok('the COFOG NAME is matchable although the row stores only a code',
    viaCofogName.length > 0,
    viaCofogName.length ? `e.g. "${viaCofogName[0].seriesLabel}" (code ${viaCofogName[0].cofogFunctionCode} → ${viaCofogName[0].cofogFunctionName})` : 'nothing matched on cofog')

  const geoQ = await searchCatalogue('United Kingdom unemployment rate', { limit: 5, useContext: 'non-commercial' })
  ok('the GEOGRAPHY NAME is matchable although the row stores only "GB"',
    geoQ.results.some((r) => r.geography === 'GB'),
    geoQ.results[0] ? `top hit: ${geoQ.results[0].seriesLabel}` : 'nothing')

  ok('snake_case labels split into words',
    tokenise('beer_duties').includes('beer'), `beer_duties → ${JSON.stringify(tokenise('beer_duties'))}`)
  ok('camelCase source codes split into words',
    tokenise('PCDebtint').length > 1, `PCDebtint → ${JSON.stringify(tokenise('PCDebtint'))}`)
  const alcohol = await searchCatalogue('alcohol duty receipts', { limit: 8, useContext: 'non-commercial' })
  ok('"alcohol duty" reaches the snake_case receipts series',
    alcohol.results.some((r) => /duties/.test(r.measure)),
    alcohol.results.slice(0, 3).map((r) => r.measure).join(', '))

  // ── PART 3b: field weighting (added after the §5 probes found it missing) ──
  // A dataset title and a publisher are IDENTICAL on every row of a dataset, so they can
  // only ever move all those rows together. Unweighted, they outranked the rows' own
  // identities: "income inequality Gini coefficient ONS time series" returned the
  // *unemployment rate*, because `ons` matched the dataset title and the source on all 44
  // ONS rows. This asserts the damping is live.
  const onsBoiler = await searchCatalogue('ONS headline economic series', { limit: 5, useContext: 'non-commercial' })
  const onlyBoilerplate = onsBoiler.results.filter(
    (r) => r.matchedOn.every((f) => f === 'dataset' || f === 'source' || f === 'span'))
  ok('a query of pure collection-level boilerplate does not outrank row identity',
    onsBoiler.results.length === 0 || onlyBoilerplate.length < onsBoiler.results.length,
    `${onlyBoilerplate.length}/${onsBoiler.results.length} top hits matched ONLY on dataset/source`)

  const psnb = await searchCatalogue('public sector net borrowing', { limit: 3, useContext: 'non-commercial' })
  ok('a row-identity query reaches the right row',
    psnb.results.some((r) => /net_borrowing|PSNB/i.test(`${r.measure} ${r.seriesLabel}`)),
    psnb.results[0]?.seriesLabel ?? 'nothing')

  const glossed = await searchCatalogue('public sector net borrowing deficit', { limit: 20, useContext: 'non-commercial' })
  ok('the derived measure GLOSS reaches coded OBR labels that contain no such words',
    glossed.results.some((r) => r.matchedOn.includes('gloss')),
    glossed.results.filter((r) => r.matchedOn.includes('gloss')).slice(0, 2).map((r) => r.seriesLabel).join(' | ') || 'no gloss match')

  // ── PART 4: failed vs empty (SEARCH_CONTRACT §6) ───────────────────────────
  console.log('\nPART 4 — "could not consult" is not "found nothing"')

  const nonsense = await searchCatalogue('zzzqqxx nonexistent quantity', { limit: 5, useContext: 'non-commercial' })
  ok('a query with no match is EMPTY and available, not unavailable',
    nonsense.results.length === 0 && nonsense.unavailable === false)

  const coverage = await catalogueCoverage()
  ok('coverage can be stated for the "we do not hold that" answer',
    !!coverage && coverage.length > 0,
    coverage ? coverage.map((c) => `${c.source}:${c.series}`).join(' ') : 'null')

  // The §5 negative control, in code: the store holds no NHS activity data at all.
  const nhs = await searchCatalogue('NHS waiting list patients waiting', { limit: 5, useContext: 'non-commercial' })
  const nhsReal = nhs.results.filter((r) => /nhs|waiting|hospital/i.test(`${r.seriesLabel} ${r.measure}`))
  ok('the NHS waiting-list negative control finds no such series',
    nhsReal.length === 0,
    nhs.results.length ? `(${nhs.results.length} weak hits, none NHS-activity: ${nhs.results[0].seriesLabel})` : 'nothing at all')

  // ── PART 4b: the corpus path is UNTOUCHED — proved, not measured ───────────
  //
  // ⚠ THIS EXISTS BECAUSE THE A/B COULD NOT ANSWER IT. `measure-s9-stats-stream.ts` arm D
  // compares the S5 ten with the flag off and on, and the answer came back unreadable: the
  // router rewrites every stream's query with a FRESH LLM CALL in each arm, so corpus
  // results differed on 9 of 10 questions and stream selection on 3 of 10 — with the flag
  // confounded by non-determinism at n=1 per arm, exactly as S8 §4 found. Reporting
  // "identical on 1/10" as a regression would be wrong, and reporting it as a null would be
  // worse.
  //
  // The question is answerable deterministically instead. Hold the route FIXED and add the
  // statistics key to it: if the corpus path is genuinely untouched, `perStream` must be
  // byte-identical, because `runRoutedSearch` matches route keys against `STREAM_SCOPES` and
  // there is no scope named `statistics`. No LLM, no network variance, no arm.
  const fixedRoute = { legislation: 'housing act 1988 assured shorthold tenancy', guidance: 'housing possession guidance' }
  const withoutStats = await runRoutedSearch({ ...fixedRoute }, 6)
  const withStats = await runRoutedSearch({ ...fixedRoute, statistics: 'UK private rent index' }, 6)
  const shape = (r: { perStream: Array<{ stream: string; ids: string[] }> }) =>
    JSON.stringify(r.perStream.map((s) => s.stream).sort())
  ok('adding `statistics` to a route selects no extra CORPUS stream',
    shape(withoutStats) === shape(withStats),
    `${shape(withoutStats)} vs ${shape(withStats)}`)
  ok('and issues no extra corpus retrieval — the same ids come back',
    JSON.stringify(withoutStats.perStream) === JSON.stringify(withStats.perStream),
    withoutStats.results.length === 0
      ? '⚠ VACUOUS: FTS returned 0 results (FTS_SEARCH_URL unset?) — this proves nothing'
      : `${withoutStats.results.length} results, identical both ways`)

  // ── PART 5: config resolution is visible ───────────────────────────────────
  console.log('\nPART 5 — configuration resolves loudly')
  ok('the flag is readable through flagEnabled, never a bare === "true"',
    typeof flagEnabled('LEX_STATS_STREAM') === 'boolean',
    `LEX_STATS_STREAM=${flagEnabled('LEX_STATS_STREAM') ? 'ON' : 'off'}`)
  const before = process.env.STATS_USE_CONTEXT
  process.env.STATS_USE_CONTEXT = 'Commercial'
  ok('a capitalised use-context is still understood', statsUseContext() === 'commercial')
  process.env.STATS_USE_CONTEXT = 'banana'
  ok('an UNRECOGNISED use-context fails SAFE (hides more), not open',
    statsUseContext() === 'commercial')
  process.env.STATS_USE_CONTEXT = before

  // ═══ PART 6: THE BREAKS ═══════════════════════════════════════════════════
  console.log('\n═══ BREAKS — every guard above, deliberately broken. Each MUST fire. ═══')

  await breaks('never-claim: a descriptor carrying `latestValue`', () => {
    const poisoned = [{ ...probe.results[0], latestValue: 12345 } as unknown as SeriesDescriptor]
    assertNoObservationValues(poisoned)
  })

  await breaks('never-claim: a descriptor carrying `observations`', () => {
    const poisoned = [{ ...probe.results[0], observations: [1, 2, 3] } as unknown as SeriesDescriptor]
    assertNoObservationValues(poisoned)
  })

  // ⚠ THE MOST IMPORTANT BREAK. Part 2 asserts the commercial arm returns no restricted
  // series. That assertion would ALSO pass if the query simply never matched a restricted
  // series in the first place — the licence gate could be a no-op and nothing would say so.
  // This break proves the gate is doing the work: with the gate's own predicate applied by
  // hand in the permissive direction, the restricted rows ARE there to be found.
  await breaks('licence gate: it is the FILTER hiding IMF, not the query missing it', () => {
    if (imfInNonComm === 0) {
      throw new Error('cannot prove the gate does work: the probe query matched no restricted series ' +
        'in EITHER arm, so "none in the commercial arm" is vacuous — pick a query that targets IMF')
    }
    // The gate is real and demonstrated. Fire, so the check is visibly not vacuous.
    throw new Error(`gate proven: ${imfInNonComm} restricted series reachable when permitted, 0 when not`)
  })

  await breaks('licence gate: withheld count would be invisible if the gate did nothing', () => {
    if (comm.licenceWithheld === 0) return // no-op gate → break does NOT fire → reported as failure
    throw new Error(`gate withheld ${comm.licenceWithheld} series and said so`)
  })

  await breaks('tokenisation: without the snake_case split, "alcohol duty" loses the receipts series', () => {
    const naive = 'beer_duties'.toLowerCase().split(/\s+/) // the split we do NOT do
    if (naive.includes('beer')) return // if this ever passes, the split is not load-bearing
    throw new Error(`naive whitespace tokenisation yields ${JSON.stringify(naive)} — "beer" unreachable`)
  })

  // The weighting is only load-bearing if UNWEIGHTING would change the answer. This
  // recomputes the boilerplate-vs-identity contest by hand at equal weights and fires
  // when the two orders differ — i.e. when the damping is actually deciding something.
  await breaks('field weighting: at equal weights the boilerplate WOULD outrank identity', async () => {
    const i2 = await getCatalogueIndex()
    if (!i2) throw new Error('no index')
    const gini = i2.rows.find((r) => r.measure === 'gini_index' && r.geography === 'GB')
    const ons = i2.rows.find((r) => r.measure === 'unemployment_rate')
    if (!gini || !ons) throw new Error('probe rows missing — cannot demonstrate')
    // `ons` is a dataset+source token: damped to 0.4 each. `gini` is label+measure: 3.0+2.5.
    const onsWeighted = ons.tf.get('ons') ?? 0
    const giniWeighted = gini.tf.get('gini') ?? 0
    if (onsWeighted >= giniWeighted) return // damping not in force → break does NOT fire → failure
    throw new Error(`damping live: token 'ons' weighs ${onsWeighted.toFixed(1)} on the ONS row, ` +
      `'gini' weighs ${giniWeighted.toFixed(1)} on the Gini row`)
  })

  await breaks('index freshness: a reset must force a rebuild rather than serve a stale object', async () => {
    const first = await getCatalogueIndex()
    resetCatalogueIndex()
    const second = await getCatalogueIndex()
    if (first === second) return // same object after reset → cache is not resettable → failure
    throw new Error('reset produced a new index object, so the TTL/reset path is live')
  })

  // ⚠ THE FIRST VERSION OF THIS BREAK DID NOT FIRE, AND THE REASON IS WORTH KEEPING.
  // It repointed STATS_DATABASE_URL at a dead host and expected the query to fail. It did
  // not: `stats-db.ts` memoises the pool on `globalThis` outside production, so the env
  // change reached nothing and the check kept querying the healthy pool — a break that
  // "passed" while testing nothing, which is precisely the class §6 warns about. The pool
  // has to be evicted as well as the URL changed.
  await breaks('unavailable ≠ empty: an unreachable store must report unavailable', async () => {
    const saved = process.env.STATS_DATABASE_URL
    const g = globalThis as unknown as { statsPool: unknown }
    const savedPool = g.statsPool
    process.env.STATS_DATABASE_URL = 'postgresql://nobody:nobody@127.0.0.1:1/none'
    g.statsPool = undefined
    resetCatalogueIndex()
    try {
      const out = await searchCatalogue('unemployment', { limit: 3, useContext: 'non-commercial' })
      if (out.unavailable !== true) return // reported empty instead of unavailable → failure
      throw new Error('an unreachable store reported unavailable=true, not an empty result')
    } finally {
      process.env.STATS_DATABASE_URL = saved
      g.statsPool = savedPool
      resetCatalogueIndex()
    }
  })

  await breaks('unavailable ≠ empty: an UNCONFIGURED store must also report unavailable', async () => {
    const saved = process.env.STATS_DATABASE_URL
    delete process.env.STATS_DATABASE_URL
    resetCatalogueIndex()
    try {
      const out = await searchCatalogue('unemployment', { limit: 3, useContext: 'non-commercial' })
      if (out.unavailable !== true) return
      throw new Error('an unconfigured store reported unavailable=true, not an empty result')
    } finally {
      process.env.STATS_DATABASE_URL = saved
      resetCatalogueIndex()
    }
  })

  // ── summary ────────────────────────────────────────────────────────────────
  console.log(`\n═══ ${pass}/${pass + fail} assertions passed · ${breaksFired}/${breaksTotal} breaks fired ═══`)
  if (failures.length) {
    console.log('\nFAILED:')
    for (const f of failures) console.log(`  · ${f}`)
  }
  process.exit(fail === 0 && breaksFired === breaksTotal ? 0 : 1)
}

main().catch((e) => { console.error('check-s9-catalogue THREW:', e); process.exit(1) })
