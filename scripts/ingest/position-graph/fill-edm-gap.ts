/**
 * fill-edm-gap.ts — the §3 sweep lost exactly 100 of 60,995 motions to one failing page, and the
 * page is NOT failing transiently.
 *
 * ⚠⚠ THE DEFECT, BECAUSE IT IS THE INTERESTING PART AND IT IS THE SOURCE'S, NOT OURS.
 *
 *     GET /EarlyDayMotions/list?parameters.take=100&parameters.skip=2700
 *       → HTTP 200
 *       → {"PagingInfo":null,"StatusCode":400,"Success":false,
 *          "Errors":["An error occurred while executing the command definition. …"],"Response":null}
 *
 * **A 200 wrapping a 400.** `res.ok` is TRUE, so every retry rule in our fetch helpers waves it
 * straight through; it was only caught downstream because `Array.isArray(d.Response)` is false.
 * This is the family root `CLAUDE.md` §18 is about — a failure that looks like something else — and
 * the rule it produces is: **on this API, check the BODY's StatusCode, not the transport's.**
 *
 * ⚠ AND IT IS TRANSIENT, WHICH IS THE OPPOSITE OF WHAT I FIRST CONCLUDED. The first version of this
 * file called it deterministic and refused to retry it, reasoning by analogy with V36's "a 300 is an
 * answer, and we were retrying it as a rate limit". That analogy was wrong, and six consecutive
 * requests to the identical URL settled it rather than the analogy doing so:
 *
 *     attempt 1  400   attempt 2  400   attempt 3  400
 *     attempt 4  400   attempt 5  200 · 50 rows   attempt 6  200 · 50 rows
 *
 * Four failures then two successes, same URL, same parameters. It is a load or timeout condition on
 * the source (the neighbouring `skip=2800` page took 27.7 s), surfacing as a body-level 400. So it
 * IS retryable — the reason it needs special handling is not that it must never be retried, but
 * that nothing in the transport tells you there is anything to retry.
 *
 * 100 of 60,995 is 0.16% — under the sweep's own 2% abort threshold, which is why it wrote. It is
 * NOT under the threshold for saying nothing: a silent hole is how a count comes to mean something
 * other than what it says.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/fill-edm-gap.ts [--apply]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const APPLY = process.argv.includes('--apply')
const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()

/**
 * The pages covering the lost window.
 *
 * ⚠ LOCATED, NOT GUESSED — and the first guess was wrong. The gap-finder happened to hit a failing
 * page at skip=2700 and I took that for the culprit; refetching it recovered 50 rows, **none of
 * them ours**. More than one offset on this endpoint is flaky, so "a page failed here" is not
 * evidence that "the missing rows are here".
 *
 * The window was then found by binary search on the list's ordering (roughly descending Id):
 *     skip 5100 → Id 61050     skip 5200 → FAILS     skip 5300 → Id 60845
 * take=100 at skip=5200 therefore covers ranks 5200–5299 = Ids 60949…60846, which is exactly the
 * missing block. Tried at full width first, since the failure is transient and retries should win.
 */
const REPLACEMENT_PAGES = [
  { take: 100, skip: 5200 },
  { take: 50, skip: 5200 },
  { take: 50, skip: 5250 },
]

/**
 * ⚠ Checks the BODY's StatusCode as well as the transport's, and retries a body-level failure the
 * same way it would retry a 503 — because that is what it is. A helper that trusts `res.ok` reports
 * success on an empty page and loses 100 motions without a word, which is exactly what happened.
 *
 * Attempts are generous (12) with linear backoff, because the observed failure ran to four in a row.
 */
