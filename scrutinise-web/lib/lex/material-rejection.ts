// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §2 — MATERIAL WE CANNOT READ: SAY WHY, AT THE TIME, AND RECORD IT.
//
// ⚠⚠ THE RULE IS NOT "REFUSE POLITELY". Refusing politely is what the code already did:
// `MaterialRejected` carried a good sentence, the user read it, and **nothing survived the
// request**. So three different questions were all unanswerable —
//
//   · how often does someone hand us a video?
//   · is the gap visible on their idea, or did it vanish with the toast?
//   · is transcript-fetching worth building?
//
// — and the third is a decision §2 explicitly defers *on the grounds that we have no
// evidence of demand*. Evidence of demand is a table. Without one, the same sentence would
// be true a year from now and we would still be guessing.
//
// ⚠ VIDEO GETS ITS OWN TREATMENT BECAUSE IT IS THE ONE WHERE THE USER CAN FIX IT. A
// paywalled page and a 40MB PDF are dead ends for now; a YouTube link almost always has a
// transcript behind it, and the honest answer names that route rather than stopping at "no".
//
// ⚠⚠ AND WE DO NOT FETCH IT. §2: "Do not build YouTube transcript fetching now — it is
// fragile, its terms are unclear, and we have no evidence of demand." Nothing in this file
// requests a transcript, and nothing in it should. What it does is tell the user where
// theirs is and count the ask.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

/**
 * Why something was refused. Every value is a DIFFERENT thing for the user to do next,
 * which is the test for whether a kind earns its place:
 *
 *   `video`             → find the transcript. They can act.
 *   `paywalled`         → paste the text they can see. They can act.
 *   `unreadable-format` → give us a different format. They can act.
 *   `no-text`           → it is a scan; we have no OCR. They can act (retype, or find the source).
 *   `too-large`         → split it. They can act.
 *   `unfetchable`       → the page is down or blocking us. They mostly cannot act.
 *   `not-a-url`         → a typo. They can act.
 *   `too-many`          → the per-idea cap. They can act.
 */
export type RejectionKind =
  | 'video'
  | 'paywalled'
  | 'unreadable-format'
  | 'no-text'
  | 'too-large'
  | 'unfetchable'
  | 'not-a-url'
  | 'too-many'

export const REJECTION_KINDS: RejectionKind[] = [
  'video', 'paywalled', 'unreadable-format', 'no-text', 'too-large', 'unfetchable',
  'not-a-url', 'too-many',
]

/**
 * Hosts whose primary product is video.
 *
 * ⚠ A HOST LIST, NOT A KEYWORD MATCH. "video" appears in plenty of article URLs, and a
 * false positive here refuses something we could actually have read — which is a worse
 * failure than accepting a video link and finding no text, because the user is told we
 * cannot do something we can.
 *
 * ⚠ AND IT IS DELIBERATELY SHORT. Every entry is a host we would otherwise fetch and get
 * an app shell from. Anything not on it falls through to the ordinary path, and if that
 * path finds no text it says so on its own terms.
 */
const VIDEO_HOSTS = [
  'youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com',
  'vimeo.com', 'player.vimeo.com',
  'dailymotion.com', 'twitch.tv', 'tiktok.com', 'rumble.com',
  'facebook.com/watch', 'fb.watch',
]

/** Hosts and paths that answer a bot with a wall rather than the article. */
const PAYWALL_HOSTS = [
  'ft.com', 'thetimes.co.uk', 'thetimes.com', 'telegraph.co.uk', 'wsj.com',
  'economist.com', 'nytimes.com', 'bloomberg.com', 'spectator.co.uk',
]

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return null }
}

