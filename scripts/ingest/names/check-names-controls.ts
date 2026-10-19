/**
 * check-names-controls.ts — PROVE EACH LIVE GUARD CAN FAIL, WITHOUT WRITING TO ANYTHING.
 * Replaces `check-names-negative.ts` (retired 2026-10-19, BRIEF_GRAPH_6 — see docs/CHANGE_LOG.md).
 *
 * WHAT THE OLD CHECK DID, AND WHY IT WENT. `check-names-negative.ts` proved that a guard "can fail" by
 * UPDATE-ing a real row of the 15-million-row production table into the defective state, reading the
 * guard, and rolling back. It was always rolled back — and it still took row locks on a hot table the
 * ingest fleet writes to, and one process death between the UPDATE and the ROLLBACK is a corrupted
 * production row. A check that has to damage production to show it would notice damage is paying more
 * than the thing it proves is worth.
 *
 * WHAT THIS DOES INSTEAD. The same guard SQL — copied verbatim from `check-names.ts`'s live half — is run
 * against a `WITH corpus_sections AS (VALUES …)` fixture. A CTE named like the table SHADOWS the table
 * for that one statement, so the guard's own text is exercised over rows this script made up: one
 * healthy row (the guard must stay at 0) and one carrying exactly the defect (it must reach 1). The
 * session is `BEGIN READ ONLY`, so a write is not merely absent but impossible: Postgres refuses it.
 *
 * ⚠ AND IT KEEPS THE ONE THING THE BRIEF ASKED FOR THAT A FIXTURE CANNOT GIVE: a lookup against the REAL
 * table for a name that genuinely cannot resolve, asserted to come back as "no match" — and asserted to be
 * a DIFFERENT outcome from a lookup that FAILED. `lookup()` returns one of three tagged results, so a
 * caller can never read an error as an empty answer or an empty answer as an error.
 *
 * ⚠ IF A WRITE-PATH TEST IS EVER GENUINELY REQUIRED, IT RUNS AGAINST A COPY, NEVER PRODUCTION.
 *
 * Every case reports the rows it EXAMINED and the assertions it MADE; a case that examined none fails.
 *
 *   npx tsx scripts/ingest/names/check-names-controls.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { namesPool, endNamesPool } from './names-pool'

type Row = {
  id: string; corpus: string; sectionTitle: string | null; notes: string | null
  attribution: string | null; speaker: string | null; parentDocId: string | null
}
const row = (r: Partial<Row> & Pick<Row, 'id' | 'corpus'>): Row =>
  ({ sectionTitle: null, notes: null, attribution: null, speaker: null, parentDocId: null, ...r })

/** `WITH corpus_sections AS (...)` over the given rows. Shadows the real table for ONE statement. */
function fixture(rows: Row[]): string {
  const lit = (v: string | null) => (v === null ? 'NULL::text' : `'${v.replace(/'/g, "''")}'::text`)
  const tuples = rows.map((r) => `(${[r.id, r.corpus, r.sectionTitle, r.notes, r.attribution, r.speaker, r.parentDocId].map(lit).join(', ')})`)
  return `WITH corpus_sections AS (SELECT * FROM (VALUES ${tuples.join(', ')}) AS t(id, corpus, "sectionTitle", notes, attribution, speaker, "parentDocId")) `
}

interface Probe {
  name: string
  /** The guard — verbatim from check-names.ts. Counts rows that are WRONG; 0 when healthy. */
  guard: string
  healthy: Row
  /** A row carrying exactly the defect this guard exists to catch. */
  defective: Row
}

