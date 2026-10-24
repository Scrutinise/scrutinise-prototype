// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2c (BRIEF_26V §7, decision 239) — RE-ATTACHING THE OPEN ISSUES to the action, document and part each concerns. PURE; CLIENT-SAFE.
//
// "The 176 open issues on 452c5ade are re-attached where a document now exists, and otherwise stay on the action. Report counts before and
// after." Lex reads each issue against the action index (number, heading and its kind, title) and the documents (D-number, kind, parts) and
// places it: on a document and part, on an action, or on the proposal as a whole where it concerns no single action. Every placement is
// CHECKED here against what exists; a placement that names something that does not exist falls back one level and the fall is counted.
// ⚠ §27: the instructions describe how to place an issue; they carry no specimen issue, action or sentence.
// ⚠ Nothing is lost: an issue Lex leaves unplaced stays on the proposal as a whole, exactly as before; nothing is deleted or re-worded.
// ─────────────────────────────────────────────────────────────────────────────

export const ATTACH_BATCH = 25

export const ATTACH_SYSTEM = [
  'You are Lex. Each ISSUE below was raised against a policy proposal as a whole, before the proposal had coherent actions and documents.',
  'Place each issue where it now belongs, so it can be answered there:',
  '- DOCUMENT: the issue is about what a particular document of an action says or must say (its D-number is listed). Give the action number,',
  '  the document as "<action>.<document>" exactly as listed, and the part number if one listed part is plainly what it concerns (else null).',
  '- ACTION: the issue concerns one action, but no listed document of it. Give the action number.',
  '- PROPOSAL: the issue concerns the proposal as a whole, several actions equally, or none of them. Give no action.',
  'Choose the single action the issue most directly bears on; where it bears on several equally, it is PROPOSAL. Use only action numbers and',
  'documents that appear in the lists. Give a reason of one sentence naming what in the issue decided the place. Answer every issue by its key.',
  'Never carry over an example, a subject or a phrase from these instructions or from any other proposal.',
].join('\n')

export const ATTACH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['placements'],
  properties: {
    placements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'place', 'action', 'document', 'part', 'reason'],
        properties: {
          key: { type: 'string' }, place: { type: 'string', enum: ['DOCUMENT', 'ACTION', 'PROPOSAL'] },
          action: { type: ['integer', 'null'] }, document: { type: ['string', 'null'] }, part: { type: ['integer', 'null'] }, reason: { type: 'string' },
        },
      },
    },
  },
} as const

export interface AttachAnswer { placements: Array<{ key: string; place: string; action: number | null; document: string | null; part: number | null; reason: string }> }
export interface AttachIssue { key: string; id: string; title: string | null; text: string; passKey: string }
export interface AttachAction { id: string; number: number; title: string; heading: string | null; headingKind: string | null }
export interface AttachDocument { id: string; actionId: string; action: number; number: number; kind: string; title: string; parts: Array<{ n: number; title: string }> }

/** The fixed context, the same for every batch: the actions and their documents. */
export function attachIndex(actions: AttachAction[], docs: AttachDocument[]): string {
  return [
    `THE ACTIONS (${actions.length}):`,
    ...actions.map((a) => `#${a.number}${a.heading ? ` [${a.heading}${a.headingKind ? ` — ${a.headingKind.toLowerCase().replace(/_/g, ' ')}` : ''}]` : ''} ${a.title.replace(/\s+/g, ' ').slice(0, 160)}`),
    '',
    docs.length ? `THE DOCUMENTS (${docs.length}):` : 'THE DOCUMENTS: none yet.',
    ...docs.map((d) => `${d.action}.${d.number} (${d.kind.toLowerCase().replace(/_/g, ' ')}) ${d.title.slice(0, 120)}${d.parts.length > 1 ? `; parts: ${d.parts.map((p) => `${p.n} ${p.title.slice(0, 60)}`).join(' · ')}` : ''}`),
  ].join('\n')
}

export function attachUser(index: string, issues: AttachIssue[]): string {
  return [index, '', `THE ISSUES (${issues.length}):`, ...issues.map((i) => `<issue key="${i.key}">${i.title ? `\n${i.title}` : ''}\n${i.text.replace(/\s+/g, ' ').slice(0, 1200)}\n</issue>`)].join('\n')
}

export type Placement =
  | { issueId: string; place: 'DOCUMENT'; actionId: string; documentId: string; partN: number | null; reason: string }
  | { issueId: string; place: 'ACTION'; actionId: string; reason: string }
  | { issueId: string; place: 'PROPOSAL'; reason: string }

