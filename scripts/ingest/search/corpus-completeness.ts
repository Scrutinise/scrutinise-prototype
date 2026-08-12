/**
 * corpus-completeness.ts — REACHABILITY IS NOT COMPLETENESS (V36 §5).
 *
 * `corpus-reachability.ts` answers "can a query select this collection?". It has
 * reported 99.12% for two sprints and it was right. It says nothing about whether
 * the collection contains the documents it claims to cover, and for two sprints
 * nobody asked — which is how tuning ran for a fortnight against a recall ceiling
 * made of 17,261 absent instruments, and why the number turned out to be larger
 * than that once the source's own published set was walked.
 *
 * ⚠ A collection that is 60% ingested and 100% reachable reports as healthy on the
 * reachability matrix. This is the missing column.
 *
 * WHAT IT REFUSES TO DO. It does not estimate. A collection is reported in exactly
 * one of three states, and the third is the important one:
 *
 *   reconciled     — the source's own published total is known, per year, from a
 *                    walk of the source (docs/v36_reconciliation.json), and held is
 *                    measured against it.
 *   target-only    — `corpus_targets.est_sections` exists and `est_is_confirmed` is
 *                    true, so there is a confirmed section target but no
 *                    instrument-level reconciliation against the publisher.
 *   NOT RECONCILED — neither. Coverage is UNKNOWN. Not 100%, not "probably fine".
 *                    This is the state that was invisible before, and printing it
 *                    is most of the value of this file.
 *
 * Usage: tsx search/corpus-completeness.ts [--json]
 * Writes: docs/CORPUS_COMPLETENESS.md, docs/corpus_completeness.json
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const RECON_PATH = path.join(__dirname, '../../../docs/v36_reconciliation.json')
const OUT_MD = path.join(__dirname, '../../../docs/CORPUS_COMPLETENESS.md')
const OUT_JSON = path.join(__dirname, '../../../docs/corpus_completeness.json')

/** Which legislation corpus a doctype's instruments land in. Mirrors the seeders;
 *  kept here so the reconciliation can be rolled up per collection. */
const TYPE_TO_CORPUS: Record<string, (year: number) => string> = {
  ukpga: y => (y >= 2000 ? 'primary-acts-2000plus' : 'primary-acts-pre-2000'),
  uksi:  y => (y >= 2010 ? 'si-2010plus' : 'si-pre-2010'),
  eur: () => 'retained-eu', eudn: () => 'retained-eu', eudr: () => 'retained-eu',
  asp: () => 'regional', ssi: () => 'regional', wsi: () => 'regional',
  anaw: () => 'regional', asc: () => 'regional', nia: () => 'regional',
  nisi: () => 'regional', nisr: () => 'regional',
}

