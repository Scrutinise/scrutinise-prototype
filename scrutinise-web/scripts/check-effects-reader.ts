// ─────────────────────────────────────────────────────────────────────────────
// check:effects — the effects reader and the statute_effects tool (26-U, BRIEF_GRAPH_6).
//
// ⚠⚠ EVERY CASE REPORTS WHAT IT COUNTED: the rows it EXAMINED and the assertions it MADE on them.
// A case that examined nothing FAILS — "zero counter-examples" and "zero rows read" print the same
// zero in a guard that does not say which, and only one of them is a pass.
//
// ⚠ THE LIVE CASES ARE COLD READS (CLAUDE.md §26): they take Acts this script did not create, call
// only what the product calls (`effectsFor`, the `statute_effects` tool), and compare against a
// SEPARATE plain-SQL read of the table written here, not against a second copy of the reader.
// This script writes nothing. Every query is a SELECT.
//
// Usage:  npm run check:effects
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import {
  effectsFor, effectsFreshnessCaveat, ALL_EDGE_TYPES, DEFAULT_EFFECT_TYPES,
  type EffectsResult, type EffectRow,
} from '../lib/lex/statutory-graph'
import { readEffect, originOf, EDGE_SOURCES, RULE_IDS, EFFECT_RULES, type ChangeKind } from '../lib/lex/effect-kinds'
import { describeEffects, describeEffectRow, effectsHeadline, NOT_TEXTUAL_WORDS } from '../lib/lex/effects-describe'
import { execute, toolByName, MODEL_TOOLS } from '../lib/lex/agent/tools'

// ── harness ─────────────────────────────────────────────────────────────────────

interface Outcome {
  /** ROWS read from the table. */
  examined: number
  /** Synthetic inputs fed in (strings, fixtures) — reported apart, never added to the row count. */
  inputs?: number
  asserted: number
  fail?: string
  /** Set ONLY for a case that genuinely has nothing to read (and says why). */
  notRun?: string
  note?: string
}
interface Case { name: string; run: () => Promise<Outcome> }
interface Control { name: string; /** returns the PROPERTY's truth under broken behaviour — must be false. */ propertyHolds: () => boolean | Promise<boolean> }

const CASES: Case[] = []
const CONTROLS: Control[] = []
const tc = (name: string, run: () => Promise<Outcome>) => CASES.push({ name, run })
const control = (name: string, propertyHolds: () => boolean | Promise<boolean>) => CONTROLS.push({ name, propertyHolds })

/** Accumulates assertions for one case and counts them. */
class A {
  asserted = 0
  examined = 0
  inputs = 0
  failures: string[] = []
  ok(label: string, cond: boolean, detail = '') {
    this.asserted++
    if (!cond) this.failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
  }
  read(n: number) { this.examined += n }
  /** For a case whose subject is a string or fixture it was handed, not a table row. */
  input(n: number) { this.inputs += n }
  done(note?: string): Outcome {
    // ⚠ A case that read nothing, or asserted nothing, is not a pass.
    if (this.examined === 0 && this.inputs === 0) return { examined: 0, inputs: 0, asserted: this.asserted, fail: 'examined 0 rows and 0 inputs — a check that read nothing proves nothing', note }
    if (this.asserted === 0) return { examined: this.examined, inputs: this.inputs, asserted: 0, fail: 'made 0 assertions', note }
    return { examined: this.examined, inputs: this.inputs, asserted: this.asserted, fail: this.failures.length ? this.failures.slice(0, 6).join(' | ') + (this.failures.length > 6 ? ` (+${this.failures.length - 6} more)` : '') : undefined, note }
  }
}

const sql = <T = any>(q: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(q, ...p)

// ── the five Acts (named in the brief's REPORT) ────────────────────────────────

const ACTS: Array<{ label: string; given: string; forms: string[] }> = [
  { label: 'Equality Act 2010', given: 'ukpga/2010/15', forms: ['ukpga/2010/15'] },
  { label: 'Human Rights Act 1998', given: 'ukpga/1998/42', forms: ['ukpga/1998/42'] },
  { label: 'Data Protection Act 2018', given: 'ukpga/2018/12', forms: ['ukpga/2018/12'] },
  { label: 'Companies Act 2006', given: 'ukpga/2006/46', forms: ['ukpga/2006/46'] },
  // ⚠ Pre-1963: the effects feed names it by regnal year and our citation extractor by calendar
  // year. The two forms are written out here, from a read of the table, so the check does not
  // depend on the identity bridge it is testing.
  { label: 'Offences against the Person Act 1861', given: 'ukpga/Vict/24-25/100', forms: ['ukpga/Vict/24-25/100', 'ukpga/1861/100'] },
]
const THREE = ['amends', 'repeals', 'modifies'] as const

async function directCounts(forms: string[], types: readonly string[]): Promise<Record<string, number>> {
  const r = await sql<{ edge_type: string; n: number }>(
    `SELECT edge_type, COUNT(*)::int AS n FROM legislation_edges
     WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = ANY($2::text[]) GROUP BY 1`, forms, types as string[])
  const out: Record<string, number> = {}
  for (const t of types) out[t] = 0
  for (const x of r) out[x.edge_type] = x.n
  return out
}

const fakeCtx = () => ({
  ideaId: 'check-effects', userId: 'check-effects', confirmed: false,
  turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: [] as string[] },
})

// ═══ A — THE CLASSIFIER, ON THE LIVE VOCABULARY ════════════════════════════════════════

type Vocab = Array<{ edge_type: string; sub_type: string; source: string; n: number }>
let vocabCache: Vocab | null = null
async function vocab(): Promise<Vocab> {
  if (!vocabCache) {
    vocabCache = await sql<Vocab[number]>(
      `SELECT edge_type, sub_type, source, COUNT(*)::int AS n FROM legislation_edges
       WHERE edge_type IN ('amends','repeals','modifies','commences') GROUP BY 1,2,3`)
  }
  return vocabCache
}

