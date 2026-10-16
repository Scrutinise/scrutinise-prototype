// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-S, sprint 1 — the action import pass (§3), the policy review (§6), the heading/action definition (§5b), and the report-only §8c.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s.ts           (offline + DB reads, no model spend)
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s.ts --live    (+ the FULL RUN: SPENDS pence)
//   LEX_IMPORT_CHUNK_WORDS=900 …                                                                      (forces several chunks on the fixture)
//
//   A  pure       — chunking, the document's-own-words rule, the shaping of a model row, cross-chunk merge, uncovered passages, the
//                   counts and the confirm sentence, the request contract, the policy-review words, the §5b paragraph vs the BRIEF.
//   B  COLD READ  — Charlie's idea (452c5ade), PLAIN READS ONLY (CLAUDE.md §26): nothing of this sprint has touched it.
//   C  FULL RUN   — a scratch copy with the hand-made blueprint FILED as a numbered source; the real routes (stub auth) and library;
//                   every write read back; the scratch is deleted and its deletion checked.
//   D  source     — the new controls are reached from a route (§23.1), the old words are untouched, the tool is registered.
//
// Counts what RAN (§23.2). Every value assertion has a control that must stay false (§23/§25.5).
// ⚠ THE DOCUMENT IS A FIXTURE, NOT THE REAL OPENAI BLUEPRINT (scripts/fixtures/action-import-blueprint.ts says why). The four overlaps
//   the handover names are asserted as far as they exist on the idea: Clause 1≈#4, Clause 2≈#12/#27, Clause 10≈#22 are in the fixture;
//   "the Bill ≈ #20" is represented by Clause 3≈#28 and Register 3≈#13, Training 1≈#24, Training 5≈#5 — see the report.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImportReview } from '../components/lex/ActionImport'
import { prisma } from '../lib/prisma'
import * as I from '../lib/lex/action-import'
import * as T from '../lib/lex/action-import-types'
import { ActionImportBody, IMPORT_OP_WORDS, IMPORT_INPUT_WORDS } from '../lib/lex/action-import-schema'
import { PolicyReviewBody } from '../lib/lex/policy-review-schema'
import * as P from '../lib/lex/policy-review'
import * as RN from '../lib/lex/research-notes'
import { describeIssues } from '../lib/api-rejection'
import { execute, toolByName, MODEL_TOOLS, needsButton } from '../lib/lex/agent/tools'
import { RUN_PRICES, priceSentence } from '../lib/lex/agent/run-prices'
import { CONTROLS, allControlFiles } from '../lib/lex/agent/controls'
import { PRODUCT_FACTS } from '../lib/lex/product-facts'
import { stems, jaccard } from '../lib/lex/action-facets'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { buildBlueprint, ALL_ITEMS, PARTS, UNPLACEABLE, FIXTURE_TITLE, type FixtureItem } from './fixtures/action-import-blueprint'

const LIVE = process.argv.includes('--live')
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const BARE = /not valid|invalid request|bad request/i
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n') // Windows checkouts are CRLF; a multi-line pattern must not care
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next') continue
    const p = join(dir, f)
    statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p)
  }
  return out
}

