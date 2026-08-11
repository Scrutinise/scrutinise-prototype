/**
 * v33-check-vec-hygiene-guard.ts — negative control for `vec-hygiene.ts`'s safety-export guard.
 *
 * WHY THIS EXISTS. The guard it tests replaced `fs.existsSync('export.json')`, which passed on any
 * marker from any previous run. On 10 Aug 2026 a 6 Aug marker (stamp 2026-08-06T05-22-55-495Z,
 * 6,464 rows) sat on disk while a 89,377-row export was still four parts from finishing; the old
 * guard would have authorised the delete. **A guard nobody has watched fail is not known to work**,
 * so this plants each failure mode in turn and asserts the refusal.
 *
 * SAFE TO RUN. It only ever swaps the marker file, and it restores the real one in a `finally`
 * even if an assertion throws. It never calls the delete path — it calls `assertSafetyExport`'s
 * conditions through the real module by shelling out to `delete-orphans --apply` ONLY in the
 * negative cases, where the guard must throw before any Lance table is opened.
 *
 * Usage: tsx v33-check-vec-hygiene-guard.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { execFileSync } from 'child_process'

export {}

const STATE_DIR = path.join(__dirname, 'search/.vec-hygiene')
const MARKER = path.join(STATE_DIR, 'export.json')
const MANIFEST = path.join(STATE_DIR, 'manifest.json')
const TSX = path.join(__dirname, 'node_modules/.bin/tsx.cmd')

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

/**
 * Run delete-orphans --apply and return its combined output. The guard must reject BEFORE any
 * table is touched, so a refusal is proven by the error text, not by counting rows.
 *
 * ⚠ `shell: true` is load-bearing on Windows. `tsx` here is a `.cmd` shim, which `execFileSync`
 * cannot execute directly — without a shell every call throws ENOENT, the catch returns an empty
 * output, and all five cases score as "did not refuse". The first run of this file reported
 * **0/5 refusals against a guard that was in fact refusing correctly** — a false negative in the
 * test, which is the failure mode a negative control is least able to notice about itself.
 */
function runDelete(): { code: number; out: string } {
  try {
    const out = execFileSync(`"${TSX}" search/vec-hygiene.ts delete-orphans --apply`, {
      cwd: __dirname, encoding: 'utf8', stdio: 'pipe', timeout: 120_000, shell: true,
    })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

/**
 * THE POSITIVE CASE IS NOT TESTED HERE, deliberately. A suite of refusals would pass just as
 * happily against a guard that rejects everything, so the accept path does need proving — but
 * proving it in-process means letting the delete actually run, and with the real marker in place
 * that is a 25-minute pass over 89,377 ids. It is instead evidenced by the live run this guard
 * was written for, which recorded:
 *
 *   [vec-hygiene] safety export verified: stamp 2026-08-09T13-04-26-205Z, 89,377 rows,
 *                 10/10 objects present in R2
 *
 * If this file is ever run against a fixture-sized manifest, add the accept case back.
 */

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const realStamp = String(manifest.auditedAt).replace(/[:.]/g, '-')
  const realRows = manifest.orphans.length
  const backup = fs.existsSync(MARKER) ? fs.readFileSync(MARKER, 'utf8') : null
  console.log(`negative control against audit ${manifest.auditedAt} (${realRows.toLocaleString()} orphans)\n`)

  try {
    // 1. a marker from a DIFFERENT audit — the exact 10 Aug near-miss
    fs.writeFileSync(MARKER, JSON.stringify({ stamp: '2026-08-06T05-22-55-495Z', rows: 6464, keys: ['_search/vec-hygiene-backup/2026-08-06T05-22-55-495Z/orphan-chunks.part-0001.jsonl'] }))
    let r = runDelete()
    ok('refuses a marker from a DIFFERENT audit', r.code !== 0 && /DIFFERENT audit/.test(r.out), r.out.slice(0, 200))

    // 2. right audit, short row count — an export that was interrupted
    fs.writeFileSync(MARKER, JSON.stringify({ stamp: realStamp, rows: realRows - 1, keys: ['x'] }))
    r = runDelete()
    ok('refuses an INCOMPLETE export (row count short)', r.code !== 0 && /INCOMPLETE/.test(r.out), r.out.slice(0, 200))

    // 3. right audit and row count, but the objects are not in R2
    fs.writeFileSync(MARKER, JSON.stringify({ stamp: realStamp, rows: realRows, keys: [`_search/vec-hygiene-backup/${realStamp}/does-not-exist.jsonl`] }))
    r = runDelete()
    ok('refuses when a named object is MISSING from R2', r.code !== 0 && /NOT in R2/.test(r.out), r.out.slice(0, 200))

    // 4. no marker at all
    fs.rmSync(MARKER, { force: true })
    r = runDelete()
    ok('refuses when there is no export at all', r.code !== 0 && /no safety export/.test(r.out), r.out.slice(0, 200))

    // 5. unreadable marker
    fs.writeFileSync(MARKER, '{ not json')
    r = runDelete()
    ok('refuses an unreadable marker', r.code !== 0 && /unreadable/.test(r.out), r.out.slice(0, 200))
  } finally {
    // The real marker goes back whatever happened above.
    if (backup !== null) fs.writeFileSync(MARKER, backup)
    else fs.rmSync(MARKER, { force: true })
    console.log(`\n  marker restored (${backup !== null ? 'original contents' : 'removed — there was none'})`)
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} refusals observed`)
  if (fail) process.exitCode = 1
}
main()
