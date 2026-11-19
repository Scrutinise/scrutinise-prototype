/**
 * check-graph-name-lookup.ts — GRAPHS: lib/graph/name-lookup.ts (read-only name → candidates).
 *
 *   npm run check:graph-name-lookup
 *
 * Reads Neon. Every property has a control that stays false (CLAUDE.md §23). The known MP is chosen FROM THE DATA (an identified
 * person with a parl_member_id and an alias), not hard-coded, so the check cannot pass on a name that happens to be absent (§26).
 */
import { getNeonPool } from '../lib/pg-pool'
import { lookupName, normaliseName, normalisePersonName } from '../lib/graph/name-lookup'

let pass = 0, fail = 0, controlsFired = 0, controlsDead = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) } }
const control = (name: string, propertyHolds: boolean) => { if (!propertyHolds) controlsFired++; else { controlsDead++; console.log(`  ✗✗ CONTROL DEAD: ${name}`) } }

async function main() {
  const pool = getNeonPool()

  // 1. the copied normaliser reproduces what was STORED (the thing a lookup has to match)
  const { rows: sample } = await pool.query(`SELECT surface, surface_norm FROM graph_alias ORDER BY md5(id::text) LIMIT 2000`)
  const differs = sample.filter((r: any) => normaliseName(r.surface) !== r.surface_norm && normalisePersonName(r.surface) !== r.surface_norm)
  // ⚠ Found on the first run: a long multi-witness panel string is stored CUT in `surface` while `surface_norm` was computed from the full text.
  // Those rows differ only because the surface is truncated — the copy's output is a strict prefix of the stored norm. Counted and printed, not hidden.
  const isCutPrefix = (norm: string, mine: string) => mine.length > 0 && norm.length > mine.length && norm.startsWith(mine)
  const truncated = differs.filter((r: any) => isCutPrefix(r.surface_norm, normaliseName(r.surface)) || isCutPrefix(r.surface_norm, normalisePersonName(r.surface)))
  const mismatches = differs.filter((r: any) => !truncated.includes(r))
  console.log(`  parity sample ${sample.length}: ${sample.length - differs.length} exact, ${truncated.length} truncated-surface rows (stored surface cut, norm from full text), ${mismatches.length} real mismatches`)
  ok(`normaliser parity: the web copy reproduces every sampled alias row's stored surface_norm (truncated-surface rows aside)`, sample.length >= 1000 && mismatches.length === 0,
    `${mismatches.length} mismatches, e.g. ${JSON.stringify(mismatches.slice(0, 3)).slice(0, 600)}`)
  control('parity would hold for a normaliser that only lowercases', sample.every((r: any) => r.surface.toLowerCase() === r.surface_norm))

  // 2. a known MP, chosen from the data, resolves — written the way text writes it
  const { rows: mp } = await pool.query(`
    SELECT i.entity_id::text AS id, i.canonical_name, i.parl_member_id FROM graph_entity_identity i
     WHERE i.kind = 'person' AND i.identity_tier = 'identified' AND i.parl_member_id IS NOT NULL AND i.n_surfaces >= 1
     ORDER BY md5(i.entity_id::text) LIMIT 1`)
  ok('premise: an identified MP exists to test with', mp.length === 1)
  if (mp.length) {
    const written = `${mp[0].canonical_name} MP`
    const r = await lookupName(written)
    const hit = r.candidates.find((c) => c.entityId === mp[0].id)
    ok(`a known MP resolves: "${written}" → entity ${mp[0].id}`, !!hit, JSON.stringify(r).slice(0, 300))
    ok('…with its tier and member id carried', hit?.identityTier === 'identified' && hit?.parlMemberId === mp[0].parl_member_id)
    ok('…and an identified candidate is listed before any lower tier', r.candidates.findIndex((c) => c.identityTier !== 'identified') === -1 || r.candidates.findIndex((c) => c.identityTier === 'identified') < r.candidates.findIndex((c) => c.identityTier !== 'identified'))
    control('the MP resolves when looked up as an organisation only', !!(await lookupName(written, { kind: 'organisation' })).candidates.find((c) => c.entityId === mp[0].id))
  }

  // 3. a made-up name does not
  const fake = await lookupName('Zebediah Quarrington-Flubbwhistle')
  ok('a made-up name returns no candidates, status "none"', fake.status === 'none' && fake.candidates.length === 0)
  control('the made-up name resolves', fake.candidates.length > 0)

  // 4. an ambiguous surface returns EVERY candidate (chosen from the data: a surface_norm shared by 2+ entities)
  const { rows: amb } = await pool.query(`SELECT surface_norm, COUNT(DISTINCT entity_id)::int n FROM graph_alias GROUP BY surface_norm HAVING COUNT(DISTINCT entity_id) BETWEEN 2 AND 20 ORDER BY md5(surface_norm) LIMIT 1`)
  ok('premise: an ambiguous surface exists', amb.length === 1)
  if (amb.length) {
    const r = await lookupName(amb[0].surface_norm, { limit: 100 })
    const exact = r.keys.includes(amb[0].surface_norm)
    ok(`an ambiguous name ("${amb[0].surface_norm}", ${amb[0].n} entities) returns all of them, status "many"`, !exact || (r.status === 'many' && r.candidates.length >= amb[0].n), `${r.candidates.length} returned`)
  }

  ok('empty input: status none, no query', (await lookupName('  ')).status === 'none')
  console.log(`\ncheck:graph-name-lookup — ${pass} passed, ${fail} failed · controls: ${controlsFired} fired, ${controlsDead} dead`)
  await pool.end().catch(() => {})
  process.exit(fail || controlsDead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
