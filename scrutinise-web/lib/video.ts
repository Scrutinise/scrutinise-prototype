// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL item 14 + Stage 2g — links to video, and what to show for one.
//
// ⚠ CLIENT-SAFE ON PURPOSE. `lib/question-library.ts` and `lib/resources.ts`
// both import prisma, so a client component cannot pull a helper out of either.
// The pack output IS a client component, and item 14's whole requirement is
// that the pack and the library agree about what a video answer says — which
// they can only do if they call the same function. Hence its own module.
//
// LINK ONLY — no hosting, per the standing decision. Nothing here uploads,
// transcodes or proxies; it parses a URL and picks a still image.
// ─────────────────────────────────────────────────────────────────────────────

/** The YouTube id in any of the shapes people actually paste. */
export function youTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/)
  return m ? m[1] : null
}

/**
 * A thumbnail for a link, without calling anybody.
 *
 * ⚠ YouTube's still images sit at a predictable path, so this needs no API key,
 * no network call at render time, and nothing to rate-limit. A link we cannot
 * make a picture of returns null and the card falls back to its type icon —
 * never to a broken image. Vimeo has no such path, so it deliberately returns
 * null rather than inventing one.
 */
export function linkThumbnail(url: string): string | null {
  const id = youTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

/** The host, for a link with no thumbnail. `null` rather than a throw on junk. */
export function linkHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export type VideoAnswerish = {
  body?: string | null
  videoUrl?: string | null
  videoTitle?: string | null
}

/**
 * What an answer READS AS in a text-only surface — the pack sheet, the list, a
 * flashcard.
 *
 * ⚠ ITEM 14'S ACCEPTANCE CRITERION LIVES HERE, AND ONLY HERE. "A video answer
 * prints as its title plus the URL, never as an empty block" is four assertions
 * if each format formats its own; it is one if all four call this. A video
 * answer has an empty `body`, so any format that renders `answer.body` directly
 * prints nothing at all and the reader sees a blank card with no clue that a
 * video existed.
 *
 * The URL is printed in full rather than linked, because the A4 sheet is paper:
 * a reader has to be able to type it.
 */
export function answerDisplayText(answer: VideoAnswerish | null | undefined): string {
  if (!answer) return ''
  const body = answer.body?.trim() ?? ''
  const url = answer.videoUrl?.trim() ?? ''
  if (!url) return body

  const title = answer.videoTitle?.trim() || 'Video answer'
  const videoLine = `${title} — ${url}`
  // Alongside text, not instead of it: an answer may carry both.
  return body ? `${body}\n\n${videoLine}` : videoLine
}

/** True when there is nothing at all to show — the genuine empty case. */
export function answerIsEmpty(answer: VideoAnswerish | null | undefined): boolean {
  return answerDisplayText(answer).trim().length === 0
}
