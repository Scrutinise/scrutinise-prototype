// ─────────────────────────────────────────────────────────────────────────────
// 26-U §4 (decisions 144, 209, 210, 229) — WHAT THIS TOUCHES: computed from the drafting instruction's named provisions, never written.
//
// Per provision line:
//   · amends / repeals / modifies → the provision's HELD text (read_section) and its ONWARD EFFECTS from the GRAPH 6 reader, per type,
//     with "N change the words, M do not" and the unclassified count AS THE READER RETURNS THEM (209: unclassified is printed, never 0),
//     the load date and the coverage sentence from the data (210), never a fixed sentence.
//   · relies_on → the enabling provision's text and what has been made under it (our extraction, labelled).
//   · constrains → the constraint's text and what cites it (cases where the citator has them; our extraction, labelled).
//   · NEAR PROVISIONS (144): the other provisions in the same cross-heading, then the same Chapter / Part, of that Act — from
//     legislation.gov.uk's own contents — each with the question "consistent with this action? — not yet answered".
//   · THE HONEST STATES, in words: a Bill is "before Parliament — not yet law"; an Act we hold no text for is "named, not held";
//     an id with no Act behind it in our records is "no such Act"; a lookup that did not complete is "lookup failed". Never an empty list.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { readSection } from './read-section'
import { effectsFor, type EffectsResult } from './statutory-graph'
import { effectsHeadline, describeEffects } from './effects-describe'
import { corpusProvision, targetKind, type DraftInstruction, type DraftProvision } from './action-draft-pure'

import { type TargetState, type EffectCount, type NearProvision, type Touch, type TouchesResult, NEAR_QUESTION } from './action-touches-pure'
export * from './action-touches-pure'

/** The legislation collections: primary Acts, instruments, devolved legislation (`regional`) and retained EU law. Explanatory notes and the
 *  rest are not "the Act's text". (`external` in `legislation_edges` is the opposite: a target the record names that we do NOT hold.) */
const isLegislationCorpus = (c: string) => c.startsWith('primary-acts') || c.startsWith('si-') || c === 'regional' || c === 'retained-eu'

/**
 * The held corpus row for a provision of an Act, or for the Act at all, under ANY of the id forms the effects reader resolves.
 * ⚠ An Act of 1911 is held as `ukpga/Geo5/1-2/28`; asked for as `ukpga/1911/28` it reads "named, not held" unless every form is tried.
 */
async function heldRow(forms: string[], provision: string | null): Promise<{ any: boolean; exact: string | null }> {
  for (const docUri of forms) {
    const like = `%:${docUri}:%`
    // ⚠ Filter by collection IN the query: a LIMIT taken first can be all explanatory notes (the Procurement Act 2023 has 127), which
    // made a held Act read "named, not held".
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM corpus_sections WHERE id LIKE ${like}
      AND (split_part(id, ':', 1) LIKE 'primary-acts%' OR split_part(id, ':', 1) LIKE 'si-%' OR split_part(id, ':', 1) IN ('regional', 'retained-eu')) LIMIT 50`
    const legal = rows.filter((r) => isLegislationCorpus(r.id.split(':')[0]))
    if (!legal.length) continue
    if (!provision) return { any: true, exact: null }
    const corpora = [...new Set(legal.map((r) => r.id.split(':')[0]))]
    const exact = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM corpus_sections WHERE id = ANY(${corpora.map((c) => `${c}:${docUri}:${provision}`)}) LIMIT 1`
    return { any: true, exact: exact[0]?.id ?? null }
  }
  return { any: false, exact: null }
}

// ── legislation.gov.uk's contents, for near provisions (cached per Act for the life of the process) ──────────────
interface ContentsItem { ref: string; number: string; title: string; path: string[] }
const contentsCache = new Map<string, Promise<ContentsItem[]>>()
const unxml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, '’').replace(/\s+/g, ' ').trim()

/** Parse a contents/data.xml into section items, each with its ancestry (Part → Chapter → cross-heading refs). Pure. */
export function parseContents(xml: string): ContentsItem[] {
  const out: ContentsItem[] = []
  const stack: string[] = []
  const tag = /<(\/?)(ContentsPart|ContentsChapter|ContentsPblock|ContentsSchedule|ContentsItem)\b([^>]*)>|<ContentsNumber>([\s\S]*?)<\/ContentsNumber>|<ContentsTitle>([\s\S]*?)<\/ContentsTitle>/g
  let cur: ContentsItem | null = null
  for (const m of xml.matchAll(tag)) {
    if (m[2]) {
      const closing = m[1] === '/'
      const ref = /ContentRef="([^"]+)"/.exec(m[3] ?? '')?.[1] ?? ''
      if (m[2] === 'ContentsItem') {
        if (closing) { if (cur) out.push(cur); cur = null } else cur = { ref, number: '', title: '', path: [...stack] }
      } else if (closing) stack.pop()
      else stack.push(ref)
    } else if (cur && m[4] !== undefined && !cur.number) cur.number = unxml(m[4])
    else if (cur && m[5] !== undefined && !cur.title) cur.title = unxml(m[5])
  }
  return out
}

