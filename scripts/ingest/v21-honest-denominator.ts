/**
 * v21-honest-denominator.ts — V21 §3: explicit ~ placeholder rows in
 * corpus_targets for every known-but-unenumerated source, with the best
 * current estimate and its provenance (in notes). Playbook §1d: a known
 * source missing from the denominator is a lie of omission.
 *
 * Pairs with the V21 progress-reporter change: blocked targets now COUNT in
 * the denominator (the universe doesn't shrink because we can't fetch it);
 * retired targets never count (successor corpora already do).
 *
 * Idempotent — upserts on corpus_key. Prints the before/after headline %.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

interface Placeholder {
  key: string
  label: string
  est: number | null
  blocked: boolean
  blockedReason: string | null
  notes: string
}

const PLACEHOLDERS: Placeholder[] = [
  {
    key: 'historic-hansard',
    label: 'Historic Hansard 1803-1918',
    est: 1_100_000,
    blocked: false,
    blockedReason: null,
    notes: 'V20 sizing probe (~763 volume zips; S1V1 sample 527k words) + V21 pilot (S1V0001P0 → 1,597 sections, 512,541 words, parser verified end-to-end). Re-baseline at drain.',
  },
  // quangos-govuk is written by enumerate-quangos.ts (measured 162,004) — not repeated here.
  {
    key: 'scottish-courts',
    label: 'Scottish courts judgments',
    est: 20_000,
    blocked: true,
    blockedReason: 'api.pa.web.scotcourts.gov.uk requires an auth key not present in static assets (V20 §3.5) — Charlie: browser devtools XHR inspection unblocks',
    notes: 'ROUGH order-of-magnitude only (~700 published opinions/yr since ~1998, unmeasured — search API blocked, old archive 404s). Replace with measured universe at unblock.',
  },
  {
    key: 'college-of-policing',
    label: 'College of Policing APP',
    est: 8_000,
    blocked: true,
    blockedReason: 'college.police.uk CF-blocked; licence unverified (V20 audit deleted 1,944 junk rows from the unfiltered gov.uk search era)',
    notes: 'ROUGH estimate ~8k APP/guidance pages (V21 brief figure). Measure at unblock.',
  },
  {
    key: 'echr-hudoc',
    label: 'ECHR HUDOC (UK cases)',
    est: 4_471,
    blocked: true,
    blockedReason: 'client points at retired routes; V20 probe found live ones (/app/query/results + conversion/pdf, browser UA + Referer) — revival V21+',
    notes: 'V20 probe MEASURED: resultcount GBR 4,471 docs (584 judgments) — replaces the V-era ~30,050 guess. Sections will exceed docs at ingest.',
  },
  {
    key: 'bills-api',
    label: 'Bills API (texts + stages)',
    est: 5_000,
    blocked: false,
    blockedReason: null,
    notes: 'ROUGH order only (~150-200 bills/session in the API era since ~2001; texts/stages unprobed). Not built — placeholder per V21 §3.',
  },
  {
    key: 'financial-corpus',
    label: 'Financial corpus (scoping pending)',
    est: null,
    blocked: false,
    blockedReason: null,
    notes: 'UNSIZED placeholder (V21 §3) — named in the V21 brief as known-but-unenumerated; carries no denominator until scoped.',
  },
]

// Counting 10M corpus_sections live blows the 60s client query_timeout; the
// hourly census already snapshots compiled counts per corpus (incl. the
// legacy-legislation-section row), so read the latest snapshot hour instead.
async function headline(pool: ReturnType<typeof getNeonPool>): Promise<string> {
  const res = await pool.query<{ compiled: string; est: string }>(`
    SELECT
      (SELECT SUM(compiled_count) FROM corpus_snapshots
        WHERE hour = (SELECT MAX(hour) FROM corpus_snapshots)) AS compiled,
      (SELECT COALESCE(SUM(est_sections), 0) FROM corpus_targets
        WHERE COALESCE(retired, false) = false AND est_sections IS NOT NULL) AS est
  `)
  const legacyRes = await pool.query<{ n: string }>(`
    SELECT section_count::text AS n FROM corpus_snapshots
    WHERE corpus_key = 'legacy-legislation-section'
    ORDER BY hour DESC LIMIT 1
  `)
  const compiled = Number(res.rows[0].compiled)
  const est = Number(res.rows[0].est) + Number(legacyRes.rows[0]?.n ?? 0)
  return `${compiled.toLocaleString()} / ${est.toLocaleString()} = ${((compiled / est) * 100).toFixed(1)}% (latest census hour)`
}

async function main() {
  const pool = getNeonPool()
  // "before" under the OLD rule (blocked excluded, retired included) for the scorecard
  const oldRule = await pool.query<{ est: string }>(`
    SELECT COALESCE(SUM(est_sections), 0) AS est FROM corpus_targets
    WHERE COALESCE(blocked, false) = false AND est_sections IS NOT NULL
  `)
  console.log(`[denominator] OLD-rule new-pipeline est: ${Number(oldRule.rows[0].est).toLocaleString()}`)
  console.log(`[denominator] before (new rule, pre-placeholders): ${await headline(pool)}`)

  for (const p of PLACEHOLDERS) {
    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason, notes)
      VALUES ($1, $2, $3, false, 4, $4, $5, $6)
      ON CONFLICT (corpus_key) DO UPDATE
        SET display_label = EXCLUDED.display_label,
            est_sections = EXCLUDED.est_sections,
            est_is_confirmed = false,
            blocked = EXCLUDED.blocked,
            blocked_reason = EXCLUDED.blocked_reason,
            notes = EXCLUDED.notes,
            updated_at = NOW()
    `, [p.key, p.label, p.est, p.blocked, p.blockedReason, p.notes])
    console.log(`  upserted ${p.key} est=${p.est ?? 'NULL (unsized)'}${p.blocked ? ' [blocked]' : ''}`)
  }

  console.log(`[denominator] after: ${await headline(pool)}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
