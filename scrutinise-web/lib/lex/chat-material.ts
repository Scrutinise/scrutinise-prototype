// ─────────────────────────────────────────────────────────────────────────────
// DECISION 92 — LEX FILES MATERIAL INTO THE IDEA, FROM THE CHAT ITSELF.
//
// §1: "From the chat, Lex can add a URL, a file, or a source to the idea's material — the
// same place an upload goes. ⚠ Never an errand. 'Certainly' followed by instructions to do
// it yourself is the failure; Lex either files it or says plainly why it cannot."
//
// ⚠⚠ THE FILING IS DETERMINISTIC, NOT A MODEL DECISION. A URL in the user's message is
// found by the platform, BEFORE Lex is ever called, and filed through the identical
// pipeline `POST /api/ideas/[id]/material` uses (`extractUrl`, `runMaterialFindings`,
// the same cap, the same rejection logging). This is what makes "never an errand" a
// property of the system rather than a hope about what the model chooses to do: Lex is
// never asked to decide whether to file something and never asked to call a tool that
// might not fire — the platform has already acted, and Lex's only job is to report what
// happened, in `materialFiledBlock` below, truthfully.
//
// A "file" mentioned in chat cannot be attached from a text message (the chat body is a
// string — see BodySchema in the route); files already go through YourMaterial's own "+"
// control beside the composer, which is "the same place an upload goes" for that case. A
// "source" named without a link is handled by prompt instruction alone (see the block's
// own text below) — there is nothing here that can fetch an unlinked reference by title.
//
// §6 — FETCHED CONTENT IS DATA, NEVER INSTRUCTION. Nothing here puts a fetched page's raw
// text anywhere near the main conversational turn. It only ever reaches
// `runMaterialFindings`'s own isolated, single-purpose extraction pass — the same pass an
// upload already goes through, whose own SYSTEM prompt (lib/lex/user-material.ts) treats
// the document strictly as a source to quote from, never as instructions to follow. This
// block hands Lex only the OUTCOME (filed/not, a count, short titles) — never the
// document's text — so a page engineered to redirect a model reading it has no route to
// the model actually holding the conversation.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { extractUrl, runMaterialFindings, MaterialRejected, createLinkMaterial, MAX_MATERIALS_PER_IDEA } from './user-material'
import { logRejection } from './material-rejection'

/** A conservative cap on how many links one chat turn will attempt to file — bounds the
 *  cost and the wait of a single message that happens to contain several URLs. */
const MAX_URLS_PER_TURN = 2

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

/** URLs in the message, deduped, trimmed of trailing punctuation a sentence would leave
 *  attached to a link ("...see https://gov.uk/x." → the trailing "." is not part of it). */
export function urlsIn(message: string): string[] {
  const found = message.match(URL_RE) ?? []
  const cleaned = found.map((u) => u.replace(/[.,;:!?)\]]+$/, ''))
  return Array.from(new Set(cleaned)).slice(0, MAX_URLS_PER_TURN)
}

interface FileResult {
  url: string
  outcome: 'filed' | 'already-filed' | 'refused' | 'cap-reached' | 'error'
  findingCount?: number
  note?: string | null
  reason?: string
}

/**
 * File every URL in `message` that is not already attached to this idea, through the
 * exact pipeline an upload uses. Returns one result per URL found, whatever happened —
 * never throws, because a failed filing is itself the report, not an outage.
 */
export async function fileUrlsFromChat(ideaId: string, userId: string, message: string): Promise<FileResult[]> {
  const urls = urlsIn(message)
  if (!urls.length) return []

  const results: FileResult[] = []
  for (const url of urls) {
    // Dedupe against what is already on the idea — the same link mentioned again in
    // conversation must not re-fetch and re-file a second copy.
    const existing = await prisma.ideaUserMaterial.findFirst({
      where: { ideaId, url, kind: 'LINK' },
      select: { id: true, findingCount: true, label: true },
    })
    if (existing) {
      results.push({ url, outcome: 'already-filed', findingCount: existing.findingCount })
      continue
    }

    const count = await prisma.ideaUserMaterial.count({ where: { ideaId } })
    if (count >= MAX_MATERIALS_PER_IDEA) {
      results.push({ url, outcome: 'cap-reached' })
      continue
    }

    try {
      const extracted = await extractUrl(url)
      // ⚠ SAME FUNCTION THE UPLOAD ROUTE CALLS (`createLinkMaterial`, user-material.ts) —
      // a link volunteered mid-conversation carries the same liability rule as an
      // uploaded one (§25.6): the user is the one who put it in the message, so the
      // assertion is implicit in the act of sharing it, exactly as pasting it into the
      // material panel would be.
      const created = await createLinkMaterial({ ideaId, extracted, addedBy: userId, rightsConfirmed: true })
      const findings = await runMaterialFindings(created.id)
      results.push({ url, outcome: 'filed', findingCount: findings.written, note: findings.note })
    } catch (err) {
      if (err instanceof MaterialRejected) {
        await logRejection({ ideaId, userId, kind: err.kind, target: url, detail: err.message })
        results.push({ url, outcome: 'refused', reason: err.message })
      } else {
        console.error('[chat-material] filing THREW', { ideaId, url, error: err instanceof Error ? err.message : err })
        results.push({ url, outcome: 'error', reason: 'That could not be added. Nothing was stored.' })
      }
    }
  }
  return results
}

/**
 * ⚠ THE REPORT LEX IS GIVEN — NEVER THE DOCUMENT TEXT. §2: "Lex says what it filed and
 * what it found." §5: "if a link is filed but cannot be read, say so to the user." Every
 * branch below is a fact the platform already established; Lex is told to relay it, not
 * to interpret or embellish it.
 */
export function materialFiledBlock(results: FileResult[]): string | null {
  if (!results.length) return null
  const lines = results.map((r) => {
    if (r.outcome === 'filed') {
      return r.findingCount && r.findingCount > 0
        ? `- ${r.url} — FILED and read: ${r.findingCount} finding${r.findingCount === 1 ? '' : 's'} taken from it, under the questions they answer.`
        : `- ${r.url} — FILED and read, but ${r.note ?? 'nothing in it bore on the proposal'}.`
    }
    if (r.outcome === 'already-filed') {
      return `- ${r.url} — already on this idea's material (${r.findingCount ?? 0} finding${r.findingCount === 1 ? '' : 's'} on record); not re-fetched.`
    }
    if (r.outcome === 'cap-reached') {
      return `- ${r.url} — NOT filed. This idea already holds the maximum ${MAX_MATERIALS_PER_IDEA} documents; something would need removing first.`
    }
    // 'refused' | 'error'
    return `- ${r.url} — NOT filed. ${r.reason}`
  })
  return [
    'MATERIAL FILED THIS TURN (the platform already acted — report this plainly, in your own',
    'words, in chatText; never say you will file it or invent what it contains, and never tell',
    'the user to paste or upload it themselves for a link listed here as FILED or NOT filed —',
    'the platform already tried, and the outcome below is final for this turn):',
    ...lines,
    '',
    'If the user names a source by description rather than a link, you cannot fetch it — you',
    'have no general web search. Say so plainly and ask for a link, or ask them to paste the',
    'text or upload it. Never invent or guess what such a source says.',
  ].join('\n')
}
