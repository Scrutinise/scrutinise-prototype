// ─────────────────────────────────────────────────────────────────────────────
// committees.parliament.uk URL construction (§19-E Task 8).
//
// THE BUG. `https://committees.parliament.uk/writtenevidence/121125/` was surfaced
// to Charlie on the 13 Aug walk and 404s. It is not a bad id — it is the wrong FORM
// of the URL, and the same wrong form is stored on a quarter of a million rows.
//
// MEASURED 2026-08-15 (curl, browser User-Agent — the site answers a bare curl UA
// with 403 on EVERY path, which reads exactly like a dead link and is not one):
//
//   404  https://committees.parliament.uk/writtenevidence/121125/
//   200  https://committees.parliament.uk/writtenevidence/121125/html/
//   404  https://committees.parliament.uk/oralevidence/5900/
//   200  https://committees.parliament.uk/oralevidence/5900/html/
//   404  https://committees.parliament.uk/publications/45000/
//   200  https://committees.parliament.uk/publications/45000/html/
//
// The bare `/{id}/` form has no page at all for any of the three families; the
// document is addressed at `/{id}/html/` (and `/{id}/pdf/`). What `corpus_sections`
// stores is the bare form:
//
//   126,509  https://committees.parliament.uk/writtenevidence/N/
//   122,458  https://committees.parliament.uk/publications/N/
//    15,806  https://committees.parliament.uk/oralevidence/N/
//
// — 264,773 of the 487,088 committee rows (54.4%), every one of them a 404 at rest.
// The remaining rows point at the legacy `publications.parliament.uk/pa/…​.pdf`
// archive, which resolves as stored and is left alone (spot-checked 200).
//
// // A dead citation is worse than a plain reference: the user clicks it to check
// // whether we are telling the truth, and gets a page that says we are not.
//
// Same shape as legislation-url.ts and for the same reason: the stored value is
// wrong at rest, this corrects it on the way out, and the ingest-side data defect
// is recorded for the ingest thread rather than fixed by a 264,773-row rewrite.
// ─────────────────────────────────────────────────────────────────────────────

const HOST = 'committees.parliament.uk'

/** The three committee document families. Everything else is left untouched. */
const FAMILIES = ['writtenevidence', 'oralevidence', 'publications']

/**
 * `…/writtenevidence/121125/` → `…/writtenevidence/121125/html/`.
 *
 * Returns the input unchanged when it is not a bare committee document URL — a URL
 * already carrying `/html/` or `/pdf/`, a `committees.parliament.uk/work/…` inquiry
 * page (which resolves in the bare form), the legacy publications.parliament.uk
 * archive, or anything else entirely.
 *
 * NEVER GUESSES. If the URL does not match the exact shape, it is passed through:
 * inventing a path for a form we have not measured is how the bare form got here.
 */
export function committeeUrl(raw: string | null | undefined): string {
  const url = (raw ?? '').trim()
  if (!url) return ''
  // Host must match exactly — a substring test would rewrite any URL that merely
  // mentions the host, including one on somebody else's domain.
  const m = url.match(
    new RegExp(`^(https?://(?:www\\.)?${HOST.replace(/\./g, '\\.')})/(${FAMILIES.join('|')})/(\\d+)/?$`, 'i'),
  )
  if (!m) return url
  const [, origin, family, id] = m
  return `${origin}/${family.toLowerCase()}/${id}/html/`
}

/**
 * The URL for one committee search result. `sourceUrl` is the real page for this
 * corpus (unlike legislation, whose ids carry a derivable gid), so the stored value
 * is the input and the repair is applied to it.
 */
export function resolveCommitteeUrl(sourceUrl: string | null | undefined): string {
  return committeeUrl(sourceUrl)
}

/** True when this URL is a committee document URL we know how to address. */
export function isCommitteeDocumentUrl(raw: string | null | undefined): boolean {
  const url = (raw ?? '').trim()
  if (!url) return false
  return new RegExp(`^https?://(?:www\\.)?${HOST.replace(/\./g, '\\.')}/(${FAMILIES.join('|')})/\\d+/?(html|pdf)?/?$`, 'i')
    .test(url)
}
