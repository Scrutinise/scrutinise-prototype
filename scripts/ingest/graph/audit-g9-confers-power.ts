/**
 * audit-g9-confers-power.ts — GRAPH 9 §2.1/§2.2: derive the provision text rule from data, then score it.
 *
 * TWO LABELS, BOTH INDEPENDENT OF THE TEXT RULE, because neither alone is the label the brief wanted:
 *
 *   FLAG  legislation.gov.uk's `ConfersPower="true"` (provision-power.ts) — the publisher's. ⚠ Measured on the first
 *         run of this audit: it marks a power OF ANY KIND (to inspect, appoint, impose a penalty), not only a power to
 *         make subordinate legislation, and only in documents the publisher has marked at all. So it is the label for
 *         PRECISION — a text hit on a provision the publisher, having marked the document, says confers no power of
 *         any kind is a false positive — and it cannot be the label for recall.
 *   SI    provisions that SIs' own enacting words name as the power exercised (`citation_edge.enabling_role = 'power'`,
 *         decision 271, 39/40 on its last untuned draw). The nearest thing we hold to "independently confirmed
 *         enabling" (§2.2 — we hold no publisher record of powers exercised). It is the label for RECALL.
 *
 *   1. coverage — documents marked, by type and (for Acts) by decade.
 *   2. derivation, TRAIN half (gid hash even) only: each candidate family's precision against FLAG. SELECTED at
 *      precision ≥ PRECISION_FLOOR with ≥ SUPPORT_FLOOR true positives.
 *   3. score, TEST half only: the selected union's precision against FLAG and recall against SI.
 *   4. agreement of the two non-text instruments: of SI-confirmed powers in marked documents, how many are flagged.
 *   5. samples from the test half to read: text fires and the flag says no power; SI says power and the text is silent.
 *
 * Read-only. Writes audit-g9-confers-power.json.   npx tsx graph/audit-g9-confers-power.ts
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { provisionsOf, familiesIn, provisionPowerState, POWER_FAMILIES, TEXT_RULE_FAMILIES, TEXT_EVIDENCE_FAMILIES } from './provision-power'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const OUT = path.join(__dirname, 'audit-g9-confers-power.json')
export const PRECISION_FLOOR = 0.8
export const SUPPORT_FLOOR = 30

/** FNV-1a — a fixed split, so the halves are the same on every run. */
export function half(gid: string): 'train' | 'test' {
  let h = 0x811c9dc5
  for (let i = 0; i < gid.length; i++) { h ^= gid.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h % 2 === 0 ? 'train' : 'test'
}

type Tally = { flagged: number; unflagged: number; si: number }
const r3 = (x: number) => Math.round(x * 1000) / 1000

async function main() {
  const pool = getNeonPool()
  const siRows = await pool.query<{ g: string; p: string }>(
    `SELECT DISTINCT target_act_id g, target_provision_ref p FROM citation_edge
      WHERE detection = 'enabling' AND enabling_role = 'power' AND target_provision_ref IS NOT NULL AND target_act_id IS NOT NULL`)
  const si = new Set(siRows.rows.map((r) => `${r.g}|${r.p}`))
  await endNeonPool()
  console.log(`[confers-power] ${si.size.toLocaleString()} provisions named by SIs as the power exercised`)

  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries.map((e) => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null)

  const coverage: Record<string, { docs: number; marked: number; provisions: number; flagged: number }> = {}
  const actDecades: Record<string, { docs: number; marked: number }> = {}
  // Per half: family-set → tallies, so any union can be scored after one pass.
  const sets: Record<'train' | 'test', Map<string, Tally>> = { train: new Map(), test: new Map() }
  const totals = { train: { flagged: 0, unflagged: 0, si: 0 }, test: { flagged: 0, unflagged: 0, si: 0 } }
  const agreement = { siInMarked: 0, siInMarkedFlagged: 0, siFound: 0 }
  const samples = { textButFlagSaysNoPower: [] as string[], siPowerButTextSilent: [] as string[], siPowerButStateNone: [] as string[] }
  // The state function as used: on SI-confirmed powers (a `none` here is a candidate FALSE none — the error that would
  // wrongly withhold a real dependency), and on every provision of every document (how much it can say at all).
  const stateSi: Record<string, number> = {}
  const stateAll: Record<string, number> = {}
  const STRONG = ['by_regulations', 'by_statutory_instrument', 'make_regulations', 'power_to_make', 'regulations_may']
  let seen = 0
  const t0 = Date.now()

  for (const { e, m } of entries) {
    const gid = gidFromEntry(m)
    const type = m[1]
    let xml: string
    try { xml = zip.readText(e) } catch { continue }
    const { provisions, documentMarked } = provisionsOf(xml)
    const cov = (coverage[type] ??= { docs: 0, marked: 0, provisions: 0, flagged: 0 })
    cov.docs++; cov.provisions += provisions.length
    if (documentMarked) cov.marked++
    if (type === 'ukpga') {
      const y = /^\d{4}$/.test(m[2]) ? `${m[2].slice(0, 3)}0s` : 'regnal (pre-1963)'
      const d = (actDecades[y] ??= { docs: 0, marked: 0 }); d.docs++; if (documentMarked) d.marked++
    }
    const h = half(gid)
    for (const p of provisions) {
      if (p.flagged) cov.flagged++
      const isSi = si.has(`${gid}|${p.ref}`)
      const st = provisionPowerState({ flagged: p.flagged, text: p.text, documentMarked })
      const sk = `${st.state}:${st.basis}`
      stateAll[sk] = (stateAll[sk] ?? 0) + 1
      if (isSi) {
        stateSi[sk] = (stateSi[sk] ?? 0) + 1
        if (st.state === 'none' && samples.siPowerButStateNone.length < 25 && (seen + p.ref.length) % 3 === 0) {
          samples.siPowerButStateNone.push(`${gid} ${p.ref} ${p.text.slice(0, 360)}`)
        }
      }
      if (!documentMarked && !isSi) continue
      const fams = familiesIn(p.text)
      const key = fams.sort().join(',')
      const t = sets[h].get(key) ?? { flagged: 0, unflagged: 0, si: 0 }
      if (documentMarked) { if (p.flagged) { t.flagged++; totals[h].flagged++ } else { t.unflagged++; totals[h].unflagged++ } }
      if (isSi) {
        t.si++; totals[h].si++; agreement.siFound++
        if (documentMarked) { agreement.siInMarked++; if (p.flagged) agreement.siInMarkedFlagged++ }
      }
      sets[h].set(key, t)
      if (h === 'test' && (seen + p.ref.length) % 41 === 0) {
        const strong = fams.filter((f) => STRONG.includes(f))
        if (documentMarked && !p.flagged && strong.length && samples.textButFlagSaysNoPower.length < 15) {
          samples.textButFlagSaysNoPower.push(`${gid} ${p.ref} [${strong.join(',')}] ${p.text.slice(0, 400)}`)
        }
        if (isSi && !fams.length && samples.siPowerButTextSilent.length < 15) {
          samples.siPowerButTextSilent.push(`${gid} ${p.ref} ${p.text.slice(0, 400)}`)
        }
      }
    }
    if (++seen % 10000 === 0) console.log(`  ${seen.toLocaleString()} docs, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }

  const score = (h: 'train' | 'test', use: readonly string[]) => {
    let tp = 0, fp = 0, siHit = 0
    for (const [key, n] of sets[h]) {
      if (!key.split(',').some((f) => use.includes(f))) continue
      tp += n.flagged; fp += n.unflagged; siHit += n.si
    }
    return {
      fires_in_marked_docs: tp + fp, of_which_flagged: tp, of_which_flag_says_no_power: fp,
      precision_vs_flag: r3(tp / Math.max(tp + fp, 1)),
      si_confirmed: totals[h].si, si_confirmed_text_fires: siHit, recall_vs_si: r3(siHit / Math.max(totals[h].si, 1)),
    }
  }
  const perFamily = Object.keys(POWER_FAMILIES).map((f) => {
    const s = score('train', [f])
    return { family: f, ...s, selected: s.precision_vs_flag >= PRECISION_FLOOR && s.of_which_flagged >= SUPPORT_FLOOR }
  })
  const selected = perFamily.filter((f) => f.selected).map((f) => f.family)

  const result = {
    measured_at: new Date().toISOString(),
    zip: `${ZIP_PATH} (mtime ${fs.statSync(ZIP_PATH).mtime.toISOString().slice(0, 10)})`,
    documents: seen,
    labels: {
      flag: 'legislation.gov.uk ConfersPower="true" on a P1 or its P1group, counted only in documents the publisher marked (≥1 flag anywhere)',
      si: `provisions an SI's enacting words name as the power exercised (citation_edge enabling_role = 'power'): ${si.size} distinct (gid, provision)`,
    },
    coverage_by_type: coverage,
    acts_marked_by_decade: actDecades,
    totals_by_half: totals,
    derivation: { half: 'train (FNV-1a of gid even)', precision_floor: PRECISION_FLOOR, support_floor: SUPPORT_FLOOR, per_family: perFamily, selected },
    text_rule_in_code: TEXT_RULE_FAMILIES,
    code_matches_selected: JSON.stringify([...TEXT_RULE_FAMILIES].sort()) === JSON.stringify([...selected].sort()),
    score_test_selected: score('test', selected),
    score_train_selected: score('train', selected),
    score_test_all_candidates: score('test', Object.keys(POWER_FAMILIES)),
    text_evidence_families_in_code: TEXT_EVIDENCE_FAMILIES,
    text_evidence_families_at_or_above_0_6: perFamily.filter((f) => f.precision_vs_flag >= 0.6).map((f) => f.family),
    state_on_si_confirmed_powers: stateSi,
    false_none_rate_on_si_confirmed: (() => {
      const total = Object.values(stateSi).reduce((a, b) => a + b, 0)
      const none = Object.entries(stateSi).filter(([k]) => k.startsWith('none:')).reduce((a, [, n]) => a + n, 0)
      return { si_confirmed_held: total, state_none: none, pct: r3(none / Math.max(total, 1)), reading: 'upper bound: an SI naming an interpretation section among its powers is counted here, and that provision rightly confers none' }
    })(),
    state_on_every_provision: stateAll,
    non_text_instruments_agree: {
      si_confirmed_found_in_zip: agreement.siFound,
      si_confirmed_in_marked_docs: agreement.siInMarked,
      of_which_flagged: agreement.siInMarkedFlagged,
      pct: r3(agreement.siInMarkedFlagged / Math.max(agreement.siInMarked, 1)),
    },
    samples_test_half: samples,
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  const { samples_test_half: _s, coverage_by_type: _c, ...brief } = result
  console.log(JSON.stringify(brief, null, 1))
}
main().catch((e) => { console.error('[confers-power] FATAL', e); process.exit(1) })
