/**
 * v37-citation-gaps.ts — V37 §1: LET THE CORPUS AUDIT ITSELF.
 *
 * THE QUESTION, and it is the one no previous check asked: of every instrument our
 * corpus REFERS TO, how many do we actually hold? An Act citing the Companies Act
 * 2006 while we have no Companies Act 2006 is the corpus pointing at its own gap. No
 * user has to notice; no query has to fail.
 *
 * Every check before this was a closed loop — "did everything we queued succeed?" —
 * and a perfect score against a list missing 17,261 entries is indistinguishable from
 * a perfect score against a complete one. This one has an external referent: the
 * documents' own cross-references.
 *
 * ── PROVENANCE IS SPLIT, because "our corpus refers to it" is not one thing ──────
 *   OURS      `cites` and `made-under` — extracted from the body and preamble of
 *             documents WE hold. This is genuinely the corpus pointing at its gap.
 *   EXTERNAL  `amends` / `repeals` / `commences` / `modifies` — from TNA's bulk
 *             amendments and in-force datasets. Still evidence an instrument exists
 *             and matters, but it is TNA's assertion, not our documents'. Reported
 *             separately so nobody quotes one as the other.
 *
 * ── THE FALSE-GAP TRAP THIS CHECK WOULD OTHERWISE WALK INTO ─────────────────────
 * Pre-1963 Acts have two ids for the same document: the regnal id TNA publishes
 * (`ukpga/Geo5/15-16/20`) and the calendar id (`ukpga/1925/20`). V36 found 1,610
 * instruments held under the regnal form with no calendar row — so a citation to the
 * calendar form resolves to "nothing" while the text is right there. This resolves
 * BOTH forms via the alias map built from legislation.gov.uk's own year feeds
 * (`v36/source-entries.json`, which carries docId + ukm:Year/ukm:Number per entry).
 * Without it the report's headline number would be inflated by thousands of
 * instruments we hold.
 *
 * Usage:
 *   tsx v37-citation-gaps.ts [--min-cites 1] [--top 200]
 * Writes: docs/CORPUS_CITATION_GAPS.md, docs/corpus_citation_gaps.json
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { identitiesFor, loadIdentityBridge } from './graph/identity'

const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]
/** Edge types whose target is asserted by a document WE hold. */
const OURS = new Set(['cites', 'made-under'])

const OUT_MD = path.join(__dirname, '../../docs/CORPUS_CITATION_GAPS.md')
const OUT_JSON = path.join(__dirname, '../../docs/corpus_citation_gaps.json')

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const MIN_CITES = Number(arg('min-cites') ?? 1)
const TOP = Number(arg('top') ?? 200)
/**
 * --self-test: run with the held-instrument set deliberately emptied. Every
 * instrument the graph refers to then looks absent, so the NEGATIVE control
 * (a held instrument must NOT appear) has to fire and the run has to exit non-zero.
 *
 * This exists because V37's whole premise is that a suite of checks which always
 * passed was measuring the wrong thing. A validation block that has never been seen
 * to fail is exactly that suite. Writes nothing.
 */
const SELF_TEST = process.argv.includes('--self-test')

/**
 * DOCTYPES WITH NO INGEST ROUTE, and the reason each has one.
 *
 * ⚠ Derived from what the corpus demonstrably HOLDS (`v37-doctype-scope.ts`: exactly
 * 15 doctypes have a non-zero held count), not from what looked plausible. A first
 * draft of this list asserted `mwa` was "superseded by anaw" — the corpus holds 22
 * `mwa` instruments and 1,446 sections, so that entry would have mislabelled real
 * coverage as out of scope. Calling something out-of-scope to make a number smaller
 * is the same failure as leaving it unexplained.
 *
 * `decision: false` means there IS a recorded reason. `decision: true` means the type
 * is genuinely absent and nobody has decided whether it should be — those print as
 * NEEDS A DECISION and are Charlie's call, not this script's.
 */
