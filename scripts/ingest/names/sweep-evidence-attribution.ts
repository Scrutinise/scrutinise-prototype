/**
 * sweep-evidence-attribution.ts — BRIEF_INGEST_NAMES §2.2, the half that needs a metadata sweep.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE SOURCE PUBLISHES (§2.1, probed live 19 Aug 2026 — real responses in the report)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * `committees-api.parliament.uk` publishes a `witnesses[]` array on BOTH evidence kinds:
 *
 *     { "submitterType": "Organisation", "name": null,
 *       "organisations": [ { "name": "International Alert", "role": "Head of Advocacy" } ] }
 *     { "submitterType": "Individual",   "name": "Mikaela Gavas",
 *       "organisations": [ { "name": "Center for Global Development", "role": "Visiting Fellow" } ] }
 *
 * ⚠ THE NAME LIVES IN A DIFFERENT PLACE DEPENDING ON `submitterType`, and reading only `.name`
 * would have silently dropped every organisation submission — `.name` is NULL on those. That is
 * not a rare shape: on the OralEvidence listing, 82 of 100 items had `.organisations` and only 47
 * had a witness `.name`.
 *
 * ⚠⚠ HOST NOTE. `committees.parliament.uk` (the PORTAL) refuses Node's `fetch` — Cloudflare TLS
 * fingerprinting, documented in `sources/committees-portal.ts`, and a previous sprint burned 300
 * probes on 403s by not reading it. `committees-api.parliament.uk` (the API) is a different host
 * and carries no challenge. This sweep touches the API host only, through the SAME client the
 * live ingest uses.
 *
 * ⚠ ROUTE COST, MEASURED BEFORE IT WAS CHOSEN. Unwindowed `WrittenEvidence` listing HTTP 500s
 * (33.6 s, reproduced). Month-windowed listing serves 100 items in ~4.7 s. Per-item detail
 * averages 157 ms at concurrency 4 but needs 126,509 calls. Listing wins: ~1,400 pages against
 * 142,315 detail calls, and it is METADATA ONLY — the alternative of re-fetching document text is
 * 508 million words and was never on the table.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS WRITTEN, AND THE ONE DISTINCTION THAT MATTERS MOST
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Under `lib/lex/attribution.ts`'s contract, `speaker` is a PERSON and `attribution` is a BODY.
 *
 *   written evidence, Individual    → speaker      = the person who submitted it
 *   written evidence, Organisation  → attribution  = the organisation that submitted it
 *   oral evidence                   → attribution  = the witnesses AT THAT SESSION, as a list
 *
 * ⚠⚠ ORAL EVIDENCE IS A SESSION-LEVEL FACT AND IS DELIBERATELY NOT WRITTEN AS A SPEAKER. We hold
 * one row per whole transcript (mean 14,190 words), so "who said this sentence" is not a question
 * our data can answer; what the source can tell us is who appeared. Writing that list into
 * `speaker` would make a panel of four look like one person talking. It goes into `attribution`
 * as a body-level fact and the report says plainly that per-speech attribution is NOT DONE and
 * needs a granularity change, not a field.
 *
 * ⚠ A COMMITTEE'S OWN CONCLUSION IS NEVER ATTRIBUTED TO A WITNESS. That population is
 * `committees-reports` and is handled by `backfill-committee-attribution.ts`, which attributes it
 * to the committee — and refuses to attribute a Government Response to anyone.
 *
 * ⚠ ANONYMOUS SUBMISSIONS STAY ANONYMOUS. The API carries `anonymous: true`; those rows are left
 * NULL whatever the witness array says.
 *
 *   --measure    (default) sweep the API, write nothing, report projected coverage
 *   --apply      write speaker / attribution
 *   --kind=written|oral   restrict to one kind
 *   --months=N   only sweep the N most recent months (pilot)
 *   --self-test  watch every check fail before trusting it to pass
 */
import { namesPool as getNeonPool, endNamesPool as endNeonPool } from './names-pool'
import {
  attributeWritten, attributeOral, witnessName, dedupeJoin,
  type CommitteeEvidenceItem, type CommitteeWitness, type Attributed,
} from '../shared/committee-attribution'

const API = 'https://committees-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'
const PAGE = 100
const CONCURRENCY = parseInt(process.env.NAMES_API_CONCURRENCY ?? '3', 10)
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]

interface EvidenceItem extends CommitteeEvidenceItem {
  id?: number
  anonymousWitnessText?: string | null
  publicationDate?: string
}

