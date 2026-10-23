// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §4 (decision 258) — TEXTUAL AMENDMENTS AND THEIR THREE VIEWS: as it stands · marked up · as amended. GENERATED, never typed.
//
//   parseAmendments(clause)  — a small, DETERMINISTIC reader of the Parliamentary Counsel's forms (OPC Drafting Guidance Part 6):
//                              "In section 5 of the X Act 2010 (heading), for subsection (2) substitute— …", "omit paragraph (b)",
//                              "after subsection (3) insert— …", "at the end insert— …", "for “a” substitute “b”", "omit “a”",
//                              "after “a” insert “b”", "section 5 of the X Act 2010 is repealed". Several operations under one
//                              "In section N …—" as a lettered list. No model call.
//   heldLines(text)          — the held text of a section (flattened by the corpus: "149 1 A public authority … a eliminate …") read back
//                              into numbered lines: subsections by their numbers IN SEQUENCE (1, 1A, 2 …), paragraphs by their letters in
//                              sequence after a dash — never a bare number anywhere, which is how "section 15" would be misread.
//   applyAmendments(lines, …) — the marked-up lines: every change labelled IN WORDS ("omitted", "inserted", "substituted"), never colour
//                              alone (§21). Where the words or the unit to change are not in the held text, a FINDING in words for the owner
//                              ("the words ‘X’ were not found in section 5 as held; the marked-up view cannot be drawn — check the clause").
//   nonTextual(clause)       — a non-textual modification ("has effect as if …"), allowed as the *modifies* relation; it carries the line
//                              NON_TEXTUAL_LINE so a reviewer sees the choice.
//
// PURE; CLIENT-SAFE (imports nothing).
// ─────────────────────────────────────────────────────────────────────────────

export type Address = { sub: string | null; para: string | null }
export type AmendOp =
  | { kind: 'substitute-unit'; at: Address; text: string }
  | { kind: 'omit-unit'; at: Address }
  | { kind: 'insert-after'; at: Address; text: string }
  | { kind: 'insert-end'; within: Address | null; text: string }
  | { kind: 'substitute-words'; within: Address | null; from: string; to: string }
  | { kind: 'omit-words'; within: Address | null; words: string }
  | { kind: 'insert-words'; within: Address | null; after: string; text: string }
  | { kind: 'repeal' }

export interface Amendment {
  /** The clause's own subsection the amendment is in ("(1)" → 1); null where the clause has no numbered subsections. */
  part: number | null
  /** The amended Act or instrument by its short title, as the clause cites it ("the Equality Act 2010"), and the section. */
  act: string
  section: string
  ops: AmendOp[]
  raw: string
}
export interface Unparsed { part: number | null; raw: string; why: string }
export interface NonTextual { part: number | null; subject: string; raw: string }
export interface ParsedClause { amendments: Amendment[]; unparsed: Unparsed[]; nonTextual: NonTextual[] }

/** The line a non-textual modification carries (BRIEF_26V1b §4a). `[the instrument]` is the clause's own subject. */
export const nonTextualLine = (subject: string) =>
  `A non-textual modification: ${subject.replace(/^the\s+/i, 'the ')} ${/\b(Regulations|Rules)\b/.test(subject) ? 'are' : 'is'} not amended; ${/\b(Regulations|Rules)\b/.test(subject) ? 'they are' : 'it is'} read differently for these bodies.`

// ── reading the clause ─────────────────────────────────────────────────────────────────────────────────────────
const norm = (s: string) => s.replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim()
const unit = (kind: string, n: string, of?: string): Address => (kind.startsWith('para') ? { sub: of ?? null, para: n } : { sub: n, para: null })
/** The inserted or substituting text: between the first opening quote and the last closing one (OPC: the text is quoted). */
function quoted(s: string): string | null {
  const a = s.indexOf('“'), b = s.lastIndexOf('”')
  if (a >= 0 && b > a) return s.slice(a + 1, b).trim()
  const m = /"([\s\S]+)"/.exec(s)
  return m ? m[1].trim() : null
}