const NO_INGEST_ROUTE: Record<string, { why: string; decision: boolean }> = {
  ukla:  { why: 'Local Acts — private/local legislation, not general law', decision: false },
  gbla:  { why: 'Great Britain Local Acts (pre-1801) — local, and pre-Union', decision: false },
  gbppa: { why: 'GB Private and Personal Acts — private legislation', decision: false },
  apgb:  { why: 'Acts of the Parliament of Great Britain (1707–1800) — pre-Union', decision: false },
  aep:   { why: 'Acts of the English Parliament (pre-1707) — pre-Union', decision: false },
  aosp:  { why: 'Acts of the old Scottish Parliament (pre-1707) — pre-Union', decision: false },
  aip:   { why: 'Acts of the Irish Parliament (pre-1801) — pre-Union', decision: false },
  uksro: { why: 'UK Statutory Rules & Orders (pre-1948) — the SI series begins in 1948, where our uksi ingest starts', decision: false },
  nisro: { why: 'NI Statutory Rules & Orders (pre-1974) — predecessor series to nisr', decision: false },
  // ── these three are live coverage questions, not settled scope ──────────────
  apni:  { why: 'Acts of the Parliament of Northern Ireland (1921–1972) — FIFTY YEARS of NI primary legislation. The corpus holds nia (2000+) and nisi (Orders in Council) but nothing for this period. Verified present at source (HTTP 200). NO DECISION RECORDED', decision: true },
  ukcm:  { why: 'Church Measures — primary legislation passed by General Synod with the force of an Act. Verified present at source (HTTP 200), and ukcm/1969/2 alone carries 1,108 references. NO DECISION RECORDED', decision: true },
  ukci:  { why: 'Church Instruments — as ukcm. NO DECISION RECORDED', decision: true },
}

/**
 * Prefix aliases. `eud/1999/468` is a 404 at the source; `eudn/1999/468` is a live
 * document the corpus holds. `eud` is an alternate/older prefix for the EU decision
 * and regulation series, so every `eud` "gap" is the same class of false positive as
 * the regnal/calendar split — an identity mismatch, not an absence. Checked against
 * the source rather than assumed.
 */