async function getPage(take: number, skip: number, attempts = 12): Promise<any[] | null> {
  let bodyFails = 0
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BASE}/EarlyDayMotions/list?parameters.take=${take}&parameters.skip=${skip}`,
        { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) {
        const d: any = await res.json()
        if (d?.Success === false || d?.StatusCode >= 400) {
          bodyFails++
          if (bodyFails === 1) console.log(`     take=${take} skip=${skip}: HTTP ${res.status} but body says ${d?.StatusCode} — "${d?.Errors?.[0] ?? 'no reason'}" (retrying: it is transient)`)
        } else if (Array.isArray(d?.Response)) {
          if (bodyFails) console.log(`     recovered after ${bodyFails} body-level failure(s)`)
          return d.Response
        } else return null
      } else if (res.status !== 429 && res.status < 500) return null
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 + 1000 * i))
  }
  console.log(`     ✗ take=${take} skip=${skip} gave up after ${attempts} attempts (${bodyFails} body-level 400s)`)
  return null
}

const missingSql = `
  SELECT (regexp_replace(c.id, '^early-day-motions:(\\d+):1$', '\\1'))::int AS motion_id
    FROM corpus_sections c
   WHERE c.corpus='early-day-motions'
     AND NOT EXISTS (SELECT 1 FROM edm_sponsor s
                      WHERE s.motion_id = (regexp_replace(c.id, '^early-day-motions:(\\d+):1$', '\\1'))::int)
   ORDER BY 1`

async function main() {
  const { rows: before } = await pool.query<{ motion_id: number }>(missingSql)
  console.log(`motions we hold with no sponsor row: ${before.length}`)
  if (!before.length) { console.log('nothing to fill'); await endNeonPool(); return }
  console.log(`   id range ${before[0].motion_id} … ${before[before.length - 1].motion_id}`)

  const want = new Set(before.map((m) => m.motion_id))
  const found: any[] = []
  console.log(`\n   refetching the same window at a boundary that works:`)
  for (const p of REPLACEMENT_PAGES) {
    if (!want.size) break
    const rows = await getPage(p.take, p.skip)
    if (!rows) { console.log(`   ✗ take=${p.take} skip=${p.skip} also failed`); continue }
    const hits = rows.filter((r: any) => want.has(r?.Id))
    console.log(`   ✓ take=${p.take} skip=${p.skip} → ${rows.length} rows, ${hits.length} of them ours`)
    for (const r of hits) { found.push(r); want.delete(r.Id) }
  }
  console.log(`\n   recovered ${found.length}, still missing ${want.size}`)
  if (want.size) console.log(`   ⚠ still missing: ${[...want].slice(0, 20).join(', ')}`)

  if (!APPLY) { console.log('\n   dry run — re-run with --apply to write'); await endNeonPool(); return }
  for (const r of found) {
    await pool.query(
      `INSERT INTO edm_sponsor (motion_id, mnis_id, sponsor_name, party, constituency, date_tabled, sponsors_count, uin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (motion_id) DO UPDATE SET
         mnis_id=EXCLUDED.mnis_id, sponsor_name=EXCLUDED.sponsor_name, party=EXCLUDED.party,
         constituency=EXCLUDED.constituency, date_tabled=EXCLUDED.date_tabled,
         sponsors_count=EXCLUDED.sponsors_count, uin=EXCLUDED.uin, fetched_at=now()`,
      [r.Id, r.PrimarySponsor?.MnisId ?? r.MemberId ?? null, (r.PrimarySponsor?.Name ?? '(none given)').trim(),
       r.PrimarySponsor?.Party ?? null, r.PrimarySponsor?.Constituency ?? null,
       r.DateTabled ? String(r.DateTabled).slice(0, 10) : null, r.SponsorsCount ?? null,
       r.UINWithAmendmentSuffix ?? (r.UIN != null ? String(r.UIN) : null)])
  }
  const { rows: [after] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM edm_sponsor`)
  const { rows: gap } = await pool.query(missingSql)
  console.log(`   edm_sponsor now ${after.n} rows; motions held with no sponsor row: ${gap.length}`)
  await endNeonPool()
}
main().catch((e) => { console.error('[fill-edm-gap] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
