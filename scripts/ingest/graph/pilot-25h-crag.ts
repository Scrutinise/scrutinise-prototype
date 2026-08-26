/**
 * pilot-25h-crag.ts — Sprint 25-H Tasks 4 and 5: run the pilot and both
 * controls, verify a random sample against legislation.gov.uk, and export.
 *
 * ORDER MATTERS AND IS ENFORCED. The brief says the controls run BEFORE the
 * pilot result is trusted, so this runs them first and prints the ordering
 * verdict before the pilot numbers, rather than presenting a pilot figure and
 * then reassuring the reader about it.
 *
 *   npx tsx graph/pilot-25h-crag.ts            — controls, pilot, export (no network)
 *   npx tsx graph/pilot-25h-crag.ts --verify   — also hand-verify 20 random rows live
 * Writes: docs/crag_part1_inbound.json, docs/citation_pilot_25h.json
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { inbound, inboundEvidence, inboundSummary, expandPart } from './inbound'
import { CITATION_TABLE } from './setup-citation-edge-table'

const CRAG = 'ukpga/2010/25'
const CRAG_PART = 'part-1'
const NEGATIVE = 'ukpga/2022/18'   // Down Syndrome Act 2022 — see the reasoning in CITATION_AUDIT.md
const SCALE = ['ukpga/2010/15', 'ukpga/1998/42']  // Equality Act 2010, Human Rights Act 1998
const OUT_JSON = path.join(__dirname, '../../../docs/crag_part1_inbound.json')
const OUT_PILOT = path.join(__dirname, '../../../docs/citation_pilot_25h.json')

/**
 * Does the live text name this provision IN THE SAME PHRASE as the Act?
 *
 * Exported so `check-25h-verify.ts` can plant breaks against THIS function
 * rather than a copy of it. A control that re-implements the logic it is
 * checking tests the copy — which is how a "control" once rejected a claim the
 * real code accepted, purely because a heredoc had eaten its regex escapes.
 */
export function provisionNamedWithAct(flatText: string, provisionRef: string, actNameRx: RegExp): {
  ok: boolean; occurrences: number
} {
  const num = provisionRef.match(/^(?:section|part|schedule|paragraph|chapter)-(\d+[a-z]?)/i)?.[1]
  const kind = provisionRef.split('-')[0]
  const rx = new RegExp(`${kind}\\s*${num}\\b`, 'i')
  const rxAll = new RegExp(actNameRx.source, 'gi')
  const windows = [...flatText.matchAll(rxAll)].map(m => flatText.slice(Math.max(0, m.index! - 220), m.index! + 60))
  if (!num) return { ok: true, occurrences: windows.length }
  return { ok: windows.some(w => rx.test(w)), occurrences: windows.length }
}

export const CRAG_NAME_RX = /Constitutional Reform and Governance Act/i

/** `schedule-1-paragraph-4` → `schedule/1/paragraph/4`; null when the ref is a
 *  CLML internal id (`p04453`) that names no addressable provision path. */
function provisionPath(ref: string | null): string | null {
  if (!ref) return null
  if (!/^(section|schedule|paragraph|article|regulation|rule|part|chapter)-/.test(ref)) return null
  return ref.replace(/-/g, '/')
}

/**
 * ⚠ CLML commentary handles are `key-` + 32 hex — BYTE-IDENTICAL IN SHAPE TO A
 * MAILGUN API KEY, and GitHub's push protection rejects a file containing them.
 * `<CommentaryRef Ref="key-<32 hex chars>"/>` is a public
 * legislation.gov.uk identifier and not a secret, but shipping the token shape
 * is what gets a commit blocked, so the EXPORT redacts it.
 *
 * Only the handle is touched. It is an internal pointer with no evidential
 * value — every quotable word of `citation_text` and `raw_fragment` survives,
 * and the true bytes remain in `citation_edge` for anyone who needs them.
 */
const CLML_HANDLE_RX = /key-[0-9a-f]{32}/g
function redactHandles<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(CLML_HANDLE_RX, 'key-REDACTED-CLML-COMMENTARY-HANDLE'))
}

/** Deterministic shuffle — a "random sample" that cannot be reproduced is not
 *  evidence. Seeded so the same 20 rows come back on a re-run. */
