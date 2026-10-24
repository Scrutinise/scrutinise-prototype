// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §3 — THE DOCUMENT VIEW, its server half: one read that answers everything the view shows.
//
//   documentView   — openDocument's data, plus for a drafting instruction: every version's instruction (the Instruction tab's table), what
//                    each version changed and which law rows it wrote or withdrew (Versions), Lex's waiting proposal with its reasoning (the
//                    comparison, 3g), the reasoning of the proposal the current version came from ("Why Lex drafted it this way"), and the
//                    action's LIVE law rows named for the header strip (263).
//   actionDocuments — the record's Documents section (3h): one action's row of the tree.
//
// ⚠ Read-only. ⚠ Never an internal id in a sentence: law rows are named by their Act's title and provision.
// ⚠ An instruction row's version is read from its source_detail ("<action id> v<n>", 26-U §5); a withdrawal from its withdrawn_detail
//   ("<action id> instruction v<n>: target absent").
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { openDocument, documentTree, type TreeActionRow } from './action-documents'
import { parseDraft, type DraftInstruction } from './action-draft-pure'
import { targetTitle } from './statutory-graph'
import { heldSectionText } from './action-touches'
import { versionChange, changeWords, type VersionChange } from './document-view-pure'
import { provisionWords, instructionVersion, RELATION_WORD } from './law-panel-words'
import type { LawRelation } from './idea-law-pure'
import { issuesOn } from './issue-attach'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const instructionOf = (payload: unknown): DraftInstruction => {
  const { v: _v, by: _b, at: _a, ...ins } = parseDraft({ versions: [{ ...(payload as object), v: 1 }] })!.versions[0]
  void _v; void _b; void _a
  return ins
}

export interface LawRowWords { relation: LawRelation; target: string; docUri: string; provisionPath: string | null }
export interface ViewVersion {
  v: number; author: string; at: string
  /** The proposal this version was made from (a LEX version is a used proposal). */
  fromProposal: number | null
  previousAuthor: string | null
  instruction: DraftInstruction | null
  change: VersionChange | null; changeWords: string | null
  lawWritten: LawRowWords[]; lawWithdrawn: LawRowWords[]
}
export interface DocumentViewData {
  doc: Extract<Awaited<ReturnType<typeof openDocument>>, { ok: true }>['data']
  actionId: string
  /** The action's avenue is legislative: a clause (with provision lines) rather than plain wording. */
  legislative: boolean
  isInstruction: boolean
  versions: ViewVersion[]
  current: ViewVersion | null
  /** Why Lex drafted the CURRENT version this way: the reasoning of the proposal it came from (null for the owner's own version). */
  currentReason: string | null
  proposal: { v: number; at: string; reason: string; pence: number | null; instruction: DraftInstruction } | null
  /** 26-V1b §5 — Lex's waiting proposal on a document that is NOT the clause (the explanatory note): its text, beside the versions. */
  textProposal: { v: number; at: string; reason: string; pence: number | null; body: string } | null
  /** Dismissed proposals, named in words in Versions ("set aside on 23 Oct when v2 arrived"). */
  setAside: Array<{ v: number; at: string; answeredAt: string | null; replacedBy: number | null }>
  law: { live: LawRowWords[]; precedents: number }
  /** Act titles for every docUri the view names, so no screen prints a bare id where a title is held. */
  titles: Record<string, string | null>
  /** 26-V1b §4 — the held text of every section the current instruction amends, repeals or modifies, keyed `docUri|provisionPath`
   *  (the three views are computed from it on the screen; pure). `text` null with the reason in words when it is not held. */
  held: Record<string, { text: string | null; reason: string }>
  /** 26-V2c (§7) — the open issues attached to this document, in part order (partN null = the document as a whole). */
  issues: Array<{ id: string; title: string | null; text: string; partN: number | null; attachedBy: string | null; attachReason: string | null; sourceModel: string | null }>
}

async function titlesFor(uris: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  for (const u of [...new Set(uris)]) out[u] = await targetTitle(u).catch(() => null)
  return out
}

const lawWords = (r: { relation: string; docUri: string; provisionPath: string | null }, titles: Record<string, string | null>): LawRowWords => ({
  relation: r.relation as LawRelation, docUri: r.docUri, provisionPath: r.provisionPath,
  target: `${titles[r.docUri] ?? r.docUri}${r.provisionPath ? `, ${provisionWords(r.provisionPath)}` : ''}`,
})