tc('A1 no distinct sub_type that is excluded / disapplied / applied / power-to is ever read as a textual change', async () => {
  const a = new A()
  const v = await vocab()
  a.read(v.reduce((s, x) => s + x.n, 0))
  // The independent test is the WORDING of the stored string, not the classifier's own rule ids.
  const nonTextualWording = /^(excluded|disapplied|applied|power to)\b/i
  let matched = 0
  for (const x of v) {
    if (!nonTextualWording.test(x.sub_type)) continue
    matched++
    const k = readEffect(x.edge_type, x.sub_type).kind
    a.ok(`“${x.sub_type}” (${x.edge_type})`, k !== 'textual', `read as ${k}`)
  }
  a.ok('the live vocabulary contains such strings to test', matched > 0, 'none found: the assertion would be vacuous')
  return a.done(`${v.length} distinct (type, sub_type, source) groups; ${matched} carry non-textual wording`)
})

tc('A2 nothing read as textual contains a non-textual word anywhere in it', async () => {
  const a = new A()
  const v = await vocab()
  a.read(v.reduce((s, x) => s + x.n, 0))
  const forbidden = /\b(excluded|disapplied|applied|power to|earlier (affecting|amending)|affecting provision|restricted|saved|superseded)\b/i
  let textual = 0
  for (const x of v) {
    if (x.edge_type === 'commences') continue
    if (readEffect(x.edge_type, x.sub_type).kind !== 'textual') continue
    textual++
    a.ok(`“${x.sub_type}” read as textual`, !forbidden.test(x.sub_type))
  }
  a.ok('some strings were read as textual (otherwise this proves nothing)', textual > 0)
  return a.done(`${textual} distinct strings read as textual`)
})

tc('A3 every row is read exactly once (kinds partition the rows) and commences is never textual', async () => {
  const a = new A()
  const v = await vocab()
  let total = 0
  const byKind: Record<ChangeKind, number> = { textual: 0, 'not-textual': 0, unclassified: 0 }
  for (const x of v) {
    const k = readEffect(x.edge_type, x.sub_type).kind
    byKind[k] += x.n
    total += x.n
    if (x.edge_type === 'commences') a.ok(`commences “${x.sub_type}”`, k === 'not-textual')
  }
  a.read(total)
  a.ok('textual + not-textual + unclassified = rows read', byKind.textual + byKind['not-textual'] + byKind.unclassified === total)
  return a.done(`of ${total} rows: ${byKind.textual} textual, ${byKind['not-textual']} not-textual, ${byKind.unclassified} unclassified`)
})

tc('A4 the unclassified share is stated per source, and held under a regression bound', async () => {
  const a = new A()
  const v = await vocab()
  const lines: string[] = []
  // ⚠ THE BOUNDS ARE MEASURED, NOT ASPIRATIONAL, AND THEY ARE A REGRESSION STOP, NOT A CLAIM OF
  // COMPLETENESS: they catch a rule edit that silently turns a large share of the table "unclassified".
  // Two known gaps are left unclassified ON PURPOSE and are reported rather than hidden in an average:
  //   · `modifies` — a large part of its vocabulary is bare abbreviations (am, rev, subst, addition,
  //     completion …) and 23,000-odd rows with NO recorded type. Reading any of them would be a guess.
  //   · the in-force dataset's act-level `repealedBy` — never inbound for a modern Act, meaning unverified.
  const bound: Record<string, number> = { amends: 5, repeals: 3, modifies: 55 }
  for (const t of ['amends', 'repeals', 'modifies']) {
    const rows = v.filter((x) => x.edge_type === t && x.source === 'tna-bulk-amendments')
    const n = rows.reduce((s, x) => s + x.n, 0)
    const un = rows.filter((x) => readEffect(t, x.sub_type).kind === 'unclassified').reduce((s, x) => s + x.n, 0)
    a.read(n)
    const pct = (un / n) * 100
    lines.push(`${t} ${un}/${n} (${pct.toFixed(1)}%)`)
    a.ok(`${t} (bulk amendments) unclassified share under ${bound[t]}%`, pct < bound[t], `${pct.toFixed(1)}%`)
  }
  // ⚠ AN EARLIER DRAFT ASSERTED THESE WERE ALL ONE STORED TYPE (`repealedBy`) — an inference from a
  // four-row sample, and the live vocabulary says otherwise: it is a family of act-level statuses
  // (revokedBy, repealedBy, supersededBy, determinedBy, … with territory and savings variants). The
  // assertion is now about what matters: none of them may be read as a TEXTUAL change by accident.
  const inforce = v.filter((x) => x.source === 'tna-inforce-dataset')
  const nIn = inforce.reduce((s, x) => s + x.n, 0)
  a.read(nIn)
  a.ok('there is an in-force group to test', inforce.length > 0)
  for (const x of inforce) a.ok(`in-force status “${x.sub_type}” is not read as a textual change`, readEffect(x.edge_type, x.sub_type).kind !== 'textual')
  const inKinds = inforce.reduce((m, x) => { const k = readEffect(x.edge_type, x.sub_type).kind; m[k] = (m[k] ?? 0) + x.n; return m }, {} as Record<string, number>)
  lines.push(`in-force dataset ${nIn} rows, ${inforce.length} distinct act-level statuses, read as ${JSON.stringify(inKinds)}`)
  return a.done(lines.join(' · '))
})