function seededPick<T>(items: T[], n: number, seed: number): T[] {
  const a = [...items]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = s % (i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

type Verdict = { url: string; ok: boolean; reason: string; source: string; provision: string | null }

async function verifyRow(row: { source_gid: string; source_provision_ref: string | null; target_act_id: string | null; target_provision_ref: string | null }): Promise<Verdict> {
  const p = provisionPath(row.source_provision_ref)
  const url = `https://www.legislation.gov.uk/${row.source_gid}${p ? '/' + p : ''}/data.xml`
  const label = `${row.source_gid}${row.source_provision_ref ? ':' + row.source_provision_ref : ''}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'scrutinise-citation-audit/25H' } })
    if (!res.ok) return { url, ok: false, reason: `HTTP ${res.status} — provision not addressable at this path`, source: label, provision: row.target_provision_ref }
    const xml = await res.text()
    // the claim being checked: this provision, as published TODAY, refers to CRAG.
    const hasUri = xml.includes(`/${row.target_act_id}`)
    const hasName = /Constitutional Reform and Governance Act/i.test(xml)
    if (!hasUri && !hasName) return { url, ok: false, reason: 'live text contains neither the target URI nor the Act name', source: label, provision: row.target_provision_ref }
    if (row.target_provision_ref) {
      // ⚠ Presence of "Part 1" ANYWHERE in a document is not evidence that this
      // reference is to Part 1 — a long Act mentions "Part 1" constantly. The
      // provision must appear NEAR the Act's name, in the same phrase.
      //
      // ⚠⚠ And in EVERY occurrence of that name, not the first. Anchoring on
      // the first marked two rows WRONG whose parse was right: `ukpga/2006/32`
      // s.52 names CRAG six times, and the first is "See Part 1 of the …" while
      // the one that matters — "by section 3 of the …" — is the second.
      // Reporting those as data errors would have put a false finding in this
      // sprint's headline result.
      const flat = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
      const v = provisionNamedWithAct(flat, row.target_provision_ref, CRAG_NAME_RX)
      if (!v.ok) {
        return {
          url, ok: false, source: label, provision: row.target_provision_ref,
          reason: v.occurrences === 0
            ? 'the Act is not named in the live text at all'
            : `refers to the Act in ${v.occurrences} place(s) but "${row.target_provision_ref}" is in none of those phrases — the parsed provision is wrong`,
        }
      }
    }
    return { url, ok: true, reason: hasUri ? 'target URI present in the live provision' : 'Act named in the live provision text', source: label, provision: row.target_provision_ref }
  } catch (e) {
    return { url, ok: false, reason: `fetch failed: ${(e as Error).message}`, source: label, provision: row.target_provision_ref }
  }
}

async function main() {
  const doVerify = process.argv.includes('--verify')
  const pool = getNeonPool()
  const { rows: tot } = await pool.query(`SELECT COUNT(*)::int n FROM ${CITATION_TABLE}`)
  console.log(`[pilot] ${CITATION_TABLE} holds ${tot[0].n.toLocaleString()} rows\n`)

  // ── CONTROLS FIRST, per §6 ────────────────────────────────────────────────
  const det = (s: Awaited<ReturnType<typeof inboundSummary>>) =>
    s.byDetection.map(d => `${d.detection} ${d.n}`).join(' + ') || 'none'

  console.log('══ NEGATIVE CONTROL ══')
  const neg = await inboundSummary(NEGATIVE)
  console.log(`  ${NEGATIVE} (Down Syndrome Act 2022): ${neg.total} inbound references from ${neg.distinctSourceActs} instruments [${det(neg)}]`)
  for (const r of neg.bySourceAct.slice(0, 5)) console.log(`     ${r.source_gid} (${r.source_type}) × ${r.n}`)

  console.log('\n══ SCALE CONTROL ══')
  const scale: Record<string, Awaited<ReturnType<typeof inboundSummary>>> = {}
  for (const gid of SCALE) {
    scale[gid] = await inboundSummary(gid)
    console.log(`  ${gid}: ${scale[gid].total} inbound (${scale[gid].distinctSourceActs} instruments) — ` +
      scale[gid].bySourceType.map(t => `${t.source_type} ${t.n}`).join(', ') + ` [${det(scale[gid])}]`)
  }
  const cragSummary = await inboundSummary(CRAG)
  console.log(`  ${CRAG} (CRAG 2010): ${cragSummary.total} inbound (${cragSummary.distinctSourceActs} instruments) — ` +
    cragSummary.bySourceType.map(t => `${t.source_type} ${t.n}`).join(', ') + ` [${det(cragSummary)}]`)

  const orderingOk = SCALE.every(g => scale[g].total > cragSummary.total) && cragSummary.total > neg.total
  console.log(`\n  ORDERING: EqA(${scale['ukpga/2010/15'].total}) and HRA(${scale['ukpga/1998/42'].total}) ` +
    `> CRAG(${cragSummary.total}) > DownSyndrome(${neg.total})  →  ${orderingOk ? 'HOLDS' : '⚠⚠ BROKEN — STOP'}`)
  if (!orderingOk) {
    console.error('\n⚠⚠ The ordering control failed. Per brief §6 the cause must be found before anything else runs.')
  }

  // ── THE PILOT ─────────────────────────────────────────────────────────────
  console.log('\n══ PILOT — CRAG 2010 Part 1 ══')
  const exp = expandPart(CRAG, CRAG_PART)
  console.log(`  Part expansion: available=${exp.available} — ${exp.note}`)
  console.log(`  matching refs (${exp.refs.length}): ${exp.refs.slice(0, 24).join(', ')}${exp.refs.length > 24 ? ' …' : ''}`)

  const { rows: partRows } = await inboundEvidence(CRAG, CRAG_PART)
  const four = await inbound(CRAG, CRAG_PART)
  console.log(`\n  inbound('${CRAG}', '${CRAG_PART}') → ${partRows.length} rows (the 4-field surface returned ${four.length})`)
  console.log(`  inbound to CRAG as a whole, no provision named : ${cragSummary.actLevel}`)
  console.log(`  inbound to CRAG with SOME provision named      : ${cragSummary.provisionLevel}`)
  const markupPart = partRows.filter(r => r.detection === 'markup').length
  console.log(`  of the ${partRows.length} Part-1 rows: ${markupPart} asserted by URI markup, ${partRows.length - markupPart} resolved from the Act's name in text`)
  for (const r of partRows.slice(0, 40)) {
    console.log(`    [${r.detection}] ${r.source_gid}:${r.source_provision_ref ?? '-'} (${r.source_type}) → ${r.target_provision_ref}`)
    console.log(`       "${r.citation_text.slice(-150)}"`)
  }

  // ── HAND VERIFICATION ─────────────────────────────────────────────────────
  let verdicts: Verdict[] = []
  if (doVerify) {
    // verify the Part-1 rows if there are 20, otherwise top up from the
    // act-level rows — the sample must be 20 real rows, not 20 slots.
    const { rows: allCrag } = await inboundEvidence(CRAG)
    // ⚠ dedupe by VALUE, not identity — the two queries return different objects
    // for the same row, so `!partRows.includes(r)` would have kept every one and
    // the "20 random rows" could have been the same row twice.
    const key = (r: typeof allCrag[number]) => `${r.source_gid}|${r.source_provision_ref}|${r.target_uri}|${r.citation_text}`
    const seen = new Set(partRows.map(key))
    const pool20 = partRows.length >= 20 ? partRows : [...partRows, ...allCrag.filter(r => !seen.has(key(r)))]
    const sample = seededPick(pool20, Math.min(20, pool20.length), 25_08_2026)
    console.log(`\n══ HAND VERIFICATION — ${sample.length} rows against legislation.gov.uk ══`)
    for (const r of sample) {
      const v = await verifyRow(r)
      verdicts.push(v)
      console.log(`  ${v.ok ? 'OK  ' : 'WRONG'} ${v.source} → ${v.provision ?? '(act-level)'}  — ${v.reason}`)
    }
    const ok = verdicts.filter(v => v.ok).length
    console.log(`\n  ${ok} of ${verdicts.length} correct, ${verdicts.length - ok} wrong`)
    const wrongReasons: Record<string, number> = {}
    for (const v of verdicts.filter(x => !x.ok)) wrongReasons[v.reason.replace(/"[^"]*"/, '"…"')] = (wrongReasons[v.reason.replace(/"[^"]*"/, '"…"')] ?? 0) + 1
    if (Object.keys(wrongReasons).length) {
      console.log('  what the wrong ones have in common:')
      for (const [k, n] of Object.entries(wrongReasons).sort((a, b) => b[1] - a[1])) console.log(`     ${n} × ${k}`)
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────
  const { rows: allRows } = await inboundEvidence(CRAG)
  fs.writeFileSync(OUT_JSON, JSON.stringify(redactHandles({
    generatedAt: new Date().toISOString(),
    target: { act_id: CRAG, title: 'Constitutional Reform and Governance Act 2010', part: CRAG_PART },
    partExpansion: exp,
    counts: {
      partScoped: partRows.length,
      actWide: cragSummary.total,
      actLevelNoProvision: cragSummary.actLevel,
      provisionLevel: cragSummary.provisionLevel,
      distinctSourceInstruments: cragSummary.distinctSourceActs,
    },
    caveat: 'partScoped counts references that NAME a Part 1 provision. actLevelNoProvision is the band of references that name CRAG without naming a provision — any of them may or may not bear on Part 1, and the CLML markup does not say. Neither number alone answers the repeal question.',
    summary: cragSummary,
    partScopedRows: partRows,
    actWideRows: allRows,
  }), null, 2))
  console.log(`\n[pilot] wrote ${OUT_JSON} (${partRows.length} part-scoped + ${allRows.length} act-wide rows)`)

  fs.writeFileSync(OUT_PILOT, JSON.stringify(redactHandles({
    generatedAt: new Date().toISOString(),
    tableRows: tot[0].n,
    negativeControl: { gid: NEGATIVE, summary: neg },
    scaleControl: scale,
    crag: cragSummary,
    orderingHolds: orderingOk,
    partExpansion: exp,
    partScoped: partRows.length,
    verification: verdicts,
  }), null, 2))
  console.log(`[pilot] wrote ${OUT_PILOT}`)
  await endNeonPool()
}

// ⚠ Guarded. check-25h-verify.ts imports provisionNamedWithAct from this file,
// and an unguarded main() ran the WHOLE PILOT as a side effect of that import —
// including rewriting crag_part1_inbound.json. That is the same defect this
// sprint already fixed once in audit-25h-citations.ts, reappearing in the file
// that writes the deliverable.
if (require.main === module) {
  main().catch(e => { console.error('[pilot] FATAL', e); process.exit(1) })
}
