/**
 * regnal-alias.ts — C3 LANE B5. The other identifier the same instrument is filed under.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER SEES WITHOUT THIS. A pre-1963 Act comes back headed `ukpga/Geo4/5/83` where
 * *Vagrancy Act 1824* should be. legislation.gov.uk files Acts before 1963 by REGNAL year — the
 * year of the monarch's reign — so the Vagrancy Act 1824 is the 83rd Act of the 5th year of
 * George IV. It ALSO has a calendar-year identifier, `ukpga/1824/83`. The title index is keyed by
 * one of the two, the section id carries the other, and the lookup misses.
 *
 * MEASURED 24 Aug 2026 over `primary-acts-pre-2000`: **1,949 of 3,599 instruments (54.2%) resolve
 * to a title today; trying both forms resolves 3,599 of 3,599 — 100.0%.** All 1,650 of the
 * regnal-filed instruments are recovered and none is lost. (⚠ The brief quotes 14.0%; that figure
 * does not reproduce on either index — `corpus_acts` and `LegislationItem` both sit at 54.2%, and
 * 79.5% at the section level. The repair is the same either way.)
 *
 * ⚠⚠ THE PAIRING IS THE PUBLISHER'S, NEVER A SIMILARITY MATCH. Every pair comes from
 * `v36/source-entries.json` — a full entry walk of legislation.gov.uk's year feeds — which carries
 * `docId` and `calendarId` on each entry. Merging two identities because their titles look alike
 * is exactly the failure this must not commit: `citation-resolver.ts` already records 173
 * normalised titles carrying more than one gid, mostly identically-titled 19th-century Acts.
 *
 * Regenerate with `tsx c2/b5-build-alias.ts` after a fresh source walk.
 */
import fs from 'fs'
import path from 'path'

let cache: Map<string, string> | null = null

/** gid → the same instrument's other identifier form. Empty map if the artefact is missing —
 *  reported once, never thrown: a missing alias file must degrade titles, not take search down. */
export function regnalAlias(): Map<string, string> {
  if (cache) return cache
  const p = path.join(__dirname, 'regnal-alias.json')
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>
    cache = new Map(Object.entries(raw))
  } catch (e) {
    console.warn('[regnal-alias] NOT LOADED — pre-1963 Acts will show a raw identifier instead of a title', {
      path: p, error: e instanceof Error ? e.message : String(e),
    })
    cache = new Map()
  }
  return cache
}

/**
 * Add an entry for every alias of a gid the map already has a title for.
 *
 * ⚠ IT ONLY EVER ADDS. An existing key is never overwritten, so a title the index already resolves
 * directly cannot be replaced by one reached through an alias — the alias is a fallback, not a
 * competing source of truth.
 */
export function applyRegnalAliases(titles: Map<string, string>): { added: number } {
  const alias = regnalAlias()
  let added = 0
  for (const [gid, title] of [...titles]) {
    const other = alias.get(gid)
    if (other && !titles.has(other)) { titles.set(other, title); added++ }
  }
  return { added }
}