tc('A5 every not-textual rule has words for the screen', async () => {
  const a = new A()
  a.read(RULE_IDS.length)
  for (const id of RULE_IDS) {
    if (id === 'unrecognised' || id === 'empty' || id === 'mixed' || id.startsWith('textual')) continue
    a.ok(`rule ${id}`, !!NOT_TEXTUAL_WORDS[id], 'no entry in NOT_TEXTUAL_WORDS')
  }
  return a.done()
})

// ═══ B — COUNTS: THE READER AGAINST AN INDEPENDENT READ, FIVE ACTS ═════════════════════

const results = new Map<string, EffectsResult>()
async function four(label: string, given: string): Promise<EffectsResult> {
  const key = `${label}|four`
  if (!results.has(key)) results.set(key, await effectsFor(given, { edgeTypes: ['amends', 'repeals', 'modifies', 'commences'], limitPerType: 500 }))
  return results.get(key)!
}

for (const act of ACTS) {
  tc(`B ${act.label}: per-type counts equal an independent SQL count, and every partition sums to the total`, async () => {
    const a = new A()
    const r = await four(act.label, act.given)
    const direct = await directCounts(act.forms, ['amends', 'repeals', 'modifies', 'commences'])
    a.read(Object.values(direct).reduce((s, n) => s + n, 0))
    for (const c of r.perType) {
      a.ok(`${c.edgeType} total`, c.total === direct[c.edgeType], `reader ${c.total} vs sql ${direct[c.edgeType]}`)
      a.ok(`${c.edgeType} kinds sum to total`, c.byKind.textual + c.byKind['not-textual'] + c.byKind.unclassified === c.total)
      a.ok(`${c.edgeType} sources sum to total`, c.bySource.reduce((s, x) => s + x.rows, 0) === c.total)
      a.ok(`${c.edgeType} origins sum to total`, c.byOrigin.official + c.byOrigin.extracted + c.byOrigin.unrecognised === c.total)
      a.ok(`${c.edgeType} scope sums to total`, c.byScope.provision + c.byScope.actWide === c.total)
      a.ok(`${c.edgeType} rules sum to total`, Object.values(c.byRule).reduce((s, n) => s + n, 0) === c.total)
      a.ok(`${c.edgeType} returned = min(total, cap)`, c.returned === Math.min(c.total, 500))
    }
    a.ok('examined.rowsCounted equals the sql total', r.examined.rowsCounted === Object.values(direct).reduce((s, n) => s + n, 0))
    return a.done(`${act.label}: ${Object.entries(direct).map(([t, n]) => `${n} ${t}`).join(' / ')}`)
  })
}

tc('B* the headline is the shape the brief asks for, built from the Act’s own counts', async () => {
  const a = new A()
  const eq = await effectsFor('ukpga/2010/15')
  const direct = await directCounts(['ukpga/2010/15'], THREE)
  a.read(Object.values(direct).reduce((s, n) => s + n, 0))
  a.ok('requested types default to amends / repeals / modifies', eq.requestedTypes.join() === DEFAULT_EFFECT_TYPES.join())
  a.ok('headline', effectsHeadline(eq) === `Equality Act 2010: ${direct.amends} amends / ${direct.repeals} repeals / ${direct.modifies} modifies`, effectsHeadline(eq))
  return a.done(effectsHeadline(eq))
})

tc('B** vintage pin: the brief’s own numbers (Equality Act 705/90/16, Human Rights Act 35/11/42)', async () => {
  const a = new A()
  const eq = await effectsFor('ukpga/2010/15')
  const hra = await effectsFor('ukpga/1998/42')
  // The numbers belong to the 5 July 2026 load. If the table is refreshed they will legitimately move,
  // and a pin that fails then would be a false alarm — so that case is NOT RUN, and says so.
  if (!eq.freshness.newestRowAt?.startsWith('2026-07-05')) {
    return { examined: 0, asserted: 0, notRun: `table newest row is ${eq.freshness.newestRowAt}, not the 5 July 2026 load the brief's numbers describe` }
  }
  a.read(eq.examined.rowsCounted + hra.examined.rowsCounted)
  const t = (r: EffectsResult) => r.perType.map((c) => c.total).join('/')
  a.ok('Equality Act', t(eq) === '705/90/16', t(eq))
  a.ok('Human Rights Act', t(hra) === '35/11/42', t(hra))
  return a.done()
})

// ═══ C — sub_type SURVIVES, AND AN EXCLUDED / APPLIED-BY ROW IS NOT A TEXTUAL CHANGE ═══

tc('C1 every returned row carries the stored sub_type verbatim (same multiset as a plain read)', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await four(act.label, act.given)
    for (const t of ['amends', 'repeals', 'modifies', 'commences']) {
      const mine = r.rows.filter((x) => x.edgeType === t).map((x) => x.subType).sort()
      const plain = (await sql<{ sub_type: string }>(
        `SELECT sub_type FROM legislation_edges WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = $2
         ORDER BY from_id, sub_type LIMIT 500`, act.forms, t)).map((x) => x.sub_type).sort()
      a.read(plain.length)
      // The reader's ORDER BY and the plain read's are both from_id, sub_type, so with the same cap the
      // two sets must be identical — not merely "similar".
      a.ok(`${act.label} ${t}: ${plain.length} rows`, mine.length === plain.length && mine.every((s, i) => s === plain[i]))
    }
  }
  return a.done()
})

