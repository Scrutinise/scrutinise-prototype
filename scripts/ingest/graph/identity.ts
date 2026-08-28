/**
 * identity.ts — GRAPH 4B §1. THE IDENTITY BRIDGE.
 *
 * ONE canonical identity per instrument, and ONE resolver that every table,
 * every join and every audit calls. Not a translation applied at each join site.
 *
 * ── THE PROBLEM, IN ONE LINE ─────────────────────────────────────────────────
 *
 * UK Acts were cited by regnal year — "1 & 2 Eliz. 2" — until the Acts of
 * Parliament Numbering and Citation Act 1962 moved them to calendar years from
 * 1963. The two graph tables record those Acts under DIFFERENT identifier forms:
 *
 *   legislation_edges  keeps the URI's own calendar form   ukpga/1961/33
 *   citation_edge      normalises to the regnal form       ukpga/Eliz2/9-10/33
 *
 * Neither is wrong. But a join on the identifier drops every pre-1963 Act and
 * **the loss presents as a coverage result, not as a bug** — a list that is
 * quietly short, with no error and no gap flag. Measured 26 Aug (OI-19): three
 * sample Acts return 59, 50 and 50 rows under the URI form and 0 under the
 * citation_edge form.
 *
 * ⚠⚠ THIS IS THE FOURTH APPEARANCE OF THE REGNAL-YEAR TRAP IN THIS PROJECT, in
 * four separate code paths: the URI parser (`parseLegUri`), the extractor's file
 * filter (OI-15, `extract-cites-edges.ts`), the legislation title resolver, and
 * now a join. **Every previous fix was applied to ONE of two places that had to
 * agree, with no check that they agreed.** That is why this file exists and why
 * `check-4b-identity.ts` fails if a second copy of the alias-building logic
 * appears anywhere under `graph/`.
 *
 * ── TWO SURFACES, ONE SOURCE ─────────────────────────────────────────────────
 *
 * A resolver that only answers in TypeScript pushes every SQL join back to
 * hand-written string translation, which is the failure this file exists to
 * stop. So the same map is also materialised as an additive table:
 *
 *   legislation_identity (form PRIMARY KEY, canonical, basis)
 *
 * and a SQL join reads `JOIN legislation_identity ON form = <the gid>`. The
 * table is BUILT FROM THIS MODULE (`setup-identity-table.ts`) and from nothing
 * else, so the two surfaces cannot drift.
 *
 * ── THE STANDING RULE THIS OBEYS ─────────────────────────────────────────────
 *
 * ⚠ **NEVER MERGE TWO IDENTITIES ON SIMILARITY.** Every equivalence here has a
 * named, checkable BASIS:
 *
 *   'source-enumeration' — legislation.gov.uk's own year feeds paired the two
 *                          ids on the same entry (`docId` / `calendarId` in
 *                          v36/source-entries.json). The SOURCE asserted it.
 *   'prefix-alias'       — a declared, enumerated prefix family (eud/eudn/eudr),
 *                          not a guess about what looks alike.
 *   'zero-padding'       — the same numeral written with leading zeros
 *                          (eud/2000/0532 = eud/2000/532). A lexical identity,
 *                          not a resemblance.
 *
 * A form with no basis is NOT bridged. It stays as itself, and
 * `stats.unbridgedRegnalForms` COUNTS it rather than guessing at a twin.
 */
import fs from 'fs'
import path from 'path'

export const IDENTITY_TABLE = 'legislation_identity'

/** Where legislation.gov.uk's own enumeration lives. `docId` is the form the
 *  source treats as canonical; `calendarId` is the same instrument's calendar
 *  form when it differs. */
const DEFAULT_SOURCE_ENTRIES = path.join(__dirname, '..', 'v36', 'source-entries.json')

/** ⚠ Overridable ONLY so `check-4b-identity.ts` can point the loader at a
 *  path that does not exist and watch the degraded branch fire. Nothing in the
 *  build path sets it; a bridge silently reading a different file would be a
 *  worse version of the bug this module ends. */
