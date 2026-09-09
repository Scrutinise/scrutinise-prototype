/**
 * sweep-edm-signatures.ts — BRIEF_INGEST_EDM_SIGNATURES §2: the 2.06 million signatures we never took.
 *
 * `sweep-edm-sponsors.ts` recovered the member who TABLED each motion — one row per motion, and its
 * own header says the other `SponsorsCount - 1` signatories "are not on this endpoint". They are on
 * a different one: `GET /EarlyDayMotion/{id}` returns `Response.Sponsors[]`, with a member id and a
 * date on every row (§1's audit: 5,739 of 5,739 on both counts).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ATTEMPTED IS WRITTEN BEFORE STORED, AND THAT IS THE POINT OF `edm_signatory_fetch`
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * A 60,995-request sweep will be interrupted. A resume that re-reads a motion it already has is
 * waste; a resume that SKIPS one it never got is a silent hole that reads as "this motion had no
 * signatories". So every fetch writes a row saying what the API returned — status and array length
 * — whether or not any signature came out of it, and `edm_signature_reconciliation` compares that
 * against what landed. A run that reports "2.3 million rows inserted" proves nothing about the
 * motions it never asked for.
 *
 * ⚠ NOT A RE-INGEST. Nothing here touches corpus_sections, R2 or the queue.
 * ⚠ NO MODEL SPEND. This is a fetch and an insert; the brief authorises nothing else.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/sweep-edm-signatures.ts --pilot 400   # measure, WRITE nothing
 *   npx tsx position-graph/sweep-edm-signatures.ts --pilot 400 --apply
 *   npx tsx position-graph/sweep-edm-signatures.ts --apply       # the full sweep, resumable
 *   npx tsx position-graph/sweep-edm-signatures.ts --apply --refetch   # ignore the fetch table
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const REFETCH = argv.includes('--refetch')
const PILOT = (() => {
  const i = argv.indexOf('--pilot')
  return i >= 0 ? parseInt(argv[i + 1], 10) || 400 : 0
})()

const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE RATE, AND WHY IT IS NOT THE ONE §1's AUDIT REPORTED
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// §1 measured "0 × 429 in 150 calls at concurrency 4, median 80 ms" and costed the sweep at 32
// minutes from it. That was a check that could not fail: 150 calls finish before this host's limiter
// reacts. The first --apply run at concurrency 4 took **429 on 101 of its first 119 motions** — and
// then STOPPED DEAD, because `fetch()` has no default timeout and four hung sockets are the whole
// worker pool.
//
// So three things changed, and each of them is here because the run without it failed:
//   1. every request carries an AbortController timeout — a hung socket is an error, not a stall;
//   2. a 429 is honoured (`Retry-After` where sent, else exponential) instead of being retried
//      three times in eight seconds and recorded as a failure;
//   3. the whole sweep shares ONE limiter, so a 429 slows every worker rather than only the one
//      that drew it. Four workers each backing off independently keep the aggregate rate exactly
//      where the limiter objected to it.
//
// ⚠⚠ AND THE LIMIT IS NOT A RATE LIMIT THAT SHEDS LOAD. It is a **Cloudflare rate-limiting rule
// (`error code: 1015`, read off the response body) with a FIXED MITIGATION INSTANT**: once tripped,
// `Retry-After` came back at 3,146 seconds and counted down by exactly 60 per minute toward one
// wall-clock moment — identically on the list endpoint and the detail endpoint, so there is no
// second budget to fall back on. **Tripping it puts an hour on the clock** — though a minority of
// requests are answered even during the mitigation, so ONE successful probe is not readiness. My
// first readiness test was a single request and it reported "cleared" with 23 minutes still to run.
//
// ⚠ That is why the pace is a CONTROLLER and not a constant. With an hour-long penalty, "pick a rate
// and hope" is a bet whose downside is the whole run, and textbook additive-increase /
// multiplicative-decrease would trip it periodically BY DESIGN. So:
//
//   · it starts slow and speeds up only while nothing has objected;
//   · the FIRST 429 stops it speeding up PERMANENTLY for the rest of the run — it converges on a
//     safe pace and holds there rather than re-finding the ceiling every hour;
//   · `Retry-After` is honoured IN FULL on the one shared brake, never capped.
//
// ⚠ And the probe written to measure the safe rate could not: probe-edm-rate-limit.ts ran five
// settings, every one drew 429, and every one reported `Retry-After` counting down to the SAME
// instant — so it measured one lockout five times rather than five settings. Its "every setting drew
// a 429" line is true and says nothing whatever about concurrency. Recorded here because the number
// a broken measurement produces is the number that ends up in a report.
const CONCURRENCY = (() => { const i = argv.indexOf('--conc'); return i >= 0 ? Math.max(1, parseInt(argv[i + 1], 10) || 2) : 2 })()
/** Starting gap, ms, per worker between requests. Conservative on purpose: it speeds itself up. */
const START_GAP_MS = (() => { const i = argv.indexOf('--gap'); return i >= 0 ? Math.max(0, parseInt(argv[i + 1], 10) || 0) : 500 })()
/** Never go below this gap however clean the run has been. */
const MIN_GAP_MS = 120
/** A single request may not hang for longer than this. */
const REQUEST_TIMEOUT_MS = 20_000
/** Rows per multi-row INSERT. */
const BATCH = 500
/** Clean requests between one 5% speed-up, while speeding up is still allowed. */
const SPEEDUP_EVERY = 400
/**
 * A 429 drawn before this many successful requests does NOT slow the run down permanently. Below it
 * this process has sent almost nothing and cannot be the cause of the mitigation it walked into --
 * which is the normal case on every resume after a kill. It sleeps either way.
 */