// ── the API walk ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function apiGet(path: string, tries = 3): Promise<any> {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': UA } })
      if (res.ok) return await res.json()
      // ⚠ A 500 here is the documented deep-offset/unwindowed failure, not a transient. Retrying
      // it is the behaviour §13 forbids, so it is reported and the caller narrows the window.
      if (res.status === 500) return { __error: 500 }
      if (res.status === 429 || res.status === 503) { await sleep(4000 * (t + 1)); continue }
      return { __error: res.status }
    } catch {
      await sleep(2000 * (t + 1))
    }
  }
  return { __error: 0 }
}

/** Every month from the first stored publication to now — the window the listing endpoint needs. */
function months(from: string, to: string): Array<{ start: string; end: string; label: string }> {
  const out: Array<{ start: string; end: string; label: string }> = []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const mm = String(m).padStart(2, '0')
    out.push({ start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}`, label: `${y}-${mm}` })
    if (++m > 12) { m = 1; y++ }
  }
  return out
}

async function sweepKind(
  kind: 'WrittenEvidence' | 'OralEvidence',
  windows: Array<{ start: string; end: string; label: string }>,
): Promise<Map<number, Attributed>> {
  const attribute = kind === 'WrittenEvidence' ? attributeWritten : attributeOral
  const found = new Map<number, Attributed>()
  let pages = 0, errors = 0, truncated = 0

  const runWindow = async (w: { start: string; end: string; label: string }) => {
    let skip = 0
    for (;;) {
      const j = await apiGet(`/${kind}?Skip=${skip}&Take=${PAGE}&StartDate=${w.start}&EndDate=${w.end}`)
      pages++
      if (j?.__error !== undefined) {
        errors++
        console.warn(`\n  ⚠ ${kind} ${w.label} skip=${skip}: HTTP ${j.__error} — WINDOW INCOMPLETE, counted`)
        truncated++
        return
      }
      const items: EvidenceItem[] = j?.items ?? []
      for (const it of items) found.set(it.id, attribute(it))
      skip += items.length
      if (items.length < PAGE || skip >= (j?.totalResults ?? 0)) return
    }
  }

  let i = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const k = i++
      if (k >= windows.length) return
      await runWindow(windows[k])
      process.stdout.write(`  ${kind}: window ${Math.min(i, windows.length)}/${windows.length}, ${found.size} items, ${pages} pages, ${errors} errors\r`)
    }
  }))
  console.log(`\n  ${kind}: ${found.size} items from ${pages} pages; ${errors} failed pages, ${truncated} INCOMPLETE windows`)
  return found
}

async function run(apply: boolean): Promise<void> {
  const pool = getNeonPool()
  const only = arg('kind')
  const monthsBack = arg('months') ? parseInt(arg('months')!, 10) : null

  const kinds: Array<{ api: 'WrittenEvidence' | 'OralEvidence'; prefix: string }> = ([
    { api: 'WrittenEvidence' as const, prefix: 'writtenevidence' },
    { api: 'OralEvidence' as const, prefix: 'oralevidence' },
  ]).filter(k => !only || (only === 'written' ? k.api === 'WrittenEvidence' : k.api === 'OralEvidence'))

  for (const k of kinds) {
    // The window range comes from OUR stored rows, so the sweep covers what we hold.
    const range = (await pool.query(
      `SELECT to_char(MIN("itemDate"),'YYYY-MM') lo, to_char(MAX("itemDate"),'YYYY-MM') hi,
              COUNT(*)::int n, COUNT(DISTINCT "parentDocId")::int items
         FROM corpus_sections WHERE corpus='committees-evidence' AND "parentDocId" LIKE $1`,
      [`${k.prefix}:%`])).rows[0]
    let windows = months(range.lo ?? '2018-01', range.hi ?? '2026-08')
    if (monthsBack) windows = windows.slice(-monthsBack)
    console.log(`\n${'═'.repeat(90)}\n${k.api}: ${range.items} stored items, ${range.lo}..${range.hi}, ${windows.length} month windows\n${'═'.repeat(90)}`)

    const found = await sweepKind(k.api, windows)

    // Join to OUR rows: parentDocId is "{prefix}:{itemId}".
    const rows = (await pool.query(
      `SELECT id, "parentDocId" FROM corpus_sections
        WHERE corpus='committees-evidence' AND "parentDocId" LIKE $1`, [`${k.prefix}:%`])).rows

    const tally: Record<string, number> = {}
    const bump = (t: string) => { tally[t] = (tally[t] ?? 0) + 1 }
    const upd: Array<{ id: string; speaker: string | null; attribution: string | null }> = []
    for (const r of rows) {
      const itemId = Number(String(r.parentDocId).split(':')[1])
      const a = found.get(itemId)
      if (!a) { bump('miss:item-not-returned-by-api'); continue }
      if (a.miss) { bump(`miss:${a.miss}`); continue }
      bump(a.speaker ? 'attributed:speaker(person)' : 'attributed:attribution(body)')
      upd.push({ id: r.id, speaker: a.speaker, attribution: a.attribution })
    }

    console.log(`\n  OUTCOMES over ${rows.length} stored ${k.prefix} rows:`)
    for (const [t, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${t.padEnd(38)} ${String(v).padStart(7)}  ${(100 * v / rows.length).toFixed(2)}%`)
    }

    if (apply && upd.length) {
      for (let s = 0; s < upd.length; s += 5000) {
        const b = upd.slice(s, s + 5000)
        await pool.query(
          `UPDATE corpus_sections AS c SET speaker = v.speaker, attribution = v.attribution
             FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS speaker, unnest($3::text[]) AS attribution) AS v
            WHERE c.id = v.id AND c.corpus = 'committees-evidence'`,
          [b.map(x => x.id), b.map(x => x.speaker), b.map(x => x.attribution)])
      }
      console.log(`  WROTE ${upd.length} rows.`)
    }
  }

  const state = (await pool.query(
    `SELECT split_part("parentDocId",':',1) kind, COUNT(*)::int n,
            COUNT(speaker)::int spk, COUNT(attribution)::int attr
       FROM corpus_sections WHERE corpus='committees-evidence' GROUP BY 1`)).rows
  console.log('\nCORPUS STATE (committees-evidence):')
  console.table(state)
  await endNeonPool()
}

