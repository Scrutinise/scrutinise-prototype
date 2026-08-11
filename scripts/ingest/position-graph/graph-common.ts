/**
 * graph-common.ts — shared, side-effect-free helpers for the position graph (BRIEF_GRAPH_2D1).
 *
 * Deliberately free of top-level side effects so any script can import the normaliser without
 * opening a database connection — the same discipline as vector-common.ts.
 *
 * ⚠ Not to be confused with `../graph/graph-common.ts`, which belongs to the Tier-1 CITATION graph
 * (legislation cites/amends legislation). This directory is the POSITION graph: who did what.
 */

/**
 * The matching key for organisation and person names, and the single most consequential function in
 * this sprint: it IS the merge rule for everything without a stable key.
 *
 * CONSERVATIVE ON PURPOSE. The brief's rule is "when in doubt, do not merge — two rows for one
 * organisation is a visible, fixable problem; one row for two organisations is an invisible,
 * contaminating one". So this does only what cannot change identity:
 *
 *   · case-folds and collapses whitespace
 *   · drops a leading "the"
 *   · normalises the ampersand to "and", which is the same word rendered two ways
 *   · strips punctuation that is never distinguishing on its own (commas, full stops, quotes,
 *     brackets), keeping hyphens as spaces
 *
 * And explicitly does NOT:
 *   · strip legal suffixes (Ltd, Limited, plc, LLP, CIC). "Smith Ltd" and "Smith plc" can be
 *     different companies, and folding them is the unrecoverable direction.
 *   · expand or contract acronyms. "RTPI" and "Royal Town Planning Institute" stay separate rows
 *     until a stable key or a register says otherwise. Two visible rows beat one wrong one.
 *   · drop parenthetical qualifiers, which frequently carry the distinction (a body's Scottish arm).
 */
export function normaliseName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip combining accents, keep the letter
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')                // apostrophes are noise: "st john's" = "st johns"
    .replace(/[-–—/]/g, ' ')              // hyphens and slashes behave as separators
    .replace(/[^a-z0-9()+ ]/g, ' ')       // everything else that is not a word character
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .trim()
}

/** A person name normaliser that also drops the honorifics Parliament and committees sprinkle on. */
export function normalisePersonName(raw: string): string {
  const base = normaliseName(raw)
  return base
    .replace(/^(rt hon|right honourable|the rt hon) /, '')
    .replace(/^(mr|mrs|ms|miss|dr|prof|professor|sir|dame|lord|lady|baroness|baron|rev|reverend|cllr|councillor) /, '')
    .replace(/ (mp|mep|msp|ms|qc|kc|obe|mbe|cbe|kbe|dbe)$/, '')
    .trim()
}

/** cisId is 0 for "no id" at source; storing 0 would create one entity for every unkeyed body. */
export const cleanCisId = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null)

/** YYYY-MM-DD from an API timestamp, or null. Dates are on everything, so this is used everywhere. */
export function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  const d = v.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/** A name that identifies nothing, and must not become an entity. */
export function isUselessName(raw: string | null | undefined): boolean {
  if (!raw) return true
  const n = normaliseName(raw)
  if (n.length < 2) return true
  // ⚠ FOUND IN THE FIRST FULL RUN'S OWN OUTPUT, not in review: **"A Member of the Public" became a
  // person entity carrying six spellings** — i.e. an unknown number of unrelated individuals merged
  // into one actor, which is precisely the invisible, contaminating direction the brief rules out.
  // The list below had `member of the public` but `normaliseName` only strips a leading "the", not a
  // leading "a", so `a member of the public` sailed through an exact-match filter. Exact matching on
  // a normal form is the bug: these phrases arrive with articles, plurals and qualifiers.
  const bare = n.replace(/^(a|an) /, '')
  if ([
    'n a', 'na', 'none', 'nil', 'unknown', 'anonymous', 'anon', 'private individual',
    'individual', 'member of the public', 'members of the public', 'withheld', 'name withheld',
    'confidential', 'redacted', 'test', 'self', 'myself', 'personal', 'private',
    'concerned citizen', 'private citizen', 'citizen', 'resident', 'anonymised',
    'name redacted', 'not disclosed', 'undisclosed', 'no name', 'unnamed',
  ].includes(bare)) return true
  // A placeholder rarely arrives in exactly the form you listed. These patterns are deliberately
  // narrow — they must not catch a real body whose name happens to contain "public".
  return /^(anon|anonymous)\b/.test(bare)
    || /\b(name|identity) (withheld|redacted|removed|anonymised)\b/.test(bare)
    || /^(a |an )?(member|members) of the (public|general public)\b/.test(bare)
    || /^(private|concerned|individual) (citizen|individual|member)\b/.test(bare)
}

export type EntityKind = 'person' | 'organisation' | 'publication'
export type Predicate = 'gave-evidence-to' | 'spoke-in' | 'declared-interest'
export type KeySource = 'parl-member-id' | 'parl-cis-id' | 'parl-idms-id' | 'name-match' | 'singleton'
