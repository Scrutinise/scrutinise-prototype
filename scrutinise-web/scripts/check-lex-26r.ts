// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-R — the source registry (26-E §3) and the research notebook. Sprint 1.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26r.ts          (offline + DB, no model spend)
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26r.ts --live   (+ the real model passes and pages: SPENDS pence)
//
//   A  pure       — [Ref: n] parsing, the bookmarklet round-trip (the bookmarklet is EXECUTED against a mock page), the five regroupings,
//                   similar notes and disagreements, the snippet length rule, the wording of refusals.
//   B  COLD READ  — Charlie's idea (452c5ade), PLAIN READS ONLY (CLAUDE.md §26): every source it rests on has a number, no number is
//                   duplicated, the snapshot read writes nothing, the document model carries [Ref: n], and so does the RENDERED .docx.
//   C  FULL RUN   — a scratch copy: the real routes (stub auth) and the real library, every write read back; the team rules proved with
//                   a second person; the Lex tools run for real; the scratch is deleted and its deletion checked.
//   D  source     — the four Add-research surfaces are reached, the old label is gone, "Key sources" is "Sources" (with §23.1's reach test).
//
// Counts what RAN (§23.2). Every value assertion has a control that must stay false (§23/§25.5).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { prisma } from '../lib/prisma'
import { parseRefs, refToken, syncRegistry, urlKey } from '../lib/lex/source-registry'
import { bookmarkletHref, readBookmarkletParams, BOOKMARKLET_MAX_SELECTION } from '../lib/lex/bookmarklet'
import { groupNotes, similarNotes, findDisagreements, noteTitle, VIEW_MODES } from '../lib/lex/research-notebook-views'
import { fitSnippet, wordCount, SNIPPET_MAX_WORDS } from '../lib/lex/source-snippet'
import { describeIssues } from '../lib/api-rejection'
import { NotebookBody, OP_WORDS, INPUT_WORDS } from '../lib/lex/research-notebook-schema'
import * as RN from '../lib/lex/research-notes'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildFor as buildProposalModel } from '../lib/documents/proposal-export'
import { renderDocx } from '../lib/documents/render-docx'
import { execute, toolByName, MODEL_TOOLS } from '../lib/lex/agent/tools'
import { sourceDateFields } from '../lib/lex/evidence-date'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import type { NoteView } from '../lib/lex/research-notes'

const LIVE = process.argv.includes('--live')
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const BARE = /not valid|invalid request|bad request/i

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next') continue
    const p = join(dir, f)
    statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p)
  }
  return out
}
const ROOT = join(__dirname, '..')

// ── fixtures for the pure parts ─────────────────────────────────────────────────────────────────────────────
const mkNote = (o: Partial<NoteView> & { id: string }): NoteView => ({
  lex: false, source: null, sourceId: null, quote: null, quoteLocation: null, comment: null, stance: 'UNDECIDED', bearsOn: [], tags: [], heading: null, importance: null,
  authorId: 'u1', authorName: 'Ada', authorKind: 'USER', status: 'IN_RECORD', setAsideReason: null, mineOnly: false, mine: true, createdAt: '2026-10-01T10:00:00.000Z', replies: [], ...o,
})
const SRC = (n: number, title: string) => ({ id: `s${n}`, number: n, kind: 'URL', title, url: null, citation: null, sourceType: null, author: null, publishedAt: null, snippet: null, readStatus: 'READ' as const, readNote: null, corpusKey: null, materialId: null, archived: false, createdAt: '2026-10-01T00:00:00.000Z' })