const SLOWDOWN_AFTER_OK = 50

/**
 * ONE shared brake and ONE shared pace for the whole sweep.
 *
 * `until` is a wall-clock instant every worker waits for, so a 429 drawn by one worker slows all of
 * them. `gapMs` is shared for the same reason: four workers must not each independently conclude
 * that they personally are fine.
 */
const rate = {
  gapMs: START_GAP_MS,
  until: 0,
  hits: 0,
  sleptMs: 0,
  cleanSinceChange: 0,
  /** Successful requests THIS process has made. See `SLOWDOWN_AFTER_OK`. */
  ok: 0,
  /** Set TRUE by the first 429 and never cleared: after that the pace may only get slower. */
  everThrottled: false,
  maxRetryAfter: 0,
}
async function waitForBrake() {
  for (;;) {
    const wait = rate.until - Date.now()
    if (wait <= 0) return
    const nap = Math.min(wait, 5000)
    rate.sleptMs += nap
    await new Promise((r) => setTimeout(r, nap))
  }
}
function onThrottled(retryAfter: string | null) {
  rate.hits++
  const secs = retryAfter && /^\d+$/.test(retryAfter) ? parseInt(retryAfter, 10) : 60
  rate.maxRetryAfter = Math.max(rate.maxRetryAfter, secs)
  // ⚠ HONOURED IN FULL, NOT CAPPED. A cap means walking back into a mitigation that has not expired,
  // drawing another 429, and never making progress — busy-waiting through an hour instead of
  // sleeping through it. The first draft capped it at 120s and that is exactly what it did.
  const until = Date.now() + secs * 1000
  // ⚠⚠ THE SLOWDOWN IS PER MITIGATION, NOT PER WORKER THAT NOTICES ONE, AND THE FIRST RUN GOT THAT
  // WRONG IN A WAY THAT WOULD HAVE COST TEN HOURS. Both workers hit the same active mitigation within
  // milliseconds of each other, each called this function, and each doubled the shared gap: 400 → 800
  // → 1,600 ms from ONE rate objection. Two workers at 1,600 ms is 1.2 requests a second, which turns
  // a four-hour sweep into a fourteen-hour one — and nothing would have looked broken, only slow.
  // A concurrent 429 during a mitigation already in force is the SAME event; only a 429 that pushes
  // the wake instant forward is new information.
  const isNewMitigation = until > rate.until + 1000
  rate.everThrottled = true
  rate.cleanSinceChange = 0
  if (!isNewMitigation) return
  rate.until = until
  // ⚠⚠ A 429 THIS RUN CANNOT HAVE CAUSED MUST NOT SLOW THIS RUN DOWN. A restart that walks into a
  // mitigation left behind by an EARLIER run — which is exactly what happens every time this sweep is
  // resumed after a kill — would otherwise halve its own pace for the rest of the run on the strength
  // of somebody else's mistake, and halve it again on the next restart. After `rate.ok` successful
  // requests this process has demonstrably been running at its own pace and a 429 is about that pace;
  // before then it has sent almost nothing and the 429 is about the past. It still SLEEPS either way:
  // the mitigation is honoured in full regardless of whose it is. Only the permanent slowdown is
  // withheld.
  if (rate.ok >= SLOWDOWN_AFTER_OK) {
    rate.gapMs = Math.min(5000, Math.max(MIN_GAP_MS, rate.gapMs * 2))
  } else {
    console.log(`   ⚠ 429 after only ${rate.ok} successful requests this run — sleeping, but NOT slowing down: this`)
    console.log(`     mitigation predates this process and says nothing about its pace.`)
  }
  // ⚠ SAID OUT LOUD, because otherwise an hour of correct behaviour is indistinguishable from a hang
  // — which is exactly how the first run was misread. `Retry-After` here is TRUSTWORTHY: it was
  // watched counting down by exactly 60 per minute toward a real instant, and the instant it named
  // matched the one computed independently from an earlier probe, so this is the true remaining time.
  console.log(`   ⏸ 429 — sleeping ${secs}s (until ${new Date(until).toISOString().slice(11, 19)}Z), gap → ${rate.gapMs}ms, speed-ups now off for the rest of the run`)
}
function onClean() {
  rate.ok++
  rate.cleanSinceChange++
  // Speed up ONLY while nothing has ever objected. After the first 429 this branch is dead for the
  // rest of the run, on purpose: converge, then hold.
  if (!rate.everThrottled && rate.cleanSinceChange >= SPEEDUP_EVERY) {
    rate.gapMs = Math.max(MIN_GAP_MS, Math.round(rate.gapMs * 0.95))
    rate.cleanSinceChange = 0
  }
}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const n = (x: any) => Number(x).toLocaleString()

