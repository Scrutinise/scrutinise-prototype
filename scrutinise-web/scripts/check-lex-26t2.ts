// ─────────────────────────────────────────────────────────────────────────────
// 26-T2 (BRIEF_26T §4, §5, §6; decisions 145, 147, 150, 202) - check:lex-26t2.
//
//   §4  the ACTIONS PACK: rendered to a real .docx and a real PDF from a scratch idea with two headings, three selected actions, one folded
//       part, one ruled-out action and one unanswered slot. Asserts the numbering key, B.2.3, the quoted part with its number, "not yet
//       answered", the ruled-out item under "Considered, not taken", [Ref: n] lines, the stage banner - and that the PDF text matches the Word.
//       Also: a markdown TABLE in an action's commentary is a real table in Word (<w:tbl>) and a grid in the PDF, not a run-on paragraph.
//   §5  the BACKGROUND REPORT and INTRODUCTORY SUMMARY: arranged from the record (nothing from a model); "Considered, not taken" prints a
//       set-aside note with its reason; an issue with no recorded action says so.
//   §6  COMMENTS: a comment is a note bearing on the action; a reply goes beneath; nobody edits another's words; a team member's comment waits
//       to be put in the record and does not reach the pack until it is.
//   plus: the shared-link download route refuses the three new kinds; the document route words a bad selection.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26t2.ts
//
// NO MODEL IS CALLED and nothing is uploaded to R2: the builders and renderers are called directly, on a SCRATCH COPY of 452c5ade (deleted at
// the end). The full generate -> R2 -> download path is `scripts/measure-lex-pack.ts`. Counts what RAN; every value assertion has a control.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { prisma } from '../lib/prisma'
import { buildProposalSnapshot, type ProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildFor, PROPOSAL_KINDS } from '../lib/documents/proposal-export'
import { renderDocx } from '../lib/documents/render-docx'
import { renderPdf } from '../lib/documents/render-pdf'
import { markdownToBlocks } from '../lib/documents/markdown'
import { PACK_KEY_LINE } from '../lib/documents/build-actions-pack'
import { splitCommentary } from '../lib/documents/actions-pack-read'
import { letterFor } from '../lib/documents/pack-sections'
import { runsToText, type Block } from '../lib/documents/model'
import * as S from '../lib/lex/action-structure'
import * as CD from '../lib/lex/action-conditions-server'
import * as N from '../lib/lex/research-notes'
import { setSlot } from '../lib/lex/action-slots'
import { addFoldLines, foldLine } from '../lib/lex/action-resort-pure'
import { addSource } from '../lib/lex/source-registry'
import { readThread, threadOf } from '../lib/lex/action-thread'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

async function docxText(buf: Buffer): Promise<{ text: string; headers: string; xml: string }> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  // a section's name is its RUNNING HEADER (word/headerN.xml), not body text: read those too, or a section title looks absent
  const headers = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/header\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async('string')))
  const plain = (x: string) => x.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // paragraphs end with a break so a paragraph's own words stay together
  return { text: plain(xml), headers: headers.map(plain).join('\n'), xml }
}
async function pdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try { return (await parser.getText()).text } finally { await parser.destroy() }
}
const squash = (s: string) => s.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()
const blockText = (b: Block): string => b.kind === 'paragraph' ? runsToText(b.runs) : b.kind === 'note' ? b.text : b.kind === 'heading' ? runsToText(b.runs) : b.kind === 'bullets' ? b.items.map(runsToText).join(' | ') : b.kind === 'section' ? b.title : ''