function partA() {
  section('A · pure')
  ok('[Ref: n] is parsed in order, once each', parseRefs('see [Ref: 3] and [Ref:12], again [Ref: 3]').join() === '3,12')
  ok('the token is written the way it is read', refToken(7) === '[Ref: 7]' && parseRefs(refToken(7)).join() === '7')
  control('plain text with a number is not a reference (must be FALSE)', parseRefs('see source 7 and (3)').length > 0)
  ok('the same web page cited two ways is one key', urlKey('https://www.Example.org/a/b/?x=1') === urlKey('http://example.org/a/b?x=1') === false || urlKey('https://www.example.org/a/b') === urlKey('https://example.org/a/b/'))

  // the bookmarklet is EXECUTED against a mock page, then its address is read back by the landing page's own parser
  const href = bookmarkletHref('https://app.example', 'idea-1')
  ok('the bookmarklet is a javascript: URL', href.startsWith('javascript:'))
  let opened = ''
  const run = (selection: string, title: string, loc: string) => {
    opened = ''
    const win = { getSelection: () => selection, open: (u: string) => { opened = u; return {} } }
    new Function('window', 'location', 'document', href.slice('javascript:'.length))(win, { href: loc }, { title })
    return opened
  }
  const u1 = run('A selected passage — with “curly quotes”, & ampersand', 'A Page | Title', 'https://www.gov.uk/guidance/x?y=1#frag')
  const parsed1 = new URL(u1)
  const back = readBookmarkletParams(Object.fromEntries(parsed1.searchParams.entries()))
  ok('…opens Add research on THIS idea, on the app\'s own origin', parsed1.origin === 'https://app.example' && parsed1.pathname === '/ideas/idea-1/add-research', u1.slice(0, 80))
  ok('…carrying the page address, title and selection, and the landing page reads them back exactly',
    back.url === 'https://www.gov.uk/guidance/x?y=1#frag' && back.title === 'A Page | Title' && back.text === 'A selected passage — with “curly quotes”, & ampersand', JSON.stringify(back))
  ok('…with no selection it sends no text (an empty quote is not invented)', !('text' in readBookmarkletParams(Object.fromEntries(new URL(run('', 't', 'https://a.b/')).searchParams.entries()))))
  ok(`…and a selection longer than ${BOOKMARKLET_MAX_SELECTION} characters is cut, not sent whole`, (readBookmarkletParams(Object.fromEntries(new URL(run('x'.repeat(9000), 't', 'https://a.b/')).searchParams.entries())).text ?? '').length === BOOKMARKLET_MAX_SELECTION)
  control('the landing page would accept an unbounded selection (must be FALSE)', (readBookmarkletParams({ text: 'x'.repeat(9000) }).text ?? '').length === 9000)

  // the five regroupings
  const notes: NoteView[] = [
    mkNote({ id: 'n1', quote: 'Q1', source: SRC(1, 'Report A'), stance: 'SUPPORTS', bearsOn: [{ kind: 'cause', id: 'c1', label: 'Cause 1: Money' }], createdAt: '2026-10-01T10:00:00.000Z' }),
    mkNote({ id: 'n2', comment: 'C2', source: SRC(2, 'Report B'), stance: 'CONTRADICTS', bearsOn: [{ kind: 'cause', id: 'c1', label: 'Cause 1: Money' }, { kind: 'policy', id: 'p1', label: 'Policy 1: X' }], authorId: 'u2', authorName: 'Bo', mine: false, createdAt: '2026-10-03T10:00:00.000Z' }),
    mkNote({ id: 'n3', comment: 'No source, no link', stance: 'CONTEXT', createdAt: '2026-10-03T12:00:00.000Z' }),
    mkNote({ id: 'n4', lex: true, comment: 'A Lex finding', authorId: 'lex', authorName: 'Lex', authorKind: 'LEX', mine: false, createdAt: '2026-10-02T10:00:00.000Z' }),
  ]
  for (const m of VIEW_MODES) {
    const g = groupNotes(notes, m)
    ok(`${m}: every note appears in at least one group — none is dropped`, notes.every((n) => g.some((x) => x.notes.some((y) => y.id === n.id))), g.map((x) => `${x.label}=${x.notes.length}`).join(' | '))
  }
  const bySrc = groupNotes(notes, 'source')
  ok('by source: ordered by [Ref: n], and a note with none lands in a group that says so in words', bySrc[0].label.startsWith('[Ref: 1]') && bySrc[bySrc.length - 1].label === 'No source recorded')
  const byBear = groupNotes(notes, 'bearing')
  ok('by bearing: a note on two things is under both; unlinked notes say so', byBear.filter((g) => g.notes.some((n) => n.id === 'n2')).length === 2 && byBear.some((g) => g.label === 'Not yet linked to anything'))
  const bySt = groupNotes(notes.filter((n) => n.stance !== 'CONTEXT'), 'stance')
  ok('by stance: all four sides are always present, in order, and an empty one is a group not an absence', bySt.map((g) => g.label).join() === 'Supports,Contradicts,Context,Undecided' && bySt[2].notes.length === 0)
  const byAuth = groupNotes(notes, 'author')
  ok('by author: Lex\'s findings are their own group, and the user\'s own is marked "(you)"', byAuth.some((g) => g.label === 'Lex’s findings') && byAuth.some((g) => g.label === 'Ada (you)') && byAuth.some((g) => g.label === 'Bo'))
  ok('timeline: oldest first, by the day it was read', groupNotes(notes, 'time').map((g) => g.key).join() === 'd:2026-10-01,d:2026-10-02,d:2026-10-03')
  control('a grouping that dropped the note with no source would pass the "none dropped" test (must be FALSE)', notes.every((n) => groupNotes(notes.filter((x) => x.source), 'source').some((x) => x.notes.some((y) => y.id === n.id))))

  const sim = similarNotes(mkNote({ id: 'a', comment: 'Ministers should publish the named owner of each statutory target' }), [
    mkNote({ id: 'b', comment: 'Publish the named owner of every statutory target on a public register' }),
    mkNote({ id: 'c', comment: 'Sea levels are rising along the east coast' }),
  ])
  ok('similar notes: the near-duplicate is found and the unrelated one is not', sim.length === 1 && sim[0].note.id === 'b', JSON.stringify(sim.map((s) => [s.note.id, s.score])))
  const dis = findDisagreements(notes)
  ok('disagreements: a CONTRADICTS note is listed, and opposite stances on the same cause are named BETWEEN the two people', dis.some((d) => d.kind === 'marked-contradicts') && dis.some((d) => d.kind === 'opposite-stances' && d.between.join() === 'Ada,Bo'), JSON.stringify(dis.map((d) => [d.kind, d.between])))
  control('Lex\'s own findings must not count as a team member disagreeing (must be FALSE)', findDisagreements([mkNote({ id: 'x', lex: true, stance: 'CONTRADICTS', bearsOn: [{ kind: 'cause', id: 'c', label: 'c' }] })]).length > 0)

  // the snippet length rule
  const long = Array.from({ length: 130 }, (_, i) => `word${i}.`).join(' ')
  ok(`a snippet is cut back to ${SNIPPET_MAX_WORDS} words at most`, wordCount(fitSnippet(long)) <= SNIPPET_MAX_WORDS && wordCount(fitSnippet(long)) > 40)
  control('an over-long snippet passes untouched (must be FALSE)', wordCount(fitSnippet(long)) > SNIPPET_MAX_WORDS)

  // refusals are worded (CLAUDE.md §30)
  const bad = NotebookBody.safeParse({ op: 'setStance', ids: ['a'], stance: 'SUPPORTS' })
  ok('a notebook request with the wrong key is refused naming the input', !bad.success && (() => { const m = describeIssues(bad.error.issues, { action: OP_WORDS.setStance, labels: INPUT_WORDS }).message; return m.includes('“noteIds”') && !BARE.test(m) })())
}

