// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 — READS WHAT THE ACTIONS PACK, THE BACKGROUND REPORT AND THE INTRODUCTORY SUMMARY NEED BEYOND THE PROPOSAL SNAPSHOT.
//
// ⚠ READ-ONLY, AND IT HAS TO BE: `buildProposalSnapshot` is also the staleness fingerprint, run on page loads, so nothing here may write
// (the registry is NOT synced here - a source with no number yet simply has none; `generateProposalExport` syncs before it reads).
// ⚠ A LEX PROPOSAL NEVER ENTERS: a slot is read from `rec[k].text` (the owner's, or accepted); `rec[k].proposal` is ignored. A note is read
// only when it is IN THE RECORD and not mine-only; an unreviewed team note is not the proposer's position.
// ⚠ NOTHING IS GUESSED: the issue -> action link is only what a note in the record says (it bears on both); with none, the document says so.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { parseRecord } from '@/lib/lex/action-record'
import { activeConditions } from '@/lib/lex/action-conditions'
import { readConditions } from '@/lib/lex/action-conditions-server'
import { listRegistry } from '@/lib/lex/source-registry'
import { plainFoldHeader } from '@/lib/lex/action-resort-pure'
import { currentVersion } from '@/lib/lex/action-draft-pure'
import { draftsFor, packDocuments } from '@/lib/lex/action-documents'
import { touchesFor } from '@/lib/lex/action-touches'
import { SET_ASIDE_PREFIX, DISMISSED_PREFIX } from '@/lib/lex/update-pass'
import { staleness, staleSentence, type StoredJudge, type StoredModelOutput } from '@/lib/lex/action-digest-pure'
import {
  PACK_SLOT_KEYS, type ActionsPackData, type PackAction, type PackDigest, type PackNote, type PackSetAside, type PackSlot, type PackSlotKey,
} from './actions-pack-types'