const UNIT = '(subsection|paragraph)\\s+\\(([0-9A-Za-z]+)\\)(?:\\s+of\\s+subsection\\s+\\(([0-9A-Za-z]+)\\))?'
const OPS: Array<{ re: RegExp; make: (m: RegExpExecArray, rest: string) => AmendOp | string }> = [
  { re: new RegExp(`^for\\s+${UNIT}\\s+substitute\\b`, 'i'), make: (m, rest) => { const t = quoted(rest); return t ? { kind: 'substitute-unit', at: unit(m[1].toLowerCase(), m[2], m[3]), text: t } : 'the substituted text is not in quotation marks' } },
  { re: new RegExp(`^omit\\s+${UNIT}`, 'i'), make: (m) => ({ kind: 'omit-unit', at: unit(m[1].toLowerCase(), m[2], m[3]) }) },
  { re: new RegExp(`^after\\s+${UNIT}\\s+insert\\b`, 'i'), make: (m, rest) => { const t = quoted(rest); return t ? { kind: 'insert-after', at: unit(m[1].toLowerCase(), m[2], m[3]), text: t } : 'the inserted text is not in quotation marks' } },
  { re: new RegExp(`^at\\s+the\\s+end(?:\\s+of\\s+${UNIT})?\\s+insert\\b`, 'i'), make: (m, rest) => { const t = quoted(rest); return t ? { kind: 'insert-end', within: m[1] ? unit(m[1].toLowerCase(), m[2], m[3]) : null, text: t } : 'the inserted text is not in quotation marks' } },
  { re: /^for\s+“([^”]+)”\s+substitute\s+“([^”]+)”/i, make: (m) => ({ kind: 'substitute-words', within: null, from: m[1], to: m[2] }) },
  { re: /^omit\s+(?:the\s+words\s+)?“([^”]+)”/i, make: (m) => ({ kind: 'omit-words', within: null, words: m[1] }) },
  { re: /^after\s+“([^”]+)”\s+insert\s+“([^”]+)”/i, make: (m) => ({ kind: 'insert-words', within: null, after: m[1], text: m[2] }) },
]

/** One operation's text → an operation, or the reason it could not be read. "in subsection (2), for “a” substitute “b”" scopes a words op. */
function readOp(text: string): AmendOp | string {
  let t = text.trim().replace(/^\(([a-z]{1,2})\)\s*/, '').replace(/[;.]\s*(and|or)?\s*$/i, '').trim()
  let within: Address | null = null
  const scope = new RegExp(`^in\\s+${UNIT}\\s*,\\s*`, 'i').exec(t)
  if (scope) { within = unit(scope[1].toLowerCase(), scope[2], scope[3]); t = t.slice(scope[0].length) }
  for (const o of OPS) {
    const m = o.re.exec(t)
    if (!m) continue
    const op = o.make(m, t.slice(m[0].length))
    if (typeof op === 'string') return op
    if (within && (op.kind === 'substitute-words' || op.kind === 'omit-words' || op.kind === 'insert-words')) return { ...op, within }
    if (within && op.kind === 'insert-end' && !op.within) return { ...op, within }
    if (within && (op.kind === 'substitute-unit' || op.kind === 'omit-unit' || op.kind === 'insert-after') && op.at.para && !op.at.sub) return { ...op, at: { ...op.at, sub: within.sub } }
    return op
  }
  return `“${norm(t).slice(0, 80)}” is not one of the forms read (for … substitute, omit, after … insert, at the end insert, is repealed)`
}

