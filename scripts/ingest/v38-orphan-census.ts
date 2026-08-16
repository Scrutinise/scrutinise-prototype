/**
 * v38-orphan-census.ts — BRIEF_INGEST_V38_STORAGE §4.1. READ-ONLY. Writes nothing, drops nothing.
 *
 * S3 reported "roughly 23,000 sections of real text held only in the legacy table", extrapolated
 * from a random n=400. That number is the last thing standing between us and dropping 1.67 GiB, so
 * it deserves a census rather than an estimate — this project has been bitten twice by the
 * difference (V36's hand-picked pilot said 6/6 until a random draw said 27.5%; the 400-sample
 * dot-leader rate said 9.75% and the full census said 11.44%).
 *
 * THE TEST, per legacy provision rather than per instrument:
 *
 *   1  take every `LegislationSection` in an instrument the corpus is SHORT on
 *   2  drop dot-leader placeholders — a repealed-provision placeholder is not "real text held only
 *      in the legacy table", and counting it as a gap inflates the blocker
 *   3  normalise its title and ask where the corpus holds that title:
 *        · under the SAME instrument            → covered in place
 *        · elsewhere in the legislation corpora → S3's amendment-target case (held under the act
 *                                                 the provision was inserted INTO)
 *        · nowhere                              → HELD ONLY IN THE LEGACY TABLE
 *   4  flag titles too common to discriminate — "Interpretation" matching somewhere is not
 *      evidence that THIS provision is held. Reported as an uncertainty band, never as found.
 *
 * ⚠⚠ THE REGNAL ALIAS, AND THE FIRST RUN OF THIS SCRIPT GOT IT WRONG.
 * `LegislationItem` carries the CALENDAR id by design (the V36 §1 finding); the corpus holds
 * pre-1963 Acts under the REGNAL id. Without resolving that, the census reported the Law of
 * Property Act 1925 as 218 legacy sections against **0** in the corpus — and it is in the corpus,
 * as `ukpga/Geo5/15-16/20`. The first run's headline of 47,427 was inflated by that whole class.
 * The alias map (14,294 pairs, from V36's own source walk) is now applied on BOTH sides. This is
 * the same defect S3 documented and fixed in its own step 1→2, arriving in mine because I did not
 * read their fix before writing this.
 *
 * ⚠ The match is EXACT on a normalised title, which errs toward calling a held provision missing
 * rather than a missing provision held.
 *
 * Usage (from scripts/ingest):  npx tsx v38-orphan-census.ts [--common 50] [--out FILE]
 */
import fs from 'fs'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const arg = (f: string, d: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d }
const COMMON = parseInt(arg('--common', '50'), 10)
const OUT = arg('--out', path.join(__dirname, 'v38-orphan-census.json'))
const ALIAS_PATH = path.join(__dirname, 'v36', 'source-entries.json')
const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'retained-eu', 'regional']

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const n = (v: any) => Number(v).toLocaleString('en-GB')
const NORM = (col: string) => `lower(regexp_replace(regexp_replace(btrim(${col}), '[^A-Za-z0-9 ]', ' ', 'g'), '\\s+', ' ', 'g'))`
/** A dot-leader row is a repealed-provision placeholder, not text we would lose. */
const PLACEHOLDER = (col: string) => `(${col} IS NULL OR btrim(${col}) = '' OR ${col} ~ '^[\\s0-9.]*$' OR ${col} ~ '\\.\\s*\\.\\s*\\.\\s*\\.\\s*\\.')`

function aliasPairs(): Array<[string, string]> {
  if (!fs.existsSync(ALIAS_PATH)) { console.warn(`⚠ NO ALIAS MAP at ${ALIAS_PATH} — regnal false gaps will NOT be resolved and the census WILL be inflated`); return [] }
  const store: Record<string, { docId: string; calendarId: string | null }[]> = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'))
  const out: Array<[string, string]> = []
  for (const entries of Object.values(store)) {
    for (const e of entries) if (e.calendarId && e.calendarId !== e.docId) out.push([e.calendarId, e.docId])
  }
  return out
}