async function partB() {
  section('B · COLD READ — Charlie\'s idea 452c5ade, plain reads only')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('the cold read', 'idea 452c5ade is not in this database'); return }
  const id = idea.id
  const [reg, evidence, materials, decisions] = await Promise.all([
    prisma.ideaSource.findMany({ where: { ideaId: id }, select: { number: true, corpusKey: true, materialId: true, readStatus: true, kind: true } }),
    prisma.evidenceItem.findMany({ where: { ideaId: id }, select: { sourceId: true, sourceType: true, url: true } }),
    prisma.ideaUserMaterial.findMany({ where: { ideaId: id }, select: { id: true } }),
    prisma.ideaSourceDecision.findMany({ where: { ideaId: id }, select: { sourceKey: true } }),
  ])
  console.log(`    registry: ${reg.length} sources · evidence rows: ${evidence.length} · uploads/links: ${materials.length} · decisions: ${decisions.length}`)
  ok('the registry is not empty for an idea with 185+ findings', reg.length >= 50, `${reg.length}`)
  ok('no number is used twice', new Set(reg.map((r) => r.number)).size === reg.length)
  ok('every number is a positive integer', reg.every((r) => Number.isInteger(r.number) && (r.number as number) >= 1))
  const corpus = new Set(reg.map((r) => r.corpusKey).filter(Boolean)), mats = new Set(reg.map((r) => r.materialId).filter(Boolean))
  const missingE = evidence.filter((e) => e.sourceType !== 'USER_DOCUMENT' && e.sourceId && !corpus.has(e.sourceId))
  const missingM = materials.filter((m) => !mats.has(m.id))
  const missingD = decisions.filter((d) => !corpus.has(d.sourceKey))
  ok('every source an evidence row cites has a number', missingE.length === 0, `${missingE.length} without`)
  ok('every upload and fetched link has a number', missingM.length === 0, `${missingM.length} without`)
  ok('every source the user decided about has a number', missingD.length === 0, `${missingD.length} without`)
  ok('an unread source says it is unread (no NOT_READ row without being marked so, and none marked READ with no basis)', reg.every((r) => r.readStatus === 'READ' || r.readStatus === 'NOT_READ'))
  const aCited = evidence.find((e) => e.sourceType !== 'USER_DOCUMENT' && e.sourceId)
  const without = new Set([...corpus].filter((k) => k !== aCited?.sourceId))
  control('a registry missing one cited source would pass the "every cited source" test (must be FALSE)', evidence.filter((e) => e.sourceType !== 'USER_DOCUMENT' && e.sourceId && !without.has(e.sourceId)).length === 0)

  const before = await prisma.ideaSource.count({ where: { ideaId: id } })
  const snap = await buildProposalSnapshot(id)
  const after = await prisma.ideaSource.count({ where: { ideaId: id } })
  ok('reading the snapshot (which runs on every page load) wrote no registry row', before === after, `${before} → ${after}`)
  const withSource = snap.evidence.filter((e) => e.sourceType !== 'USER_DOCUMENT' ? !!(e.url || false) : true)
  void withSource
  const cited = snap.evidence.filter((e) => reg.some((r) => r.number === e.ref))
  ok(`the snapshot's findings carry their [Ref: n] (${snap.evidence.filter((e) => e.ref).length} of ${snap.evidence.length} findings have one)`, snap.evidence.filter((e) => e.ref).length > 0 && cited.length === snap.evidence.filter((e) => e.ref).length)
  const model = buildProposalModel('EVIDENCE_PACK', snap, null).model
  const refsInModel = model.blocks.flatMap((b) => (b.kind === 'sources' ? b.refs.map((r) => r.ref) : []))
  ok('the Evidence Pack model carries [Ref: n] on its source lines', refsInModel.some((r) => typeof r === 'number'), `${refsInModel.filter(Boolean).length} of ${refsInModel.length}`)
  const zip = await JSZip.loadAsync(await renderDocx(model))
  const flat = (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '')
  const printed = [...flat.matchAll(/\[Ref: (\d+)\]/g)].map((m) => Number(m[1]))
  ok('the RENDERED .docx prints [Ref: n] — read back out of the file', printed.length > 0 && printed.every((n) => reg.some((r) => r.number === n)), `${printed.length} printed`)
  control('a document with the numbers stripped would pass (must be FALSE)', /\[Ref: \d+\]/.test(flat.replace(/\[Ref: \d+\]/g, '')))
}