tc('C2 the empty sub_type is returned as empty and is NOT read as textual', async () => {
  const a = new A()
  // The subject is chosen by the DATA — the Act holding the most `modifies` rows with no recorded type —
  // not by what the check needs, and not fixed in advance: an earlier draft named the Companies Act
  // and its first 500 rows by id happened to contain none, which would have made this vacuous.
  const top = await sql<{ gid: string; n: number }>(
    `SELECT split_part(to_id, ':', 2) AS gid, COUNT(*)::int AS n FROM legislation_edges
     WHERE edge_type = 'modifies' AND sub_type = '' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1`)
  a.read(top[0]?.n ?? 0)
  a.ok('some Act holds modifies rows with no recorded type', !!top[0] && top[0].n > 0)
  if (!top[0]) return a.done()
  const r = await effectsFor(top[0].gid, { edgeTypes: ['modifies'], limitPerType: 500 })
  const c = r.perType[0]
  a.ok(`${top[0].gid}: the reader counts every empty-type row under the “empty” rule`, (c.byRule.empty ?? 0) === top[0].n, `${c.byRule.empty ?? 0} vs sql ${top[0].n}`)
  a.ok('none of them is counted as a textual change', c.byKind.unclassified >= top[0].n)
  const empties = r.rows.filter((x) => x.subType === '')
  for (const x of empties) {
    a.ok('empty sub_type comes back as the empty string', x.subType === '')
    a.ok('and reads unclassified', x.changeKind === 'unclassified')
    a.ok('and its sentence names the gap', /no effect type recorded|NOT CLASSIFIED/.test(describeEffectRow(x)))
  }
  return a.done(`${top[0].gid}: ${top[0].n} empty-type rows of ${c.total} modifies; ${empties.length} within the row cap`)
})

tc('C3 WORKED EXAMPLE — Human Rights Act s.3-style “excluded” rows and the Equality Act’s “applied by …” rows are not presented as textual changes', async () => {
  const a = new A()
  const hra = await effectsFor('ukpga/1998/42', { edgeTypes: ['amends'], limitPerType: 100 })
  const excluded = hra.rows.filter((x) => /^excluded/i.test(x.subType))
  a.read(hra.rows.length)
  a.ok('Human Rights Act amends contains “excluded” rows', excluded.length > 0, `${excluded.length}`)
  for (const x of excluded) {
    a.ok('excluded row is not-textual', x.changeKind === 'not-textual')
    a.ok('its sentence says so first, in capitals', /DOES NOT CHANGE THE WORDS/.test(describeEffectRow(x)))
    a.ok('and still names the recorded type', describeEffectRow(x).includes('“excluded”'))
  }
  const c = hra.perType[0]
  a.ok('the Act-level line says some amends rows do not change the words', describeEffects(hra).some((l) => /do NOT change the words/.test(l)))
  a.ok('textual < total for the Human Rights Act amends', c.byKind.textual < c.total, `${c.byKind.textual} of ${c.total}`)

  // ⚠ THE EQUALITY ACT's applied-by rows come from statutory instruments, which sort AFTER the 500-row
  // cap on the reader's ORDER BY — so the COUNT is asserted from the SQL total, and the rows only if
  // they are within the cap. Asserting on rows alone would be vacuous here.
  const eq = await effectsFor('ukpga/2010/15', { edgeTypes: ['amends'], limitPerType: 500 })
  const appliedBy = eq.rows.filter((x) => /^applied by/i.test(x.subType))
  const sqlApplied = (await sql<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM legislation_edges WHERE split_part(to_id, ':', 2) = 'ukpga/2010/15'
       AND edge_type = 'amends' AND lower(sub_type) LIKE 'applied%'`))[0].n
  a.read(eq.rows.length + sqlApplied)
  a.ok('Equality Act amends contains “applied …” rows (counted in SQL)', sqlApplied > 0, `${sqlApplied}`)
  a.ok('the reader counts every one of them as not-textual', (eq.perType[0].byRule.application ?? 0) >= sqlApplied, `rule application ${eq.perType[0].byRule.application} vs sql ${sqlApplied}`)
  a.ok('so textual + not-textual + unclassified still = total, with the applied rows NOT in textual', eq.perType[0].byKind.textual <= eq.perType[0].total - sqlApplied)
  for (const x of appliedBy) a.ok('applied-by row is not-textual', x.changeKind === 'not-textual')
  return a.done(`HRA: ${excluded.length} excluded of ${c.total} amends (${c.byKind.textual} change the words); EqA: ${sqlApplied} applied of ${eq.perType[0].total} amends, ${appliedBy.length} within the row cap`)
})

// ═══ D — THE TWO SOURCES STAY DISTINGUISHABLE, AND A QUOTE IS NEVER INVENTED ═══════════

tc('D1 official rows never carry a quote; a quote is only ever our extraction of a made-under row', async () => {
  const a = new A()
  let withQuote = 0, official = 0, cites = 0
  for (const act of ACTS) {
    const r = await effectsFor(act.given, { edgeTypes: [...ALL_EDGE_TYPES], limitPerType: 200 })
    a.read(r.rows.length)
    for (const x of r.rows) {
      if (x.origin === 'official') { official++; a.ok(`${act.label}: official ${x.edgeType} row has no quote`, x.quote === null) }
      if (x.quote) {
        withQuote++
        a.ok('a quote implies an extracted made-under row', x.origin === 'extracted' && x.edgeType === 'made-under')
      }
      if (x.edgeType === 'cites') { cites++; a.ok('a cites row in this table keeps no words', x.quote === null) }
    }
  }
  a.ok('some official rows were examined', official > 0)
  a.ok('some quoted rows were examined (else the "implies" test is vacuous)', withQuote > 0, `${withQuote}`)
  a.ok('some cites rows were examined', cites > 0, `${cites}`)
  return a.done(`${official} official rows (0 quotes), ${withQuote} quoted, ${cites} cites rows (0 quotes)`)
})

tc('D2 a quote is the stored words, unaltered', async () => {
  const a = new A()
  const r = await effectsFor('ukpga/2010/15', { edgeTypes: ['made-under'], limitPerType: 200 })
  const plain = await sql<{ detail: string }>(
    `SELECT detail FROM legislation_edges WHERE split_part(to_id, ':', 2) = 'ukpga/2010/15' AND edge_type = 'made-under'
     ORDER BY from_id, sub_type LIMIT 200`)
  a.read(plain.length)
  a.ok('same number of rows', plain.length === r.rows.length, `${plain.length} vs ${r.rows.length}`)
  r.rows.forEach((x, i) => a.ok(`row ${i + 1} quote`, (x.quote?.text ?? null) === (plain[i].detail && plain[i].detail.trim() ? plain[i].detail : null)))
  return a.done()
})

tc('D3 every row names its origin in words, and every stored source is a known one', async () => {
  const a = new A()
  let unknown = 0
  for (const act of ACTS) {
    const r = await effectsFor(act.given, { edgeTypes: [...ALL_EDGE_TYPES], limitPerType: 100 })
    a.read(r.rows.length)
    for (const x of r.rows) {
      const line = describeEffectRow(x)
      a.ok('origin in words', /official record|our own extraction|source we do not recognise/.test(line))
      a.ok('source is known to the build', originOf(x.source) !== null, x.source)
      a.ok('origin matches the source table', x.origin === (EDGE_SOURCES[x.source]?.origin ?? null))
      if (originOf(x.source) === null) unknown++
    }
  }
  return a.done(`${unknown} rows from an unrecognised source`)
})

tc('D4 the per-type split shows both origins where an Act has both (made-under and cites are ours)', async () => {
  const a = new A()
  const r = await effectsFor('ukpga/2010/15', { edgeTypes: ['amends', 'made-under', 'cites'] })
  a.read(r.examined.rowsCounted)
  const [am, mu, ci] = r.perType
  a.ok('amends are entirely official', am.byOrigin.official === am.total && am.byOrigin.extracted === 0)
  a.ok('made-under is entirely our extraction', mu.total > 0 && mu.byOrigin.extracted === mu.total && mu.byOrigin.official === 0, `${mu.total}`)
  a.ok('cites is entirely our extraction', ci.total > 0 && ci.byOrigin.extracted === ci.total, `${ci.total}`)
  a.ok('the prose names each origin', describeEffects(r).some((l) => /our own extraction/.test(l)) && describeEffects(r).some((l) => /official record/.test(l)))
  return a.done()
})

// ═══ E — THE WHOLE-CORPUS TOTAL IS NEVER RETURNED OR DISPLAYED ═════════════════════════

const KEYS = ['coverage', 'direction', 'examined', 'freshness', 'perType', 'requestedTypes', 'resolution', 'rows', 'target']
let tableTotal: number | null = null
async function total(): Promise<number> {
  if (tableTotal === null) tableTotal = (await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM legislation_edges`))[0].n
  return tableTotal
}
function mentions(text: string, n: number): boolean {
  return new RegExp(`(?<![\\d,.])(${n}|${n.toLocaleString('en-GB')})(?![\\d])`).test(text)
}

