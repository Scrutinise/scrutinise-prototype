/**
 * match-registers.ts — BRIEF_GRAPH_2D3 §2: Companies House and the Charity Commission.
 *
 * "The largest single improvement available to the organisation half, and organisations are the
 * half that matters most" (Amendment 2 §6). Both registers give a STABLE KEY where the graph
 * currently holds only a name.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * NO API KEY, AND THAT IS NOT A COMPROMISE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Companies House's REST API and the Charity Commission's API both need a key nobody has issued
 * here. Both bodies ALSO publish the whole register as a bulk download, open and keyless:
 *
 *   · Companies House "Free Company Data Product" — BasicCompanyDataAsOneFile-YYYY-MM-01.zip,
 *     493 MB zipped, ~5.9M companies, one CSV. Crown copyright, Open Government Licence v3.0.
 *   · Charity Commission register extract — publicextract.charity.zip, 44 MB, tab-separated,
 *     one row per registered charity. Crown copyright, Open Government Licence v3.0.
 *
 * The bulk files are BETTER than the API for this job: matching 40,518 organisation names against a
 * register is a hash join, and a join wants the whole table, not 40,518 round trips.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MATCH RULE, AND WHY IT REFUSES SO MUCH
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 2D-1's rule, unchanged and now more important because positions hang off these entities: **when
 * in doubt, do not merge.** A wrongly matched body holds contradictory positions and looks more
 * influential than either of the real ones (Amendment 2 §1).
 *
 * So the only method here is EXACT match on the conservative normal form `normaliseName()` already
 * uses — the same function that built `graph_entity.name_norm`, deliberately, because a second
 * normaliser would silently fail to match and look like poor register coverage.
 *
 *   · No fuzzy matching, no edit distance, no acronym expansion, no legal-suffix stripping.
 *     "Smith Ltd" and "Smith plc" stay different companies.
 *   · A match is `unambiguous` ONLY when this entity matched exactly one register row AND that
 *     register row matched exactly one entity. Everything else is recorded and reported, never
 *     silently resolved.
 *   · Only an unambiguous match is PROMOTED onto graph_entity.companies_house_no / charity_no.
 *
 * ⚠ MERGES AND SPLITS ARE REPORTED SEPARATELY, as the brief requires. A SPLIT is one of our
 * entities matching several register rows (our name is ambiguous). A MERGE is several of our
 * entities matching one register row (we were holding one body under several names). They are
 * different problems with different causes and averaging them hides both.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/match-registers.ts --self-test
 *   npx tsx position-graph/match-registers.ts --dir <path> [--predict]
 *   npx tsx position-graph/match-registers.ts --dir <path> --apply      # writes matches
 *   npx tsx position-graph/match-registers.ts --dir <path> --apply --promote
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { normaliseName } from './graph-common'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const str = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }

const DIR = str('dir', 'C:/Users/charl/AppData/Local/Temp/claude/C--Code-scrutinise-prototype/registers')
const RUN_ID = process.env.GRAPH_2D3_RUN_ID ?? 'registers-2d3'
const APPLY = flag('apply')
const PROMOTE = flag('promote')

/**
 * A name too generic to key an identity on, however exact the match.
 *
 * ⚠ This exists because an exact match is not the same as a correct one. "The Health Foundation"
 * is one body; "Community Care" is a phrase that is also a registered charity, and matching an
 * entity called "Community Care" to it would attach a charity number to whatever our name cluster
 * happens to contain. These are refused and COUNTED, so the refusal is visible rather than
 * appearing as a register gap.
 */
export function tooGenericToKey(nameNorm: string): boolean {
  const words = nameNorm.split(' ').filter(Boolean)
  if (words.length < 2) return true
  return /^(community care|health|healthwatch|the charity|care|mind|scope|shelter|change|action|together|connect|advocacy|carers|volunteer centre)$/.test(nameNorm)
}

// ── register readers ────────────────────────────────────────────────────────────────────────────

interface RegRow { id: string; name: string; status: string | null }

/**
 * ⚠ THE ZIPS ARE UNPACKED FIRST, AND THAT IS NOT LAZINESS.
 *
 * The first version streamed each entry straight out of the archive with yauzl. It read the header
 * and the first rows correctly and then **the process exited, silently, with status 0, part-way
 * through the scan** — no error, no stack, no partial report. That signature is an empty event
 * loop: a zip entry stream that stalls has no pending libuv handle keeping Node alive, so the
 * runtime concludes there is nothing left to do and leaves. It looks exactly like a clean finish.
 *
 * A plain `fs.createReadStream` over an unpacked file cannot fail that way. The cost is 3 GB of
 * scratch disk, which is free; the benefit is that "the scan finished" and "the scan vanished"
 * stop looking identical from outside. Same family as §18: a degradation must announce itself.
 */
async function* readLines(file: string): AsyncGenerator<string> {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) yield line
}

