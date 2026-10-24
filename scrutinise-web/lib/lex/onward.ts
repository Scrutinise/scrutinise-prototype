// ─────────────────────────────────────────────────────────────────────────────
// THE ONWARD READER — `onwardFrom()` (GRAPH 8, docs/BRIEF_GRAPH_8_ONWARD.md).
//
// One step, typed, walkable: everything recorded as pointing AT a provision or Act, each row with
// its kind and its strength. Read-only, beside `effectsFor()`, no schema change.
//
// ⚠⚠ FOUR THINGS IT REFUSES TO DO:
//   1. RECURSE. Lex walks it. A reader that recursed would hide the branching factor from its
//      caller, which is the one number the caller most needs.
//   2. MERGE STRENGTHS. One row, one kind, one strength (`STRENGTH_OF`), never a combined count.
//   3. RETURN AN EMPTY LIST FOR A QUESTION IT CANNOT ANSWER. A Part, a Chapter, or a year form
//      that fits two Acts comes back `unaddressable` with its reason.
//   4. CAP SILENTLY. `truncated` gives counted and returned for every kind, capped or not.
//
// Direction: INBOUND only — what points at the target. For `made-under` that is the instruments
// made under it; for an official effect, the provisions that operate on it; for `cites`, the
// provisions that mention it.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { readEffect, originOf, type ChangeKind, type EdgeOrigin } from '@/lib/lex/effect-kinds'
import {
  gidCandidates, provisionPredicate, resolveActForms, effectsLoadDate, EFFECTS_TABLE_NAME, CITATION_TABLE,
  type EffectsResult,
} from '@/lib/lex/statutory-graph'
import {
  ONWARD_KINDS, ALL_ONWARD_KINDS, CASELAW_KIND, STRENGTH_ORDER, strengthOf, parseTarget, isUnaddressableRef,
  legPath, provisionMatches, citingTextStateOf, onwardCaveat,
  type OnwardKind, type Strength, type CitingTextState,
} from '@/lib/lex/onward-pure'

export interface OneStep {
  /** The node at the other end, in legislation.gov.uk form, bridged — pass it back to walk on. */
  provision: string
  act: string
  actTitle: string | null
  kind: OnwardKind
  strength: Strength
  /** Verbatim `sub_type` of an official row; '' for our own extraction. */
  subType: string
  changeKind: ChangeKind | null
  changeReason: string | null
  /** The part of the TARGET this row bears on; null = the target Act as a whole. */
  thisEndProvision: string | null
  /** ⚠ `act-wide`: recorded against the whole Act, so it bears on the provision asked about only as part of it. */
  scope: 'provision' | 'act-wide'
  /**
   * The stored words from `citation_edge`, VERBATIM — render with `citingTextForDisplay`. For `cites` and case law, the
   * window before the reference; for `made-under`, the instrument's enacting words. Null on an official row: it has none.
   */
  citingText: string | null
  citingTextState: CitingTextState | null
  /** Further stored windows for the same row (one provision can mention the target more than once). */
  citingTextOthers: number
  /** `cites` / `made-under`: the target provision as parsed from the stored words, where any was. */
  citedProvision: string | null
  origin: EdgeOrigin | null
  source: string
}

export interface OnwardKindCount {
  kind: OnwardKind
  strength: Strength
  /** TRUE rows for this kind, counted before the cap. */
  counted: number
  returned: number
  /** Distinct instruments at the other end — the branching factor for this kind at this step. */
  instruments: number
  /**
   * ⚠ Of the counted rows, how many bear on the provision asked about and how many only on the Act as a whole.
   * On a whole-Act target every row is `provision` or `actWide` by its own record. On CRaG s.20 the eleven
   * made-under rows are three that name s.20 and eight that name no section, and a headline of "eleven
   * made under s.20" would be false. This split is shown wherever the count is.
   */
  scope: { provision: number; actWide: number }
  /** Official effects only: how many of the counted rows change the words (GRAPH 6's split). */
  split: { total: number; changeWords: number; doNot: number; unclassified: number } | null
  /** `made-under` / `cites` / case law: the three text states across the counted rows. */
  citingText: { held: number; noneStored: number; possiblyTruncated: number } | null
}