tc('E1 the table’s total never appears in a result, a headline, the prose, or the tool’s data', async () => {
  const a = new A()
  const N = await total()
  a.read(N)
  let tokens = 0
  for (const act of ACTS) {
    const r = await effectsFor(act.given, { edgeTypes: [...ALL_EDGE_TYPES], limitPerType: 50 })
    const blob = JSON.stringify(r) + '\n' + describeEffects(r).join('\n') + '\n' + r.rows.map(describeEffectRow).join('\n')
    tokens += (blob.match(/\d+/g) ?? []).length
    a.ok(`${act.label}: no occurrence of ${N}`, !mentions(blob, N))
    a.ok(`${act.label}: result keys are the closed set`, Object.keys(r).sort().join() === KEYS.join())
    for (const c of r.perType) a.ok(`${act.label} ${c.edgeType}: total ≤ the Act’s own rows`, c.total <= r.examined.rowsCounted)
  }
  const tool = await execute(toolByName('statute_effects')!, fakeCtx() as any, { act: 'ukpga/2010/15', edge_types: [...ALL_EDGE_TYPES] })
  const tb = JSON.stringify(tool)
  tokens += (tb.match(/\d+/g) ?? []).length
  a.ok('the tool’s output never mentions the table total', !mentions(tb, N))
  return a.done(`table holds ${N} rows (read once, to know what must NOT appear); ${tokens} numeric tokens scanned in output`)
})

control('a reader that reported COUNT(*) of the table would be caught (the number appears in its output)', async () => {
  const N = await total()
  const naive = `Equality Act 2010: 705 amends — out of ${N.toLocaleString('en-GB')} links held`
  return !mentions(naive, N)
})

// ═══ F — FRESHNESS ═════════════════════════════════════════════════════════════════════

tc('F1 freshness is the Act’s own newest extracted_at, aged at call time, with a caveat built from it', async () => {
  const a = new A()
  for (const act of ACTS) {
    const r = await effectsFor(act.given, { edgeTypes: ['amends', 'repeals', 'modifies'] })
    const plain = await sql<{ newest: Date; n: number }>(
      `SELECT MAX(extracted_at) AS newest, COUNT(*)::int AS n FROM legislation_edges
       WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type IN ('amends','repeals','modifies')`, act.forms)
    a.read(plain[0].n)
    a.ok(`${act.label} newest`, r.freshness.newestRowAt === new Date(plain[0].newest).toISOString(), `${r.freshness.newestRowAt}`)
    a.ok(`${act.label} caveat contains the date and the age`, r.freshness.caveat.includes((r.freshness.newestRowAt ?? '').slice(0, 10)) && r.freshness.caveat.includes(`${r.freshness.ageDays} days`))
    a.ok(`${act.label} stale flag follows the threshold`, r.freshness.stale === ((r.freshness.ageDays ?? 0) > 30))
    a.ok(`${act.label} the last line of the prose is the freshness caveat`, describeEffects(r).slice(-1)[0] === r.freshness.caveat)
  }
  return a.done()
})

