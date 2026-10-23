// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26u — BRIEF_26U §6. Counts what RAN (§23.2); a browser that cannot launch is NOT RUN, never a pass.
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26u.ts
//
// §2 (227): the pure split/move on a 3,000-character fixture; the migration's effect read from the database; and the REAL ActionCard in
//     Chromium — an over-limit statement edited (one word deleted) keeps every other character, Save is refused in words, Cancel restores.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { splitImportedBlocks, addImportedBlocks, removeFoldLine, FOLD_HEADER } from '../lib/lex/action-resort-pure'
import { LIMITS } from '../lib/lex/input-limits'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
export function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
export function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
export function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
export const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

// ── §2 ────────────────────────────────────────────────────────────────────────
const MINE = 'Parliament enacts a statutory duty that every task in a publicly funded body has one named owner, with the power and resources to deliver it.'
const block = (i: number) => `— More on this action, imported 2026-10-18 (From: [Ref: 213] ${i}. Section ${i}, row 1 Primary legislation) —\nPart ${i} of the document, summarised.\nThe document says: “${'Words of the document, quoted exactly. '.repeat(9)}${i}”`
const FIXTURE = `${MINE}${[1, 2, 3, 4, 5, 6, 7].map((i) => `\n\n${block(i)}`).join('')}`

