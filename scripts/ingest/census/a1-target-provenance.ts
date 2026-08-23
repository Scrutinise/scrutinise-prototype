/**
 * a1-target-provenance.ts — CENSUS C1 Part A1. WHERE DID EVERY DENOMINATOR COME FROM?
 *
 * READ-ONLY. Part A writes nothing to Neon.
 *
 * For every `corpus_targets` row: the target, the flag, the count, whether the two are the same
 * number, when it was last written, and — where the repository can establish it — WHICH SCRIPT
 * wrote it. Attribution is by explicit corpus list in the writing script, and where no script
 * names the corpus the row is marked `unattributed` rather than guessed.
 *
 * ⚠ THE SIXTH REBASELINE SCRIPT. `INGEST_LABELS_REPORT` named five. There is a sixth and it is the
 * most explicit of all — `v30-denominator-rebaseline.ts`, whose own header states the rule:
 * *"Corpus with an empty ingest_queue backlog … → est_sections = actual_compiled,
 * est_is_confirmed = true."* Its header also records WHY, and the why is the whole story: summed
 * `est_sections` had fallen BELOW the compiled total, which was flagged as an "honest-denominator
 * violation", and the remedy chosen for "the denominator is too small" was to set it to the
 * numerator. Nothing about that was hidden; it was written down and then read as coverage.
 *
 * Usage: tsx census/a1-target-provenance.ts
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const OUT = path.join(__dirname, '../../../docs/census/A1_target_provenance.md')

/**
 * Corpus → the script that last set its `est_sections`, where a script names it explicitly.
 * Taken from the literal corpus lists in each writing script, not inferred from dates.
 */
const ATTRIBUTED: Record<string, string> = {
  'tna-caselaw': 'v19-rebaseline-final.ts (est := compiled)',
  'lda-commonsoralquestions': 'v19-rebaseline-final.ts (est := compiled)',
  'si-pre-2010': 'v19-rebaseline-final.ts, then v19-fix-si-residue.ts (est := compiled)',
  'et-decisions': 'v20-rebaseline-drains.ts (est := compiled)',
  'uk-treaties': 'v20-rebaseline-drains.ts (est := compiled)',
  'primary-acts-2000plus': 'v19-align-p1.ts (est := compiled)',
  'si-2010plus': 'v19-align-p1.ts (est := compiled)',
  'building-regs': 'v20-cleanup-mislabeled-govuk.ts (literal 21)',
  'planning-policy': 'v20-cleanup-mislabeled-govuk.ts (literal 64)',
  'sentencing-council': 'v20-cleanup-mislabeled-govuk.ts (literal 253, "live universe re-measured")',
  'nilawcom': 'v20-cleanup-mislabeled-govuk.ts (literal 17, site SSL-dead)',
  'ico': 'v27-seed-ico.ts (est := leaves.length — a walk of ico.org.uk)',
  'erskine-may': 'v29-seed-parliament.ts (est := ids.length — a walk of the Erskine May contents)',
  'lgsco': 'v30-lgsco-fix.ts',
  'cma-cases': 'v30-seed-cma-cases.ts',
  'inquiry-evidence': 'v30-seed-inquiry-evidence.ts',
  'independent-reviews': 'v29-seed-independent-reviews.ts',
  'cps-guidance': 'v29-seed-cps.ts',
  'parliament-treaties': 'v31-seed-parliament-treaties.ts',
  'uk-treaties-fcdo': 'v31-seed-fcdo-treaties.ts',
  'senedd-cofnod': 'v25-seed-senedd-cofnod.ts',
  'college-of-policing': 'v25-seed-college-policing.ts',
  'hmrc-manuals': 'seed-hmrc-manuals-v18.ts',
  'historic-hansard': 'seed-historic-hansard-queue.ts',
  'lawcom': 'seed-lawcom-queue.ts',
  'nao-reports': 'seed-nao-queue.ts',
  'ni-judgments': 'seed-judiciaryni-queue.ts',
  'tax-tribunals': 'seed-tax-tribunals-queue.ts',
  'fca-handbook': 'update-fca-est.ts',
  'scottish-courts': 'v27 §2 seeder (literal ~13,070, self-described as a guess)',
}
for (const k of ['pwdata-debates', 'pwdata-lords', 'pwdata-wrans', 'pwdata-lordswrans', 'pwdata-wms', 'pwdata-lordswms', 'pwdata-westminster']) {
  ATTRIBUTED[k] = 'seed-pwdata-perspeech-v18.ts, then v19-rebaseline-pwdata.ts (est := compiled)'
}

/** Does the row's own note admit the target came from our own drain? */
const SELF_ADMITTED = /rebaselin|re-baselin|from the completed drain/i
/** Does the row's own note say the number is not a measurement, while the flag says confirmed? */
const NOT_A_MEASUREMENT = /unmeasured|rough|order-of-magnitude|estimate only|approx|placeholder/i

interface Row {
  corpus_key: string; est_sections: number | null; est_is_confirmed: boolean
  compiled: number; upd: string; retired: boolean; blocked: boolean; notes: string
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
  const { rows } = await pool.query<Row>(`
    SELECT t.corpus_key, t.est_sections, t.est_is_confirmed, COALESCE(c.compiled,0)::int compiled,
           t.updated_at::text upd, COALESCE(t.retired,false) retired, COALESCE(t.blocked,false) blocked,
           COALESCE(t.notes,'') notes
      FROM corpus_targets t
      LEFT JOIN (SELECT corpus, count(*) FILTER (WHERE status='compiled')::int compiled
                   FROM corpus_sections GROUP BY 1) c ON c.corpus = t.corpus_key
     ORDER BY t.corpus_key`)
  await pool.end()