tc('F2 the caveat says what a stale copy cannot show, and a fresh one does not claim to be live', async () => {
  const a = new A()
  const stale = effectsFreshnessCaveat('2026-07-05T16:52:32.287Z', 98, true)
  const fresh = effectsFreshnessCaveat('2026-07-05T16:52:32.287Z', 3, false)
  const none = effectsFreshnessCaveat(null, null, true)
  a.input(3)
  a.ok('stale names legislation.gov.uk and what is missing', /since then/.test(stale) && /legislation\.gov\.uk/.test(stale))
  a.ok('fresh still says it is a stored copy', /stored copy/.test(fresh) && /not live/.test(fresh))
  a.ok('undated refuses to call itself current', /do not describe it as current/.test(none))
  return a.done('3 synthetic ages; reads no table rows')
})

// ═══ G — PROVISIONS ════════════════════════════════════════════════════════════════════

tc('G1 a provision matches itself, its subsections and lettered insertions — never a longer number — and act-wide rows are kept, marked', async () => {
  const a = new A()
  const r = await effectsFor('ukpga/2010/15', { provision: 'section-149', edgeTypes: ['amends', 'repeals', 'modifies'], limitPerType: 500 })
  const plain = await sql<{ edge_type: string; prov: string }>(
    `SELECT edge_type, split_part(to_id, ':', 3) AS prov FROM legislation_edges
     WHERE split_part(to_id, ':', 2) = 'ukpga/2010/15' AND edge_type IN ('amends','repeals','modifies')
       AND (lower(split_part(to_id, ':', 3)) = 'section-149' OR lower(split_part(to_id, ':', 3)) ~ '^section-149([^0-9].*)?$'
            OR split_part(to_id, ':', 3) = '')`)
  a.read(plain.length)
  const want: Record<string, number> = { amends: 0, repeals: 0, modifies: 0 }
  for (const x of plain) want[x.edge_type]++
  for (const c of r.perType) a.ok(`${c.edgeType} count for section-149 (incl. act-wide)`, c.total === want[c.edgeType], `${c.total} vs ${want[c.edgeType]}`)
  for (const x of r.rows) {
    a.ok('every row is section-149…, or marked act-wide', x.scope === 'act-wide' ? x.thisEndProvision === null : /^section-149([^0-9].*)?$/i.test(x.thisEndProvision ?? ''))
    a.ok('never section-1490', !/^section-149\d/i.test(x.thisEndProvision ?? ''))
  }
  const whole = await effectsFor('ukpga/2010/15', { edgeTypes: ['amends'] })
  a.ok('naming a provision narrows the answer', r.perType[0].total < whole.perType[0].total, `${r.perType[0].total} < ${whole.perType[0].total}`)
  // The headline must not fold act-wide rows into a number that reads as "about section 149".
  const head = effectsHeadline(r)
  const actWide = r.perType.reduce((s, c) => s + c.byScope.actWide, 0)
  a.ok('the headline separates rows on the provision from rows on the whole Act', actWide === 0 || /on the whole Act/.test(head), head)
  a.ok('the headline’s first number is the provision-level count, not the total', head.includes(`: ${r.perType[0].byScope.provision}`), head)
  return a.done(`s.149: ${r.perType.map((c) => `${c.total} ${c.edgeType}`).join(' / ')} (${r.perType.reduce((s, c) => s + c.byScope.actWide, 0)} act-wide)`)
})

tc('G2 a provision that is not an id is REFUSED, not stripped or run', async () => {
  const a = new A()
  a.input(3)
  for (const bad of ['section-149; DROP TABLE x', 'section-1(', '^.*$']) {
    let threw = false
    try { await effectsFor('ukpga/2010/15', { provision: bad }) } catch { threw = true }
    a.ok(`“${bad}” throws`, threw)
  }
  return a.done('3 hostile provision strings; each must throw before any query (reads no table rows)')
})

// ═══ H — IDENTITY: REGNAL FORMS, A REFUSAL, AND A NAME THAT DOES NOT RESOLVE ═══════════

tc('H1 a pre-1963 Act gives one answer under every form of its id, including a URL', async () => {
  const a = new A()
  const forms = ['ukpga/Vict/24-25/100', 'ukpga/1861/100', 'https://www.legislation.gov.uk/ukpga/Vict/24-25/100/']
  const rs = await Promise.all(forms.map((f) => effectsFor(f, { edgeTypes: [...ALL_EDGE_TYPES] })))
  const sig = (r: EffectsResult) => r.perType.map((c) => `${c.edgeType}:${c.total}`).join(',')
  a.read(rs.reduce((s, r) => s + r.examined.rowsCounted, 0))
  a.ok('three forms, one answer', sig(rs[0]) === sig(rs[1]) && sig(rs[1]) === sig(rs[2]), rs.map(sig).join(' | '))
  a.ok('the calendar form was bridged and says so', rs[1].resolution.bridge === 'bridged' && !!rs[1].resolution.note)
  a.ok('the cites rows recorded under the calendar form are included', (rs[0].perType.find((c) => c.edgeType === 'cites')?.total ?? 0) > 0)
  a.ok('all forms name the same canonical Act', rs.every((r) => r.target.gid === 'ukpga/Vict/24-25/100'), rs.map((r) => r.target.gid).join(' '))
  return a.done(sig(rs[0]))
})

