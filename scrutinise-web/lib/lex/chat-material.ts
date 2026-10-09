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
import {
  extractUrl, runMaterialFindings, MaterialRejected, createLinkMaterial, normalise,
  MAX_MATERIALS_PER_IDEA, MAX_TEXT_CHARS,
} from './user-material'
import { logRejection, type RejectionKind } from './material-rejection'

/**
 * How many links one chat turn will attempt.
 *
 * ⚠⚠ WHY IT WAS TWO, AND WHY IT IS NOT NOW. Decision 92 capped it at 2 "to bound the cost and the
 * wait", and the wait was the real reason: links were filed ONE AFTER ANOTHER, each a fetch (up to
 * 20s) plus a findings pass (one model call, up to 120s), inside a route that Vercel killed at 60
 * seconds. Two sequential links already used most of that, so a cap of two was the largest number
 * that could be promised. It was never a cost control — a findings pass is a fraction of a penny.
 *
 * 26-M follow-up: the route allows 120s and the links now run IN PARALLEL, so the wait is the
 * slowest link rather than the sum. Five is the ceiling a user pasting a list of sources is likely
 * to hit; past it the remainder are reported "not tried" rather than dropped. Each link also has a
 * budget (LINK_BUDGET_MS) so one slow page cannot take the turn with it.
 */
const MAX_URLS_PER_TURN = 5

/** Per-link ceiling, fetch plus findings pass — leaves room in a 120s route for the comparison and Lex's reply. */
const LINK_BUDGET_MS = 55_000

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

/** Every URL in the message, deduped, trimmed of trailing punctuation a sentence would leave
 *  attached to a link ("...see https://gov.uk/x." → the trailing "." is not part of it). */
function allUrlsIn(message: string): string[] {
  const found = message.match(URL_RE) ?? []
  const cleaned = found.map((u) => u.replace(/[.,;:!?)\]]+$/, ''))
  return Array.from(new Set(cleaned))
}

/** The URLs this turn will attempt — the first `MAX_URLS_PER_TURN`. */
export function urlsIn(message: string): string[] {
  return allUrlsIn(message).slice(0, MAX_URLS_PER_TURN)
}

/**
 * ⚠⚠ THE LINKS THIS TURN DID NOT ATTEMPT. Charlie, 1 Oct: three links in one message, two filed,
 * and Lex said the third "wasn't filed this turn" and sent him to another stage. Nothing had
 * failed — `urlsIn` had silently sliced the third off at the cap, so there was no fetch, no
 * rejection row and no line in the report, and Lex had to invent a reason. A link the platform
 * never tried must be reported as exactly that.
 */
export function urlsNotAttempted(message: string): string[] {
  return allUrlsIn(message).slice(MAX_URLS_PER_TURN)
}

export interface FileResult {
  url: string
  outcome: 'filed' | 'already-filed' | 'refused' | 'cap-reached' | 'error' | 'not-attempted'
  /** The `IdeaUserMaterial` row, when one was written — what a comparison runs over. */
  materialId?: string
  /** Why a refusal was a refusal, so the report can say which and offer what works for it. */
  kind?: RejectionKind
  findingCount?: number
  note?: string | null
  reason?: string
  /** True when the text came from the user pasting it after a link failed, not from a fetch. */
  pasted?: boolean
}

/**
 * ══ 26-M item 3 — A STATED PURPOSE IS AN INSTRUCTION, NOT A PASSIVE UPLOAD ══════════════════
 *
 * 26-K §4c: "offer, do not run" — right for a document dropped in with no word said about it,
 * because the user may be adding several and the comparison costs money. It is the wrong answer
 * to *"add these, the principles of which should be integrated into any accountability system"*,
 * where the user has said what the material is for and the only thing left is to do it.
 *
 * ⚠ DETERMINISTIC, LIKE THE FILING. The platform decides whether a purpose was stated, before
 * Lex is called, so "ran the comparison" is a property of the system and not a hope about what
 * the model chooses. It is a heuristic and is deliberately a little conservative: the cost of a
 * false negative is the old behaviour (an offer, one click to accept), the cost of a false
 * positive is ~2p spent on a comparison nobody asked for.
 */