interface Sig {
  signature_id: number
  motion_id: number
  mnis_id: number | null
  signatory_name: string | null
  sponsoring_order: number | null
  signed_at: string
  is_withdrawn: boolean
  withdrawn_on: string | null
}

interface FetchRow { motion_id: number; http_status: number; sponsors_seen: number; count_expected: number | null }

/** Counters that are reported whether or not they are zero, because a zero is a finding here. */
const tally = {
  motions: 0, ok: 0, failed: 0, retried: 0, http: new Map<number, number>(),
  sponsorRows: 0, withdrawn: 0, order1: 0, noMnis: 0, noDate: 0, noSigId: 0,
  dupSigId: 0, dupPair: 0, expectedMismatch: 0, timedOut: 0,
  wroteSigs: 0, wroteFetch: 0,
}

async function getJson(url: string, attempts = 6): Promise<{ status: number; body: any }> {
  let status = -1
  for (let i = 0; i < attempts; i++) {
    await waitForBrake()
    const ac = new AbortController()
    // ⚠ WITHOUT THIS THE SWEEP STOPS RATHER THAN FAILS. `fetch()` has no default timeout; the first
    // --apply run hung with four sockets open and no error, and looked from outside like a slow API.
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: ac.signal })
      status = res.status
      if (res.ok) { const body = await res.json(); onClean(); return { status, body } }
      if (status === 429) { await res.text().catch(() => {}); onThrottled(res.headers.get('retry-after')); tally.retried++; continue }
      // Not a rate limit and not a server fault → it is an answer. Retrying it is the V36 defect.
      if (status < 500) { await res.text().catch(() => {}); return { status, body: null } }
      await res.text().catch(() => {})
    } catch (e) {
      status = (e as Error).name === 'AbortError' ? -2 : -1
      tally.timedOut += status === -2 ? 1 : 0
    } finally { clearTimeout(timer) }
    if (i < attempts - 1) { tally.retried++; await new Promise((r) => setTimeout(r, 1500 * (i + 1))) }
  }
  return { status, body: null }
}