tc('H2 an Act with no title held says null — never an invented title', async () => {
  const a = new A()
  const r = await effectsFor('ukpga/Vict/24-25/100', { edgeTypes: ['amends'] })
  const held = await sql<{ title: string }>(`SELECT title FROM corpus_acts WHERE gid = ANY($1::text[]) AND title IS NOT NULL`, ['ukpga/Vict/24-25/100', 'ukpga/1861/100'])
  a.read(held.length + r.examined.rowsCounted)
  a.ok('title is null exactly when corpus_acts holds none', (held.length === 0) === (r.target.title === null), `held ${held.length}, reader ${r.target.title}`)
  a.ok('the headline falls back to the id', effectsHeadline(r).startsWith(held[0]?.title ?? 'ukpga/Vict/24-25/100'))
  return a.done()
})

tc('H3 a form that fits more than one Act is a REFUSAL, stated as one, and returns no rows', async () => {
  const a = new A()
  const refused = await sql<{ form: string }>(`SELECT form FROM legislation_identity WHERE basis = 'ambiguous-refused' ORDER BY form LIMIT 1`)
  if (!refused.length) return { examined: 0, asserted: 0, notRun: 'legislation_identity holds no ambiguous-refused form to test against' }
  a.read(refused.length)
  const r = await effectsFor(refused[0].form)
  a.ok('bridge says ambiguous-refused', r.resolution.bridge === 'ambiguous-refused')
  a.ok('no rows', r.rows.length === 0 && r.examined.rowsCounted === 0)
  a.ok('the headline says not answered', /not answered/.test(effectsHeadline(r)))
  a.ok('the prose says refusal, not absence', describeEffects(r).some((l) => /refusal, not an absence/.test(l)))
  a.ok('and does NOT print per-type zero lines that read as "nothing affects it"', !describeEffects(r).some((l) => /found no .* rows recorded/.test(l)))
  return a.done(`form “${refused[0].form}”`)
})

tc('H4 a name that cannot resolve returns "no match" — and a lookup that FAILS is a different thing (it throws / ok:false)', async () => {
  const a = new A()
  const none = await effectsFor('ukpga/9999/1')
  a.input(1)
  a.ok('no match: zero rows, zero counted', none.rows.length === 0 && none.examined.rowsCounted === 0)
  a.ok('no match: every per-type total is a stated zero', none.perType.length === 3 && none.perType.every((c) => c.total === 0))
  a.ok('no match: the prose says the lookup ran', describeEffects(none).some((l) => /the lookup ran and found no/.test(l)))
  a.ok('no match: an unresolved Act is not mistaken for a refusal', none.resolution.bridge !== 'ambiguous-refused')
  let threw = ''
  try { await effectsFor('ukpga/2010/15', { edgeTypes: ['amends-all' as any] }) } catch (e) { threw = String(e) }
  a.ok('a malformed request THROWS (a lookup failure is never an empty result)', /not an edge type/.test(threw), threw)
  const tool = await execute(toolByName('statute_effects')!, fakeCtx() as any, { act: 'ukpga/2010/15', provision: 'section-1(' })
  a.ok('the tool reports a failed lookup as ok:false with the reason', tool.ok === false && /did not complete/.test(tool.error ?? ''), JSON.stringify(tool).slice(0, 120))
  const tool0 = await execute(toolByName('statute_effects')!, fakeCtx() as any, { act: 'ukpga/9999/1' })
  a.ok('the tool reports no match as ok:true with a note', tool0.ok === true && /found no rows/.test(String((tool0.data as any)?.note)))
  return a.done('1 unresolvable id (0 rows by design) and 2 malformed requests; asserts the outcomes differ')
})

// ═══ I — THE TOOL ══════════════════════════════════════════════════════════════════════

tc('I1 the tool is registered read-only, takes no idea or user id, and its rows keep sub_type, kind and origin', async () => {
  const a = new A()
  const def = toolByName('statute_effects')
  a.ok('registered for the model', !!def && MODEL_TOOLS.some((t) => t.name === 'statute_effects'))
  a.ok('read-only category (available in the question-only chat)', def?.category === 'search' && def?.tier === 'free')
  const keys = Object.keys((def!.schema as any).shape)
  a.ok('no ideaId / userId argument', !keys.some((k) => /^(idea|user|owner)(id)?$/i.test(k)), keys.join())
  const res = await execute(def!, fakeCtx() as any, { act: 'ukpga/1998/42', limit_per_type: 50 })
  a.ok('ok', res.ok === true)
  const d: any = res.data
  a.read(d.rows.length)
  for (const r of d.rows) {
    a.ok('row has sub_type key', 'sub_type' in r)
    a.ok('row says whether it changes the words', ['textual', 'not-textual', 'unclassified'].includes(r.changes_the_words))
    a.ok('row names its origin', r.origin === 'official' || r.origin === 'extracted' || /^unrecognised source/.test(r.origin))
    if (r.changes_the_words !== 'textual') a.ok('a non-textual row carries its reason', !!r.reading)
  }
  a.ok('the freshness sentence is returned', typeof d.freshness === 'string' && /stored copy/.test(d.freshness))
  a.ok('the rules are returned to the model', Array.isArray(d.rules) && d.rules.length >= 3)
  const eq = await effectsFor('ukpga/1998/42')
  a.ok('per_type totals equal the reader’s', d.per_type.every((p: any, i: number) => p.total === eq.perType[i].total))
  a.ok('per_type splits the words-changed from not', d.per_type.every((p: any) => p.change_the_words + p.do_not_change_the_words + p.not_classified === p.total))
  return a.done()
})