/** Every way a placement was corrected, counted (rule: count what was not done, in words). */
export interface AttachFalls { unknownAction: number; documentNotOfAction: number; partOutOfRange: number; noAnswer: number; duplicate: number; unknownKey: number }
export const NO_FALLS: AttachFalls = { unknownAction: 0, documentNotOfAction: 0, partOutOfRange: 0, noAnswer: 0, duplicate: 0, unknownKey: 0 }

/**
 * Checks Lex's answer against what exists. A missing action → PROPOSAL; a document that is not that action's → ACTION; a part outside the
 * document → the document alone. An issue with no answer stays on the proposal as a whole. Returns one placement per issue asked about.
 */
export function checkPlacements(issues: AttachIssue[], ans: AttachAnswer, actions: AttachAction[], docs: AttachDocument[]): { placements: Placement[]; falls: AttachFalls } {
  const falls = { ...NO_FALLS }
  const byNum = new Map(actions.map((a) => [a.number, a]))
  const out = new Map<string, Placement>()
  for (const p of ans.placements ?? []) {
    const issue = issues.find((i) => i.key === p.key)
    if (!issue) { falls.unknownKey++; continue }
    if (out.has(issue.id)) { falls.duplicate++; continue }
    const reason = String(p.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)
    if (p.place === 'PROPOSAL' || p.action == null) { out.set(issue.id, { issueId: issue.id, place: 'PROPOSAL', reason }); continue }
    const act = byNum.get(p.action)
    if (!act) { falls.unknownAction++; out.set(issue.id, { issueId: issue.id, place: 'PROPOSAL', reason: `${reason} (Lex named #${p.action}, which is not a live action, so it stays on the proposal.)`.trim() }); continue }
    if (p.place === 'DOCUMENT' && p.document) {
      const m = /^(\d+)\.(\d+)$/.exec(p.document.trim().replace(/^D\./, ''))
      const doc = m ? docs.find((d) => d.actionId === act.id && d.action === Number(m[1]) && d.number === Number(m[2])) : undefined
      if (!doc) { falls.documentNotOfAction++; out.set(issue.id, { issueId: issue.id, place: 'ACTION', actionId: act.id, reason }); continue }
      let partN = p.part ?? null
      if (partN != null && !doc.parts.some((x) => x.n === partN)) { falls.partOutOfRange++; partN = null }
      out.set(issue.id, { issueId: issue.id, place: 'DOCUMENT', actionId: act.id, documentId: doc.id, partN, reason })
      continue
    }
    out.set(issue.id, { issueId: issue.id, place: 'ACTION', actionId: act.id, reason })
  }
  for (const i of issues) if (!out.has(i.id)) { falls.noAnswer++; out.set(i.id, { issueId: i.id, place: 'PROPOSAL', reason: 'No placement came back for this issue, so it stays on the proposal as a whole.' }) }
  return { placements: issues.map((i) => out.get(i.id)!), falls }
}

/** The before/after line the report asks for (§7: "Report counts before and after"). */
export function countsLine(c: { open: number; onDocument: number; onAction: number; onProposal: number }): string {
  return `${c.open} open issue${c.open === 1 ? '' : 's'}: ${c.onDocument} on a document, ${c.onAction} on an action, ${c.onProposal} on the proposal as a whole`
}

export function fallsWords(f: AttachFalls): string[] {
  return [
    f.unknownAction && `${f.unknownAction} named an action that is not live (kept on the proposal)`,
    f.documentNotOfAction && `${f.documentNotOfAction} named a document that is not that action’s (kept on the action)`,
    f.partOutOfRange && `${f.partOutOfRange} named a part the document does not have (kept on the document)`,
    f.noAnswer && `${f.noAnswer} came back with no placement (kept on the proposal)`,
    f.duplicate && `${f.duplicate} duplicate answers ignored`,
    f.unknownKey && `${f.unknownKey} answers for issues not asked about ignored`,
  ].filter((x): x is string => !!x)
}

/** MEASURED price per issue placed, one entry per real run on a scratch copy (§23.2). Empty = not measured. */
export const ATTACH_RUNS: Array<{ issues: number; pence: number }> = [
  // 24 Oct, scripts/measure-26v2c.ts on 452c5ade's first 50 open issues (2 batches of 25, 63 actions, 3 documents): 21.8s and 21.4s
  { issues: 50, pence: 4.74 },
  { issues: 50, pence: 4.71 },
]
export function attachPrice(issues: number): { pence: number | null; n: number } {
  if (!ATTACH_RUNS.length) return { pence: null, n: 0 }
  const per = ATTACH_RUNS.reduce((a, r) => a + r.pence, 0) / ATTACH_RUNS.reduce((a, r) => a + r.issues, 0)
  return { pence: Math.round(per * issues * 10) / 10, n: ATTACH_RUNS.length }
}