// ── §3: every check watched failing first ────────────────────────────────────────────────────
function selfTest(): void {
  const ORG: CommitteeWitness = { submitterType: 'Organisation', name: null, organisations: [{ name: 'International Alert', role: 'Head of Advocacy' }] }
  const IND: CommitteeWitness = { submitterType: 'Individual', name: 'Mikaela Gavas', organisations: [{ name: 'Center for Global Development' }] }
  const EMPTY: CommitteeWitness = { submitterType: 'Individual', name: null, organisations: [] }
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: '⚠ an ORGANISATION submitter is read from organisations[], not from the null .name',
      run: () => witnessName(ORG)?.name === 'International Alert' && witnessName(ORG)?.kind === 'body' },
    { name: 'an INDIVIDUAL submitter is a PERSON, and their organisation is not used instead',
      run: () => witnessName(IND)?.name === 'Mikaela Gavas' && witnessName(IND)?.kind === 'person' },
    { name: 'a witness with neither name nor organisation is a MISS, not "Individual"',
      run: () => witnessName(EMPTY) === null },
    { name: '⚠⚠ an ANONYMOUS submission is never named, whatever the witness array says',
      run: () => attributeWritten({ anonymous: true, witnesses: [IND] }).speaker === null },
    { name: 'an individual written submission lands in SPEAKER, not attribution',
      run: () => { const a = attributeWritten({ witnesses: [IND] }); return a.speaker === 'Mikaela Gavas' && a.attribution === null } },
    { name: 'an organisation written submission lands in ATTRIBUTION, not speaker',
      run: () => { const a = attributeWritten({ witnesses: [ORG] }); return a.attribution === 'International Alert' && a.speaker === null } },
    { name: '⚠⚠ an ORAL panel never lands in speaker — four witnesses must not read as one person',
      run: () => { const a = attributeOral({ witnesses: [IND, ORG] }); return a.speaker === null && a.attribution === 'Mikaela Gavas; International Alert' } },
    { name: 'a joint WRITTEN submission is a body list, not a person',
      run: () => { const a = attributeWritten({ witnesses: [IND, IND] }); return a.speaker === null && a.attribution === 'Mikaela Gavas' } },
    { name: 'two witnesses from one organisation dedupe to one name',
      run: () => attributeOral({ witnesses: [ORG, { ...ORG }] }).attribution === 'International Alert' },
    { name: 'an item with NO witnesses is a counted miss, not an empty string',
      run: () => { const a = attributeOral({ witnesses: [] }); return a.attribution === null && a.miss === 'no-witness-record' } },
    { name: 'the month walker covers a year boundary',
      run: () => { const m = months('2019-11', '2020-02'); return m.length === 4 && m[0].label === '2019-11' && m[3].label === '2020-02' && m[1].end === '2019-12-31' } },
    { name: 'February leap year gets 29 days, not 28',
      run: () => months('2020-02', '2020-02')[0].end === '2020-02-29' },
  ]
  let pass = 0
  for (const c of cases) {
    const ok = c.run()
    console.log(`  ${ok ? '✓ FIRED' : '✗ DID NOT FIRE'}  ${c.name}`)
    if (ok) pass++
  }
  console.log(`\nself-test: ${pass}/${cases.length}`)
  if (pass !== cases.length) process.exit(1)
}

;(async () => {
  if (process.argv.includes('--self-test')) return selfTest()
  await run(process.argv.includes('--apply'))
})().catch(e => { console.error(e); process.exit(1) })
