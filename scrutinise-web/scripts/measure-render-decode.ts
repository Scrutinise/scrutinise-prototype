/**
 * measure-render-decode.ts — WHAT DOES A USER ACTUALLY SEE, AND WHAT DOES DECODING CHANGE?
 *
 * `docs/ENTITY_DECODE_REPORT.md` measured the corpus. This measures the SURFACE: the values that
 * come back from the live serving path, which is the only place a rendering defect can be seen.
 *
 * Three parts, and they answer different questions:
 *
 *   §A  THE STORED VALUES the web app reads from Neon — corpus_sections titles/speakers, the
 *       legacy LegislationSection/OperationalSection text `lib/search.ts` serves. The 17 Aug
 *       repair should hold these at 0; anything above 0 is either a regression or a table that
 *       repair never covered, and the two are distinguishable only by looking.
 *
 *   §B  THE SERVED VALUES that come out of the live FTS/vector services — snippets and index
 *       titles built from R2, which the repair did NOT touch. This is the number the render-side
 *       decode exists to move, so it is measured BEFORE the decode is trusted and again after.
 *
 *   §C  THE SAME DOCUMENTS THROUGH `runFtsSearch` — what the platform hands on, rather than what
 *       the service served. ⚠ Tied to §B BY ID: a clean §C over a different result set would be
 *       consistent with "the contaminated documents simply did not come back this time", which is
 *       not the claim being made.
 *
 * Read-only. No LLM calls. `--db-only` / `--live-only` to run part of it.
 */
import { Client } from 'pg'
import { decodeForDisplay, hasLiteralEntity } from '../lib/html-entities'

const ENTITY_SQL = '&(#x[0-9a-fA-F]{2,6}|#[0-9]{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});'
const FTS_URL = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app'
const VECTOR_URL = process.env.VECTOR_SEARCH_URL

// The corpora the census found contaminated, worst first, with a query that reaches each.
const LIVE_PROBES: Array<{ corpus: string; query: string }> = [
  { corpus: 'tna-caselaw', query: 'appeal judgment evidence' },
  { corpus: 'planning-policy', query: 'development plan policy' },
  { corpus: 'building-regs', query: 'fire safety requirement' },
  { corpus: 'hmrc-codes-guidance', query: 'tax relief entitlement' },
  { corpus: 'eur-lex', query: 'regulation directive market' },
  { corpus: 'committees-evidence', query: 'witness evidence committee' },
  // a control: the census found these clean, so decoding must change nothing here
  { corpus: 'pwdata-debates', query: 'housing policy debate' },
]

interface FtsHit {
  id: string; corpus: string; sectionTitle: string | null; speaker: string | null; snippet: string
}

