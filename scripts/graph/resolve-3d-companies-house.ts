/**
 * resolve-3d-companies-house.ts — SURFACE 3 §3.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE PROPERTY THAT MAKES THIS SAFE, AND THE ONE RULE THAT KEEPS IT SAFE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Brief §3: *"We are not searching for matches. We already hold the exact identifier. This is a
 * lookup by key, not a fuzzy match, so it CANNOT create the wrongly-merged identity that is the
 * real danger with register data."*
 *
 * ⚠⚠ SO THERE IS NO NAME MATCHING IN THIS FILE, AT ALL, IN ANY FALLBACK. A registration number
 * that Companies House does not recognise produces an UNRESOLVED row that is COUNTED, and nothing
 * else. The moment a name comparison enters this path the property above stops being true and the
 * safety argument for running it at scale collapses. `check-surface-3-ch.ts` asserts that this
 * file contains no name-similarity call and watches the assertion fire against a planted one.
 *
 * ⚠ AND IT PERSISTS AN IDENTIFIER AND A CANONICAL NAME, NOT A JUDGEMENT. §3: *"A company record
 * is not a position; it is what makes a position attributable to a real, checkable organisation."*
 * Nothing here writes a direction, a stance or a weight.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE PREDICTION, WRITTEN DOWN BEFORE THE RUN — AND THE BRIEF'S FIGURE IS CORRECTED
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The brief predicts *"roughly eleven times the current yield"*, from 14,879 unresolved rows
 * against 1,489 resolved ones. That ratio is right about ROWS and wrong about SIGNALS, because a
 * `political_donation` signal needs BOTH ends resolved — the donee as well as the donor — and most
 * of those 14,879 rows have no resolvable donee at all.
 *
 * Measured before running anything (see `docs/SURFACE_3_REPORT.md` §3 for the queries):
 *
 *     rows with a CH number we do not hold                        14,879
 *       …of which the DONEE also resolves to a member              1,682
 *     distinct (donee, number, date) triples in those rows         1,659   ← the signal ceiling
 *     distinct registration numbers needed to reach them             642   ← the API calls
 *     political_donation signals today                               244
 *
 * **So the prediction is 244 → at most 1,903 signals, about 7.8×, not 11×** — and that is a
 * CEILING that assumes every one of the 642 numbers resolves at Companies House. The honest
 * prediction is written here, before the run, so the result can be scored against it rather than
 * explained after it (`feedback-predict-measure-commit`).
 *
 * ⚠ The 11× figure is not wrong about what it measures. It is the DONOR-RESOLVED ROW count, and
 * that will indeed rise about tenfold. It is the per-source-hits-inflate-counts trap: right for a
 * list, wrong for a count.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * USAGE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   npx tsx resolve-3d-companies-house.ts --plan              what would run; no network, no writes
 *   npx tsx resolve-3d-companies-house.ts --pilot 50          fifty numbers, measured, then stop
 *   npx tsx resolve-3d-companies-house.ts --useful            the 642 that can yield a signal
 *   npx tsx resolve-3d-companies-house.ts --all               every distinct number
 *   …add --write to persist. Without it nothing is written.
 *
 * ⚠ PILOT FIRST. `--plan` costs nothing and `--pilot` is the measurement the full run is sized
 * from. The full run is not the first thing anybody should type.
 *
 * ⚠ NEEDS `COMPANIES_HOUSE_API_KEY` in `scrutinise-web/.env`. The key is HTTP Basic auth's
 * USERNAME with an EMPTY password — an unusual shape that reads as a broken credential if you
 * assume a bearer token. Register at developer.company-information.service.gov.uk.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const API = 'https://api.company-information.service.gov.uk'
/**
 * ⚠ COMPANIES HOUSE PUBLISHES 600 REQUESTS PER FIVE MINUTES PER KEY. That is 2 per second, and
 * the throttle here is deliberately slower than the published ceiling: a 429 costs the whole
 * window, and this job has no deadline.
 */
const REQUESTS_PER_WINDOW = 600
const WINDOW_MS = 5 * 60_000
const GAP_MS = Math.ceil(WINDOW_MS / REQUESTS_PER_WINDOW) + 60

/** ⚠ Companies House numbers are EIGHT characters, zero-padded. The register publishes them as
 *  typed, so the same company appears as `1430799` and `01430799`. Normalising is what turns
 *  4,458 raw strings into 3,892 real companies — and it must be done on BOTH sides of any join or
 *  the comparison is testing formatting rather than identity. */
export function normaliseChNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!s) return null
  // A number of all zeros is a placeholder somebody typed, not a company.
  if (/^0+$/.test(s)) return null
  if (s.length > 8) return null
  return /^[0-9]+$/.test(s) ? s.padStart(8, '0') : s.padStart(8, '0')
}

interface Company { number: string; name: string; status: string | null }

async function fetchCompany(num: string, key: string): Promise<
  { found: true; company: Company } | { found: false; status: number }