/** Split "—(a) for …; (b) omit …" into its lettered operations; a single operation stays one. Quoted text is never split inside. */
function splitOps(rest: string): string[] {
  const body = rest.replace(/^[\s—–-]+/, '')
  if (!/^\(a\)\s/.test(body)) return [body]
  const out: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '“') depth++
    else if (c === '”') depth = Math.max(0, depth - 1)
    else if (depth === 0 && i > start && /\s/.test(body[i - 1] ?? '') && /^\([a-z]{1,2}\)\s/.test(body.slice(i, i + 5))) { out.push(body.slice(start, i)); start = i }
  }
  out.push(body.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

const HEAD = /^In\s+section\s+([0-9]+[A-Z]*)\s+of\s+(the\s+.+?\b(?:Act|Regulations|Order|Rules)\s+\d{4})(?:\s*\((?:[^()]|\([^()]*\))*\))?\s*,?\s*/
const HEAD_ACT_FIRST = /^In\s+(the\s+.+?\b(?:Act|Regulations|Order|Rules)\s+\d{4})\s*,\s*in\s+section\s+([0-9]+[A-Z]*)\s*(?:\((?:[^()]|\([^()]*\))*\))?\s*,?\s*/
const REPEAL = /^(?:Section|section)\s+([0-9]+[A-Z]*)\s+of\s+(the\s+.+?\b(?:Act|Regulations|Order|Rules)\s+\d{4})\s+is\s+repealed/
const REPEAL_OMIT = /^In\s+(the\s+.+?\b(?:Act|Regulations|Order|Rules)\s+\d{4})\s*,\s*omit\s+section\s+([0-9]+[A-Z]*)\b/
const NON_TEXTUAL = /\b(?:ha(?:s|ve)\s+effect\s+as\s+if|(?:is|are)\s+to\s+be\s+read\s+as\s+if|(?:is|are)\s+to\s+be\s+treated\s+as\s+if)\b/i

/** The clause's numbered subsections, as the document view numbers them ("(1) …" at a line start). Text above (1) is part null. */
function clauseParts(clause: string): Array<{ part: number | null; text: string }> {
  const text = clause.replace(/\r\n/g, '\n')
  const hits = [...text.matchAll(/^\((\d+)\)\s/gm)]
  if (!hits.length) return [{ part: null, text }]
  return hits.map((h, i) => ({ part: Number(h[1]), text: text.slice(h.index! + h[0].length, hits[i + 1]?.index ?? text.length).trim() }))
}

export function parseAmendments(clause: string): ParsedClause {
  const out: ParsedClause = { amendments: [], unparsed: [], nonTextual: [] }
  for (const { part, text } of clauseParts(clause)) {
    const flat = text.replace(/\n+/g, ' ').trim()
    let m: RegExpExecArray | null
    if ((m = REPEAL.exec(flat))) { out.amendments.push({ part, act: m[2], section: m[1], ops: [{ kind: 'repeal' }], raw: flat }); continue }
    if ((m = REPEAL_OMIT.exec(flat))) { out.amendments.push({ part, act: m[1], section: m[2], ops: [{ kind: 'repeal' }], raw: flat }); continue }
    const h1 = HEAD.exec(flat), h2 = h1 ? null : HEAD_ACT_FIRST.exec(flat)
    const head = h1 ?? h2
    if (head) {
      const [act, section] = h1 ? [h1[2], h1[1]] : [h2![1], h2![2]]
      const ops: AmendOp[] = []
      const why: string[] = []
      for (const o of splitOps(flat.slice(head[0].length))) { const r = readOp(o); if (typeof r === 'string') why.push(r); else ops.push(r) }
      if (why.length) out.unparsed.push({ part, raw: flat, why: why.join('; ') })
      if (ops.length) out.amendments.push({ part, act, section, ops, raw: flat })
      continue
    }
    if (NON_TEXTUAL.test(flat)) out.nonTextual.push({ part, subject: flat.split(NON_TEXTUAL)[0].trim().replace(/^The\b/, 'the') || 'the provision', raw: flat })
    else if (/^In\s+(?:section|the\s+.+?\b(?:Act|Regulations)\s+\d{4})/.test(flat)) out.unparsed.push({ part, raw: flat, why: 'it reads as an amendment but names no section in a form this reader knows ("In section N of the X Act YYYY, …")' })
  }
  return out
}

// ── reading the held text back into lines ───────────────────────────────────────────────────────────────────────
export interface HeldLine { at: Address; label: string; text: string }

/** Is `n` the next subsection number after `cur`? 1 → 1A or 2; 1A → 1B or 2; null (none yet) → 1. */
function nextSub(cur: string | null, n: string): boolean {
  if (cur == null) return n === '1'
  const [, cn, cl] = /^(\d+)([A-Z]*)$/.exec(cur) ?? []
  const [, nn, nl] = /^(\d+)([A-Z]*)$/.exec(n) ?? []
  if (!cn || !nn) return false
  if (Number(nn) === Number(cn) + 1) return nl === '' || nl === 'A'
  if (Number(nn) === Number(cn)) return nl.length === 1 && (cl === '' ? nl === 'A' : nl.charCodeAt(0) === cl.charCodeAt(0) + 1)
  return false
}
const nextLetter = (c: string) => String.fromCharCode(c.charCodeAt(0) + 1)

export function heldLines(text: string, section?: string): HeldLine[] {
  let t = norm(text)
  const lead = /^([0-9]+[A-Z]*)\s+/.exec(t)
  if (lead && (!section || lead[1] === section)) t = t.slice(lead[0].length)
  // subsections: bare numbers IN SEQUENCE, each followed by a capital or an opening quote
  const subs: Array<{ n: string; at: number; len: number }> = []
  let cur: string | null = null
  for (const m of t.matchAll(/(?:^|\s)([0-9]+[A-Z]?)\s+(?=[A-Z“"‘(])/g)) {
    if (nextSub(cur, m[1])) { subs.push({ n: m[1], at: m.index!, len: m[0].length }); cur = m[1] }
  }
  const units = subs.length ? subs.map((s, i) => ({ sub: s.n as string | null, body: t.slice(s.at + s.len, subs[i + 1]?.at ?? t.length).trim() })) : [{ sub: null as string | null, body: t }]
  const out: HeldLine[] = []
  for (const u of units) {
    // paragraphs: letters in sequence from "a", the first after a dash, the rest after "; " or ", and " / ", or "
    const paras: Array<{ p: string; at: number; len: number }> = []
    let want = 'a'
    for (const m of u.body.matchAll(/(—|–|;|,|\band\b|\bor\b|:)\s+([a-z])\s+(?=\S)/g)) {
      if (m[2] !== want) continue
      if (want === 'a' && !/[—–:]/.test(m[1])) continue
      paras.push({ p: m[2], at: m.index! + m[1].length, len: m[0].length - m[1].length }); want = nextLetter(want)
    }
    const label = u.sub ? `(${u.sub})` : ''
    if (!paras.length) { out.push({ at: { sub: u.sub, para: null }, label, text: u.body }); continue }
    out.push({ at: { sub: u.sub, para: null }, label, text: u.body.slice(0, paras[0].at).trim() })
    paras.forEach((p, i) => out.push({ at: { sub: u.sub, para: p.p }, label: `(${p.p})`, text: u.body.slice(p.at + p.len, paras[i + 1]?.at ?? u.body.length).trim() }))
  }
  return out
}

/** Inserted text as lines: "(1A) This section …" is a subsection line; "(c) …" a paragraph line; anything else one unlabelled line. */
function insertedLines(text: string, ctxSub: string | null): HeldLine[] {
  return text.split(/\n+|(?<=[.;—])\s+(?=\([0-9]+[A-Z]*\)\s|\([a-z]{1,2}\)\s)/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^\(([0-9]+[A-Z]*)\)\s*([\s\S]*)$/.exec(s)
    if (m) return { at: { sub: m[1], para: null }, label: `(${m[1]})`, text: m[2] }
    const p = /^\(([a-z]{1,2})\)\s*([\s\S]*)$/.exec(s)
    if (p) return { at: { sub: ctxSub, para: p[1] }, label: `(${p[1]})`, text: p[2] }
    return { at: { sub: ctxSub, para: null }, label: '', text: s }
  })
}

// ── the marked-up lines ──────────────────────────────────────────────────────────────────────────────────────────
export type SegKind = 'same' | 'omitted' | 'inserted'
export interface Seg { k: SegKind; text: string }
export type ChangeWord = 'omitted' | 'inserted' | 'substituted' | 'repealed'
export interface MarkedLine { at: Address; label: string; segs: Seg[]; change: ChangeWord | null; insertedLine?: boolean }
export interface MarkedUp { lines: MarkedLine[]; findings: string[]; applied: number }

const inUnit = (l: { at: Address }, u: Address) => (u.sub == null || l.at.sub === u.sub) && (u.para == null || l.at.para === u.para)
const unitWords = (a: Address) => a.para ? `paragraph (${a.para})${a.sub ? ` of subsection (${a.sub})` : ''}` : `subsection (${a.sub})`
const live = (l: MarkedLine) => l.segs.some((s) => s.k !== 'omitted')

export function applyAmendments(held: HeldLine[], ops: AmendOp[], where: string): MarkedUp {
  let lines: MarkedLine[] = held.map((h) => ({ at: h.at, label: h.label, segs: [{ k: 'same', text: h.text }], change: null }))
  const findings: string[] = []
  let applied = 0
  const notFound = (what: string) => findings.push(`${what} ${what.startsWith('the words') ? 'were' : 'was'} not found in ${where} as held; the marked-up view cannot be drawn for it — check the clause.`)
  const lastIndexOf = (u: Address) => { let k = -1; lines.forEach((l, i) => { if (inUnit(l, u) && !l.insertedLine) k = i }); return k }
  const addAfter = (i: number, text: string, ctx: string | null, change: ChangeWord) => {
    const add: MarkedLine[] = insertedLines(text, ctx).map((x) => ({ at: x.at, label: x.label, segs: [{ k: 'inserted', text: x.text }], change, insertedLine: true }))
    // An inserted subsection whose number the section already uses (and keeps) is a numbering collision: a finding, said in words.
    for (const x of add) if (x.at.para == null && x.at.sub && lines.some((l) => !l.insertedLine && l.at.sub === x.at.sub && l.at.para == null && live(l)))
      findings.push(`the clause inserts a subsection (${x.at.sub}), but ${where} as held already has a subsection (${x.at.sub}); the new one needs another number — check the clause.`)
    lines = [...lines.slice(0, i + 1), ...add, ...lines.slice(i + 1)]
  }
  /** Words in one live line of the scope: split it into same / omitted / inserted. */
  const words = (within: Address | null, find: string, edit: (seg: string) => Seg[], change: ChangeWord): boolean => {
    const want = norm(find)
    for (const l of lines) {
      if (within && !inUnit(l, within)) continue
      const k = l.segs.findIndex((s) => s.k === 'same' && norm(s.text).includes(want))
      if (k < 0) continue
      const s = norm(l.segs[k].text), at = s.indexOf(want)
      l.segs = [...l.segs.slice(0, k), ...(at > 0 ? [{ k: 'same' as const, text: s.slice(0, at) }] : []), ...edit(s.slice(at, at + want.length)), ...(at + want.length < s.length ? [{ k: 'same' as const, text: s.slice(at + want.length) }] : []), ...l.segs.slice(k + 1)]
      l.change = l.change ?? change
      return true
    }
    return false
  }
  for (const op of ops) {
    switch (op.kind) {
      case 'repeal':
        lines.forEach((l) => { l.segs = l.segs.map((s) => (s.k === 'same' ? { k: 'omitted', text: s.text } : s)); l.change = 'repealed' }); applied++; break
      case 'omit-unit': case 'substitute-unit': {
        const hit = lines.filter((l) => inUnit(l, op.at) && live(l))
        if (!hit.length) { notFound(unitWords(op.at)); break }
        const last = lastIndexOf(op.at)
        hit.forEach((l) => { l.segs = l.segs.map((s) => (s.k === 'same' ? { k: 'omitted', text: s.text } : s)); l.change = op.kind === 'omit-unit' ? 'omitted' : 'substituted' })
        if (op.kind === 'substitute-unit') addAfter(last, op.text, op.at.sub, 'substituted')
        applied++; break
      }
      case 'insert-after': {
        const i = lastIndexOf(op.at)
        if (i < 0) { notFound(unitWords(op.at)); break }
        addAfter(i, op.text, op.at.sub, 'inserted'); applied++; break
      }
      case 'insert-end': {
        const i = op.within ? lastIndexOf(op.within) : lines.length - 1
        if (i < 0) { notFound(unitWords(op.within!)); break }
        addAfter(i, op.text, op.within?.sub ?? null, 'inserted'); applied++; break
      }
      case 'substitute-words':
        if (words(op.within, op.from, (s) => [{ k: 'omitted', text: s }, { k: 'inserted', text: op.to }], 'substituted')) applied++
        else notFound(`the words ‘${op.from}’${op.within ? ` (in ${unitWords(op.within)})` : ''}`)
        break
      case 'omit-words':
        if (words(op.within, op.words, (s) => [{ k: 'omitted', text: s }], 'omitted')) applied++
        else notFound(`the words ‘${op.words}’${op.within ? ` (in ${unitWords(op.within)})` : ''}`)
        break
      case 'insert-words':
        if (words(op.within, op.after, (s) => [{ k: 'same', text: s }, { k: 'inserted', text: ` ${op.text}` }], 'inserted')) applied++
        else notFound(`the words ‘${op.after}’${op.within ? ` (in ${unitWords(op.within)})` : ''}`)
        break
    }
  }
  return { lines, findings, applied }
}

/** The three views as plain lines: as it stands (the held text), as amended (omitted words gone, inserted words in). */
export const asItStands = (held: HeldLine[]) => held.map((h) => `${h.label ? `${h.label} ` : ''}${h.text}`.trim())
export const asAmended = (m: MarkedUp) => m.lines.filter((l) => l.segs.some((s) => s.k !== 'omitted')).map((l) => `${l.label ? `${l.label} ` : ''}${l.segs.filter((s) => s.k !== 'omitted').map((s) => s.text).join('')}`.replace(/\s+/g, ' ').trim())

// ── matching an amendment to the provision the instruction names ──────────────────────────────────────────────
const actKey = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** The instruction line an amendment is to: same section, and the same Act where the title is known. */
export function targetFor<T extends { docUri: string; provisionPath: string | null }>(a: Pick<Amendment, 'act' | 'section'>, lines: T[], titles: Record<string, string | null>): T | null {
  const same = lines.filter((l) => l.provisionPath?.toLowerCase() === `section/${a.section.toLowerCase()}`)
  const titled = same.filter((l) => titles[l.docUri] && actKey(titles[l.docUri]!) === actKey(a.act))
  if (titled.length) return titled[0]
  return same.length === 1 && !titles[same[0].docUri] ? same[0] : null
}

/** Coverage on a set of clauses, for the report (§4c): how many amending subsections parse, and which do not, and why. */
export function coverage(clauses: string[]): { amendments: number; ops: number; unparsed: Unparsed[]; nonTextual: number } {
  let amendments = 0, ops = 0, nt = 0
  const unparsed: Unparsed[] = []
  for (const c of clauses) {
    const p = parseAmendments(c)
    amendments += p.amendments.length; ops += p.amendments.reduce((n, a) => n + a.ops.length, 0); nt += p.nonTextual.length; unparsed.push(...p.unparsed)
  }
  return { amendments, ops, unparsed, nonTextual: nt }
}
