/**
 * probe-3a-cost.ts — GRAPH 3A: PRICE `position_signal` BEFORE WRITING A ROW OF IT.
 *
 * This is the probe 2D-2 ran before it declined to copy 2.5M vote rows into `graph_edge`, and it
 * is run again for the same reason: the vote half of §3 is ~2.1M rows and the database is close to
 * its ops alert line. The measurement is on THIS database with REAL rows, not an estimate from
 * column widths — a real row carries its tuple header, its TOAST decisions and its index entries,
 * and those are what actually cost.
 *
 * Creates a temporary table, fills it from real data, measures, and DROPS it. Nothing persists.
 * (The DROP here is of a table this script created seconds earlier in a TEMP schema; docs/CLAUDE.md
 * §16's rule is about schema-altering work on real tables.)
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const SAMPLE = 100_000

async function main() {
  const pool = getNeonPool()
  const client = await pool.connect()
  try {
    const { rows: [who] } = await client.query<{ db: string }>(`SELECT current_database() AS db`)
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    console.log(`host ${host}  db ${who.db}`)
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error('not the production host — refusing'); process.exit(1) }

    const { rows: [sz] } = await client.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)
    const gib = Number(sz.b) / 1024 ** 3
    console.log(`database ${gib.toFixed(2)} GiB — ${((100 * gib) / 17.5).toFixed(1)}% of the 17.5 GiB ops ALERT line`)
    console.log(`headroom to the ALERT line: ${(17.5 - gib).toFixed(2)} GiB`)

    console.log(`\ngraph_entity.id type:`)
    const { rows: idt } = await client.query(
      `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
        WHERE table_schema='public' AND table_name='graph_entity' AND column_name='id'`)
    console.log('   ', JSON.stringify(idt[0]))

    // The candidate shape, exactly as design §3 specifies it.
    await client.query(`
      CREATE TEMP TABLE ps_price (
        id            bigserial primary key,
        actor_id      text        not null,
        target_type   text        not null,
        target_id     text        not null,
        signal_type   text        not null,
        direction     smallint    not null,
        raw_weight    real        not null,
        derivation    text,
        evidence_ids  text[]      not null,
        observed_at   date        not null,
        created_at    timestamptz not null default now(),
        superseded_by bigint
      ) ON COMMIT PRESERVE ROWS`)

    console.log(`\nfilling with ${SAMPLE.toLocaleString()} REAL vote rows …`)
    const t0 = Date.now()
    await client.query(`
      INSERT INTO ps_price (actor_id, target_type, target_id, signal_type, direction, raw_weight,
                            derivation, evidence_ids, observed_at)
      SELECT e.id,
             'division',
             v.house || ':' || v.division_id,
             'vote',
             CASE v.vote WHEN 'aye' THEN 1 ELSE -1 END,
             0.2::real,
             'whipped:v1',
             ARRAY[v.house || '-divisions-votes:' || v.division_id || ':1'],
             v.division_date
        FROM division_votes v
        JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind='person'
       WHERE v.vote <> 'absent'
       LIMIT ${SAMPLE}`)
    console.log(`  inserted in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

    const { rows: [a] } = await client.query<{ n: string; b: string }>(
      `SELECT COUNT(*)::text AS n, pg_total_relation_size('ps_price')::text AS b FROM ps_price`)
    const perRowNoIdx = Number(a.b) / Number(a.n)
    console.log(`\n  ${Number(a.n).toLocaleString()} rows, ${(Number(a.b) / 1024 ** 2).toFixed(1)} MiB with the PK only`)
    console.log(`  → ${perRowNoIdx.toFixed(1)} bytes/row`)

    // The two indexes §2 requires.
    await client.query(`CREATE INDEX ps_price_actor_idx ON ps_price (actor_id, target_type, target_id)`)
    await client.query(`CREATE INDEX ps_price_target_idx ON ps_price (target_type, target_id)`)
    const { rows: [b] } = await client.query<{ b: string }>(
      `SELECT pg_total_relation_size('ps_price')::text AS b`)
    const perRow = Number(b.b) / Number(a.n)
    console.log(`  with both §2 indexes: ${(Number(b.b) / 1024 ** 2).toFixed(1)} MiB → ${perRow.toFixed(1)} bytes/row`)

    // What the real work would cost.
    const { rows: [c] } = await client.query<{ votes: string; edm: string; wit: string; int: string }>(`
      SELECT (SELECT COUNT(*)::text FROM division_votes v
                JOIN graph_entity e ON e.parl_member_id=v.member_id AND e.kind='person'
               WHERE v.vote <> 'absent') AS votes,
             (SELECT COUNT(*)::text FROM graph_signed_motion_edge) AS edm,
             (SELECT COUNT(*)::text FROM graph_edge WHERE predicate='gave-evidence-to') AS wit,
             (SELECT COUNT(*)::text FROM graph_edge WHERE predicate='declared-interest') AS int`)
    const votes = Number(c.votes), edm = Number(c.edm), wit = Number(c.wit), int = Number(c.int)
    const all = votes + edm + wit + int
    console.log(`\n════ WHAT §3 WOULD COST IF EVERY SIGNAL IS A STORED ROW ════`)
    console.log(`  votes (directional, absent excluded) ${votes.toLocaleString().padStart(11)}`)
    console.log(`  EDM signatures (primary sponsor)     ${edm.toLocaleString().padStart(11)}`)
    console.log(`  witness appearances                  ${wit.toLocaleString().padStart(11)}`)
    console.log(`  declared interests                   ${int.toLocaleString().padStart(11)}`)
    console.log(`  committee memberships                ${'0'.padStart(11)}  (not held — see the audit)`)
    console.log(`  amendment sponsorship                ${'0'.padStart(11)}  (not held — see the audit)`)
    console.log(`  ─────────────────────────────────────${''.padStart(11, '─')}`)
    console.log(`  TOTAL                                ${all.toLocaleString().padStart(11)}`)
    console.log(`\n  at ${perRow.toFixed(1)} bytes/row  =  ${((all * perRow) / 1024 ** 3).toFixed(2)} GiB`)
    console.log(`  votes alone                          =  ${((votes * perRow) / 1024 ** 3).toFixed(2)} GiB`)
    console.log(`  everything EXCEPT votes              =  ${(((all - votes) * perRow) / 1024 ** 2).toFixed(0)} MiB`)
    console.log(`\n  headroom to the ops ALERT line       =  ${(17.5 - gib).toFixed(2)} GiB`)
    console.log(`  → storing votes ${((votes * perRow) / 1024 ** 3) > (17.5 - gib) ? 'EXCEEDS' : 'fits inside'} the headroom.`)

    await client.query(`DROP TABLE ps_price`)
    console.log('\ntemp table dropped; nothing persisted.')
  } finally {
    client.release()
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a-cost] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