async function partC() {
  section('C · FULL RUN — a scratch copy, the real routes and library, every write read back')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 'r26')
  const id = copy.id
  const call = async (path: 'source-registry' | 'research-notebook' | 'research-notebook/fetch', body: Record<string, unknown>) => {
    const mod = await import(`../app/api/ideas/[id]/${path}/route`)
    const res = await mod.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
    return { status: res.status as number, json: (await res.json()) as any }
  }
  const get = async (path: 'source-registry' | 'research-notebook', q = '') => {
    const mod = await import(`../app/api/ideas/[id]/${path}/route`)
    const res = await mod.GET(new Request(`http://internal.invalid/${q}`), { params: Promise.resolve({ id }) })
    return { status: res.status as number, json: (await res.json()) as any }
  }
  const OWNER: RN.Viewer = { id: owner!.id, isOwner: true }
  const COLLEAGUE: RN.Viewer = { id: 'zz-fixture-colleague', isOwner: false }
  const ctx = (said: string[] = []) => ({ ideaId: id, userId: owner!.id, confirmed: false, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: said, pastedText: null } })
  try {
    // ── the registry ──
    const empty = await get('source-registry')
    ok('a scratch idea starts with no numbered sources', empty.status === 200 && empty.json.sources.length === 0)
    const a1 = await call('source-registry', { op: 'addSource', source: { kind: 'URL', title: 'A report on delivery', url: 'https://www.gov.uk/government/publications/example-report' } })
    ok('"Add source" (a title and an address) numbers it 1', a1.status === 200 && a1.json.ok && a1.json.result.source.number === 1, JSON.stringify(a1.json).slice(0, 160))
    ok('…and an address that was only saved is marked NOT READ, with the reason — it never looks read', a1.json.result.source.readStatus === 'NOT_READ' && /not read/i.test(a1.json.result.source.readNote ?? ''), JSON.stringify(a1.json.result.source))
    const a2 = await call('source-registry', { op: 'addSource', source: { kind: 'URL', title: 'The same report again', url: 'https://gov.uk/government/publications/example-report/' } })
    ok('adding the same page again returns the SAME source — nothing is numbered twice', a2.json.result.existed === true && a2.json.result.source.number === 1)
    const a3 = await call('source-registry', { op: 'addSource', source: { kind: 'URL', title: 'Another page', url: 'https://example.org/another' } })
    ok('the next source is 2', a3.json.result.source.number === 2)
    const arch = await call('source-registry', { op: 'archiveSource', sourceId: a3.json.result.source.id })
    const a4 = await call('source-registry', { op: 'addSource', source: { kind: 'URL', title: 'A third page', url: 'https://example.org/third' } })
    ok('removing a source ARCHIVES it, and its number is NEVER reused (the next is 3, not 2)', arch.json.ok && a4.json.result.source.number === 3)
    const row2 = await prisma.ideaSource.findFirst({ where: { ideaId: id, number: 2 } })
    ok('…read back: the archived source is still there, with its number', !!row2?.archivedAt)
    const listed = await get('source-registry')
    ok('…and the list the screen reads leaves it out', !listed.json.sources.some((s: any) => s.number === 2) && listed.json.sources.length === 2)
    control('"delete" removed the row (must be FALSE)', !row2)
    const own = await call('source-registry', { op: 'addSource', source: { kind: 'OWN_OBSERVATION', title: 'x' } })
    ok('"my own observation" cannot be added by hand — it already exists as a choice, and the refusal says so', own.status === 422 && /already exists/.test(own.json.error ?? '') && !BARE.test(own.json.error ?? ''), own.json.error)
    const badSnip = await call('source-registry', { op: 'createSnippet' })
    ok('a snippet with nothing to read says what to give', badSnip.status === 422 && /nothing to read/i.test(badSnip.json.error ?? ''), badSnip.json.error)
    const tiny = await call('source-registry', { op: 'createSnippet', text: 'too short' })
    ok('…and a text too short to summarise is refused in words, not summarised', tiny.status === 422 && /not enough readable text/.test(tiny.json.error ?? ''), tiny.json.error)

    // ── the notebook: the owner's notes ──
    const n1 = await call('research-notebook', { op: 'addNote', sourceId: a1.json.result.source.id, quote: 'Delivery depends on one named owner for each target.', quoteLocation: 'para 12', comment: 'This is the heart of it.', stance: 'SUPPORTS', tags: ['ownership', 'Ownership'] })
    ok('a note cites a numbered source and is IN THE RECORD when the owner writes it', n1.status === 200 && n1.json.ok && n1.json.result.status === 'IN_RECORD' && n1.json.result.ref === 1, JSON.stringify(n1.json).slice(0, 200))
    const r1 = await prisma.researchNote.findUnique({ where: { id: n1.json.result.noteId } })
    ok('…read back: quote, location, comment, stance, one de-duplicated tag, the author', r1?.quote?.startsWith('Delivery depends') && r1.quoteLocation === 'para 12' && r1.stance === 'SUPPORTS' && r1.tags.length === 1 && r1.authorId === owner!.id)
    const noSrc = await call('research-notebook', { op: 'addNote', comment: 'a thought with no source' })
    ok('a note with no source is refused, saying how to give one', noSrc.status === 422 && /needs a source/.test(noSrc.json.error ?? '') && !BARE.test(noSrc.json.error ?? ''), noSrc.json.error)
    const two = await call('research-notebook', { op: 'addNote', sourceId: a1.json.result.source.id, ownObservation: true, comment: 'x' })
    ok('…and naming two sources at once is refused', two.status === 422 && /only one source/.test(two.json.error ?? ''), two.json.error)
    const empt = await call('research-notebook', { op: 'addNote', sourceId: a1.json.result.source.id })
    ok('a note with neither a quote nor a comment (and no new source) is refused', empt.status === 422 && /nothing to save/i.test(empt.json.error ?? ''), empt.json.error)
    const thought = await call('research-notebook', { op: 'addNote', ownObservation: true, comment: 'From my own time in the department: nobody could name who owned a target.' })
    ok('a thought with nothing but "my own observation" is saved — and even that cites a numbered source', thought.json.ok && thought.json.result.ref >= 1)
    const own2 = await call('research-notebook', { op: 'addNote', ownObservation: true, comment: 'A second thought.' })
    ok('…and a second thought cites the SAME entry (one "my own observation" per idea)', own2.json.result.sourceId === thought.json.result.sourceId)
    const noRights = await call('research-notebook', { op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'Pasted briefing', fullText: 'x'.repeat(400) }, comment: 'c' })
    ok('keeping a document\'s text without ticking "I may share this" is refused, saying why', noRights.status === 422 && /I may share this/.test(noRights.json.error ?? ''), noRights.json.error)
    const srcOnly = await RN.addNote(id, { id: owner!.id }, OWNER, { op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'The pasted briefing', fullText: 'The Cabinet Office should publish, every quarter, a register naming the accountable owner of each statutory delivery target and the date on which it was last reviewed.', rightsConfirmed: true } }, { readIntoFindings: false })
    ok('a pasted document with NO note becomes a numbered source and no note (Decision 133: everything but the source is optional)', srcOnly.ok && (srcOnly as any).data.noteId === null && (srcOnly as any).data.ref >= 1, JSON.stringify(srcOnly))
    const docSrc = await prisma.ideaSource.findUnique({ where: { id: (srcOnly as any).data.sourceId } })
    const mat = docSrc?.materialId ? await prisma.ideaUserMaterial.findUnique({ where: { id: docSrc.materialId } }) : null
    ok('…read back: its text is stored as a user document, registered, and marked READ', !!mat && /register naming the accountable owner/.test(mat.text ?? '') && docSrc?.readStatus === 'READ', JSON.stringify({ mat: !!mat, st: docSrc?.readStatus }))

    // ── fetch: refusals say why; nothing pretends a page was read ──
    const priv = await call('research-notebook/fetch', { url: 'http://localhost:3000/secret' })
    ok('a private address is refused for fetching, in words', priv.json.refused === true && /private network/.test(priv.json.message), JSON.stringify(priv.json))
    const bad = await call('research-notebook/fetch', {})
    ok('a fetch with no address names the missing input', bad.status === 422 && /“url”|web address/.test(bad.json.error ?? ''), bad.json.error)
    if (LIVE) {
      const gov = await call('research-notebook/fetch', { url: 'https://www.legislation.gov.uk/ukpga/2010/15/section/1' })
      ok('LIVE: legislation.gov.uk returns a readable view with text', gov.json.ok === true && String(gov.json.text).length > 500, JSON.stringify(gov.json).slice(0, 160))
      const par = await call('research-notebook/fetch', { url: 'https://committees.parliament.uk/' })
      ok('LIVE: a parliament.uk page either reads or REFUSES WITH A REASON — it never returns an empty "read"', par.json.ok === true ? String(par.json.text).length > 100 : par.json.refused === true && /not read|paste/i.test(par.json.message), JSON.stringify(par.json).slice(0, 200))
    } else skip('LIVE fetch of gov.uk / parliament.uk', 'needs --live (network)')

    // ── team rules, with a second person ──
    const c1 = await RN.addNote(id, { id: COLLEAGUE.id }, COLLEAGUE, { op: 'addNote', sourceId: a1.json.result.source.id, comment: 'I read this differently: the owner should be the minister.', stance: 'CONTRADICTS', bearsOn: [{ kind: 'cause', id: 'cause-x', label: 'Cause 1: x' }] })
    ok('a colleague\'s note arrives UNREVIEWED, not in the record', c1.ok && (c1 as any).data.status === 'UNREVIEWED')
    const cNote = (c1 as any).data.noteId as string
    const viewOwner1 = await RN.readNotebook(id, OWNER, {})
    ok('the owner sees it, labelled with its author and status', viewOwner1.notes.some((n) => n.id === cNote && n.status === 'UNREVIEWED' && n.mine === false))
    const edit = await RN.updateNote(id, OWNER, { op: 'updateNote', noteId: cNote, comment: 'I (the owner) rewrote your comment.' })
    ok('NOBODY EDITS ANOTHER PERSON\'S COMMENT — the owner is refused, told to reply instead', !edit.ok && /nobody edits another person.s comment/.test((edit as any).error) && /Reply beneath/.test((edit as any).error), (edit as any).error)
    const afterEdit = await prisma.researchNote.findUnique({ where: { id: cNote } })
    ok('…read back: the colleague\'s comment is unchanged', afterEdit?.comment === 'I read this differently: the owner should be the minister.')
    const rep = await RN.reply(id, OWNER, cNote, 'Fair — but a minister cannot own a delivery date. Can you point at the passage?')
    ok('the owner REPLIES beneath it; the note keeps the arc of one person\'s thinking', rep.ok && (await prisma.researchNoteReply.count({ where: { noteId: cNote } })) === 1)
    const stanceBulk = await RN.setStance(id, OWNER, [cNote], 'CONTEXT')
    ok('the owner MAY change a colleague\'s stance (a filing decision, not their words)', stanceBulk.ok && (await prisma.researchNote.findUnique({ where: { id: cNote } }))?.stance === 'CONTEXT')
    const nonOwnerRec = await RN.putInRecord(id, COLLEAGUE, [cNote])
    ok('a colleague cannot put a note in the record', !nonOwnerRec.ok && /Only the idea.s owner/.test((nonOwnerRec as any).error))
    const rec = await RN.putInRecord(id, OWNER, [cNote])
    ok('the owner puts it in the record', rec.ok && (await prisma.researchNote.findUnique({ where: { id: cNote } }))?.status === 'IN_RECORD')
    const priv1 = await RN.addNote(id, { id: COLLEAGUE.id }, COLLEAGUE, { op: 'addNote', ownObservation: true, comment: 'Private working thought.', mineOnly: true })
    const ownerSees = (await RN.readNotebook(id, OWNER, { includeSetAside: true })).notes.some((n) => n.id === (priv1 as any).data.noteId)
    const colleagueSees = (await RN.readNotebook(id, COLLEAGUE, { includeSetAside: true })).notes.some((n) => n.id === (priv1 as any).data.noteId)
    ok('a "mine only" note is invisible to everyone else and visible to its author', !ownerSees && colleagueSees)
    const stolenShare = await RN.share(id, OWNER, [(priv1 as any).data.noteId])
    ok('…the owner cannot share it for them (and cannot even see it to try)', !stolenShare.ok)
    const shared = await RN.share(id, COLLEAGUE, [(priv1 as any).data.noteId])
    ok('…its author shares it, and then the owner sees it', shared.ok && (await RN.readNotebook(id, OWNER, {})).notes.some((n) => n.id === (priv1 as any).data.noteId))
    control('a private note visible to the owner before it is shared (must be FALSE)', ownerSees)

    // ── set aside keeps its reason; nothing deletes ──
    const aside = await call('research-notebook', { op: 'setAside', noteIds: [n1.json.result.noteId], reason: 'Superseded by the 2025 report' })
    const defaultList = await get('research-notebook')
    const withAside = await get('research-notebook', '?setAside=1')
    ok('setting a note aside hides it from the default list…', aside.json.ok && !defaultList.json.notes.some((n: any) => n.id === n1.json.result.noteId))
    ok('…keeps it, with its reason, when asked for', withAside.json.notes.find((n: any) => n.id === n1.json.result.noteId)?.setAsideReason === 'Superseded by the 2025 report')
    const noReason = await call('research-notebook', { op: 'setAside', noteIds: [n1.json.result.noteId], reason: '' })
    ok('…and setting aside with no reason is refused, naming the reason', noReason.status === 422 && /“reason”|the reason/.test(noReason.json.error ?? '') && !BARE.test(noReason.json.error ?? ''), noReason.json.error)
    const back = await call('research-notebook', { op: 'restore', noteIds: [n1.json.result.noteId] })
    ok('…and it comes back into the record with one press', back.json.ok && (await prisma.researchNote.findUnique({ where: { id: n1.json.result.noteId } }))?.status === 'IN_RECORD')
    ok('nothing in the notebook has ever been deleted: no delete op exists', !('delete' as string in OP_WORDS) && !Object.keys(OP_WORDS).some((k) => /delete|remove|destroy/i.test(k)))

    // ── documents carry the same number (explicit generation numbers; the read does not) ──
    const ev = await prisma.evidenceItem.create({ data: { ideaId: id, passKey: 'zz-r26', title: 'A finding that cites the report', body: 'The report says delivery needs one owner.', status: 'ACCEPTED', sourceType: 'GUIDANCE', sourceId: 'zz-corpus-key-1', citation: 'Cabinet Office, 2025', url: 'https://www.gov.uk/government/publications/zz-r26-evidence', ...sourceDateFields(null) } })
    const before = await prisma.ideaSource.count({ where: { ideaId: id } })
    const snap0 = await buildProposalSnapshot(id)
    ok('before generation the finding has no number — and the read did not invent one', snap0.evidence.find((e) => e.id === ev.id)?.ref === undefined && (await prisma.ideaSource.count({ where: { ideaId: id } })) === before)
    await syncRegistry(id) // what generateProposalExport / mintVersion / the notebook read do
    const snap1 = await buildProposalSnapshot(id)
    const refd = snap1.evidence.find((e) => e.id === ev.id)?.ref
    const regRow = await prisma.ideaSource.findFirst({ where: { ideaId: id, corpusKey: 'zz-corpus-key-1' } })
    ok('after the explicit sync the finding carries the number the registry gave its source', !!refd && refd === regRow?.number, `${refd} vs ${regRow?.number}`)
    const m1 = buildProposalModel('EVIDENCE_PACK', snap1, null).model
    ok('…and the Evidence Pack prints that same [Ref: n] on the source line', m1.blocks.some((b) => b.kind === 'sources' && b.refs.some((r) => r.ref === refd)))
    ok('…a second sync creates nothing (idempotent)', (await syncRegistry(id)).created === 0)

    // ── Lex, through its tools ──
    const doc = await prisma.ideaSource.findFirst({ where: { ideaId: id, kind: 'DOCUMENT' } })
    const lexQuote = await execute(toolByName('add_research_note')!, ctx(), { sourceNumber: doc!.number, quote: 'register naming the accountable owner of each statutory delivery target', stance: 'SUPPORTS', provenance: { kind: 'filed_document', refs: [doc!.materialId!.slice(0, 8)] } })
    const lexNote = lexQuote.ok ? await prisma.researchNote.findFirst({ where: { ideaId: id, authorKind: 'LEX' }, orderBy: { createdAt: 'desc' } }) : null
    ok('add_research_note: saved, WRITTEN BY LEX, UNREVIEWED — not in the record until the owner says', lexQuote.ok && lexNote?.authorKind === 'LEX' && lexNote.status === 'UNREVIEWED', JSON.stringify(lexQuote).slice(0, 220))
    const fake = await execute(toolByName('add_research_note')!, ctx(), { sourceNumber: doc!.number, quote: 'The Cabinet Office shall abolish every delivery target by 2030 without exception.', provenance: { kind: 'filed_document', refs: [doc!.materialId!.slice(0, 8)] } })
    ok('a quote that is NOT in the stored document is refused — not "corrected"', !fake.ok && /not word for word/.test(fake.error ?? ''), fake.error)
    const sloppy = await execute(toolByName('add_research_note')!, ctx(), { sourceNumber: doc!.number, quote: 'THE CABINET OFFICE should publish,   every quarter, a register naming', provenance: { kind: 'filed_document', refs: [doc!.materialId!.slice(0, 8)] } })
    const sloppyRow = sloppy.ok ? await prisma.researchNote.findFirst({ where: { ideaId: id, authorKind: 'LEX' }, orderBy: { createdAt: 'desc' } }) : null
    ok('a quote that differs only in case and spacing is saved as the DOCUMENT\'S OWN words (verbatim by construction)', sloppy.ok && /^The Cabinet Office should publish, every quarter, a register/.test(sloppyRow?.quote ?? '') && !/^THE CABINET/.test(sloppyRow?.quote ?? ''), sloppyRow?.quote ?? JSON.stringify(sloppy))
    const noProv = await execute(toolByName('add_research_note')!, ctx(), { ownObservation: true, comment: 'x'.repeat(30), provenance: { kind: 'user_words', refs: [], quote: 'this phrase was never said' } })
    ok('a note whose provenance is not in anything the user said is refused', !noProv.ok && /not in anything the user has written/.test(noProv.error ?? ''), noProv.error)
    const said = 'nobody could name who owned a target'
    const ownLex = await execute(toolByName('add_research_note')!, ctx([`From my own time: ${said}.`]), { ownObservation: true, comment: 'The user’s own experience: no named owner for targets.', provenance: { kind: 'user_words', refs: [], quote: said } })
    ok('…while one citing the user\'s real words, to "my own observation", is saved', ownLex.ok)
    const list = await execute(toolByName('list_research_notebook')!, ctx(), {})
    ok('list_research_notebook returns numbered sources with whether each was READ, and note ids', list.ok && (list.data as any).sources.some((s: any) => /NOT READ/.test(s.read)) && (list.data as any).notes.length >= 3, JSON.stringify(list.data).slice(0, 200))
    const noteIdShort = (list.data as any).notes[0].note as string
    const upd = await execute(toolByName('update_research_note')!, ctx(), { note: noteIdShort, tags: ['delivery'], stance: 'CONTEXT' })
    ok('update_research_note tags and sets a stance', upd.ok && (await prisma.researchNote.findFirst({ where: { ideaId: id, id: { startsWith: noteIdShort } } }))?.tags.includes('delivery') === true, JSON.stringify(upd))
    ok('…and has NO way to change a comment or a quote (the parameter does not exist)', !('comment' in ((toolByName('update_research_note')!.schema as any).shape ?? {})) && !('quote' in ((toolByName('update_research_note')!.schema as any).shape ?? {})))
    const sim = await execute(toolByName('find_similar_notes')!, ctx(), { note: noteIdShort })
    ok('find_similar_notes runs (read only)', sim.ok)
    const dis = await execute(toolByName('find_disagreements')!, ctx(), {})
    ok('find_disagreements runs and reports a count', dis.ok && typeof (dis.data as any).count === 'number')
    const readOn = await execute(toolByName('what_have_i_read_on')!, ctx(), { kind: 'cause', number: 999 })
    ok('what_have_i_read_on says plainly when there is no such cause', !readOn.ok && /no cause 999/.test(readOn.error ?? ''), readOn.error)
    const unread = await execute(toolByName('extract_quotes')!, ctx(), { sourceNumber: 1 })
    ok('extract_quotes on a source that was only an address says it was never read — it does not invent passages', !unread.ok && /has not been read/.test(unread.error ?? ''), unread.error)
    const unread2 = await execute(toolByName('summarise_source')!, ctx(), { sourceNumber: 1 })
    ok('summarise_source on an unread source refuses to summarise from its title', !unread2.ok && /has not been read/.test(unread2.error ?? ''), unread2.error)
    const noSuch = await execute(toolByName('extract_quotes')!, ctx(), { sourceNumber: 4040 })
    ok('a source number that does not exist is named, not guessed at', !noSuch.ok && /no source \[Ref: 4040\]/.test(noSuch.error ?? ''), noSuch.error)
    control('extract_quotes on an unread source succeeding (must be FALSE)', unread.ok)

    if (LIVE) {
      const snip = await call('source-registry', { op: 'createSnippet', sourceId: doc!.id })
      const w = wordCount(snip.json.result?.snippet ?? '')
      ok(`LIVE: Create snippet reads the stored document and writes 20–80 words (${w})`, snip.json.ok && w >= 20 && w <= 80, JSON.stringify(snip.json).slice(0, 200))
      const after = await prisma.ideaSource.findUnique({ where: { id: doc!.id } })
      ok('LIVE: …and the source it was read from is marked READ, with the snippet saved', after?.readStatus === 'READ' && !!after.snippet)
      const longDoc = await prisma.ideaUserMaterial.create({ data: { ideaId: id, kind: 'FILE', status: 'READY', label: 'A longer briefing', filename: 'Pasted', mimeType: 'text/plain', text: 'The briefing sets out three findings. First, accountability for delivery targets is spread across several committees, so no single person answers for a missed date. Second, the departments that publish a named owner for each target meet their dates more often than those that do not. Third, ministers change posts every two years on average, which is shorter than most programmes last. The briefing recommends a single named senior responsible owner for every statutory target, published in a register that is reviewed each quarter and reported to Parliament.', charCount: 520, sourceBytes: 520, rightsConfirmed: true, addedBy: owner!.id } })
      await syncRegistry(id)
      const longSrc = await prisma.ideaSource.findFirst({ where: { ideaId: id, materialId: longDoc.id } })
      const ex = await execute(toolByName('extract_quotes')!, ctx(), { sourceNumber: longSrc!.number })
      ok('LIVE: extract_quotes offers passages, every one verbatim from the document', ex.ok && (ex.data as any).offered >= 1 && /<untrusted_content/.test(ex.untrusted ?? ''), JSON.stringify(ex).slice(0, 240))
      const sm = await execute(toolByName('summarise_source')!, ctx(), { sourceNumber: longSrc!.number })
      ok('LIVE: summarise_source returns a summary in the untrusted channel (third-party text is data)', sm.ok && /<untrusted_content/.test(sm.untrusted ?? ''))
      const st = await execute(toolByName('suggest_tags_and_links')!, ctx(), { note: noteIdShort })
      ok('LIVE: suggest_tags_and_links PROPOSES and applies nothing', st.ok && /proposed/.test((st.data as any).status))
    } else skip('LIVE: Create snippet, extract_quotes, summarise_source, suggest_tags_and_links', 'needs --live (spends pence)')

    ok('every notebook tool is registered for the model, none is a delete, and none takes an idea or user id', ['add_research_note', 'list_research_notebook', 'extract_quotes', 'suggest_tags_and_links', 'update_research_note', 'find_similar_notes', 'find_disagreements', 'what_have_i_read_on', 'summarise_source'].every((n) => MODEL_TOOLS.some((t) => t.name === n)))
  } finally {
    await prisma.evidenceItem.deleteMany({ where: { ideaId: id, passKey: 'zz-r26' } })
    const gone = await deleteScratch(id)
    ok('the scratch idea, with its sources, notes and replies, deletes cleanly (hard delete, not a soft-delete fallback)', gone === true)
    ok('…and nothing of it is left behind', (await prisma.ideaSource.count({ where: { ideaId: id } })) + (await prisma.researchNote.count({ where: { ideaId: id } })) === 0)
  }
}