const refsIn = (s: string): number[] => [...s.matchAll(/\[Ref:\s*(\d+)\s*\]/gi)].map((m) => Number(m[1]))
const uniq = <T,>(a: T[]): T[] => [...new Set(a)]
const PART_RE = /^• \[#(\d+)\] “([\s\S]*)”(?: \(([^()]*)\))?(?: — ([\s\S]*))?$/

/** Split a commentary into its prose and the quoted parts of a bigger action (the bullets `foldLine` writes). Pure. */
export function splitCommentary(commentary: string | null | undefined): { detail: string | null; parts: PackAction['parts'] } {
  const lines = plainFoldHeader(commentary).split('\n')
  const parts: PackAction['parts'] = []
  const kept: string[] = []
  for (const l of lines) {
    if (l.startsWith('• [#')) {
      const m = PART_RE.exec(l.trim())
      if (m) { parts.push({ number: Number(m[1]), quote: m[2].trim(), title: m[3]?.trim() || null, reason: m[4]?.trim() || null, refs: uniq(refsIn(l)) }); continue }
    }
    if (l.trim() === 'Parts of this action, quoted') continue
    kept.push(l)
  }
  const detail = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { detail: detail || null, parts }
}

export async function readActionsPackData(
  ideaId: string,
  opts: { actionEvidenceRefs: Map<string, number[]>; issues: Array<{ id: string; title: string | null; text: string; status: string; current: boolean }> },
): Promise<ActionsPackData> {
  const [headings, cond, causes, rows, ruled, notes, registry, options, rejected, digests] = await Promise.all([
    prisma.actionHeading.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, purpose: true, hidden: true } }),
    readConditions(ideaId),
    prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, number: true, cause: true } }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, number: true, title: true, practicalStep: true, whoImplements: true, headingId: true, targetCauseIds: true, avenue: true, parked: true, parkedReason: true,
        record: true, conditionIds: true, supportOnly: true, commentary: true, policyTestVerdict: true, policyTestReason: true, conflictNote: true, sequence: true, beforeIds: true,
      },
    }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId, status: 'RULED_OUT' }, orderBy: [{ number: 'asc' }],
      select: { number: true, title: true, practicalStep: true, headingId: true, ruleOutReason: true, updatedAt: true },
    }),
    // only notes IN THE RECORD and not private: the record is what reaches a document
    prisma.researchNote.findMany({ where: { ideaId, status: 'IN_RECORD', mineOnly: false }, orderBy: { createdAt: 'asc' }, include: { source: { select: { number: true, kind: true, title: true } } } }),
    listRegistry(ideaId),
    prisma.policyOption.findMany({ where: { ideaId, status: 'RULED_OUT', mergedIntoId: null }, orderBy: { number: 'asc' }, select: { number: true, approach: true, ruleOutReason: true, updatedAt: true } }),
    prisma.evidenceItem.findMany({ where: { ideaId, status: 'REJECTED', OR: [{ note: { startsWith: SET_ASIDE_PREFIX } }, { note: { startsWith: DISMISSED_PREFIX } }] }, orderBy: { createdAt: 'asc' }, select: { title: true, body: true, note: true, createdAt: true, sourceId: true } }),
    prisma.actionDigest.findMany({ where: { ideaId, status: 'READY' }, orderBy: { createdAt: 'desc' } }),
  ])

  const causeNum = new Map(causes.map((c, i) => [c.id, c.number ?? i + 1]))
  const active = activeConditions(cond)
  const condNum = new Map(active.map((c, i) => [c.id, i + 1]))
  const numById = new Map(rows.map((r) => [r.id, r.number]))
  const authorIds = uniq(notes.map((n) => n.authorId))
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, preferredName: true, name: true } }) : []
  const authorName = new Map(authors.map((u) => [u.id, u.preferredName?.trim() || u.name?.trim() || 'A team member']))

  const bears = (n: (typeof notes)[number]) => (Array.isArray(n.bearsOn) ? (n.bearsOn as unknown as Array<{ kind: string; id: string; label?: string }>) : [])

  // 26-V1 — the drafting instruction from the documents store, and every document on each action (current version), in number order.
  const [drafts, docsByAction] = await Promise.all([draftsFor(rows.map((r) => r.id)), packDocuments(ideaId)])

  const actions: PackAction[] = rows.flatMap((r): PackAction[] => {
    if (r.number == null) return []
    const rec = parseRecord(r.record)
    const slots: Partial<Record<PackSlotKey, PackSlot>> = {}
    for (const k of PACK_SLOT_KEYS) {
      if (k === 'who') { const t = r.whoImplements?.trim(); if (t) slots.who = { text: t }; continue }
      const s = rec[k]
      if (!s?.text?.trim()) continue // a proposal beside an empty slot is NOT an answer
      slots[k] = { text: s.text.trim(), ...(k === 'incentiveNow' ? { direction: s.direction ?? null } : {}), ...(k === 'whatChangesIt' ? { linkActionId: s.linkActionId ?? null, linkNumber: s.linkActionId ? numById.get(s.linkActionId) ?? null : null } : {}) }
    }
    const { detail, parts } = splitCommentary(r.commentary)
    const mine = notes.filter((n) => bears(n).some((b) => b.kind === 'action' && b.id === r.id))
    const noteRows = mine.map((n) => ({ text: (n.comment ?? n.quote ?? '').trim(), ref: n.source?.number ?? null, author: authorName.get(n.authorId) ?? 'A team member', at: n.createdAt.toISOString(), stance: n.stance })).filter((n) => n.text)
    const refs = uniq([
      ...(opts.actionEvidenceRefs.get(r.id) ?? []), ...refsIn(r.commentary ?? ''), ...parts.flatMap((p) => p.refs),
      ...noteRows.map((n) => n.ref).filter((x): x is number => x != null),
    ]).sort((a, b) => a - b)
    return [{
      id: r.id, number: r.number, title: r.title, statement: r.practicalStep, headingId: r.headingId, avenue: r.avenue,
      causeNumbers: r.targetCauseIds.map((id) => causeNum.get(id)).filter((n): n is number => n != null).sort((a, b) => a - b),
      conditionNumbers: r.conditionIds.map((id) => condNum.get(id)).filter((n): n is number => n != null).sort((a, b) => a - b),
      support: r.supportOnly,
      policyTest: r.policyTestVerdict ? { verdict: r.policyTestVerdict, reason: r.policyTestReason, conflictNote: r.conflictNote } : null,
      slots, sequence: r.sequence, beforeNumbers: r.beforeIds.map((id) => numById.get(id)).filter((n): n is number => n != null).sort((a, b) => a - b),
      parked: r.parked, parkedReason: r.parkedReason, detail, parts, refs, notes: noteRows,
      // 26-U §3/§4 — the current drafting-instruction version, and (filled below) what it touches, computed, never written.
      draft: currentVersion(drafts.get(r.id)), touches: null,
      documents: docsByAction.get(r.id) ?? [],
    }]
  })

  // 26-U §4 — what each drafted action touches, computed now from its current instruction (the documents print it; nothing is stored).
  // The held provision text is for the screen, not the stored snapshot: the documents print the line, its state and its counts.
  for (const a of actions) if (a.draft?.provisions.some((p) => p.relation !== 'precedent')) a.touches = (await touchesFor(a.draft)).touches.map((t) => ({ ...t, heldText: null }))

  const ruledOut = ruled.flatMap((r) => (r.number == null ? [] : [{ number: r.number, title: r.title, statement: r.practicalStep, headingId: r.headingId, reason: r.ruleOutReason, lastChanged: r.updatedAt.toISOString() }]))

  // ── the latest READY digest of each scope, with how far the list has moved since ──
  const liveByHeading = new Map<string | null, string[]>()
  for (const r of rows) liveByHeading.set(r.headingId, [...(liveByHeading.get(r.headingId) ?? []), r.id])
  const seen = new Set<string>()
  const packDigests: PackDigest[] = []
  for (const d of digests) {
    const key = `${d.scope}:${d.headingId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const j = d.judgeOutput && typeof d.judgeOutput === 'object' && 'digest' in (d.judgeOutput as object) ? (d.judgeOutput as unknown as StoredJudge) : null
    if (!j) continue
    const now = d.scope === 'SET' ? rows.map((r) => r.id) : liveByHeading.get(d.headingId) ?? []
    const st = staleness(d.actionIds, now)
    const outs = Array.isArray(d.modelOutputs) ? (d.modelOutputs as unknown as StoredModelOutput[]) : []
    packDigests.push({
      scope: d.scope as 'HEADING' | 'SET', headingId: d.headingId, headingName: d.headingName, createdAt: d.createdAt.toISOString(),
      staleNote: st.stale ? staleSentence(d.scope as 'HEADING' | 'SET', d.headingName, st) : null, answering: outs.filter((o) => o.status === 'OK').length,
      answers: j.digest.answers, disagreements: j.digest.disagreements,
      gaps: j.digest.gaps.map((g) => ({ item: g.item, whatFails: g.whatFails, category: g.category, namedBy: g.namedBy })),
    })
  }

  // ── considered, not taken (decision 150): set-aside notes, set-aside findings, ruled-out policy options ──
  const setAsideNotes = await prisma.researchNote.findMany({ where: { ideaId, status: 'SET_ASIDE', mineOnly: false }, orderBy: { setAsideAt: 'asc' }, include: { source: { select: { number: true } } } })
  const setAside: PackSetAside[] = [
    ...setAsideNotes.map((n): PackSetAside => ({ kind: 'NOTE', text: (n.comment ?? n.quote ?? '').trim(), reason: n.setAsideReason, at: n.setAsideAt?.toISOString() ?? null, ref: n.source?.number ?? null })),
    ...rejected.map((e): PackSetAside => ({
      kind: 'FINDING', text: `${e.title}${e.body ? ` - ${e.body}` : ''}`.trim(),
      reason: (e.note ?? '').startsWith(SET_ASIDE_PREFIX) ? `considered, not taken - ${(e.note ?? '').slice(SET_ASIDE_PREFIX.length)}` : `dismissed - ${(e.note ?? '').slice(DISMISSED_PREFIX.length)}`, at: e.createdAt.toISOString(), ref: null,
    })),
    ...options.map((o): PackSetAside => ({ kind: 'POLICY_OPTION', text: `Policy ${o.number ?? '?'}: ${o.approach}`, reason: o.ruleOutReason, at: o.updatedAt.toISOString(), ref: null })),
  ].filter((s) => s.text)

  const packNotes: PackNote[] = notes.map((n) => ({
    id: n.id, text: (n.comment ?? '').trim(), quote: n.quote?.trim() || null, ref: n.source?.number ?? null, stance: n.stance,
    bearsOn: bears(n).map((b) => b.label ?? `${b.kind}`), author: authorName.get(n.authorId) ?? 'A team member', at: n.createdAt.toISOString(),
  })).filter((n) => n.text || n.quote)

  // where notes in the record disagree: opposite stances on one thing, or a note marked as contradicting
  const byThing = new Map<string, { label: string; stances: Set<string>; notes: string[] }>()
  for (const n of notes) for (const b of bears(n)) {
    const k = `${b.kind}:${b.id}`
    const e = byThing.get(k) ?? { label: b.label ?? b.kind, stances: new Set<string>(), notes: [] }
    e.stances.add(n.stance); e.notes.push(`${n.source?.number ? `[Ref: ${n.source.number}] ` : ''}${(n.comment ?? n.quote ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)}`)
    byThing.set(k, e)
  }
  const disagreements = [...byThing.values()].filter((e) => e.stances.has('CONTRADICTS')).map((e) => ({ on: e.label, between: e.notes }))

  // issue -> actions: only what a note in the record bears on BOTH
  const issueActions = opts.issues.filter((i) => i.status === 'OPEN' && i.current).map((i) => {
    const nums = uniq(notes.filter((n) => bears(n).some((b) => b.kind === 'challenge' && b.id === i.id)).flatMap((n) => bears(n).filter((b) => b.kind === 'action').map((b) => numById.get(b.id)).filter((x): x is number => x != null))).sort((a, b) => a - b)
    return { issue: (i.title?.trim() || i.text).replace(/\s+/g, ' ').trim(), actionNumbers: nums }
  })

  return {
    headings, conditions: active.map((c, i) => ({ number: i + 1, text: c.text })), conditionsSource: cond.source?.label ?? null,
    causes: causes.map((c, i) => ({ number: c.number ?? i + 1, text: c.cause })),
    actions, ruledOut, digests: packDigests,
    registry: registry.map((s) => ({ number: s.number, title: s.title, citation: s.citation, url: s.url, kind: s.kind })),
    notes: packNotes, setAside, disagreements, issueActions,
  }
}
