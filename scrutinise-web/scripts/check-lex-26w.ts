// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26w — BRIEF_26W §7. Real tools (through `execute`, the loop's one way in), the real button functions, a scratch copy of
// 452c5ade for anything that writes, and plain reads of 452c5ade for §5 (cold: this check writes nothing to Charlie's idea).
//
//   A  §5  the clean-up of #207 (cold read of 452c5ade)
//   B  §4b the proposals-list refusal on fixtures (+ the real Code passes), §2c instrumentLike, the clause readers, the templates
//   C  §4c read_source reads a 192,110-character filed Code whole, in parts; an extracts-only source says so
//   D  §2b/§2d parity: each document tool and its button's function, on twin documents, compared field by field; asks-first; the
//          "no second code path" guard, with a planted raw write it must catch
//   E  §2c the Action-details guard, through the real tools
//   F  §6  the step limit
//   G  §2a the inventory: every row matched by a tool that exists, or "none" with its reason
//   H  --live (spends): §4d/4e — CODE_TEXT drafted for #207 on scratch, n=3 (re-measure), each a Code; §7.6 a real Lex turn
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/check-lex-26w.ts [--live] [--keep]
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { execute, toolByName, MODEL_TOOLS, DOCUMENT_TOOLS } from '../lib/lex/agent/tools'
import { stepLimit, WRITING_MAX_ITERATIONS } from '../lib/lex/agent/loop'
import type { ToolCtx } from '../lib/lex/agent/types'
import * as DOCS from '../lib/lex/action-documents'
import * as DD from '../lib/lex/document-drafting'
import { readSourceText } from '../lib/lex/source-text'
import { enterPurpose } from '../lib/lex/build-context'
import { handleAgentTurn, handleConfirm } from '../lib/lex/agent/turn'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade-3153-400a-bf48-3b71aaa52773'
const LIVE = process.argv.includes('--live')
const KEEP = process.argv.includes('--keep')