function sourcePath(): string {
  return process.env.GRAPH_IDENTITY_SOURCE || DEFAULT_SOURCE_ENTRIES
}

/** Declared prefix families. NOT similarity — these are the same document type
 *  served under more than one prefix by the source. */
const PREFIX_ALIASES: Record<string, string[]> = { eud: ['eudn', 'eudr'] }

export type IdentityBasis =
  | 'self' | 'source-enumeration' | 'prefix-alias' | 'zero-padding'
  /** ⚠⚠ NOT a bridge — the RECORD OF A REFUSAL. This form names more than one
   *  instrument, so it has no canonical, and the row exists precisely so the
   *  refusal is countable. The brief's rule is that a form which cannot be
   *  resolved "stays unresolved and is COUNTED, not guessed at"; a form that is
   *  merely absent from the table is indistinguishable from one nobody has ever
   *  seen. */
  | 'ambiguous-refused'

export type IdentityStats = {
  /** entries read from the source enumeration */
  sourceEntries: number
  /** (regnal, calendar) pairs the SOURCE asserted */
  enumeratedPairs: number
  /** distinct forms with a canonical other than themselves */
  bridgedForms: number
  /** ⚠⚠ calendar forms claimed by MORE THAN ONE regnal Act — two parliamentary
   *  sessions inside one calendar year, each with its own chapter numbering, so
   *  `ukpga/1801/16` names two different Acts. NOT bridged, counted. */
  ambiguousForms: number
  /** ⚠ regnal-shaped gids seen in the enumeration with NO calendar twin —
   *  counted, never guessed at */
  unbridgedRegnalForms: number
  /** true when the enumeration file was not on disk: NOTHING is bridged and
   *  every caller must be able to see that, because an empty bridge looks
   *  exactly like a working one that found no pre-1963 Acts */
  degraded: boolean
  sourcePath: string
}

export type IdentityBridge = {
  /** The canonical id for this form. Returns the input unchanged when the form
   *  has no basis for an equivalence — never a guess. */
  canonical(gid: string): string
  /** Every id form this instrument is known by, canonical first. Always
   *  includes the input. */
  formsOf(gid: string): string[]
  /** True when this form is known by an id other than itself. */
  isBridged(gid: string): boolean
  /** Basis on which `gid` was mapped onto its canonical. */
  basisOf(gid: string): IdentityBasis
  /** ⚠ True when this form names more than one instrument and was therefore
   *  REFUSED a bridge. A caller asking about it is asking an ambiguous
   *  question and must be able to say so. */
  isAmbiguous(gid: string): boolean
  /** The instruments an ambiguous form could mean, for a report. */
  candidatesFor(gid: string): string[]
  /** Every bridged (form → canonical, basis) row, for the table build. */
  rows(): Array<{ form: string; canonical: string; basis: IdentityBasis }>
  /** ⚠ Every REFUSED form, with a null canonical, so the refusal is stored and
   *  countable rather than merely absent. */
  refusedRows(): Array<{ form: string; canonical: null; basis: 'ambiguous-refused' }>
  stats: IdentityStats
}

/** A gid whose year part is a regnal session (`Geo5/15-16`) rather than a
 *  calendar year. Pre-1963 primary legislation, and the whole reason for this
 *  file. */
export function isRegnalForm(gid: string): boolean {
  return /^[a-z]+\/[A-Z][A-Za-z0-9and]*\/[0-9-]+\/\d+$/.test(gid)
}

/** Zero-stripped variant of a gid whose final numeral is zero-padded, else null. */
function zeroStripped(gid: string): string | null {
  const p = gid.split('/')
  const last = p[p.length - 1]
  if (!/^0\d+$/.test(last)) return null
  return [...p.slice(0, -1), String(Number(last))].join('/')
}

type Entry = { docId: string; calendarId: string | null }