interface Recon { per_year: Record<string, { published: number; present: number; absentClassB: number; absentClassA: number; absentUnseen: number }> }

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })

  const { rows: targets } = await pool.query(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed, retired, blocked
    FROM corpus_targets WHERE COALESCE(retired,false) = false ORDER BY corpus_key`)
  const { rows: held } = await pool.query(`
    SELECT corpus, count(*)::int AS sections,
           count(*) FILTER (WHERE status='compiled')::int AS compiled
    FROM corpus_sections GROUP BY 1`)
  await pool.end()

  const heldBy = new Map(held.map(h => [h.corpus as string, h]))

  // Roll the per-(type, year) reconciliation up to per-collection instrument counts.
  const recon: Recon | null = fs.existsSync(RECON_PATH) ? JSON.parse(fs.readFileSync(RECON_PATH, 'utf8')) : null
  const reconByCorpus = new Map<string, { published: number; present: number; absent: number; classA: number; years: number }>()
  if (recon) {
    for (const [key, v] of Object.entries(recon.per_year)) {
      const [type, yearStr] = key.split('/')
      const map = TYPE_TO_CORPUS[type]
      if (!map) continue
      const corpus = map(Number(yearStr))
      const agg = reconByCorpus.get(corpus) ?? { published: 0, present: 0, absent: 0, classA: 0, years: 0 }
      agg.published += v.published
      agg.present += v.present
      agg.absent += v.absentClassB + v.absentUnseen
      agg.classA += v.absentClassA
      agg.years += 1
      reconByCorpus.set(corpus, agg)
    }
  }
  const reconciledAt = recon ? fs.statSync(RECON_PATH).mtime.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : null

  const out: Record<string, unknown>[] = []
  for (const t of targets) {
    const h = heldBy.get(t.corpus_key)
    const r = reconByCorpus.get(t.corpus_key)
    const state = r ? 'reconciled' : (t.est_is_confirmed ? 'target-only' : 'NOT RECONCILED')
    out.push({
      corpus: t.corpus_key,
      label: t.display_label,
      sections_held: h?.compiled ?? 0,
      state,
      // Instrument-level completeness, only where the publisher's own set was walked.
      source_instruments: r?.published ?? null,
      instruments_present: r?.present ?? null,
      instruments_absent: r?.absent ?? null,
      instruments_no_provisions: r?.classA ?? null,
      completeness_pct: r && r.published ? Number(((100 * r.present) / r.published).toFixed(1)) : null,
      est_sections: t.est_sections ?? null,
      est_confirmed: t.est_is_confirmed ?? false,
      last_reconciled: r ? reconciledAt : null,
    })
  }
  out.sort((a, b) => Number(b.sections_held) - Number(a.sections_held))

  const nRecon = out.filter(o => o.state === 'reconciled').length
  const nTarget = out.filter(o => o.state === 'target-only').length
  const nNone = out.filter(o => o.state === 'NOT RECONCILED').length

  const lines: string[] = []
  lines.push('# CORPUS COMPLETENESS')
  lines.push('')
  lines.push('*Generated by `scripts/ingest/search/corpus-completeness.ts`. Companion to')
  lines.push('`CORPUS_REACHABILITY.md`, which answers a different question.*')
  lines.push('')
  lines.push('**Reachability asks whether a query can select a collection. Completeness asks whether')
  lines.push('the collection contains the documents it claims to cover.** A collection can be 100% of')
  lines.push('the first and 60% of the second and every dashboard we had would call it healthy.')
  lines.push('')
  lines.push(`Collections: **${out.length}** — reconciled against the publisher **${nRecon}**, ` +
    `confirmed section target only **${nTarget}**, **NOT RECONCILED ${nNone}**.`)
  lines.push('')
  lines.push('⚠ **NOT RECONCILED does not mean incomplete. It means unmeasured** — nobody has compared')
  lines.push('this collection against its publisher\'s own list. Read it as a gap in the instrument,')
  lines.push('not a gap in the corpus, and do not quote a coverage figure for these rows.')
  lines.push('')
  lines.push('| corpus | sections held | state | source instruments | present | absent | no-provisions | completeness | last reconciled |')
  lines.push('|---|---:|---|---:|---:|---:|---:|---:|---|')
  for (const o of out) {
    lines.push(`| \`${o.corpus}\` | ${Number(o.sections_held).toLocaleString()} | ${o.state} | ` +
      `${o.source_instruments != null ? Number(o.source_instruments).toLocaleString() : '—'} | ` +
      `${o.instruments_present != null ? Number(o.instruments_present).toLocaleString() : '—'} | ` +
      `${o.instruments_absent != null ? Number(o.instruments_absent).toLocaleString() : '—'} | ` +
      `${o.instruments_no_provisions != null ? Number(o.instruments_no_provisions).toLocaleString() : '—'} | ` +
      `${o.completeness_pct != null ? `${o.completeness_pct}%` : '—'} | ${o.last_reconciled ?? '—'} |`)
  }
  lines.push('')
  lines.push('## How a collection moves out of NOT RECONCILED')
  lines.push('')
  lines.push('Walk the publisher\'s own enumeration and record what it publishes, per unit, then diff')
  lines.push('against what `corpus_sections` holds. For legislation.gov.uk that is')
  lines.push('`scripts/ingest/v36-source-census.ts --enumerate` followed by `v36-reconcile.ts`.');
  lines.push('For other publishers the walk differs; the requirement does not. **A count of what we')
  lines.push('fetched is not a denominator** — the V34 Commons enumerator would have reported success')
  lines.push('having ingested 25 of 2,361 rows.')

  fs.writeFileSync(OUT_MD, lines.join('\n') + '\n')
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), collections: out }, null, 1))

  console.log(`[completeness] ${out.length} collections: reconciled ${nRecon}, target-only ${nTarget}, NOT RECONCILED ${nNone}`)
  for (const o of out.filter(x => x.state === 'reconciled')) {
    console.log(`  ${String(o.corpus).padEnd(24)} ${String(o.completeness_pct).padStart(5)}%  ` +
      `${Number(o.instruments_present).toLocaleString()} of ${Number(o.source_instruments).toLocaleString()} published`)
  }
  console.log(`[completeness] → ${OUT_MD}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
