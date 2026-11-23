// check:lex-26ac — BRIEF_26AC part (a): scrutiny editions, the reader's page, Preview as a reviewer. Counts what RAN: ran, passed,
// controls fired, dead, not run.
//
//   A · pure: the page from a snapshot (drafts at their accepted version else the latest, labelled; "needs no draft"; costs with their basis
//       or "no basis stated"; notes where they were placed; sections left out), the checklist, the link targets, the price, who may read.
//   B · the REAL routes and code on a scratch copy of 452c5ade (452c5ade itself is never written): create (owner only, one draft at a time),
//       notes, sections, publish (checklist first; "anyway" recorded), and the property the brief names first — A PUBLISHED EDITION DOES
//       NOT CHANGE WHEN THE WORKSPACE DOES — with the database's own triggers refusing a change made around the code. Planted control: the
//       live idea DOES show the change, and a new edition picks it up, so "unchanged" is not a page that never reads anything.
//   C · Chromium at 360 and 390 px (the app's own Tailwind): one section at a time with the bottom bar, nothing wider than the viewport,
//       "Read the draft wording" and back to the same place (also by the browser's Back), the set-aside list collapsed; at 1024 px all of it.
import { join } from 'node:path'
import http from 'node:http'
import { prisma } from '../lib/prisma'
import type { ProposalSnapshot } from '../lib/documents/proposal-snapshot'
import type { PackAction } from '../lib/documents/actions-pack-types'
import { stableStringify } from '../lib/documents/proposal-snapshot'
import {
  editionView, prePublishChecklist, checklistCount, costLinesOf, uncitedFigures, draftStateOf, parseInclude, SECTION_KEY, PUBLISHED_REFUSED,
  type EditionView, type NoteRow, type LinkRow,
} from '../lib/lex/scrutiny-edition-pure'
import { linkTargets, linkPrice, LINK_RUNS } from '../lib/lex/scrutiny-linking-pure'
import { mayRead } from '../lib/lex/scrutiny-access'
import { SCRUTINY_UI } from '../lib/lex/screen-labels'

