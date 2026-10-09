// ─────────────────────────────────────────────────────────────────────────────
// 26-R §3 (DECISION 132) — THE BOOKMARKLET: one line of JavaScript saved as a browser bookmark. No extension, no store, every
// desktop browser. Press it on any page and it opens "Add research" with that page's address, title and SELECTED TEXT filled in.
//
// ⚠ NOT A BROWSER EXTENSION, deliberately (decision 132). Chromium (Chrome, Edge) and Firefox share one codebase; Safari needs a
//   separately packaged app and store review; a store listing is a standing cost. Revisit when testers ask for it.
// ⚠ IT SENDS NOTHING BY ITSELF. It only opens the Scrutinise page in a new tab with the page's details in the address; the user
//   then saves (or does not). The selected text is capped at 3,000 characters so the address stays within what browsers accept.
// ⚠ NO IMPORTS (a client component renders the link).
// ─────────────────────────────────────────────────────────────────────────────

export const BOOKMARKLET_MAX_SELECTION = 3000

/** The bookmarklet's source, as a `javascript:` URL, for one idea on one origin. */
export function bookmarkletHref(origin: string, ideaId: string): string {
  const base = `${origin.replace(/\/+$/, '')}/ideas/${encodeURIComponent(ideaId)}/add-research`
  const code =
    `(function(){var s=''+window.getSelection();`
    + `var u=${JSON.stringify(base)}+'?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)`
    + `+(s?'&text='+encodeURIComponent(s.slice(0,${BOOKMARKLET_MAX_SELECTION})):'');`
    + `var w=window.open(u,'_blank');if(!w){location.href=u}})();`
  return `javascript:${code}`
}

/** What the landing page reads back out of the address. Pure, so a check can round-trip the bookmarklet. */
export function readBookmarkletParams(search: Record<string, string | string[] | undefined>): { url?: string; title?: string; text?: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const url = one(search.url)?.slice(0, 2000)
  const title = one(search.title)?.slice(0, 300)
  const text = one(search.text)?.slice(0, BOOKMARKLET_MAX_SELECTION)
  return { ...(url ? { url } : {}), ...(title ? { title } : {}), ...(text ? { text } : {}) }
}