export async function documentView(ideaId: string, documentId: string): Promise<Result<DocumentViewData>> {
  const opened = await openDocument(ideaId, documentId)
  if ('error' in opened) return { ok: false, error: opened.error }
  const doc = opened.data
  const isInstruction = doc.kind === 'DRAFT_CLAUSE'
  const rows = await prisma.actionDocumentVersion.findMany({ where: { documentId }, orderBy: [{ createdAt: 'asc' }, { v: 'asc' }] })
  const versionRows = rows.filter((r) => r.role === 'VERSION')
  const proposalRows = rows.filter((r) => r.role === 'PROPOSAL')

  // Law rows: only a drafting instruction writes them (26-U §5), all of them on the action.
  const actionId = (await prisma.actionDocument.findUnique({ where: { id: documentId }, select: { actionId: true } }))!.actionId
  const legislative = (await prisma.lexCoherentAction.findUnique({ where: { id: actionId }, select: { avenue: true } }))?.avenue === 'LEGISLATIVE'
  const lawRows = isInstruction ? await prisma.ideaLawLink.findMany({
    where: { actionId, source: 'drafting_instruction' },
    select: { relation: true, docUri: true, provisionPath: true, sourceDetail: true, supersededById: true, withdrawnAt: true, withdrawnDetail: true },
    orderBy: { createdAt: 'asc' },
  }) : []
  const instructions = versionRows.map((r) => (isInstruction ? instructionOf(r.payload) : null))
  const pending = proposalRows.filter((r) => !r.answer).at(-1) ?? null
  const titles = await titlesFor([
    ...lawRows.map((r) => r.docUri),
    ...instructions.flatMap((i) => i ? [...i.provisions.map((p) => p.docUri), ...i.precedents.map((p) => p.docUri)] : []),
    ...(pending && isInstruction ? [...instructionOf(pending.payload).provisions.map((p) => p.docUri), ...instructionOf(pending.payload).precedents.map((p) => p.docUri)] : []),
  ])

  const versions: ViewVersion[] = versionRows.map((r, i) => {
    // A LEX version is a used proposal: the last proposal answered ACCEPTED at or before the version was written.
    const used = r.author === 'LEX' ? proposalRows.filter((p) => p.answer === 'ACCEPTED' && p.answeredAt && p.answeredAt <= new Date(r.createdAt.getTime() + 5_000)).at(-1) : undefined
    const ins = instructions[i]
    const prevIns = i > 0 ? instructions[i - 1] : null
    const change = ins ? versionChange(prevIns, ins) : null
    return {
      v: r.v, author: r.author, at: r.createdAt.toISOString(), fromProposal: used?.v ?? null, previousAuthor: i > 0 ? versionRows[i - 1].author : null,
      instruction: ins, change, changeWords: change ? changeWords(change, i === 0) : null,
      lawWritten: lawRows.filter((l) => instructionVersion(l.sourceDetail) === r.v).map((l) => lawWords(l, titles)),
      lawWithdrawn: lawRows.filter((l) => l.withdrawnAt && instructionVersion((l.withdrawnDetail ?? '').replace(/: .*$/, '')) === r.v).map((l) => lawWords(l, titles)),
    }
  })
  const current = versions.at(-1) ?? null
  // §4 — the held text of each amended section, for the three views (free: a read of the corpus).
  const held: DocumentViewData['held'] = {}
  for (const p of current?.instruction?.provisions ?? []) {
    if (!['amends', 'repeals', 'modifies'].includes(p.relation)) continue
    const k = `${p.docUri}|${p.provisionPath ?? ''}`
    if (!(k in held)) held[k] = await heldSectionText(p.docUri, p.provisionPath).catch((e) => ({ text: null, reason: `could not be read (${e instanceof Error ? e.message : String(e)})` }))
  }
  const usedFrom = current?.fromProposal != null ? proposalRows.find((p) => p.v === current.fromProposal) : undefined
  const live = lawRows.filter((l) => !l.supersededById && !l.withdrawnAt)
  return {
    ok: true,
    data: {
      doc, actionId, legislative, isInstruction, versions, current,
      currentReason: usedFrom?.reason ?? null,
      proposal: pending && isInstruction ? { v: pending.v, at: pending.createdAt.toISOString(), reason: pending.reason ?? '', pence: pending.pence == null ? null : Number(pending.pence), instruction: instructionOf(pending.payload) } : null,
      textProposal: pending && !isInstruction ? { v: pending.v, at: pending.createdAt.toISOString(), reason: pending.reason ?? '', pence: pending.pence == null ? null : Number(pending.pence), body: pending.body } : null,
      setAside: proposalRows.filter((p) => p.answer === 'DISMISSED').map((p) => ({ v: p.v, at: p.createdAt.toISOString(), answeredAt: p.answeredAt?.toISOString() ?? null, replacedBy: proposalRows.find((q) => q.v > p.v)?.v ?? null })),
      law: { live: live.filter((l) => l.relation !== 'precedent').map((l) => lawWords(l, titles)), precedents: live.filter((l) => l.relation === 'precedent').length },
      titles, held,
      issues: await issuesOn(ideaId, { documentId }),
    },
  }
}

/** The record's Documents section (3h): this action's documents and missing kinds, as the tree has them, plus each document's live law rows. */
export async function actionDocuments(ideaId: string, actionId: string): Promise<Result<TreeActionRow & { lawRows: number; law: Array<LawRowWords & { version: number | null }> }>> {
  const tree = await documentTree(ideaId, { recordStale: true })
  const row = tree.headings.flatMap((h) => h.actions).find((a) => a.id === actionId)
  if (!row) return { ok: false, error: 'That action is not on this idea’s live list, so it has no documents to show.' }
  const live = await prisma.ideaLawLink.findMany({
    where: { actionId, source: 'drafting_instruction', supersededById: null, withdrawnAt: null },
    select: { relation: true, docUri: true, provisionPath: true, sourceDetail: true }, orderBy: { createdAt: 'asc' },
  })
  const titles = await titlesFor(live.map((l) => l.docUri))
  return { ok: true, data: { ...row, lawRows: live.length, law: live.map((l) => ({ ...lawWords(l, titles), version: instructionVersion(l.sourceDetail) })) } }
}

/** A relation in words, for a line of the Instruction table. */
export const relationWord = (r: LawRelation): string => RELATION_WORD[r]