export interface OnwardResult {
  target: { given: string; gid: string; provision: string | null; title: string | null }
  resolution: EffectsResult['resolution'] | null
  rows: OneStep[]
  unaddressable: { code: 'part-or-chapter' | 'ambiguous-form' | 'not-an-id'; reason: string } | null
  /** ⚠ Every requested kind, capped or not — a zero is a stated zero. */
  truncated: Array<{ kind: OnwardKind; counted: number; returned: number }>
  perKind: OnwardKindCount[]
  /** Rows counted and deliberately not returned, with why. */
  notWalked: Array<{ kind: OnwardKind; rows: number; why: string }>
  /** Distinct nodes to walk next, strongest kind first. */
  next: Array<{ node: string; kinds: OnwardKind[]; strength: Strength }>
  freshness: { loadDate: string | null; ageDays: number | null; basis: string; depth: number; caveat: string }
  /** ⚠ What was counted: rows read to make the counts, and rows handed back. */
  examined: { rowsCounted: number; rowsReturned: number }
}

export const FRESHNESS_BASIS =
  'the newest load time of the stored relationships table (official effects and our own extractions) — '
  + 'the date we loaded the record, not the date the record is current to'

const isEdgeKind = (k: OnwardKind) => k !== CASELAW_KIND

export async function onwardFrom(
  target: string,
  opts: { provision?: string | null; kinds?: readonly OnwardKind[]; limit?: number; depth?: number } = {},
): Promise<OnwardResult> {
  const kinds = [...new Set(opts.kinds?.length ? opts.kinds : ONWARD_KINDS)]
  for (const k of kinds) if (!ALL_ONWARD_KINDS.includes(k)) throw new Error(`"${k}" is not a kind this reader knows (${ALL_ONWARD_KINDS.join(', ')})`)
  kinds.sort((a, b) => ALL_ONWARD_KINDS.indexOf(a) - ALL_ONWARD_KINDS.indexOf(b))
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 500)
  const depth = Math.max(Math.trunc(opts.depth ?? 1), 1)

  const loadDate = await effectsLoadDate()
  const ageDays = loadDate ? Math.floor((Date.now() - new Date(loadDate).getTime()) / 86_400_000) : null
  const freshness = { loadDate, ageDays, basis: FRESHNESS_BASIS, depth, caveat: onwardCaveat(loadDate, ageDays, depth) }

  const parsed = parseTarget(target, opts.provision)
  const zeros = () => kinds.map((kind) => ({ kind, counted: 0, returned: 0 }))
  const shell = (unaddressable: OnwardResult['unaddressable'], resolution: OnwardResult['resolution'], title: string | null = null): OnwardResult => ({
    target: { given: target, gid: resolution?.canonical ?? parsed.gid, provision: parsed.provision, title },
    resolution, rows: [], unaddressable, truncated: zeros(), perKind: [], notWalked: [], next: [], freshness,
    examined: { rowsCounted: 0, rowsReturned: 0 },
  })
  if (parsed.error) return shell({ code: 'not-an-id', reason: parsed.error }, null)

  // ⚠ §2.5 — every hop resolves through the identity bridge, because every hop calls this.
  const resolution = await resolveActForms(parsed.gid)
  const title = await titleOf(resolution.candidates)
  if (resolution.bridge === 'ambiguous-refused') {
    return shell({ code: 'ambiguous-form', reason: resolution.note ?? 'this year form fits more than one Act' }, resolution, title)
  }
  // ⚠ §2.4 — checked AFTER the Act resolves, so the answer says the Act was checked and the provision could not be.
  if (isUnaddressableRef(parsed.provision)) {
    return shell({
      code: 'part-or-chapter',
      reason: `${title ?? resolution.canonical} was found, but “${parsed.provision}” is a Part or Chapter. Our records hold the sections inside it, `
        + 'never a row for the Part itself, so nothing can be read for it here. Ask about its sections one at a time.',
    }, resolution, title)
  }

  const provision = parsed.provision
  const perKind = new Map<OnwardKind, OnwardKindCount>(kinds.map((kind) => [kind, {
    kind, strength: strengthOf(kind)!, counted: 0, returned: 0, instruments: 0, scope: { provision: 0, actWide: 0 }, split: null, citingText: null,
  }]))
  const scopeOf = (c: OnwardKindCount, kept: OneStep[]) => {
    for (const k of kept) if (k.scope === 'provision') c.scope.provision++; else c.scope.actWide++
  }
  const notWalked: OnwardResult['notWalked'] = []
  let rowsCounted = 0
  const rows: OneStep[] = []

  // ── made-under: the FIXED parser's enabling rows, one per instrument and power ──────────
  if (kinds.includes('made-under')) {
    const got = await enablingRows(resolution.candidates)
    rowsCounted += got.read
    const c = perKind.get('made-under')!
    const states = { held: 0, noneStored: 0, possiblyTruncated: 0 }
    let otherSection = 0
    const kept: OneStep[] = []
    for (const [gid, inst] of got.byInstrument) {
      const named = [...inst.provisions.keys()]
      let use: Array<[string | null, string]>
      if (!provision) use = named.length ? [...inst.provisions] : [[null, inst.actLevel ?? '']]
      else {
        const hit = named.filter((p) => provisionMatches(p, provision))
        // ⚠ An instrument whose words name ANOTHER section of this Act is not made under this one, and
        // its Act-level row must not bring it back in. One whose words name no section stays, act-wide.
        if (hit.length) use = hit.map((p) => [p, inst.provisions.get(p)!])
        else if (named.length) { otherSection++; continue }
        else use = [[null, inst.actLevel ?? '']]
      }
      for (const [p, words] of use) {
        const state = citingTextStateOf(words)
        if (state === 'held') states.held++; else if (state === 'none-stored') states.noneStored++; else states.possiblyTruncated++
        kept.push({
          provision: gid, act: gid, actTitle: null, kind: 'made-under', strength: 'dependency', subType: '',
          changeKind: null, changeReason: null, thisEndProvision: p, scope: p ? 'provision' : 'act-wide',
          citingText: words || null, citingTextState: state, citingTextOthers: 0, citedProvision: p,
          origin: 'extracted', source: ENABLING_SOURCE,
        })
      }
    }
    c.counted = kept.length
    c.instruments = new Set(kept.map((k) => k.act)).size
    c.citingText = states
    scopeOf(c, kept)
    c.returned = Math.min(kept.length, limit)
    rows.push(...kept.slice(0, limit))
    if (otherSection) notWalked.push({ kind: 'made-under', rows: otherSection, why: `instruments whose enacting words name a different section of this Act than ${provision}` })
  }

  // ── the official effects: counted in SQL, rows capped per kind ──────────────────────────
  const sqlKinds = kinds.filter((k) => isEdgeKind(k) && k !== 'cites' && k !== 'made-under')
  if (sqlKinds.length) {
    const thisProv = `split_part(to_id, ':', 3)`
    const pc = provision ? provisionPredicate(thisProv, provision) : null
    const provSql = pc ? ` AND (${pc.sql.replace(/\$P/g, '$3')} OR ${thisProv} = '')` : ''
    const params: unknown[] = [resolution.candidates, sqlKinds, ...(pc?.params ?? [])]
    const grouped = await prisma.$queryRawUnsafe<Array<{ edge_type: string; sub_type: string; act_wide: boolean; n: bigint }>>(
      `SELECT edge_type, sub_type, (${thisProv} = '') AS act_wide, COUNT(*)::bigint n FROM ${EFFECTS_TABLE_NAME}
       WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = ANY($2::text[])${provSql} GROUP BY 1, 2, 3`, ...params)
    const inst = await prisma.$queryRawUnsafe<Array<{ edge_type: string; n: bigint }>>(
      `SELECT edge_type, COUNT(DISTINCT split_part(from_id, ':', 2))::bigint n FROM ${EFFECTS_TABLE_NAME}
       WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = ANY($2::text[])${provSql} GROUP BY 1`, ...params)
    for (const g of grouped) {
      const c = perKind.get(g.edge_type as OnwardKind)
      if (!c) continue
      const n = Number(g.n)
      c.counted += n; rowsCounted += n
      if (g.act_wide) c.scope.actWide += n; else c.scope.provision += n
      if (c.strength === 'operation') {
        c.split ??= { total: 0, changeWords: 0, doNot: 0, unclassified: 0 }
        const k = readEffect(g.edge_type, g.sub_type).kind
        c.split.total += n
        if (k === 'textual') c.split.changeWords += n; else if (k === 'not-textual') c.split.doNot += n; else c.split.unclassified += n
      }
    }
    for (const i of inst) { const c = perKind.get(i.edge_type as OnwardKind); if (c) c.instruments = Number(i.n) }

    const sets = await Promise.all(sqlKinds.map((k) => perKind.get(k)!.counted
      ? prisma.$queryRawUnsafe<RawEdge[]>(
        `SELECT from_id, to_id, edge_type, sub_type, source FROM ${EFFECTS_TABLE_NAME}
         WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = $2${provSql}
         ORDER BY from_id, to_id, sub_type LIMIT ${limit}`, resolution.candidates, k, ...(pc?.params ?? []))
      : Promise.resolve([] as RawEdge[])))
    sets.forEach((set, i) => {
      perKind.get(sqlKinds[i])!.returned = set.length
      for (const r of set) rows.push(edgeRow(r, null))
    })
  }

  // ── cites: every row for the target, joined to its words, filtered, then capped ─────────
  if (kinds.includes('cites')) {
    const all = await prisma.$queryRawUnsafe<RawEdge[]>(
      `SELECT from_id, to_id, edge_type, sub_type, source FROM ${EFFECTS_TABLE_NAME}
       WHERE split_part(to_id, ':', 2) = ANY($1::text[]) AND edge_type = 'cites' ORDER BY from_id, to_id`, resolution.candidates)
    rowsCounted += all.length
    const words = await citingWords(all, resolution.candidates)
    const c = perKind.get('cites')!
    const states = { held: 0, noneStored: 0, possiblyTruncated: 0 }
    let otherProvision = 0
    const kept: OneStep[] = []
    for (const r of all) {
      const w = words.get(joinKey(gidOf(r.from_id), provOf(r.from_id))) ?? []
      const toProv = provOf(r.to_id)
      const cited = w.map((x) => x.target_provision_ref).find(Boolean) ?? null
      let scope: OneStep['scope'] = toProv ? 'provision' : 'act-wide'
      if (provision) {
        // ⚠ 121,268 of 121,279 cites rows point at the Act as a whole. Only the citing words can
        // narrow one to a provision — and if they name a DIFFERENT provision, the row is not about this one.
        // ⚠ A Part, Chapter or `contents` cannot exclude anything: we cannot tell from here whether
        // section 20 sits inside "Part 2", so a row naming one is kept as act-wide, never dropped.
        const comparable = (p: string | null) => (p && !/^(part|chapter|crossheading|contents)\b/i.test(p) ? p : null)
        const said = w.map((x) => comparable(x.target_provision_ref))
        const named = [comparable(toProv), ...said].filter(Boolean) as string[]
        if (named.some((p) => provisionMatches(p, provision))) scope = 'provision'
        // Dropped only when EVERY statement of the cited provision names another one; an unnamed one keeps the row.
        else if (named.length && (comparable(toProv) || said.every(Boolean))) { otherProvision++; continue }
        else scope = 'act-wide'
      }
      const step = edgeRow(r, w[0]?.citation_text ?? null)
      step.scope = scope
      step.citedProvision = cited
      step.citingTextOthers = Math.max(w.length - 1, 0)
      const s = step.citingTextState
      if (s === 'held') states.held++; else if (s === 'none-stored') states.noneStored++; else states.possiblyTruncated++
      kept.push(step)
    }
    c.counted = kept.length
    c.instruments = new Set(kept.map((k) => k.act)).size
    c.citingText = states
    scopeOf(c, kept)
    c.returned = Math.min(kept.length, limit)
    rows.push(...kept.slice(0, limit))
    if (otherProvision) {
      notWalked.push({ kind: 'cites', rows: otherProvision, why: `the citing words name a different provision of this Act than ${provision}` })
    }
  }

  // ── case law: only when asked for, from the citation table, never mixed into the walk ───
  if (kinds.includes(CASELAW_KIND)) {
    const c = perKind.get(CASELAW_KIND)!
    let q = `SELECT source_gid, source_provision_ref, target_provision_ref, citation_text FROM ${CITATION_TABLE}
             WHERE target_act_id = ANY($1::text[]) AND detection = 'caselaw-markup'`
    const params: unknown[] = [resolution.candidates]
    if (provision) {
      const p = provisionPredicate('target_provision_ref', provision)
      q += ` AND (${p.sql.replace(/\$P/g, '$2')} OR target_provision_ref IS NULL)`
      params.push(...p.params)
    }
    const counted = await prisma.$queryRawUnsafe<Array<{ n: bigint; g: bigint; none: bigint; aw: bigint }>>(
      `SELECT COUNT(*)::bigint n, COUNT(DISTINCT source_gid)::bigint g,
              COUNT(*) FILTER (WHERE btrim(citation_text) = '')::bigint none,
              COUNT(*) FILTER (WHERE target_provision_ref IS NULL)::bigint aw FROM (${q}) x`, ...params)
    c.counted = Number(counted[0].n); c.instruments = Number(counted[0].g); rowsCounted += c.counted
    c.scope = { provision: c.counted - Number(counted[0].aw), actWide: Number(counted[0].aw) }
    c.citingText = { held: 0, noneStored: Number(counted[0].none), possiblyTruncated: c.counted - Number(counted[0].none) }
    const got = await prisma.$queryRawUnsafe<Array<{ source_gid: string; source_provision_ref: string | null; target_provision_ref: string | null; citation_text: string }>>(
      `${q} ORDER BY source_gid, id LIMIT ${limit}`, ...params)
    c.returned = got.length
    for (const g of got) {
      rows.push({
        provision: g.source_gid, act: g.source_gid, actTitle: null, kind: CASELAW_KIND, strength: 'interpretation',
        subType: '', changeKind: null, changeReason: null, thisEndProvision: g.target_provision_ref,
        scope: g.target_provision_ref ? 'provision' : 'act-wide',
        citingText: g.citation_text, citingTextState: citingTextStateOf(g.citation_text), citingTextOthers: 0,
        citedProvision: g.target_provision_ref, origin: 'extracted', source: 'tna-caselaw',
      })
    }
  }

  // ── bridge and title the other ends ───────────────────────────────────────────────────
  const canon = await canonicalForms(rows.map((r) => r.act))
  for (const r of rows) {
    const c = canon.get(r.act)
    if (c && c !== r.act && r.kind !== CASELAW_KIND) {
      r.provision = r.provision.replace(r.act, c)
      r.act = c
    }
  }
  const titles = await titlesOf(rows.map((r) => r.act))
  for (const r of rows) r.actTitle = titles.get(r.act) ?? null

  rows.sort((a, b) => STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength)
    || ALL_ONWARD_KINDS.indexOf(a.kind) - ALL_ONWARD_KINDS.indexOf(b.kind))
  const nextMap = new Map<string, { node: string; kinds: OnwardKind[]; strength: Strength }>()
  for (const r of rows) {
    const n = nextMap.get(r.provision)
    if (!n) nextMap.set(r.provision, { node: r.provision, kinds: [r.kind], strength: r.strength })
    else if (!n.kinds.includes(r.kind)) n.kinds.push(r.kind)
  }

  const counts = kinds.map((k) => perKind.get(k)!)
  return {
    target: { given: target, gid: resolution.canonical, provision, title },
    resolution, rows, unaddressable: null,
    truncated: counts.map((c) => ({ kind: c.kind, counted: c.counted, returned: c.returned })),
    perKind: counts, notWalked, next: [...nextMap.values()], freshness,
    examined: { rowsCounted, rowsReturned: rows.length },
  }
}