const PURPOSE_RE = new RegExp(
  '\\b(?:compar(?:e|ing|ison)|check(?:ing)? (?:it |this |them |these )?against|against (?:my|the) (?:kernel|strategy|diagnosis|policy|policies|approach|causes?|problem)'
  + '|(?:does|do|would|will|might|could) (?:this|it|that|these|they) (?:change|affect|support|contradict|undermine|alter|strengthen|weaken|challenge)'
  + '|see (?:if|whether|how) (?:this|it|they|these)|(?:what|how) (?:does|do|would) (?:this|it|these|they|that) (?:mean|change|say|bear|affect)'
  + '|bears? on|relevan(?:t|ce) (?:to|for)|integrat(?:e|ed|ing)|incorporat(?:e|ed|ing)|take(?:n)? (?:this|these|it|them) into account'
  + '|should (?:be )?(?:reflected|used|applied|built in)|use (?:this|these|it|them) (?:to|for|in)|implications? (?:for|of))\\b', 'i',
)

/** Words in the message once its links are removed — a bare "here's a link" states no purpose. */
export function statesPurpose(message: string): boolean {
  const prose = message.replace(URL_RE, ' ').trim()
  if (prose.split(/\s+/).filter(Boolean).length < 6) return false
  return PURPOSE_RE.test(prose)
}

/**
 * File every URL in `message` that is not already attached to this idea, through the
 * exact pipeline an upload uses. Returns one result per URL found, whatever happened —
 * never throws, because a failed filing is itself the report, not an outage.
 */
export async function fileUrlsFromChat(ideaId: string, userId: string, message: string): Promise<FileResult[]> {
  const urls = urlsIn(message)
  if (!urls.length) return []

  // Slots are counted ONCE, up front, and handed out in order. Filing runs in parallel below, and
  // a per-link count would let five concurrent links all see "one slot left" and all take it.
  // 26-J §2b — an archived slot is a freed slot, same as material.route.ts's own cap check.
  let slots = MAX_MATERIALS_PER_IDEA - await prisma.ideaUserMaterial.count({ where: { ideaId, archivedAt: null } })

  const jobs: Array<Promise<FileResult>> = []
  const settled: FileResult[] = []
  for (const url of urls) {
    // Dedupe against what is already on the idea — the same link mentioned again in
    // conversation must not re-fetch and re-file a second copy.
    const existing = await prisma.ideaUserMaterial.findFirst({
      // 26-J §2b — an archived link is no longer "on the idea"; mentioning it again may add
      // it afresh rather than reporting a dedupe against a row the user deliberately removed.
      where: { ideaId, url, kind: 'LINK', archivedAt: null },
      select: { id: true, findingCount: true, label: true },
    })
    if (existing) {
      settled.push({ url, outcome: 'already-filed', findingCount: existing.findingCount })
      continue
    }
    if (slots <= 0) {
      settled.push({ url, outcome: 'cap-reached' })
      continue
    }
    slots--
    jobs.push(fileOneLink(ideaId, userId, url))
  }

  // ⚠ IN PARALLEL, NOT IN TURN — see MAX_URLS_PER_TURN. Order of the report follows the order the
  // user gave the links, whichever finished first.
  const done = await Promise.all(jobs)
  const byUrl = new Map([...settled, ...done].map((r) => [r.url, r]))
  const results = urls.map((u) => byUrl.get(u)!)
  // A link past the per-turn cap was never tried; say so rather than let it vanish.
  for (const url of urlsNotAttempted(message)) results.push({ url, outcome: 'not-attempted' })
  return results
}

/**
 * One link, start to finish, inside LINK_BUDGET_MS. Never throws.
 *
 * ⚠ THE BUDGET COVERS THE FINDINGS PASS TOO, and what it says on expiry depends on what had
 * happened by then: before the row existed nothing is stored and the user is told to try again;
 * after it, the link IS stored and may simply not have been read — said as exactly that, because
 * "it failed" and "it is on your list, unread" want different things from the user.
 */
