// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26v — BRIEF_26V §8 for 26-V1 (items 1–5; 6–7 come with 26-V2). Counts what RAN (§23.2).
//
//   A · the cold read (§26): 452c5ade as it stands, read with the plain client, nothing written — 26-U's drafts are documents, the record
//       carries none, the frozen copy is kept, #203 holds the schedule.
//   B · on a scratch copy, through the real functions (§25.3): the move (1), the cascade (2), "needs a document" (3), D-numbers in the pack
//       and in Lex's honesty check (4).
//   C · the browser (5): the REAL DocumentsTree in Chromium, answered by the REAL route handlers on the scratch copy.
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26v.ts
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { EMPTY_INSTRUCTION, CLAUSE_CAVEAT } from '../lib/lex/action-draft-pure'
import * as DR from '../lib/lex/action-draft'
import * as D from '../lib/lex/action-documents'
import { checkReply, citesDNumberAsAuthority } from '../lib/lex/agent/honesty'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { onwardRows, OFFICIAL_STOP_WHY, type Walker } from '../lib/lex/collision-walk'
import { CONSEQUENCE_WORDS } from '../lib/lex/onward-pure'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const CRAG = 'ukpga/2010/25'

// ── A · the cold read ──────────────────────────────────────────────────────────────────────────────────────────
async function partA() {
  section('A · cold read — 452c5ade as it stands (plain client, nothing written)')
  const idea = (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE '452c5ade%'`)[0]
  if (!idea) { skip('the cold read', '452c5ade not found'); return }
  for (const n of [38, 202]) {
    const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: n }, select: { id: true, record: true } })
    const docs = a ? await prisma.actionDocument.findMany({ where: { actionId: a.id }, include: { versions: true } }) : []
    const clause = docs.find((d) => d.kind === 'DRAFT_CLAUSE')
    const rec = (a?.record ?? {}) as { draft?: unknown; draftBefore26V?: { proposal?: { clause?: string } } }
    ok(`#${n}: 26-U's draft is document ${n}.1 (D.${n}.1), a draft clause`, !!clause && clause.number === 1, JSON.stringify(docs.map((d) => [d.kind, d.number])))
    // Since 23 Oct 12:27 UTC Charlie has USED #38's proposal (now version 1 by Lex), and #202 has a second proposal (v1 set aside, kept).
    // The cold read asserts what must stay true whatever the owner does next: at most one proposal waits, nothing is deleted, and the
    // proposal moved in 26-V1 is still there, answered or not, with the frozen copy's clause.
    const proposals = clause?.versions.filter((v) => v.role === 'PROPOSAL') ?? []
    ok(`#${n}: …at most one of Lex's proposals waits, and the one moved in 26-V1 is kept (proposal 1, whatever its answer)`, !!clause && proposals.filter((v) => !v.answer).length <= 1 && proposals.some((v) => v.v === 1))
    ok(`#${n}: the record carries no draft; the copy from before the move is kept, frozen, with the same clause as proposal 1`, !rec.draft && !!rec.draftBefore26V?.proposal?.clause && proposals.find((v) => v.v === 1)?.body === rec.draftBefore26V.proposal.clause)
    control(`#${n}: a second live copy of the draft in the record (must be FALSE)`, !!rec.draft)
  }
  const holder = await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: 203 }, select: { id: true, record: true } })
  const needs = holder ? D.needsOverrideOf(holder.record) : null
  ok('#203 is set to hold the consequential schedule, with its reason recorded (233)', !!needs && needs.mode === 'set' && !!needs.kinds?.includes('CONSEQUENTIAL_SCHEDULE') && /233/.test(needs.reason))
  const sched = holder ? await prisma.actionDocument.findMany({ where: { actionId: holder.id, kind: 'CONSEQUENTIAL_SCHEDULE' } }) : []
  ok('…and holds exactly one schedule document', sched.length === 1)
}

// ── B · scratch: the real functions ────────────────────────────────────────────────────────────────────────────
/**
 * 267 — a fixture walker standing in for onwardFrom(): made-under ends after step 3; the official record has 2 rows at step 1, each with
 * 2 at step 2 (and would have more at step 3); cites has 3 at step 1, each with 2 at step 2 (and more at step 3). Every call is recorded.
 */
