/**
 * probe-3c.ts — GRAPH 3C. Read the live graph BEFORE changing anything.
 *
 * Brief §0/§6: bytes before hypotheses. Every number this sprint's design decisions turn on is
 * read here first, so the design is chosen against the data rather than against 3B's prose.
 *
 * Usage (from scripts/graph):
 *   npx tsx probe-3c.ts            # everything
 *   npx tsx probe-3c.ts --section 3
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const ONLY = (() => { const i = argv.indexOf('--section'); return i >= 0 ? argv[i + 1] : null })()
const want = (s: string) => !ONLY || ONLY === s

function hdr(n: string, t: string) { console.log(`\n════ ${n} · ${t} ════`) }

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    if (want('1')) {
      hdr('1', 'THE `divisions` TABLE — what a bill-level rule could join on')
      const { rows } = await pool.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type FROM information_schema.columns
         WHERE table_name = 'divisions' ORDER BY ordinal_position`)
      for (const r of rows) console.log(`  ${r.column_name.padEnd(24)} ${r.data_type}`)
      const { rows: [c] } = await pool.query<{ n: string; with_bill: string; distinct_bill: string }>(`
        SELECT COUNT(*)::text AS n,
               COUNT(*) FILTER (WHERE bill_title IS NOT NULL AND bill_title <> '')::text AS with_bill,
               COUNT(DISTINCT bill_title)::text AS distinct_bill
          FROM divisions`)
      console.log(`\n  divisions ${Number(c.n).toLocaleString()}; with a bill_title ${Number(c.with_bill).toLocaleString()}; distinct bill_titles ${Number(c.distinct_bill).toLocaleString()}`)
    }

    if (want('2')) {
      hdr('2', 'BASELINE — the stance and confidence distributions as they stand')
      const { rows: [d] } = await pool.query<{ n: string; ds: string; dc: string; at1: string; at0: string; maxc: string }>(`
        SELECT COUNT(*)::text AS n,
               COUNT(DISTINCT stance_score)::text AS ds,
               COUNT(DISTINCT confidence)::text AS dc,
               COUNT(*) FILTER (WHERE ABS(stance_score) = 1)::text AS at1,
               COUNT(*) FILTER (WHERE stance_score = 0)::text AS at0,
               MAX(confidence)::text AS maxc
          FROM position_estimate`)
      console.log(`  estimates              ${Number(d.n).toLocaleString()}`)
      console.log(`  distinct stance values ${d.ds}`)
      console.log(`  distinct confidence    ${Number(d.dc).toLocaleString()}`)
      console.log(`  at |stance| = 1.00     ${Number(d.at1).toLocaleString()}  (${((100 * Number(d.at1)) / Number(d.n)).toFixed(2)}% of all estimates)`)
      console.log(`  at stance = 0.00       ${Number(d.at0).toLocaleString()}  (${((100 * Number(d.at0)) / Number(d.n)).toFixed(2)}%)`)
      console.log(`  max confidence         ${d.maxc}`)
      const { rows: st } = await pool.query<{ s: string; n: string }>(
        `SELECT stance_score::text AS s, COUNT(*)::text AS n FROM position_estimate GROUP BY 1 ORDER BY 1::numeric`)
      console.log(`\n  stance histogram:`)
      for (const r of st) console.log(`    ${r.s.padStart(8)}  ${Number(r.n).toLocaleString().padStart(11)}`)
      const { rows: cb } = await pool.query<{ b: string; n: string }>(`
        SELECT CASE WHEN confidence < 0.05 THEN '0.00-0.05'
                    WHEN confidence < 0.10 THEN '0.05-0.10'
                    WHEN confidence < 0.15 THEN '0.10-0.15'
                    WHEN confidence < 0.50 THEN '0.15-0.50'
                    WHEN confidence < 0.75 THEN '0.50-0.75'
                    ELSE '0.75+' END AS b, COUNT(*)::text AS n
          FROM position_estimate GROUP BY 1 ORDER BY 1`)
      console.log(`\n  confidence buckets:`)
      for (const r of cb) console.log(`    ${r.b.padEnd(10)} ${Number(r.n).toLocaleString().padStart(11)}`)
    }

    if (want('3')) {
      hdr('3', 'THE ELEVEN ASSISTED-DYING DIVISIONS, WITH EVERY PARTY COHESION')
      const { rows } = await pool.query<{
        house: string; division_id: number; division_date: string; title: string
        free_vote_like: boolean; best_cohesion: string | null; best_party: string | null }>(`
        SELECT d.house, d.division_id, d.division_date::text AS division_date, left(d.title, 70) AS title,
               c.free_vote_like, ROUND(c.best_cohesion::numeric, 4)::text AS best_cohesion, c.best_party
          FROM divisions d JOIN position_division_class c
            ON c.house = d.house AND c.division_id = d.division_id
         WHERE d.title ILIKE '%terminally ill adults%' OR d.title ILIKE '%assisted dying%'
            OR d.bill_title ILIKE '%terminally ill adults%'
         ORDER BY d.division_date, d.division_id`)
      for (const r of rows) {
        console.log(`  ${r.free_vote_like ? 'FREE ' : '⚠ NOT'}  ${r.division_date}  ${r.house}:${r.division_id}  best ${String(r.best_cohesion ?? '—').padStart(6)} ${(r.best_party ?? '—').padEnd(16)} ${r.title}`)
      }
      console.log(`\n  ── per-party cohesion on the two the heuristic misses ──`)
      const { rows: parties } = await pool.query<{
        division_id: number; party: string; ayes: number; noes: number
        cohesion: string; is_whipped_party: boolean; majority_side: string | null }>(`
        SELECT p.division_id, p.party, p.ayes, p.noes,
               ROUND(p.cohesion::numeric, 4)::text AS cohesion, p.is_whipped_party, p.majority_side
          FROM position_division_party p
          JOIN position_division_class c ON c.house = p.house AND c.division_id = p.division_id
          JOIN divisions d ON d.house = p.house AND d.division_id = p.division_id
         WHERE NOT c.free_vote_like
           AND (d.title ILIKE '%terminally ill adults%' OR d.title ILIKE '%assisted dying%'
                OR d.bill_title ILIKE '%terminally ill adults%')
           AND p.ayes + p.noes >= 5
         ORDER BY p.division_id, p.cohesion DESC`)
      for (const r of parties) {
        console.log(`  ${String(r.division_id).padStart(5)}  ${r.party.padEnd(28)} aye ${String(r.ayes).padStart(4)} no ${String(r.noes).padStart(4)}  cohesion ${r.cohesion.padStart(6)}  whipped=${r.is_whipped_party}  maj=${r.majority_side ?? '—'}`)
      }
    }

    if (want('4')) {
      hdr('4', 'HOW MUCH WOULD A PER-PARTY COHESION FLOOR MOVE? (whipped-eligible groups only)')
      const { rows } = await pool.query<{ b: string; groups: string; votes: string }>(`
        SELECT CASE WHEN p.cohesion >= 0.99 THEN 'f 0.99-1.00'
                    WHEN p.cohesion >= 0.95 THEN 'e 0.95-0.99'
                    WHEN p.cohesion >= 0.90 THEN 'd 0.90-0.95'
                    WHEN p.cohesion >= 0.85 THEN 'c 0.85-0.90'
                    WHEN p.cohesion >= 0.70 THEN 'b 0.70-0.85'
                    ELSE 'a <0.70' END AS b,
               COUNT(*)::text AS groups,
               SUM(p.ayes + p.noes)::text AS votes
          FROM position_division_party p
         WHERE p.is_whipped_party
         GROUP BY 1 ORDER BY 1`)
      let tv = 0
      for (const r of rows) tv += Number(r.votes)
      for (const r of rows) {
        console.log(`  ${r.b.slice(2).padEnd(12)} ${Number(r.groups).toLocaleString().padStart(8)} party×division groups   ${Number(r.votes).toLocaleString().padStart(11)} votes  (${((100 * Number(r.votes)) / tv).toFixed(2)}% of whipped-party votes)`)
      }
      console.log(`  ${'TOTAL'.padEnd(12)} ${''.padStart(8)}                          ${tv.toLocaleString().padStart(11)}`)

      console.log(`\n  ── what the minority side in each band is worth today ──`)
      const { rows: min } = await pool.query<{ b: string; minority: string }>(`
        SELECT CASE WHEN p.cohesion >= 0.95 THEN 'e 0.95+'
                    WHEN p.cohesion >= 0.90 THEN 'd 0.90-0.95'
                    WHEN p.cohesion >= 0.85 THEN 'c 0.85-0.90'
                    ELSE 'a <0.85' END AS b,
               SUM(LEAST(p.ayes, p.noes))::text AS minority
          FROM position_division_party p
          JOIN position_division_class c ON c.house = p.house AND c.division_id = p.division_id
         WHERE p.is_whipped_party AND NOT c.free_vote_like
         GROUP BY 1 ORDER BY 1`)
      for (const r of min) console.log(`    cohesion ${r.b.slice(2).padEnd(12)} ${Number(r.minority).toLocaleString().padStart(10)} votes currently classed rebellion:v1 @ 0.9`)
    }

    if (want('5')) {
      hdr('5', 'THE WHIPPED NI ABORTION REGULATIONS — the negative control §2 names')
      const { rows } = await pool.query<{
        house: string; division_id: number; division_date: string; title: string
        free_vote_like: boolean; best_cohesion: string | null; best_party: string | null; n_div_on_bill: string }>(`
        SELECT d.house, d.division_id, d.division_date::text AS division_date, left(d.title, 66) AS title,
               c.free_vote_like, ROUND(c.best_cohesion::numeric, 4)::text AS best_cohesion, c.best_party,
               (SELECT COUNT(*)::text FROM divisions d2 WHERE d2.bill_title IS NOT NULL
                  AND d2.bill_title = d.bill_title) AS n_div_on_bill
          FROM divisions d JOIN position_division_class c
            ON c.house = d.house AND c.division_id = d.division_id
         WHERE d.title ILIKE '%abortion%' OR d.bill_title ILIKE '%abortion%'
         ORDER BY d.division_date`)
      for (const r of rows) {
        console.log(`  ${r.free_vote_like ? '⚠ FREE' : 'whip  '}  ${r.division_date}  ${r.house}:${r.division_id}  best ${String(r.best_cohesion ?? '—').padStart(6)} ${(r.best_party ?? '—').padEnd(14)} ${r.title}`)
      }
    }

    if (want('6')) {
      hdr('6', 'BILL-LEVEL PROPAGATION — how many divisions would a bill rule reach?')
      const { rows: [c] } = await pool.query<{ bills: string; mixed: string; would_add: string }>(`
        WITH b AS (
          SELECT d.bill_title,
                 COUNT(*)::int AS n,
                 COUNT(*) FILTER (WHERE c.free_vote_like)::int AS free
            FROM divisions d JOIN position_division_class c
              ON c.house = d.house AND c.division_id = d.division_id
           WHERE d.bill_title IS NOT NULL AND d.bill_title <> ''
           GROUP BY 1)
        SELECT COUNT(*)::text AS bills,
               COUNT(*) FILTER (WHERE free > 0 AND free < n)::text AS mixed,
               COALESCE(SUM(n - free) FILTER (WHERE free::real / n >= 0.5), 0)::text AS would_add
          FROM b`)
      console.log(`  bills with divisions           ${Number(c.bills).toLocaleString()}`)
      console.log(`  bills with a MIXED verdict     ${Number(c.mixed).toLocaleString()}`)
      console.log(`  divisions a "majority of the bill's divisions are free-vote-like" rule would ADD: ${Number(c.would_add).toLocaleString()}`)
      const { rows: top } = await pool.query<{ bill_title: string; n: string; free: string }>(`
        WITH b AS (
          SELECT d.bill_title, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE c.free_vote_like)::int AS free
            FROM divisions d JOIN position_division_class c
              ON c.house = d.house AND c.division_id = d.division_id
           WHERE d.bill_title IS NOT NULL AND d.bill_title <> ''
           GROUP BY 1)
        SELECT left(bill_title, 70) AS bill_title, n::text, free::text
          FROM b WHERE free::real / n >= 0.5 AND free < n ORDER BY (n - free) DESC LIMIT 25`)
      console.log(`\n  the bills such a rule would reach (majority free-vote-like, some divisions not):`)
      for (const r of top) console.log(`    ${String(r.free).padStart(3)}/${String(r.n).padEnd(4)} free   ${r.bill_title}`)
    }

    if (want('7')) {
      hdr('7', '§4.2 — THE ELECTORAL COMMISSION COMPANIES HOUSE GAP')
      const { rows: [c] } = await pool.query<{ total: string; with_no: string; held: string; not_held: string; distinct_not_held: string }>(`
        SELECT COUNT(*)::text AS total,
               COUNT(*) FILTER (WHERE company_registration_number IS NOT NULL
                                  AND company_registration_number <> '')::text AS with_no,
               COUNT(*) FILTER (WHERE donor_resolution = 'resolved:companies-house-no')::text AS held,
               COUNT(*) FILTER (WHERE donor_resolution = 'unresolved:number-not-held')::text AS not_held,
               COUNT(DISTINCT company_registration_number)
                 FILTER (WHERE donor_resolution = 'unresolved:number-not-held')::text AS distinct_not_held
          FROM position_donation`)
      console.log(`  published records                    ${Number(c.total).toLocaleString()}`)
      console.log(`  carrying a CH number                 ${Number(c.with_no).toLocaleString()}`)
      console.log(`  … number we HOLD                     ${Number(c.held).toLocaleString()}`)
      console.log(`  … number we DO NOT hold              ${Number(c.not_held).toLocaleString()}`)
      console.log(`  … DISTINCT companies to acquire      ${Number(c.distinct_not_held).toLocaleString()}`)
      const { rows: [d] } = await pool.query<{ eligible: string; both: string }>(`
        SELECT COUNT(*) FILTER (WHERE donee_resolution = 'resolved:unique-mnis-name')::text AS eligible,
               COUNT(*) FILTER (WHERE donee_resolution = 'resolved:unique-mnis-name'
                                  AND donor_resolution = 'unresolved:number-not-held')::text AS both
          FROM position_donation`)
      console.log(`\n  donee resolved                       ${Number(d.eligible).toLocaleString()}`)
      console.log(`  donee resolved + donor number UNHELD ${Number(d.both).toLocaleString()}   ← the signals acquiring the numbers would unlock`)
      const { rows: [e] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM graph_entity WHERE companies_house_no IS NOT NULL`)
      console.log(`  organisations we hold with a CH no    ${Number(e.n).toLocaleString()}`)
    }

    if (want('8')) {
      hdr('8', 'DATABASE SIZE AND THE ENFORCED CEILING')
      const { rows: [sz] } = await pool.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)
      const { rows: g } = await pool.query<{ setting: string; unit: string | null }>(
        `SELECT setting, unit FROM pg_settings WHERE name = 'neon.max_cluster_size'`)
      console.log(`  database        ${(Number(sz.b) / 1024 ** 3).toFixed(2)} GiB`)
      console.log(`  neon.max_cluster_size  ${g.length ? `${g[0].setting} ${g[0].unit ?? ''}` : 'unreadable'}`)
      const { rows: t } = await pool.query<{ name: string; s: string }>(`
        SELECT tablename AS name, pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS s
          FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'position%'
         ORDER BY pg_total_relation_size(quote_ident(tablename)) DESC`)
      for (const r of t) console.log(`  ${r.name.padEnd(28)} ${r.s}`)
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3c] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