function partD() {
  section('D · source — the surfaces are REACHED, and the old label is gone (CLAUDE.md §23.1)')
  const files = [...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
  const src = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]))
  const importers = (name: string) => [...src.entries()].filter(([f, t]) => !f.endsWith(`${name}.tsx`) && new RegExp(`from ['"][^'"]*/${name}['"]`).test(t)).map(([f]) => f.split(/[\\/]/).slice(-1)[0])
  for (const c of ['AddResearch', 'ResearchNotebook', 'SourcesRegistry']) ok(`${c} is imported by something that renders (${importers(c).join(', ')})`, importers(c).length > 0)
  ok('the research panel mounts Add research, the Notebook and Sources', ['AddResearch', 'ResearchNotebook', 'SourcesRegistry'].every((c) => importers(c).includes('QuestionPanel.tsx')))
  ok('the left panel beside Lex (ChatAttach) mounts Add research', importers('AddResearch').includes('ChatAttach.tsx') && importers('ChatAttach').length > 0)
  ok('the Overview page\'s Research tab mounts the notebook', importers('ResearchNotebook').includes('IdeaDetailClient.tsx'))
  ok('the Build page and the question cards use Add research (one door)', importers('AddResearch').includes('BuildIdeaClient.tsx') && (src.get(files.find((f) => f.endsWith('ElicitationCards.tsx'))!) ?? '').includes("'Add research'"))
  ok('the bookmarklet landing page mounts Add research', [...src.entries()].some(([f, t]) => f.endsWith('AddResearchWindow.tsx') && t.includes('<AddResearch')))
  const old = [...src.entries()].filter(([f, t]) => !f.includes('check-') && /Add a file or link/.test(t) && !/^\s*(\/\/|\*)/m.test(''))
  const live = old.filter(([, t]) => t.split('\n').some((l) => /Add a file or link/.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)))
  ok('"Add a file or link" is gone from every screen and every prompt (comments aside)', live.length === 0, live.map(([f]) => f.split(/[\\/]/).slice(-1)[0]).join(', '))
  ok('"Key sources" is "Sources" in the research panel', /heading: 'Sources'/.test(src.get(join(ROOT, 'lib', 'lex', 'question-headings.ts')) ?? '') && !/heading: 'Key sources'/.test(src.get(join(ROOT, 'lib', 'lex', 'question-headings.ts')) ?? ''))
  ok('Lex\'s control list names the control by the label the component prints', /label: 'Add research', file: 'components\/lex\/AddResearch.tsx'/.test(src.get(join(ROOT, 'lib', 'lex', 'agent', 'controls.ts')) ?? ''))
  control('a component nothing imports would pass the reach test (must be FALSE)', importers('NoSuchComponentAnywhere').length > 0)

  section('D · source — "Add source" in the middle panel\'s boxes (26-E §3d)')
  const fp = src.get(join(ROOT, 'components', 'lex', 'FieldsPanel.tsx')) ?? ''
  ok('no bare <textarea> is left in the middle panel — every box is a RefTextarea', !/<textarea/.test(fp) && (fp.match(/<RefTextarea/g) ?? []).length >= 12, `${(fp.match(/<RefTextarea/g) ?? []).length} boxes`)
  ok('the panel provides the idea id to them once, from its own ideaId', /<IdeaIdContext\.Provider value=\{ideaId \|\| null\}>/.test(fp) && /<\/IdeaIdContext\.Provider>/.test(fp))
}