async function part2() {
  section('§2 · the editing defect (227) — pure, database, browser')
  ok('the fixture statement is over 3,000 characters', FIXTURE.length > 3000, String(FIXTURE.length))
  const s = splitImportedBlocks(FIXTURE)
  ok('split: the statement keeps only the text before the first imported block (≤ 1,000)', s.statement === MINE && s.statement.length <= LIMITS.actionStatement, s.statement.slice(0, 200))
  ok('…and all 7 blocks are lifted out, each starting with its own source line', s.blocks.length === 7 && s.blocks.every((b, i) => b.startsWith(`— More on this action, imported 2026-10-18 (From: [Ref: 213] ${i + 1}.`)))
  const c = addImportedBlocks('Parts of this action, quoted\n• [#34] “A part.”', s.blocks)
  ok('move: every block lands in the Commentary verbatim, under ONE "Parts of this action, quoted" header', s.blocks.every((b) => c.includes(b)) && c.split('\n').filter((l) => l.trim() === FOLD_HEADER).length === 1)
  ok('lossless: statement + blocks are the original, word for word', `${s.statement}\n\n${s.blocks.join('\n\n')}` === FIXTURE)
  control('a statement with no imported block being changed by the split (must be FALSE)', splitImportedBlocks(MINE).statement !== MINE)
  ok('removing the last [#n] part keeps the header while an imported block remains under it', (removeFoldLine(c, 34) ?? '').includes(FOLD_HEADER) && (removeFoldLine(c, 34) ?? '').includes(s.blocks[0]))
  const imp = readFileSync(join(ROOT, 'lib/lex/action-import.ts'), 'utf8')
  ok('the import pass writes "Adds to" into Commentary, never the statement (source read: the one write site)', /data: \{ commentary: addImportedBlocks\(cur\.commentary, \[appendedBlock\(/.test(imp) && !/practicalStep: cur\.practicalStep \+ appendedBlock/.test(imp))

  const over = await prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int n FROM "LexCoherentAction" WHERE status = 'LIVE' AND length("practicalStep") > ${LIMITS.actionStatement}`
  const holding = await prisma.lexCoherentAction.count({ where: { practicalStep: { contains: ', imported 20' } } })
  const revs = await prisma.fieldRevision.count({ where: { origin: 'IMPORT_BLOCKS_TO_COMMENTARY_227' } })
  ok('database: no live statement over 1,000; none still holding an imported block; the pre-migration statements kept as revisions', over[0].n === 0 && holding === 0 && revs >= 11, `over=${over[0].n} holding=${holding} revisions=${revs}`)
  const a38 = await prisma.lexCoherentAction.findFirst({ where: { ideaId: { startsWith: '452c5ade' }, number: 38 }, select: { practicalStep: true, commentary: true } })
  if (a38) ok('#38 on 452c5ade: Charlie\'s sentence alone (462 characters), the seven imported blocks under Commentary', a38.practicalStep.length === 462 && ((a38.commentary ?? '').match(/— More on this action, imported/g) ?? []).length === 7, `${a38.practicalStep.length} chars; ${((a38.commentary ?? '').match(/— More on this action, imported/g) ?? []).length} blocks`)
  else skip('#38 on 452c5ade', 'idea 452c5ade is not in this database')

  // ── the real card ──
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('§2 browser', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/action-card-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the card harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('§2 browser', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle })
    await page.evaluate((s) => (window as never as { __mountCard: (s: string) => void }).__mountCard(s), FIXTURE)
    await page.locator('button:text-is("Edit")').click()
    const box = page.locator('textarea[aria-label="The action statement"]')
    ok('Edit opens the statement with ALL of it in the box (nothing cut on open)', (await box.inputValue()) === FIXTURE, `${(await box.inputValue()).length} of ${FIXTURE.length}`)
    const counter = await page.locator('[data-limit-counter]').innerText()
    ok('the counter says, in words, how far over the limit it is', /over the limit of 1,000/.test(counter) && (await page.locator('[data-limit-counter][data-over-limit=true]').count()) === 1, counter)
    // Delete one word, the way Charlie did: the box receives the text minus that word.
    const minusWord = FIXTURE.replace(' statutory', '')
    await box.fill(minusWord)
    const after = await box.inputValue()
    ok('deleting one word removes ONLY that word — the other 2,000+ characters stay', after === minusWord, `${after.length} characters left of ${minusWord.length}`)
    control('the box cutting to its first 1,000 characters on that edit (must be FALSE)', after.length === LIMITS.actionStatement)
    await page.locator('button:text-is("Save")').click()
    const refused = await page.locator('[data-save-refused]').innerText().catch(() => '')
    ok('Save is REFUSED in words: "Not saved: the statement is N characters; the limit is 1,000. Move the extra into Commentary or shorten."', refused.includes(`Not saved: the statement is ${minusWord.length.toLocaleString('en-GB')} characters; the limit is 1,000. Move the extra into Commentary or shorten.`), refused)
    ok('…nothing reached the API, and the text is still exactly as typed', (await page.evaluate(() => (window as never as { __card: { updates: unknown[] } }).__card.updates.length)) === 0 && (await box.inputValue()) === minusWord)
    await page.locator('button:text-is("Cancel")').click()
    ok('Cancel restores the record as it was', ((await page.locator('[data-statement]').innerText()).replace(/\s+/g, ' ')) === FIXTURE.replace(/\s+/g, ' '))
    await page.locator('button:text-is("Edit")').click()
    await page.locator('textarea[aria-label="The action statement"]').fill(MINE)
    await page.locator('button:text-is("Save")').click()
    const ups = await page.evaluate(() => (window as never as { __card: { updates: Array<{ d: { practicalStep: string } }> } }).__card.updates)
    ok('a statement within the limit saves', ups.length === 1 && ups[0].d.practicalStep === MINE)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

// ── §3 and §4 ─────────────────────────────────────────────────────────────────
// A scripted model stands in for Sonnet so what the PLATFORM does around it is asserted exactly and nothing is spent; the real drafts of
// #38, #59 and #202 (scripts/measure-26u-draft.ts, 22 Oct) are the live evidence and are quoted in docs/LEX_26U_REPORT.md.
const CRAG = 'ukpga/2010/25'
function scriptedDraft(over: Record<string, unknown> = {}) {
  const calls: Array<{ user: string; system: string }> = []
  const call = (async (o: { user: string; system: string }) => {
    calls.push({ user: o.user, system: o.system })
    return {
      ok: true, usage: { model: 'claude-sonnet-5-5', tokensIn: 1000, tokensOut: 500 },
      value: {
        instrument: 'AMENDING_ACT', dutyOnWhom: 'the Minister for the Civil Service', enforcedHow: 'by Parliament, on laying', commencement: 'on Royal Assent', extent: ['UK'],
        provisions: [
          { docUri: CRAG, provisionPath: 'section/5', relation: 'amends', note: 'the Code provision' },
          { docUri: 'not an id', provisionPath: null, relation: 'amends', note: 'a made-up line the platform must drop' },
          { docUri: 'bill/3812', provisionPath: null, relation: 'relies_on', note: 'a Bill' },
        ],
        precedents: [{ docUri: 'ukpga/1972/70', provisionPath: 'section/151', how: 'adapted for subsection (1)' }],
        clause: '(1) The Minister must issue a code.\n(2) The code must be laid before Parliament.', // NO caveat: the platform must add it
        plainWording: '', purpose: 'Put the Code on a statutory footing.',
        citations: ['quangos-govuk:government/publications/drafting-bills-for-parliament:2 (Part 6)', 'primary-acts-pre-2000:ukpga/1972/70:section-151', 'a source nobody supplied'],
        reason: 'Scripted.', ...over,
      },
    }
  }) as never
  return { call, calls }
}

async function part3and4() {
  const { CLAUSE_CAVEAT, withCaveat, addVersion, parseDraft, EMPTY_INSTRUCTION } = await import('../lib/lex/action-draft-pure')
  const DR = await import('../lib/lex/action-draft')
  const TO = await import('../lib/lex/action-touches')
  const { effectsFor } = await import('../lib/lex/statutory-graph')
  const { readSection } = await import('../lib/lex/read-section')
  const { setSlot } = await import('../lib/lex/action-slots')
  const { scratchCopy, deleteScratch } = await import('./lib/scratch-copy')
  const { buildProposalSnapshot } = await import('../lib/documents/proposal-snapshot')
  const { buildFor } = await import('../lib/documents/proposal-export')
  const { renderDocx } = await import('../lib/documents/render-docx')
  const JSZip = (await import('jszip')).default

  section('§3 · the drafting instruction and the clause (148, 228) — pure')
  ok('the caveat is put FIRST on a clause written without it, and never twice', withCaveat('(1) X.').startsWith(CLAUSE_CAVEAT) && withCaveat(withCaveat('(1) X.')).split(CLAUSE_CAVEAT).length === 2)
  const v1 = addVersion(undefined, { ...EMPTY_INSTRUCTION, dutyOnWhom: 'A' }, 'USER', '2026-10-22T00:00:00Z')
  const v2 = addVersion(v1, { ...EMPTY_INSTRUCTION, dutyOnWhom: 'B' }, 'LEX', '2026-10-22T01:00:00Z')
  ok('a save is a NEW version; the previous is kept, in order', v2.versions.length === 2 && v2.versions[0].dutyOnWhom === 'A' && v2.versions[1].v === 2 && v2.versions[1].dutyOnWhom === 'B')
  control('a second save replacing the first (must be FALSE)', v2.versions.length === 1)

  const copy = await scratchCopy('452c5ade', '26u-check')
  try {
    const owner = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: copy.id, number: 59, status: 'LIVE' }, select: { id: true } })
    await prisma.lexCoherentAction.update({ where: { id: owner.id }, data: { avenue: 'LEGISLATIVE' } })
    const mine = { ...EMPTY_INSTRUCTION, instrument: 'NEW_ACT' as const, dutyOnWhom: 'the owner’s own words', clause: '(1) My own clause.' }
    const saved = await DR.saveVersion(copy.id, owner.id, mine)
    ok('the owner saves an instruction: version 1, by the owner, the caveat added to the clause', saved.ok && saved.data.version === 1)
    const s = scriptedDraft()
    const run = await DR.draftWithLex(copy.id, owner.id, copy.userId, { call: s.call })
    const row = await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } })
    const d = DR.draftOf(row)!
    ok('Lex’s draft is a PROPOSAL BESIDE the owner’s version — the owner’s version 1 untouched', run.ok && d.versions.length === 1 && d.versions[0].dutyOnWhom === 'the owner’s own words' && !!d.proposal)
    control('the owner’s clause replaced by Lex’s (must be FALSE)', d.versions[0].clause.includes('The Minister must issue'))
    ok('the proposal carries EVERY instruction field and the clause with the caveat as its first line', !!d.proposal && !!d.proposal.instrument && !!d.proposal.dutyOnWhom && !!d.proposal.enforcedHow && !!d.proposal.commencement && d.proposal.extent.length > 0 && d.proposal.clause.startsWith(CLAUSE_CAVEAT))
    ok('a provision not in legislation.gov.uk form is DROPPED and the drop is said in the reason', d.proposal!.provisions.length === 2 && !d.proposal!.provisions.some((p) => p.docUri === 'not an id') && /not an id/.test(d.proposal!.reason))
    ok('OPC citations by section id kept (with the part); a citation that was not supplied is dropped and said', d.proposal!.citations.some((c) => c.startsWith('quangos-govuk:government/publications/drafting-bills-for-parliament:2')) && d.proposal!.citations.includes('primary-acts-pre-2000:ukpga/1972/70:section-151') && !d.proposal!.citations.includes('a source nobody supplied') && /nobody supplied/.test(d.proposal!.reason))
    ok('at least one precedent citation where one applies', d.proposal!.precedents.length >= 1)
    const u = s.calls[0]?.user ?? ''
    ok('what Lex is given: OPC Parts 5.1, 6 and 9.2 as HELD, the precedents found by their own text, the action fenced as data', /GUIDANCE — Part 5\.1/.test(u) && /GUIDANCE — Part 6/.test(u) && /GUIDANCE — Part 9\.2/.test(u) && /PRECEDENT \(a model\) — Building Safety Act 2022/.test(u) && /THE OBJECTION/.test(u) && /<action>[\s\S]*<\/action>/.test(u), u.slice(0, 300))
    ok('§27: the system prompt carries no specimen clause (no "(1) The …" sentence of its own)', !/\(\d\) The [A-Z]/.test(s.calls[0]?.system ?? '') && !/\(\d\) A [a-z]/.test(s.calls[0]?.system ?? ''))
    const linksOf = () => prisma.ideaLawLink.findMany({ where: { actionId: owner.id }, orderBy: { createdAt: 'asc' } })
    ok('§5: a PROPOSAL writes no law link — it is not the instruction until accepted', (await linksOf()).length === 0)
    const acc = await DR.acceptProposal(copy.id, owner.id)
    const after = DR.draftOf(await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } }))!
    ok('accepting makes it version 2 (by Lex); version 1 (the owner’s) is kept', acc.ok && after.versions.length === 2 && after.versions[0].by === 'USER' && after.versions[1].by === 'LEX' && !after.proposal)

    section('§5 · the join (223, 226) — rows read back with the plain client, not the app’s reader')
    const L2 = await linksOf()
    const s5row = L2.find((l) => l.docUri === CRAG && l.provisionPath === 'section/5')
    ok('accepting v2 writes one row per held line: CRaG s.5 `amends`, action set, source drafting_instruction, detail "<action> v2", note = purpose', !!s5row && s5row.relation === 'amends' && s5row.actionId === owner.id && s5row.ideaId === copy.id && s5row.source === 'drafting_instruction' && s5row.sourceDetail === `${owner.id} v2` && s5row.note === 'Put the Code on a statutory footing.', JSON.stringify(L2.map((l) => [l.relation, l.docUri, l.provisionPath, l.sourceDetail])))
    const { effectsLoadDate } = await import('../lib/lex/statutory-graph')
    const loadDate = await effectsLoadDate()
    ok('…as_at is the effects data’s load date, not the save date', !!loadDate && L2.every((l) => l.asAt.toISOString().slice(0, 10) === loadDate), `${loadDate} vs ${L2.map((l) => l.asAt.toISOString().slice(0, 10)).join(',')}`)
    ok('…and the precedent named in the instruction as a `precedent` row (LGA 1972 s.151)', L2.some((l) => l.relation === 'precedent' && l.docUri === 'ukpga/1972/70' && l.provisionPath === 'section/151'))
    const rep = acc.ok ? acc.data.lawRows : null
    ok('…the save reports what it wrote, and every line it did not write carries its state', !!rep && !('failed' in rep) && rep.written === L2.length && rep.written + rep.notHeld.length === 3 && rep.notHeld.every((n) => n.state !== 'held'), JSON.stringify(rep))
    const { writeInstructionRows } = await import('../lib/lex/action-law-rows')
    const again = await writeInstructionRows(copy.id, owner.id, after.versions[1])
    ok('re-run on the same version writes nothing twice', again.written === 0 && again.unchanged === L2.length && (await linksOf()).length === L2.length)
    const same = await DR.saveVersion(copy.id, owner.id, { ...after.versions[1], purpose: 'Put the Code on a statutory footing (v3).' })
    const L3 = await linksOf()
    const liveL3 = L3.filter((l) => l.supersededById === null)
    ok('a new version naming the same targets SUPERSEDES the old rows (never deletes): old rows point at the new ones', same.ok && L3.length === 2 * L2.length && liveL3.length === L2.length && liveL3.every((l) => l.sourceDetail === `${owner.id} v3`) && L3.filter((l) => l.supersededById).every((l) => liveL3.some((n) => n.id === l.supersededById && n.relation === l.relation && n.docUri === l.docUri)))
    control('a superseded row still reading as live (must be FALSE)', L3.filter((l) => l.sourceDetail === `${owner.id} v2`).some((l) => l.supersededById === null))
    const dropped = await DR.saveVersion(copy.id, owner.id, { ...after.versions[1], precedents: [] })
    const L4 = await linksOf()
    const v4 = `${owner.id} v4`
    const prec3 = L4.find((l) => l.relation === 'precedent' && l.sourceDetail === `${owner.id} v3`)
    ok('a version that drops a target WITHDRAWS its row (withdrawn_at + detail together), never deletes it; the kept target is superseded as usual', dropped.ok && 'withdrawn' in dropped.data.lawRows && dropped.data.lawRows.withdrawn === 1 && dropped.data.lawRows.written === L2.length - 1 && L4.length === L3.length + L2.length - 1 && !!prec3 && !!prec3.withdrawnAt && prec3.withdrawnDetail === `${owner.id} instruction v4: target absent` && prec3.supersededById === null, JSON.stringify(dropped.ok && dropped.data.lawRows))
    control('a dropped target still reading as live after the drop (must be FALSE)', L4.some((l) => l.relation === 'precedent' && l.supersededById === null && l.withdrawnAt === null))
    ok('…the live set is exactly the v4 lines', L4.filter((l) => l.supersededById === null && l.withdrawnAt === null).every((l) => l.sourceDetail === v4))
    // Put the precedent back (a fifth version, the v3 targets again) so the pack and report below have the full instruction.
    const restored = await DR.saveVersion(copy.id, owner.id, after.versions[1])
    const L5 = await linksOf()
    ok('…and a version restoring the target writes a NEW row for it; the withdrawn row stays withdrawn, never un-withdrawn', restored.ok && 'written' in restored.data.lawRows && restored.data.lawRows.written === L2.length && restored.data.lawRows.superseded === L2.length - 1 && restored.data.lawRows.withdrawn === 0 && !!L5.find((l) => l.id === prec3?.id)?.withdrawnAt && L5.find((l) => l.id === prec3?.id)?.supersededById === null, JSON.stringify(restored.ok && restored.data.lawRows))
    // GRAPH's edge (23 Oct): a target still NAMED in the next version but no longer held keeps its earlier row live, and the save says
    // notHeld — so a live row and a not-held mention can never read as agreement. Fixtured without a stub: the earlier version's row is
    // written directly against an Act the corpus names but does not hold (check:idea-law B3), and the real save path then names it.
    const NAMED_NOT_HELD = 'ukpga/1970/1'
    const vNow = DR.draftOf(await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } }))!.versions.at(-1)!
    const planted = await prisma.ideaLawLink.create({ data: {
      ideaId: copy.id, actionId: owner.id, targetKind: 'act', docUri: NAMED_NOT_HELD, provisionPath: null, relation: 'relies_on',
      source: 'drafting_instruction', sourceDetail: `${owner.id} v${vNow.v}`, note: null, asAt: new Date(),
    } })
    const namedSave = await DR.saveVersion(copy.id, owner.id, { ...after.versions[1], provisions: [...after.versions[1].provisions, { docUri: NAMED_NOT_HELD, provisionPath: null, relation: 'relies_on', note: '' }] })
    const plantedNow = await prisma.ideaLawLink.findUniqueOrThrow({ where: { id: planted.id } })
    const namedRep = namedSave.ok && 'notHeld' in namedSave.data.lawRows ? namedSave.data.lawRows : null
    ok('a target still named but not held keeps its earlier row LIVE (neither superseded nor withdrawn)', plantedNow.supersededById === null && plantedNow.withdrawnAt === null, JSON.stringify({ s: plantedNow.supersededById, w: plantedNow.withdrawnAt }))
    ok('…the save reports it in notHeld as named-not-held', !!namedRep?.notHeld.some((n) => n.docUri === NAMED_NOT_HELD && n.state === 'named-not-held'), JSON.stringify(namedRep?.notHeld))
    ok('…and writes no new row for it', (await linksOf()).filter((l) => l.docUri === NAMED_NOT_HELD).length === 1)
    // Back to the full instruction without it: the planted row's target is now gone, so it is withdrawn like any other.
    const back = await DR.saveVersion(copy.id, owner.id, after.versions[1])
    ok('…and a version that drops it then withdraws it', back.ok && 'withdrawn' in back.data.lawRows && back.data.lawRows.withdrawn === 1 && !!(await prisma.ideaLawLink.findUniqueOrThrow({ where: { id: planted.id } })).withdrawnAt)
    await setSlot(copy.id, owner.id, 'against', { text: 'A slot answer written after the draft.' })
    const kept = DR.draftOf(await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: owner.id }, select: { record: true } }))
    ok('saving a step-2 slot afterwards does NOT drop the drafting instruction (parseRecord carries it)', (kept?.versions.length ?? 0) >= 2)
    void parseDraft

    section('§4 · what this touches (144, 209, 210, 229) — a cold read on the real statute book')
    const t = await TO.touchesFor({ ...EMPTY_INSTRUCTION, provisions: [
      { docUri: CRAG, provisionPath: 'section/5', relation: 'amends', note: '' },
      { docUri: 'bill/3812', provisionPath: null, relation: 'relies_on', note: '' },
      { docUri: 'ukpga/2099/999', provisionPath: null, relation: 'amends', note: '' },
      { docUri: 'aep/1540/42', provisionPath: null, relation: 'amends', note: '' },
    ] })
    const [s5, bill, made, named] = t.touches
    const heldS5 = await readSection('primary-acts-2000plus:ukpga/2010/25:section-5')
    ok('CRaG s.5: its HELD text appears, byte-identical to read_section', s5.state === 'held' && s5.heldText === heldS5.text, `${s5.state} ${s5.heldChars}`)
    const eff = await effectsFor(CRAG, { provision: 'section-5', edgeTypes: ['amends', 'repeals', 'modifies'], limitPerType: 1 })
    ok('…its effect counts equal the reader’s own, per type, with the unclassified count printed (not folded into 0)', JSON.stringify(s5.effects?.perType.map((c) => [c.type, c.total, c.changeTheWords, c.doNotChangeTheWords, c.unclassified])) === JSON.stringify(eff.perType.map((c) => [c.edgeType, c.total, c.byKind.textual, c.byKind['not-textual'], c.byKind.unclassified])))
    ok('…the load date and the freshness sentence come from the data (210)', !!s5.effects?.loadDate && s5.effects.freshness === eff.freshness.caveat && s5.effects.freshness.includes(s5.effects.loadDate!))
    const s10 = s5.near.find((n) => n.ref === 'section-10')
    ok('s.10 (merit) is listed as a near provision, with its question "consistent with this action? — not yet answered"', !!s10 && s10.question === 'consistent with this action? — not yet answered' && /merit|Selections/i.test(`${s10.title}`), JSON.stringify(s5.near.map((n) => n.number)))
    ok('a Bill renders "before Parliament — not yet law"', TO.STATE_WORDS[bill.state] === 'before Parliament — not yet law')
    ok('a made-up Act id renders "no such Act"', TO.STATE_WORDS[made.state] === 'no such Act')
    ok('an Act the record names but we hold none of renders "named, not held"', TO.STATE_WORDS[named.state] === 'named, not held', `${named.state}: ${named.stateReason}`)
    control('the three honest states collapsing into one word (must be FALSE)', new Set([bill.state, made.state, named.state]).size < 3)

    section('§4b/§4c · the Actions Pack and the Background Report, rendered')
    const snap = await buildProposalSnapshot(copy.id)
    const docx = await renderDocx(buildFor('ACTIONS_PACK', snap, null, { selection: { actionIds: [owner.id] } }).model)
    // A section's title is its RUNNING HEADER (word/headerN.xml), not body text: read both (as check:lex-26t2 does).
    const allText = async (buf: Buffer) => { const z = await JSZip.loadAsync(buf); const parts = Object.keys(z.files).filter((f) => f === 'word/document.xml' || /^word\/header\d+\.xml$/.test(f)); return (await Promise.all(parts.map((f) => z.file(f)!.async('string')))).join('\n') }
    const xml = await allText(docx)
    const W = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
    ok('the printed pack carries section 12 "Draft text" with the caveat as the clause’s first line', /12 Draft text|\.12 .{0,6}Draft text/.test(W) && W.includes(CLAUSE_CAVEAT), W.slice(W.indexOf('Draft text') - 40, W.indexOf('Draft text') + 300))
    ok('…section 13 "What this touches" with the honest states in words', /What this touches/.test(W) && W.includes('before Parliament — not yet law'))
    ok('…and the generated annexe with the counted sentence', /CONSEQUENTIAL AMENDMENTS AND REPEALS/i.test(W) && /Primary legislation: \d+ provisions? amended/.test(W))
    const bg = await renderDocx(buildFor('BACKGROUND_REPORT', snap, null, {}).model)
    const BX = (await allText(bg)).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
    ok('the Background Report prints the schedule counts and the precedent citations', /WHAT THE DRAFTED CLAUSES TOUCH/i.test(BX) && /Primary legislation: \d+ provision/.test(BX) && /Precedents drawn on: .*ukpga\/1972\/70/.test(BX))
  } finally {
    // Both idea_law_link FKs are RESTRICT: the scratch copy's links go first (superseding rows before the rows they replace).
    await prisma.ideaLawLink.updateMany({ where: { ideaId: copy.id }, data: { supersededById: null } })
    await prisma.ideaLawLink.deleteMany({ where: { ideaId: copy.id } })
    await deleteScratch(copy.id)
  }
}

async function main() {
  await part2()
  await part3and4()
  console.log(`\ncheck:lex-26u — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