function fixtureWalker(calls: Array<{ node: string; kinds: string[]; depth: number }>): Walker {
  const step = (node: string, kind: string, k: number, act = `uksi/2020/${k}`) => ({
    provision: `${act}/article/${k}`, act, actTitle: `Fixture ${kind} ${k}`, kind, strength: 'x', subType: '', changeKind: kind === 'cites' ? null : 'textual',
    changeReason: null, thisEndProvision: null, scope: 'provision' as const, citingText: kind === 'cites' ? `the fixture words before the reference ${k}` : kind === 'made-under' ? `the requirements of the fixture section have been complied with ${k}` : null, citingTextState: null,
    citingTextOthers: 0, citedProvision: null, origin: null, source: `fixture from ${node}`,
  })
  return async (node, o) => {
    calls.push({ node, kinds: [...o.kinds], depth: o.depth })
    const many = (kind: string, n: number) => Array.from({ length: n }, (_, k) => step(node, kind, o.depth * 1000 + calls.length * 10 + k))
    const rows = o.kinds.includes('made-under') ? (o.depth <= 3 ? many('made-under', 1) : [])
      : o.kinds.includes('cites') ? many('cites', o.depth === 1 ? 3 : 2)
      : many('amends', 2)
    const perKind = [{ kind: o.kinds[0], strength: 'x', counted: rows.length, returned: rows.length, instruments: rows.length, scope: { provision: rows.length, actWide: 0 }, split: null, citingText: null }]
    return { rows, perKind, unaddressable: null, freshness: { loadDate: '2026-07-05', ageDays: 1, basis: '', depth: o.depth, caveat: 'Fixture caveat.' } } as never
  }
}