/** Companies House one-file CSV: CompanyName, CompanyNumber, …, CompanyStatus. */
async function* readCompaniesHouse(file: string): AsyncGenerator<RegRow> {
  let header: string[] | null = null
  let iName = 0
  let iNum = 1
  let iStatus = -1
  for await (const line of readLines(file)) {
    if (!header) {
      header = splitCsv(line).map((h) => h.trim())
      iName = Math.max(0, header.indexOf('CompanyName'))
      iNum = Math.max(1, header.indexOf('CompanyNumber'))
      iStatus = header.indexOf('CompanyStatus')
      continue
    }
    const f = splitCsv(line)
    if (f.length < 3) continue
    const name = f[iName]
    const id = f[iNum]
    if (name && id) yield { id: id.trim(), name: name.trim(), status: iStatus >= 0 ? (f[iStatus] ?? '').trim() : null }
  }
}

/** Charity Commission extract: tab-separated, one row per registered charity. */
async function* readCharityCommission(file: string): AsyncGenerator<RegRow> {
  let header: string[] | null = null
  let iName = -1
  let iNum = -1
  let iStatus = -1
  for await (const line of readLines(file)) {
    const f = line.split('	')
    if (!header) {
      header = f.map((h) => h.trim().toLowerCase())
      iName = header.indexOf('charity_name')
      iNum = header.indexOf('registered_charity_number')
      iStatus = header.indexOf('charity_registration_status')
      continue
    }
    const name = f[iName]
    const id = f[iNum]
    if (name && id) yield { id: id.trim(), name: name.trim(), status: iStatus >= 0 ? (f[iStatus] ?? '').trim() : null }
  }
}

/** A CSV splitter that honours quoted fields containing commas. */
export function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// ────────────────────────────────────────────────────────────────────────────────────────────────

