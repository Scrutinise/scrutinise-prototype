/**
 * committees-freshness.ts — HOW MANY COMMITTEE PUBLICATION CITATIONS ACTUALLY OPEN, AND WHY NOT.
 *
 * BRIEF_INGEST_CORPUS_FRESHNESS §1. Sprint 3-E measured ~25% of a 24-id sample 404ing in BOTH the
 * bare and the `/html/` form and concluded the ids had been "withdrawn, renumbered or superseded at
 * source". §1 asks for three things in order of cost: the true rate, the reason, and a policy.
 *
 * ⚠ THE REASON IS NOT WITHDRAWAL, AND THE FIRST TWO IDS I CHECKED SAID SO.
 *
 *     GET https://committees.parliament.uk/publications/22140/html/                 404
 *     GET https://committees-api.parliament.uk/api/Publications/22140               200  ← still there
 *     GET https://committees.parliament.uk/publications/22140/documents/164408/default/  200  ← opens
 *
 * The publication is not gone. It has no HTML RENDITION: its only file is a PDF in OriginalFormat,
 * and a PDF-only publication is addressed through its documentId, which the bare and `/html/` forms
 * know nothing about. A third class exists too — `13110` is a real correspondence record carrying
 * NO document at all, so nothing can open it, and that is a data fact rather than a URL fault.
 *
 * So the classification this script measures is:
 *
 *   html-ok            `/{id}/html/` returns 200. Nothing wrong.
 *   other-url          `/html/` 404s, the API still holds the publication, and its document opens
 *                      at `/{id}/documents/{documentId}/default/`. ⚠ A URL DEFECT, NOT A DEAD LINK.
 *   no-document        the API holds the publication and it has no file at all. Genuinely nothing
 *                      to open; it must stop being offered as an openable citation.
 *   gone               the API itself 404s. THIS is the class the brief hypothesised.
 *   error              network/5xx after a retry — counted separately, never folded into a rate.
 *
 * ⚠ USER-AGENT. `committees.parliament.uk` answers a bare curl UA with 403 on every path, which
 * reads exactly like a dead link and is not one; the website is probed with a browser UA. The API
 * is probed with our own identifying UA, as the sweeps do.
 *
 * Usage (from scripts/ingest):
 *   npx tsx committees-freshness.ts --sample 500      # the measurement, writes the JSON below
 *   npx tsx committees-freshness.ts --ids 13110,22140 # probe specific ids
 *   npx tsx committees-freshness.ts --self-test       # classification logic only. No network, no DB.
 *
 * Read-only against both the database and the sites. Output: committees-freshness.json
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(`--${f}`)
const val = (f: string): string | null => {
  const i = argv.indexOf(`--${f}`)
  return i >= 0 ? (argv[i + 1] ?? null) : null
}
const num = (f: string, d: number) => {
  const v = parseInt(val(f) ?? '', 10)
  return Number.isFinite(v) ? v : d
}

const SITE = 'https://committees.parliament.uk'
const API = 'https://committees-api.parliament.uk/api'
// The site 403s a non-browser UA on every path — see the header.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const OUR_UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const THROTTLE_MS = num('throttle', 250)
const CONCURRENCY = num('concurrency', 3)
// ⚠ `--out` EXISTS BECAUSE A TARGETED RE-PROBE CLOBBERED A 500-ID RUN. The first run left 38 ids
// unresolved (403 throttling); re-probing just those with `--ids` overwrote the whole file with 40
// rows, so the full sample had to be measured again. A partial run must never be able to destroy a
// complete one.
const OUT = path.join(__dirname, val('out') ?? 'committees-freshness.json')

export type Verdict = 'html-ok' | 'other-url' | 'no-document' | 'gone' | 'error'

export interface Probe {
  id: number
  htmlStatus: number
  apiStatus?: number
  documentId?: number | null
  fileFormat?: string | null
  fileName?: string | null
  docUrlStatus?: number
  verdict: Verdict
  workingUrl?: string | null
  note?: string
}

/**
 * The classification, kept pure so it can be tested without the network.
 *
 * ⚠ ORDER MATTERS AND IS NOT ARBITRARY. A publication that opens at another URL must never be
 * counted as gone, and one whose API record is missing must never be counted as merely
 * badly-addressed — those are the two errors that would each produce a defensible-looking rate for
 * the wrong thing.
 */
