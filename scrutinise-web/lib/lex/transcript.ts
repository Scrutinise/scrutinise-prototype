// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — appending to the ONE conversation store.
//
// `Idea.aiChatHistory` is the transcript. The elicitation and the build write into it
// rather than keeping a store of their own, for the reason CreateIdeaClient already
// gives about the Deepening's "work on this with Lex": a second conversation store
// beside aiChatHistory is a second source of truth about what was said, which is the
// condition the Lex rebuild removed.
//
// It also buys continuity for free. When a 25-A build finishes and the user lands in
// the existing three-panel view, the four exchanges and Lex's confirmation are already
// in the chat above the draft — because they were never anywhere else.
//
// ⚠ THREE OTHER COPIES OF THIS FUNCTION EXIST — orchestrator.pushLex,
// fields/route.postLexPointer and stage.postLexBubble. They are byte-identical in
// effect and were not repointed at this file in 25-A only because they sit in files two
// other threads are working in this week. Repointing them is a five-line change and is
// noted in docs/BUILD_25A_REPORT.md; a fourth divergent copy is exactly how
// CHILD_ENTITY_FIELDS drifted.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { stripNullBytes } from './json-safe'

export interface TranscriptMessage {
  role: string
  content: string
  timestamp?: string
  /** The Lex page / stage this was said in. 25-A uses 'ELICITATION' and 'BUILD'. */
  stage?: string
  /** The field or step it was said ABOUT. Used to count problem-gate presses. */
  field?: string
}

const CAP = 60

export async function readTranscript(ideaId: string): Promise<TranscriptMessage[]> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  return Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as unknown as TranscriptMessage[]) : []
}

/** Append messages to the transcript, newest last, capped as everywhere else. */
export async function appendTranscript(ideaId: string, msgs: TranscriptMessage[]): Promise<void> {
  const keep = msgs.filter((m) => m.content?.trim())
  if (!keep.length) return
  const now = new Date().toISOString()
  const existing = await readTranscript(ideaId)
  const updated = [...existing, ...keep.map((m) => ({ timestamp: now, ...m }))].slice(-CAP)
  // NUL-stripped: `aiChatHistory` is jsonb, and a single U+0000 — from a paste, or from
  // a model emitting the escape — makes PostgreSQL reject the whole write and lose the
  // conversation. See lib/lex/json-safe.ts for the incident that found this class.
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: stripNullBytes(updated) as never } })
}

export function lexBubble(content: string, stage: string, field?: string): TranscriptMessage {
  return { role: 'lex', content, stage, field }
}

export function userBubble(content: string, stage: string, field?: string): TranscriptMessage {
  return { role: 'user', content, stage, field }
}
