// ─────────────────────────────────────────────────────────────────────────────
// 26-S §6 (decision 150) — THE POLICY REVIEW: what bears on the Guiding Policy, in one place, with a reason for every "no".
//
// WHAT EXISTED. The update pass (26-K) writes findings in five categories with accept / dismiss, in a collapsed box at the end of the
// kernel; the notebook (26-R) records notes with a `bearsOn` ("a cause, the policy, an action, a challenge, a decision"). So the PLACE
// for a note about the policy existed. What was missing is that nobody would see it. This is the count on the Guiding Policy header
// and the list behind it.
//
// THE RULES
//   · Two kinds of row: update-pass FINDINGS (EvidenceItem, MATERIAL_UPDATE, still PROPOSED — contradicts first) and NOTES whose
//     bears-on includes the policy (not set aside).
//   · A finding: ACCEPT (the existing `judgeUpdateItem`, so staleness and new causes work as they always did) · DISMISS (wrong — a
//     reason is required, kept on the row) · SET ASIDE (right, but not taking it — a reason is required, kept, and it appears in the
//     notebook as "considered, not taken").
//   · A note: put it in the record (owner) · it does not bear on the policy (the link is removed and the reason is a reply beneath —
//     nobody edits another person's comment) · SET ASIDE with a reason (the notebook's own rule: nothing deletes, the reason is research).
//   · ⚠ NO NEW STATUS VALUE. `EvidenceStatus` is a database enum (PROPOSED | ACCEPTED | REJECTED); "set aside" is REJECTED with a note
//     that begins `SET_ASIDE_PREFIX`, and a plain dismissal begins `DISMISSED_PREFIX`. Both stay out of every document (they are
//     REJECTED), and the two are told apart by those prefixes ONLY here, in this one file.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { UPDATE_PASS_KEY, SET_ASIDE_PREFIX, DISMISSED_PREFIX, listProposedChanges, judgeUpdateItem, type ProposedChangeView } from './update-pass'
import * as RN from './research-notes'
import type { BearsOnRef } from './research-notebook-schema'

export { SET_ASIDE_PREFIX, DISMISSED_PREFIX }
export const MIN_REASON = 3

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })
const bad = <T = never>(r: { ok: boolean }): Result<T> => fail<T>((r as unknown as { error: string }).error)

export interface PolicyReviewFinding extends ProposedChangeView { target: string | null }
export interface PolicyReviewNote {
  id: string; title: string; quote: string | null; comment: string | null; ref: number | null; stance: string
  status: string; mine: boolean; authorName: string; setAsideReason: string | null; createdAt: string
}
export interface SetAsideFinding { id: string; kind: string; title: string; body: string; reason: string; createdAt: string }

export interface PolicyReview {
  findings: PolicyReviewFinding[]
  notes: PolicyReviewNote[]
  setAside: { findings: SetAsideFinding[]; notes: PolicyReviewNote[] }
  /** The header's two numbers: findings still to judge, and notes that bear on the policy and are not set aside. */
  counts: { proposals: number; notes: number }
}

const targetOf = (fieldRef: string | null): string | null => {
  if (!fieldRef) return null
  const [kind, ref] = fieldRef.split(':')
  if (kind === 'causes') return `cause ${ref}`
  if (kind === 'policyOptions') return `candidate approach ${ref}`
  if (kind === 'actions') return 'a coherent action'
  return fieldRef === 'pivotalObstacle' ? 'the pivotal obstacle' : fieldRef === 'challenge' ? 'the problem statement' : fieldRef
}

/** True when a note's bears-on names the policy — any candidate approach or the settled one (a `policy` ref). */
export const bearsOnPolicy = (bearsOn: ReadonlyArray<Pick<BearsOnRef, 'kind'>>): boolean => bearsOn.some((b) => b.kind === 'policy')