// ── internals ───────────────────────────────────────────────────────────────────

interface RawEdge { from_id: string; to_id: string; edge_type: string; sub_type: string; source: string }

const gidOf = (id: string) => id.split(':')[1] ?? id
const provOf = (id: string) => id.split(':')[2] || null
const joinKey = (gid: string, prov: string | null) => `${gid.toLowerCase()}|${(prov ?? '').toLowerCase()}`

function edgeRow(r: RawEdge, citing: string | null): OneStep {
  const kind = r.edge_type as OnwardKind
  const strength = strengthOf(r.edge_type)
  if (!strength) throw new Error(`edge type "${r.edge_type}" has no strength — refusing to guess one`)
  const official = strength === 'operation'
  const reading = official ? readEffect(r.edge_type, r.sub_type) : null
  const gid = gidOf(r.from_id)
  const prov = provOf(r.from_id)
  const isCites = kind === 'cites'
  return {
    provision: legPath(gid, prov), act: gid, actTitle: null, kind, strength, subType: r.sub_type,
    changeKind: reading?.kind ?? null, changeReason: reading?.reason ?? null,
    thisEndProvision: provOf(r.to_id), scope: provOf(r.to_id) ? 'provision' : 'act-wide',
    citingText: isCites ? citing : null, citingTextState: isCites ? citingTextStateOf(citing) : null,
    citingTextOthers: 0, citedProvision: null, origin: originOf(r.source), source: r.source,
  }
}