/** A readable window centred on the first literal entity, or the opening if there is none. */
function window(value: string, width = 110): string {
  const flat = (value ?? '').replace(/\s+/g, ' ')
  const at = flat.search(/&(#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});/)
  if (at < 0) return flat.slice(0, width)
  const from = Math.max(0, at - 45)
  return (from ? '…' : '') + flat.slice(from, from + width) + (from + width < flat.length ? '…' : '')
}

async function db() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  const who = await c.query<{ db: string; host: string | null }>(
    `SELECT current_database() AS db, coalesce(inet_server_addr()::text, 'managed') AS host`)
  console.log(`\n════ §A STORED VALUES — ${who.rows[0].db} @ ${who.rows[0].host} ════`)

  const probes: Array<[string, string, string]> = [
    ['corpus_sections', '"sectionTitle"', 'repaired 17 Aug — expect 0'],
    ['corpus_sections', 'speaker', 'repaired 17 Aug — expect 0'],
    ['corpus_sections', 'attribution', 'repaired 17 Aug — expect 0'],
    ['corpus_acts', 'title', 'never measured before'],
    ['"LegislationSection"', '"sectionTitle"', 'legacy — lib/search.ts serves this'],
    ['"LegislationSection"', '"originalText"', 'legacy — the FTS body + ts_headline snippet'],
    ['"LegislationItem"', 'title', 'legacy act titles'],
    ['"OperationalSection"', '"pageTitle"', 'legacy operational'],
    ['"OperationalSection"', '"extractedText"', 'legacy operational body'],
  ]
  for (const [table, col, note] of probes) {
    try {
      const r = await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${col} ~ $1`, [ENTITY_SQL])
      const n = r.rows[0].n
      console.log(`  ${n > 0 ? '⚠' : ' '} ${(table + '.' + col).replace(/"/g, '').padEnd(38)} ${String(n).padStart(7)}   ${note}`)
      if (n > 0) {
        const s = await c.query<{ v: string }>(
          `SELECT ${col} AS v FROM ${table} WHERE ${col} ~ $1 LIMIT 2`, [ENTITY_SQL])
        // ⚠ THE WINDOW IS TAKEN AROUND THE ENTITY, not from the start of the value. The first
        // version printed the first 110 characters, and for `originalText` the entity is usually
        // thousands of characters in — so `raw` and `dec` printed IDENTICAL lines under a heading
        // saying the row was contaminated. A sample that cannot show the thing it is sampling is
        // worse than no sample: it reads as evidence that nothing changed.
        for (const row of s.rows) {
          console.log(`        raw: ${window(row.v ?? '')}`)
          console.log(`        dec: ${decodeForDisplay(window(row.v ?? ''))}`)
        }
      }
    } catch (e) {
      console.log(`    ${(table + '.' + col).replace(/"/g, '').padEnd(38)} ERR ${(e as Error).message.split('\n')[0]}`)
    }
  }
  await c.end()
}

async function callFts(query: string, corpus: string, limit: number): Promise<FtsHit[]> {
  const res = await fetch(`${FTS_URL.replace(/\/$/, '')}/fts-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, corpora: [corpus] }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`FTS ${res.status}`)
  const json = (await res.json()) as { results?: FtsHit[]; corpora?: string[] | null }
  // ⚠ A service that ignored the corpus scope would return the whole index and the per-corpus
  // rate below would be a rate for something else entirely. Refuse rather than report it.
  if (!json.corpora || json.corpora[0] !== corpus) {
    throw new Error(`service did not honour corpora=[${corpus}] (echoed ${JSON.stringify(json.corpora)})`)
  }
  return json.results ?? []
}

async function live(): Promise<Map<string, Set<string>>> {
  // corpus → the ids whose SERVED text carries a literal entity. §C looks those exact documents up
  // again through the adapter, so the before/after is the SAME DOCUMENT and not merely the same
  // query — two different result sets would let a clean §C mean "the dirty ones did not come back".
  const dirtyIds = new Map<string, Set<string>>()
  console.log(`\n════ §B SERVED VALUES — ${FTS_URL} ════`)
  console.log('  corpus                 hits  snip+  title+  spk+   what decoding changes')
  let totalHits = 0, totalDirty = 0, changed = 0
  for (const { corpus, query } of LIVE_PROBES) {
    try {
      const hits = await callFts(query, corpus, 50)
      let snip = 0, title = 0, spk = 0, dirty = 0, sample = ''
      for (const h of hits) {
        const s = hasLiteralEntity(h.snippet ?? '')
        const t = hasLiteralEntity(h.sectionTitle ?? '')
        const k = hasLiteralEntity(h.speaker ?? '')
        if (s) snip++; if (t) title++; if (k) spk++
        if (s || t || k) {
          dirty++
          if (!dirtyIds.has(corpus)) dirtyIds.set(corpus, new Set())
          dirtyIds.get(corpus)!.add(h.id)
          const before = (t ? h.sectionTitle! : h.snippet).replace(/\s+/g, ' ')
          if (!sample && decodeForDisplay(before) !== before) {
            const at = Math.max(0, before.search(/&(#x[0-9a-fA-F]{2,6}|#\d{2,7}|[a-zA-Z][a-zA-Z0-9]{1,9});/) - 40)
            sample = before.slice(at, at + 110)
          }
        }
        // count VALUES that decoding actually alters, not values that merely contain an entity —
        // `&c;` and an unknown named form are left alone on purpose and must not be counted as fixed
        for (const v of [h.snippet, h.sectionTitle, h.speaker]) {
          if (typeof v === 'string' && decodeForDisplay(v) !== v) changed++
        }
      }
      totalHits += hits.length; totalDirty += dirty
      console.log(`  ${corpus.padEnd(22)}${String(hits.length).padStart(4)}${String(snip).padStart(6)}${String(title).padStart(8)}${String(spk).padStart(6)}   ${dirty ? `${dirty}/${hits.length} hits carry one` : 'clean'}`)
      if (sample) {
        console.log(`        raw: …${sample}…`)
        console.log(`        dec: …${decodeForDisplay(sample)}…`)
      }
    } catch (e) {
      console.log(`  ${corpus.padEnd(22)} ERR ${(e as Error).message}`)
    }
  }
  console.log(`\n  ${totalDirty}/${totalHits} served hits carry a literal entity; ${changed} served values are altered by decoding`)

  if (VECTOR_URL) {
    try {
      const res = await fetch(`${VECTOR_URL.replace(/\/$/, '')}/vector-search`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'judicial review of a planning decision', limit: 50 }),
        signal: AbortSignal.timeout(30_000),
      })
      const json = (await res.json()) as { results?: Array<{ corpus: string; snippet: string }> }
      const hits = json.results ?? []
      const dirty = hits.filter((h) => hasLiteralEntity(h.snippet ?? '')).length
      console.log(`  vector (unscoped, 1 probe): ${dirty}/${hits.length} snippets carry one`)
    } catch (e) {
      console.log(`  vector: ERR ${(e as Error).message}`)
    }
  } else {
    console.log('  vector: VECTOR_SEARCH_URL unset here — dense half not measured')
  }
  return dirtyIds
}

/**
 * §C — THE SAME LIVE QUERIES, THROUGH THE REAL ADAPTER.
 *
 * §B measures what the search service SERVES. This measures what the platform HANDS ON: the same
 * corpora, the same queries, but read through `runFtsSearch` — the code a user's search actually
 * runs, hydrating from Neon and building the SearchResult. If §B is dirty and §C is clean, the
 * render-side decode is doing exactly the job it was added for, on live data rather than a fixture.
 *
 * ⚠ `FTS_SEARCH_URL` IS UNSET IN THIS `.env`, so the adapter must be pointed at the service before
 * it is imported (it reads the variable once, at module load). Without this the adapter fails
 * closed and returns an empty result — which would look like "0 entities" and prove nothing.
 */
async function throughAdapter(dirtyIds: Map<string, Set<string>>) {
  console.log('\n════ §C THE SAME HITS, THROUGH runFtsSearch ════')
  process.env.FTS_SEARCH_URL ??= FTS_URL
  const { runFtsSearch } = await import('../lib/lex/fts-search')
  let total = 0, dirty = 0, empty = 0, tracked = 0, trackedClean = 0
  for (const { corpus, query } of LIVE_PROBES) {
    const out = await runFtsSearch(query.split(' '), 20, { corpora: [corpus] })
    if (out.failed) { console.log(`  ${corpus.padEnd(22)} FAILED — ${out.reason}`); continue }
    if (!out.results.length) { empty++; console.log(`  ${corpus.padEnd(22)} 0 results (typed-out or no match)`); continue }
    const isDirty = (r: { snippet?: string; title?: string; citation?: string }) =>
      hasLiteralEntity(r.snippet ?? '') || hasLiteralEntity(r.title ?? '') || hasLiteralEntity(r.citation ?? '')
    const bad = out.results.filter(isDirty)
    total += out.results.length; dirty += bad.length

    // The document-level tie: of the ids §B saw served WITH an entity, how many came back through
    // the adapter, and were they clean? This is the before/after on the same document.
    const watch = dirtyIds.get(corpus) ?? new Set<string>()
    const same = out.results.filter((r) => watch.has(r.id))
    tracked += same.length
    trackedClean += same.filter((r) => !isDirty(r)).length

    console.log(`  ${corpus.padEnd(22)}${String(out.results.length).padStart(4)} results   ${bad.length} carrying a literal entity`
      + (same.length ? `   · ${same.filter((r) => !isDirty(r)).length}/${same.length} of §B's contaminated documents come back CLEAN` : ''))
    if (bad.length) console.log(`        ⚠ ${window(bad[0].title)} | ${window(bad[0].snippet)}`)
  }
  console.log(`\n  ${dirty}/${total} results reach a caller with a literal entity`
    + `${empty ? ` (${empty} probe(s) returned nothing and are not counted)` : ''}`)
  console.log(`  ${trackedClean}/${tracked} of the documents §B served contaminated are clean by the time a caller sees them`
    + (tracked === 0 ? ' — ⚠ NO OVERLAP, so §C is a same-query check only here' : ''))
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.includes('--live-only')) await db()
  if (!args.includes('--db-only')) { const dirty = await live(); await throughAdapter(dirty) }
}
main().catch((e) => { console.error(e); process.exit(1) })