export function classify(p: {
  htmlStatus: number; apiStatus?: number; documentId?: number | null; docUrlStatus?: number
}): Verdict {
  if (p.htmlStatus === 200) return 'html-ok'
  // A 403/5xx from the site is OUR problem to retry, not a statement about the document.
  if (p.htmlStatus !== 404 && p.htmlStatus !== 410) return 'error'
  if (p.apiStatus === undefined) return 'error'
  if (p.apiStatus === 404 || p.apiStatus === 410) return 'gone'
  if (p.apiStatus !== 200) return 'error'
  if (p.documentId == null) return 'no-document'
  if (p.docUrlStatus === 200) return 'other-url'
  if (p.docUrlStatus === undefined) return 'error'
  // ⚠⚠ THE SAME RULE AS THE HTML URL ABOVE, AND ITS ABSENCE HERE COST THE FIRST RUN ITS ONLY TWO
  // "gone" VERDICTS. Both were a 403 on the document URL — the site's throttling, applied to a
  // document the API says exists. Treating that as evidence of absence would have handed the brief
  // back a confirmation of its own hypothesis manufactured out of rate limiting.
  if (p.docUrlStatus !== 404 && p.docUrlStatus !== 410) return 'error'
  // The API holds a document that its own URL genuinely 404s. It is NOT 'other-url': saying
  // "reachable elsewhere" about a URL that does not resolve would be the fabrication this measures.
  return 'gone'
}

/**
 * The status of a WEBSITE url, fetched through curl.
 *
 * ⚠⚠ NOT `fetch`, AND THE REASON IS ALREADY IN OUR OWN CODE. `sources/committees-portal.ts` records
 * it: "Node.js Undici is blocked by Cloudflare TLS fingerprinting on all parliament.uk hosts
 * regardless of User-Agent headers. curl's TLS fingerprint is accepted." I did not read that first,
 * and the first run of this script duly returned 403 on 300 of 300 probes — which the classifier
 * correctly refused to call a dead link, because 403 is the exact trap §1 of the brief warns about.
 * A browser User-Agent is necessary and NOT sufficient; the transport is what is being fingerprinted.
 *
 * One retry on a network fault or a 5xx; never on a 404.
 */
function siteStatus(url: string, tries = 2): number {
  const { spawnSync } = require('child_process') as typeof import('child_process')
  for (let attempt = 1; attempt <= tries; attempt++) {
    const r = spawnSync('curl', [
      '-s', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null',
      '-w', '%{http_code}',
      '-L', '--max-time', '30',
      '-A', BROWSER_UA,
      '-H', 'Accept: text/html,application/xhtml+xml',
      '-H', 'Accept-Language: en-GB,en;q=0.9',
      url,
    ], { timeout: 35_000, encoding: 'utf8' })
    if (r.error || r.status !== 0) {
      if (attempt < tries) continue
      return 0 // transport fault — 0 is not an HTTP status and is never read as one
    }
    const code = parseInt((r.stdout ?? '').trim(), 10)
    if (!Number.isFinite(code)) { if (attempt < tries) continue; return 0 }
    if (code >= 500 && attempt < tries) continue
    return code
  }
  return 0
}

async function apiPublication(id: number): Promise<{ status: number; documentId: number | null; format: string | null; fileName: string | null }> {
  try {
    const res = await fetch(`${API}/Publications/${id}`, {
      headers: { 'user-agent': OUR_UA, accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status !== 200) { await res.arrayBuffer().catch(() => undefined); return { status: res.status, documentId: null, format: null, fileName: null } }
    const j = (await res.json()) as { documents?: Array<{ documentId?: number; files?: Array<{ fileName?: string; fileDataFormat?: string }> }> }
    const doc = (j.documents ?? [])[0]
    const file = (doc?.files ?? [])[0]
    return {
      status: 200,
      documentId: doc?.documentId ?? null,
      format: file?.fileDataFormat ?? null,
      fileName: file?.fileName ?? null,
    }
  } catch {
    return { status: 0, documentId: null, format: null, fileName: null }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function probe(id: number): Promise<Probe> {
  const htmlStatus = siteStatus(`${SITE}/publications/${id}/html/`)
  if (htmlStatus === 200) return { id, htmlStatus, verdict: 'html-ok', workingUrl: `${SITE}/publications/${id}/html/` }

  await sleep(THROTTLE_MS)
  const api = await apiPublication(id)
  // `verdict` is filled in below; typing it as Omit<> keeps the compiler honest about the fact
  // that a probe without a verdict is an INCOMPLETE probe, not a probe with a default one.
  const p: Omit<Probe, 'verdict'> & { verdict?: Verdict } = {
    id, htmlStatus, apiStatus: api.status, documentId: api.documentId,
    fileFormat: api.format, fileName: api.fileName,
  }

  if (api.status === 200 && api.documentId != null) {
    await sleep(THROTTLE_MS)
    const url = `${SITE}/publications/${id}/documents/${api.documentId}/default/`
    p.docUrlStatus = siteStatus(url)
    if (p.docUrlStatus === 200) p.workingUrl = url
  }
  p.verdict = classify(p)
  return p as Probe
}

/** Run `jobs` with a small concurrency and a throttle between starts. Politeness, not speed. */
async function pool<T>(items: T[], worker: (t: T, i: number) => Promise<void>) {
  let next = 0
  const runners = Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      await worker(items[i], i)
      await sleep(THROTTLE_MS)
    }
  })
  await Promise.all(runners)
}

/** Wilson score interval — an honest interval at these sample sizes, unlike the normal approximation. */
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0]
  const z = 1.96, p = k / n
  const d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)]
}