interface Surface { entityId: string; surface: string; isCanonical: boolean }

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    // Every organisation surface we hold: the canonical name AND every alias 2D-1 preserved.
    const { rows: canon } = await pool.query<{ id: string; canonical_name: string; name_norm: string }>(
      `SELECT id::text, canonical_name, name_norm FROM graph_entity WHERE kind='organisation'`)
    const { rows: aliases } = await pool.query<{ entity_id: string; surface: string }>(
      `SELECT DISTINCT a.entity_id::text, a.surface FROM graph_alias a
        JOIN graph_entity e ON e.id = a.entity_id AND e.kind='organisation'`)
    console.log(`\n════ §2 REGISTERS — ${canon.length.toLocaleString('en-GB')} organisation entities, ${aliases.length.toLocaleString('en-GB')} surfaces ════`)

    // norm → the surfaces that produce it. One norm can belong to several entities only if the
    // aliases collide; the canonical unique index makes that rare but not impossible.
    const byNorm = new Map<string, Surface[]>()
    const push = (norm: string, s: Surface) => {
      if (!norm || tooGenericToKey(norm)) return
      const arr = byNorm.get(norm)
      if (arr) { if (!arr.some((x) => x.entityId === s.entityId)) arr.push(s) } else byNorm.set(norm, [s])
    }
    for (const c of canon) push(c.name_norm, { entityId: c.id, surface: c.canonical_name, isCanonical: true })
    for (const a of aliases) push(normaliseName(a.surface), { entityId: a.entity_id, surface: a.surface, isCanonical: false })
    const refusedGeneric = new Set([...canon.map((c) => c.name_norm), ...aliases.map((a) => normaliseName(a.surface))])
      .size - byNorm.size
    console.log(`  distinct match keys              ${byNorm.size.toLocaleString('en-GB')}`)
    console.log(`  keys refused as too generic      ${refusedGeneric.toLocaleString('en-GB')}  (a single word, or a phrase that is also a body)`)

    const files: Array<{ register: 'companies-house' | 'charity-commission'; file: string; read: (p: string) => AsyncGenerator<RegRow> }> = [
      { register: 'charity-commission', file: path.join(DIR, 'publicextract.charity.txt'), read: readCharityCommission },
      { register: 'companies-house', file: path.join(DIR, 'BasicCompanyDataAsOneFile-2026-08-01.csv'), read: readCompaniesHouse },
    ]

    for (const f of files) {
      if (!fs.existsSync(f.file)) { console.log(`\n  ⚠ ${f.register}: ${f.file} not present — skipped`); continue }
      // A 2.8 GB scan with no output for four minutes is indistinguishable from a hang, and one of
      // this sprint's own false alarms was exactly that. Say what is happening before it happens.
      console.log(`\n  scanning ${f.register} — ${path.basename(f.file)} (${(fs.statSync(f.file).size / 1024 ** 2).toFixed(0)} MB)…`)
      const t0 = Date.now()
      // norm → register rows that carry that name. A register name can repeat (two charities with
      // the same name really do exist), and that is a SPLIT on our side.
      const hits = new Map<string, RegRow[]>()
      let scanned = 0
      for await (const row of f.read(f.file)) {
        scanned++
        if (scanned % 1_000_000 === 0) console.log(`      … ${scanned.toLocaleString('en-GB')} rows, ${hits.size} name keys hit so far`)
        const norm = normaliseName(row.name)
        const surfaces = byNorm.get(norm)
        if (!surfaces) continue
        const arr = hits.get(norm)
        if (arr) { if (!arr.some((x) => x.id === row.id)) arr.push(row) } else hits.set(norm, [row])
      }
      console.log(`\n  ── ${f.register} — ${scanned.toLocaleString('en-GB')} register rows scanned in ${Math.round((Date.now() - t0) / 1000)}s ──`)

      // Ambiguity in BOTH directions, counted separately.
      const entityHitCount = new Map<string, Set<string>>()   // entity → register ids
      const regHitCount = new Map<string, Set<string>>()      // register id → entities
      for (const [norm, rows] of hits) {
        for (const s of byNorm.get(norm)!) {
          for (const r of rows) {
            ;(entityHitCount.get(s.entityId) ?? entityHitCount.set(s.entityId, new Set()).get(s.entityId)!).add(r.id)
            ;(regHitCount.get(r.id) ?? regHitCount.set(r.id, new Set()).get(r.id)!).add(s.entityId)
          }
        }
      }
      const splits = [...entityHitCount.values()].filter((v) => v.size > 1).length
      const merges = [...regHitCount.values()].filter((v) => v.size > 1).length
      const matchedEntities = entityHitCount.size
      const unambiguous = [...entityHitCount.entries()].filter(([e, ids]) => ids.size === 1 && regHitCount.get([...ids][0])!.size === 1).length

      console.log(`    entities matching at least one row   ${matchedEntities.toLocaleString('en-GB')}  (${(100 * matchedEntities / canon.length).toFixed(1)}% of ${canon.length.toLocaleString('en-GB')} organisations)`)
      console.log(`    UNAMBIGUOUS both ways                ${unambiguous.toLocaleString('en-GB')}  (${(100 * unambiguous / canon.length).toFixed(1)}%)  ← the only ones promoted`)
      console.log(`    ⚠ SPLITS  — our entity → >1 register row   ${splits.toLocaleString('en-GB')}   (our name is ambiguous)`)
      console.log(`    ⚠ MERGES  — >1 of our entities → one row   ${merges.toLocaleString('en-GB')}   (we hold one body under several names)`)

      if (!APPLY) { console.log(`    (dry run — nothing written)`); continue }

      let written = 0
      for (const [norm, rows] of hits) {
        for (const s of byNorm.get(norm)!) {
          for (const r of rows) {
            const un = entityHitCount.get(s.entityId)!.size === 1 && regHitCount.get(r.id)!.size === 1
            await pool.query(
              `INSERT INTO graph_org_register (entity_id, register, register_id, register_name, match_method,
                 matched_surface, status, unambiguous, run_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
               ON CONFLICT (entity_id, register, register_id) DO UPDATE
                 SET unambiguous = EXCLUDED.unambiguous, status = EXCLUDED.status`,
              [s.entityId, f.register, r.id, r.name, s.isCanonical ? 'exact-name-norm' : 'exact-name-norm-alias',
                s.surface, r.status, un, RUN_ID])
            written++
          }
        }
      }
      console.log(`    ${written.toLocaleString('en-GB')} candidate matches written`)

      if (PROMOTE) {
        const col = f.register === 'companies-house' ? 'companies_house_no' : 'charity_no'
        const { rowCount } = await pool.query(
          `UPDATE graph_entity e SET ${col} = r.register_id
             FROM graph_org_register r
            WHERE r.entity_id = e.id AND r.register = $1 AND r.unambiguous
              AND e.${col} IS NULL`, [f.register])
        await pool.query(`UPDATE graph_org_register SET promoted = TRUE WHERE register=$1 AND unambiguous`, [f.register])
        console.log(`    ${rowCount} entities promoted to a stable ${f.register} key`)
      }
    }
  } finally { await endNeonPool() }
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['csv splitter honours a quoted comma',
      splitCsv('"SMITH, JONES AND CO LTD",01234567,Active')[0] === 'SMITH, JONES AND CO LTD'],
    ['csv splitter honours a doubled quote',
      splitCsv('"THE ""BIG"" CHARITY",99')[0] === 'THE "BIG" CHARITY'],
    ['csv splitter keeps empty trailing fields', splitCsv('a,b,,').length === 4],
    ['a one-word name cannot key an identity', tooGenericToKey('shelter')],
    ['a generic two-word phrase is refused', tooGenericToKey('community care')],
    ['a real body is not refused', !tooGenericToKey('royal college of nursing')],
    // ⚠ the register match uses the SAME normaliser that built graph_entity.name_norm — a second
    // one would silently fail to match and read as poor register coverage.
    ['register and graph share one normaliser',
      normaliseName('The Royal College of Nursing') === normaliseName('ROYAL COLLEGE OF NURSING')],
    ['legal suffixes are NOT stripped by that normaliser',
      normaliseName('Smith Ltd') !== normaliseName('Smith plc')],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

// ⚠ GUARDED. verify-2d3.ts imports classifySurface/holderOn from here; without this an
// import RAN THE SCRIPT, which ended the shared pool underneath the caller ('Called end on pool
// more than once'). A module that does work on import is a module that cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[match-registers] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