let _bridge: IdentityBridge | null = null

/**
 * Build (once per process) the bridge from the source enumeration.
 *
 * ⚠ If the enumeration is missing this returns a DEGRADED bridge that bridges
 * nothing and SAYS SO in `stats.degraded`. It does not throw, because the
 * extractors run without it; but every consumer that reports coverage must
 * surface the flag, since a bridge that resolves nothing is indistinguishable
 * from a corpus with no pre-1963 Acts in it — which is the exact shape of the
 * failure this module exists to end.
 */
export function loadIdentityBridge(force = false): IdentityBridge {
  if (_bridge && !force) return _bridge

  const canonicalOf = new Map<string, string>()
  const basisOf = new Map<string, IdentityBasis>()
  const formsOf = new Map<string, Set<string>>()
  const candidates = new Map<string, Set<string>>()
  let sourceEntries = 0
  let enumeratedPairs = 0
  let unbridgedRegnalForms = 0
  const src = sourcePath()
  const degraded = !fs.existsSync(src)

  const link = (form: string, canonical: string, basis: IdentityBasis) => {
    if (form !== canonical && !canonicalOf.has(form)) {
      canonicalOf.set(form, canonical)
      basisOf.set(form, basis)
    }
    const set = formsOf.get(canonical) ?? new Set<string>([canonical])
    set.add(form)
    formsOf.set(canonical, set)
  }

  if (!degraded) {
    const store: Record<string, Entry[]> = JSON.parse(fs.readFileSync(src, 'utf8'))
    // ── PASS 1: who claims each calendar form? ────────────────────────────────
    // ⚠⚠ A calendar id is NOT a unique identifier before 1963. Two parliamentary
    // SESSIONS can fall inside one calendar year — 41 Geo 3 and 42 Geo 3 are
    // both 1801 — and each session numbers its chapters from 1. So
    // `ukpga/1801/16` names TWO different Acts. Measured: 419 such forms.
    // Both existing copies of this map (`buildAliasMap`) write
    // `map.set(calendarId, docId)` in a single pass, so the LAST entry seen
    // wins and 419 calendar ids silently resolve to one of two different Acts.
    // That is a merge on similarity, arrived at by accident. We refuse it.
    for (const entries of Object.values(store)) {
      for (const e of entries) {
        if (!e.docId) continue
        sourceEntries++
        if (e.calendarId && e.calendarId !== e.docId) {
          enumeratedPairs++
          const set = candidates.get(e.calendarId) ?? new Set<string>()
          set.add(e.docId)
          candidates.set(e.calendarId, set)
        }
      }
    }
    // ── PASS 2: bridge only the unambiguous ones ──────────────────────────────
    for (const [calendarId, docIds] of candidates) {
      if (docIds.size > 1) continue          // ambiguous — counted below, never guessed
      const docId = [...docIds][0]
      link(calendarId, docId, 'source-enumeration')
      link(docId, docId, 'self')
    }
    for (const entries of Object.values(store)) {
      for (const e of entries) {
        // ⚠ A regnal id the source gave no calendar twin for. We do NOT
        // synthesise one from the session years — that would be similarity.
        if (e.docId && (!e.calendarId || e.calendarId === e.docId) && isRegnalForm(e.docId)) {
          unbridgedRegnalForms++
          link(e.docId, e.docId, 'self')
        }
      }
    }
  }
  const ambiguous = new Map([...candidates].filter(([, s]) => s.size > 1))

  // Declared, non-similarity equivalences layered on the enumerated ones.
  for (const form of [...formsOf.keys(), ...canonicalOf.keys()]) {
    const parts = form.split('/')
    for (const alt of PREFIX_ALIASES[parts[0]] ?? []) {
      link([alt, ...parts.slice(1)].join('/'), canonicalOf.get(form) ?? form, 'prefix-alias')
    }
  }

  const bridge: IdentityBridge = {
    canonical(gid) {
      const direct = canonicalOf.get(gid)
      if (direct) return direct
      const stripped = zeroStripped(gid)
      if (stripped) return canonicalOf.get(stripped) ?? stripped
      return gid
    },
    basisOf(gid) {
      const b = basisOf.get(gid)
      if (b) return b
      if (zeroStripped(gid)) return 'zero-padding'
      return 'self'
    },
    isBridged(gid) { return this.canonical(gid) !== gid },
    isAmbiguous(gid) { return ambiguous.has(gid) },
    candidatesFor(gid) { return [...(ambiguous.get(gid) ?? [])].sort() },
    formsOf(gid) {
      const canon = this.canonical(gid)
      const out = new Set<string>([canon, gid])
      for (const f of formsOf.get(canon) ?? []) out.add(f)
      // declared prefix family, applied to whatever we ended up with
      for (const id of [...out]) {
        const parts = id.split('/')
        for (const alt of PREFIX_ALIASES[parts[0]] ?? []) out.add([alt, ...parts.slice(1)].join('/'))
      }
      // zero-padding is lexical and applies in both directions
      for (const id of [...out]) { const s = zeroStripped(id); if (s) out.add(s) }
      return [canon, ...[...out].filter(f => f !== canon)]
    },
    rows() {
      const out: Array<{ form: string; canonical: string; basis: IdentityBasis }> = []
      for (const [form, canon] of canonicalOf) out.push({ form, canonical: canon, basis: basisOf.get(form) ?? 'self' })
      return out
    },
    refusedRows() {
      return [...ambiguous.keys()].map(form => ({ form, canonical: null as null, basis: 'ambiguous-refused' as const }))
    },
    stats: {
      sourceEntries, enumeratedPairs,
      bridgedForms: canonicalOf.size,
      ambiguousForms: ambiguous.size,
      unbridgedRegnalForms,
      degraded,
      sourcePath: src,
    },
  }
  _bridge = bridge
  return bridge
}