async function contentsOf(docUri: string): Promise<ContentsItem[]> {
  if (!contentsCache.has(docUri)) {
    contentsCache.set(docUri, (async () => {
      const res = await fetch(`https://www.legislation.gov.uk/${docUri}/contents/data.xml`, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Scrutinise/1.0' } })
      if (!res.ok) throw new Error(`legislation.gov.uk answered ${res.status} for ${docUri}/contents`)
      return parseContents(await res.text())
    })().catch((e) => { contentsCache.delete(docUri); throw e }))
  }
  return contentsCache.get(docUri)!
}

/** The provisions near `provision` in its Act: same cross-heading first, then the same Chapter, then the same Part. Pure. */
export function nearFrom(items: ContentsItem[], provision: string, max = 12): NearProvision[] {
  const me = items.find((i) => i.ref === provision)
  if (!me) return []
  const out: NearProvision[] = []
  for (let depth = me.path.length; depth >= 1 && out.length < max; depth--) {
    const anc = me.path.slice(0, depth)
    const level = anc[anc.length - 1]
    const why = /crossheading/.test(level) ? 'same cross-heading' : /chapter/.test(level) ? 'same Chapter' : /schedule/.test(level) ? 'same Schedule' : 'same Part'
    for (const i of items) {
      if (out.length >= max) break
      if (i.ref === provision || out.some((o) => o.ref === i.ref)) continue
      if (anc.every((a, k) => i.path[k] === a)) out.push({ ref: i.ref, number: i.number, title: i.title, why, question: NEAR_QUESTION })
    }
  }
  return out
}

const perTypeOf = (r: EffectsResult): EffectCount[] => r.perType.map((c) => ({
  type: c.edgeType, total: c.total, changeTheWords: c.byKind.textual, doNotChangeTheWords: c.byKind['not-textual'], unclassified: c.byKind.unclassified,
  official: c.byOrigin.official, extracted: c.byOrigin.extracted,
}))

export async function touchOf(line: DraftProvision): Promise<Touch> {
  const base: Touch = { line, state: 'held', stateReason: '', actTitle: null, corpusId: null, heldText: null, heldChars: null, effects: null, near: [], nearNote: null }
  const kind = targetKind(line.docUri, line.provisionPath)
  if (kind === 'bill') return { ...base, state: 'before-parliament', stateReason: 'a Bill has no effects in the statute book; nothing is computed for it' }
  if (kind === 'document') return { ...base, state: 'document', stateReason: 'not legislation; linked, nothing computed' }
  const provision = corpusProvision(line.provisionPath)
  try {
    const types = line.relation === 'relies_on' ? (['made-under'] as const) : line.relation === 'constrains' ? (['cites'] as const) : (['amends', 'repeals', 'modifies'] as const)
    const eff = await effectsFor(line.docUri, { provision, edgeTypes: types, limitPerType: 1 })
    const held = await heldRow([...new Set([line.docUri, eff.resolution.canonical, ...eff.resolution.candidates])], provision)
    const anyEdges = eff.perType.some((c) => c.total > 0)
    if (!held.any) {
      // The record can name an Act we hold nothing of: its edges point at `external:<id>:…`, which the effects reader does not count.
      const ext = `external:${line.docUri}`
      const named = anyEdges || !!eff.target.title || (await prisma.$queryRaw<Array<{ x: number }>>`SELECT 1 x FROM legislation_edges WHERE to_id = ${ext} OR to_id LIKE ${`${ext}:%`} LIMIT 1`).length > 0
      const state: TargetState = named ? 'named-not-held' : 'no-such-act'
      return { ...base, state, actTitle: eff.target.title, stateReason: state === 'no-such-act' ? `no Act ${line.docUri} in the statute book as held here: no text and no recorded changes` : `the statute book records ${line.docUri}${eff.target.title ? ` (${eff.target.title})` : ''}, but we hold none of its text` }
    }
    let heldText: string | null = null, heldChars: number | null = null, corpusId: string | null = held.exact
    if (held.exact) {
      const r = await readSection(held.exact)
      if (r.status === 'text') { heldText = r.text ?? null; heldChars = r.totalChars ?? null }
    }
    let near: NearProvision[] = [], nearNote: string | null = null
    if (provision) {
      try { near = nearFrom(await contentsOf(line.docUri), provision); if (!near.length) nearNote = `${provision} is not in legislation.gov.uk’s contents for ${line.docUri}` }
      catch (e) { nearNote = `near provisions could not be read: ${e instanceof Error ? e.message : String(e)}` }
    }
    return {
      ...base, state: 'held', actTitle: eff.target.title, corpusId, heldText, heldChars, near, nearNote,
      stateReason: held.exact ? '' : provision ? `we hold ${line.docUri} but not ${provision} on its own` : 'the Act as a whole',
      effects: { headline: effectsHeadline(eff), summary: describeEffects(eff), perType: perTypeOf(eff), loadDate: eff.freshness.newestRowAt?.slice(0, 10) ?? null, freshness: eff.freshness.caveat, coverage: eff.coverage },
    }
  } catch (e) {
    return { ...base, state: 'lookup-failed', stateReason: e instanceof Error ? e.message : String(e) }
  }
}

export async function touchesFor(ins: DraftInstruction): Promise<TouchesResult> {
  const touches: Touch[] = []
  for (const line of ins.provisions.filter((p) => p.relation !== 'precedent')) touches.push(await touchOf(line))
  return { touches, counted: { lines: touches.length, held: touches.filter((t) => t.state === 'held').length, notHeld: touches.filter((t) => t.state === 'named-not-held' || t.state === 'no-such-act').length, failed: touches.filter((t) => t.state === 'lookup-failed').length } }
}