async function main() {
  console.log(`common-title threshold: a title on more than ${COMMON} corpus sections cannot discriminate`)
  const pairs = aliasPairs()
  console.log(`alias map: ${n(pairs.length)} regnal/calendar pairs`)

  const c = await pool.connect()
  let census: any, worst: any[] = [], aliasRescued = 0
  try {
    await c.query(`SET statement_timeout = '900s'`)

    // ── identity: calendar id ↔ regnal id, both directions ────────────────────────────────────
    await c.query(`CREATE TEMP TABLE _alias (a TEXT, b TEXT)`)
    for (let i = 0; i < pairs.length; i += 2000) {
      const chunk = pairs.slice(i, i + 2000)
      const vals: string[] = []; const args: any[] = []
      chunk.forEach((p, j) => { vals.push(`($${j * 2 + 1},$${j * 2 + 2})`); args.push(p[0], p[1]) })
      await c.query(`INSERT INTO _alias (a,b) VALUES ${vals.join(',')}`, args)
    }
    await c.query(`CREATE INDEX ON _alias (a)`)

    // Every identity a legacy instrument may appear under in the corpus.
    await c.query(`
      CREATE TEMP TABLE _ids AS
        SELECT DISTINCT li."legislationGovUkId" AS gid, li."legislationGovUkId" AS alt
          FROM "LegislationItem" li
        UNION
        SELECT li."legislationGovUkId", al.b
          FROM "LegislationItem" li JOIN _alias al ON al.a = li."legislationGovUkId"`)
    await c.query(`CREATE INDEX ON _ids (alt)`); await c.query(`CREATE INDEX ON _ids (gid)`)

    // ── the corpus, keyed by instrument, resolved through the alias ───────────────────────────
    await c.query(`
      CREATE TEMP TABLE _corpus AS
        SELECT split_part(id, ':', 2) AS alt, COUNT(*)::int AS corpus_n
          FROM corpus_sections WHERE id LIKE '%:%:%' GROUP BY 1`)
    await c.query(`CREATE INDEX ON _corpus (alt)`)
    await c.query(`
      CREATE TEMP TABLE _cov AS
        SELECT i.gid, SUM(cc.corpus_n)::int AS corpus_n
          FROM _ids i JOIN _corpus cc ON cc.alt = i.alt GROUP BY 1`)
    await c.query(`CREATE INDEX ON _cov (gid)`)

    // ── instruments the corpus is still short on, AFTER alias resolution ──────────────────────
    await c.query(`
      CREATE TEMP TABLE _short AS
      WITH legacy AS (
        SELECT li."legislationGovUkId" AS gid, COUNT(*)::int AS legacy_n
          FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
         GROUP BY 1)
      SELECT l.gid, l.legacy_n, COALESCE(v.corpus_n, 0) AS corpus_n
        FROM legacy l LEFT JOIN _cov v ON v.gid = l.gid
       WHERE COALESCE(v.corpus_n, 0) < l.legacy_n`)
    await c.query(`CREATE INDEX ON _short (gid)`)

    const [{ rows: [sh] }, { rows: [shRaw] }] = [
      await c.query(`SELECT COUNT(*)::text AS instruments, SUM(legacy_n - corpus_n)::text AS shortfall FROM _short`),
      await c.query(`
        WITH legacy AS (SELECT li."legislationGovUkId" AS gid, COUNT(*)::int AS legacy_n
                          FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id=ls."legislationItemId" GROUP BY 1)
        SELECT COUNT(*)::text AS instruments FROM legacy l
          LEFT JOIN _corpus cc ON cc.alt = l.gid WHERE COALESCE(cc.corpus_n,0) < l.legacy_n`),
    ]
    aliasRescued = Number(shRaw.instruments) - Number(sh.instruments)
    console.log(`\nshort instruments BEFORE alias resolution: ${n(shRaw.instruments)}`)
    console.log(`short instruments AFTER  alias resolution: ${n(sh.instruments)}   → ${n(aliasRescued)} were regnal artefacts`)

    // ── corpus titles, in the legislation corpora only ────────────────────────────────────────
    await c.query(`
      CREATE TEMP TABLE _ct AS
        SELECT ${NORM('"sectionTitle"')} AS tnorm, split_part(id, ':', 2) AS alt, COUNT(*)::int AS k
          FROM corpus_sections
         WHERE corpus = ANY($1::text[]) AND "sectionTitle" IS NOT NULL AND "sectionTitle" <> ''
         GROUP BY 1,2`, [LEG_CORPORA])
    await c.query(`CREATE INDEX ON _ct (tnorm)`)
    // "same instrument" must accept either identity, so resolve the corpus side through _ids too.
    await c.query(`
      CREATE TEMP TABLE _ct_gid AS
        SELECT DISTINCT t.tnorm, i.gid FROM _ct t JOIN _ids i ON i.alt = t.alt`)
    await c.query(`CREATE INDEX ON _ct_gid (tnorm, gid)`)
    await c.query(`CREATE TEMP TABLE _ctot AS SELECT tnorm, SUM(k)::int AS total FROM _ct GROUP BY 1`)
    await c.query(`CREATE INDEX ON _ctot (tnorm)`)

    head('§4.1 — THE CENSUS, REPLACING THE EXTRAPOLATION')
    const { rows: [r] } = await c.query(`
      WITH prov AS (
        SELECT li."legislationGovUkId" AS gid,
               ${NORM('ls."sectionTitle"')} AS tnorm,
               ${PLACEHOLDER('ls."originalText"')} AS is_placeholder
          FROM "LegislationSection" ls
          JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
          JOIN _short s ON s.gid = li."legislationGovUkId")
      SELECT COUNT(*)::text AS provisions,
             COUNT(*) FILTER (WHERE p.is_placeholder)::text AS placeholders,
             COUNT(*) FILTER (WHERE NOT p.is_placeholder AND COALESCE(p.tnorm,'')='')::text AS no_title,
             COUNT(*) FILTER (WHERE NOT p.is_placeholder AND p.tnorm<>'' AND g.gid IS NOT NULL)::text AS covered_in_place,
             COUNT(*) FILTER (WHERE NOT p.is_placeholder AND p.tnorm<>'' AND g.gid IS NULL AND t.total IS NOT NULL AND t.total <= ${COMMON})::text AS found_elsewhere,
             COUNT(*) FILTER (WHERE NOT p.is_placeholder AND p.tnorm<>'' AND g.gid IS NULL AND t.total IS NOT NULL AND t.total >  ${COMMON})::text AS undiscriminating,
             COUNT(*) FILTER (WHERE NOT p.is_placeholder AND p.tnorm<>'' AND g.gid IS NULL AND t.total IS NULL)::text AS held_only_in_legacy
        FROM prov p
        LEFT JOIN _ct_gid g ON g.tnorm = p.tnorm AND g.gid = p.gid
        LEFT JOIN _ctot   t ON t.tnorm = p.tnorm`)
    census = r
    const P = Number(r.provisions); const pct = (x: any) => `${((100 * Number(x)) / P).toFixed(1)}%`
    console.log(`   legacy provisions inside instruments the corpus is short on   ${n(r.provisions).padStart(9)}`)
    console.log(`   ── dot-leader placeholders (NOT text we would lose)           ${n(r.placeholders).padStart(9)}  ${pct(r.placeholders)}`)
    console.log(`   ── no usable title (cannot be judged either way)              ${n(r.no_title).padStart(9)}  ${pct(r.no_title)}`)
    console.log(`   ── covered IN PLACE, same instrument                          ${n(r.covered_in_place).padStart(9)}  ${pct(r.covered_in_place)}`)
    console.log(`   ── found ELSEWHERE (S3's amendment-target case)               ${n(r.found_elsewhere).padStart(9)}  ${pct(r.found_elsewhere)}`)
    console.log(`   ── ⚠ matched only on an UNDISCRIMINATING title                ${n(r.undiscriminating).padStart(9)}  ${pct(r.undiscriminating)}`)
    console.log(`   ── ⚠⚠ HELD ONLY IN THE LEGACY TABLE                          ${n(r.held_only_in_legacy).padStart(9)}  ${pct(r.held_only_in_legacy)}`)
    console.log(`\n   S3 extrapolated ~23,000 from n=400. The census says ${n(r.held_only_in_legacy)},`)
    console.log(`   with an uncertainty band up to ${n(Number(r.held_only_in_legacy) + Number(r.undiscriminating))} if every undiscriminating match is a miss.`)

    head('§4.1 — THE WORK LIST')
    const res = await c.query(`
      SELECT s.gid, MIN(li.title) AS title, MIN(s.legacy_n) AS legacy_n, MIN(s.corpus_n) AS corpus_n,
             COUNT(*)::int AS orphans
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
        JOIN _short s ON s.gid = li."legislationGovUkId"
        LEFT JOIN _ct_gid g ON g.tnorm = ${NORM('ls."sectionTitle"')} AND g.gid = s.gid
        LEFT JOIN _ctot   t ON t.tnorm = ${NORM('ls."sectionTitle"')}
       WHERE g.gid IS NULL AND t.tnorm IS NULL
         AND ${NORM('ls."sectionTitle"')} <> ''
         AND NOT ${PLACEHOLDER('ls."originalText"')}
       GROUP BY s.gid ORDER BY orphans DESC LIMIT 25`)
    worst = res.rows
    console.log(`   ${'instrument'.padEnd(26)} ${'legacy'.padStart(7)} ${'corpus'.padStart(7)} ${'orphans'.padStart(8)}  title`)
    for (const w of worst) console.log(`   ${String(w.gid).padEnd(26)} ${String(w.legacy_n).padStart(7)} ${String(w.corpus_n).padStart(7)} ${String(w.orphans).padStart(8)}  ${String(w.title ?? '').slice(0, 44)}`)
  } finally { c.release() }

  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), commonThreshold: COMMON, aliasPairs: pairs.length, aliasRescuedInstruments: aliasRescued, census, worstInstruments: worst }, null, 2))
  console.log(`\n   work list written to ${OUT}`)
  await endNeonPool()
}
main().catch((e) => { console.error('[v38-orphan-census] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