async function fileOneLink(ideaId: string, userId: string, url: string): Promise<FileResult> {
  let storedId: string | null = null
  const work = (async (): Promise<FileResult> => {
    try {
      const extracted = await extractUrl(url)
      // ⚠ SAME FUNCTION THE UPLOAD ROUTE CALLS (`createLinkMaterial`, user-material.ts) —
      // a link volunteered mid-conversation carries the same liability rule as an
      // uploaded one (§25.6): the user is the one who put it in the message, so the
      // assertion is implicit in the act of sharing it, exactly as pasting it into the
      // material panel would be.
      const created = await createLinkMaterial({ ideaId, extracted, addedBy: userId, rightsConfirmed: true })
      storedId = created.id
      const findings = await runMaterialFindings(created.id)
      return { url, outcome: 'filed', materialId: created.id, findingCount: findings.written, note: findings.note }
    } catch (err) {
      if (err instanceof MaterialRejected) {
        await logRejection({ ideaId, userId, kind: err.kind, target: url, detail: err.message })
        return { url, outcome: 'refused', kind: err.kind, reason: err.message }
      }
      console.error('[chat-material] filing THREW', { ideaId, url, error: err instanceof Error ? err.message : err })
      return { url, outcome: 'error', reason: 'That could not be added. Nothing was stored.' }
    }
  })()

  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<'expired'>((resolve) => { timer = setTimeout(() => resolve('expired'), LINK_BUDGET_MS) })
  const winner = await Promise.race([work, expired])
  clearTimeout(timer)
  if (winner !== 'expired') return winner
  console.error('[chat-material] link EXCEEDED its time budget', { ideaId, url, stored: !!storedId })
  return {
    url, outcome: 'error', materialId: storedId ?? undefined,
    reason: storedId
      ? 'Reading it took longer than the time allowed. The link is stored and will show in the sources list, but it may not have been read yet.'
      : 'That page took too long to come back. Nothing was stored — it is worth sending again on its own.',
  }
}

// ── pasted text: the route out of a link we could not read ───────────────────────────────────

/** An ordinary chat message's ceiling. Longer is accepted only when it is filed as pasted material. */
export const CHAT_MESSAGE_LIMIT = 4000
/** Shorter than this is a remark, not a pasted article. */
export const MIN_PASTE_CHARS = 600
/** How long after a refusal a long message is read as the text they said they would paste. */
const PASTE_WINDOW_MS = 30 * 60 * 1000
const PASTE_FILENAME = 'Pasted in chat'
const REFUSALS_THE_USER_CAN_ANSWER: RejectionKind[] = ['paywalled', 'unfetchable', 'no-text', 'video']

/**
 * ⚠⚠ 26-M item 1 — "PASTE THE TEXT" HAS TO BE SOMETHING THAT WORKS. A refusal that offers a route
 * the chat then ignores is the errand again in a politer voice: Lex asks for the text, the user
 * pastes it, and it is read as conversation and filed nowhere.
 *
 * So: a long message with no link in it, arriving within half an hour of a refusal the user can
 * answer for that idea, is the text they were asked for. Filed through the same row shape as a
 * file upload (`kind: FILE`, text only, never a binary), with the failed link kept as its `url` so
 * a quotation can still be traced to where it came from. Deterministic and before Lex is called.
 *
 * ⚠ ONE PER REFUSAL: a pasted-in-chat row created after the refusal consumes it, so the user's
 * next long argument is not mistaken for a second paste. The chat body is capped at 4,000
 * characters by the route's schema, so a longer article arrives as more than one paste or not at
 * all — the report says so rather than leaving it to be discovered.
 */
