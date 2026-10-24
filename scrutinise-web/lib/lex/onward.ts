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
  ONWARD_KINDS, ALL_ONWARD_KINDS, CASELAW_KIND, MENTIONS_KIND, STRENGTH_ORDER, strengthOf, parseTarget, isUnaddressableRef,
  legPath, provisionMatches, citingTextStateOf, onwardCaveat, rowZoneOf, mentionOnlySentence, enablingKindOf,
  type OnwardKind, type Strength, type CitingTextState, type EnablingRole, type ProvisionPowerState, type RowZone,
} from '@/lib/lex/onward-pure'

/** GRAPH 9 §2 — what the provision itself says (`provision_power`). Low confidence, always; see onward-pure. */
export interface ProvisionPower { state: ProvisionPowerState; basis: string; words: string | null }
export const PROVISION_POWER_TABLE = 'provision_power'

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
  /**
   * ⚠ DECISION 271 — `made-under` / `enacting-mention` only: what the instrument's enacting words make of this
   * (`citation_edge.enabling_role`), and the phrase that was read from. `power` is the only dependency; null on
   * every other kind, and on an enabling row stored before the role existed.
   */
  enablingRole: EnablingRole | null
  enablingRoleWords: string | null
  /**
   * ⚠ GRAPH 9 §2 — made-under / enacting-unresolved / enacting-mention naming a provision: what that provision itself
   * says. null on an Act-wide row (no provision to read) and on every other kind. `undefined` never: a provision the
   * extractor has not computed reads `{ state: 'unknown', basis: 'not-computed' }`.
   */
  provisionPower: ProvisionPower | null
  /** ⚠ GRAPH 9 §4 — where the citing words sit (cites, mentions): a note is not part of the law. null = not applicable. */
  sourceZone: RowZone
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
  /** GRAPH 9 §4 — `cites` / `mentions`: of the counted rows, how many have words from a note (not the law), and how many a zone was never determined for. */
  zones: { notes: number; undetermined: number } | null
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
  /** GRAPH 9 §2 — the TARGET provision's own state, where the walk starts at a provision some enabling row names; else null. */
  targetProvisionPower: ProvisionPower | null
  /** GRAPH 9 §2.3 — "N instruments reference this provision … None is made under a power in it", only when true. */
  mentionOnly: string | null
}

export const FRESHNESS_BASIS =
  'the newest load time of the stored relationships table (official effects and our own extractions) — '
  + 'the date we loaded the record, not the date the record is current to'