/** Drop the memo — for a check that plants a different source and re-reads. */
export function resetIdentityBridge(): void { _bridge = null }

/**
 * Candidate identities for one gid, for callers that must probe a set of ids
 * against a membership test (held gids, a corpus_acts lookup).
 *
 * ⚠ This REPLACES the two hand-rolled copies GRAPH 4A named — `buildAliasMap`
 * in `extract-citation-edges.ts` and `identitiesFor` in `v37-citation-gaps.ts`.
 * Import it; do not restate it.
 */
export function identitiesFor(gid: string): string[] {
  return loadIdentityBridge().formsOf(gid)
}

/**
 * The SQL a join must use, as one string, so no call site writes its own.
 *
 *   FROM citation_edge c
 *   JOIN legislation_identity li ON li.form = c.target_act_id
 *
 * ⚠ Use `canonicalSql(expr)` rather than joining by hand: it LEFT JOINs so an
 * unbridged id keeps its own value instead of vanishing from the result — a
 * bridge that silently drops what it cannot resolve is the original bug wearing
 * a different hat.
 */
export function canonicalSql(expr: string, alias = 'li'): string {
  return `COALESCE(${alias}.canonical, ${expr})`
}

if (require.main === module) {
  const b = loadIdentityBridge()
  console.log('[identity]', JSON.stringify(b.stats, null, 1))
  for (const gid of ['ukpga/1961/33', 'ukpga/Eliz2/9-10/33', 'ukpga/1949/54', 'ukpga/1936/49', 'ukpga/2010/25', 'ukpga/1801/16']) {
    const amb = b.isAmbiguous(gid) ? `  ⚠ AMBIGUOUS — could be ${b.candidatesFor(gid).join(' or ')}` : ''
    console.log(`  ${gid.padEnd(24)} → ${b.canonical(gid).padEnd(26)} [${b.basisOf(gid)}]  forms: ${b.formsOf(gid).join(', ')}${amb}`)
  }
}