/**
 * `citation_edge.citation_text` for a set of cites rows. ⚠ Joined to the MARKUP detection only:
 * `cites` came from marked-up citations, and a `text` detection at the same place is a different,
 * weaker kind of evidence (SURFACE 5). Measured: 116,741 of 121,279 cites rows find their words this way.
 */
async function citingWords(rows: RawEdge[], targetForms: string[]) {
  const out = new Map<string, Array<{ citation_text: string; target_provision_ref: string | null }>>()
  if (!rows.length) return out
  const gids = [...new Set(rows.flatMap((r) => gidCandidates(gidOf(r.from_id))))]
  const got = await prisma.$queryRawUnsafe<Array<{ source_gid: string; source_provision_ref: string | null; target_provision_ref: string | null; citation_text: string }>>(
    `SELECT source_gid, source_provision_ref, target_provision_ref, citation_text FROM ${CITATION_TABLE}
     WHERE source_gid = ANY($1::text[]) AND target_act_id = ANY($2::text[]) AND detection = 'markup' ORDER BY id`,
    gids, targetForms)
  for (const g of got) {
    const k = joinKey(g.source_gid, g.source_provision_ref)
    const list = out.get(k) ?? []
    list.push({ citation_text: g.citation_text, target_provision_ref: g.target_provision_ref })
    out.set(k, list)
  }
  return out
}