const PROBES: Probe[] = [
  {
    name: 'a case-law row titled with its own citation',
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL
               AND btrim("sectionTitle") = btrim(split_part(id, ':', 2))`,
    healthy: row({ id: 'tna-caselaw:[2015] EWHC 1 (Fam)', corpus: 'tna-caselaw', sectionTitle: 'Mensah v Jones' }),
    defective: row({ id: 'tna-caselaw:[2015] EWHC 2 (Fam)', corpus: 'tna-caselaw', sectionTitle: '[2015] EWHC 2 (Fam)' }),
  },
  {
    name: 'a titled case-law row with no route recorded',
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL
               AND (notes IS NULL OR notes NOT LIKE 'title-route:%')`,
    healthy: row({ id: 'tna-caselaw:[2015] EWHC 3 (Fam)', corpus: 'tna-caselaw', sectionTitle: 'A v B', notes: 'title-route:source' }),
    defective: row({ id: 'tna-caselaw:[2015] EWHC 4 (Fam)', corpus: 'tna-caselaw', sectionTitle: 'A v B', notes: null }),
  },
  {
    name: 'a GOVERNMENT RESPONSE wearing the committee’s name',
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='committees-reports' AND attribution IS NOT NULL
               AND notes IS NOT NULL AND notes LIKE '{%'
               AND (notes::json->>'publicationType') = 'Government Response'`,
    // ⚠ The healthy row is a committee REPORT correctly attributed: the guard must not fire on it, or it
    // would fire on every honest row and tell us nothing.
    healthy: row({ id: 'cr:1', corpus: 'committees-reports', attribution: 'Transport Committee', notes: '{"publicationType":"Report","committeeName":"Transport Committee"}' }),
    defective: row({ id: 'cr:2', corpus: 'committees-reports', attribution: 'Transport Committee', notes: '{"publicationType":"Government Response","committeeName":"Transport Committee"}' }),
  },
  {
    name: 'an oral-evidence transcript attributed to a single speaker',
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='committees-evidence' AND "parentDocId" LIKE 'oralevidence:%' AND speaker IS NOT NULL`,
    healthy: row({ id: 'ce:1', corpus: 'committees-evidence', parentDocId: 'oralevidence:1', speaker: null }),
    defective: row({ id: 'ce:2', corpus: 'committees-evidence', parentDocId: 'oralevidence:2', speaker: 'Some Witness' }),
  },
  {
    name: 'a miss stored as a blank string instead of NULL',
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus IN ('committees-evidence','committees-reports','tna-caselaw')
               AND (btrim(COALESCE(attribution,'x')) = ''
                 OR btrim(COALESCE(speaker,'x')) = ''
                 OR btrim(COALESCE("sectionTitle",'x')) = '')`,
    healthy: row({ id: 'ce:3', corpus: 'committees-evidence', attribution: null }),
    defective: row({ id: 'ce:4', corpus: 'committees-evidence', attribution: '   ' }),
  },
]

// ── a lookup that cannot be read two ways ───────────────────────────────────────────────────────
/**
 * ⚠ THREE OUTCOMES, TAGGED. `no-match` (the lookup RAN and found nothing) and `failed` (it did not run)
 * are different facts and must never share a representation — a caller that treats a thrown error as an
 * empty result reports "no such name" about a database that merely timed out.
 */
type Lookup = { kind: 'match'; rows: number } | { kind: 'no-match' } | { kind: 'failed'; error: string }

async function lookup(c: { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }, q: string, p: unknown[] = []): Promise<Lookup> {
  // ⚠ A SAVEPOINT PER LOOKUP. In Postgres a failed statement aborts the whole transaction, so without
  // one the deliberately-malformed lookup below poisoned every statement after it — which `lookup`
  // then (correctly) reported as `failed`. Found on this script's first run.
  await c.query('SAVEPOINT lookup_sp')
  try {
    const r = await c.query(q, p)
    await c.query('RELEASE SAVEPOINT lookup_sp')
    return r.rows.length ? { kind: 'match', rows: r.rows.length } : { kind: 'no-match' }
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT lookup_sp')
    return { kind: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

;(async () => {
  const pool = namesPool()
  const c = await pool.connect()
  let asserted = 0, fixtureRows = 0, liveRows = 0, failed = 0
  const check = (ok: boolean, label: string, detail = '') => {
    asserted++
    if (!ok) { failed++; console.log(`    ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
    return ok
  }
  try {
    // ⚠ READ ONLY BY CONSTRUCTION: a write in this transaction is refused by the server.
    await c.query('BEGIN READ ONLY')

    // ⚠ THE GUARD TEXT IS A COPY, AND A COPY THAT DRIFTS PROVES NOTHING ABOUT THE REAL GUARD. This is the one
    // assertion in the file that is rightly about SOURCE (CLAUDE.md §25: "this list is derived from that
    // constant rather than restated" is a source property): each guard here must appear, whitespace aside,
    // in `check-names.ts`'s live half. Without it the control could keep firing on a guard nobody runs.
    const live = readFileSync(join(__dirname, 'check-names.ts'), 'utf8').replace(/\s+/g, '')
    console.log('  guard text, against check-names.ts (the guards that actually run):')
    for (const p of PROBES) {
      const body = p.guard.slice(p.guard.indexOf('FROM corpus_sections')).replace(/\s+/g, '')
      const same = live.includes(body)
      console.log(`    ${same ? '✓ same' : '✗ DRIFTED'}  ${p.name}`)
      check(same, `${p.name}: guard text appears in check-names.ts`)
    }

    console.log('\n  guards: healthy fixture stays at 0, defective fixture trips (each over a CTE shadowing corpus_sections)')
    let fired = 0
    for (const p of PROBES) {
      const healthy = (await c.query(fixture([p.healthy]) + p.guard)).rows[0].n as number
      const both = (await c.query(fixture([p.healthy, p.defective]) + p.guard)).rows[0].n as number
      fixtureRows += 1 + 2
      const ok = check(healthy === 0, `${p.name}: healthy row`, `guard read ${healthy}, expected 0`)
        && check(both === 1, `${p.name}: healthy + defective rows`, `guard read ${both}, expected exactly 1 (the defective one)`)
      if (ok) fired++
      console.log(`  ${ok ? '✓ FIRED' : '✗ DID NOT FIRE'}  ${p.name}`)
      console.log(`             healthy fixture → ${healthy} · healthy+defective fixture → ${both}  (3 fixture rows examined)`)
    }

    console.log('\n  lookups against the REAL table (read-only, indexed on corpus):')
    const noName = 'zz-no-such-corpus-' + 'x'.repeat(8)
    const none = await lookup(c, `SELECT 1 FROM corpus_sections WHERE corpus = $1 LIMIT 1`, [noName])
    console.log(`    a name that cannot resolve → ${none.kind}`)
    check(none.kind === 'no-match', 'an unresolvable corpus name is "no match"', JSON.stringify(none))

    const broken = await lookup(c, `SELECT 1 FROM corpus_sections WHERE no_such_column = $1 LIMIT 1`, [noName])
    console.log(`    a malformed lookup           → ${broken.kind}${broken.kind === 'failed' ? ` (${broken.error.slice(0, 60)})` : ''}`)
    check(broken.kind === 'failed', 'a lookup that cannot run is "failed", not "no match"', JSON.stringify(broken))
    check(none.kind !== broken.kind, 'the two are different outcomes')

    const real = await lookup(c, `SELECT 1 FROM corpus_sections WHERE corpus = $1 LIMIT 1`, ['tna-caselaw'])
    liveRows += real.kind === 'match' ? real.rows : 0
    console.log(`    a corpus that exists         → ${real.kind}${real.kind === 'match' ? ` (${real.rows} row read back)` : ''}`)
    check(real.kind === 'match', 'a real corpus name is a match (so "no match" above is not a dead lookup)', JSON.stringify(real))

    // ⚠ And the READ-ONLY claim is itself asserted: a write must be refused. Against a fixture-free
    // statement that targets a table name which does not exist, so even a bug here could change nothing.
    const write = await lookup(c, `CREATE TEMP TABLE zz_names_controls_probe (x int)`)
    check(write.kind === 'failed' && /read-only/i.test(write.error), 'the session refuses a write', JSON.stringify(write))

    await c.query('ROLLBACK')
    console.log(`\ncheck:names-controls — guards fired ${fired}/${PROBES.length} · ${asserted} assertions over ${fixtureRows} fixture rows + ${liveRows} live rows read back (writes: 0, by construction)`)
    if (fired !== PROBES.length || failed) process.exitCode = 1
  } finally {
    c.release()
    await endNamesPool()
  }
})().catch((e) => { console.error(e); process.exit(1) })