tc('I2 quotes leave the tool only in the fenced untrusted channel, one per quoted row, never in data', async () => {
  const a = new A()
  const res = await execute(toolByName('statute_effects')!, fakeCtx() as any, { act: 'ukpga/2010/15', edge_types: ['made-under', 'amends'], limit_per_type: 20 })
  const d: any = res.data
  a.read(d.rows.length)
  const quoted = d.rows.filter((r: any) => r.has_quote)
  a.ok('some rows are quoted', quoted.length > 0)
  a.ok('every quoted row is extracted', quoted.every((r: any) => r.origin === 'extracted'))
  a.ok('official rows never claim a quote', d.rows.filter((r: any) => r.origin === 'official').every((r: any) => !r.has_quote))
  a.ok('the quote text is in `untrusted`, fenced', typeof res.untrusted === 'string' && res.untrusted.includes('<untrusted_content'))
  a.ok('one untrusted line per quoted row', (res.untrusted!.match(/\[row \d+\]/g) ?? []).length === quoted.length, `${(res.untrusted!.match(/\[row \d+\]/g) ?? []).length} vs ${quoted.length}`)
  a.ok('the quote text is NOT in the structured data', !JSON.stringify(d).includes('in exercise of the powers'))
  const none = await execute(toolByName('statute_effects')!, fakeCtx() as any, { act: 'ukpga/2010/15', edge_types: ['amends'] })
  a.ok('no quoted rows → no untrusted channel', none.untrusted === undefined)
  return a.done()
})

// ═══ CONTROLS — each must show the property FAILING under broken behaviour ═════════════

control('collapsing sub_type into the type (every amends row = textual) would present HRA “excluded” rows as textual', async () => {
  const hra = await effectsFor('ukpga/1998/42', { edgeTypes: ['amends'] })
  const collapsed = hra.rows.map((x) => ({ ...x, changeKind: 'textual' as ChangeKind }))
  return collapsed.filter((x) => /^excluded/i.test(x.subType)).every((x) => x.changeKind === 'not-textual')
})
control('a mapper that stamps every source “official” would give a made-under row an official origin AND a quote', async () => {
  const r = await effectsFor('ukpga/2010/15', { edgeTypes: ['made-under'], limitPerType: 5 })
  const broken: EffectRow[] = r.rows.map((x) => ({ ...x, origin: 'official' as const }))
  return broken.every((x) => x.origin !== 'official' || x.quote === null)
})
control('counting rows.length instead of the SQL total would report the cap, not the Act', async () => {
  const eq = await effectsFor('ukpga/2010/15', { edgeTypes: ['amends'], limitPerType: 20 })
  return eq.rows.length === eq.perType[0].total
})
control('a default arm that read an empty sub_type as textual would lose the 23,000-row unknown', () =>
  readEffect('modifies', '').kind === 'textual')
control('MUTATION: the REAL rule table with the textual rules moved first reads live “earlier amending provision” rows as textual', async () => {
  // The real rules, reordered — not a stand-in. The property is the one A2 asserts: nothing read as
  // textual contains a non-textual word. Under this mutation it must fail on the live vocabulary.
  const mutated = [...EFFECT_RULES].sort((x, y) => (x.kind === 'textual' ? 0 : 1) - (y.kind === 'textual' ? 0 : 1))
  const read = (s: string) => mutated.find((r) => r.re.test(s.toLowerCase()))?.kind ?? 'unclassified'
  const v = (await vocab()).filter((x) => x.edge_type !== 'commences')
  const bad = v.filter((x) => read(x.sub_type) === 'textual' && /\b(earlier (affecting|amending)|affecting provision)\b/i.test(x.sub_type))
  return bad.length === 0
})
control('the harness itself: a case that examined 0 rows must FAIL', () => new A().done().fail === undefined)
control('the harness itself: a case that made no assertion must FAIL', () => { const a = new A(); a.read(5); return a.done().fail === undefined })

// ── run ──────────────────────────────────────────────────────────────────────────────

;(async () => {
  let pass = 0, failN = 0, notRun = 0, examined = 0, inputs = 0, asserted = 0
  console.log('\ncheck:effects — the effects reader and statute_effects (26-U)\n')
  console.log('  ' + 'case'.padEnd(110) + 'rows read'.padStart(12) + 'inputs'.padStart(8) + 'asserted'.padStart(10))
  for (const c of CASES) {
    let o: Outcome
    try { o = await c.run() } catch (e) { o = { examined: 0, asserted: 0, fail: `threw: ${e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' / ') : String(e)}` } }
    examined += o.examined; inputs += o.inputs ?? 0; asserted += o.asserted
    const tag = o.notRun ? 'NOT RUN' : o.fail ? '✗ FAIL ' : '✓ pass '
    if (o.notRun) notRun++; else if (o.fail) failN++; else pass++
    console.log(`  ${tag} ${c.name.slice(0, 102).padEnd(102)}${String(o.examined).padStart(12)}${String(o.inputs ?? 0).padStart(8)}${String(o.asserted).padStart(10)}`)
    if (o.note) console.log(`           · ${o.note}`)
    if (o.notRun) console.log(`           · NOT RUN: ${o.notRun}`)
    if (o.fail) console.log(`           ✗ ${o.fail}`)
  }
  console.log('\n  controls (each must show the property FAILING under the broken behaviour):')
  let fired = 0
  for (const k of CONTROLS) {
    let holds: boolean
    try { holds = await k.propertyHolds() } catch (e) { holds = true; console.log(`    ✗ control threw: ${e}`) }
    if (!holds) fired++
    console.log(`    ${holds ? '✗ DEAD ' : '✓ fired'}  ${k.name.slice(0, 150)}`)
  }
  await prisma.$disconnect()
  const dead = CONTROLS.length - fired
  console.log(`\ncheck:effects — ${CASES.length} cases: ${pass} passed, ${failN} failed, ${notRun} not run · ${asserted} assertions over ${examined} rows read + ${inputs} synthetic inputs · controls ${fired}/${CONTROLS.length} fired, ${dead} dead\n`)
  if (failN || dead) process.exit(1)
})().catch((e) => { console.error(e); process.exit(1) })