const OFFICIAL_KINDS = ['amends', 'repeals', 'modifies', 'commences'] as const

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
    examined: { rowsCounted: 0, rowsReturned: 0 }, targetProvisionPower: null, mentionOnly: null,
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
    kind, strength: strengthOf(kind)!, counted: 0, returned: 0, instruments: 0, scope: { provision: 0, actWide: 0 }, split: null, citingText: null, zones: null,
  }]))
  const scopeOf = (c: OnwardKindCount, kept: OneStep[]) => {
    for (const k of kept) if (k.scope === 'provision') c.scope.provision++; else c.scope.actWide++
  }
  const notWalked: OnwardResult['notWalked'] = []
  let rowsCounted = 0
  const rows: OneStep[] = []

  // ── made-under and enacting-mention: the FIXED parser's enabling rows, split by DECISION 271 ──────────
  // ⚠ The two kinds come from one table and are NEVER summed: `made-under` is a row whose words name this as the
  // power exercised, `enacting-mention` every other enabling row. An instrument that is made under this provision
  // is not listed again as merely mentioning it.
  // ⚠ GRAPH 9 §2: a third kind from the same table. `enacting-unresolved` is a row whose WORDS name this as the power
  // exercised (271 `power`) on a provision that ITSELF appears to confer none (`provision_power.state = 'none'`) — the two
  // instruments disagree, so it is shown for a human and is neither made-under nor a mention. Precedence per instrument:
  // made-under, then unresolved, then mention; an instrument is listed under one of the three only.
  let targetProvisionPower: ProvisionPower | null = null
  const ENABLING_KINDS = ['made-under', 'enacting-unresolved', 'enacting-mention'] as const
  if (ENABLING_KINDS.some((k) => kinds.includes(k))) {
    const got = await enablingRows(resolution.candidates)
    rowsCounted += got.read
    if (provision) targetProvisionPower = [...got.powerOf].find(([p]) => p.toLowerCase() === provision.toLowerCase())?.[1] ?? null
    const claimed = new Set<string>()
    for (const kind of ENABLING_KINDS) {
      const c = perKind.get(kind)
      const states = { held: 0, noneStored: 0, possiblyTruncated: 0 }
      let otherSection = 0
      const kept: OneStep[] = []
      for (const [gid, sets] of got.byInstrument) {
        const inst = kind === 'made-under' ? sets.power : kind === 'enacting-unresolved' ? sets.unresolved : sets.other
        if (!inst.actLevel && !inst.provisions.size) continue
        if (claimed.has(gid)) continue
        const named = [...inst.provisions.keys()]
        let use: Array<[string | null, EnablingWords]>
        if (!provision) use = named.length ? [...inst.provisions] : [[null, inst.actLevel!]]
        else {
          const hit = named.filter((p) => provisionMatches(p, provision))
          // ⚠ An instrument whose words name ANOTHER section of this Act is not made under this one, and
          // its Act-level row must not bring it back in. One whose words name no section stays, act-wide.
          if (hit.length) use = hit.map((p) => [p, inst.provisions.get(p)!])
          else if (named.length) { otherSection++; continue }
          else use = [[null, inst.actLevel!]]
        }
        // ⚠ Claimed whether or not its kind was asked for (as before GRAPH 9): a made-under instrument is never listed again
        // as unresolved or as a mention, and one whose words name a different section (`otherSection`) claims nothing.
        if (kind !== 'enacting-mention') claimed.add(gid)
        if (!c) continue
        for (const [p, w] of use) {
          const state = citingTextStateOf(w.text)
          if (state === 'held') states.held++; else if (state === 'none-stored') states.noneStored++; else states.possiblyTruncated++
          kept.push({
            provision: gid, act: gid, actTitle: null, kind, strength: strengthOf(kind)!, subType: '',
            changeKind: null, changeReason: null, thisEndProvision: p, scope: p ? 'provision' : 'act-wide',
            citingText: w.text || null, citingTextState: state, citingTextOthers: 0, citedProvision: p,
            enablingRole: w.role, enablingRoleWords: w.roleWords,
            provisionPower: p ? got.powerOf.get(p) ?? NOT_COMPUTED : null, sourceZone: null,
            origin: 'extracted', source: ENABLING_SOURCE,
          })
        }
      }
      if (!c) continue
      c.counted = kept.length
      c.instruments = new Set(kept.map((k) => k.act)).size
      c.citingText = states
      scopeOf(c, kept)
      c.returned = Math.min(kept.length, limit)
      rows.push(...kept.slice(0, limit))
      if (otherSection) notWalked.push({ kind, rows: otherSection, why: `instruments whose enacting words name a different section of this Act than ${provision}` })
    }
  }

  // ── the official effects: counted in SQL, rows capped per kind ──────────────────────────
  // ⚠ An ALLOW-list. It was a deny-list (`not cites, not made-under, not enacting-mention`), and each new kind from
  // another table — GRAPH 9 added two — would have been sent to the effects table as an edge type.
  const sqlKinds = kinds.filter((k) => (OFFICIAL_KINDS as readonly string[]).includes(k))
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
      // GRAPH 9 §4: the zone of the words SHOWN (the first window); with no words there is nothing to label.
      step.sourceZone = w[0] ? rowZoneOf(w[0].source_zone) : null
      step.provision = noteNode(step.sourceZone, step.act, step.provision)
      const s = step.citingTextState
      if (s === 'held') states.held++; else if (s === 'none-stored') states.noneStored++; else states.possiblyTruncated++
      kept.push(step)
    }
    c.counted = kept.length
    c.instruments = new Set(kept.map((k) => k.act)).size
    c.citingText = states
    c.zones = {
      notes: kept.filter((k) => k.sourceZone === 'explanatory-note' || k.sourceZone === 'earlier-orders-note').length,
      undetermined: kept.filter((k) => k.sourceZone === 'not-determined').length,
    }
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
        citedProvision: g.target_provision_ref, enablingRole: null, enablingRoleWords: null, provisionPower: null, sourceZone: null,
        origin: 'extracted', source: 'tna-caselaw',
      })
    }
  }

  // ── mentions (GRAPH 9 §3): the target's NAME in running text, resolved by us — only when asked for, never merged ──
  // ⚠ From `citation_edge.detection = 'text'`, never from the `cites` rows, and counted on its own line: a merged
  // "citations" figure would be ~95% this weaker kind on the Equality Act with no way to tell which.
  if (kinds.includes(MENTIONS_KIND)) {
    const c = perKind.get(MENTIONS_KIND)!
    let q = `SELECT source_gid, source_provision_ref, target_provision_ref, citation_text, source_zone FROM ${CITATION_TABLE}
             WHERE target_act_id = ANY($1::text[]) AND detection = 'text'`
    const params: unknown[] = [resolution.candidates]
    if (provision) {
      const p = provisionPredicate('target_provision_ref', provision)
      q += ` AND (${p.sql.replace(/\$P/g, '$2')} OR target_provision_ref IS NULL)`
      params.push(...p.params)
    }
    const counted = await prisma.$queryRawUnsafe<Array<{ n: bigint; g: bigint; aw: bigint; notes: bigint; undetermined: bigint }>>(
      `SELECT COUNT(*)::bigint n, COUNT(DISTINCT source_gid)::bigint g,
              COUNT(*) FILTER (WHERE target_provision_ref IS NULL)::bigint aw,
              COUNT(*) FILTER (WHERE source_zone IN ('explanatory-note', 'earlier-orders-note'))::bigint notes,
              COUNT(*) FILTER (WHERE source_zone IS NULL)::bigint undetermined FROM (${q}) x`, ...params)
    c.counted = Number(counted[0].n); c.instruments = Number(counted[0].g); rowsCounted += c.counted
    c.scope = { provision: c.counted - Number(counted[0].aw), actWide: Number(counted[0].aw) }
    c.citingText = { held: 0, noneStored: 0, possiblyTruncated: c.counted }
    c.zones = { notes: Number(counted[0].notes), undetermined: Number(counted[0].undetermined) }
    const got = await prisma.$queryRawUnsafe<Array<{ source_gid: string; source_provision_ref: string | null; target_provision_ref: string | null; citation_text: string; source_zone: string | null }>>(
      `${q} ORDER BY source_gid, source_provision_ref NULLS LAST LIMIT ${limit}`, ...params)
    c.returned = got.length
    for (const g of got) {
      rows.push({
        provision: noteNode(rowZoneOf(g.source_zone), g.source_gid, legPath(g.source_gid, g.source_provision_ref)),
        act: g.source_gid, actTitle: null, kind: MENTIONS_KIND, strength: 'reference',
        subType: '', changeKind: null, changeReason: null, thisEndProvision: g.target_provision_ref,
        scope: g.target_provision_ref ? 'provision' : 'act-wide',
        citingText: g.citation_text, citingTextState: citingTextStateOf(g.citation_text), citingTextOthers: 0,
        citedProvision: g.target_provision_ref, enablingRole: null, enablingRoleWords: null, provisionPower: null,
        sourceZone: rowZoneOf(g.source_zone), origin: 'extracted', source: 'citation_edge:text',
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
  // §2.3's sentence — only with all three enabling kinds asked, so a kind left out is never read as a zero.
  const e = (k: OnwardKind) => perKind.get(k)?.scope.provision
  const mentionOnly = provision && ENABLING_KINDS.every((k) => perKind.has(k))
    ? mentionOnlySentence(e('enacting-mention')!, e('made-under')!, e('enacting-unresolved')!, targetProvisionPower?.state ?? null)
    : null
  return {
    target: { given: target, gid: resolution.canonical, provision, title },
    resolution, rows, unaddressable: null,
    truncated: counts.map((c) => ({ kind: c.kind, counted: c.counted, returned: c.returned })),
    perKind: counts, notWalked, next: [...nextMap.values()], freshness,
    examined: { rowsCounted, rowsReturned: rows.length },
    targetProvisionPower, mentionOnly,
  }
}

// ── internals ───────────────────────────────────────────────────────────────────

interface RawEdge { from_id: string; to_id: string; edge_type: string; sub_type: string; source: string }

/**
 * ⚠ GRAPH 9 §4 — A NOTE HAS NO PROVISION, AND THE STORED ONE IS WRONG. The extractors file a reference under the last
 * provision id BEFORE it, and an SI's explanatory note comes after its last article or schedule paragraph — so a note's
 * "This Order brings into force section 45(1) …" is stored as a citation FROM `article-2` (uksi/2014/3245, measured).
 * The node handed back to walk from is therefore the instrument as a whole, never the provision the row was filed under.
 */
export function noteNode(zone: RowZone, act: string, filedUnder: string): string {
  return zone === 'explanatory-note' || zone === 'earlier-orders-note' ? act : filedUnder
}

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
    citingTextOthers: 0, citedProvision: null, enablingRole: null, enablingRoleWords: null, provisionPower: null,
    sourceZone: null, origin: originOf(r.source), source: r.source,
  }
}

/**
 * `citation_edge.citation_text` for a set of cites rows. ⚠ Joined to the MARKUP detection only:
 * `cites` came from marked-up citations, and a `text` detection at the same place is a different,
 * weaker kind of evidence (SURFACE 5). Measured: 116,741 of 121,279 cites rows find their words this way.
 */
async function citingWords(rows: RawEdge[], targetForms: string[]) {
  const out = new Map<string, Array<{ citation_text: string; target_provision_ref: string | null; source_zone: string | null }>>()
  if (!rows.length) return out
  const gids = [...new Set(rows.flatMap((r) => gidCandidates(gidOf(r.from_id))))]
  const got = await prisma.$queryRawUnsafe<Array<{ source_gid: string; source_provision_ref: string | null; target_provision_ref: string | null; citation_text: string; source_zone: string | null }>>(
    `SELECT source_gid, source_provision_ref, target_provision_ref, citation_text, source_zone FROM ${CITATION_TABLE}
     WHERE source_gid = ANY($1::text[]) AND target_act_id = ANY($2::text[]) AND detection = 'markup' ORDER BY id`,
    gids, targetForms)
  for (const g of got) {
    const k = joinKey(g.source_gid, g.source_provision_ref)
    const list = out.get(k) ?? []
    list.push({ citation_text: g.citation_text, target_provision_ref: g.target_provision_ref, source_zone: g.source_zone })
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
 * ⚠ THE FIXED PARSER WAS NOT CLEAN EITHER: every anchor in the enacting words became an enabling row, so
 * SIs that say CRaG s.20's treaty procedure "has been met" came back as made under s.20, which confers no
 * power. DECISION 271 (24 Oct 2026) put the answer in the extraction — `enabling_role`, read from the words
 * and validated by `check-271-enabling-role.ts` — and this reader only sorts by it: `power` → made-under,
 * anything else (or a row stored before the role existed) → enacting-mention.
 */
interface EnablingWords { text: string; role: EnablingRole | null; roleWords: string | null }
type EnablingSet = { actLevel: EnablingWords | null; provisions: Map<string, EnablingWords> }
/** A named provision `extract-provision-power.ts` never computed (a target added since it ran) — said, never guessed. */
export const NOT_COMPUTED: ProvisionPower = { state: 'unknown', basis: 'not-computed', words: null }
async function enablingRows(targetForms: string[]) {
  const got = await prisma.$queryRawUnsafe<Array<{
    source_gid: string; target_provision_ref: string | null; citation_text: string; enabling_role: EnablingRole | null; enabling_role_words: string | null
    pp_state: ProvisionPowerState | null; pp_basis: string | null; pp_words: string | null
  }>>(
    `SELECT c.source_gid, c.target_provision_ref, c.citation_text, c.enabling_role, c.enabling_role_words,
            pp.state AS pp_state, pp.basis AS pp_basis, pp.words AS pp_words
       FROM ${CITATION_TABLE} c
       LEFT JOIN ${PROVISION_POWER_TABLE} pp ON pp.gid = c.target_act_id AND pp.provision_ref = c.target_provision_ref
      WHERE c.target_act_id = ANY($1::text[]) AND c.detection = 'enabling' ORDER BY c.source_gid, c.id`, targetForms)
  const byInstrument = new Map<string, { power: EnablingSet; unresolved: EnablingSet; other: EnablingSet }>()
  const powerOf = new Map<string, ProvisionPower>()
  const empty = (): EnablingSet => ({ actLevel: null, provisions: new Map() })
  for (const g of got) {
    const sets = byInstrument.get(g.source_gid) ?? { power: empty(), unresolved: empty(), other: empty() }
    if (g.target_provision_ref && !powerOf.has(g.target_provision_ref)) {
      powerOf.set(g.target_provision_ref, g.pp_state ? { state: g.pp_state, basis: g.pp_basis ?? '', words: g.pp_words } : NOT_COMPUTED)
    }
    // ⚠ The provision test only WITHHOLDS (onward-pure `enablingKindOf`, the one place this is decided).
    const k = enablingKindOf(g.enabling_role, g.target_provision_ref, g.pp_state)
    const i = k === 'made-under' ? sets.power : k === 'enacting-unresolved' ? sets.unresolved : sets.other
    const w = { text: g.citation_text, role: g.enabling_role, roleWords: g.enabling_role_words }
    if (g.target_provision_ref) { if (!i.provisions.has(g.target_provision_ref)) i.provisions.set(g.target_provision_ref, w) }
    else i.actLevel ??= w
    byInstrument.set(g.source_gid, sets)
  }
  // ⚠⚠ PER INSTRUMENT, NOT PER ROW. The extractor writes an Act-level row for every anchor BESIDE its provision rows,
  // with the same words and the same role. Classified row by row, an instrument whose only named provision is `none`
  // kept its Act-level `power` row and came back "made under the Act as a whole" — on a walk from that very provision
  // too — so the withholding never took effect (check:graph-9 G3 found 0 unresolved instruments in the whole table).
  // Where an instrument's words name provisions, its Act-level row is that same anchor and goes with them.
  for (const sets of byInstrument.values()) {
    if (!sets.power.provisions.size && sets.unresolved.provisions.size && sets.power.actLevel) {
      sets.unresolved.actLevel = sets.power.actLevel
      sets.power.actLevel = null
    }
  }
  return { read: got.length, byInstrument, powerOf }
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