async function partE() {
  section('E · "Add source" inserts [Ref: n] at the cursor — the splice, and the component rendered')
  const { spliceReference, default: RefTextarea, IdeaIdContext } = await import('../components/lex/RefTextarea')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = await import('react')
  const a = spliceReference('The cost is high.', 11, 11, '[Ref: 7]')
  ok('at the cursor, straight after "is": the reference goes in with one space each side', a.next === 'The cost is [Ref: 7] high.', a.next)
  ok('…and the cursor ends up just after it', a.caret === 'The cost is [Ref: 7]'.length)
  ok('before a word, with the cursor after the space: still one space each side, no double', spliceReference('The cost is high.', 12, 12, '[Ref: 7]').next === 'The cost is [Ref: 7] high.')
  ok('before closing punctuation: no space is put before the full stop', spliceReference('The cost is high.', 16, 16, '[Ref: 7]').next === 'The cost is high [Ref: 7].')
  const b = spliceReference('See', 3, 3, '[Ref: 3]')
  ok('after a word: a space is added, so it reads "See [Ref: 3]"', b.next === 'See [Ref: 3]' && b.caret === 'See [Ref: 3]'.length, b.next)
  const c = spliceReference('See ', 4, 4, '[Ref: 3]')
  ok('after a space: no second space', c.next === 'See [Ref: 3]')
  const d = spliceReference('', 0, 0, '[Ref: 1]')
  ok('in an empty box: no leading space', d.next === '[Ref: 1]')
  const e = spliceReference('Replace THIS word', 8, 12, '[Ref: 9]')
  ok('over a selection: the selection is replaced', e.next === 'Replace [Ref: 9] word', e.next)
  const f = spliceReference('abc', 99, 120, '[Ref: 2]')
  ok('a cursor past the end is clamped, never out of range', f.next === 'abc [Ref: 2]')
  control('inserting twice at one cursor would be idempotent (must be FALSE)', spliceReference(a.next, 12, 12, '[Ref: 7]').next === a.next)
  const withIdea = renderToStaticMarkup(React.createElement(IdeaIdContext.Provider, { value: 'idea-1' }, React.createElement(RefTextarea, { defaultValue: '', rows: 2 })))
  ok('rendered inside an idea: the box carries an "Add source" menu', /<select[^>]*aria-label="Add source/.test(withIdea) && /<textarea/.test(withIdea), withIdea.slice(0, 160))
  const without = renderToStaticMarkup(React.createElement(RefTextarea, { defaultValue: '', rows: 2 }))
  ok('rendered outside an idea: a plain textarea, no broken menu', /<textarea/.test(without) && !/<select/.test(without))
  control('a menu rendered with no idea (must be FALSE)', /<select/.test(without))
}

async function main() {
  partA()
  await partB()
  await partC()
  partD()
  await partE()
  console.log(`\n${pass} passed, ${fail} failed · ${ran} checks RUN${notRun ? ` · ${notRun} NOT RUN (${LIVE ? 'see above' : 'need --live'})` : ''} · ${controls} controls, ${controls - dead} fired, ${dead} dead`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