export async function readPolicyReview(ideaId: string, viewer: RN.Viewer): Promise<PolicyReview> {
  const [proposed, nb, rejected] = await Promise.all([
    listProposedChanges(ideaId),
    RN.readNotebook(ideaId, viewer, { includeLex: false, includeSetAside: true }),
    prisma.evidenceItem.findMany({
      where: { ideaId, passKey: UPDATE_PASS_KEY, status: 'REJECTED', note: { startsWith: SET_ASIDE_PREFIX } },
      orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, title: true, body: true, note: true, createdAt: true },
    }),
  ])
  // Contradicts first, then the rest, newest run first within each (listProposedChanges already orders by run).
  const findings = [...proposed.filter((p) => p.kind === 'CONTRADICTS'), ...proposed.filter((p) => p.kind !== 'CONTRADICTS')]
    .map((p) => ({ ...p, target: targetOf(p.fieldRef) }))
  const toNote = (n: RN.NoteView): PolicyReviewNote => ({
    id: n.id, title: RN.noteTitleOf(n), quote: n.quote, comment: n.comment, ref: n.source?.number ?? null, stance: n.stance, status: n.status,
    mine: n.mine, authorName: n.authorName, setAsideReason: n.setAsideReason, createdAt: n.createdAt,
  })
  const onPolicy = nb.notes.filter((n) => !n.lex && bearsOnPolicy(n.bearsOn))
  return {
    findings,
    notes: onPolicy.filter((n) => n.status !== 'SET_ASIDE').map(toNote),
    setAside: {
      findings: rejected.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, reason: (r.note ?? '').slice(SET_ASIDE_PREFIX.length), createdAt: r.createdAt.toISOString() })),
      notes: onPolicy.filter((n) => n.status === 'SET_ASIDE').map(toNote),
    },
    counts: { proposals: findings.length, notes: onPolicy.filter((n) => n.status !== 'SET_ASIDE').length },
  }
}

/** The header sentence — "4 proposals and 2 of your notes bear on this policy". Exported so the check reads the words the screen prints. */
export function headerSentence(c: { proposals: number; notes: number }): string | null {
  if (c.proposals === 0 && c.notes === 0) return null
  const p = `${c.proposals} proposal${c.proposals === 1 ? '' : 's'}`
  const n = `${c.notes} of your note${c.notes === 1 ? '' : 's'}`
  const both = c.proposals > 0 && c.notes > 0
  const subject = both ? `${p} and ${n} bear` : c.proposals > 0 ? `${p} ${c.proposals === 1 ? 'bears' : 'bear'}` : `${n} ${c.notes === 1 ? 'bears' : 'bear'}`
  return `${subject} on this policy`
}

const reasonOf = (s: string | undefined | null): string => (s ?? '').trim()
const needReason = (what: string, s: string | undefined | null): string | null =>
  reasonOf(s).length >= MIN_REASON ? null : `${what} needs a reason (at least ${MIN_REASON} characters) — it is kept, because why something was not taken is itself research. Nothing was changed.`

// ── findings ─────────────────────────────────────────────────────────────────────────────────────────────

async function pendingFinding(ideaId: string, evidenceId: string) {
  return prisma.evidenceItem.findFirst({ where: { id: evidenceId, ideaId, passKey: UPDATE_PASS_KEY } })
}

export async function acceptFinding(ideaId: string, evidenceId: string): Promise<Result<{ accepted: true }>> {
  const r = await judgeUpdateItem(ideaId, evidenceId, 'ACCEPTED')
  return r.ok ? { ok: true, data: { accepted: true } } : fail(r.error ?? 'That could not be accepted. Nothing was changed.')
}

export async function dismissFinding(ideaId: string, evidenceId: string, reason: string): Promise<Result<{ dismissed: true }>> {
  const why = needReason('Dismissing a proposal', reason)
  if (why) return fail(why)
  const row = await pendingFinding(ideaId, evidenceId)
  if (!row) return fail('That proposal is not on this idea. Nothing was changed.')
  if (row.status !== 'PROPOSED') return fail('That proposal has already been judged. Nothing was changed.')
  await prisma.evidenceItem.update({ where: { id: row.id }, data: { status: 'REJECTED', note: `${DISMISSED_PREFIX}${reasonOf(reason)}` } })
  return { ok: true, data: { dismissed: true } }
}