export const ENABLING_SOURCE = 'citation_edge:enabling'

/**
 * ⚠⚠ WHY `made-under` IS READ FROM `citation_edge` AND NOT FROM `legislation_edges`.
 *
 * Both hold it. `legislation_edges`' made-under rows came from the preamble parser BEFORE its
 * 28 August fix, and `graph_coverage_fact.madeunder_section_refs_wrong_pct` records that 36.1% of
 * their section-level refs are wrong: "section 52(2)" is filed as section-52 AND section-2, so a
 * walk from s.2 of CRaG 2010 returned s.52's commencement orders. `citation_edge`'s `enabling` rows
 * were written by the fixed parser and cover the same instruments (16 / 74 / 74 for CRaG, GRAA and
 * the Equality Act, against 16 / 74 / 73). They also keep the words up to the reference.
 *
 * ⚠ THE FIXED PARSER IS NOT CLEAN EITHER. It records an instrument as enabled by an Act it merely
 * names in its preamble: SIs that say CRaG s.20's treaty procedure "has been met" come back as made
 * under s.20, which confers no power. The words are returned so a reader can see that. This reader
 * does not reclassify them.
 */
async function enablingRows(targetForms: string[]) {
  const got = await prisma.$queryRawUnsafe<Array<{ source_gid: string; target_provision_ref: string | null; citation_text: string }>>(
    `SELECT source_gid, target_provision_ref, citation_text FROM ${CITATION_TABLE}
     WHERE target_act_id = ANY($1::text[]) AND detection = 'enabling' ORDER BY source_gid, id`, targetForms)
  const byInstrument = new Map<string, { actLevel: string | null; provisions: Map<string, string> }>()
  for (const g of got) {
    const i = byInstrument.get(g.source_gid) ?? { actLevel: null, provisions: new Map<string, string>() }
    if (g.target_provision_ref) { if (!i.provisions.has(g.target_provision_ref)) i.provisions.set(g.target_provision_ref, g.citation_text) }
    else i.actLevel ??= g.citation_text
    byInstrument.set(g.source_gid, i)
  }
  return { read: got.length, byInstrument }
}