let pass = 0, failN = 0, controls = 0, dead = 0
const ok = (label: string, cond: boolean, detail = '') => { if (cond) pass++; else failN++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${!cond && detail ? ` — ${detail}` : ''}`) }
/** A control: the property must NOT hold on a case built to break it. A control that holds is DEAD (it cannot tell). */
const control = (label: string, holds: boolean) => { controls++; if (holds) { dead++; console.log(`DEAD control: ${label}`) } else console.log(`  control fired: ${label}`) }

const ctxFor = (ideaId: string, userId: string, confirmed = false, userMessages: string[] = []): ToolCtx => ({
  ideaId, userId, confirmed, agreedPence: null,
  turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages, pastedText: null },
})
const run = (name: string, ctx: ToolCtx, input: unknown) => execute(toolByName(name)!, ctx, input)

// ── fixtures (§4b): a list of proposals about a code, and its control ──────────────────────────────────────────────────────
const PROPOSALS_LIST = [
  'Drafted by Lex from the action and its commentary; not settled.',
  '', '## 1. Ownership', 'The Code should set out that each task has one named owner.',
  '', '## 2. Records', 'Consider requiring short, dated records of goals and outcomes.',
  '', '## 3. Candour', 'We recommend that the Code include a duty of candour.',
  '', '## 4. Merit', 'The Code should include a definition of merit based on delivery.',
  '', '## 5. Handover', 'Add a requirement for a written handover.',
].join('\n')
const A_CODE = [
  'Drafted by Lex from the action and its commentary; not settled.',
  '', '## Introduction', 'This code applies to every person given responsibility for a publicly funded task.',
  '', '## Values', '“Ownership” is answering for a task from start to finish.',
  '', '## 1. One owner', 'You must name one owner for each task you assign. (clause C1)',
  '', '## 2. Records', 'You must keep short, dated records of your goals and outcomes. (clause 6)',
  '', '## 3. Candour', 'You must not alter a material record to avoid responsibility. (clause 12.e)',
].join('\n')

async function main() {
  enterPurpose('check')

  // ══ A — §5, cold, on 452c5ade ═════════════════════════════════════════════════════════════════════════════════════════
  console.log('\nA — §5: #207 on 452c5ade (plain reads)')
  const a207 = await prisma.lexCoherentAction.findFirst({ where: { ideaId: SOURCE, number: 207 }, select: { id: true, commentary: true } })
  const rev = await prisma.fieldRevision.findFirst({ where: { ideaId: SOURCE, targetId: a207?.id, origin: 'LEX_26W_305_MOVED_TO_DOCUMENT' } })
  const code = await prisma.actionDocument.findFirst({ where: { actionId: a207?.id, kind: 'CODE_TEXT' }, include: { versions: true } })
  const sections = rev ? rev.previousText.slice(rev.newText.length + 2) : ''
  ok('the 305 FieldRevision holds the 33,554-character state and the 17,946-character one', rev?.previousText.length === 33554 && rev?.newText.length === 17946)
  ok('the moved text is the four sections (15,606 characters, headings 1 to 4 of 4)', sections.length === 15606 && [1, 2, 3, 4].every((n) => sections.includes(`(${n} of 4)`)))
  ok('#207’s Action details no longer hold the draft Code', !!a207 && !/DRAFT CODE FOR APPROVAL/.test(a207.commentary ?? ''))
  ok('…and still begin with the 00:07 content (whatever Charlie has added since)', !!a207 && !!rev && (a207.commentary ?? '').startsWith(rev.newText.slice(0, 2000)))
  const holder = code?.versions.find((v) => v.body === sections)
  ok(`D.207.${code?.number} (code text) holds the four sections verbatim, as Lex’s ${holder?.role.toLowerCase()} ${holder?.v}`, !!holder && holder.author === 'LEX')
  const d1 = await prisma.actionDocument.findFirst({ where: { actionId: a207?.id, number: 1 }, include: { versions: true } })
  ok('D.207.1 (the clause) still holds its one proposal, dismissed, untouched', d1?.kind === 'DRAFT_CLAUSE' && d1.versions.length >= 1 && d1.versions[0].answer === 'DISMISSED')
  control('the moved text is NOT found in the Action details', (a207?.commentary ?? '').includes(sections.slice(0, 400)))

  // ══ B — pure ═════════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\nB — §4b refusal, §2c guard, clause readers, templates (pure)')
  const pl = DD.proposalShape('CODE_TEXT', PROPOSALS_LIST)
  ok(`a list of proposals is refused, in words (${pl.proposing}/${pl.paragraphs} proposing): “${pl.why?.slice(0, 90)}…”`, pl.refused && !!pl.why && /proposals/.test(pl.why))
  ok('the refusal sentence names the kind and says it was not saved', /code text was not saved/.test(DD.refusalSentence('CODE_TEXT', pl)))
  ok('a code (“You must …”, each with its clause) is not refused', !DD.proposalShape('CODE_TEXT', A_CODE).refused)
  const real = DD.proposalShape('CODE_TEXT', sections, { wholeDocument: false })
  ok(`the real Code moved by §5 is not refused as proposals (${real.proposing} of ${real.paragraphs} paragraphs propose)`, !!sections && !real.refused)
  const noDuties = A_CODE.replace(/You must (not )?/g, 'Owners ')
  ok('a code whose numbered paragraphs state no duty is refused (not by word count alone)', DD.proposalShape('CODE_TEXT', noDuties).refused)
  control('a proposals list passes as a code', !DD.proposalShape('CODE_TEXT', PROPOSALS_LIST).refused)
  ok('instrumentLike: the 2 Nov section heading “DRAFT CODE FOR APPROVAL” reads as an instrument', DD.instrumentLike('## DRAFT CODE FOR APPROVAL (1 of 4): Introduction\n\nText.').yes)
  ok('instrumentLike: three “You must” lines read as an instrument', DD.instrumentLike('You must a.\nYou must b.\nYou must not c.').yes)
  ok('instrumentLike: an explanation does not', !DD.instrumentLike('This action makes one person answer for each task. It draws on #38 and [Ref: 4].\nThe owner asked for brevity.').yes)
  const clauses = DD.clauseNumbers(rev?.newText ?? '')
  ok(`the Action details’ clauses are read (${clauses.size}: 1–15, 12.a–i, A1–H3)`, ['1', '8', '12.b', '15', 'A1', 'E2', 'H3'].every((c) => clauses.has(c)))
  ok('a duty’s cited clauses are read', DD.citedClauses('You must x. (clauses 12.b, E2)').join() === '12.b,E2')
  ok('every template opens its rules with “write the document itself”', DD.TEMPLATE_KINDS.every((k) => DD.templateSystem(k).includes(DD.THE_INSTRUMENT_RULE)))
  const body = DD.templateBody('CODE_TEXT', { parts: [{ role: 'introduction', heading: 'Introduction', text: 'Applies to all.' }, { role: 'principles', heading: 'Values', text: 'Ownership.' }, { role: 'duty', heading: 'One owner', text: '1. You must name one owner. (clause C1)' }], gaps: '', reason: '' }, { hasCommentary: true, allowedRefs: new Set() }).body
  ok('the code body: Introduction and Values named, the duties numbered from 1', /## Introduction\n/.test(body) && /## Values\n/.test(body) && /## 1\. One owner\nYou must/.test(body))
  ok('the specification’s sections are Purpose, Users, Records, Rules, Measures, Exclusions', DD.TEMPLATES.SPECIFICATION.named!.join() === 'Purpose,Users,Records,Rules,Measures,Exclusions')

  // ══ scratch ═════════════════════════════════════════════════════════════════════════════════════════════════════════
  const copy = await scratchCopy(SOURCE, '26-W')
  console.log(`\nscratch copy ${copy.id.slice(0, 8)}`)
  try {
    const ctx = ctxFor(copy.id, copy.userId)
    const ctxOk = ctxFor(copy.id, copy.userId, true)
    // the two filed Codes, copied with their numbers and whole text
    const srcRows = await prisma.ideaSource.findMany({ where: { ideaId: SOURCE, number: { in: [217, 218] } } })
    for (const s of srcRows) {
      const m = await prisma.ideaUserMaterial.findUnique({ where: { id: s.materialId! } })
      const { id: _mid, ideaId: _mi, ...mrest } = m!
      const nm = await prisma.ideaUserMaterial.create({ data: { ...mrest, ideaId: copy.id } as never })
      const { id: _sid, ideaId: _si, materialId: _sm, ...srest } = s
      await prisma.ideaSource.create({ data: { ...srest, ideaId: copy.id, materialId: nm.id } as never })
    }
    await prisma.ideaSource.create({ data: { ideaId: copy.id, number: 900, kind: 'OWN_OBSERVATION', title: 'zz-26w observation', snippet: 'A short summary only, twenty words or so, of something the owner saw.' } })

    // ══ C — read_source ══════════════════════════════════════════════════════════════════════════════════════════════
    console.log('\nC — §4c read_source, through the tool')
    const mgmt = await prisma.ideaUserMaterial.findFirst({ where: { ideaId: copy.id, label: 'Civil Service Management Code' } })
    let from: number | undefined = 0, parts = 0, text = ''
    let complete = false
    while (from != null && parts < 40) {
      const r = await run('read_source', ctx, { ref: 217, from })
      const d = r.data as { held: string; nextFrom?: number; complete: boolean }
      text += (r.untrusted ?? '').split('\n').slice(1, -2).join('\n') // the fenced block: the text between the tags
      parts++; complete = d.complete; from = d.nextFrom
      if (!r.ok || d.held !== 'full text') break
    }
    const whole = await readSourceText(copy.id, { ref: 217 }, { size: 30_000 })
    let all = ''; let f: number | undefined = 0
    while (f != null) { const r = await readSourceText(copy.id, { ref: 217 }, { from: f, size: 30_000 }); if (!r.ok) break; all += r.data.text; f = r.data.nextFrom }
    ok(`[Ref: 217] (${mgmt?.text?.length.toLocaleString('en-GB')} characters) is read to the end through the tool, in ${parts} parts`, complete && parts === Math.ceil((mgmt?.text?.length ?? 0) / 15_000))
    ok('…and the parts put together are the held text exactly', all === mgmt?.text && whole.ok)
    const cs = await run('read_source', ctx, { ref: 218 })
    ok('[Ref: 218] (the Civil Service Code, 12,446 characters) comes back whole in one part', (cs.data as { complete: boolean; characters: { total: number } }).complete && (cs.data as { characters: { total: number } }).characters.total === 12446)
    const obs = await run('read_source', ctx, { ref: 900 })
    ok('a source held only as a summary says “summary only”, never “full text”', (obs.data as { held: string }).held === 'summary only')
    control('the summary-only source reads as full text', (obs.data as { held: string }).held === 'full text')
    ok('a reference that does not exist is refused in words', !(await run('read_source', ctx, { ref: 9999 })).ok)

    // ══ D — parity ═══════════════════════════════════════════════════════════════════════════════════════════════════
    console.log('\nD — §2b/§2d parity: tool vs button, twin documents, field by field')
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id, status: 'LIVE' }, orderBy: { number: 'asc' }, take: 2, select: { id: true, number: true } })
    const [x, y] = live
    const seed = (aid: string) => DOCS.writeTextProposal(copy.id, aid, 'OPERATING_TEXT', 'Operating text', { body: '## 1. Rule\n\nThe owner records the goal.', reason: 'fixture', pence: null, sources: [] })
    const dx = await seed(x.id), dy = await seed(y.id)
    const snapshot = async (documentId: string) => {
      const d = await prisma.actionDocument.findUnique({ where: { id: documentId }, include: { versions: { orderBy: [{ role: 'asc' }, { v: 'asc' }] } } })
      return JSON.stringify({ kind: d!.kind, status: d!.status, acceptedV: d!.acceptedV, versions: d!.versions.map((v) => ({ role: v.role, v: v.v, author: v.author, body: v.body, answer: v.answer, payload: v.payload, sources: v.sources })) })
    }
    // asks first
    for (const name of ['use_proposal', 'accept_document', 'set_aside_proposal', 'redraft_document', 'review_document', 'draft_document']) {
      const r = await run(name, ctx, name === 'draft_document' ? { action: x.number } : { d: dx.d })
      ok(`${name} asks first: nothing runs without the confirm card`, !r.ok && !!r.pending)
    }
    const pr = await run('redraft_document', ctx, { d: dx.d })
    ok(`redraft_document’s card carries the measured price (${pr.pending?.pence}p, ${pr.pending?.priceSource})`, pr.pending?.pence === DD.kindPrice('OPERATING_TEXT').pence)
    // Use it
    const u1 = await run('use_proposal', ctxOk, { d: dx.d }); const u2 = await DOCS.useTextProposal(copy.id, dy.documentId)
    ok('use_proposal (tool) and “Use it” (useTextProposal) store the same document', u1.ok && u2.ok && (await snapshot(dx.documentId)) === (await snapshot(dy.documentId)))
    // Accept
    const c1 = await run('accept_document', ctxOk, { d: dx.d }); const c2 = await DOCS.acceptDocument(copy.id, dy.documentId)
    ok('accept_document and “Accept version N” store the same document', c1.ok && c2.ok && (await snapshot(dx.documentId)) === (await snapshot(dy.documentId)))
    // Set aside
    await seed(x.id); await seed(y.id)
    const s1 = await run('set_aside_proposal', ctxOk, { d: dx.d }); const s2 = await DOCS.setAsideTextProposal(copy.id, dy.documentId)
    ok('set_aside_proposal and “Set aside” store the same document', s1.ok && s2.ok && (await snapshot(dx.documentId)) === (await snapshot(dy.documentId)))
    // Lex's words: propose_document_text start + append, vs the drafter's writer, on the body
    const said = 'please write the code text for 207 now'
    const ctxW = ctxFor(copy.id, copy.userId, false, [said])
    const prov = { kind: 'user_words', quote: said, refs: [] }
    const st = await run('propose_document_text', ctxW, { action: 207, kind: 'CODE_TEXT', mode: 'start', heading: 'Introduction', text: 'This code applies to every owner of a publicly funded task.', provenance: prov })
    const dCode = (st.data as { d: string }).d
    const ap = await run('propose_document_text', ctxW, { d: dCode, mode: 'append', heading: '1. One owner', text: 'You must name one owner for each task. (clause C1)', provenance: prov })
    const doc207 = await prisma.actionDocument.findFirst({ where: { ideaId: copy.id, kind: 'CODE_TEXT', number: Number(dCode.split('.')[2]) }, include: { versions: true } })
    const waiting = doc207?.versions.filter((v) => v.role === 'PROPOSAL' && !v.answer) ?? []
    ok(`propose_document_text writes a waiting LEX proposal on ${dCode}, a section per call (start + append = one proposal, two sections)`, st.ok && ap.ok && waiting.length === 1 && waiting[0].author === 'LEX' && (waiting[0].body.match(/^## /gm) ?? []).length === 2)
    ok('…with no version written: the owner’s versions are untouched', !doc207?.versions.some((v) => v.role === 'VERSION'))
    const refused = await run('propose_document_text', ctxW, { d: dCode, mode: 'append', heading: 'What it should cover', text: 'The Code should cover handover.\n\nConsider adding a duty of candour.\n\nWe recommend a merit definition.', provenance: prov })
    ok(`a section that is a list of proposals is refused from chat, in words: “${refused.error?.slice(0, 80)}…”`, !refused.ok && /not saved/.test(refused.error ?? ''))
    // the "no second code path" guard: the document tools' source names the button functions and writes nothing itself
    const src = readFileSync('lib/lex/agent/tools.ts', 'utf8')
    const block = src.slice(src.indexOf('// ══ 26-W §2b (decision 301)'), src.indexOf('export const DOCUMENT_TOOLS'))
    const rawWrite = /prisma\.(?:actionDocument|actionDocumentVersion|lexCoherentAction)\.(?:create|update|updateMany|upsert|delete)/
    ok('the document tools write only through the buttons’ functions (no raw write in their source)', block.length > 2000 && !rawWrite.test(block))
    const planted = block.replace('await DOCS.useTextProposal(ctx.ideaId, doc.id)', 'await prisma.actionDocumentVersion.update({ where: { id: doc.id }, data: {} })')
    ok('(the planted raw write landed in the copy of the source)', planted !== block)
    control('a tool that writes through its own path passes the guard', !rawWrite.test(planted))
    for (const [tool, fn] of [['use_proposal', 'DOCS.useTextProposal'], ['accept_document', 'DOCS.acceptDocument'], ['set_aside_proposal', 'DOCS.setAsideTextProposal'], ['review_document', 'REV.reviewDocument'], ['draft_document', 'DD.queueDrafting'], ['redraft_document', 'DD.draftKindDocument']]) {
      const at = block.indexOf(`name: '${tool}'`)
      ok(`${tool} calls ${fn}`, at > 0 && block.slice(at, at + 2600).includes(fn))
    }

    // ══ E — §2c ══════════════════════════════════════════════════════════════════════════════════════════════════════
    console.log('\nE — §2c the Action-details guard, through the real tools')
    const before = (await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: 207 }, select: { commentary: true } }))!.commentary
    const sec1 = sections.slice(0, sections.indexOf('\n\n## DRAFT CODE FOR APPROVAL (2 of 4)'))
    const g1 = await run('add_action_details_section', ctxW, { action: 207, heading: sec1.split('\n')[0].replace(/^## /, ''), text: sec1.split('\n').slice(2).join('\n'), provenance: prov })
    const after = (await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: 207 }, select: { commentary: true } }))!.commentary
    ok(`2 Nov’s section 1 (${sec1.length} characters) is refused from the Action details and pointed at propose_document_text`, !g1.ok && /propose_document_text/.test(g1.error ?? '') && after === before)
    const g2 = await run('set_action_detail', ctxW, { action: 207, detail: 'The owner wants this short: one page.', provenance: prov })
    ok('an explanation still goes in', g2.ok)
    const many = Array.from({ length: 60 },(_, i) => `${i + 1}. You must do thing ${i + 1} on time and record it in the register.`).join('\n')
    const g3 = await run('set_action_detail', ctxFor(copy.id, copy.userId, false, [said]), { action: 207, detail: many, provenance: prov })
    ok(`${many.length} characters of “You must” provisions are refused`, !g3.ok)
    control('instrument text over the limit goes into Action details', g3.ok)

    // ══ F — §6 ════════════════════════════════════════════════════════════════════════════════════════════════════════
    console.log('\nF — §6 the step limit')
    ok('a turn that writes nothing keeps 8 steps', stepLimit([{ name: 'search_corpus', ok: true }]) === 8)
    ok(`a turn that has saved a section of a document gets ${WRITING_MAX_ITERATIONS}`, stepLimit([{ name: 'propose_document_text', ok: true }]) === WRITING_MAX_ITERATIONS)
    ok('…as does one writing Action details in sections', stepLimit([{ name: 'add_action_details_section', ok: true }]) === WRITING_MAX_ITERATIONS)
    control('a failed write raises the limit', stepLimit([{ name: 'propose_document_text', ok: false }]) !== 8)

    // ══ G — §2a ══════════════════════════════════════════════════════════════════════════════════════════════════════
    console.log('\nG — §2a the document view inventory: every row matched, or none with a reason')
    const INVENTORY: Array<[string, string]> = [
      ['Edit → Save as a new version (text document)', 'none, by decision 301: the owner’s own words; Lex writes a proposal (propose_document_text) and the owner uses it'],
      ['Edit → save (drafting instruction)', 'none, by decision 301: as above; redraft_document is Lex’s way in'],
      ['Ask Lex to redraft (instruction, explanatory note)', 'redraft_document'],
      ['Use it as version N', 'use_proposal'],
      ['Accept version N', 'accept_document'],
      ['Set aside (text proposal, instruction proposal)', 'set_aside_proposal'],
      ['Take all → Save as version N (clause)', 'use_proposal'],
      ['Review this draft → Review it / Review again', 'review_document'],
      ['Generate again (collision report)', 'generate_collision_report'],
      ['Add a draft (by hand)', 'propose_document_text'],
      ['Draft what this action needs', 'draft_document'],
      ['Draft what this heading needs', 'none, in 26-W-b: draft_document covers one action; a heading-wide run is the next part'],
      ['(reading) the draft view', 'read_document'],
      ['(reading) the drafts tree', 'list_documents'],
    ]
    const names = new Set(MODEL_TOOLS.map((t) => t.name))
    for (const [row, tool] of INVENTORY) ok(`“${row}” → ${tool.startsWith('none') ? tool : tool}`, tool.startsWith('none') ? tool.length > 20 : names.has(tool))
    ok(`every document tool is offered to the model (${DOCUMENT_TOOLS.length})`, DOCUMENT_TOOLS.every((t) => names.has(t.name)))

    // ══ H — live ═════════════════════════════════════════════════════════════════════════════════════════════════════
    if (LIVE) {
      console.log('\nH — --live: CODE_TEXT for #207 on scratch, n=3 (spends)')
      // the scratch #207 carries Charlie's restored Action details (17,946); the Codes are filed as 217 and 218
      const s207 = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: 207 }, select: { id: true, commentary: true } })
      const clauses207 = DD.clauseNumbers(s207!.commentary ?? '')
      const runs: Array<{ pence: number; seconds: number }> = []
      const N = Number(process.argv.includes('--runs') ? process.argv[process.argv.indexOf('--runs') + 1] : 3)
      const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null
      for (let i = 0; i < (process.argv.includes('--chat-only') ? 0 : N); i++) {
        const input = (await DD.kindInput(copy.id, s207!.id))!
        input.model = await DD.modelSourceFor(copy.id, input.detail)
        const t0 = Date.now()
        const r = await DD.composeKindDocument('CODE_TEXT', input, { ideaId: copy.id, userId: copy.userId })
        const secs = Math.round((Date.now() - t0) / 100) / 10
        if (!r.ok) { ok(`run ${i + 1}: the code text was drafted`, false, (r as { error: string }).error); continue }
        runs.push({ pence: r.data.pence ?? 0, seconds: secs })
        const b = r.data.body
        const duties = [...b.matchAll(/^## (\d+)\. .*\n([\s\S]*?)(?=\n## |\s*$)/gm)]
        const traced = duties.filter((m) => { const c = DD.citedClauses(m[2]); return c.length && c.every((k) => clauses207.has(k)) })
        const heads = [...b.matchAll(/^## (.*)$/gm)].map((m) => m[1])
        console.log(`  run ${i + 1}: ${r.data.pence?.toFixed(2)}p, ${secs}s, ${duties.length} duties, ${traced.length} traced; headings: ${heads.slice(0, 4).join(' | ')} …`)
        ok(`run ${i + 1}: modelled on [Ref: ${input.model?.ref}] (the Civil Service Code, held whole)`, input.model?.ref === 218 && input.model.text.length === input.model.total)
        ok(`run ${i + 1}: opens with an introduction and values, then numbered duties`, !/^\d/.test(heads[0] ?? '1') && !/^\d/.test(heads[1] ?? '1') && duties.length >= 5)
        ok(`run ${i + 1}: every duty cites a clause the Action details hold (${traced.length}/${duties.length})`, traced.length === duties.length)
        ok(`run ${i + 1}: no paragraph is a proposal (${DD.proposalShape('CODE_TEXT', b).proposing} of ${DD.proposalShape('CODE_TEXT', b).paragraphs})`, DD.proposalShape('CODE_TEXT', b).proposing === 0)
        if (OUT) (await import('node:fs')).writeFileSync(`${OUT}/26w-code-run${i + 1}.md`, b)
        for (const m of duties.filter((d) => !traced.includes(d))) console.log(`    untraced duty ${m[1]}: cites [${DD.citedClauses(m[2]).join(', ')}] — ${m[2].slice(-160).replace(/\n/g, ' ')}`)
        for (const p of DD.bodyParagraphs(b).filter(DD.isProposing)) console.log(`    proposing? ${p.slice(0, 200)}`)
      }
      // §7.6 — a real Lex turn, then the owner's Confirm through the real confirm handler
      console.log('\nH2 — §7.6: Lex in chat, “redraft … as a Code modelled on [Ref: 218]”')
      const seeded = await DOCS.writeTextProposal(copy.id, s207!.id, 'CODE_TEXT', 'Code text', { body: sections, reason: 'fixture: the 2 Nov chat draft', pence: null, sources: [] })
      const detailsBefore = (await prisma.lexCoherentAction.findUnique({ where: { id: s207!.id }, select: { commentary: true } }))!.commentary
      const message = `Redraft ${seeded.d} as a Code modelled on [Ref: 218].`
      const t = await handleAgentTurn({ ideaId: copy.id, user: { id: copy.userId }, idea: { id: copy.id, creatorId: copy.userId, aiChatHistory: [] }, message, clientTurnId: `check26w-${Date.now()}` })
      const hist = ((await prisma.idea.findUnique({ where: { id: copy.id }, select: { aiChatHistory: true } }))!.aiChatHistory as Array<{ role: string; pending?: Array<{ token: string; summary: string; pence: number | null }> }>)
      const pend = hist.at(-1)?.pending ?? []
      console.log(`  turn: ${t.result?.ended}, ${t.result?.cost.pence.toFixed(2)}p, tools: ${t.result?.toolLog.map((x) => x.name).join(', ')}; cards: ${pend.map((p) => `${p.summary} (${p.pence}p)`).join(' · ')}`)
      if (OUT) (await import('node:fs')).writeFileSync(`${OUT}/26w-chat-turn.json`, JSON.stringify({ toolLog: t.result?.toolLog, reply: hist.at(-1) }, null, 1))
      ok('Lex took the owner’s own path: “Redraft”, offered as a priced confirm card (it wrote nothing itself)', pend.some((p) => /Redraft/.test(p.summary) && p.pence != null))
      const card = pend.find((p) => /Redraft/.test(p.summary))
      if (card) {
        const c = await handleConfirm({ ideaId: copy.id, user: { id: copy.userId }, idea: (await prisma.idea.findUnique({ where: { id: copy.id }, select: { id: true, creatorId: true, aiChatHistory: true } }))! as never, token: card.token })
        console.log(`  confirm: ${c.status} ${JSON.stringify(c.body).slice(0, 200)}`)
      }
      const docAfter = await prisma.actionDocument.findUnique({ where: { id: seeded.documentId }, include: { versions: { where: { role: 'PROPOSAL' }, orderBy: { v: 'asc' } } } })
      const newest = docAfter?.versions.at(-1)
      ok(`after Confirm, ${seeded.d} has a new waiting proposal (proposal ${newest?.v}), the old one kept and set aside`, !!newest && newest.v > seeded.v && !newest.answer && docAfter!.versions.find((v) => v.v === seeded.v)?.answer === 'DISMISSED')
      if (OUT && newest) (await import('node:fs')).writeFileSync(`${OUT}/26w-chat-proposal.md`, newest.body)
      const shapeChat = newest ? DD.proposalShape('CODE_TEXT', newest.body) : null
      ok(`…and it is a Code (${shapeChat?.dutiesWithMust}/${shapeChat?.duties} duties with “must”, ${shapeChat?.proposing}/${shapeChat?.paragraphs} proposing)`, !!shapeChat && !shapeChat.refused, shapeChat?.why)
      ok('#207’s Action details are unchanged by the turn', (await prisma.lexCoherentAction.findUnique({ where: { id: s207!.id }, select: { commentary: true } }))!.commentary === detailsBefore)

      if (runs.length) console.log(`\n  PASTE into KIND_RUNS.CODE_TEXT:\n${runs.map((r) => `    { pence: ${r.pence.toFixed(2)}, seconds: ${r.seconds}, on: 'scratch copy of 452c5ade, ${new Date().toISOString().slice(0, 10)} (#207, 26-W template, modelled on [Ref: 218])' },`).join('\n')}`)
    } else console.log('\nH — NOT RUN (live; pass --live): §4d re-measure, §4e the Code draft, §7.6 the chat turn')
  } finally {
    if (KEEP) console.log(`kept scratch copy ${copy.id}`)
    else console.log(`scratch copy deleted: ${await deleteScratch(copy.id)}`)
  }
  console.log(`\ncheck:lex-26w ${pass}/${pass + failN} passed, ${controls} controls, ${dead} dead${LIVE ? '' : ' (H not run)'}`)
  if (failN || dead) process.exitCode = 1
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