/**
 * One sponsor row → one `edm_signatory` row.
 *
 * ⚠ `Member.Party` and `Member.Constituency` ARE ON THE WIRE AND ARE DELIBERATELY DROPPED. They are
 * the member's party and seat as at the REQUEST, not as at the signature — the endpoint returns the
 * same block for a 1993 signature as for yesterday's. Storing them in a column called `party` beside
 * a 1993 date is the error SURFACE 4 §3 went and fixed in the other direction.
 */
function mapSig(motionId: number, r: any): Sig | null {
  const sigId = r?.Id
  if (sigId == null) { tally.noSigId++; return null }
  const when = r?.CreatedWhen
  if (!when) { tally.noDate++; return null }   // signed_at is NOT NULL: an undated signature is not
                                               // a dated act, and the count is reported.
  const mnis = r?.Member?.MnisId ?? r?.MemberId ?? null
  if (mnis == null) tally.noMnis++
  if (r?.IsWithdrawn) tally.withdrawn++
  if (r?.SponsoringOrder === 1) tally.order1++
  return {
    signature_id: Number(sigId),
    motion_id: motionId,
    mnis_id: mnis == null ? null : Number(mnis),
    signatory_name: (r?.Member?.Name ?? '').trim() || null,
    sponsoring_order: r?.SponsoringOrder ?? null,
    signed_at: String(when),
    is_withdrawn: !!r?.IsWithdrawn,
    withdrawn_on: r?.WithdrawnDate ? String(r.WithdrawnDate).slice(0, 10) : null,
  }
}