// ── A · pure ─────────────────────────────────────────────────────────────────────────────────────────────────
function partA() {
  section('A · pure')
  const DOC = buildBlueprint()

  // chunking
  const chunks = I.planChunks(DOC, 500)
  ok('the document is split into several parts at a small size', chunks.length >= 3, `${chunks.length}`)
  ok('every part is a real span of the text, in order, and none overlaps the next', chunks.every((c, i) => c.to > c.from && c.to <= DOC.length && (i === 0 || c.from >= chunks[i - 1].to)))
  const joined = chunks.map((c) => DOC.slice(c.from, c.to)).join(' ')
  ok('nothing is lost between parts: every fixture provision is wholly inside ONE part', ALL_ITEMS.every((it) => chunks.some((c) => norm(DOC.slice(c.from, c.to)).includes(norm(it.text)))))
  ok('the parts together contain every word of the document', stems(joined).size >= stems(DOC).size - 2)
  const big = I.planChunks(DOC, 100000)
  ok('a large size gives one part', big.length === 1 && big[0].from === 0)
  control('a chunker that dropped the last paragraph would pass the "every provision" test (must be FALSE)', ALL_ITEMS.every((it) => I.planChunks(DOC.slice(0, DOC.length - 400), 500).some((c) => norm(DOC.slice(c.from, c.to)).includes(norm(it.text)))))

  // the document's own words
  const curly = 'She said “it shall be so” — and it was, in the Bill’s own words, set out here for the record of this proposal.'
  const found = I.findInDocument('she said "it shall be so" - and it was, in the Bill\'s own words, set out here', curly)
  ok('a quote is found even if quotes, dashes and case differ — and what comes back is the DOCUMENT’S characters', !!found && found.includes('“it shall be so”') && found.includes('’s'), String(found))
  ok('a quote that is not in the document is NOT found (Lex’s words are never presented as the document’s)', I.findInDocument('Every department shall abolish itself within a week of Royal Assent and never return', DOC) === null)
  control('a quote check that accepted anything would find an invented sentence (must be FALSE)', I.findInDocument('Every department shall abolish itself within a week of Royal Assent and never return', DOC) !== null)
  ok('a quote that runs on past the document’s text is cut back to the part that matches (>= 5 words)', (I.findInDocument(`${ALL_ITEMS[8].text.split(' ').slice(0, 9).join(' ')} and then some words the document never says here`, DOC) ?? '').split(' ').length >= 5)
  ok('the nearest sentence is found for a loose quote', !!I.nearestSentence('named owner who is personally and publicly accountable in law for delivery of every major project', DOC))
  ok('…and nothing is invented for a quote about something else', I.nearestSentence('the sea is wide and the weather is cold today in the north', DOC) === null)

  // shaping a model row
  const ctx = { chunkIndex: 0, chunkText: DOC, liveNumbers: new Set([4, 12, 22]), headingNames: ['Legislation'], refs: new Set(['causes:1', 'pivotalObstacle']) }
  const c1 = PARTS[0].items[0]
  const good = I.shapeItem({ section: 'Clause 1', quote: c1.text, proposal: 'ADDS_TO', actionNumber: 4, reason: 'same as #4', title: 'Name an owner for every major project', summary: 'One named person is accountable.' }, ctx)
  ok('a verbatim quote keeps its disposition and is marked verified', good.proposal === 'ADDS_TO' && good.quoteVerified && good.actionNumber === 4)
  ok(`a quote is cut to ${60} words at most (the first 60 of the document's own)`, T.wordCount(good.quote) <= 61 && good.quote.startsWith('Every major project'))
  const invented = I.shapeItem({ section: 'Clause 99', quote: 'The Board shall be abolished at midnight on the day it is created, by operation of law and without notice.', proposal: 'NEW', reason: 'x', title: 'Abolish the Board', summary: 's' }, ctx)
  ok('a quote that is not in the document is DEMOTED to "Could not place" and says in words that the wording is Lex’s', invented.proposal === 'UNPLACED' && !invented.quoteVerified && /Lex.s, not the document.s/.test(invented.reason), invented.reason)
  const wrongNum = I.shapeItem({ section: 'Clause 2', quote: PARTS[0].items[1].text, proposal: 'PART_OF', actionNumber: 99, reason: 'x', title: 't', summary: 's' }, ctx)
  ok('an action number that is not on the list is not trusted: the row becomes "Could not place" and says why', wrongNum.proposal === 'UNPLACED' && wrongNum.actionNumber === null && /#99/.test(wrongNum.reason), wrongNum.reason)
  const zero = I.shapeItem({ section: 'Clause 2', quote: PARTS[0].items[1].text, proposal: 'ADDS_TO', actionNumber: 0, reason: 'x', title: 't', summary: 's' }, ctx)
  ok('"action 0" (the model’s way of saying none) is read as none, not as an action', zero.proposal === 'UNPLACED' && /named none/.test(zero.reason), zero.reason)
  const notAct = I.shapeItem({ section: 'Background 1', quote: ALL_ITEMS[0].text, proposal: 'NOT_ACTION', reason: 'background', title: 't', summary: 's' }, ctx)
  ok('a NOT_ACTION row stays NOT_ACTION', notAct.proposal === 'NOT_ACTION')
  const longTitle = I.shapeItem({ section: 'Clause 4', quote: PARTS[0].items[3].text, proposal: 'NEW', reason: 'x', title: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen', summary: 's', headingName: 'legislation' }, ctx)
  ok('a title is cut to 12 words, and a heading is matched to the existing one’s exact name', T.wordCount(longTitle.title) <= 12 && longTitle.headingName === 'Legislation', `${longTitle.title} / ${longTitle.headingName}`)
  const pol = I.shapeItem({ section: 'Principles 1', quote: ALL_ITEMS[3].text, proposal: 'POLICY', reason: 'x', title: 't', summary: 's', policyCategory: 'CONTRADICTS', policyTarget: 'causes:1' }, ctx)
  const pol2 = I.shapeItem({ section: 'Principles 1', quote: ALL_ITEMS[3].text, proposal: 'POLICY', reason: 'x', title: 't', summary: 's', policyCategory: 'CONTRADICTS', policyTarget: 'causes:77' }, ctx)
  ok('a policy item keeps a real target and drops an invented one', pol.policyTarget === 'causes:1' && pol2.policyTarget === null)
  control('a shaper that trusted any action number would keep #99 (must be FALSE)', wrongNum.actionNumber === 99)

  // merge across chunks
  const mk = (id: string, chunk: number, o: Partial<T.ImportItem>): T.ImportItem => ({ id, chunk, section: `S${id}`, quote: 'q', quoteVerified: true, proposal: 'NEW', headingName: null, actionNumber: null, reason: '', policyTest: null, title: 'Publish the register of named owners every year', summary: 'A public register is kept.', implementer: null, policyCategory: null, policyTarget: null, struck: false, edited: false, ...o })
  const merged = I.mergeDuplicates([mk('a', 0, {}), mk('b', 1, { title: 'Publish the register of named owners each year', section: 'Sb' }), mk('c', 1, { title: 'Withhold Treasury funds from ownerless projects', summary: 'No money without an owner.', quote: 'zz' })])
  ok('the same item read in two parts becomes ONE row, noting where else it appeared', merged.items.length === 2 && merged.merged === 1 && /also Sb/.test(merged.items[0].section), JSON.stringify(merged.items.map((i) => i.section)))
  const same = I.mergeDuplicates([mk('a', 0, {}), mk('b', 0, {})])
  ok('two similar rows in the SAME part are not merged (only duplicates across parts are the merge’s job)', same.items.length === 2)
  control('a merge that collapsed everything would leave one row (must be FALSE)', I.mergeDuplicates([mk('a', 0, {}), mk('b', 1, { title: 'Pilot the regime in three departments first', summary: 'A phased start.', quote: 'yy' })]).items.length === 1)

  // uncovered passages: a count and a list, never rows
  const para = 'The Board shall publish every report within three months of completing an investigation and shall lay it before Parliament.'
  ok('a sentence that reads as a proposal and sits inside no row’s quote is listed as NOT COVERED', I.findUncovered(para, 'Part A', []).length === 1)
  ok('…and is not listed when a row’s quote covers it', I.findUncovered(para, 'Part A', [{ quote: 'The Board shall publish every report within three months of completing an investigation' }]).length === 0)
  ok('…and a description of the document itself is not mistaken for a proposal', I.findUncovered('It is written as a set of separable provisions so that each can be accepted, amended or rejected on its own.', 'Intro', []).length === 0)
  control('a coverage check that never listed anything would pass the "listed" test (must be FALSE)', I.findUncovered(para, 'Part A', []).length === 0)

  // counts + the confirm sentence + provenance
  const items = [mk('1', 0, {}), mk('2', 0, { proposal: 'NEW' }), mk('3', 0, { proposal: 'ADDS_TO', actionNumber: 4 }), mk('4', 0, { proposal: 'PART_OF', actionNumber: 4 }), mk('5', 0, { proposal: 'POLICY' }), mk('6', 0, { proposal: 'NEW', struck: true }), mk('7', 0, { proposal: 'NOT_ACTION' }), mk('8', 0, { proposal: 'UNPLACED' })]
  const cnt = T.countItems(items)
  ok('the tallies count the table AS EDITED: a struck row is not counted', cnt.newActions === 2 && cnt.addsTo === 1 && cnt.partOf === 1 && cnt.forPolicy === 1 && cnt.struck === 1 && cnt.notAction === 1 && cnt.unplaced === 1, JSON.stringify(cnt))
  ok('the confirm sentence says what will be written, in the brief’s words', T.confirmSentence(cnt) === 'Import 2 actions · add to 2 · send 1 to the policy', T.confirmSentence(cnt))
  ok('singular reads right', T.confirmSentence({ ...cnt, newActions: 1 }).startsWith('Import 1 action ·'))
  ok('provenance is "From: [Ref: n] §x.y"', T.provenanceLine(7, '§5.1') === 'From: [Ref: 7] §5.1')
  ok('what is appended to an existing action sits BESIDE its own text, labelled with the source', (() => { const own = 'Their own words.'; const after = own + I.appendedBlock({ summary: 's', title: 't', quote: 'the doc says', quoteVerified: true, section: '§2', proposal: 'ADDS_TO' }, 7); return after.startsWith(own) && /\[Ref: 7\] §2/.test(after) && /“the doc says”/.test(after) })())
  ok('a new row carries the document’s words and the source line', /From the document: “q” \(From: \[Ref: 3\] §1\)/.test(I.newActionBody({ summary: 's', title: 't', quote: 'q', quoteVerified: true, section: '§1' }, 3)))
  ok('…and says plainly when the wording is Lex’s, not the document’s', /Lex’s wording of the document \(not word for word\)/.test(I.newActionBody({ summary: 's', title: 't', quote: 'q', quoteVerified: false, section: '§1' }, 3)))

  // the contract
  const wrongKey = ActionImportBody.safeParse({ op: 'edit', passId: 'p', items: [{ itemId: 'i1', patch: { title: 't' } }], existing: [{ id: 'a', proposedHeading: 'x' }] })
  ok('an edit with the wrong key is refused, naming the input in words', !wrongKey.success && (() => { const m = describeIssues(wrongKey.error.issues, { action: IMPORT_OP_WORDS.edit, labels: IMPORT_INPUT_WORDS }).message; return m.includes('“existing.0.actionId”') && !BARE.test(m) && /Nothing was changed/.test(m) })())
  ok('a start with no document number is refused naming "the document’s number"', (() => { const r = ActionImportBody.safeParse({ op: 'start' }); return !r.success && describeIssues(r.error.issues, { action: IMPORT_OP_WORDS.start, labels: IMPORT_INPUT_WORDS }).message.includes('the document’s number') })())
  ok('the purpose paragraph limit is 120 words', T.PURPOSE_MAX_WORDS === 120)

  // §6 words
  ok('the header sentence: both', P.headerSentence({ proposals: 4, notes: 2 }) === '4 proposals and 2 of your notes bear on this policy', String(P.headerSentence({ proposals: 4, notes: 2 })))
  ok('…one of each', P.headerSentence({ proposals: 1, notes: 1 }) === '1 proposal and 1 of your note bear on this policy', String(P.headerSentence({ proposals: 1, notes: 1 })))
  ok('…only proposals', P.headerSentence({ proposals: 3, notes: 0 }) === '3 proposals bear on this policy')
  ok('…only notes', P.headerSentence({ proposals: 0, notes: 1 }) === '1 of your note bears on this policy')
  ok('…and nothing when nothing bears', P.headerSentence({ proposals: 0, notes: 0 }) === null)
  ok('a note bears on the policy iff its bears-on has a policy ref', P.bearsOnPolicy([{ kind: 'cause' }, { kind: 'policy' }]) && !P.bearsOnPolicy([{ kind: 'cause' }, { kind: 'action' }]))
  control('a bears-on check that matched any ref would count a cause note (must be FALSE)', P.bearsOnPolicy([{ kind: 'cause' }]))
  const noReason = PolicyReviewBody.safeParse({ op: 'dismiss', evidenceId: 'e' })
  ok('a dismissal sent with no reason is refused, naming "the reason"', !noReason.success)
  ok('the set-aside and dismissed prefixes differ (one enum, two meanings)', (P.SET_ASIDE_PREFIX as string) !== P.DISMISSED_PREFIX && P.SET_ASIDE_PREFIX.startsWith('Set aside'))
}

// ── RENDER — the table the user sees, read out of the rendered markup (§25) ─────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const noop = async () => {}
function renderReview(view: T.ImportPassView): string {
  return renderToStaticMarkup(createElement(ImportReview, { pass: view, counts: T.countItems(view.mapping.items), busy: false, editItem: noop, edit: noop, confirm: noop, discard: noop }))
}

function partRender() {
  section('A2 · RENDER — the review table, read from the rendered markup (a synthetic pass, no spend)')
  const DOC = buildBlueprint()
  const ctx = { chunkIndex: 0, chunkText: DOC, liveNumbers: new Set([4, 12]), headingNames: ['Legislation'], refs: new Set(['causes:1']) }
  const base = (o: Parameters<typeof I.shapeItem>[0]) => I.shapeItem(o, ctx)
  const rows: T.ImportItem[] = [
    { ...base({ section: 'Clause 1', quote: PARTS[0].items[0].text, proposal: 'ADDS_TO', actionNumber: 4, reason: 'same as #4', title: 'Name an owner for every major project', summary: 'One named person is accountable.' }), id: 'r1', policyTest: { verdict: 'CONFLICTS', reason: 'It applies a threshold the policy rules out.' } },
    { ...base({ section: 'Clause 4', quote: PARTS[0].items[3].text, proposal: 'NEW', headingName: 'The Accountability Bill', reason: 'new', title: 'Publish directions against advice', summary: 'Directions are published.' }), id: 'r2', policyTest: { verdict: 'FITS', reason: 'It serves the policy.' } },
    { ...base({ section: 'Clause 99', quote: 'The Board shall be abolished at midnight on the day it is created, by operation of law and without notice.', proposal: 'NEW', reason: 'x', title: 'Abolish the Board', summary: 's' }), id: 'r3' },
    { ...base({ section: 'Principles 1', quote: ALL_ITEMS[3].text, proposal: 'POLICY', reason: 'a principle', title: 'One named individual', summary: 'Attach it to a person.', policyCategory: 'SUPPORTS', policyTarget: 'causes:1' }), id: 'r4' },
    { ...base({ section: 'Clause 6', quote: PARTS[0].items[5].text, proposal: 'NEW', headingName: 'The Accountability Bill', reason: 'new', title: 'Protect those who report', summary: 'Disclosure is protected.' }), id: 'r5', struck: true, policyTest: { verdict: 'DOES_NOT_FIT', reason: 'Not about this policy.' } },
  ]
  const view = (items: T.ImportItem[], uncovered = 2): T.ImportPassView => ({
    id: 'p1', status: 'READY', sourceNumber: 7, chunkCount: 1, chunksDone: 1, spentPence: 21.4, failure: null, result: null, createdAt: '2026-10-15T00:00:00Z',
    mapping: { version: 1, sourceTitle: FIXTURE_TITLE, chunks: [], stage: 'DONE', items, existing: [{ actionId: 'a4', number: 4, label: 'Single Point Accountability', currentHeading: null, proposedHeading: 'The Accountability Bill' }], headings: [{ name: 'The Accountability Bill', colourKey: 'navy', purpose: 'This Bill puts the duty to deliver in statute.', isNew: true, struck: false }], uncovered: Array.from({ length: uncovered }, (_, i) => ({ section: 'Part A', text: `Uncovered sentence ${i} that shall be checked.` })), guidingPolicy: 'A policy.', policyTestNote: null, policyTestCursor: 5, model: I.IMPORT_MODEL },
  })
  const html = renderReview(view(rows))
  ok('RENDERED: each row’s quote is the DOCUMENT’S words, in the first column', rows.filter((r) => r.quoteVerified).every((r) => html.includes(esc(r.quote))))
  ok('RENDERED: the row Lex could not quote is labelled as Lex’s wording, in words', html.includes('Lex’s wording, not found word for word in the document.'))
  ok('RENDERED: …exactly once (only that row)', html.split('not found word for word in the document.').length === 2)
  ok('RENDERED: every disposition is offered, in the brief’s words', T.PROPOSAL_KINDS.every((k) => html.includes(esc(T.PROPOSAL_WORDS[k]))))
  ok('RENDERED: the policy-test verdicts are a shape AND a word (✗ Conflicts, ✓ Fits), with the reason', html.includes('✗</span> Conflicts') && html.includes('✓</span> Fits') && html.includes('It applies a threshold the policy rules out.'))
  ok('RENDERED: a conflict is boxed (a second cue beside the word)', /border-2 border-zinc-900[^"]*"><span aria-hidden="true">✗/.test(html) || /border-2 border-zinc-900 rounded px-1 inline-block"><span aria-hidden="true">✗/.test(html))
  ok('RENDERED: a struck row is shown struck and can be put back; the others can be left out', html.includes('Put it back') && html.includes('Leave this out'))
  ok('RENDERED: Lex’s title is an editable field holding Lex’s wording', html.includes('value="Publish directions against advice"') && html.includes('value="Name an owner for every major project"'))
  ok('RENDERED: the existing action’s proposed heading and the new heading with its purpose paragraph', html.includes('Single Point Accountability') && html.includes('This Bill puts the duty to deliver in statute.') && html.includes('new heading'))
  ok('RENDERED: the passages not covered are counted in words', html.includes('Passages not covered by any row (2)'))
  const counts = T.countItems(rows)
  ok('RENDERED: the one confirm says what it will do, from the table AS EDITED (the struck row is not counted)', html.includes(esc(`Confirm: ${T.confirmSentence(counts)}`)) && counts.newActions === 1, T.confirmSentence(counts))
  ok('RENDERED: …and says that yours is never overwritten and nothing on the policy changes until accepted', html.includes('never overwritten') && html.includes('nothing on the policy changes until you accept it'))
  ok('RENDERED: …and what reading it cost', html.includes('Reading the document cost 21.4p'))
  const verifiedOnly = renderReview(view(rows.filter((r) => r.quoteVerified)))
  control('a table of only verified rows would still carry the "Lex’s wording" label (must be FALSE)', verifiedOnly.includes('not found word for word in the document.'))
  control('a table with nothing uncovered would still say "Passages not covered" (must be FALSE)', renderReview(view(rows, 0)).includes('Passages not covered'))
  control('a screen that offered only some dispositions would pass the "every disposition" test (must be FALSE)', T.PROPOSAL_KINDS.every((k) => 'New action Adds to Part of'.includes(T.PROPOSAL_WORDS[k])))
}

// ── B · COLD READ ────────────────────────────────────────────────────────────────────────────────────────────
async function partB() {
  section('B · COLD READ — Charlie\'s idea 452c5ade, PLAIN READS ONLY')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('the cold read', 'idea 452c5ade is not in this database'); return }
  const [passes, imported, notesOnPolicy] = await Promise.all([
    prisma.actionImportPass.count({ where: { ideaId: idea.id } }),
    prisma.lexCoherentAction.count({ where: { ideaId: idea.id, policyTestFrom: { array_contains: [] } } }).catch(() => 0),
    prisma.researchNote.findMany({ where: { ideaId: idea.id }, select: { bearsOn: true, status: true } }),
  ])
  ok('no import pass has ever been run on Charlie’s idea (the building was done on scratch copies; he runs it on his own)', passes === 0, `${passes}`)
  void imported
  const actions = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id }, select: { policyTestFrom: true, practicalStep: true } })
  ok('none of his actions carries an import provenance line or an imported block', actions.every((a) => !JSON.stringify(a.policyTestFrom ?? '').includes('From: [Ref:') && !/imported \d{4}-\d{2}-\d{2}/.test(a.practicalStep)))
  const bearing = notesOnPolicy.filter((n) => Array.isArray(n.bearsOn) && (n.bearsOn as Array<{ kind?: string }>).some((b) => b.kind === 'policy'))
  console.log(`    notes on his idea that bear on the policy today: ${bearing.length} (his own first policy note is his to file — BRIEF_26S §6d)`)
  control('a count of notes bearing on the policy that counted every note would equal all of them (must be FALSE unless all do)', bearing.length === notesOnPolicy.length && notesOnPolicy.length > 0)
  const heads = await prisma.actionHeading.findMany({ where: { ideaId: idea.id }, select: { name: true, purpose: true } })
  ok('the new column exists and is empty on his headings (no purpose was written for him)', heads.every((h) => h.purpose === null))
}

// ── C · FULL RUN ─────────────────────────────────────────────────────────────────────────────────────────────
async function partC() {
  section('C · FULL RUN — a scratch copy, the hand-made blueprint filed as a numbered source, the real routes and library')
  if (!LIVE) { skip('the full run', 'needs --live (it spends pence on the models)'); return }
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 's26')
  const id = copy.id
  const DOC = buildBlueprint()
  const route = async (path: 'action-import' | 'policy-review', method: 'GET' | 'POST', body?: Record<string, unknown>, q = '') => {
    const mod = await import(`../app/api/ideas/[id]/${path}/route`)
    const req = new Request(`http://internal.invalid/${q}`, method === 'POST' ? { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { method })
    const res = await mod[method](req, { params: Promise.resolve({ id }) })
    return { status: res.status as number, json: (await res.json()) as any }
  }
  const OWNER: RN.Viewer = { id: owner!.id, isOwner: true }
  try {
    // ── file the document as a numbered source ──
    const added = await RN.addNote(id, { id: owner!.id }, OWNER, { op: 'addNote', newSource: { kind: 'DOCUMENT', title: FIXTURE_TITLE, fullText: DOC, rightsConfirmed: true, readStatus: 'READ' } } as never, { readIntoFindings: false })
    ok('the document is filed and numbered', added.ok, added.ok ? '' : (added as { error: string }).error)
    const ref = (added as { data: { ref: number } }).data.ref

    // a source that was only saved by address is refused, with the reason
    const unread = await RN.addNote(id, { id: owner!.id }, OWNER, { op: 'addNote', newSource: { kind: 'URL', title: 'A page that was only saved', url: 'https://www.gov.uk/government/publications/example', readStatus: 'NOT_READ' } } as never)
    const unreadRef = (unread as { data: { ref: number } }).data.ref
    const refused = await route('action-import', 'POST', { op: 'start', sourceNumber: unreadRef })
    ok('a source saved NOT READ is refused, with the reason, and nothing is started', refused.status === 422 && /saved but not read/.test(refused.json.error) && /Nothing was started/.test(refused.json.error), refused.json.error)
    ok('…no pass row was created for it', (await prisma.actionImportPass.count({ where: { ideaId: id } })) === 0)
    const none = await route('action-import', 'POST', { op: 'start', sourceNumber: 999 })
    ok('a number that is not a source is refused in words', none.status === 422 && /no source \[Ref: 999\]/.test(none.json.error), none.json.error)
    const importable = await route('action-import', 'GET', undefined, '?importable=1')
    ok('the button offers the document that was read, with its length and a measured price, and names the one that was not', importable.json.importable.sources.some((s: any) => s.number === ref && s.words > 1000 && s.estimatePence > 0 && /measured/.test(s.basis)) && importable.json.importable.notRead.some((n: any) => n.number === unreadRef))

    // the wrong key is refused through the real route (§30)
    const wrong = await route('action-import', 'POST', { op: 'edit', passId: 'x', items: [{ id: 'i1', patch: { title: 't' } }] })
    ok('the route refuses a request with the wrong key, naming the input in words', wrong.status === 422 && wrong.json.error.includes('the rows you changed') && !BARE.test(wrong.json.error), wrong.json.error)

    // before: the world the pass must leave alone until confirm
    const beforeActions = await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, orderBy: { number: 'asc' } })
    const beforeText = new Map(beforeActions.map((a) => [a.number, a.practicalStep]))
    const beforeFields = JSON.stringify(await prisma.ideaFieldState.findMany({ where: { ideaId: id }, orderBy: { fieldKey: 'asc' }, select: { fieldKey: true, status: true, value: true } }))
    const beforeHeads = await prisma.actionHeading.count({ where: { ideaId: id } })
    const beforeFindings = await prisma.evidenceItem.count({ where: { ideaId: id, passKey: 'MATERIAL_UPDATE' } })
    const maxOrder = Math.max(...beforeActions.map((a) => a.orderIndex))
    const chosenBefore = (await prisma.policyOption.findFirst({ where: { ideaId: id, status: 'CHOSEN' }, select: { id: true, approach: true } }))

    // ── start → advance → READY ──
    const started = await route('action-import', 'POST', { op: 'start', sourceNumber: ref })
    ok('start creates a pass and says how many parts it will read', started.status === 200 && started.json.result.status === 'MAPPING' && started.json.result.chunkCount >= 1, JSON.stringify(started.json).slice(0, 200))
    const passId = started.json.result.id as string
    const second = await route('action-import', 'POST', { op: 'start', sourceNumber: ref })
    ok('starting again while one is open RESUMES it (no second spend)', second.status === 200 && second.json.result.id === passId)
    let view = started.json.result as T.ImportPassView
    for (let i = 0; i < 40 && view.status === 'MAPPING'; i++) {
      const r = await route('action-import', 'POST', { op: 'advance', passId })
      if (r.status !== 200) { ok(`advance ${i + 1} succeeded`, false, r.json.error); break }
      view = r.json.result
    }
    ok('the pass reaches READY', view.status === 'READY', `${view.status} ${view.failure ?? ''}`)
    const m = view.mapping
    console.log(`    parts ${view.chunkCount} · rows ${m.items.length} · spent ${view.spentPence?.toFixed(1)}p · uncovered ${m.uncovered.length} · headings ${m.headings.length}`)
    ok('the pass wrote its cost down (>0p) and the ledger agrees with it', (view.spentPence ?? 0) > 0)
    const ledger = await prisma.llmSpend.findMany({ where: { ideaId: id, pass: { startsWith: 'action-import' } }, select: { estCostPence: true, failed: true } })
    const sum = ledger.reduce((a, l) => a + Number(l.estCostPence ?? 0), 0)
    ok('…within a penny of the ledger rows written for the idea', Math.abs(sum - (view.spentPence ?? 0)) < 1, `${sum.toFixed(2)} vs ${view.spentPence}`)

    // 1 · one row per fixture item
    const docNorm = norm(DOC)
    const rowFor = (f: FixtureItem) => m.items.filter((r) => { const q = norm(r.quote.replace(/…$/, '')); return q.length >= 12 && norm(f.text).includes(q) })
    const proposals = ALL_ITEMS.filter((f) => ['NEW', 'ADDS_TO', 'POLICY'].includes(f.expect.kind))
    const missing = proposals.filter((f) => rowFor(f).length === 0)
    ok(`every provision in the fixture has a row in the table (${proposals.length - missing.length} of ${proposals.length})`, missing.length === 0, missing.map((f) => f.section).join(', '))
    const unplaceNames = new Set(UNPLACEABLE.map((u) => u.text))
    const extraUnplaced = m.items.filter((r) => r.proposal === 'UNPLACED' && !UNPLACEABLE.some((u) => norm(u.text).includes(norm(r.quote.replace(/…$/, '')).slice(0, 40)) && r.quote.length > 10))
    ok('"Could not place" rows exist only where the fixture says', extraUnplaced.length === 0, extraUnplaced.map((r) => `${r.section}: ${r.reason.slice(0, 80)}`).join(' | '))
    void unplaceNames
    const unplacedFixtureHandled = UNPLACEABLE.every((u) => m.items.some((r) => ['UNPLACED', 'NOT_ACTION'].includes(r.proposal) && norm(u.text).includes(norm(r.quote.replace(/…$/, '')).slice(0, 30))))
    ok('the fixture’s two unplaceable fragments are in the table as Could-not-place or Not-an-action — never dropped', unplacedFixtureHandled)
    // 2 · the overlaps are not new
    const overlaps = ALL_ITEMS.filter((f) => f.expect.kind === 'ADDS_TO')
    for (const f of overlaps) {
      const rows = rowFor(f)
      const wanted = (f.expect as { actions: number[] }).actions
      ok(`${f.section} overlaps #${wanted.join('/#')}: not proposed as new — proposed as adding to one of them`, rows.length > 0 && rows.every((r) => (r.proposal === 'ADDS_TO' || r.proposal === 'PART_OF') && wanted.includes(r.actionNumber ?? -1)), rows.map((r) => `${r.proposal}#${r.actionNumber}`).join(','))
    }
    control('a pass that proposed every item as new would fail the overlap test (must be FALSE)', overlaps.every((f) => rowFor(f).every((r) => r.proposal === 'NEW')) && overlaps.length > 0)
    // 3 · the quotes are the document's
    ok('every quote shown is a span the stored document really contains (word for word, 60 words at most)', m.items.every((r) => !r.quoteVerified || (docNorm.includes(norm(r.quote.replace(/…$/, ''))) && T.wordCount(r.quote) <= 61)), m.items.filter((r) => r.quoteVerified && !docNorm.includes(norm(r.quote.replace(/…$/, '')))).map((r) => r.id).join())
    ok('every row says where it is in the document', m.items.every((r) => r.section.trim().length > 0))
    control('a fabricated quote would be caught by the same test (must be FALSE)', docNorm.includes(norm('The Board shall be abolished at midnight on the day it is created')))
    // 4 · the policy test ran, in the same words as the consolidation's
    const acting = m.items.filter((r) => ['NEW', 'ADDS_TO', 'PART_OF'].includes(r.proposal))
    ok('every row that would become an action carries a policy test with a one-line reason', acting.every((r) => r.policyTest && ['FITS', 'DOES_NOT_FIT', 'CONFLICTS', 'NOT_TESTED'].includes(r.policyTest.verdict) && (r.policyTest.reason.length > 3)), acting.filter((r) => !r.policyTest).map((r) => r.id).join())
    ok('…and the test ran against the idea’s accepted Guiding Policy (it says so, or says there is none)', !!m.guidingPolicy === !!chosenBefore)
    // 5 · headings + existing
    ok('every proposed new heading has a purpose paragraph of at most 120 words', m.headings.filter((h) => h.isNew).every((h) => h.purpose.trim().length > 20 && T.wordCount(h.purpose) <= 120), m.headings.map((h) => `${h.name}:${T.wordCount(h.purpose)}`).join(' | '))
    ok('every one of the idea’s live actions is in the "existing actions → heading" table', m.existing.length === beforeActions.filter((a) => a.status === 'LIVE').length)
    ok('the Item column and the model’s wording are different things: rows keep Lex’s title/summary apart from the quote', m.items.filter((r) => r.proposal === 'NEW').every((r) => r.title.trim().length > 0 && r.summary.trim().length > 0))

    // ── the table the user sees, from the REAL rows ──
    const realHtml = renderReview(view)
    ok(`RENDERED from the real rows: every one of the ${m.items.length} rows’ quotes is in the table, word for word`, m.items.filter((r) => r.quoteVerified).every((r) => realHtml.includes(esc(r.quote))), m.items.filter((r) => r.quoteVerified && !realHtml.includes(esc(r.quote))).map((r) => r.id).join())
    ok('RENDERED from the real rows: the confirm sentence is the table’s tally', realHtml.includes(esc(T.confirmSentence(T.countItems(m.items)))))
    ok('RENDERED from the real rows: every row’s Lex title is in the table as an editable value', m.items.filter((r) => ['NEW', 'ADDS_TO', 'PART_OF', 'POLICY'].includes(r.proposal)).every((r) => realHtml.includes(`value="${esc(r.title)}"`)))

    // ── NOTHING IS WRITTEN BEFORE THE CONFIRM ──
    const midActions = await prisma.lexCoherentAction.findMany({ where: { ideaId: id } })
    ok('before the confirm: the actions list is exactly as it was (same rows, same text)', midActions.length === beforeActions.length && midActions.every((a) => beforeText.get(a.number) === a.practicalStep))
    ok('…no heading was created', (await prisma.actionHeading.count({ where: { ideaId: id } })) === beforeHeads)
    ok('…no finding reached the policy review', (await prisma.evidenceItem.count({ where: { ideaId: id, passKey: 'MATERIAL_UPDATE' } })) === beforeFindings)
    ok('…and none of the idea’s fields (including the Guiding Policy) moved', JSON.stringify(await prisma.ideaFieldState.findMany({ where: { ideaId: id }, orderBy: { fieldKey: 'asc' }, select: { fieldKey: true, status: true, value: true } })) === beforeFields)

    // ── EDIT: a title, a heading, a disposition, a struck row ──
    const target = m.items.find((r) => r.proposal === 'NEW' && r.headingName)!
    const toStrike = m.items.filter((r) => r.proposal === 'NEW' && r.id !== target.id)[0]
    const toMove = m.items.filter((r) => r.proposal === 'NEW' && r.id !== target.id && r.id !== toStrike.id)[0]
    const e1 = await route('action-import', 'POST', { op: 'edit', passId, items: [
      { itemId: target.id, patch: { title: 'My own title for this provision' } },
      { itemId: toStrike.id, patch: { struck: true } },
      { itemId: toMove.id, patch: { proposal: 'NOT_ACTION' } },
    ] })
    ok('an edit is saved: a title, a struck row and a changed disposition', e1.status === 200 && e1.json.result.mapping.items.find((r: any) => r.id === target.id).title === 'My own title for this provision' && e1.json.result.mapping.items.find((r: any) => r.id === toStrike.id).struck === true && e1.json.result.mapping.items.find((r: any) => r.id === toMove.id).proposal === 'NOT_ACTION')
    ok('…and an edited row says so', e1.json.result.mapping.items.find((r: any) => r.id === target.id).edited === true)
    const badNum = await route('action-import', 'POST', { op: 'edit', passId, items: [{ itemId: toMove.id, patch: { actionNumber: 987 } }] })
    ok('an action number that is not on the list is refused in words, and nothing changes', badNum.status === 422 && /action #987/.test(badNum.json.error) && /Nothing was changed/.test(badNum.json.error), badNum.json.error)
    const longPurpose = await route('action-import', 'POST', { op: 'edit', passId, headings: [{ name: m.headings[0].name, purpose: Array.from({ length: 130 }, (_, i) => `w${i}`).join(' ') }] })
    ok('a purpose paragraph over 120 words is refused in words', longPurpose.status === 422 && /130 words/.test(longPurpose.json.error), longPurpose.json.error)
    const view2 = (await route('action-import', 'GET')).json.pass as T.ImportPassView
    ok('the edits survive a fresh read of the pass (reading it back through the route)', view2.mapping.items.find((r) => r.id === target.id)!.title === 'My own title for this provision')

    // ── CONFIRM ──
    const finalItems = view2.mapping.items
    const expectNew = finalItems.filter((r) => !r.struck && r.proposal === 'NEW')
    const expectAdd = finalItems.filter((r) => !r.struck && (r.proposal === 'ADDS_TO' || r.proposal === 'PART_OF'))
    const expectPolicy = finalItems.filter((r) => !r.struck && r.proposal === 'POLICY')
    const cnt = T.countItems(finalItems)
    console.log(`    confirm: ${T.confirmSentence(cnt)}`)
    const conf = await route('action-import', 'POST', { op: 'confirm', passId })
    ok('the confirm succeeds', conf.status === 200 && conf.json.ok, JSON.stringify(conf.json).slice(0, 300))
    const result = conf.json.result as T.ImportResult
    const after = await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, orderBy: { number: 'asc' } })
    const created = after.filter((a) => !beforeText.has(a.number))
    ok(`exactly the rows marked new were written (${expectNew.length}); the struck and the moved ones were not`, created.length === expectNew.length && result.created.length === expectNew.length, `${created.length} vs ${expectNew.length}`)
    ok('every new row carries "From: [Ref: n] §x.y", a verdict, and its reason', created.every((a) => Array.isArray(a.policyTestFrom) && /^From: \[Ref: \d+\] \S/.test(String((a.policyTestFrom as string[])[0])) && !!a.policyTestVerdict && !!a.policyTestReason))
    ok('…the provenance names THIS document’s number', created.every((a) => String((a.policyTestFrom as string[])[0]).includes(`[Ref: ${ref}]`)))
    ok('…the document’s words and Lex’s title are both on the row, the quote labelled as the document’s', created.every((a) => /From the document: “/.test(a.practicalStep) && (a.title ?? '').trim().length > 0))
    ok('…every one landed after the previous last row (orderIndex past the old maximum)', created.every((a) => a.orderIndex > maxOrder))
    ok('…every one with a heading in the table has that heading assigned', created.every((a) => { const row = expectNew.find((r) => r.title === a.title); return !row?.headingName || a.headingId !== null }))
    ok('…and none is confirmed: still LIVE candidates, and "These are my actions" (the field) untouched', created.every((a) => a.status === 'LIVE') && JSON.stringify(await prisma.ideaFieldState.findMany({ where: { ideaId: id }, orderBy: { fieldKey: 'asc' }, select: { fieldKey: true, status: true, value: true } })) === beforeFields)
    ok('the struck row was NOT written', !after.some((a) => a.title === toStrike.title && !beforeText.has(a.number)))
    ok('the user’s title survived the confirm', after.some((a) => a.title === 'My own title for this provision'))
    // adds-to: byte-identical prefix
    const touched = new Set(expectAdd.map((r) => r.actionNumber!))
    const prefixOk = after.filter((a) => beforeText.has(a.number)).every((a) => { const b = beforeText.get(a.number)!; return touched.has(a.number) ? a.practicalStep.startsWith(b) && a.practicalStep.length > b.length && a.practicalStep.includes(`[Ref: ${ref}]`) : a.practicalStep === b })
    ok('"Adds to" left the user’s own text byte-identical (the imported text sits after it, labelled), and an untouched action is unchanged', prefixOk)
    control('an action whose text had been overwritten would pass the prefix test (must be FALSE)', 'Something else entirely, written over the top.'.startsWith([...beforeText.values()].find((t) => t.length > 20)!))
    // policy items
    const findings = await prisma.evidenceItem.findMany({ where: { ideaId: id, passKey: 'MATERIAL_UPDATE' } })
    ok(`the ${expectPolicy.length} "for the policy" rows are findings in the policy review, PROPOSED`, findings.length === beforeFindings + expectPolicy.length && findings.filter((f) => f.status === 'PROPOSED').length === expectPolicy.length)
    ok('…in the 26-K categories, and none touched the sort or the policy itself', findings.every((f) => ['SUPPORTS', 'CONTRADICTS', 'NEW_CAUSE', 'NEW_POLICY_OPTION'].includes(f.kind)) && (await prisma.policyOption.findFirst({ where: { ideaId: id, status: 'CHOSEN' }, select: { id: true, approach: true } }))?.approach === chosenBefore?.approach)
    ok('…and a proposed new approach did NOT enter the sort (it waits to be accepted)', findings.filter((f) => f.kind === 'NEW_POLICY_OPTION').every((f) => f.status === 'PROPOSED' && f.fieldRef === null))
    // headings + audit
    ok('the new headings exist, each with its purpose paragraph', (await prisma.actionHeading.findMany({ where: { ideaId: id } })).filter((h) => result.headingsCreated.includes(h.name)).every((h) => (h.purpose ?? '').length > 20))
    const logged = await prisma.lexToolCall.findFirst({ where: { ideaId: id, tool: 'import_actions_from_source' } })
    ok('the import is in Privacy Log & Lex activity (who, when, what came of it)', !!logged && logged.ok && logged.actor === 'Lex' && logged.confirmedVia === 'button' && /Imported \d+ new action/.test(String((logged.result as { summary?: string } | null)?.summary ?? '')), JSON.stringify(logged?.result))
    const again = await route('action-import', 'POST', { op: 'confirm', passId })
    ok('a second confirm is refused and writes nothing more', again.status === 422 && (await prisma.lexCoherentAction.count({ where: { ideaId: id } })) === after.length, again.json.error)
    const done = (await route('action-import', 'GET')).json
    ok('after the confirm there is no open pass to resume', done.pass === null || done.pass.status === 'CONFIRMED' || done.pass.status === undefined)

    // ── the policy review ──
    section('C2 · the policy review on the same scratch idea')
    const rv0 = (await route('policy-review', 'GET')).json
    ok(`the header counts the proposals from the import (${expectPolicy.length}) and says so in the brief’s words`, rv0.counts.proposals === expectPolicy.length && new RegExp(`^${expectPolicy.length} proposals? (and \\d+ of your notes? )?bears? on this policy|^${expectPolicy.length} proposals? bears? on this policy`).test(rv0.sentence ?? ''), rv0.sentence)
    ok('contradicts comes first in the list', rv0.findings.every((f: any, i: number, a: any[]) => i === 0 || !(a[i - 1].kind !== 'CONTRADICTS' && f.kind === 'CONTRADICTS')))
    const noted = await RN.addNote(id, { id: owner!.id }, OWNER, { op: 'addNote', ownObservation: true, comment: 'Accountability has two interests behind it: the taxpayer’s and the beneficiary’s.', bearsOn: [(await RN.bearsOnOptions(id)).find((o) => o.kind === 'policy')!] } as never)
    const noteId = (noted as { data: { noteId: string } }).data.noteId
    const rv1 = (await route('policy-review', 'GET')).json
    ok('a note whose bears-on is the policy joins the count: the number equals findings + notes', rv1.counts.proposals === expectPolicy.length && rv1.counts.notes === 1 && rv1.counts.proposals + rv1.counts.notes === rv1.findings.length + rv1.notes.length, JSON.stringify(rv1.counts))
    ok('…and the sentence now names both', /^3 proposals and 1 of your note bear on this policy$/.test(rv1.sentence ?? ''), rv1.sentence)
    const f0 = rv1.findings[0]
    const noReasonDismiss = await route('policy-review', 'POST', { op: 'dismiss', evidenceId: f0.id, reason: '' })
    ok('dismissing a proposal with no reason is refused, in words, and nothing changes', noReasonDismiss.status === 422 && /needs a reason/.test(noReasonDismiss.json.error) && (await route('policy-review', 'GET')).json.counts.proposals === expectPolicy.length, noReasonDismiss.json.error)
    const noReasonAside = await route('policy-review', 'POST', { op: 'setAside', evidenceId: f0.id, reason: 'x' })
    ok('setting a proposal aside with no real reason is refused too', noReasonAside.status === 422 && /needs a reason/.test(noReasonAside.json.error), noReasonAside.json.error)
    const noteNoReason = await route('policy-review', 'POST', { op: 'noteSetAside', noteId, reason: '' })
    ok('setting a note aside with no reason is refused', noteNoReason.status === 422 && /needs a reason/.test(noteNoReason.json.error))
    const aside = await route('policy-review', 'POST', { op: 'setAside', evidenceId: f0.id, reason: 'Right in principle, but not what this idea is about.' })
    ok('a proposal set aside with a reason leaves the default list (the count falls by one)', aside.status === 200 && aside.json.review.counts.proposals === expectPolicy.length - 1 && !aside.json.review.findings.some((f: any) => f.id === f0.id))
    ok('…keeps its reason, and is listed under "considered, not taken"', aside.json.review.setAside.findings.some((f: any) => f.id === f0.id && /not what this idea is about/.test(f.reason)))
    const nbk = await RN.readNotebook(id, OWNER, { includeLex: true })
    ok('…and in the notebook it reads as considered, not taken — with the reason', nbk.notes.some((n) => n.lex && n.status === 'SET_ASIDE' && /considered, not taken/.test(n.setAsideReason ?? '')) || nbk.setAsideCount >= 0 && (await RN.readNotebook(id, OWNER, { includeLex: true, includeSetAside: true })).notes.some((n) => n.lex && /considered, not taken — Right in principle/.test(n.setAsideReason ?? '')))
    const back = await route('policy-review', 'POST', { op: 'restore', evidenceId: f0.id })
    ok('a set-aside proposal comes back', back.status === 200 && back.json.review.counts.proposals === expectPolicy.length && back.json.review.setAside.findings.length === 0)
    const dis = await route('policy-review', 'POST', { op: 'dismiss', evidenceId: f0.id, reason: 'The document is wrong about this.' })
    ok('a dismissed proposal keeps its reason on the row', dis.status === 200 && ((await prisma.evidenceItem.findUnique({ where: { id: f0.id } }))?.note ?? '').startsWith(P.DISMISSED_PREFIX))
    ok('…and a dismissed proposal is NOT offered back under "considered, not taken" (the two are different)', dis.json.review.setAside.findings.length === 0)
    const nAside = await route('policy-review', 'POST', { op: 'noteSetAside', noteId, reason: 'Parked until the Deepening.' })
    ok('a note set aside is hidden from the default list…', nAside.status === 200 && nAside.json.review.counts.notes === 0 && !nAside.json.review.notes.some((n: any) => n.id === noteId))
    ok('…keeps its reason…', nAside.json.review.setAside.notes.some((n: any) => n.id === noteId && /Parked until the Deepening/.test(n.setAsideReason)))
    const nBack = await route('policy-review', 'POST', { op: 'noteRestore', noteId })
    ok('…and comes back', nBack.status === 200 && nBack.json.review.counts.notes === 1)
    const nNot = await route('policy-review', 'POST', { op: 'noteNotOnPolicy', noteId, reason: 'It is about the taxpayer, not this policy.' })
    ok('"does not bear on the policy" takes the link off, keeps the note, and leaves the reason as a reply beneath it', nNot.status === 200 && nNot.json.review.counts.notes === 0 && !!(await prisma.researchNote.findUnique({ where: { id: noteId } })) && (await prisma.researchNoteReply.count({ where: { noteId, text: { startsWith: 'Does not bear on the policy:' } } })) === 1)
    const accept = await route('policy-review', 'POST', { op: 'accept', evidenceId: rv1.findings.find((f: any) => f.id !== f0.id)?.id ?? f0.id })
    ok('accepting a proposal goes through the existing judgement (and the count falls)', accept.status === 200 && accept.json.review.counts.proposals < expectPolicy.length, accept.json.error)

    // ── the Lex tool ──
    section('C3 · the Lex tool (asks first, then only STARTS the pass)')
    const tool = toolByName('import_actions_from_source')!
    const ctx = (confirmed: boolean) => ({ ideaId: id, userId: owner!.id, confirmed, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: ['import the document'], pastedText: null } })
    const pending = await execute(tool, ctx(false), { sourceNumber: ref })
    ok('without the button it does NOT run: it returns a signed confirm card with the price and says nothing was started', !pending.ok && !!pending.pending?.token && /Nothing is added to your list until you confirm/.test(pending.pending?.summary ?? '') && (pending.pending?.pence ?? 0) > 0, JSON.stringify(pending.pending))
    ok('…and no pass exists yet', (await prisma.actionImportPass.count({ where: { ideaId: id, status: 'MAPPING' } })) === 0)
    const ran = await execute(tool, ctx(true), { sourceNumber: ref })
    ok('confirmed, it starts the pass and tells the user to review the table (it adds nothing)', ran.ok && (ran.data as { started?: boolean }).started === true && /Nothing has been added/.test((ran.data as { next?: string }).next ?? '') && (await prisma.lexCoherentAction.count({ where: { ideaId: id } })) === after.length, JSON.stringify(ran).slice(0, 300))
    const openId = (await prisma.actionImportPass.findFirst({ where: { ideaId: id, status: 'MAPPING' } }))?.id
    ok('…a MAPPING pass now exists for the screen to pick up', !!openId)
    if (openId) await route('action-import', 'POST', { op: 'discard', passId: openId })
    ok('a pass can be discarded without anything being written', (await prisma.actionImportPass.findUnique({ where: { id: openId } }))?.status === 'DISCARDED')
  } finally {
    const gone = await deleteScratch(id)
    ok('the scratch idea, with its pass, sources, notes and findings, deletes cleanly (hard delete)', gone === true)
  }
}

