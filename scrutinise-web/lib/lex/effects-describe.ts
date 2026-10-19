// ─────────────────────────────────────────────────────────────────────────────
// THE WORDS FOR AN EFFECTS ANSWER — ONE RENDERER, SO NO CALLER REBUILDS THEM.
//
// Pure, and `import type` only from the reader (erased), so nothing here reaches the database.
//
// ⚠⚠ WHAT THESE SENTENCES MUST NOT DO, in the order a caller is tempted to:
//   · say "N amendments" of a count that includes `excluded` and `applied by …` rows — every
//     count here is SPLIT into the rows that change the words and the rows that do not;
//   · say "the official record says…" of a row that is our own extraction, or quote an official
//     row as though it held a sentence — each row and each count names its origin;
//   · state a whole-corpus total — nothing here has one to state;
//   · call a stored copy current — the freshness sentence is always the last thing said.
// ─────────────────────────────────────────────────────────────────────────────

import type { EffectRow, EffectsResult, EffectTypeCounts } from '@/lib/lex/statutory-graph'

/** What each not-textual rule's rows ARE, in a reader's words (plural, to follow a count). */
export const NOT_TEXTUAL_WORDS: Record<string, string> = {
  commencement: 'commencements',
  relationship: 'relationships rather than changes',
  'power-conferred': 'powers conferred to amend, repeal or modify',
  excluded: 'excluded or disapplied',
  'earlier-provision': 'concerning an earlier amending provision',
  application: 'applied, modified, restricted or extended',
  lapse: 'lapsing by their own terms',
  implicit: 'implied repeals',
}

const ORIGIN_WORDS = {
  official: 'legislation.gov.uk’s official record',
  extracted: 'our own extraction from the text',
} as const

/** "Equality Act 2010: 705 amends / 90 repeals / 16 modifies" — the per-type counts for THIS Act only. */
export function effectsHeadline(r: EffectsResult): string {
  const name = r.target.title ?? r.target.gid
  const where = r.target.provision ? `, ${r.target.provision}` : ''
  if (r.resolution.bridge === 'ambiguous-refused') return `${name}${where}: not answered — the Act could not be identified`
  // ⚠ NAMING A PROVISION SPLITS THE COUNT. Rows recorded against the Act as a whole come back with a
  // provision query (an Act-wide repeal bears on every section), but they are not "about" this provision;
  // folding them into one number would tell a clerk asking about one section that it had been amended
  // five times when the five are recorded against the whole Act.
  const n = (c: EffectTypeCounts) => r.target.provision
    ? `${c.byScope.provision}${c.byScope.actWide ? ` (+${c.byScope.actWide} on the whole Act)` : ''} ${c.edgeType}`
    : `${c.total} ${c.edgeType}`
  return `${name}${where}: ${r.perType.map(n).join(' / ')}`
}

function typeLine(c: EffectTypeCounts, direction: EffectsResult['direction']): string {
  if (c.total === 0) {
    return `0 ${c.edgeType}: the lookup ran and found no ${direction} ${c.edgeType} rows recorded for this Act.`
  }
  const parts: string[] = []
  const k = c.byKind
  if (c.edgeType === 'commences' || c.edgeType === 'made-under' || c.edgeType === 'cites') {
    // These are not changes to the words by their nature; saying "0 change the words" would be noise.
  } else {
    parts.push(`${k.textual} change the words of the Act`)
    if (k['not-textual']) {
      const why = Object.entries(c.byRule)
        .filter(([rule]) => rule in NOT_TEXTUAL_WORDS && rule !== 'commencement' && rule !== 'relationship')
        .sort((a, b) => b[1] - a[1])
        .map(([rule, n]) => `${n} ${NOT_TEXTUAL_WORDS[rule]}`)
      parts.push(`${k['not-textual']} do NOT change the words (${why.join(', ')})`)
    }
    if (k.unclassified) parts.push(`${k.unclassified} not classified — recorded wording shown, not to be called a textual change`)
  }
  if (c.prospective) parts.push(`${c.prospective} prospective (recorded, not yet in force)`)

  const o = c.byOrigin
  const origin: string[] = []
  if (o.official) origin.push(`${o.official} from ${ORIGIN_WORDS.official}`)
  if (o.extracted) origin.push(`${o.extracted} from ${ORIGIN_WORDS.extracted}`)
  if (o.unrecognised) origin.push(`${o.unrecognised} from a source we do not recognise`)

  const scope = c.byScope.actWide
    ? ` ${c.byScope.actWide} ${c.byScope.actWide === 1 ? 'is' : 'are'} recorded against the Act as a whole.`
    : ''
  const cut = c.truncated ? ` Showing ${c.returned} of ${c.total}.` : ''
  return `${c.total} ${c.edgeType}${parts.length ? `: ${parts.join('; ')}` : ''}. ${origin.join('; ')}.${scope}${cut}`
}

/**
 * The whole answer as lines of prose, freshness LAST. `rowsCounted` is stated so a reader can tell
 * "nothing found" from "nothing read".
 */
export function describeEffects(r: EffectsResult): string[] {
  const out: string[] = [effectsHeadline(r)]
  if (r.resolution.note) out.push(r.resolution.note.charAt(0).toUpperCase() + r.resolution.note.slice(1) + (r.resolution.note.endsWith('.') ? '' : '.'))
  if (r.resolution.bridge === 'ambiguous-refused') {
    out.push(r.freshness.caveat)
    return out
  }
  for (const c of r.perType) out.push(typeLine(c, r.direction))
  const unknown = r.perType.flatMap((c) => c.bySource.filter((s) => s.origin === null).map((s) => `${s.source} (${s.rows})`))
  if (unknown.length) out.push(`Rows from a source this build does not recognise were counted and returned with their raw label, not folded into either kind: ${unknown.join(', ')}.`)
  out.push(`Counted ${r.examined.rowsCounted} ${r.examined.rowsCounted === 1 ? 'row' : 'rows'} for this Act${r.target.provision ? ' and provision' : ''}; ${r.examined.rowsReturned} ${r.examined.rowsReturned === 1 ? 'is' : 'are'} listed.`)
  out.push(r.coverage)
  out.push(r.freshness.caveat)
  return out
}

/**
 * ONE ROW, in words. ⚠ The verbatim `sub_type` is always in it, a not-textual row says so IN CAPITALS
 * before anything else, and the origin is named — so a row cannot reach a screen as something
 * stronger than it is.
 */
export function describeEffectRow(row: EffectRow): string {
  const kind = row.changeKind === 'textual'
    ? 'changes the words'
    : row.changeKind === 'not-textual'
      ? `DOES NOT CHANGE THE WORDS — ${row.changeReason}`
      : 'NOT CLASSIFIED — do not call this a textual change'
  const origin = row.origin
    ? ORIGIN_WORDS[row.origin]
    : `a source we do not recognise (${row.source})`
  const end = `${row.otherEnd.title ?? row.otherEnd.gid}${row.otherEnd.provision ? ` ${row.otherEnd.provision}` : ''}`
  const here = row.thisEndProvision ?? 'the Act as a whole'
  const dir = row.direction === 'inbound' ? `${end} → ${here}` : `${here} → ${end}`
  const flags = [row.prospective ? 'prospective' : '', row.temporary ? 'temporary' : ''].filter(Boolean)
  return `${row.edgeType} · “${row.subType || '(no type recorded)'}” · ${dir} · ${kind}${flags.length ? ` · ${flags.join(', ')}` : ''} · ${origin}`
}
