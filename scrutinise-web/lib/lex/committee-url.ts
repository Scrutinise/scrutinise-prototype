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

/**
 * ══════════ ⚠⚠ 25-V — `publications` WAS REMOVED FROM THIS LIST, AND IT IS THE WHOLE FIX ══════
 *
 * `writtenevidence` and `oralevidence` ids ARE addressed at `/{family}/{id}/html/`, which is what
 * §19-E Task 8 measured and fixed. `publications` is not, and adding it to this list quietly
 * assumed the three families shared one id space. They do not.
 *
 * MEASURED 2 September 2026, in a browser, because every one of these answers a fetch with 403:
 *
 *   · Publication 6912 is, per Parliament's own API, "Third Report - Propriety of Governance in
 *     Light of Greensill: An Interim Report" — exactly what our corpus row says it is.
 *   · `committees.parliament.uk/publications/6912/html/` serves **"Written Evidence Submitted by
 *     Professor Sir Michael Ferguson (RFA0008)"**, on ARPA research funding, poly-pills and
 *     artificial hearts.
 *   · `committees.parliament.uk/publications/72615/html/` — 72615 being that publication's own
 *     `documentId` — serves **"GRO0117 - Evidence on Grouse Shooting"**.
 *   · `committees.parliament.uk/publications/6912/` (bare) is "This page does not exist".
 *   · The address that serves the cited report is the API's `additionalContentUrl`:
 *     `publications.parliament.uk/pa/cm5802/cmselect/cmpubadm/59/5902.htm` — confirmed by title.
 *
 * ⚠⚠ SO THE `/publications/N/html/` FORM IS NOT A BROKEN LINK. IT IS A WORKING LINK TO SOMEBODY
 * ELSE'S DOCUMENT, which is worse: a 404 tells the reader something is wrong, and a page about
 * grouse shooting under a citation about the civil service tells them we are careless. It is also
 * invisible to every automated check, because the host answers 403 to all of them — the good
 * citations and the wrong ones alike.
 *
 * ⚠ THIS FILE'S OWN RULE ALREADY SAID SO: *"NEVER GUESSES. If the URL does not match the exact
 * shape, it is passed through: inventing a path for a form we have not measured is how the bare
 * form got here."* The publications family was in the list without that measurement.
 *
 * The correct address comes from `committees-api.parliament.uk/api/Publications/{id}` and is
 * written onto the evidence row by `scripts/backfill-committee-urls.ts`; it is not derivable
 * here, and this file must not pretend otherwise.
 */
const FAMILIES = ['writtenevidence', 'oralevidence']

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

  // ══════════ ⚠⚠ 25-V §11 — A KNOWN-BAD ADDRESS IS SUPPRESSED, NOT PASSED THROUGH ══════════
  //
  // Removing `publications` from FAMILIES stopped us MANUFACTURING the wrong `/html/` form. It did
  // not make the next build safe: `corpus_sections.sourceUrl` still holds the bare
  // `committees.parliament.uk/publications/{n}/` for these rows, so passing it through would put a
  // "This page does not exist" link under a correct citation on every future build. Better than
  // landing on grouse shooting, and still a defect we would be shipping knowingly.
  //
  // ⚠ SO IT RETURNS EMPTY, AND THE CITATION STANDS ALONE. A reader can find "Third Report —
  // Propriety of Governance in Light of Greensill, PACAC" by its name. They cannot recover from a
  // link we knew was wrong when we wrote it. The real address is only obtainable from
  // `committees-api.parliament.uk` at ingest time; `scripts/backfill-committee-urls.ts` writes it
  // onto the rows we hold, and this is the floor beneath that.
  //
  // ⚠ THIS IS THE "FIXED PERMANENTLY" HALF of §11's two categories, and it is why the disclosure
  // in §11b deliberately does NOT cover mislabelled citations: nothing here can now produce one.
  if (/^https?:\/\/(?:www\.)?committees\.parliament\.uk\/publications\/\d+\/?(?:html\/?)?$/i.test(url)) {
    return ''
  }
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