async function partB(): Promise<{ copyId: string; userId: string; cleanup: () => Promise<void> } | null> {
  section('B · on a scratch copy of 452c5ade — the real functions')
  const copy = await scratchCopy('452c5ade', '26v')
  const owner = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 59, status: 'LIVE' }, select: { id: true } })
  const other = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 38, status: 'LIVE' }, select: { id: true } })
  await prisma.lexCoherentAction.updateMany({ where: { id: { in: [owner.id, other.id] } }, data: { avenue: 'LEGISLATIVE' } })

  section('B1 · the move: the instruction + clause is document 59.1; what it touches is document 59.2')
  const ins = { ...EMPTY_INSTRUCTION, instrument: 'AMENDING_ACT' as const, dutyOnWhom: 'a fixture duty', clause: '(1) A fixture subsection.\n(2) A second fixture subsection.', provisions: [{ docUri: CRAG, provisionPath: 'section/5', relation: 'amends' as const, note: 'fixture' }] }
  const s1 = await DR.saveVersion(copy.id, owner.id, ins, { userId: copy.userId, author: 'OWNER' })
  const docs1 = await prisma.actionDocument.findMany({ where: { actionId: owner.id }, include: { versions: true } })
  const clause = docs1.find((d) => d.kind === 'DRAFT_CLAUSE')
  ok('saving the instruction writes document 1 of the action, a draft clause, version 1 by the owner, the caveat first', s1.ok && !!clause && clause.number === 1 && clause.versions.length === 1 && clause.versions[0].author === 'OWNER' && clause.versions[0].body.startsWith(CLAUSE_CAVEAT))
  const rec1 = (await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record as { draft?: unknown } | null
  ok('…and nothing is written into the action’s record', !rec1?.draft)
  ok('…its parts are its numbered subsections: 59.1.1 and 59.1.2', D.partsOf('DRAFT_CLAUSE', clause!.versions[0].body).map((p) => p.title).join('|') === 'subsection (1)|subsection (2)')
  const g1 = await D.generateCollisionReport(copy.id, owner.id)
  const rep = await prisma.actionDocument.findFirstOrThrow({ where: { actionId: owner.id, kind: 'COLLISION_REPORT' }, include: { versions: true } })
  const rows1 = (rep.versions[0].payload as unknown as { rows: D.EffectRow[] }).rows
  const clause1 = rows1.filter((r) => (r.part ?? 'clause') === 'clause')
  ok('the collision report is generated as document 2 (D.59.2), from the clause’s own line plus the real onward walk', g1.ok && g1.data.d === 'D.59.2' && clause1.length === 1 && !g1.data.unchanged, JSON.stringify(g1))
  ok('…its clause row is CRaG s.5, with GRAPH 6’s split as the reader returned it, and the version is GENERATED (no model)', clause1[0]?.docUri === CRAG && clause1[0].depth === 1 && clause1[0].effects.length > 0 && rep.versions[0].author === 'GENERATED')
  const body1 = rep.versions[0].body
  ok('267: under s.5, the two parts by name, never merged: "What depends on this" and "Provisions that refer to this — for review"', body1.includes(D.TWO_PARTS_LINE) && body1.includes(`### What depends on this — ${CRAG} · section/5`) && body1.includes(`### Provisions that refer to this — for review — ${CRAG} · section/5`), body1.slice(0, 600))
  // OUR words only — the headings, the two-parts line and the walk notes. A statute's own title ("… (Consequential Amendments) Regulations")
  // and its quoted words are data and may say anything.
  const ourWords = [D.PART_HEADING.refers, D.TWO_PARTS_LINE, ...((rep.versions[0].payload as unknown as { notes: D.WalkNote[] }).notes ?? []).filter((n) => n.part === 'refers').map((n) => n.line)].join('\n')
  ok('…the review part never calls a reference a consequence, a knock-on or a schedule, in our own words (GRAPH 8 rule 1)', ourWords.length > 100 && !CONSEQUENCE_WORDS.test(ourWords), (CONSEQUENCE_WORDS.exec(ourWords) ?? [''])[0])
  control('the same guard, fed a note that calls a reference a knock-on (must be FALSE)', !CONSEQUENCE_WORDS.test(`${ourWords}\nthese are the knock-on changes`))
  ok('…every reference row is step 1 or step 2, and only step 2 is labelled weak; none at step 3', rows1.filter((r) => r.part === 'refers').every((r) => (r.step ?? 0) <= 2 && !!r.weak === (r.step === 2)))
  ok('…and it counts what it walked and what it did not, in words (made-under, the official record, the references)', /Made under it: /.test(body1) && /The official record: /.test(body1) && /(references? at step 1|No marked-up citation of this provision is held)/.test(body1) && body1.includes(OFFICIAL_STOP_WHY))
  const g1b = await D.generateCollisionReport(copy.id, owner.id)
  ok('generating again with nothing changed writes nothing ("unchanged")', g1b.ok && g1b.data.unchanged && (await prisma.actionDocumentVersion.count({ where: { documentId: rep.id } })) === 1)

  const accepted = await D.acceptDocument(copy.id, clause!.id)
  ok('Accept marks D.59.1 accepted at version 1', accepted.ok && (await prisma.actionDocument.findUniqueOrThrow({ where: { id: clause!.id } })).status === 'ACCEPTED')
  const s2 = await DR.saveVersion(copy.id, owner.id, { ...ins, dutyOnWhom: 'a fixture duty, revised' }, { userId: copy.userId, author: 'OWNER' })
  const c2 = await prisma.actionDocument.findUniqueOrThrow({ where: { id: clause!.id }, include: { versions: true } })
  ok('263: a new version after an Accept is DRAFTED with acceptedV kept ("accepted at version 1, then changed"), and BOTH versions are kept', s2.ok && c2.status === 'DRAFTED' && c2.acceptedV === 1 && c2.versions.filter((v) => v.role === 'VERSION').length === 2)
  const tree1 = await D.documentTree(copy.id, { recordStale: true })
  const repRow = tree1.headings.flatMap((h) => h.actions).find((a) => a.id === owner.id)?.documents.find((d) => d.kind === 'COLLISION_REPORT')
  ok('the collision report is now out of date, and says why in words (251)', !!repRow?.stale && /the clause now has version 2/.test(repRow.stale), repRow?.stale ?? 'not stale')
  ok('…the mark is recorded on the document', !!(await prisma.actionDocument.findUniqueOrThrow({ where: { id: rep.id } })).staleAt)
  const draftNow = await DR.draftOfAction(owner.id)
  ok('26-U’s readers see the same draft through the store (2 versions, the latest the revised one)', draftNow?.versions.length === 2 && draftNow.versions[1].dutyOnWhom === 'a fixture duty, revised')

  section('B2 · 267: the walk stops by strength — made-under to its end, the official record to step 2, references to step 2 (weak), never 3')
  const calls: Array<{ node: string; kinds: string[]; depth: number }> = []
  const fxClause: D.EffectRow[] = [
    { i: 0, depth: 1, parent: null, relation: 'amends', docUri: 'ukpga/2000/1', provisionPath: 'section/1', actTitle: 'Fixture Act', state: 'held', note: '', effects: [] },
    { i: 1, depth: 1, parent: null, relation: 'relies_on', docUri: 'ukpga/2000/2', provisionPath: null, actTitle: 'Relied-on Act', state: 'held', note: '', effects: [] },
  ]
  const w = await onwardRows(fxClause, fixtureWalker(calls))
  const byPart = (p: string, step?: number) => w.rows.filter((r) => r.part === p && (step == null || r.step === step))
  ok('made-under is walked until it ends: steps 1, 2 and 3, then a step-4 read that returns nothing', [1, 2, 3].map((k) => byPart('depends', k).filter((r) => r.relation === 'made-under').length).join(',') === '1,1,1' && calls.some((c) => c.kinds.includes('made-under') && c.depth === 4))
  ok('the official record: 2 rows at step 1, 2 under each at step 2, and NO read at step 3', byPart('depends', 1).filter((r) => r.relation === 'amends').length === 2 && byPart('depends', 2).filter((r) => r.relation === 'amends').length === 4 && !calls.some((c) => c.kinds.includes('amends') && c.depth >= 3))
  ok('references: 3 at step 1 with their words, 6 weak at step 2, and NO read at step 3', byPart('refers', 1).length === 3 && byPart('refers', 1).every((r) => /fixture words/.test(r.words ?? '') && !r.weak) && byPart('refers', 2).length === 6 && byPart('refers', 2).every((r) => r.weak) && !calls.some((c) => c.kinds.includes('cites') && c.depth >= 3))
  ok('made-under rows show their stored words (a procedural mention filed as a power is visible as one: GRAPH 8 §5); official rows have none', byPart('depends').filter((r) => r.relation === 'made-under').every((r) => /complied with/.test(r.words ?? '')) && byPart('depends').filter((r) => r.relation === 'amends').every((r) => !r.words))
  ok('no part of the report says an instrument "would fall" or "falls" (the enabling-vs-procedural rule is undecided: GRAPH 8 §8 decision 2)', !/would fall|falls? with/i.test(D.collisionBody([...fxClause, ...w.rows], { loadDate: null, caveat: w.caveat, notes: w.notes })))
  ok('a "relies on" line is not walked: the clause does not change it', !calls.some((c) => c.node.startsWith('ukpga/2000/2')) && w.rows.every((r) => r.parent !== 1))
  ok('every step-2 row hangs from a step-1 row of the same part', [...byPart('depends', 2).filter((r) => r.relation === 'amends'), ...byPart('refers', 2)].every((r) => { const p = w.rows.find((x) => x.i === r.parent); return !!p && p.part === r.part && p.step === 1 }))
  const fxBody = D.collisionBody([...fxClause, ...w.rows], { loadDate: '2026-07-05', caveat: w.caveat, notes: w.notes })
  ok('the text: one section per Act, the two parts by name under the provision, step-2 rows indented beneath their parent, the notes in words',
    fxBody.includes('## Fixture Act (ukpga/2000/1)') && fxBody.includes('### What depends on this — ukpga/2000/1 · section/1') && fxBody.includes('### Provisions that refer to this — for review — ukpga/2000/1 · section/1') && fxBody.includes('\n  - weak (step 2): cites') && fxBody.includes('the walk ended after step 3'), fxBody.slice(0, 900))
  control('a step-3 reference or official row in the walk (must be FALSE)', w.rows.some((r) => (r.part === 'refers' || r.relation === 'amends') && (r.step ?? 0) >= 3))
  control('a reference printed under "What depends on this" (must be FALSE)', fxBody.slice(fxBody.indexOf('### What depends on this'), fxBody.indexOf('### Provisions that refer')).includes('cites —'))
  const g2 = await D.generateCollisionReport(copy.id, other.id, { rows: fxClause, walk: fixtureWalker([]) }).catch((e) => ({ ok: false as const, error: String(e) }))
  if (!g2.ok) await DR.saveVersion(copy.id, other.id, { ...ins, provisions: [] }, { userId: copy.userId, author: 'OWNER' })
  const g2b = g2.ok ? g2 : await D.generateCollisionReport(copy.id, other.id, { rows: fxClause, walk: fixtureWalker([]) })
  const reports38 = await prisma.actionDocument.findMany({ where: { actionId: other.id, kind: 'COLLISION_REPORT' }, include: { versions: true } })
  ok('ONE collision report for the action, every row in it — no document nested inside it (245)', g2b.ok && reports38.length === 1 && ((reports38[0].versions.at(-1)!.payload as { rows: unknown[] }).rows.length === fxClause.length + w.rows.length))

  section('B2b · 267: the schedule (on #203) lists drafted amendments in ACCEPTED instructions only — never a collision row')
  const sched = await D.generateSchedule(copy.id)
  const schedAgain = await D.generateSchedule(copy.id)
  ok('generating the schedule again with nothing changed writes nothing ("unchanged")', schedAgain.ok && schedAgain.data.unchanged)
  const sDoc = await prisma.actionDocument.findMany({ where: { ideaId: copy.id, kind: 'CONSEQUENTIAL_SCHEDULE' }, include: { versions: { orderBy: { v: 'desc' }, take: 1 } } })
  const sRows = (sDoc[0]?.versions[0]?.payload as { rows?: D.ScheduleRow[] } | null)?.rows ?? []
  ok('#59’s accepted version 1 amends CRaG s.5: that one line, and nothing from any collision report (#59’s version 2 is not accepted)', sched.ok && sDoc.length === 1 && sRows.length === 1 && sRows[0].action === 59 && sRows[0].v === 1 && sRows[0].relation === 'amends' && sRows[0].docUri === CRAG, JSON.stringify(sRows))
  ok('…counted and said to be from accepted drafting instructions only', (sDoc[0]?.versions[0]?.body ?? '').includes('accepted drafting instructions only') && (sDoc[0]?.versions[0]?.body ?? '').includes('1 amended, 0 repealed, 0 modified, across 1 Act.'))
  control('a schedule row that came from a collision report (must be FALSE)', sRows.some((r) => r.docUri.startsWith('ukpga/2000/') || r.docUri.startsWith('uksi/')))

  section('B3 · "needs a document": derived from avenue and instrument; overridden only with a reason')
  const needs = (avenue: string | null, instrument: string | null) => D.needsDocuments({ avenue, instrument: instrument as never }).kinds.join('+')
  ok('legislative → draft clause + collision report', needs('LEGISLATIVE', 'AMENDING_ACT') === 'DRAFT_CLAUSE+COLLISION_REPORT')
  ok('a code (statutory or management) → code text', needs('LEGISLATIVE', 'STATUTORY_CODE') === 'CODE_TEXT' && needs('ORGANISATIONAL', 'MANAGEMENT_CODE') === 'CODE_TEXT')
  ok('financial → costing; organisational → operating text', needs('FINANCIAL', null) === 'COSTING' && needs('ORGANISATIONAL', null) === 'OPERATING_TEXT')
  ok('no avenue → nothing derived, and the line says so (not "needs nothing")', needs(null, null) === '' && /no avenue chosen/.test(D.needsDocuments({ avenue: null, instrument: null }).why))
  const spec = (avenue: string | null, headingName: string | null) => D.needsDocuments({ avenue, instrument: null, headingName })
  ok('26-V2 §4: under "The accountability platform" a specification is derived (alone with no avenue, beside a legislative action’s own), and says why', spec(null, 'The accountability platform').kinds.join('+') === 'SPECIFICATION' && spec('LEGISLATIVE', ' the accountability platform ').kinds.join('+') === 'DRAFT_CLAUSE+COLLISION_REPORT+SPECIFICATION' && spec(null, 'The accountability platform').why.includes('The accountability platform'))
  ok('268: "The platform" (Charlie\'s heading) matches too — the word, any case — and the why names the heading as written', spec(null, 'The platform').kinds.join('+') === 'SPECIFICATION' && spec(null, 'THE PLATFORM').kinds.includes('SPECIFICATION') && spec(null, 'The platform').why === 'under “The platform”')
  ok('…anywhere else it is not derived (added by hand)', !spec(null, 'Primary legislation').kinds.includes('SPECIFICATION') && !spec('ORGANISATIONAL', 'Accountability platforms').kinds.includes('SPECIFICATION'))
  const noReason = await D.setNeeds(copy.id, owner.id, { mode: 'nothing', reason: ' ' }, copy.userId)
  ok('"needs nothing" without a reason is refused, in words', !noReason.ok && /Say why/.test((noReason as { error: string }).error))
  const withReason = await D.setNeeds(copy.id, owner.id, { mode: 'nothing', reason: 'a fixture reason' }, copy.userId)
  const o = D.needsOverrideOf((await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record)
  ok('…with one, it is recorded with the reason, who and when', withReason.ok && o?.mode === 'nothing' && o.reason === 'a fixture reason' && o.by === copy.userId && !!o.at)
  await D.setNeeds(copy.id, owner.id, { mode: 'derived' }, copy.userId)
  ok('…and "work it out" again removes the override', D.needsOverrideOf((await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })).record) === null)

  section('B4 · D-numbers: never a source; printed with their status; refused as authority')
  const { buildProposalSnapshot } = await import('../lib/documents/proposal-snapshot')
  const { buildFor } = await import('../lib/documents/proposal-export')
  const snap = await buildProposalSnapshot(copy.id)
  const model = buildFor('ACTIONS_PACK', snap, null, { selection: { actionIds: [owner.id, other.id] } }).model
  const blocks = model.blocks as Array<{ kind: string; title?: string; refs?: Array<{ title: string; citation: string }> }>
  const iS = blocks.findIndex((b) => b.kind === 'section' && b.title === 'SOURCES'), iD = blocks.findIndex((b) => b.kind === 'section' && b.title === 'DOCUMENTS')
  ok('the pack prints Sources and Documents as two separate lists, Documents after Sources', iS >= 0 && iD > iS)
  const sourcesText = JSON.stringify(blocks.slice(iS, iD))
  ok('…no D-number appears in the Sources list', !/\bD\.\d+\.\d+/.test(sourcesText))
  const docsText = JSON.stringify(blocks.slice(iD))
  ok('…the Documents list names D.59.1 with its status in words', /D\.59\.1, drafted, not accepted/.test(docsText) && /D\.59\.2, drafted, not accepted, out of date/.test(docsText), docsText.slice(0, 300))
  const all = JSON.stringify(blocks)
  ok('each action’s documents print after its record (section 14 "Documents")', /14 Documents|\.14[^"]{0,4}"?[^"]{0,20}Documents/.test(all) || all.includes('Documents:'))
  const known = new Set<string>()
  const bad1 = checkReply({ reply: 'Under D.59.1, every body must publish its goals.', outcomes: [], knownLabels: known })
  const bad2 = checkReply({ reply: 'Every body must publish its goals [Ref: D.59.1].', outcomes: [], knownLabels: known })
  const bad3 = checkReply({ reply: 'D.59.1 requires every body to publish its goals.', outcomes: [], knownLabels: known })
  ok('Lex’s honesty check refuses a D-number cited as authority ("under D.59.1", "[Ref: D.59.1]", "D.59.1 requires")', [bad1, bad2, bad3].every((v) => v.some((x) => x.kind === 'dnumber-as-authority')))
  const fine = checkReply({ reply: 'D.59.1, drafted, not accepted, is under the action’s Draft text; the duty itself comes from CRaG 2010 s.5 [Ref: 4].', outcomes: [], knownLabels: known })
  control('naming a D-number with its status (not as authority) refused (must be FALSE)', fine.some((x) => x.kind === 'dnumber-as-authority'))
  ok('the pure test agrees', citesDNumberAsAuthority('According to D.38.2 the Act is amended.') && !citesDNumberAsAuthority('D.38.2 is the collision report.'))

  const cleanup = async () => {
    await prisma.ideaLawLink.updateMany({ where: { ideaId: copy.id }, data: { supersededById: null } })
    await prisma.ideaLawLink.deleteMany({ where: { ideaId: copy.id } })
    await deleteScratch(copy.id)
  }
  return { copyId: copy.id, userId: copy.userId, cleanup }
}

// ── C · the browser ───────────────────────────────────────────────────────────────────────────────────────────
async function partC(copyId: string, userId: string) {
  section('C · the browser — the real DocumentsTree, answered by the real route on the scratch copy')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/docs-tree-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const route = await import('../app/api/ideas/[id]/action-documents/route')
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    await page.route('**/api/ideas/*/action-documents', async (r) => {
      const req = r.request()
      const params = { params: Promise.resolve({ id: copyId }) }
      const res = req.method() === 'GET'
        ? await route.GET(new Request('http://internal.invalid/'), params)
        : await route.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: req.postData() ?? '' }), params)
      await r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() })
    })
    await page.goto('http://harness.test/')
    await page.evaluate((id) => { (window as unknown as { __tree: unknown }).__tree = { ideaId: id, readOnly: false } }, copyId)
    await page.addScriptTag({ content: bundle })
    await page.waitForSelector('[data-tree-counts]', { timeout: 30_000 })
    const tree = await D.documentTree(copyId)
    const expected = D.treeCounts(tree.headings.flatMap((h) => h.actions).map((a) => ({ needs: a.needs, documents: a.documents.map((d) => ({ kind: d.kind, status: d.status })) }))).line
    const shownCounts = await page.locator('[data-tree-counts]').innerText()
    ok('the counts at the top are the store’s own ("N actions · N need documents · N drafted · N accepted · N missing")', shownCounts === expected, `${shownCounts} vs ${expected}`)
    // 263: D.59.1 was accepted at version 1 in part B and then given a version 2 — so it reads "accepted at version 1, then changed"
    ok('D.59.1 and D.59.2 are in the tree with their status in words (263: "accepted at version 1, then changed — accept again")', (await page.locator('[data-tree-document="D.59.1"] [data-doc-status]').innerText()) === 'accepted at version 1, then changed — accept again' && (await page.locator('[data-tree-document="D.59.2"]').count()) === 1)
    await page.locator('[data-tree-filter="missing"]').click()
    const missingRows = await page.locator('[data-tree-action]').count()
    const expectMissing = tree.headings.flatMap((h) => h.actions).filter((a) => a.missing.length).length
    ok('the "Missing" filter shows exactly the actions with a needed document missing', missingRows === expectMissing, `${missingRows} vs ${expectMissing}`)
    await page.locator('[data-tree-filter="all"]').click()
    await page.locator('input[aria-label="Find in the documents"]').fill('D.59.2')
    ok('the find box finds by D-number: one action', (await page.locator('[data-tree-action]').count()) === 1)
    await page.locator('input[aria-label="Find in the documents"]').fill('')
    await page.locator('[data-tree-document="D.59.1"] button').first().click()
    await page.waitForSelector('[data-document-view="D.59.1"]')
    const view = await page.locator('[data-document-view="D.59.1"]').innerText()
    await page.locator('[data-document-view="D.59.1"] [data-document-tab="versions"]').click()
    const versionsShown = await page.locator('[data-versions-tab] [data-version-row]').count()
    await page.locator('[data-document-view="D.59.1"] [data-document-tab="text"]').click()
    ok('clicking D.59.1 opens the document view in place (26-V1b): its version, its parts 59.1.1 and 59.1.2, both versions listed', /version 2, yours/.test(view) && (await page.locator('[data-document-part="59.1.1"]').count()) === 1 && (await page.locator('[data-document-part="59.1.2"]').count()) === 1 && versionsShown === 2, `${view.slice(0, 300)} | versions ${versionsShown}`)
    await page.locator('[data-document-view="D.59.1"] button:has-text("Ask Lex to redraft")').click()
    ok('"Ask Lex to redraft" asks first, with the measured price, before any call', /costs about [\d.]+p \(measured, n=\d+\)/.test(await page.locator('[data-redraft-ask]').innerText()))
    await page.locator('[data-redraft-ask] button:has-text("Not now")').click()
    await page.locator('[data-document-view="D.59.1"] button:has-text("Accept version 2")').click()
    await page.waitForFunction(() => document.querySelector('[data-tree-document="D.59.1"] [data-doc-status]')?.textContent === 'accepted (version 2)', null, { timeout: 15_000 }).catch(() => {})
    ok('Accept in the browser marks it "accepted (version 2)" (word, not colour)', (await page.locator('[data-tree-document="D.59.1"] [data-doc-status]').innerText()) === 'accepted (version 2)')
    const vs = await prisma.actionDocumentVersion.count({ where: { document: { ideaId: copyId, kind: 'DRAFT_CLAUSE', number: 1, actionId: (await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copyId, number: 59 } })).id } } })
    ok('…and every version is kept', vs === 2)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  await partA()
  const b = await partB().catch((e) => { fail++; ran++; console.log(`  ✗ part B threw: ${(e as Error).stack?.slice(0, 800)}`); return null })
  if (b) { try { await partC(b.copyId, b.userId) } finally { await b.cleanup() } }
  console.log(`\ncheck:lex-26v — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead || !ran ? 1 : 0)
}
main()