const ROOT = join(__dirname, '..')
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
/** A planted case the check must SEE: `seen` true = the control fired. */
function control(name: string, seen: boolean) { controls++; if (!seen) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── the pure fixture ─────────────────────────────────────────────────────────────────────────────────────────
const doc = (o: Partial<import('../lib/lex/action-documents').PackDocument>) => ({ d: 'D.1.1', number: 1, kind: 'DRAFT_CLAUSE' as const, title: 'Draft clause', status: 'DRAFTED' as const, stale: null, v: 2, author: 'LEX', at: '2026-11-01T00:00:00Z', body: 'Clause 1. Every landlord must register.', sources: [], ...o })
const pa = (o: Partial<PackAction> & { id: string; number: number }): PackAction => ({
  title: null, statement: `Statement of ${o.number}`, headingId: 'h1', avenue: null, causeNumbers: [], conditionNumbers: [], support: false, policyTest: null, slots: {}, sequence: null,
  beforeNumbers: [], parked: false, parkedReason: null, detail: null, parts: [], refs: [], notes: [], draft: null, touches: null, documents: [], ...o,
})
const FIX: ProposalSnapshot = {
  snapshotVersion: 2, ideaId: 'fx', generatedAt: '2026-11-22T00:00:00Z', title: 'Landlord registration (fixture)', summaryDescription: null, owner: { id: 'o', name: 'Owner' }, userKnowledge: null,
  fields: [{ key: 'challenge', status: 'ACCEPTED', value: 'Rogue landlords are hard to find.' } as never], causes: [], options: [{ status: 'CHOSEN', approach: 'Register every landlord.' } as never],
  actions: [
    { id: 'a1', implementationCost: { low: 1000, high: 2000, unit: 'GBP', basis: 'two FTE for a year', benchmarkId: null, userOverride: false, priceYear: 2026 }, enforcementCost: null, regulatoryFriction: null, costLines: [] } as never,
    { id: 'a2', implementationCost: { low: 500, high: 500, unit: 'GBP', basis: null, benchmarkId: null, userOverride: false, priceYear: null }, enforcementCost: null, regulatoryFriction: null, costLines: [] } as never,
    { id: 'a3', implementationCost: null, enforcementCost: null, regulatoryFriction: null, noCostReason: 'guidance only', costLines: [] } as never,
  ],
  costs: { lines: [], summary: null, problemCost: null }, evidence: [], issues: [], knownUnknowns: [], forks: { open: [], resolved: [] }, sources: [], excludedSources: [],
  outstanding: { openIssues: [], unresolvedForks: [], declaredGaps: [], unsupportedFields: [], counts: { openIssues: 0, totalIssues: 0, unresolvedForks: 0, declaredGaps: 0 } },
  passes: [], scaffolded: [], coverage: { fieldsTotal: 1, fieldsSupported: 1, actionsTotal: 3, actionsSupported: 3 },
  actionsPack: {
    headings: [{ id: 'h1', name: 'Registration', purpose: 'Know who the landlords are.', hidden: false }, { id: 'h2', name: 'Still being written', purpose: null, hidden: true }],
    conditions: [], conditionsSource: null, causes: [],
    actions: [
      pa({ id: 'a1', number: 1, refs: [4], documents: [doc({ accepted: true, newerV: 3 }), doc({ d: 'D.1.2', number: 2, kind: 'EXPLANATORY_NOTE', title: 'Explanatory note', body: 'This clause makes landlords register.', accepted: false })] }),
      pa({ id: 'a2', number: 2, documents: [doc({ d: 'D.2.1', accepted: false, v: 1, body: 'Clause 2. A fine.' })] }),
      pa({ id: 'a3', number: 3, noDraftReason: 'it is guidance, not law' }),
      pa({ id: 'a4', number: 4, headingId: 'h2' }),
    ],
    ruledOut: [{ number: 9, title: 'Licensing', statement: 'License every landlord', headingId: 'h1', reason: 'too costly', lastChanged: '2026-10-01T00:00:00Z' }],
    digests: [], registry: [{ number: 4, title: 'English Housing Survey', citation: 'DLUHC 2024', url: 'https://example.org/ehs', kind: 'report' }, { number: 7, title: 'Rugg Review', citation: null, url: null, kind: 'report' }],
    notes: [], setAside: [{ kind: 'NOTE', text: 'A note set aside', reason: 'duplicate', at: '2026-10-02T00:00:00Z', ref: null }], disagreements: [], issueActions: [],
  },
}
const NOTES: NoteRow[] = [
  { id: 'n1', targetKind: 'TOP', targetId: null, body: 'Please challenge the costs.', orderIndex: 0, archivedAt: null },
  { id: 'n2', targetKind: 'HEADING', targetId: 'h1', body: 'This heading is settled.', orderIndex: 1, archivedAt: null },
  { id: 'n3', targetKind: 'ACTION', targetId: 'a2', body: 'Is the fine high enough?', orderIndex: 2, archivedAt: null },
  { id: 'n4', targetKind: 'TOP', targetId: null, body: 'A note set aside by the owner', orderIndex: 3, archivedAt: '2026-11-20T00:00:00Z' },
]
const LINKS: LinkRow[] = [
  { id: 'l1', targetKind: 'ACTION', targetId: 'a2', claim: null, sourceId: 's7', sourceNumber: 7, sourceTitle: 'Rugg Review', status: 'ACCEPTED', proposedBy: 'LEX', reason: 'r' },
  { id: 'l2', targetKind: 'ACTION', targetId: 'a3', claim: null, sourceId: 's4', sourceNumber: 4, sourceTitle: 'English Housing Survey', status: 'PROPOSED', proposedBy: 'LEX', reason: 'r' },
]
const ED = { number: 1, status: 'DRAFT' as const, publishedAt: null, blind: false, include: { hidden: [] as string[] } }

function partA(): EditionView {
  section('A · the page, the checklist and the rules, pure')
  const v = editionView(FIX, ED, NOTES, LINKS)
  const a = (id: string) => v.headings.flatMap((h) => h.actions).find((x) => x.id === id)!
  ok('an accepted draft is printed at its ACCEPTED version, saying so, with the later unaccepted version named', a('a1').drafts.length === 1 && a('a1').drafts[0].words === 'accepted version 2' && /Version 3 is later and not yet accepted/.test(a('a1').drafts[0].newerNote ?? ''), JSON.stringify(a('a1').drafts))
  ok('…a draft with nothing accepted is the latest, labelled "not yet accepted", and the action says so', a('a2').drafts[0].words === 'version 1, not yet accepted' && a('a2').draftState === 'Latest draft, not yet accepted', a('a2').draftState)
  ok('…"needs no draft" says so with its reason (313)', a('a3').draftState === 'Needs no draft: it is guidance, not law' && a('a3').drafts.length === 0)
  ok('…the explanatory note is the action\'s own note, never folded into the draft wording', a('a1').explanatory?.body === 'This clause makes landlords register.' && !a('a1').drafts.some((d) => d.kind === 'EXPLANATORY_NOTE'))
  ok('costs: a figure with its basis; a figure with none says "no basis stated"; "no cost, because…" is an answer', a('a1').costs[0] === 'Cost to implement: £1,000–£2,000 (two FTE for a year)' && a('a2').costs[0] === 'Cost to implement: £500 (no basis stated)' && a('a3').costs[0] === 'No cost, because guidance only', JSON.stringify([a('a1').costs, a('a2').costs, a('a3').costs]))
  ok('…an action with no figure prints none (never £0)', a('a4').costs.length === 0)
  ok('author\'s notes sit where they were placed, and a set-aside one is not on the page', v.topNotes.join('|') === 'Please challenge the costs.' && v.headings[0].notes[0] === 'This heading is settled.' && a('a2').notes[0] === 'Is the fine high enough?', JSON.stringify(v.topNotes))
  ok('the summary is the Introductory Summary (from the kernel) with each action in one line', !!v.summary && v.summary.blocks.some((b) => b.kind === 'paragraph' && b.runs.some((r) => r.text.includes('Rogue landlords'))) && v.summary.lines.length === 4)
  ok('sources: each cited one with the sections that cite it — an action\'s own [Ref], and an ACCEPTED link; a PROPOSED link is not a citation', v.sources?.map((s) => `${s.number}:${s.citedBy.join(',')}`).join(' ') === '4:#1 7:#2', JSON.stringify(v.sources))
  ok('options considered and set aside: the ruled-out action and the set-aside note, each with its reason', v.setAside?.ruledOut[0].reason === 'too costly' && v.setAside?.setAside[0].reason === 'duplicate')
  ok('a heading HIDDEN IN THE WORKSPACE (its show/hide toggle) is still in the edition, with its actions: only the owner’s Sections included leaves one out', v.headings.some((h) => h.id === 'h2' && h.actions.some((x) => x.id === 'a4')) && !v.headings.some((h) => h.id === null))
  const hid = editionView(FIX, { ...ED, include: parseInclude({ hidden: [SECTION_KEY.heading('h2'), SECTION_KEY.setAside] }) }, NOTES, LINKS)
  ok('a section the owner left out is not in the edition (the heading and its actions, and the set-aside list)', hid.headings.length === 1 && !hid.headings.flatMap((h) => h.actions).some((x) => x.id === 'a4') && hid.setAside === null && hid.summary!.lines.length === 3)
  const c = prePublishChecklist(v, FIX)
  ok('checklist: sections with no source — a4\'s heading (none of its actions cites one) and #3 (a PROPOSED link is not a link)', c.unlinked.map((i) => i.key).sort().join(' ') === ['action:a3', SECTION_KEY.heading('h2')].sort().join(' '), JSON.stringify(c.unlinked))
  ok('…drafts not accepted: #2\'s draft and #4 (no draft); NOT #3 (needs no draft) and NOT #1 (accepted)', c.unaccepted.map((i) => i.words.slice(0, 3)).join(' ') === '#2: #4 ', JSON.stringify(c.unaccepted))
  ok('…figures without a citation: #2\'s cost (no basis, no benchmark), and only that', c.uncited.length === 1 && c.uncited[0].words.startsWith('#2'), JSON.stringify(c.uncited))
  const cHid = prePublishChecklist(hid, FIX)
  ok('…a heading left out is not counted', !cHid.unlinked.some((i) => i.key === SECTION_KEY.heading('h2')) && !cHid.unaccepted.some((i) => i.words.startsWith('#4')))
  control('the checklist can be empty: with every action sourced, accepted and costed it lists nothing', checklistCount(prePublishChecklist(editionView({ ...FIX, actions: [FIX.actions[0]], actionsPack: { ...FIX.actionsPack!, headings: [FIX.actionsPack!.headings[0]], actions: [FIX.actionsPack!.actions[0]] } }, ED, [], []), { ...FIX, actions: [FIX.actions[0]] })) === 0)
  const t = linkTargets(v)
  ok('the linking exercise is offered the summary, each heading, each action, and each action\'s draft (not the "no heading" group)', t[0].key === 'S' && t.some((x) => x.key === 'H:h1') && t.some((x) => x.key === 'A:a4') && t.some((x) => x.key === 'D:a1') && !t.some((x) => x.key === 'D:a4'))
  ok(LINK_RUNS.length ? `its price is measured (${linkPrice(2000).basis})` : 'with no measured run, the exercise has NO price and is not offered (never run at a guess)', LINK_RUNS.length ? (linkPrice(2000).pence ?? 0) > 0 : linkPrice(2000).pence === null)
  ok('who may read: the owner any edition; the team a published one only; a stranger none', mayRead('owner', 'DRAFT') && mayRead('EDITOR', 'PUBLISHED') && mayRead('VIEWER', 'PUBLISHED') && !mayRead('EDITOR', 'DRAFT') && !mayRead('VIEWER', 'DRAFT') && !mayRead(null, 'PUBLISHED'))
  ok('costLinesOf / uncitedFigures read the figure, never the action\'s absence as £0', costLinesOf(undefined).length === 0 && uncitedFigures(undefined).length === 0 && draftStateOf([], null) === 'No draft yet')
  return v
}

// ── B · the real code on a scratch copy ──────────────────────────────────────────────────────────────────────
async function partB(): Promise<EditionView | null> {
  section('B · the real routes on a scratch copy of 452c5ade: create, prepare, publish — and a published edition never changes')
  const { scratchCopy, copyDocuments, deleteScratch } = await import('./lib/scratch-copy')
  let scratch: { id: string; userId: string } | null = null
  try { scratch = await scratchCopy('452c5ade', 'scrutiny-26ac') } catch (e) { skip('part B', `no scratch copy: ${(e as Error).message.slice(0, 120)}`); return null }
  const as = (u: unknown) => { (globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = u }
  const added: string[] = []
  let readerView: EditionView | null = null
  try {
    const srcId = (await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } }))!.id
    const nDocs = await copyDocuments(srcId, scratch.id)
    const others = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id <> ${scratch.userId} ORDER BY md5(id) LIMIT 2`
    if (others.length < 2) { skip('part B', 'fewer than two other users'); return null }
    const [editorId, strangerId] = others.map((o) => o.id)
    added.push((await prisma.ideaCollaborator.create({ data: { ideaId: scratch.id, userId: editorId, role: 'EDITOR', invitedByUserId: scratch.userId } })).id)
    const owner = await prisma.user.findUnique({ where: { id: scratch.userId } })
    const editor = await prisma.user.findUnique({ where: { id: editorId } })
    const stranger = await prisma.user.findUnique({ where: { id: strangerId } })
    const route = await import('../app/api/ideas/[id]/scrutiny/route')
    const S = await import('../lib/lex/scrutiny-edition')
    const { readerAccess, readerAccessFor } = await import('../lib/lex/scrutiny-access')
    const params = { params: Promise.resolve({ id: scratch.id }) }
    const post = async (body: unknown) => { const r = await route.POST(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), params); return { status: r.status, j: (await r.json().catch(() => ({}))) as { ok?: boolean; data?: Record<string, unknown>; error?: string } } }
    console.log(`  (scratch ${scratch.id.slice(0, 8)}; ${nDocs} documents copied)`)

    as(editor)
    const ec = await post({ op: 'create' })
    ok('an EDITOR cannot create an edition: 403, in words', ec.status === 403 && ec.j.error === SCRUTINY_UI.ownerOnly, `${ec.status} ${ec.j.error}`)
    const eg = await route.GET(new Request('http://x'), params)
    ok('…but may read the list (GET 200)', eg.status === 200, String(eg.status))

    as(owner)
    // "needs no draft" (313), set on the scratch BEFORE the edition is frozen: the edition must carry it, with its reason, from the database
    const D = await import('../lib/lex/action-documents')
    const noDraftAction = await prisma.lexCoherentAction.findFirst({ where: { ideaId: scratch.id, status: 'LIVE', number: { not: null } }, orderBy: { number: 'desc' }, select: { id: true, number: true } })
    const NO_DRAFT_REASON = 'it is a promise of guidance, not a rule (26-AC check)'
    const nd = noDraftAction ? await D.setNeeds(scratch.id, noDraftAction.id, { mode: 'nothing', reason: NO_DRAFT_REASON }, scratch.userId) : null
    const c1 = await post({ op: 'create' })
    ok('the owner creates Scrutiny edition 1, a draft, frozen from a version of the proposal', c1.status === 200 && c1.j.data?.number === 1 && typeof c1.j.data?.versionNumber === 'number', JSON.stringify(c1.j).slice(0, 200))
    const e1 = String(c1.j.data?.id)
    const c2 = await post({ op: 'create' })
    ok('…a second is refused while edition 1 is a draft, in words', c2.status === 409 && /Scrutiny edition 1 is still a draft/.test(c2.j.error ?? ''), c2.j.error)

    const loaded = (await S.loadEdition(e1))!
    const firstHeading = loaded.snapshot.actionsPack?.headings.find((h) => !h.hidden)
    const firstAction = loaded.snapshot.actionsPack?.actions[0]
    if (!firstHeading || !firstAction) { skip('the rest of part B', 'the scratch copy has no headings or actions'); return null }
    if (noDraftAction && nd?.ok) {
      const nda = S.viewOf(loaded).headings.flatMap((h) => h.actions).find((a) => a.id === noDraftAction.id)
      ok(`"needs no draft", set in the workspace, is frozen into the edition with its reason (#${noDraftAction.number})`, nda?.noDraftReason === NO_DRAFT_REASON && nda.draftState === `Needs no draft: ${NO_DRAFT_REASON}`, nda?.draftState)
    } else skip('"needs no draft" frozen into the edition', `could not set it on the scratch copy: ${JSON.stringify(nd).slice(0, 120)}`)
    const nTop = await post({ op: 'addNote', editionId: e1, targetKind: 'TOP', targetId: null, body: 'Opening note (26-AC check)' })
    const nAct = await post({ op: 'addNote', editionId: e1, targetKind: 'ACTION', targetId: firstAction.id, body: 'A note on the first action (26-AC check)' })
    const nBad = await post({ op: 'addNote', editionId: e1, targetKind: 'ACTION', targetId: 'not-an-action', body: 'x' })
    const nLong = await post({ op: 'addNote', editionId: e1, targetKind: 'TOP', targetId: null, body: 'x'.repeat(4001) })
    ok('author\'s notes: at the top and against an action are added; an action not in the edition, and an over-long note, are refused in words', nTop.status === 200 && nAct.status === 200 && nBad.status === 409 && /not in this edition/.test(nBad.j.error ?? '') && nLong.status === 409 && /at most 4,000 characters/.test(nLong.j.error ?? ''), `${nTop.status} ${nAct.status} ${nBad.j.error} ${nLong.j.error}`)
    const arch = await post({ op: 'archiveNote', editionId: e1, noteId: String(nTop.j.data?.id), archived: true })
    const rest = await post({ op: 'archiveNote', editionId: e1, noteId: String(nTop.j.data?.id), archived: false })
    ok('…a note is set aside and restored, never deleted', arch.status === 200 && rest.status === 200 && (await prisma.scrutinyAuthorNote.count({ where: { editionId: e1 } })) === 2)

    // ── the source-linking exercise, with a stand-in for the model (no spend): the price gate, proposals only, what is dropped is said ──
    const L = await import('../lib/lex/scrutiny-linking')
    const srcRows = await prisma.ideaSource.findMany({ where: { ideaId: srcId, archivedAt: null, number: { not: null } }, orderBy: { number: 'asc' }, take: 3 })
    if (srcRows.length >= 2) {
      await prisma.ideaSource.createMany({ data: srcRows.map(({ id: _id, ideaId: _i, createdAt: _c, updatedAt: _u, ...rest }) => ({ ...rest, ideaId: scratch!.id })), skipDuplicates: true })
      const est = await post({ op: 'linkEstimate', editionId: e1 })
      const pence = Number(est.j.data?.pence)
      ok(`the exercise is priced before it runs, from the measured runs (about ${est.j.data?.priceWords}, ${est.j.data?.words} words)`, est.status === 200 && pence > 0 && /measured/.test(String(est.j.data?.basis)), JSON.stringify(est.j).slice(0, 200))
      const fake = (async () => ({ ok: true, value: { links: [
        { target: `A:${firstAction.id}`, ref: srcRows[0].number, claim: '', reason: 'stand-in: supports the action' },
        { target: 'A:not-a-section', ref: srcRows[0].number, claim: '', reason: 'stand-in' },
        { target: 'S', ref: 99999, claim: '', reason: 'stand-in' },
      ] }, usage: { model: 'stand-in', tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } })) as never
      const low = await L.runLinking(scratch.id, e1, scratch.userId, Math.max(0, pence - 1), { call: fake })
      ok('…a run at a price below the measured one is refused, in words, and nothing is proposed', !low.ok && /not the .* you agreed/.test((low as { error: string }).error) && (await prisma.scrutinySourceLink.count({ where: { editionId: e1 } })) === 0, JSON.stringify(low).slice(0, 160))
      const run = await L.runLinking(scratch.id, e1, scratch.userId, pence, { call: fake })
      const rows = await prisma.scrutinySourceLink.findMany({ where: { editionId: e1 } })
      const d = (run as { data?: { proposed: number; dropped: string[] } }).data
      ok('…at the agreed price it writes PROPOSALS only (never accepted), and the two it could not check are dropped and SAID', run.ok && d?.proposed === 1 && rows.length === 1 && rows[0].status === 'PROPOSED' && d.dropped.length === 2 && d.dropped.some((x) => /not a section/.test(x)) && d.dropped.some((x) => /not a filed source/.test(x)), JSON.stringify(run).slice(0, 240))
      const v0 = S.viewOf((await S.loadEdition(e1))!)
      ok('…a proposal is not a citation: the page does not cite it until it is accepted', !(v0.sources ?? []).some((s) => s.number === srcRows[0].number && s.citedBy.includes(`#${firstAction.number}`)) || firstAction.refs.includes(srcRows[0].number!))
      const acc = await post({ op: 'answerLink', editionId: e1, linkId: rows[0].id, answer: 'ACCEPTED' })
      const v1 = S.viewOf((await S.loadEdition(e1))!)
      ok('…accepted, the source is cited for that action on the page', acc.status === 200 && (v1.sources ?? []).some((s) => s.number === srcRows[0].number && s.citedBy.includes(`#${firstAction.number}`)))
    } else skip('the source-linking exercise', 'the source idea has fewer than two filed sources')

    as(editor)
    const rEd = await readerAccess(e1)
    as(owner)
    const rOw = await readerAccess(e1)
    as(stranger)
    const rSt = await readerAccess(e1)
    const rOut = await readerAccessFor(null, e1) // signed out (the stub seam cannot say "nobody"; the page passes the same null)
    ok('a DRAFT edition: the owner reads it (Preview as a reviewer); the editor does not; a stranger does not; signed out is sent to sign in', rOw.ok && !rEd.ok && !rSt.ok && !rOut.ok && !(rOut as { signedIn: boolean }).signedIn && (rSt as { signedIn: boolean }).signedIn)

    as(owner)
    const before = S.viewOf((await S.loadEdition(e1))!)
    const p1 = await post({ op: 'publish', editionId: e1, anyway: false })
    const listed = p1.j.data?.checklist as import('../lib/lex/scrutiny-edition-pure').Checklist | undefined
    const open = listed ? checklistCount(listed) : 0
    if (open) {
      ok(`publish shows the checklist first and does not publish (${open} open: ${listed!.unlinked.length} unlinked, ${listed!.unaccepted.length} not accepted, ${listed!.uncited.length} uncited)`, p1.status === 200 && p1.j.data?.published === false && (await prisma.scrutinyEdition.findUnique({ where: { id: e1 } }))?.status === 'DRAFT')
    } else skip('publish shows the checklist first', 'the scratch copy has nothing open, so there is nothing to show')
    const p2 = await post({ op: 'publish', editionId: e1, anyway: true })
    const row = await prisma.scrutinyEdition.findUnique({ where: { id: e1 } })
    const rec = row?.checklist as { publishedAnyway?: boolean } | null
    ok('"Publish anyway" publishes, and the checklist as it stood is RECORDED with the edition (publishedAnyway)', p2.status === 200 && row?.status === 'PUBLISHED' && !!row.publishedAt && rec?.publishedAnyway === (open > 0), JSON.stringify(rec).slice(0, 160))

    // ── THE PROPERTY: the workspace changes; the published edition does not ──
    const changed = `Changed after publishing (26-AC check) ${Date.now()}`
    await prisma.lexCoherentAction.update({ where: { id: firstAction.id }, data: { practicalStep: changed } })
    const after = S.viewOf((await S.loadEdition(e1))!)
    ok('A PUBLISHED EDITION DOES NOT CHANGE when the workspace does: the page after an action is edited is identical to the page at publish', stableStringify({ ...after, status: null, publishedAt: null }) === stableStringify({ ...before, status: null, publishedAt: null }))
    const { buildProposalSnapshot } = await import('../lib/documents/proposal-snapshot')
    const live = await buildProposalSnapshot(scratch.id)
    control('…the live idea DOES carry the change (so "unchanged" is not a page that reads nothing)', live.actionsPack?.actions.some((a) => a.statement === changed) === true && !after.headings.some((h) => h.actions.some((a) => a.statement === changed)))

    const pn = await post({ op: 'addNote', editionId: e1, targetKind: 'TOP', targetId: null, body: 'After publishing (must be refused)' })
    const pi = await post({ op: 'include', editionId: e1, hidden: [SECTION_KEY.sources] })
    ok('the code refuses a change to the published edition, in words (a note; the sections)', pn.status === 409 && pn.j.error === PUBLISHED_REFUSED(1) && pi.status === 409, `${pn.j.error}`)
    const dbEdit = await prisma.scrutinyEdition.update({ where: { id: e1 }, data: { include: { hidden: ['sources'] } } }).then(() => 'written', (e: Error) => e.message)
    const dbNote = await prisma.scrutinyAuthorNote.create({ data: { id: `chk-${Date.now()}`, editionId: e1, targetKind: 'TOP', body: 'around the code' } }).then(() => 'written', (e: Error) => e.message)
    const dbNoteEdit = await prisma.scrutinyAuthorNote.updateMany({ where: { editionId: e1 }, data: { body: 'changed around the code' } }).then(() => 'written', (e: Error) => e.message)
    ok('…and so does the DATABASE, around the code: an UPDATE of the edition, a new note, an edited note — each refused by the trigger', /is published and cannot change/.test(dbEdit) && /is published/.test(dbNote) && /is published/.test(dbNoteEdit), [dbEdit, dbNote, dbNoteEdit].map((s) => s.slice(0, 80)).join(' | '))
    const closeRound = await prisma.scrutinyEdition.update({ where: { id: e1 }, data: { roundClosedAt: new Date() } }).then(() => 'written', (e: Error) => e.message)
    control('…the trigger is not a blanket refusal: closing the round (the one change it allows) is written', closeRound === 'written')

    as(editor)
    const rEd2 = await readerAccess(e1)
    ok('once published, the team (an EDITOR) reads it; a stranger still does not', rEd2.ok && !(await (async () => { as(stranger); return (await readerAccess(e1)).ok })()))

    as(owner)
    const c3 = await post({ op: 'create' })
    const e2 = String(c3.j.data?.id)
    const l2 = c3.status === 200 ? await S.loadEdition(e2) : null
    ok('Scrutiny edition 2: numbered 2, frozen from a LATER version, carrying edition 1\'s live notes as new rows', c3.status === 200 && c3.j.data?.number === 2 && (l2?.versionNumber ?? 0) > loaded.versionNumber && l2?.notes.length === 2 && !l2.notes.some((n) => loaded.notes.some((o) => o.id === n.id)), JSON.stringify(c3.j).slice(0, 200))
    control('…and edition 2 carries the change edition 1 does not', !!l2 && S.viewOf(l2).headings.some((h) => h.actions.some((a) => a.statement === changed)))

    // Lex parity (301): the owner's Lex creates an edition through the same code path, behind a confirm card
    const { toolByName, isModelTool, needsButton } = await import('../lib/lex/agent/tools')
    const tool = toolByName('create_scrutiny_edition')
    ok('Lex parity: create_scrutiny_edition is a tool Lex is offered, and it asks first (a confirm card)', !!tool && isModelTool('create_scrutiny_edition') && needsButton(tool!) && tool!.category === 'change')
    const viaLex = await tool!.run({ ideaId: scratch.id, userId: scratch.userId } as never, {} as never)
    ok('…run with edition 2 still a draft, it is refused in the same words as the page', !viaLex.ok && /Scrutiny edition 2 is still a draft/.test((viaLex as { error?: string }).error ?? JSON.stringify(viaLex)), JSON.stringify(viaLex).slice(0, 200))
    const viaLexStranger = await tool!.run({ ideaId: scratch.id, userId: strangerId } as never, {} as never)
    ok('…and refused to anyone but the owner', !viaLexStranger.ok)

    readerView = S.viewOf((await S.loadEdition(e1))!)
    const snapH = loaded.snapshot.actionsPack!.headings.length
    const loose = loaded.snapshot.actionsPack!.actions.filter((a) => a.headingId == null).length
    ok(`the real edition shows every heading of the snapshot (${snapH}, hidden in the workspace or not), and only the actions with no heading (${loose}) outside them`, readerView.headings.filter((h) => h.id).length === snapH && (readerView.headings.find((h) => h.id === null)?.actions.length ?? 0) === loose, readerView.headings.map((h) => `${h.name}:${h.actions.length}`).join(' | '))
  } finally {
    as(undefined)
    if (added.length) await prisma.ideaCollaborator.deleteMany({ where: { id: { in: added } } })
    console.log(`  (collaborator rows removed: ${added.length}; scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
  return readerView
}

// ── C · the reader's page in Chromium ───────────────────────────────────────────────────────────────────────
async function partC(views: Array<[string, EditionView]>) {
  section('C · the reader\'s page in Chromium: 360 and 390 px, then 1024 px')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  const { build } = await import('esbuild')
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/scrutiny-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'), alias: { 'next/navigation': join(ROOT, 'scripts/fixtures/next-navigation-stub.ts') } })).outputFiles[0].text
  let css = ''
  try {
    const postcss = (await import('postcss')).default
    const twName: string = '@tailwindcss/postcss'
    const tw = (await import(twName)).default as () => import('postcss').AcceptedPlugin
    css = (await postcss([tw()]).process(`@import 'tailwindcss'; @source "../components/lex/scrutiny/EditionReader.tsx"; @source "../components/lex/scrutiny/ScrutinyOwner.tsx"; @source "../components/lex/InfoLabel.tsx";`, { from: join(ROOT, 'scripts/_tw.css') })).css
  } catch (e) { ok('Tailwind compiled, so the layout can be measured', false, (e as Error).message.slice(0, 200)); return }
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/harness.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); return }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style></head><body style="margin:0"><div id="root"></div><script src="/harness.js"></script></body></html>`)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const ORIGIN = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); server.close(); return }
  try {
    for (const [name, view] of views) {
      const withDraft = view.headings.flatMap((h) => h.actions).find((a) => a.drafts.length)
      for (const width of [360, 390, 1024]) {
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, ...(width < 768 ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) })
        const p = await ctx.newPage()
        const errors: string[] = []
        p.on('pageerror', (e) => errors.push(e.message))
        await p.goto(`${ORIGIN}/scrutiny/x`)
        await p.evaluate(([v]) => { const w = window as unknown as { __view: unknown; __banner: unknown; __mount: () => void }; w.__view = v; w.__banner = 'preview'; w.__mount() }, [view] as const)
        await p.waitForSelector('[data-edition-reader]')
        await sleep(200)
        const at = `${name}, ${width} px:`
        const wide = await p.evaluate(() => { const W = document.documentElement.clientWidth; const over = Array.from(document.querySelectorAll('[data-edition-reader] *')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.overflow-x-auto') }).map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-panel') ? `[${el.getAttribute('data-panel')}]` : ''} ${Math.round(el.getBoundingClientRect().right)}`); return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 5) } })
        ok(`${at} nothing is wider than the viewport (page ${wide.sw} ≤ ${wide.W})`, wide.sw <= wide.W && wide.over.length === 0, JSON.stringify(wide.over))
        ok(`${at} the preview says so, in words`, (await p.locator('[data-banner="preview"]').innerText()).includes(SCRUTINY_UI.previewBanner))
        const panels = await p.locator('[data-panel]').count()
        const visible = await p.evaluate(() => Array.from(document.querySelectorAll('[data-panel]')).filter((e) => !(e as HTMLElement).hidden).length)
        if (width < 768) {
          ok(`${at} ONE section at a time (${visible} of ${panels} shown) with the bar at the bottom edge`, visible === 1 && panels > 1 && await p.evaluate(() => { const b = document.querySelector('[data-reader-bar]')!.getBoundingClientRect(); return Math.abs(b.bottom - window.innerHeight) <= 1 }), `${visible}/${panels}`)
          const first = await p.locator('[data-reader-here]').innerText()
          await p.locator('[data-reader-next]').tap(); await sleep(100)
          const second = await p.locator('[data-reader-here]').innerText()
          ok(`${at} Next shows the next section, and the bar names it`, first !== second && second.startsWith('2/'), `${first} → ${second}`)
          await p.locator('[data-reader-sections]').tap(); await sleep(50)
          const items = await p.locator('[data-reader-menu] button').count()
          ok(`${at} "Sections" lists every section (${items})`, items === panels)
          await p.locator('[data-reader-menu] button').nth(panels - 1).tap(); await sleep(100)
          ok(`${at} …and a tap there goes to it`, (await p.locator('[data-reader-here]').innerText()).startsWith(`${panels}/`))
          const tapTargets = await p.evaluate(() => Array.from(document.querySelectorAll('[data-reader-bar] button')).filter((b) => !(b as HTMLElement).closest('[data-reader-menu]')).map((b) => Math.round(b.getBoundingClientRect().height)))
          ok(`${at} the bar's buttons are at least 44 px tall`, tapTargets.every((h) => h >= 44), tapTargets.join(','))
        } else {
          ok(`${at} on a desktop every section is shown, in one column`, visible === panels && !(await p.locator('[data-reader-bar]').count()))
        }
        if (view.setAside) {
          const opened = await p.evaluate(() => (document.querySelector('[data-set-aside]') as HTMLDetailsElement | null)?.open)
          ok(`${at} "Options considered and set aside" is collapsed by default`, opened === false)
        }
        if (withDraft) {
          // go to the section holding it (on a phone), then Read the draft wording, then back
          if (width < 768) {
            await p.locator('[data-reader-sections]').tap(); await sleep(50)
            const idx = await p.evaluate((id) => Array.from(document.querySelectorAll('[data-panel]')).findIndex((e) => !!e.querySelector(`[data-action="${id}"]`)), withDraft.id)
            await p.locator('[data-reader-menu] button').nth(idx).tap(); await sleep(100)
          }
          await p.locator(`[data-action="${withDraft.id}"] [data-read-draft]`).click(); await sleep(150)
          const dv = await p.locator(`[data-draft-view="${withDraft.id}"]`).count()
          ok(`${at} "Read the draft wording" opens #${withDraft.number}'s draft in its own view, its version named`, dv === 1 && (await p.locator('[data-draft-doc]').first().innerText()).includes(withDraft.drafts[0].words) && (await p.evaluate(() => location.hash)) === `#draft-${withDraft.id}`)
          const wideDraft = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
          ok(`${at} …the draft view fits the viewport too`, wideDraft)
          await p.locator('[data-draft-back]').first().click(); await sleep(250)
          const back = await p.evaluate((id) => { const el = document.querySelector(`[data-action="${id}"]`) as HTMLElement | null; if (!el || el.closest('[hidden]')) return 'hidden'; const r = el.getBoundingClientRect(); return r.top >= -2 && r.top < window.innerHeight ? 'in view' : `top ${Math.round(r.top)}` }, withDraft.id)
          ok(`${at} …"Back to #${withDraft.number}" returns to the same place (the action in view)`, back === 'in view' && !(await p.locator('[data-draft-view]').count()), back)
          await p.locator(`[data-action="${withDraft.id}"] [data-read-draft]`).click(); await sleep(150)
          await p.goBack(); await sleep(250)
          ok(`${at} …and the browser's own Back does the same`, !(await p.locator('[data-draft-view]').count()) && (await p.evaluate((id) => { const el = document.querySelector(`[data-action="${id}"]`); return !!el && !el.closest('[hidden]') }, withDraft.id)))
        } else skip(`${at} the draft view`, 'no action in this edition has a draft')
        ok(`${at} no script error`, errors.length === 0, errors.join(' | ').slice(0, 200))
        await ctx.close()
      }
    }
    // ── the OWNER's page (ScrutinyOwner), at 360 and 390 px: fits, its ⓘ, every irreversible step asks in place (never a browser dialog) ──
    const fv = views[0][1]
    const draft = {
      id: 'ed-fx', number: 2, versionNumber: 3, blind: false, hidden: [] as string[],
      sections: [{ key: SECTION_KEY.summary, label: SCRUTINY_UI.ideaInOnePage }, ...fv.headings.map((h) => ({ key: h.key, label: h.name })), { key: SECTION_KEY.setAside, label: SCRUTINY_UI.optionsSetAside }, { key: SECTION_KEY.sources, label: SCRUTINY_UI.sources }],
      targets: [...fv.headings.filter((h) => h.id).map((h) => ({ kind: 'HEADING' as const, id: h.id!, label: `Heading: ${h.name}` })), ...fv.headings.flatMap((h) => h.actions).map((a) => ({ kind: 'ACTION' as const, id: a.id, label: `#${a.number} ${a.statement}` }))],
      notes: NOTES, links: LINKS, checklist: prePublishChecklist(fv, FIX), sources: [{ number: 4, title: 'English Housing Survey' }, { number: 7, title: 'Rugg Review' }], sectionCount: fv.headings.length,
    }
    for (const width of [360, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
      const p = await ctx.newPage()
      const errors: string[] = []; let dialogs = 0; const posts: Array<Record<string, unknown>> = []
      p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { dialogs++; void d.dismiss() })
      await p.route('**/api/ideas/fx/scrutiny', async (r) => {
        const b = JSON.parse(r.request().postData() ?? '{}') as Record<string, unknown>; posts.push(b)
        const data = b.op === 'linkEstimate' ? { pence: 2.2, priceWords: '2.2p', basis: 'measured, n=1 real run', sections: 9, sources: 2, words: 4500 } : b.op === 'linkRun' ? { proposed: 1, dropped: ['a link to “x”, which is not a section of this edition'], unlinked: ['Action #4'], pence: 2.1 } : { number: 2, published: true }
        await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) })
      })
      await p.goto(`${ORIGIN}/ideas/fx/scrutiny`)
      await p.evaluate(([d]) => { const w = window as unknown as { __draft: unknown; __mountOwner: () => void }; w.__draft = d; w.__mountOwner() }, [draft] as const)
      await p.waitForSelector('[data-scrutiny-owner]')
      const at = `the owner's page, ${width} px:`
      const fit = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth }))
      ok(`${at} nothing is wider than the viewport (page ${fit.sw} ≤ ${fit.W})`, fit.sw <= fit.W)
      const infos = await p.locator('[data-info-button]').evaluateAll((bs) => bs.map((b) => (b.getAttribute('aria-label') ?? '').replace(/^About /, '')))
      const wantInfo = [SCRUTINY_UI.sections, SCRUTINY_UI.blind, SCRUTINY_UI.notes, SCRUTINY_UI.linking, SCRUTINY_UI.checklist]
      ok(`${at} an ⓘ on each field and heading that takes a decision (${wantInfo.length})`, wantInfo.every((x) => infos.includes(x)), infos.join(', '))
      await p.locator('[data-publish-ask]').tap(); await sleep(100)
      const confirm = p.locator('[data-publish-confirm]')
      ok(`${at} Publish ASKS FIRST, in place (no browser dialog), and with the checklist open it says "${SCRUTINY_UI.publishAnyway}"`, (await confirm.count()) === 1 && (await confirm.innerText()).includes(SCRUTINY_UI.publishAnyway) && dialogs === 0 && !posts.some((x) => x.op === 'publish'))
      await confirm.tap(); await sleep(200)
      const pub = posts.find((x) => x.op === 'publish')
      ok(`${at} …confirmed, it publishes with "anyway" (the list is recorded) and refreshes from the server`, pub?.anyway === true && pub.editionId === 'ed-fx' && (await p.evaluate(() => (window as unknown as { __refreshes?: number }).__refreshes ?? 0)) >= 1, JSON.stringify(pub))
      await p.locator('[data-link-price]').tap(); await sleep(150)
      const est = await p.locator('[data-link-estimate]').innerText()
      const runBtn = p.locator('[data-link-run]')
      ok(`${at} the linking exercise shows its price and basis BEFORE anything runs, and "Run it" carries that price`, /About 2\.2p/.test(est) && /measured/.test(est) && (await runBtn.innerText()).includes('2.2p') && !posts.some((x) => x.op === 'linkRun'), est)
      await runBtn.tap(); await sleep(150)
      ok(`${at} …"Run it" sends the price agreed`, posts.find((x) => x.op === 'linkRun')?.agreedPence === 2.2)
      const res = await p.locator('[data-link-result]').innerText()
      ok(`${at} …and the result says what was proposed, what was left out and why, and what is still unlinked`, /Lex proposed 1 link, for 2\.1p/.test(res) && /Left out/.test(res) && res.includes(SCRUTINY_UI.unlinkedAfter), res.slice(0, 200))
      ok(`${at} a published edition shows what was published anyway`, (await p.locator('[data-edition="ed-0"] summary').innerText()).includes(SCRUTINY_UI.publishedAnyway))
      ok(`${at} no script error`, errors.length === 0, errors.join(' | ').slice(0, 200))
      await ctx.close()
    }
  } finally { await browser.close(); server.close() }
}

;(async () => {
  console.log('check:lex-26ac — part (a): scrutiny editions, the reader\'s page, Preview as a reviewer')
  const fixtureView = partA()
  const real = await partB()
  await partC([['the fixture', fixtureView], ...(real ? [['the real edition', real] as [string, EditionView]] : [])])
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