async function flushSigs(all: Sig[]) {
  if (!all.length) return
  // ⚠ DE-DUPLICATED ON signature_id BEFORE THE INSERT, AND NOT AS TIDINESS. `ON CONFLICT … DO UPDATE`
  // raises *"ON CONFLICT DO UPDATE command cannot affect row a second time"* if one statement carries
  // the same key twice, and that is a FATAL — after however many hours the sweep has already run.
  // The pilot saw 0 repeated signature ids in 400 motions, so this guard is expected never to fire;
  // `dupSigId` is reported so that "never fired" is a measurement rather than an assumption.
  const seen = new Set<number>()
  const rows: Sig[] = []
  for (const r of all) {
    if (seen.has(r.signature_id)) { tally.dupSigId++; continue }
    seen.add(r.signature_id); rows.push(r)
  }
  const cols = 8
  const vals: any[] = []
  const ph = rows.map((r, j) => {
    vals.push(r.signature_id, r.motion_id, r.mnis_id, r.signatory_name, r.sponsoring_order,
      r.signed_at, r.is_withdrawn, r.withdrawn_on)
    const b = j * cols
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`
  }).join(',')
  const res = await pool.query(
    `INSERT INTO edm_signatory
       (signature_id, motion_id, mnis_id, signatory_name, sponsoring_order, signed_at, is_withdrawn, withdrawn_on)
     VALUES ${ph}
     ON CONFLICT (signature_id) DO UPDATE SET
       motion_id=EXCLUDED.motion_id, mnis_id=EXCLUDED.mnis_id,
       signatory_name=EXCLUDED.signatory_name, sponsoring_order=EXCLUDED.sponsoring_order,
       signed_at=EXCLUDED.signed_at, is_withdrawn=EXCLUDED.is_withdrawn,
       withdrawn_on=EXCLUDED.withdrawn_on`, vals)
  tally.wroteSigs += res.rowCount ?? 0
}

async function flushFetch(rows: FetchRow[]) {
  if (!rows.length) return
  const vals: any[] = []
  const ph = rows.map((r, j) => {
    vals.push(r.motion_id, r.http_status, r.sponsors_seen, r.count_expected)
    const b = j * 4
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4})`
  }).join(',')
  const res = await pool.query(
    `INSERT INTO edm_signatory_fetch (motion_id, http_status, sponsors_seen, count_expected)
     VALUES ${ph}
     ON CONFLICT (motion_id) DO UPDATE SET http_status=EXCLUDED.http_status,
       sponsors_seen=EXCLUDED.sponsors_seen, count_expected=EXCLUDED.count_expected,
       fetched_at=now()`, vals)
  tally.wroteFetch += res.rowCount ?? 0
}

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? ''
  const host = /@([^/:?]+)/.exec(url)?.[1] ?? '(unparsed)'
  if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
  head('WHERE, AND WHAT FOR')
  console.log(`   host ${host}`)
  console.log(`   ${APPLY ? 'APPLY — rows will be written' : 'DRY — nothing will be written'}${PILOT ? `   PILOT ${PILOT} motions` : ''}`)
  console.log(`   concurrency ${CONCURRENCY}, starting gap ${START_GAP_MS}ms/worker, ${REQUEST_TIMEOUT_MS / 1000}s request timeout`)
  console.log(`   ⚠ the pace SELF-TUNES and stops speeding up for good at the first 429 — the limiter is`)
  console.log(`     a Cloudflare rule (error 1015) whose penalty is a fixed instant about an hour out.`)

  // ── THE WORK LIST. The 60,995 motions in `edm_sponsor`, i.e. exactly the set the 2,125,547
  // figure is a sum over. The 119 motions tabled since the last EDM ingest are NOT swept: we hold
  // no section to evidence them and closing that gap is the EDM corpus ingest's job, not this
  // sprint's (brief §4: no backfill of anything else). The number is reported.
  //
  // ⚠⚠ `--motions` EXISTS BECAUSE THE SWEEP TAKES HOURS AND §3 NEEDS A NAMED IDEA TO WORK. 21 of the
  // 23 ideas that resolve to a target resolve to a MOTION (measured, probe-edm-idea-targets.ts), and
  // every one of them shows exactly one actor today. Those motions are fetched FIRST so §3's
  // prediction can be scored while the rest of the sweep is still running — the alternative is
  // waiting hours to find out whether the surface moved.
  const only = (() => {
    const i = argv.indexOf('--motions')
    return i >= 0 ? argv[i + 1].split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean) : []
  })()
  // ⚠⚠ `--first` ORDERS RATHER THAN RESTRICTS, AND THAT IS THE WHOLE DIFFERENCE. Running the priority
  // motions as their own `--motions` invocation and the rest as a second one means TWO processes with
  // TWO independent brakes, each politely backing off while together doubling the rate the limiter is
  // actually measuring. It also needed a poller between them, which spawned a fresh `tsx` every
  // minute; on a machine already low on memory the harness killed the lot. One process, one brake,
  // one ordering.
  const first = (() => {
    const i = argv.indexOf('--first')
    return i >= 0 ? argv[i + 1].split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean) : []
  })()
  const { rows: todo } = await pool.query<{ motion_id: number; sponsors_count: number | null }>(`
    SELECT s.motion_id, s.sponsors_count
      FROM edm_sponsor s
     WHERE TRUE
     ${only.length ? `AND s.motion_id = ANY('{${only.join(',')}}'::int[])` : ''}
     ${REFETCH ? '' : 'AND NOT EXISTS (SELECT 1 FROM edm_signatory_fetch f WHERE f.motion_id = s.motion_id AND f.http_status = 200)'}
     -- ⚠ md5, not motion_id. motion_id ascends with the tabling date, so an id-ordered pilot is one
     -- session's motions and would have said whatever that session happened to look like. It also
     -- makes a PARTIAL load an unbiased sample of the corpus rather than a recent slice of it, which
     -- is what lets a half-finished sweep be reported honestly.
     ORDER BY ${first.length ? `(s.motion_id = ANY('{${first.join(',')}}'::int[])) DESC, ` : ''}md5(s.motion_id::text)
     ${PILOT ? `LIMIT ${PILOT}` : ''}`)
  if (only.length) console.log(`   ⚠ --motions: restricted to ${only.length} named motions`)
  if (first.length) console.log(`   ⚠ --first: ${first.length} named motions moved to the front of the work list`)
  const { rows: [all] } = await pool.query<{ n: string; sig: string; done: string }>(`
    SELECT (SELECT COUNT(*) FROM edm_sponsor)::text AS n,
           (SELECT COALESCE(SUM(sponsors_count),0) FROM edm_sponsor)::text AS sig,
           (SELECT COUNT(*) FROM edm_signatory_fetch WHERE http_status = 200)::text AS done`)
  console.log(`   edm_sponsor motions        ${n(all.n)}`)
  console.log(`   already fetched (status 2xx) ${n(all.done)}`)
  console.log(`   to fetch this run          ${n(todo.length)}`)
  console.log(`   published signature target ${n(all.sig)}  (INCLUDES the primary sponsor — §1.C)`)
  if (!todo.length) { console.log('\n   nothing to do.'); await endNeonPool(); return }

  head('SWEEPING')
  const t0 = Date.now()
  let pendingSigs: Sig[] = []
  let pendingFetch: FetchRow[] = []
  // ⚠ THE TWO IN-MEMORY SETS THAT USED TO LIVE HERE ARE GONE, AND BOTH FACTS ARE NOW MEASURED IN SQL
  // AFTER THE LOAD. They held every signature id and every (motion, member) pair seen — 2.3 million
  // of each over a multi-hour run, which is hundreds of megabytes of heap to count two things the
  // database can count from the rows it actually stored. Counting what passed through memory also
  // answers a slightly different question from counting what landed, and the second is the one worth
  // reporting.
  let idx = 0
  const flushLock = { p: Promise.resolve() }

  const worker = async () => {
    for (;;) {
      const i = idx++
      if (i >= todo.length) return
      const m = todo[i]
      const { status, body } = await getJson(`${BASE}/EarlyDayMotion/${m.motion_id}`)
      if (rate.gapMs) await new Promise((r) => setTimeout(r, rate.gapMs))
      tally.motions++
      tally.http.set(status, (tally.http.get(status) ?? 0) + 1)
      const resp = body?.Response ?? null
      const sponsors: any[] = Array.isArray(resp?.Sponsors) ? resp.Sponsors : []
      if (status === 200) tally.ok++; else tally.failed++
      tally.sponsorRows += sponsors.length
      if (status === 200 && m.sponsors_count != null && m.sponsors_count !== sponsors.length) tally.expectedMismatch++

      pendingFetch.push({ motion_id: m.motion_id, http_status: status, sponsors_seen: sponsors.length, count_expected: m.sponsors_count })
      for (const s of sponsors) {
        const row = mapSig(m.motion_id, s)
        if (!row) continue
        pendingSigs.push(row)
      }

      if (APPLY && (pendingSigs.length >= BATCH || pendingFetch.length >= BATCH)) {
        // Serialise the writes behind one promise: several workers reaching the flush at once would
        // interleave two INSERTs over the same array and lose rows.
        const sigs = pendingSigs; const fetches = pendingFetch
        pendingSigs = []; pendingFetch = []
        flushLock.p = flushLock.p.then(() => flushSigs(sigs)).then(() => flushFetch(fetches))
        await flushLock.p
      }
      if (tally.motions % 500 === 0) {
        const el = (Date.now() - t0) / 1000
        const rps = tally.motions / el
        console.log(`   ${n(tally.motions)}/${n(todo.length)} motions   ${n(tally.sponsorRows)} sponsor rows   ${rps.toFixed(2)}/s   gap ${rate.gapMs}ms   429s ${rate.hits}   eta ${((todo.length - tally.motions) / Math.max(rps, 1e-6) / 3600).toFixed(1)} h`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))
  if (APPLY) { await flushSigs(pendingSigs); await flushFetch(pendingFetch) }
  const elapsed = Date.now() - t0

  head('WHAT CAME BACK')
  console.log(`   elapsed                        ${(elapsed / 1000 / 60).toFixed(1)} min  (${(tally.motions / (elapsed / 1000)).toFixed(1)} motions/s)`)
  console.log(`   HTTP                           ${[...tally.http].sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}×${n(c)}`).join('  ')}`)
  console.log(`   retries spent                  ${n(tally.retried)}`)
  console.log(`   ⚠ 429s drawn                    ${n(rate.hits)}   (slept ${(rate.sleptMs / 1000 / 60).toFixed(1)} min on the shared brake; longest Retry-After ${rate.maxRetryAfter}s)`)
  console.log(`   final gap                      ${rate.gapMs}ms/worker${rate.everThrottled ? '  (frozen by the first 429)' : '  (never throttled — the pace was still improving)'}`)
  console.log(`   ⚠ requests that TIMED OUT       ${n(tally.timedOut)}   (a hung socket is an error here, not a stall)`)
  console.log(`   motions read OK                ${n(tally.ok)}`)
  console.log(`   ⚠ motions that FAILED          ${n(tally.failed)}`)
  console.log(`\n   sponsor rows returned          ${n(tally.sponsorRows)}`)
  console.log(`     of which SponsoringOrder = 1 ${n(tally.order1)}   ← the sponsor, already held as an edge`)
  console.log(`     of which withdrawn           ${n(tally.withdrawn)}   ← kept, dated, NOT signalled`)
  console.log(`   ⚠ rows with no MNIS id         ${n(tally.noMnis)}   ← stored as NULL, never name-matched`)
  console.log(`   ⚠ rows with no CreatedWhen     ${n(tally.noDate)}   ← REFUSED (signed_at is the act's date)`)
  console.log(`   ⚠ rows with no signature Id    ${n(tally.noSigId)}   ← REFUSED (no key to be idempotent on)`)
  console.log(`   ⚠ repeated signature Id in one batch ${n(tally.dupSigId)}   (would have been a FATAL)`)
  console.log(`   ⚠ list count ≠ array length    ${n(tally.expectedMismatch)} of ${n(tally.ok)}`)

  if (!APPLY) {
    console.log(`\n   DRY — nothing written. Re-run with --apply.`)
    await endNeonPool(); return
  }

  head('ATTEMPTED vs STORED — read back, not assumed')
  console.log(`   INSERT reported                edm_signatory ${n(tally.wroteSigs)}   edm_signatory_fetch ${n(tally.wroteFetch)}`)
  const { rows: [rb] } = await pool.query<Record<string, string>>(`
    SELECT (SELECT COUNT(*) FROM edm_signatory)::text                                    AS stored,
           (SELECT COUNT(*) FROM edm_signatory WHERE is_withdrawn)::text                 AS withdrawn,
           (SELECT COUNT(*) FROM edm_signatory WHERE sponsoring_order = 1)::text         AS order1,
           (SELECT COUNT(*) FROM edm_signatory WHERE mnis_id IS NULL)::text              AS no_mnis,
           (SELECT COUNT(DISTINCT motion_id) FROM edm_signatory)::text                   AS motions,
           (SELECT COUNT(*) FROM edm_signatory_fetch)::text                              AS fetched,
           (SELECT COUNT(*) FROM edm_signatory_fetch WHERE http_status <> 200)::text      AS bad,
           (SELECT COALESCE(SUM(sponsors_seen),0) FROM edm_signatory_fetch)::text         AS seen,
           (SELECT MIN(signed_at)::text FROM edm_signatory)                              AS earliest,
           (SELECT MAX(signed_at)::text FROM edm_signatory)                              AS latest`)
  console.log(`   edm_signatory rows             ${n(rb.stored)} over ${n(rb.motions)} motions`)
  console.log(`     withdrawn                    ${n(rb.withdrawn)}`)
  console.log(`     primary sponsors (order 1)   ${n(rb.order1)}`)
  console.log(`     unidentified (mnis NULL)     ${n(rb.no_mnis)}`)
  console.log(`   signed_at range                ${rb.earliest} → ${rb.latest}`)
  console.log(`   edm_signatory_fetch rows       ${n(rb.fetched)}   non-200: ${n(rb.bad)}`)
  console.log(`   Σ sponsors_seen at fetch time  ${n(rb.seen)}`)
  const gap = Number(rb.seen) - Number(rb.stored)
  console.log(`   ⚠ seen − stored                ${n(gap)}   ${gap === 0 ? '✓ every row the API returned is in the table' : '← the refused rows above must account for this exactly'}`)

  // ⚠ MEASURED ON THE ROWS THAT LANDED, not on what passed through this process's memory. §1's audit
  // found 0.48% of motions carry a member twice, and 6 of 7 such pairs have one side withdrawn — so
  // the number that matters is how many survive the withdrawn filter, because those are the ones that
  // could become two signals for one act.
  const { rows: [dup] } = await pool.query<{ pairs: string; live: string }>(`
    SELECT (SELECT COUNT(*) FROM (SELECT motion_id, mnis_id FROM edm_signatory
             WHERE mnis_id IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1) q)::text AS pairs,
           (SELECT COUNT(*) FROM (SELECT motion_id, mnis_id FROM edm_signatory
             WHERE mnis_id IS NOT NULL AND NOT is_withdrawn GROUP BY 1,2 HAVING COUNT(*) > 1) q)::text AS live`)
  console.log(`   ⚠ (motion, member) pairs held twice  ${n(dup.pairs)}`)
  console.log(`     of those, both sides still LIVE   ${n(dup.live)}   ← only these could double-count`)

  const { rows: recon } = await pool.query<{ label: string; n: string }>(`
    SELECT 'motions where stored < seen' AS label, COUNT(*)::text AS n FROM edm_signature_reconciliation WHERE stored < sponsors_seen
    UNION ALL SELECT 'motions where stored > seen', COUNT(*)::text FROM edm_signature_reconciliation WHERE stored > sponsors_seen
    UNION ALL SELECT 'motions where the publisher count differs from the array', COUNT(*)::text FROM edm_signature_reconciliation WHERE expected_minus_seen <> 0
    UNION ALL SELECT 'motions fetched but never answered (status <> 200)', COUNT(*)::text FROM edm_signature_reconciliation WHERE http_status <> 200`)
  for (const r of recon) console.log(`   ${r.label.padEnd(56)} ${n(r.n).padStart(9)}`)

  const { rows: [ed] } = await pool.query<{ sig: string; people: string; sponsor: string }>(`
    SELECT (SELECT COUNT(*) FROM graph_edm_signature_edge)::text                 AS sig,
           (SELECT COUNT(DISTINCT subject_id) FROM graph_edm_signature_edge)::text AS people,
           (SELECT COUNT(*) FROM graph_signed_motion_edge)::text                  AS sponsor`)
  console.log(`\n   graph_edm_signature_edge       ${n(ed.sig)} signature edges over ${n(ed.people)} people`)
  console.log(`   graph_signed_motion_edge       ${n(ed.sponsor)} sponsorship edges (2D-2, unchanged)`)

  const { rows: [sz] } = await pool.query<{ a: string; b: string; db: string }>(`
    SELECT pg_size_pretty(pg_total_relation_size('edm_signatory')) AS a,
           pg_size_pretty(pg_total_relation_size('edm_signatory_fetch')) AS b,
           pg_size_pretty(pg_database_size(current_database())) AS db`)
  console.log(`\n   edm_signatory ${sz.a}   edm_signatory_fetch ${sz.b}   database ${sz.db}`)
  await endNeonPool()
}
main().catch(async (e) => {
  console.error('[sweep-edm-signatures] FATAL', e instanceof Error ? e.stack : e)
  await endNeonPool().catch(() => {})
  process.exit(1)
})