// ── D · source ───────────────────────────────────────────────────────────────────────────────────────────────
function partD() {
  section('D · source — the controls are reached, the words are the brief’s')
  const files = walk(ROOT).filter((f) => !f.includes('scripts'))
  const importers = (name: string) => files.filter((f) => new RegExp(`from '(@/components/lex/|\\./)${name}'`).test(readFileSync(f, 'utf8')))
  ok('ActionImport has an importer that reaches a route (FieldsPanel), so the button can be seen (§23.1)', importers('ActionImport').length > 0 && importers('FieldsPanel').length > 0, importers('ActionImport').join())
  ok('PolicyReviewBar is imported by the Guiding Policy screen, which is imported', importers('PolicyReviewBar').length > 0 && importers('GuidingPolicyScreen').length > 0)
  ok('the button’s label is on the screen and in the controls Lex may name', read('components/lex/ActionImport.tsx').includes('Import actions from a document') && CONTROLS.some((c) => c.label === 'Import actions from a document') && allControlFiles().some((c) => c.label === 'Import actions from a document' && read(c.file).includes(c.label)))
  ok('the tool is registered to the model, asks first, and has a measured price', MODEL_TOOLS.some((t) => t.name === 'import_actions_from_source') && needsButton(toolByName('import_actions_from_source')!) && !!RUN_PRICES.import_actions.measured)
  ok('…and the price sentence says per 1,000 words, as measured', /per 1,000 words/.test(priceSentence('import_actions')) && /measured/.test(priceSentence('import_actions')), priceSentence('import_actions'))
  control('a tool missing from the registry would pass the "registered" test (must be FALSE)', MODEL_TOOLS.some((t) => t.name === 'import_actions_from_source_NOT'))
  // §5b verbatim
  const brief = read('../docs/BRIEF_26S.md')
  const sec = brief.slice(brief.indexOf('**5b. Definitions.**'), brief.indexOf('**5c.'))
  const quote = sec.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const fp = read('components/lex/FieldsPanel.tsx')
  const constSrc = fp.slice(fp.indexOf('export const HEADING_VS_ACTION_PARAGRAPH'), fp.indexOf('function StatusDot('))
  const arr = new Function(`return ${constSrc.slice(constSrc.indexOf('= [') + 2).trim()}`)() as Array<string | { strong: string }>
  const printed = arr.map((x) => (typeof x === 'string' ? x : x.strong)).join('').replace(/\s+/g, ' ').trim()
  ok('the heading-vs-action paragraph is the brief’s §5b, character for character', printed === quote, `\n      screen: ${printed}\n      brief:  ${quote}`)
  ok('…and it is rendered in the Coherent Actions introduction box', fp.indexOf('HEADING_VS_ACTION_PARAGRAPH.map') > fp.indexOf('COHERENT_ACTIONS_INTRO.map') && fp.indexOf('HEADING_VS_ACTION_PARAGRAPH.map') < fp.indexOf('<ActionGapCheck'))
  control('a screen that said "tool" where the brief says "instrument" would pass the comparison (must be FALSE)', printed === quote.replace('instrument', 'tool'))
  const faq = PRODUCT_FACTS.find((f) => f.question === 'What is the difference between a heading and an action?')
  ok('the FAQ has the question, the same text, and the example (a Bill is a heading; each clause is an action)', !!faq && faq.answer.includes('A heading is an instrument') && faq.answer.includes('An action is a provision') && /a Bill is a heading; each clause in it is an action/.test(faq.answer))
  ok('the intro the 26-N check guards is untouched: still exactly three paragraphs, and nothing of mine sits between it and Tick()', (fp.slice(fp.indexOf('export const COHERENT_ACTIONS_INTRO'), fp.indexOf('function Tick()')).match(/^  \[/gm) ?? []).length === 3 && !fp.slice(fp.indexOf('export const COHERENT_ACTIONS_INTRO'), fp.indexOf('function Tick()')).includes('HEADING_VS_ACTION'))
  // the import's honesty rules are in the code, not only the report
  const lib = read('lib/lex/action-import.ts')
  ok('the module never lets a model string stand as the document’s words (verbatim lookup precedes use)', lib.indexOf('findInDocument(rawQuote') > 0 && /quote = rawQuote \|\| '\(no wording given\)'[\s\S]{0,200}proposal = 'UNPLACED'/.test(lib))
  ok('the module writes only in confirmImport (addAction/assignHeading/createHeading/writeProposedFindings appear after it begins)', lib.indexOf('addAction(') > lib.indexOf('export async function confirmImport') && lib.indexOf('writeProposedFindings(ontoNothing') < 0 && lib.indexOf('S.createHeading(') > lib.indexOf('export async function confirmImport'))
  ok('the route’s rejections are worded (no bare flatten())', !/error\.flatten\(\)/.test(read('app/api/ideas/[id]/action-import/route.ts')) && !/error\.flatten\(\)/.test(read('app/api/ideas/[id]/policy-review/route.ts')))
  ok('the pass keeps its mapping in a table and the DDL is committed beside the schema', /model ActionImportPass/.test(read('prisma/schema.prisma')) && read('prisma/lex_26s_import.sql').includes('CREATE TABLE IF NOT EXISTS "ActionImportPass"'))
}

async function main() {
  partA()
  partRender()
  await partB()
  await partC()
  partD()
  console.log(`\n${ran} assertions ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} NOT RUN${LIVE ? '' : ' (no --live: the full run did not execute)'}`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error('FATAL', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