export async function filePastedTextFromChat(ideaId: string, userId: string, message: string): Promise<FileResult[]> {
  if (message.length < MIN_PASTE_CHARS || allUrlsIn(message).length) return []

  const refusal = await prisma.ideaMaterialRejection.findFirst({
    where: {
      ideaId, kind: { in: REFUSALS_THE_USER_CAN_ANSWER }, createdAt: { gt: new Date(Date.now() - PASTE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { target: true, createdAt: true },
  })
  if (!refusal) return []

  const alreadyAnswered = await prisma.ideaUserMaterial.findFirst({
    where: { ideaId, filename: PASTE_FILENAME, createdAt: { gt: refusal.createdAt } }, select: { id: true },
  })
  if (alreadyAnswered) return []

  const count = await prisma.ideaUserMaterial.count({ where: { ideaId, archivedAt: null } })
  const target = refusal.target
  if (count >= MAX_MATERIALS_PER_IDEA) return [{ url: target, outcome: 'cap-reached', pasted: true }]

  try {
    const text = normalise(message).slice(0, MAX_TEXT_CHARS)
    const isLink = /^https?:\/\//i.test(target)
    const created = await prisma.ideaUserMaterial.create({
      data: {
        ideaId, kind: 'FILE', status: 'READY',
        label: `Text pasted in chat${isLink ? ` — ${target}` : ''}`.slice(0, 300),
        filename: PASTE_FILENAME, mimeType: 'text/plain',
        url: isLink ? target : null,
        text, charCount: text.length, sourceBytes: Buffer.byteLength(message, 'utf8'),
        // The user put it in the message: the assertion is implicit, as for a chat-filed link.
        rightsConfirmed: true, addedBy: userId,
      },
      select: { id: true },
    })
    const findings = await runMaterialFindings(created.id)
    return [{ url: target, outcome: 'filed', materialId: created.id, findingCount: findings.written, note: findings.note, pasted: true }]
  } catch (err) {
    console.error('[chat-material] pasted-text filing THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return [{ url: target, outcome: 'error', reason: 'The pasted text could not be added. Nothing was stored.', pasted: true }]
  }
}

/**
 * ⚠ THE REPORT LEX IS GIVEN — NEVER THE DOCUMENT TEXT. §2: "Lex says what it filed and
 * what it found." §5: "if a link is filed but cannot be read, say so to the user." Every
 * branch below is a fact the platform already established; Lex is told to relay it, not
 * to interpret or embellish it.
 */
export function materialFiledBlock(results: FileResult[], comparison?: ComparisonReport | null): string | null {
  if (!results.length) return null
  const lines = results.map((r) => {
    const what = r.pasted ? `the text you pasted for ${r.url}` : r.url
    if (r.outcome === 'filed') {
      return r.findingCount && r.findingCount > 0
        ? `- ${what} — FILED and read: ${r.findingCount} finding${r.findingCount === 1 ? '' : 's'} taken from it, under the questions they answer.`
        : `- ${what} — FILED and read, but ${r.note ?? 'nothing in it bore on the proposal'}.`
    }
    if (r.outcome === 'already-filed') {
      return `- ${r.url} — already on this idea's material (${r.findingCount ?? 0} finding${r.findingCount === 1 ? '' : 's'} on record); not re-fetched.`
    }
    if (r.outcome === 'cap-reached') {
      return `- ${what} — NOT filed. This idea already holds the maximum ${MAX_MATERIALS_PER_IDEA} documents; something would need removing first.`
    }
    if (r.outcome === 'not-attempted') {
      return `- ${r.url} — NOT TRIED. Nothing was wrong with it: only the first ${MAX_URLS_PER_TURN} links in a message are read, and this was beyond that. `
        + 'Say exactly that, and that sending it again on its own will file it.'
    }
    // 'refused' | 'error'
    return `- ${what} — NOT filed. WHY: ${r.reason}${r.kind ? ` [${r.kind}]` : ''}${REFUSAL_OFFER[r.kind ?? 'unfetchable'] ? ` ${REFUSAL_OFFER[r.kind ?? 'unfetchable']}` : ''}`
  })

  const anyNotFiled = results.some((r) => r.outcome === 'refused' || r.outcome === 'error')

  return [
    'MATERIAL FILED THIS TURN (the platform already acted — report this plainly, in your own',
    'words, in chatText; never say you will file it or invent what it contains. The outcome',
    'below is final for this turn. ⚠ Do not send the user to another stage, screen or page to do',
    'it themselves, and do not name any button that is not in WHERE THE CONTROLS ARE above):',
    ...lines,
    ...(anyNotFiled ? [
      '',
      'WHEN A LINK WAS NOT FILED: say WHY in one plain sentence, using the reason given — the',
      'page blocked us, it is paywalled, it would not load, it had no readable text. Never',
      'say only "it was not filed this turn" and never guess at a cause that is not stated.',
      'Then offer what works HERE, in this chat, and nothing that needs another screen: they can paste the text of the page into a message and you will read it, or — if they have it as a file, such as a PDF — add it with the "Add research" button (the "+") just above the box they type in. Both are on this screen, on every stage.',
    ] : []),
    ...(comparison ? ['', comparisonBlock(comparison)] : []),
    '',
    'If the user names a source by description rather than a link, you cannot fetch it — you',
    'have no general web search. Say so plainly and ask for a link, or ask them to paste the',
    'text. Never invent or guess what such a source says.',
  ].join('\n')
}

/**
 * What the user can do about each refusal — the reason and the route out, in one place, so a
 * kind cannot be reported without the offer that goes with it (26-M item 1).
 */
const REFUSAL_OFFER: Partial<Record<RejectionKind, string>> = {
  video: 'OFFER: a video cannot be read — if there is a transcript, they can paste it here.',
  paywalled: 'OFFER: if they can see the page, they can paste its text here.',
  unfetchable: 'OFFER: the page would not load for us, which is not their fault — if they can open it, they can paste its text here.',
  'no-text': 'OFFER: there was no text to read (a scan, or a page built in script) — they can paste the text here if they can copy it.',
  'unreadable-format': 'OFFER: they can paste the text here instead.',
  'too-large': 'OFFER: they can paste the part that matters here.',
  'not-a-url': 'OFFER: ask them to check the address.',
}

// ── the comparison a stated purpose runs (26-M item 3) ───────────────────────────────────────

export interface ComparisonReport {
  ok: boolean
  error?: string
  materialCount: number
  counts: Record<'SUPPORTS' | 'CONTRADICTS' | 'NEW_CAUSE' | 'NEW_POLICY_OPTION' | 'NOTHING', number>
  /** Titles, newest run — the contradictions are named, never folded into a count. */
  contradictions: string[]
  costPence: number | null
}

/**
 * ⚠ A CONTRADICTION IS NEVER FOLDED INTO A COUNT. 26-K §2: "the most valuable category and must be
 * the most prominent." So it is listed first and by name, and Lex is told to lead with it.
 */
function comparisonBlock(c: ComparisonReport): string {
  if (!c.ok) {
    return `COMPARISON: the user stated a purpose, so the platform tried to compare the new material with the kernel and it DID NOT COMPLETE (${c.error ?? 'unknown reason'}). Say so plainly; nothing was proposed. They can run it from the working area.`
  }
  const cost = c.costPence != null ? ` It cost about ${c.costPence.toFixed(1)}p.` : ''
  const lines = [
    `COMPARISON RUN THIS TURN (the user stated a purpose for this material, so the platform ran the comparison with the kernel over ${c.materialCount} new item${c.materialCount === 1 ? '' : 's'} — report it, never offer it as if it were still to do).${cost}`,
    `Result: ${c.counts.SUPPORTS} support what is there, ${c.counts.CONTRADICTS} contradict it, ${c.counts.NEW_CAUSE} suggest a new cause, ${c.counts.NEW_POLICY_OPTION} suggest a new policy option (already added to the sort as candidates), ${c.counts.NOTHING} change nothing. Everything proposed is waiting for the user to accept or dismiss — nothing in the kernel has changed.`,
  ]
  if (c.contradictions.length) {
    lines.push(
      '⚠ LEAD WITH THIS, BEFORE ANYTHING ELSE IN YOUR REPLY — the new material CONTRADICTS the kernel on:',
      ...c.contradictions.map((t) => `  - ${t}`),
    )
  }
  return lines.join('\n')
}

/** Build the report from a finished update pass. */
export function comparisonReportFrom(
  result: { ok: boolean; error?: string; counts: ComparisonReport['counts']; proposedChanges: Array<{ category: string; title: string }>; costPence: number | null },
  materialCount: number,
): ComparisonReport {
  return {
    ok: result.ok, error: result.error, materialCount, counts: result.counts, costPence: result.costPence,
    contradictions: result.proposedChanges.filter((p) => p.category === 'CONTRADICTS').map((p) => p.title),
  }
}
