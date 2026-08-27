/**
 * sweep-remaining.ts — PART B, THE BACKSTOP. Every collection gets a census row, including the
 * ones nobody can walk.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A COLLECTION WITH NO WALK STILL NEEDS A ROW
 *
 * The daily email reads `corpus_census`. A collection with no census row would fall out of the
 * email entirely — which is a worse failure than the tautology, because a number nobody prints
 * cannot be argued with. So every live collection ends this sprint with a row, and the ones that
 * could not be measured say `UNMEASURED` in the state column and print NO PERCENTAGE.
 *
 * ⚠ UNMEASURED IS NOT A FAILURE STATE, IT IS AN HONEST ONE. The point of the sprint is that
 * "we hold 78,310 documents, and we do not know what fraction of the universe that is" is a true
 * sentence, and `[100% complete]` was not.
 *
 * Where `docs/CORPUS_SCOPE.md` carries a declared scope for the collection, its sentence is copied
 * into `notes` — so a DELIBERATE boundary ("Scottish employment tribunal decisions before 2013 are
 * not published and are not held") can be told apart from an accidental gap. A declared scope is
 * OUR claim, not the publisher's, so it does not promote a row to MEASURED and it never produces a
 * percentage on its own.
 *
 * Usage: tsx census/b/sweep-remaining.ts
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../../c2/db'
import { writeCensus, heldUnits, DEFAULT_UNIT_EXPR, type CensusRow, type CensusState } from './harness'

/** Pull the declared-scope sentence for each collection out of CORPUS_SCOPE.md's table. */
function loadDeclaredScopes(): Map<string, string> {
  const out = new Map<string, string>()
  const p = path.join(__dirname, '../../../../docs/CORPUS_SCOPE.md')
  if (!fs.existsSync(p)) return out
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|(.*)\|\s*$/.exec(line.trim())
    if (!m) continue
    const cells = m[2].split('|').map(c => c.trim())
    const scope = cells[cells.length - 1]
    if (scope && scope.length > 10) out.set(m[1], scope)
  }
  return out
}

async function main() {
  const p = pool()
  const scopes = loadDeclaredScopes()

  const already = new Set((await p.query(`SELECT corpus_key FROM corpus_census`)).rows.map((r: any) => r.corpus_key))
  const targets = (await p.query(
    `SELECT t.corpus_key, t.display_label, coalesce(t.retired,false) retired, coalesce(t.blocked,false) blocked,
            t.blocked_reason, t.est_sections, t.est_is_confirmed, coalesce(c.n,0)::int sections
       FROM corpus_targets t
       LEFT JOIN (SELECT corpus, count(*)::int n FROM corpus_sections WHERE status='compiled' GROUP BY corpus) c
         ON c.corpus = t.corpus_key
      ORDER BY 8 DESC`)).rows

  // Collections holding rows that have no corpus_targets row at all would otherwise be invisible.
  const orphans = (await p.query(
    `SELECT corpus corpus_key, count(*)::int sections FROM corpus_sections WHERE status='compiled'
        AND corpus NOT IN (SELECT corpus_key FROM corpus_targets) GROUP BY 1`)).rows
    .map((r: any) => ({ ...r, display_label: r.corpus_key, retired: false, blocked: false,
      blocked_reason: null, est_sections: null, est_is_confirmed: false }))

  const rows: CensusRow[] = []
  let skipped = 0
  for (const t of [...targets, ...orphans]) {
    if (already.has(t.corpus_key)) { skipped++; continue }

    const held = await heldUnits(p, [t.corpus_key], DEFAULT_UNIT_EXPR)
    let state: CensusState
    if (t.retired && t.sections === 0) state = 'RETIRED'
    else if (t.blocked) state = 'BLOCKED'
    else if (t.sections === 0) state = 'NOT_STARTED'
    else state = 'UNMEASURED'

    // ⚠ The old target is recorded as prose, never as a denominator. `est_sections` counts
    // SECTIONS and the census counts UNITS, and for 41 live collections it was a copy of the row
    // count anyway. Writing it into published_units would import the tautology into the new table.
    const selfRef = t.est_sections != null && t.est_sections === t.sections
    const notes = [
      scopes.get(t.corpus_key) ? `DECLARED SCOPE (ours, not the publisher's): ${scopes.get(t.corpus_key)}` : null,
      t.est_sections != null
        ? `Former corpus_targets.est_sections was ${Number(t.est_sections).toLocaleString()} sections` +
          (selfRef ? ' — EXACTLY the compiled row count, i.e. self-referential, which is why it is not used here.'
                   : `${t.est_is_confirmed ? ', flagged confirmed' : ''}, provenance unproven.`)
        : null,
      t.blocked && t.blocked_reason ? `blocked: ${String(t.blocked_reason).trim()}` : null,
      state === 'UNMEASURED' ? 'No publisher index has been found for this collection. Held count is real; the fraction it represents is unknown.' : null,
    ].filter(Boolean).join(' ') || null

    rows.push({
      corpus_key: t.corpus_key,
      state,
      unit: 'document',
      method: state === 'UNMEASURED' ? 'no publisher index identified — not walked'
            : state === 'NOT_STARTED' ? 'nothing ingested yet'
            : state === 'BLOCKED' ? 'collection blocked; not walked'
            : 'collection retired; rows removed',
      walked_at: null,
      published_units: null,
      held_units: held,
      hollow_units: 0,
      absent_ids: [],
      absent_total: 0,
      walk_artifact_path: null,
      notes,
    })
  }

  console.log(`${skipped} collection(s) already carry a walked census row — left alone.`)
  await writeCensus(p, rows, 'sweep')

  const summary = (await p.query(
    `SELECT state, count(*)::int n, sum(coalesce(held_units,0))::bigint held FROM corpus_census GROUP BY 1 ORDER BY 2 DESC`)).rows
  console.log('\n── the census as it now stands ──')
  for (const s of summary) console.log(`  ${String(s.state).padEnd(12)} ${String(s.n).padStart(3)} collections   ${Number(s.held).toLocaleString().padStart(12)} units held`)
  await p.end()
}

main().catch(e => { console.error('FAIL', e.message, e.stack); process.exit(1) })