> {
  const auth = Buffer.from(`${key}:`).toString('base64')
  const r = await fetch(`${API}/company/${encodeURIComponent(num)}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (r.status === 200) {
    const j = await r.json() as { company_name?: string; company_status?: string }
    return {
      found: true,
      company: { number: num, name: j.company_name ?? '', status: j.company_status ?? null },
    }
  }
  return { found: false, status: r.status }
}

const has = (f: string) => process.argv.includes(`--${f}`)
function num(f: string, dflt: number): number {
  const i = process.argv.indexOf(`--${f}`)
  return i >= 0 ? Number(process.argv[i + 1] ?? dflt) : dflt
}

async function main() {
  const pool = getNeonPool()
  const write = has('write')
  const plan = has('plan')
  const pilot = has('pilot') ? num('pilot', 50) : 0
  const useful = has('useful')
  const all = has('all')

  if (!plan && !pilot && !useful && !all) {
    console.log('Pass --plan, --pilot <n>, --useful or --all. Add --write to persist.')
    return
  }

  // ── what the register holds now ────────────────────────────────────────────────────────────
  const { rows: [before] } = await pool.query<{ resolved: string; notheld: string; signals: string }>(`
    SELECT (SELECT COUNT(*)::bigint FROM position_donation WHERE donor_resolution = 'resolved:companies-house-no') resolved,
           (SELECT COUNT(*)::bigint FROM position_donation WHERE donor_resolution = 'unresolved:number-not-held') notheld,
           (SELECT COUNT(*)::bigint FROM position_signal_stored WHERE signal_type = 'political_donation') signals`)
  console.log('\n── before ──')
  console.log(`  donor-resolved rows        ${Number(before.resolved).toLocaleString()}`)
  console.log(`  rows with a number we lack ${Number(before.notheld).toLocaleString()}`)
  console.log(`  political_donation signals ${Number(before.signals).toLocaleString()}`)

  // ── the work list ──────────────────────────────────────────────────────────────────────────
  // ⚠ NORMALISED AND DE-DUPLICATED IN SQL, and `useful` is the subset that can actually PRODUCE a
  // signal — rows whose donee already resolves. Looking up a number whose donation has no
  // identified recipient costs a request and yields an attributable organisation but no signal;
  // that is worth doing eventually and is not worth doing first.
  const { rows: work } = await pool.query<{ ch: string; rows_: string; with_donee: string }>(`
    SELECT normalised AS ch, COUNT(*)::bigint rows_,
           COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL)::bigint with_donee
      FROM (
        SELECT CASE WHEN regexp_replace(upper(company_registration_number), '[^A-Z0-9]', '', 'g') ~ '^0+$'
                    THEN NULL
                    ELSE lpad(regexp_replace(upper(company_registration_number), '[^A-Z0-9]', '', 'g'), 8, '0')
               END AS normalised,
               donee_entity_id
          FROM position_donation
         WHERE donor_resolution = 'unresolved:number-not-held'
           AND company_registration_number IS NOT NULL
      ) t
     WHERE normalised IS NOT NULL AND length(normalised) = 8
     GROUP BY 1
     ORDER BY with_donee DESC, rows_ DESC`)

  const usefulList = work.filter((w) => Number(w.with_donee) > 0)
  console.log('\n── the work ──')
  console.log(`  distinct normalised numbers          ${work.length.toLocaleString()}`)
  console.log(`  …that can yield a signal (donee ok)  ${usefulList.length.toLocaleString()}`)

  const list = pilot ? usefulList.slice(0, pilot) : useful ? usefulList : work
  const minutes = (list.length * GAP_MS) / 60000
  console.log(`  selected                             ${list.length.toLocaleString()}`)
  console.log(`  rate limit                           ${REQUESTS_PER_WINDOW} requests / ${WINDOW_MS / 60000} min `
    + `(this run paces at one per ${GAP_MS} ms)`)
  console.log(`  estimated elapsed                    ${minutes.toFixed(1)} min`)

  if (plan) { console.log('\n--plan: nothing fetched, nothing written.'); return }

  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) {
    // ⚠ NOT A CRASH AND NOT A SHRUG. The absence of the key is the one thing standing between
    // this script and the numbers above, so it is reported as that rather than as an error.
    console.log('\n⚠⚠ COMPANIES_HOUSE_API_KEY is not set, so nothing was fetched.')
    console.log('   Everything above is a live count and needs no key. To run the pilot:')
    console.log('     1. register at developer.company-information.service.gov.uk')
    console.log('     2. create an application, then an API key of type "REST"')
    console.log('     3. add COMPANIES_HOUSE_API_KEY=<key> to scrutinise-web/.env')
    console.log('     4. npx tsx resolve-3d-companies-house.ts --pilot 50')
    process.exitCode = 3
    return
  }

  // ── the run ────────────────────────────────────────────────────────────────────────────────
  const t0 = Date.now()
  let found = 0, missing = 0, errors = 0, entitiesMade = 0, rowsUpdated = 0
  const statuses = new Map<number, number>()

  for (let i = 0; i < list.length; i++) {
    const ch = list[i].ch
    let res: Awaited<ReturnType<typeof fetchCompany>>
    try {
      res = await fetchCompany(ch, key)
    } catch (e) {
      errors++
      console.log(`   ERR ${ch} ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    if (!res.found) {
      missing++
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1)
      if (write) {
        // ⚠⚠ A NUMBER THAT RESOLVES TO NOTHING IS RECORDED AS UNRESOLVED AND COUNTED. §3 says so
        // explicitly. Leaving it in 'number-not-held' would make it indistinguishable from a
        // number nobody has looked up yet, and the next run would pay for it again.
        await pool.query(`
          UPDATE position_donation SET donor_resolution = 'unresolved:number-not-at-companies-house'
           WHERE donor_resolution = 'unresolved:number-not-held'
             AND lpad(regexp_replace(upper(company_registration_number), '[^A-Z0-9]', '', 'g'), 8, '0') = $1`,
          [ch])
      }
    } else {
      found++
      if (write) {
        // ⚠ ONE ENTITY PER REGISTRATION NUMBER, found or created by the NUMBER. `name_norm` is
        // filled from the canonical name for consistency with the rest of the table; it is never
        // used to match anything here.
        const { rows: [ent] } = await pool.query<{ id: string; created: boolean }>(`
          WITH existing AS (
            SELECT id FROM graph_entity WHERE companies_house_no = $1 LIMIT 1
          ), inserted AS (
            INSERT INTO graph_entity (kind, canonical_name, name_norm, companies_house_no,
                                      key_source, confidence, first_seen, last_seen, created_at)
            SELECT 'organisation', $2, lower(regexp_replace($2, '[^a-zA-Z0-9]', '', 'g')), $1,
                   'companies-house', 1.0, CURRENT_DATE, CURRENT_DATE, now()
             WHERE NOT EXISTS (SELECT 1 FROM existing)
            RETURNING id
          )
          SELECT id::text, TRUE AS created FROM inserted
          UNION ALL SELECT id::text, FALSE FROM existing
          LIMIT 1`, [ch, res.company.name])
        if (ent?.created) entitiesMade++
        const upd = await pool.query(`
          UPDATE position_donation
             SET donor_entity_id = $2::bigint,
                 donor_resolution = 'resolved:companies-house-no'
           WHERE donor_resolution = 'unresolved:number-not-held'
             AND lpad(regexp_replace(upper(company_registration_number), '[^A-Z0-9]', '', 'g'), 8, '0') = $1`,
          [ch, ent.id])
        rowsUpdated += upd.rowCount ?? 0
      }
    }

    if ((i + 1) % 25 === 0) {
      console.log(`   ${i + 1}/${list.length}  found ${found} · not at CH ${missing} · errors ${errors}`)
    }
    if (i < list.length - 1) await new Promise((r) => setTimeout(r, GAP_MS))
  }

  const elapsed = (Date.now() - t0) / 1000
  console.log('\n── the run ──')
  console.log(`  looked up          ${list.length.toLocaleString()}`)
  console.log(`  resolved           ${found.toLocaleString()} (${(100 * found / Math.max(1, list.length)).toFixed(1)}%)`)
  console.log(`  not at CH          ${missing.toLocaleString()}`)
  console.log(`  errors             ${errors.toLocaleString()}`)
  console.log(`  HTTP status split  ${[...statuses].map(([s, n]) => `${s}×${n}`).join(', ') || '—'}`)
  console.log(`  elapsed            ${elapsed.toFixed(1)} s (${(elapsed / Math.max(1, list.length)).toFixed(2)} s/lookup)`)
  if (!write) { console.log('\n  (no --write: nothing was persisted)'); return }
  console.log(`  entities created   ${entitiesMade.toLocaleString()}`)
  console.log(`  register rows set  ${rowsUpdated.toLocaleString()}`)

  // ── ⚠ RE-READ. Report what the database says afterwards, never what the loop counted. ───────
  const { rows: [after] } = await pool.query<{ resolved: string; notheld: string; notatch: string }>(`
    SELECT (SELECT COUNT(*)::bigint FROM position_donation WHERE donor_resolution = 'resolved:companies-house-no') resolved,
           (SELECT COUNT(*)::bigint FROM position_donation WHERE donor_resolution = 'unresolved:number-not-held') notheld,
           (SELECT COUNT(*)::bigint FROM position_donation WHERE donor_resolution = 'unresolved:number-not-at-companies-house') notatch`)
  console.log('\n── after, re-read from the database ──')
  console.log(`  donor-resolved rows                ${Number(after.resolved).toLocaleString()} `
    + `(was ${Number(before.resolved).toLocaleString()})`)
  console.log(`  still un-looked-up                 ${Number(after.notheld).toLocaleString()}`)
  console.log(`  looked up, not at Companies House  ${Number(after.notatch).toLocaleString()}`)
  console.log('\n⚠ SIGNALS ARE NOT EMITTED BY THIS SCRIPT. Re-run the emit step in ingest-3b-ec.ts')
  console.log('  (section 6) to turn the newly resolved donors into political_donation signals,')
  console.log('  then compare the count against the prediction in this file’s header.')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => endNeonPool())