  const eq = rows.filter(r => r.est_sections != null && r.est_sections === r.compiled)
  const eqConfirmed = eq.filter(r => r.est_is_confirmed)
  const atOrBelow = rows.filter(r => r.est_sections != null && r.est_sections <= r.compiled)
  const contradiction = rows.filter(r => r.est_is_confirmed && NOT_A_MEASUREMENT.test(r.notes))
  const selfAdmitted = rows.filter(r => SELF_ADMITTED.test(r.notes))

  const L: string[] = []
  L.push('# A1 — PROVENANCE OF EVERY DENOMINATOR')
  L.push('')
  L.push('*Generated by `scripts/ingest/census/a1-target-provenance.ts`. Read-only.*')
  L.push('')
  L.push(`Rows: **${rows.length}** (${rows.filter(r => !r.retired).length} live, ${rows.filter(r => r.retired).length} retired).`)
  L.push('')
  L.push('| finding | count |')
  L.push('|---|---:|')
  L.push(`| \`est_sections\` **exactly equals** \`compiled\` | **${eq.length}** |`)
  L.push(`| …and is flagged \`est_is_confirmed = true\` | **${eqConfirmed.length}** |`)
  L.push(`| \`est_sections\` at or below \`compiled\` (cannot demonstrate completeness) | ${atOrBelow.length} |`)
  L.push(`| rows whose own \`notes\` admit the target was rebaselined from our drain | ${selfAdmitted.length} |`)
  L.push(`| rows flagged confirmed whose own \`notes\` say the number is NOT a measurement | **${contradiction.length}** |`)
  L.push(`| no target at all | ${rows.filter(r => r.est_sections == null).length} |`)
  L.push('')
  L.push('**The brief predicted 46 rows where `est == compiled`. Measured: ' + eq.length + '.**')
  L.push('')
  L.push('## The contradiction inside a single row')
  L.push('')
  for (const r of contradiction) {
    L.push(`**\`${r.corpus_key}\`** — \`est_sections = ${r.est_sections?.toLocaleString()}\`, ` +
      `\`est_is_confirmed = true\`, and its own note reads:`)
    L.push('')
    L.push('> ' + r.notes.replace(/\n/g, ' '))
    L.push('')
    L.push('The note says unmeasured. The flag says confirmed. The email read the flag.')
    L.push('')
  }
  L.push('## Every row')
  L.push('')
  L.push('| corpus | est_sections | confirmed | compiled | est==compiled | last set | attributed to | state |')
  L.push('|---|---:|---|---:|---|---|---|---|')
  for (const r of rows) {
    const same = r.est_sections != null && r.est_sections === r.compiled
    const state = r.retired ? 'RETIRED'
      : r.blocked ? 'BLOCKED'
      : r.est_sections == null ? 'no target'
      : r.est_sections <= r.compiled ? '⚠ self-referential'
      : 'target above count'
    L.push(`| \`${r.corpus_key}\` | ${r.est_sections?.toLocaleString() ?? '—'} | ${r.est_is_confirmed ? '✓' : ''} | ` +
      `${r.compiled.toLocaleString()} | ${same ? '**YES**' : ''} | ${r.upd.slice(0, 10)} | ` +
      `${ATTRIBUTED[r.corpus_key] ?? '*unattributed — no script names this corpus*'} | ${state} |`)
  }
  L.push('')
  L.push('## The six scripts that set a target from a count')
  L.push('')
  L.push('`INGEST_LABELS_REPORT` named five. There is a sixth, and it is the most explicit:')
  L.push('')
  L.push('| script | rule |')
  L.push('|---|---|')
  L.push('| `v19-rebaseline-final.ts` | `est := compiled` for 3 named corpora, `est_is_confirmed = true` |')
  L.push('| `v19-rebaseline-pwdata.ts` | `est := compiled` for every `pwdata%` corpus |')
  L.push('| `v19-align-p1.ts` | `est := compiled` for 2 named corpora |')
  L.push('| `v19-fix-si-residue.ts` | `est := compiled` for `si-pre-2010` |')
  L.push('| `v20-rebaseline-drains.ts` | `est := compiled` for 2 named corpora |')
  L.push('| **`v30-denominator-rebaseline.ts`** | **generic**: any corpus with an empty queue backlog → `est := compiled`, `confirmed = true` |')
  L.push('')
  L.push('⚠ **`v30-denominator-rebaseline.ts` records why, and the why is the whole story.** Its header:')
  L.push('')
  L.push('> *"Fixes the honest-denominator violation flagged this session: summed `corpus_targets.est_sections`')
  L.push('> (16.56M) had fallen below actual compiled sections (17.65M compiled …), and two corpora … had no')
  L.push('> `corpus_targets` row at all — a \'lie of omission\'."*')
  L.push('')
  L.push('The problem was correctly identified: the denominator was smaller than the numerator, which is')
  L.push('impossible for a real denominator. The remedy chosen was to set the denominator to the numerator.')
  L.push('That converts an obvious error into an invisible one, and it was applied deliberately, in a script')
  L.push('whose stated purpose was honesty.')

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, L.join('\n') + '\n')
  console.log(`[A1] ${rows.length} rows · est==compiled ${eq.length} (${eqConfirmed.length} flagged confirmed) · ` +
    `flag/note contradictions ${contradiction.length}`)
  console.log(`[A1] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