/** The bridge's canonical form for each gid that has one (§2.5: the OTHER end is bridged too). */
async function canonicalForms(gids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const u = [...new Set(gids)]
  if (!u.length) return m
  const got = await prisma.$queryRawUnsafe<Array<{ form: string; canonical: string }>>(
    `SELECT form, canonical FROM legislation_identity WHERE form = ANY($1::text[]) AND canonical IS NOT NULL`, u).catch(() => [])
  for (const g of got) m.set(g.form, g.canonical)
  return m
}

async function titlesOf(gids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  const u = [...new Set(gids.flatMap((g) => gidCandidates(g)))]
  if (!u.length) return m
  const got = await prisma.$queryRawUnsafe<Array<{ gid: string; title: string }>>(
    `SELECT gid, title FROM corpus_acts WHERE gid = ANY($1::text[]) AND title IS NOT NULL`, u).catch(() => [])
  for (const g of got) { m.set(g.gid, g.title); m.set(g.gid.toLowerCase(), g.title) }
  for (const g of gids) if (!m.has(g) && m.has(g.toLowerCase())) m.set(g, m.get(g.toLowerCase())!)
  return m
}

async function titleOf(forms: string[]): Promise<string | null> {
  const t = await titlesOf(forms)
  return forms.map((f) => t.get(f)).find(Boolean) ?? null
}