async function main() {
  if (has('self-test')) return selftest()

  const explicit = val('ids')
  let ids: number[]
  let population = 0

  if (explicit) {
    ids = explicit.split(',').map((x) => parseInt(x.trim(), 10)).filter(Number.isFinite)
  } else {
    const pool = getNeonPool()
    // ⚠ DETERMINISTIC SAMPLE. `ORDER BY random()` cannot be re-run to check a surprising result;
    // hashing the id with a fixed salt gives the same sample every time and a different one per
    // salt, so a second opinion is `--salt b` rather than a different measurement entirely.
    const salt = val('salt') ?? 'a'
    const n = num('sample', 500)
    const { rows: pop } = await pool.query<{ n: string }>(
      `SELECT count(DISTINCT "parentDocId") AS n FROM corpus_sections
        WHERE corpus='committees-reports' AND "sourceUrl" LIKE 'https://committees.parliament.uk/publications/%'`)
    population = Number(pop[0].n)
    const { rows } = await pool.query<{ pub: string }>(
      // The DISTINCT is taken in the subquery: `SELECT DISTINCT … ORDER BY md5(…)` is rejected by
      // Postgres because the sort expression is not in the select list, and hoisting it into the
      // select list would change what DISTINCT is taken over.
      `SELECT pub FROM (
         SELECT DISTINCT split_part("parentDocId", ':', 2) AS pub
           FROM corpus_sections
          WHERE corpus='committees-reports'
            AND "sourceUrl" LIKE 'https://committees.parliament.uk/publications/%'
       ) t
       ORDER BY md5(pub || $1)
       LIMIT $2`, [salt, n])
    ids = rows.map((r) => parseInt(r.pub, 10)).filter(Number.isFinite)
    await endNeonPool()
  }

  // ⚠⚠ THE PREFLIGHT, AND IT EXISTS BECAUSE ITS ABSENCE COST A 300-PROBE RUN. A known-live URL and
  // a known-dead one are probed FIRST. If the live one does not return 200, the transport is being
  // blocked and every subsequent verdict would be an artefact of that, not a fact about a document.
  // Refuse rather than produce a beautifully-formatted table of nothing.
  const CANARY_LIVE = `${SITE}/publications/45000/html/`
  const CANARY_DEAD = `${SITE}/publications/13110/html/`
  const liveCode = siteStatus(CANARY_LIVE)
  const deadCode = siteStatus(CANARY_DEAD)
  console.log(`  preflight  live canary ${liveCode} · dead canary ${deadCode}`)
  if (liveCode !== 200) {
    console.error(`
  ❌ the live canary returned ${liveCode}, not 200 — the site is refusing this client`)
    console.error(`     (403 here means TLS fingerprinting, not a dead document — see the header note)`)
    console.error(`     REFUSING to run: every verdict would measure the block, not the corpus.`)
    process.exit(1)
  }
  if (deadCode === 200) {
    console.error(`
  ❌ the dead canary returned 200 — the site's behaviour has changed and this`)
    console.error(`     script's whole premise needs re-establishing before its numbers mean anything.`)
    process.exit(1)
  }

  console.log(`════ committees publication freshness ════`)
  console.log(`  population ${population || 'n/a'} publications · probing ${ids.length} · concurrency ${CONCURRENCY} · throttle ${THROTTLE_MS}ms\n`)

  const results: Probe[] = []
  let done = 0
  await pool(ids, async (id) => {
    const p = await probe(id)
    results.push(p)
    done++
    if (done % 25 === 0 || done === ids.length) {
      const c = tally(results)
      console.log(`  ${String(done).padStart(4)}/${ids.length}  html-ok ${c['html-ok']} · other-url ${c['other-url']} · no-document ${c['no-document']} · gone ${c.gone} · error ${c.error}`)
    }
  })

  const c = tally(results)
  const scored = results.length - c.error
  console.log(`\n──── verdicts (${results.length} probed, ${c.error} errored and excluded from rates) ────`)
  for (const v of ['html-ok', 'other-url', 'no-document', 'gone'] as const) {
    const [lo, hi] = wilson(c[v], scored)
    console.log(`  ${v.padEnd(12)} ${String(c[v]).padStart(4)}  ${(100 * c[v] / (scored || 1)).toFixed(1)}%   95% CI ${(100 * lo).toFixed(1)}–${(100 * hi).toFixed(1)}%`)
  }
  const broken = c['other-url'] + c['no-document'] + c.gone
  const [blo, bhi] = wilson(broken, scored)
  console.log(`\n  ⚠ a citation that does not open: ${broken}/${scored} = ${(100 * broken / (scored || 1)).toFixed(1)}% (95% CI ${(100 * blo).toFixed(1)}–${(100 * bhi).toFixed(1)}%)`)
  console.log(`     of which REPAIRABLE (opens at another URL): ${c['other-url']} — ${(100 * c['other-url'] / (broken || 1)).toFixed(1)}% of the breakage`)
  if (population) {
    console.log(`\n  extrapolated over ${population} publications — labelled an EXTRAPOLATION, not a census:`)
    console.log(`     other-url  ≈ ${Math.round(population * c['other-url'] / (scored || 1)).toLocaleString()}`)
    console.log(`     no-document≈ ${Math.round(population * c['no-document'] / (scored || 1)).toLocaleString()}`)
    console.log(`     gone       ≈ ${Math.round(population * c.gone / (scored || 1)).toLocaleString()}`)
  }

  fs.writeFileSync(OUT, JSON.stringify({
    measuredAt: new Date().toISOString(), population, sample: results.length, salt: val('salt') ?? 'a',
    tally: c, results: results.sort((a, b) => a.id - b.id),
  }, null, 1))
  console.log(`\n  → ${OUT}`)
}