function partA() {
  section('A · the pure parts: the table parser, the letters, the commentary split')
  const md = 'Before.\n\n| Duty | Who |\n| --- | :-: |\n| Publish the standard | **Cabinet Office** |\n| Report yearly |\n\nAfter.'
  const blocks = markdownToBlocks(md)
  const t = blocks.find((b) => b.kind === 'table')
  ok('a markdown table becomes a TABLE block, not a paragraph with pipes in it', !!t && t.kind === 'table')
  ok('…with the header, and every body row padded to the header\'s width (a short row is not shortened)', t?.kind === 'table' && t.header.length === 2 && t.rows.length === 2 && t.rows.every((r) => r.length === 2) && runsToText(t.rows[1][1]) === '')
  ok('…inline emphasis inside a cell survives', t?.kind === 'table' && t.rows[0][1].some((r) => r.bold && r.text === 'Cabinet Office'))
  ok('…and the prose either side stays prose', blocks[0].kind === 'paragraph' && blocks[blocks.length - 1].kind === 'paragraph' && runsToText((blocks[blocks.length - 1] as unknown as { runs: never[] }).runs) === 'After.')
  control('the table text is left as a run-on paragraph with pipes (must be FALSE)', blocks.some((b) => b.kind === 'paragraph' && runsToText(b.runs).includes('|')))
  ok('a line with a pipe but no delimiter row is NOT a table', !markdownToBlocks('a | b\nc | d').some((b) => b.kind === 'table'))
  ok('heading letters run A..Z then AA', letterFor(0) === 'A' && letterFor(1) === 'B' && letterFor(25) === 'Z' && letterFor(26) === 'AA' && letterFor(27) === 'AB')
  const cm = `The detail.\n\n${addFoldLines(null, [foldLine(12, 'A part', 'It must publish the standard [Ref: 4]', 'a duty')])}`
  const sp = splitCommentary(cm)
  ok('the commentary splits into its prose and its quoted parts', sp.detail === 'The detail.' && sp.parts.length === 1 && sp.parts[0].number === 12 && sp.parts[0].quote === 'It must publish the standard [Ref: 4]' && sp.parts[0].title === 'A part' && sp.parts[0].reason === 'a duty' && JSON.stringify(sp.parts[0].refs) === '[4]', JSON.stringify(sp))
  ok('…and the "Parts of this action, quoted" header does not leak into the detail', !/Parts of this action/.test(sp.detail ?? ''))
  ok('the three new kinds exist', ['ACTIONS_PACK', 'BACKGROUND_REPORT', 'INTRODUCTORY_SUMMARY'].every((k) => (PROPOSAL_KINDS as readonly string[]).includes(k)))
}