export async function setAsideFinding(ideaId: string, evidenceId: string, reason: string): Promise<Result<{ setAside: true }>> {
  const why = needReason('Setting a proposal aside', reason)
  if (why) return fail(why)
  const row = await pendingFinding(ideaId, evidenceId)
  if (!row) return fail('That proposal is not on this idea. Nothing was changed.')
  if (row.status !== 'PROPOSED') return fail('That proposal has already been judged. Nothing was changed.')
  await prisma.evidenceItem.update({ where: { id: row.id }, data: { status: 'REJECTED', note: `${SET_ASIDE_PREFIX}${reasonOf(reason)}` } })
  return { ok: true, data: { setAside: true } }
}

export async function restoreFinding(ideaId: string, evidenceId: string): Promise<Result<{ restored: true }>> {
  const row = await pendingFinding(ideaId, evidenceId)
  if (!row || row.status !== 'REJECTED' || !(row.note ?? '').startsWith(SET_ASIDE_PREFIX)) return fail('That is not a set-aside proposal on this idea. Nothing was changed.')
  await prisma.evidenceItem.update({ where: { id: row.id }, data: { status: 'PROPOSED', note: null } })
  return { ok: true, data: { restored: true } }
}

// ── notes ────────────────────────────────────────────────────────────────────────────────────────────────

/** "It does not bear on the policy": the policy link comes off the note (the note stays), and the reason is a reply beneath it. */
export async function dismissNoteFromPolicy(ideaId: string, viewer: RN.Viewer, noteId: string, reason: string): Promise<Result<{ unlinked: true }>> {
  const why = needReason('Saying a note does not bear on the policy', reason)
  if (why) return fail(why)
  const note = await prisma.researchNote.findFirst({ where: { id: noteId, ideaId } })
  if (!note || !RN.canSeeNote(note, viewer.id)) return fail('That note is not on this idea. Nothing was changed.')
  if (note.authorId !== viewer.id && !viewer.isOwner) return fail('Only the person who wrote a note, or the idea’s owner, can change what it bears on. You can reply beneath it instead. Nothing was changed.')
  const bears = (Array.isArray(note.bearsOn) ? note.bearsOn : []) as unknown as BearsOnRef[]
  if (!bearsOnPolicy(bears)) return fail('That note does not bear on the policy now. Nothing was changed.')
  await prisma.researchNote.update({ where: { id: note.id }, data: { bearsOn: bears.filter((b) => b.kind !== 'policy') as never } })
  const rep = await RN.reply(ideaId, viewer, note.id, `Does not bear on the policy: ${reasonOf(reason)}`)
  if (!rep.ok) return bad(rep)
  return { ok: true, data: { unlinked: true } }
}

export async function setAsideNote(ideaId: string, viewer: RN.Viewer, noteId: string, reason: string): Promise<Result<{ setAside: true }>> {
  const why = needReason('Setting a note aside', reason)
  if (why) return fail(why)
  const r = await RN.setAside(ideaId, viewer, viewer.id, [noteId], reasonOf(reason))
  return r.ok ? { ok: true, data: { setAside: true } } : bad(r)
}

export async function restoreNote(ideaId: string, viewer: RN.Viewer, ownerId: string, noteId: string): Promise<Result<{ restored: true }>> {
  const r = await RN.restore(ideaId, viewer, ownerId, [noteId])
  return r.ok ? { ok: true, data: { restored: true } } : bad(r)
}

export async function acceptNote(ideaId: string, viewer: RN.Viewer, noteId: string): Promise<Result<{ inRecord: true }>> {
  const r = await RN.putInRecord(ideaId, viewer, [noteId])
  return r.ok ? { ok: true, data: { inRecord: true } } : bad(r)
}