export function isVideoUrl(url: string): boolean {
  const host = hostOf(url)
  if (!host) return false
  const full = `${host}${(() => { try { return new URL(url).pathname } catch { return '' } })()}`.toLowerCase()
  return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`) || full.startsWith(h))
}

export function isKnownPaywall(url: string): boolean {
  const host = hostOf(url)
  return !!host && PAYWALL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * ⚠ THE SENTENCE §2 ASKS FOR, ALMOST VERBATIM, AND THE ROUTE OUT IS IN IT.
 *
 * "I can't watch video" on its own is a dead end of exactly the kind 25-K §2 spent a sprint
 * removing from the re-run. The user has a transcript within two clicks and does not know
 * we would read it.
 */
export const VIDEO_MESSAGE =
  'I can’t watch video. If there’s a transcript — YouTube usually has one under the video, '
  + 'behind “Show transcript” — paste it or upload it and I’ll read that. I’ve noted the link '
  + 'against your idea so the gap is on the record either way.'

export const PAYWALL_MESSAGE =
  'That page is behind a paywall, so all we can reach is the sign-in wall rather than the '
  + 'article. If you can see it, paste the text or upload the PDF and I’ll read that. I’ve '
  + 'noted the link against your idea so the gap is on the record.'

/**
 * A refusal that knows what kind of refusal it is.
 *
 * ⚠ THE KIND IS REQUIRED, NOT OPTIONAL. An optional field on an error class is a field the
 * next `throw` will omit, and the log would then fill with `unknown` — which is the shape of
 * the problem this file exists to fix, one level down. CLAUDE.md §18: a degradation must
 * announce itself WITH ITS CAUSE ATTACHED.
 */
export class MaterialRejected extends Error {
  readonly kind: RejectionKind
  constructor(kind: RejectionKind, message: string) {
    super(message)
    this.name = 'MaterialRejected'
    this.kind = kind
  }
}

/**
 * Record what we refused.
 *
 * ⚠ IT NEVER THROWS. A logging failure must not turn a clean refusal into a 500 — the user
 * would then be told something went wrong when in fact we simply cannot read videos. The
 * failure is printed and swallowed, which is the one place in this codebase where swallowing
 * is right, because the caller has already produced the correct user-facing outcome.
 */
export async function logRejection(input: {
  ideaId: string
  userId: string | null
  kind: RejectionKind
  target: string
  detail: string
}): Promise<void> {
  try {
    await prisma.ideaMaterialRejection.create({
      data: {
        ideaId: input.ideaId,
        userId: input.userId,
        kind: input.kind,
        // Capped here rather than in the column: a URL is user text, and the cap is a
        // storage decision that belongs beside the sentence explaining it.
        target: input.target.slice(0, 2000),
        detail: input.detail.slice(0, 2000),
      },
    })
  } catch (err) {
    console.error('[material-rejection] could not be logged', {
      ideaId: input.ideaId, kind: input.kind,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export interface RejectionRow {
  id: string
  kind: RejectionKind
  target: string
  detail: string
  createdAt: string
}

export async function readRejections(ideaId: string): Promise<RejectionRow[]> {
  const rows = await prisma.ideaMaterialRejection.findMany({
    where: { ideaId }, orderBy: { createdAt: 'desc' }, take: 50,
  })
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as RejectionKind,
    target: r.target,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * §2 — "Record it as a known unknown on the idea, so the gap is visible rather than silent."
 *
 * ⚠ THESE ARE THE USER'S TO CLOSE, and that is why they are worth listing. A search that
 * failed is our job; a video whose transcript only they can fetch is theirs, and the agenda
 * already distinguishes the two (`AgendaGap.task`). Filing these as `research` would put
 * them on our list, where nothing would ever happen to them.
 *
 * ⚠ ONE ENTRY PER KIND PER TARGET, newest first, capped — a user who pasted the same
 * playlist four times has one gap, not four.
 */
export function rejectionsAsGaps(rows: RejectionRow[]): Array<{ question: string; why: string }> {
  const seen = new Set<string>()
  const out: Array<{ question: string; why: string }> = []
  for (const r of rows) {
    // Only the kinds the user can actually do something about. An unfetchable page and a
    // mistyped address are not gaps in the evidence; they are a failed attempt.
    if (r.kind !== 'video' && r.kind !== 'paywalled' && r.kind !== 'no-text') continue
    const key = `${r.kind}:${r.target}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      question: `What does ${r.target} actually say?`,
      why: r.kind === 'video'
        ? 'You gave me a video. I can’t watch it — a transcript is the way in, and only you can fetch it.'
        : r.kind === 'paywalled'
          ? 'That source is behind a paywall we can’t pass. If you can read it, the text is the way in.'
          : 'Nothing readable came out of that file — if it is a scan, it is an image and we have no OCR.',
    })
    if (out.length >= 10) break
  }
  return out
}