async function partB() {
  section('B · §4e - the cold read: the Actions Pack, rendered, on a scratch idea')
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  const copy = await scratchCopy('452c5ade', 't2')
  const id = copy.id
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    if (live.length < 6) { ok('the copy has live actions', false, String(live.length)); return }
    const [p, q, r, s, t] = live
    const h1 = await S.createHeading(id, 'T2 first'); const h2 = await S.createHeading(id, 'T2 second')
    if (!h1.ok || !h2.ok) { ok('headings made', false); return }
    // heading order: the copy's own headings come first, so give the two ours the FIRST two places
    await prisma.actionHeading.updateMany({ where: { ideaId: id }, data: { orderIndex: 99 } })
    await prisma.actionHeading.update({ where: { id: h1.data.id }, data: { orderIndex: 0, purpose: 'T2 purpose of the first heading' } })
    await prisma.actionHeading.update({ where: { id: h2.data.id }, data: { orderIndex: 1 } })
    await S.assignHeading(id, [p.id], h1.data.id)
    await S.assignHeading(id, [q.id, r.id, t.id], h2.data.id)
    await S.assignHeading(id, [live[6].id], null) // one action under no heading, for the "No heading" selection below
    await CD.seedConditions(id, copy.userId, CHARLIES_TEN, CONDITIONS_SOURCE)
    const src = await addSource(id, copy.userId, { kind: 'URL', title: 'T2 source title', url: 'https://example.invalid/t2-source', readStatus: 'READ' })
    const REF = src.source.number
    // q: Who answered, incentive AGAINST with nothing changing it. p: skill left unanswered.
    await setSlot(id, q.id, 'who', { text: 'T2 Cabinet Office (inside government)' }, 'USER')
    await setSlot(id, q.id, 'incentiveNow', { text: 'T2 their budget rewards secrecy', direction: 'AGAINST' }, 'USER')
    // r: a folded part (s) quoted in its commentary, with a [Ref], plus a table in the detail
    const part = await prisma.lexCoherentAction.findUnique({ where: { id: s.id }, select: { number: true, title: true, practicalStep: true } })
    const commentary = `The mechanism in more words.\n\n| Duty | Who |\n| --- | --- |\n| T2 publish the standard | T2 the department |\n\n${addFoldLines(null, [foldLine(part!.number!, part!.title, `${part!.practicalStep.slice(0, 80)} [Ref: ${REF}]`, 'T2 fold reason')])}`
    await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { commentary } })
    await prisma.lexCoherentAction.update({ where: { id: s.id }, data: { status: 'ARCHIVED', foldedIntoId: r.id } })
    // t: ruled out under heading two
    await S.ruleOut(id, [t.id], 'T2 ruled out because it duplicates the Act')

    const snap = await buildProposalSnapshot(id)
    ok('the snapshot carries the pack data', !!snap.actionsPack && snap.actionsPack.actions.length >= 4 && snap.actionsPack.ruledOut.some((x) => x.reason?.includes('T2 ruled out')))
    ok('…the owner-written slot is in it and no Lex proposal is (a proposal beside an empty slot is not an answer)', snap.actionsPack!.actions.find((a) => a.id === q.id)?.slots.who?.text.includes('T2 Cabinet Office') === true)
    const sel = { actionIds: [p.id, q.id, r.id] }
    const built = buildFor('ACTIONS_PACK', snap, null, { selection: sel })
    const docx = await renderDocx(built.model), pdf = await renderPdf(built.model)
    const word = await docxText(docx)
    const W = squash(word.text)
    const WH = squash(word.headers)
    const P = squash(await pdfText(pdf))
    ok('a real .docx and a real PDF were produced', docx.length > 3000 && pdf.length > 3000 && pdf.subarray(0, 4).toString() === '%PDF')

    ok('the stage banner (decision 101) is on the pack', /Scrutiny requires something to scrutinise/.test(W) || /The First (Pass|Draft)|The Deepening/.test(W), W.slice(0, 300))
    ok('the numbering key is printed at the top, in the brief\'s form', W.includes(squash(PACK_KEY_LINE).slice(0, 80)) && /How the paragraphs are numbered: H\.A\.S/.test(W))
    ok('only the three selected actions are printed (the copy has more)', /#\d+/.test(W) && !W.includes(`#${s.number}  `) && !W.includes(`Sources cited in this printing (0)`))
    ok('heading A is the first heading and B the second, in the section titles (the running headers in Word)', /A · T2 first/.test(WH) && /B · T2 second/.test(WH), WH.slice(0, 200))
    ok('…and the PDF prints them too', /A · T2 first/.test(P) || /A . T2 first/.test(P))
    ok('B.2.3 exists: the second heading, its second action, section 3 (Who)', /B\.2\.3\s+Who/.test(W), (W.match(/B\.\d\.\d+/g) ?? []).slice(0, 12).join(' '))
    ok('…and so does A.1.1 and B.1.1', /A\.1\.1\s+What it is/.test(W) && /B\.1\.1\s+What it is/.test(W))
    ok('the quoted part appears with its action NUMBER and its [Ref: n]', new RegExp(`B\\.2\\.2\\s+Parts of this action, quoted`).test(W) && W.includes(`#${part!.number} `) && W.includes(`[Ref: ${REF}]`), W.slice(W.indexOf('B.2.2'), W.indexOf('B.2.2') + 300))
    ok('the unanswered slot reads "not yet answered" (p\'s Skill)', /Skill: not yet answered/.test(W))
    ok('Q\'s incentive reads "against" in words with nothing recorded under What changes it', /Incentive now: against - T2 their budget rewards secrecy/.test(W) && /What changes it: not yet answered/.test(W))
    ok('the ruled-out action is under "Considered, not taken", with its reason', /CONSIDERED, NOT TAKEN/.test(WH) && /NOT\.1\s+#\d+.*ruled out: T2 ruled out because it duplicates the Act/.test(W), W.slice(Math.max(0, W.indexOf('NOT.1')), W.indexOf('NOT.1') + 400))
    ok('…and the ruled-out action is NOT printed as a live action', !new RegExp(`#${t.number}\\s+${(await prisma.lexCoherentAction.findUnique({ where: { id: t.id }, select: { title: true, practicalStep: true } }))!.title?.slice(0, 20) ?? 'zzzz'}.*What it is`).test(W))
    ok('every source line carries [Ref: n]: the source list prints the cited source by number', new RegExp(`\\[Ref: ${REF}\\] T2 source title`).test(W))
    ok('the conditions are listed (0.n) and the Guiding Policy is stated or said to be unsettled', /Condition 1: One named owner per task/.test(W) && /0\.1\s+(Statement|No Guiding Policy)/.test(W))
    ok('Incentives: one paragraph per implementer; the AGAINST with no changer is said so in words', /INC\.\d+\s+T2 Cabinet Office/.test(W) && /the record names nothing that changes it/.test(W))
    ok('a heading with no digest says "none yet" (and is numbered)', /A\.D\.1\s+Digest: none yet/.test(W))
    ok('a selection does NOT print the whole-set digest slot (only an "everything" printing does)', !/Digest of the whole set/.test(W))

    section('B · the Word and the PDF say the same thing')
    const probes = ['B.2.3', 'A.1.1', 'Skill: not yet answered', `[Ref: ${REF}] T2 source title`, 'NOT.1', 'How the paragraphs are numbered']
    for (const w of probes) ok(`the PDF text also contains “${w}”`, P.replace(/\s/g, '').includes(w.replace(/\s/g, '')), `PDF starts: ${P.slice(0, 160)}`)
    control('a probe that is in neither document is found in the PDF (must be FALSE)', P.includes('ZZZ-not-in-the-pack-ZZZ'))

    section('B · a markdown table is a TABLE in both formats')
    ok('the Word file has a real table (<w:tbl>) with the cell text in it', /<w:tbl>/.test(word.xml) && W.includes('T2 publish the standard') && W.includes('T2 the department'))
    ok('…and the PDF contains the cells', P.includes('T2 publish the standard') && P.includes('T2 the department'))
    ok('…the header row is in the table', /<w:tblHeader\/>|<w:tblHeader /.test(word.xml) || /w:tblHeader/.test(word.xml))
    control('the Word file of a pack WITHOUT the table has a table (must be FALSE)', /<w:tbl>/.test((await docxText(await renderDocx({ ...built.model, blocks: built.model.blocks.filter((b) => b.kind !== 'table') }))).xml))

    section('B · selection: any selection, one heading, all')
    const all = buildFor('ACTIONS_PACK', snap, null, {})
    const allText = squash(all.model.blocks.map(blockText).join(' '))
    ok('all: the whole-set digest slot is printed ("none yet" if there is no digest)', /Digest of the whole set/.test(allText) && /SET\.D\.1/.test(allText))
    ok('all: prints more actions than the three-action selection', all.model.blocks.length > built.model.blocks.length)
    const one = buildFor('ACTIONS_PACK', snap, null, { selection: { headingId: h2.data.id } })
    const oneText = squash(one.model.blocks.map(blockText).join(' '))
    ok('one heading: only that heading\'s section, and it is lettered A', /A · T2 second/.test(oneText) && !/T2 first/.test(oneText.replace(/A · T2 second/g, '')) )
    const none = buildFor('ACTIONS_PACK', snap, null, { selection: { headingId: '__none' } })
    ok('"no heading": prints the actions under no heading, under "No heading"', /No heading/.test(none.model.blocks.map(blockText).join(' ')))
    ok('the fingerprint is the snapshot\'s, so staleness works whatever was selected', built.fingerprint === all.fingerprint)

    section('B · the digest in the pack: dated, and it says when it has fallen behind')
    const digest = await prisma.actionDigest.create({
      data: {
        ideaId: id, scope: 'HEADING', headingId: h2.data.id, headingName: 'T2 second', status: 'READY', actionIds: [q.id, r.id], spentPence: 3, startedBy: copy.userId,
        modelOutputs: [{ model: 'm1', status: 'OK' }, { model: 'm2', status: 'OK' }] as never,
        judgeOutput: { digest: { answers: [{ question: 1, reconciled: 'T2 reconciled answer one' }], disagreements: [{ topic: 'T2 topic', positions: [{ model: 'm1', position: 'yes' }, { model: 'm2', position: 'no' }] }], weightBearing: [], noDirectCondition: [], conflicts: [], gaps: [{ item: 'T2 gap item', whatFails: 'Something breaks without this gap item here', category: 'legislative', namedBy: ['m1'] }], proposedConditions: [] }, flags: {}, handled: { gaps: {}, conditions: {} }, trimmedCommentaries: 0, commentaryMax: null } as never,
      },
    })
    const snap2 = await buildProposalSnapshot(id)
    const withDigest = squash(buildFor('ACTIONS_PACK', snap2, null, { selection: sel }).model.blocks.map(blockText).join(' '))
    ok('the digest prints, dated, with its answers, its disagreement and its gap', /Digest · written \d+ \w+ \d{4}/.test(withDigest) && withDigest.includes('T2 reconciled answer one') && withDigest.includes('T2 topic') && withDigest.includes('T2 gap item'))
    ok('…and while the heading still has the actions it read, it is NOT marked out of date', !/Out of date:/.test(withDigest))
    await S.assignHeading(id, [live[7].id], h2.data.id)
    const snap3 = await buildProposalSnapshot(id)
    const stale = squash(buildFor('ACTIONS_PACK', snap3, null, { selection: sel }).model.blocks.map(blockText).join(' '))
    ok('after an action joins the heading the pack says the digest is out of date, in words', /Out of date: This digest is out of date/.test(stale), stale.slice(stale.indexOf('Digest ·'), stale.indexOf('Digest ·') + 300))
    void digest

    section('C · §5 - the Background Report and the Introductory Summary (arranged, not generated)')
    const owner = { id: copy.userId, isOwner: true }
    const aside = await N.addNote(id, { id: copy.userId }, owner, { op: 'addNote', ownObservation: true, comment: 'T2 a note set aside', stance: 'UNDECIDED' })
    if (aside.ok && aside.data.noteId) await N.setAside(id, owner, copy.userId, [aside.data.noteId], 'T2 set aside because it duplicates source 3')
    const kept = await N.addNote(id, { id: copy.userId }, owner, { op: 'addNote', sourceId: src.source.id, quote: 'T2 a quote from the source', comment: 'T2 kept comment', stance: 'CONTRADICTS', bearsOn: [{ kind: 'action', id: q.id, label: 'Action q' }] })
    ok('the two notes were saved', aside.ok && kept.ok)
    const snap4 = await buildProposalSnapshot(id)
    const bg = buildFor('BACKGROUND_REPORT', snap4)
    const bgText = squash(bg.model.blocks.map(blockText).join(' '))
    ok('the report has its sections in order: read · said · disagree · conditions · issues · incentives · considered not taken', ['WHAT WAS READ', 'WHAT IT SAID', 'WHERE SOURCES DISAGREE', 'THE CONDITIONS', 'ISSUES AND THE ACTIONS THAT MEET THEM', 'INCENTIVES', 'CONSIDERED, NOT TAKEN'].map((x) => bgText.indexOf(x)).every((v, i, a) => v >= 0 && (i === 0 || v > a[i - 1])))
    ok('"What it said" prints the kept note with its quote and its [Ref: n]', bgText.includes('T2 a quote from the source') && bgText.includes(`[Ref: ${REF}]`))
    ok('a note marked CONTRADICTS is listed under where sources disagree', /3\.\d+\s+On Action q/.test(bgText) || bgText.includes('On Action q'))
    ok('"Considered, not taken" prints the set-aside note WITH its reason and a date', bgText.includes('T2 a note set aside') && bgText.includes('T2 set aside because it duplicates source 3'))
    ok('the conditions are cited to where they came from (the owner\'s source label)', bgText.includes('Where the list came from') && bgText.includes('Charlie'))
    ok('an issue with no action recorded says so, and does not guess', !/ISSUES AND THE ACTIONS/.test(bgText) || /no action is recorded as meeting it|The research has raised no open issue/.test(bgText))
    ok('the set-aside note is NOT printed under "What it said" (only the record is)', bgText.indexOf('T2 a note set aside') > bgText.indexOf('CONSIDERED, NOT TAKEN'))
    const intro = buildFor('INTRODUCTORY_SUMMARY', snap4)
    const iText = squash(intro.model.blocks.map(blockText).join(' '))
    ok('the Introductory Summary has its five headings', ['The problem', 'The policy', 'The instruments', 'What it costs', 'What is not yet settled'].every((h) => iText.includes(h)))
    ok('…it names the headings (instruments) with a count of actions each', /T2 first[^|]*\(1 action\)/.test(iText), iText.slice(iText.indexOf('The instruments'), iText.indexOf('The instruments') + 300))
    ok('…and says what is not settled, from the record', /not yet settled|open|missing/i.test(iText))
    const iPdf = await pdfText(await renderPdf(intro.model))
    ok('…and it fits on a page or two (it is "one page" for a reader, not a report)', (iPdf.match(/\f/g) ?? []).length <= 3, String((iPdf.match(/\f/g) ?? []).length))
    control('the summary mentions a figure that is not in the record (£ with no cost recorded) (must be FALSE)', !/No total cost is recorded yet/.test(iText) && /£/.test(iText))

    section('D · §6 - comments are notes bearing on the action; the notebook\'s own rules')
    const other = await prisma.user.findFirst({ where: { id: { not: copy.userId } }, select: { id: true } })
    const comment = await N.addNote(id, { id: copy.userId }, owner, { op: 'addNote', ownObservation: true, comment: 'T2 the owner\'s comment on q', stance: 'CONTEXT', tags: ['comment'], bearsOn: [{ kind: 'action', id: q.id, label: `Action ${q.number}` }] })
    ok('a comment is saved as a note bearing on the action', comment.ok && !!comment.data.noteId && comment.data.status === 'IN_RECORD')
    if (other && comment.ok && comment.data.noteId) {
      const rep = await N.reply(id, { id: other.id, isOwner: false }, comment.data.noteId, 'T2 a reply beneath it')
      ok('anyone who can see the idea can reply beneath', rep.ok)
      const edit = await N.updateNote(id, { id: other.id, isOwner: false }, { op: 'updateNote', noteId: comment.data.noteId, comment: 'T2 rewritten by someone else' })
      ok('nobody edits another person\'s words (refused, in words, and the comment is unchanged)', !edit.ok && /Only the person who wrote a note|nobody edits/i.test((edit as { error: string }).error) && (await prisma.researchNote.findUnique({ where: { id: comment.data.noteId } }))?.comment === 'T2 the owner\'s comment on q', (edit as { error?: string }).error)
      const theirs = await N.addNote(id, { id: other.id }, { id: other.id, isOwner: false }, { op: 'addNote', ownObservation: true, comment: 'T2 a team member\'s comment', stance: 'CONTEXT', tags: ['comment'], bearsOn: [{ kind: 'action', id: q.id, label: `Action ${q.number}` }] })
      ok('a team member\'s comment waits to be put in the record (UNREVIEWED), in the notebook\'s own words', theirs.ok && theirs.data.status === 'UNREVIEWED')
      const th = await readThread(id, owner, q.id)
      ok('the thread shows both comments, in time order, with the reply beneath the first', th.ok && th.data.notes.length >= 2 && th.data.notes.some((n) => n.replies.some((x) => x.text === 'T2 a reply beneath it')), th.ok ? String(th.data.notes.length) : '')
      ok('…and a note that bears on a different action is not in this action\'s thread', th.ok && !threadOf(th.data.notes, r.id).some((n) => n.id === comment.data.noteId))
      control('the thread of an action nobody commented on has comments (must be FALSE)', th.ok && threadOf(th.data.notes, p.id).length > 0)
      const snap5 = await buildProposalSnapshot(id)
      const packNotes = snap5.actionsPack!.actions.find((a) => a.id === q.id)!.notes.map((n) => n.text)
      ok('the owner\'s comment reaches the pack\'s "The owner\'s notes"; the team member\'s (not in the record) does not', packNotes.includes('T2 the owner\'s comment on q') && !packNotes.includes('T2 a team member\'s comment'), JSON.stringify(packNotes))
      const put = await N.putInRecord(id, owner, [theirs.ok && theirs.data.noteId ? theirs.data.noteId : ''])
      const snap6 = await buildProposalSnapshot(id)
      ok('once the owner puts it in the record it reaches the pack', put.ok && snap6.actionsPack!.actions.find((a) => a.id === q.id)!.notes.some((n) => n.text === 'T2 a team member\'s comment'))
    } else skip('reply / edit / team-member comment', 'there is no second user on this database to act as the other person')

    section('E · the shared link and the document route')
    const { GET: shareGet } = await import('../app/api/proposals/[token]/download/route')
    for (const kind of ['ACTIONS_PACK', 'BACKGROUND_REPORT', 'INTRODUCTORY_SUMMARY']) {
      const res = await shareGet(new Request(`http://internal.invalid/?kind=${kind}&format=pdf`), { params: Promise.resolve({ token: 'no-such-token' }) })
      const j = (await res.json()) as { error?: string }
      ok(`a shared link refuses kind=${kind} (422) and does not list it as allowed`, res.status === 422 && !!j.error && !j.error.includes('ACTIONS_PACK') && !j.error.includes('BACKGROUND_REPORT') && !j.error.includes('INTRODUCTORY_SUMMARY'), `${res.status} ${j.error}`)
    }
    const ctl = await shareGet(new Request('http://internal.invalid/?kind=PROPOSAL&format=pdf'), { params: Promise.resolve({ token: 'no-such-token' }) })
    control('the control kind (PROPOSAL) is refused for being the wrong KIND (must be FALSE)', ctl.status === 422)
    const { POST } = await import('../app/api/ideas/[id]/document/route')
    const bad = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate', kind: 'ACTIONS_PACK', selection: { actionIds: [] } }) }), { params: Promise.resolve({ id }) })
    const bj = (await bad.json()) as { error?: unknown }
    ok('an empty selection is refused (422), naming the input in words, not a flatten() object', bad.status === 422 && typeof bj.error === 'string' && /the selection of actions/.test(bj.error) && /selection\.actionIds/.test(bj.error), JSON.stringify(bj).slice(0, 240))
    const badKind = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate', kind: 'NOT_A_KIND' }) }), { params: Promise.resolve({ id }) })
    ok('an unknown document is refused in words', badKind.status === 422 && typeof ((await badKind.json()) as { error?: unknown }).error === 'string')
  } finally { await deleteScratch(id) }
  ok('the scratch copy is gone', !(await prisma.idea.findUnique({ where: { id } })))
}

async function main() {
  partA()
  await partB()
  section('NOT RUN HERE, AND SAID SO')
  skip('generate -> R2 -> signed download for the three new kinds', 'writes to the document store; scripts/measure-lex-pack.ts')
  skip('a real browser: Print selected / Print this heading / Print all, and the Comments thread', 'check:lex-26t-browser')
  skip('Lex summarising a thread', 'a model call (under 1p); scripts/measure-lex-pack.ts --thread')
  skip('opening the .docx in Word itself', 'Charlie, by eye (BRIEF_26T §8)')
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions RAN, ${controls} controls (${dead} dead), ${notRun} NOT RUN`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
void readFileSync; void join