// ⚠⚠ GRAPH 4B §1. The private PREFIX_ALIASES / identitiesFor() / buildAliasMap()
// that used to sit here are GONE. GRAPH 4A §6 named this file and
// extract-citation-edges.ts as the TWO copies of the same alias map that had to
// agree with no check that they agreed — the shape that let the regnal-year
// trap reach four separate code paths. The one resolver is graph/identity.ts.
//
// ⚠ One behaviour change, deliberate: the old map's single pass let the LAST
// calendar-to-regnal entry win, so 419 calendar ids that name TWO different
// regnal Acts each (41 Geo 3 and 42 Geo 3 are both 1801) silently resolved to
// one of them. The shared bridge REFUSES those and counts them.

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 1_800_000, query_timeout: 1_800_000,
  })

  const bridge = loadIdentityBridge()
  console.log(`[v37] identity bridge: ${bridge.stats.bridgedForms.toLocaleString()} bridged forms · ${bridge.stats.ambiguousForms.toLocaleString()} refused as ambiguous`)

  console.log('[v37] loading held gids…')
  const t0 = Date.now()
  const { rows: heldRows } = await pool.query(`
    SELECT DISTINCT split_part(id, ':', 2) AS gid
    FROM corpus_sections WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = SELF_TEST ? new Set<string>() : new Set<string>(heldRows.map(r => r.gid))
  console.log(`[v37] corpus holds text for ${held.size.toLocaleString()} instruments (${((Date.now() - t0) / 1000).toFixed(1)}s)` +
    (SELF_TEST ? '  ⚠ SELF-TEST: held set deliberately emptied' : ''))

  console.log('[v37] aggregating edge targets…')
  const { rows: targets } = await pool.query(`
    SELECT split_part(to_id, ':', 2) AS gid,
           count(*) FILTER (WHERE edge_type IN ('cites','made-under'))::int AS ours,
           count(*) FILTER (WHERE edge_type NOT IN ('cites','made-under'))::int AS external,
           count(DISTINCT split_part(from_id, ':', 2))::int AS citing_docs,
           (array_agg(DISTINCT edge_type))                  AS edge_types
    FROM legislation_edges
    GROUP BY 1`)
  console.log(`[v37] ${targets.length.toLocaleString()} distinct instruments referred to by the graph`)

  const { rows: actRows } = await pool.query(
    `SELECT gid, title, in_corpus, in_legislation_item FROM corpus_acts`)
  const acts = new Map(actRows.map(r => [r.gid as string, r]))

  interface Gap {
    gid: string; title: string | null; ours: number; external: number; citing_docs: number
    edge_types: string[]; classification: string; reason: string
  }
  const gaps: Gap[] = []
  let resolvedByAlias = 0, heldDirect = 0

  for (const t of targets) {
    const gid = t.gid as string
    if (!gid || !gid.includes('/')) continue           // CELEX / malformed — not a leg.gov.uk gid
    if (held.has(gid)) { heldDirect++; continue }
    const ids = identitiesFor(gid)
    if (ids.some(id => id !== gid && held.has(id))) { resolvedByAlias++; continue }

    const type = gid.split('/')[0]
    const act = ids.map(id => acts.get(id)).find(Boolean)
    const noRoute = NO_INGEST_ROUTE[type]
    let classification: string, reason: string
    if (noRoute) {
      classification = noRoute.decision ? 'needs-a-decision' : 'no-ingest-route'
      reason = noRoute.why
    } else if (act && act.in_legislation_item) {
      classification = 'known-no-text'
      reason = 'the instrument is known to us (metadata held) but no compiled section exists — V36\'s population'
    } else if (act) {
      classification = 'known-no-text'
      reason = 'present in corpus_acts but with no compiled section'
    } else {
      classification = 'never-seen'
      reason = 'no metadata row at all — never enumerated, never fetched'
    }
    gaps.push({
      gid, title: act?.title ?? null,
      ours: t.ours, external: t.external, citing_docs: t.citing_docs,
      edge_types: t.edge_types, classification, reason,
    })
  }

  gaps.sort((a, b) => (b.ours + b.external) - (a.ours + a.external) || b.citing_docs - a.citing_docs)
  const filtered = gaps.filter(g => g.ours + g.external >= MIN_CITES)

  // ── VALIDATION: can this check fail? ─────────────────────────────────────────
  // The brief asks for proof this would have surfaced the Companies Act. The corpus
  // is still pre-V36-recovery, so that proof is available NOW and not later.
  const ca = filtered.find(g => g.gid === 'ukpga/2006/46')
  const gdpr = filtered.find(g => g.gid === 'eur/2016/679')
  const heldControl = 'ukpga/2010/4'   // Corporation Tax Act 2010 — 2,817 sections held
  const falsePositive = filtered.find(g => g.gid === heldControl)
  console.log('\n── validation ──')
  console.log(`  POSITIVE  Companies Act 2006 (ukpga/2006/46) in the gap list : ` +
    `${ca ? `YES — rank ${filtered.indexOf(ca) + 1}, ${ca.ours + ca.external} references` : 'NO ⚠'}`)
  console.log(`  POSITIVE  UK GDPR (eur/2016/679) in the gap list             : ` +
    `${gdpr ? `YES — rank ${filtered.indexOf(gdpr) + 1}, ${gdpr.ours + gdpr.external} references` : 'no (it may carry no inbound edges)'}`)
  console.log(`  NEGATIVE  a HELD instrument (${heldControl}) must be absent  : ` +
    `${falsePositive ? 'PRESENT ⚠ FALSE POSITIVE' : 'absent — correct'}`)
  console.log(`  resolved by regnal/calendar alias (would have been false gaps): ${resolvedByAlias.toLocaleString()}`)
  const validationOk = !!ca && !falsePositive
  if (SELF_TEST) {
    const caught = !validationOk
    console.log(`\n[v37] SELF-TEST: validation ${caught ? 'CORRECTLY FAILED' : 'PASSED — which means it cannot fail, and is worthless'}`)
    await pool.end()
    process.exitCode = caught ? 0 : 1
    return   // writes nothing: a self-test must not overwrite the real report
  }

  const byClass = new Map<string, { n: number; refs: number }>()
  for (const g of filtered) {
    const e = byClass.get(g.classification) ?? { n: 0, refs: 0 }
    e.n++; e.refs += g.ours + g.external
    byClass.set(g.classification, e)
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const L: string[] = []
  L.push('# CORPUS CITATION GAPS')
  L.push('')
  L.push('*Generated by `scripts/ingest/v37-citation-gaps.ts` (V37 §1). Companion to')
  L.push('`CORPUS_REACHABILITY.md` (can a query reach it) and `CORPUS_COMPLETENESS.md` (does it')
  L.push('contain what it claims). This one asks the third question: **does the corpus point at')
  L.push('instruments it does not hold?***')
  L.push('')
  L.push('Every previous check was a closed loop — *did everything we queued succeed?* — and a perfect')
  L.push('score against a list missing 17,261 entries is indistinguishable from a perfect score against')
  L.push('a complete one. This check has an external referent: the documents\' own cross-references.')
  L.push('')
  L.push(`**${filtered.length.toLocaleString()} instruments are referred to by the graph and held nowhere in the corpus.**`)
  L.push(`Of ${targets.length.toLocaleString()} distinct instruments referred to, ${heldDirect.toLocaleString()} are held directly and`)
  L.push(`**${resolvedByAlias.toLocaleString()} resolve only through the regnal/calendar alias** — those would have been`)
  L.push('reported as gaps by a naive version of this check, and they are not gaps.')
  L.push('')
  L.push('## Provenance is split, because "our corpus refers to it" is not one thing')
  L.push('')
  L.push('| | edge types | what it means |')
  L.push('|---|---|---|')
  L.push('| **ours** | `cites`, `made-under` | extracted from the body and preamble of documents WE hold — the corpus pointing at its own gap |')
  L.push('| **external** | `amends`, `repeals`, `commences`, `modifies` | from TNA\'s bulk amendment and in-force datasets — evidence the instrument matters, but TNA\'s assertion, not our documents\' |')
  L.push('')
  L.push('## Classification — every gap has a reason, none are suppressed')
  L.push('')
  L.push('| classification | instruments | references | meaning |')
  L.push('|---|---:|---:|---|')
  const MEANING: Record<string, string> = {
    'no-ingest-route': 'a legitimate permanent state — we cite it and deliberately do not hold it, and the reason is recorded per doctype',
    'needs-a-decision': '⚠ **no ingest route AND no recorded decision** — Charlie\'s call, not this script\'s',
    'known-no-text': 'metadata held, no compiled section — recoverable, and V36\'s population',
    'never-seen': 'no metadata row at all — never enumerated, never fetched',
  }
  for (const [k, v] of [...byClass.entries()].sort((a, b) => b[1].n - a[1].n)) {
    L.push(`| \`${k}\` | ${v.n.toLocaleString()} | ${v.refs.toLocaleString()} | ${MEANING[k] ?? ''} |`)
  }
  L.push('')
  L.push('⚠ **`no-ingest-route` is a finding, not noise.** "We cite this and deliberately do not hold')
  L.push('it, for this reason" is a legitimate permanent state. What would not be acceptable is a gap')
  L.push('with no classification, which is why nothing here is filtered out silently.')
  L.push('')
  L.push('⚠⚠ **And `needs-a-decision` is the one to read.** These doctypes have no ingest route and no')
  L.push('recorded decision that they should not. Asserting they are out of scope would make the')
  L.push('headline number smaller and the report wrong — the same failure as leaving a gap')
  L.push('unexplained. Each was verified present at the source before being listed:')
  L.push('')
  for (const [t, v] of Object.entries(NO_INGEST_ROUTE).filter(([, v]) => v.decision)) {
    const n = filtered.filter(g => g.gid.split('/')[0] === t)
    // A doctype with no gaps is not a decision anyone needs to take. Listing it
    // anyway would pad this section with types the corpus is never asked for.
    if (n.length === 0) continue
    const refs = n.reduce((a, g) => a + g.ours + g.external, 0)
    L.push(`- **\`${t}\`** — ${n.length.toLocaleString()} instruments, ${refs.toLocaleString()} references. ${v.why}`)
  }
  L.push('')
  L.push('## Does this check work? The pre-V36 proof')
  L.push('')
  L.push('The brief asks for evidence that this would have surfaced the Companies Act 2006. The corpus')
  L.push('is still pre-V36-recovery, so the proof is available now rather than in hindsight:')
  L.push('')
  L.push(`- **POSITIVE** \`ukpga/2006/46\` Companies Act 2006 — ${ca ? `**in the list at rank ${filtered.indexOf(ca) + 1}**, ${ca.ours + ca.external} references (${ca.ours} from our own documents)` : '**NOT FOUND — the check does not do what it claims**'}`)
  L.push(`- **POSITIVE** \`eur/2016/679\` UK GDPR — ${gdpr ? `in the list at rank ${filtered.indexOf(gdpr) + 1}, ${gdpr.ours + gdpr.external} references` : 'not in the list; it carries no inbound edges in the graph, which is itself a finding about citation coverage rather than about the corpus'}`)
  L.push(`- **NEGATIVE CONTROL** \`${heldControl}\` (Corporation Tax Act 2010, 2,817 sections held) — ${falsePositive ? '**PRESENT — false positive, the check over-reports**' : 'correctly absent'}`)
  L.push('')
  L.push('A check that only reported positives would be untrustworthy: the negative control is what')
  L.push('says it is not simply listing everything.')
  L.push('')
  L.push(`## The ranked gap list (top ${Math.min(TOP, filtered.length)} of ${filtered.length.toLocaleString()})`)
  L.push('')
  L.push('Ranked by total references, so the queue prioritises itself: an instrument referred to 4,000')
  L.push('times and absent is a different order of problem from one referred to twice.')
  L.push('')
  L.push('| # | gid | title | ours | external | citing docs | classification |')
  L.push('|---:|---|---|---:|---:|---:|---|')
  filtered.slice(0, TOP).forEach((g, i) => {
    L.push(`| ${i + 1} | \`${g.gid}\` | ${(g.title ?? '—').slice(0, 70)} | ${g.ours.toLocaleString()} | ${g.external.toLocaleString()} | ${g.citing_docs.toLocaleString()} | ${g.classification} |`)
  })
  L.push('')

  fs.writeFileSync(OUT_MD, L.join('\n') + '\n')
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generated: new Date().toISOString(),
    referred_to: targets.length, held_direct: heldDirect, resolved_by_alias: resolvedByAlias,
    gaps: filtered.length,
    validation: { companies_act_found: !!ca, uk_gdpr_found: !!gdpr, false_positive_control: !!falsePositive, ok: validationOk },
    by_classification: Object.fromEntries(byClass),
    instruments: filtered,
  }, null, 1))

  console.log(`\n[v37] ${filtered.length.toLocaleString()} citation gaps → ${OUT_MD}`)
  for (const [k, v] of [...byClass.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(7)} instruments, ${v.refs.toLocaleString()} references`)
  }
  console.log('\n[v37] top 10 by references:')
  filtered.slice(0, 10).forEach((g, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${g.gid.padEnd(22)} ours=${String(g.ours).padStart(5)} ext=${String(g.external).padStart(6)}  ${(g.title ?? '(untitled)').slice(0, 52)}`))

  await pool.end()
  if (!validationOk) {
    console.error('\n[v37] ⚠ VALIDATION FAILED — do not trust this report until it is understood.')
    process.exitCode = 1
  }
}

main().catch(e => { console.error(e); process.exitCode = 1 })