function tally(rs: Probe[]): Record<Verdict, number> {
  const c: Record<Verdict, number> = { 'html-ok': 0, 'other-url': 0, 'no-document': 0, gone: 0, error: 0 }
  for (const r of rs) c[r.verdict]++
  return c
}

// ── offline self-test — the classification, and the four ways it could lie ───────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['a 200 is html-ok and nothing else is consulted', classify({ htmlStatus: 200 }) === 'html-ok'],
    ['404 + API 404 = gone', classify({ htmlStatus: 404, apiStatus: 404 }) === 'gone'],
    ['404 + API 200 + no document = no-document', classify({ htmlStatus: 404, apiStatus: 200, documentId: null }) === 'no-document'],
    ['404 + API 200 + document that opens = other-url', classify({ htmlStatus: 404, apiStatus: 200, documentId: 1, docUrlStatus: 200 }) === 'other-url'],
    // ⚠ the refusals — each is a way of reporting a number for the wrong thing
    ['⚠ a document URL that 404s is NOT other-url', classify({ htmlStatus: 404, apiStatus: 200, documentId: 1, docUrlStatus: 404 }) === 'gone'],
    // ⚠⚠ ADDED AFTER THE FIRST 500-ID RUN, WHICH RETURNED TWO "gone" VERDICTS THAT WERE BOTH A 403.
    // The rule "a 403 is our problem, not a statement about the document" was applied to the site's
    // html URL and NOT to the document URL — so the one class the brief hypothesised had two
    // instances, and both were throttling. Its true count in 500 is zero.
    ['⚠ a 403 on the DOCUMENT url is an error, not "gone" — the same rule as the html url',
      classify({ htmlStatus: 404, apiStatus: 200, documentId: 1, docUrlStatus: 403 }) === 'error'],
    ['⚠ a 5xx on the document url is an error, not "gone"',
      classify({ htmlStatus: 404, apiStatus: 200, documentId: 1, docUrlStatus: 503 }) === 'error'],
    ['⚠ a transport fault on the document url is an error, not "gone"',
      classify({ htmlStatus: 404, apiStatus: 200, documentId: 1, docUrlStatus: 0 }) === 'error'],
    ['⚠ a site 403 is an ERROR, not a dead link — this is the UA trap the brief warns about',
      classify({ htmlStatus: 403 }) === 'error'],
    ['⚠ a site 5xx is an error, not a verdict', classify({ htmlStatus: 503 }) === 'error'],
    ['⚠ a network fault (status 0) is an error, not a verdict', classify({ htmlStatus: 0 }) === 'error'],
    ['⚠ an API network fault does not become "gone"', classify({ htmlStatus: 404, apiStatus: 0 }) === 'error'],
    ['⚠ an unprobed document URL is an error, not a verdict',
      classify({ htmlStatus: 404, apiStatus: 200, documentId: 5 }) === 'error'],
    ['410 is treated as 404 on the site side', classify({ htmlStatus: 410, apiStatus: 404 }) === 'gone'],
    // Wilson, because a rate quoted without an interval invites being read as exact
    ['wilson brackets the point estimate', (() => { const [lo, hi] = wilson(25, 100); return lo < 0.25 && hi > 0.25 })()],
    ['wilson on 0/0 does not divide by zero', (() => { const [lo, hi] = wilson(0, 0); return lo === 0 && hi === 0 })()],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
