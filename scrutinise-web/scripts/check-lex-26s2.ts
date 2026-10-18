// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 (BRIEF_26S2 §12) — check:lex-26s2.   This file grows with the sprint: §10 (the import fix, item 5 of §12) and, from sprint 1, the four steps (item 1: A–D below).
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s2.ts          (offline + a scratch idea, NO model spend)
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s2.ts --live   (+ the real model on the dense fixture: SPENDS pence)
//
// §10.7 in three cases:
//   (1) a dense section — 30 provisions in ~800 words — imports with NO user action (the part is cut by DENSITY, and a part that is still
//       too big for one call is split by the pass itself);
//   (2) a part forced to truncate at the floor shows the final message ONCE, says nothing about "budgets", and leaves the other parts intact;
//   (3) "Retry part N" re-reads only that part.
// The model is stood in for by the module's own seam (`modelCaller`) so the TRUNCATION can be forced; --live runs the real one on case (1).
// Counts what RAN (§23.2); every value assertion has a control that stays false.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import * as I from '../lib/lex/action-import'
import * as T from '../lib/lex/action-import-types'
import * as RN from '../lib/lex/research-notes'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ActionsWorkspace from '../components/lex/ActionsWorkspace'
import ActionsSteps from '../components/lex/ActionsSteps'
import * as ST from '../lib/lex/action-steps'
import { computeCanonicalState } from '../lib/lex/state'
import * as FM from '../lib/lex/field-machine'
import * as FP from '../components/lex/FieldsPanel'
import * as RC from '../lib/lex/action-record'
import * as SL from '../lib/lex/action-slots'
import * as F from '../lib/lex/action-facets'
import { Prisma } from '@prisma/client'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import * as DOCS from '../lib/documents/build-proposal'
import * as BC from '../lib/lex/build-context'
import * as SP from '../lib/lex/spend-ledger'
import * as SO from '../lib/lex/spend-origin'
import * as SA from '../lib/lex/spend-admin'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import * as S from '../lib/lex/action-structure'
import { execute, toolByName } from '../lib/lex/agent/tools'
import { LIMITS } from '../lib/lex/input-limits'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const LIVE = process.argv.includes('--live')
/** --live-policy: spend on part F only (the real model tests four untested actions on a scratch idea; a few pence). */
const LIVE_POLICY = LIVE || process.argv.includes('--live-policy')
/** --live-slots: spend on part K+ only (the real model proposes step 2 on a scratch copy; tens of pence). */
const LIVE_SLOTS = LIVE || process.argv.includes('--live-slots')
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
const DEV_WORDS = /raise the budget|max_tokens|maxOutputTokens|shorten the input|truncated:/i

/** A docx-shaped dense section: a heading and 30 separate rules, one paragraph each (~26 words), about 800 words in all. */
function denseDocument(): { text: string; rules: string[] } {
  const subjects = ['the permanent secretary', 'the accounting officer', 'a director general', 'the departmental board', 'the responsible minister', 'the Cabinet Secretary']
  const duties = ['record the decision and the reasons for it', 'publish the evidence relied on', 'name the single lead owner', 'state what would change the decision', 'report the outcome against the stated measure', 'disclose any dissent in writing']
  const topics = ['procurement','recruitment','secondments','grants','inspections','contracts','audits','appointments','budgets','tribunals','licensing','transfers','dismissals','promotions','training','whistleblowing','complaints','records','estates','digital systems','pensions','conduct','appraisal','handovers','guidance','sanctions','reviews','delegations','forecasts','reporting']
  const rules: string[] = []
  for (let i = 0; i < 30; i++) {
    rules.push(`Rule ${i + 1}. Where a decision about ${topics[i]} is taken, ${subjects[i % subjects.length]} must ${duties[(i * 5) % duties.length]} within ${10 + (i % 7) * 5} working days and keep the record for ${3 + (i % 4)} years.`)
  }
  return { text: ['9. Core rules to include', ...rules].join('\n\n'), rules }
}

function partA() {
  section('A · offline — cut by DENSITY, and split by the pass itself')
  const { text, rules } = denseDocument()
  const words = T.wordCount(text)
  ok(`the fixture is what the brief says: 30 provisions in ~800 words (${words} words)`, rules.length === 30 && words > 700 && words < 1000)
  const parts = I.planChunks(text)
  ok('by words alone it would be ONE part (800 < the 2,600-word ceiling) — density cuts it into more than one', words < I.CHUNK_WORDS && parts.length >= 2, `${parts.length} parts`)
  ok(`…and no part is estimated above the cap (${I.PROVISION_CAP} provisions)`, parts.every((p) => I.provisionsIn(text.slice(p.from, p.to)) <= I.PROVISION_CAP), parts.map((p) => I.provisionsIn(text.slice(p.from, p.to))).join(','))
  control('the same fixture cut by the OLD rule (words only, no density) comes out as one part', I.planChunks(text, I.CHUNK_WORDS, 10_000).length !== 1)
  ok('the parts are exact slices that together cover every rule, none twice', (() => {
    const joined = parts.map((p) => text.slice(p.from, p.to)).join('\n\n')
    return rules.every((r) => joined.split(r).length === 2)
  })())
  ok('a table of 30 rows with NO blank lines is cut at its rows too', (() => {
    const table = ['| Rule | Duty |', '|---|---|', ...Array.from({ length: 40 }, (_, i) => `| ${i + 1} | The body must do thing number ${i + 1} within ${i + 5} days. |`)].join('\n')
    return I.planChunks(table).length >= 2
  })())
  ok('density is read from the document\'s own structure: list items count, a heading does not', I.provisionsIn('# Heading\n\n- one rule here\n- another rule here\n- a third rule here') === 3 && I.provisionsIn('A short heading') === 0)

  // the split itself
  const s = I.splitRange(text, 0, text.length)
  ok('splitRange cuts a part in two at a paragraph boundary, near the middle', !!s && s[0].from === 0 && s[1].to === text.length && s[0].to < s[1].from && Math.abs(I.provisionsIn(text.slice(s[0].from, s[0].to)) - I.provisionsIn(text.slice(s[1].from, s[1].to))) <= 3)
  ok('…both halves begin and end on a whole rule (no rule is cut in two)', !!s && rules.every((r) => { const a = text.slice(s[0].from, s[0].to).includes(r), b = text.slice(s[1].from, s[1].to).includes(r); return a !== b }))
  const small = rules.slice(0, 6).join('\n\n')
  ok('at the floor (<= 250 words) a part is NOT split', T.wordCount(small) <= I.SPLIT_FLOOR_WORDS && I.splitRange(small, 0, small.length) === null)
  control('a 700-word part refusing to split (must be FALSE)', I.splitRange(text, 0, text.length) === null)

  // words on the screen
  const lib = read('lib/lex/action-import.ts')
  const failureSites = lib.match(/chunk\.error\s*=\s*[^\n]*/g) ?? []
  ok('no developer word reaches a user: no chunk.error is built from the model\'s own detail', failureSites.length >= 2 && failureSites.every((l) => !/f\.detail|\.detail|\$\{f\./.test(l) && !DEV_WORDS.test(l)), failureSites.join(' | ').slice(0, 300))
  ok('…the detail goes to the LOG (console.warn)', /console\.warn\('\[action-import\] part failed'/.test(lib))
  ok('the per-part output ceiling is above the old 14,000', I.ITEMS_MAX_OUTPUT_TOKENS > 14000)
  const ui = read('components/lex/ActionImport.tsx')
  ok('the panel offers "Retry part N" and stops the automatic reading while a part waits', /Retry part \{partName\(c\)\}/.test(ui) && /chunks\.some\(chunkNeedsYou\)\) return/.test(ui))
  ok('…and says "n of m parts read"', /parts read — /.test(ui))
  ok('the estimate rests on the real run (n=4 now) and the confirm card says the cost is measured', T.IMPORT_RUNS.length >= 4 && /measured on this document/.test(ui))
}

type Caller = typeof I.modelCaller.current
/** A stand-in for the model: reads the part's text and returns one NEW item per rule paragraph; `maxRules` forces a TRUNCATION when a part holds more. */
function stub(maxRules: number, log: { calls: number; truncated: number; sizes: number[] }): Caller {
  return (async (o: { user: string; label?: string }) => {
    const usage0 = { model: 'stub', tokensIn: 10, tokensOut: 10, recorded: { pence: 0.05 } }
    if (o.label === 'action-import-structure') return { ok: true, usage: usage0, value: { purposes: [], existing: [] } }
    if (o.label === 'action-import-test') {
      const lines = o.user.split('\n').filter((l) => /^\[\d+\]/.test(l))
      return { ok: true, usage: usage0, value: { groups: lines.map((l) => ({ members: [Number(l.match(/^\[(\d+)\]/)![1])], text: l.replace(/^\[\d+\]\s*\([^)]*\)\s*/, ''), verdict: 'FITS', reason: 'stub' })) } }
    }
    log.calls++
    const body = o.user.split('--- document text begins ---')[1].split('--- document text ends ---')[0]
    const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => /^Rule \d+\./.test(p))
    log.sizes.push(paras.length)
    const usage = { model: 'stub', tokensIn: 100, tokensOut: 100, recorded: { pence: 0.1 } }
    if (paras.length > maxRules) { log.truncated++; return { ok: false, reason: 'truncated', detail: '[action-import-chunk] cut off at max_tokens=20000 — raise the budget or shorten the input', usage } }
    return { ok: true, usage, value: { items: paras.map((p, i) => ({ section: p.split('.')[0], quote: p, proposal: 'NEW', headingName: 'Core rules', reason: 'a rule', title: `Action on ${(p.match(/about ([a-z ]+) is taken/) ?? [])[1] ?? i}`, summary: `  days  years` })) } }
  }) as unknown as Caller
}

async function partB() {
  section('B · a scratch idea — the whole pass, the real library, the model stood in for (no spend)')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2')
  const id = copy.id
  const OWNER: RN.Viewer = { id: owner.id, isOwner: true }
  const real = I.modelCaller.current
  try {
    const actionsBefore = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
    const { text, rules } = denseDocument()
    const added = await RN.addNote(id, { id: owner.id }, OWNER, { op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'A dense section of rules', fullText: text, rightsConfirmed: true, readStatus: 'READ' } } as never, { readIntoFindings: false })
    ok('the dense document is filed and numbered', added.ok)
    const ref = (added as { data: { ref: number } }).data.ref
    const run = async (label: string, caller: Caller, maxSteps = 60) => {
      I.modelCaller.current = caller
      const st = await I.startImport(id, owner.id, ref)
      if (!st.ok) throw new Error((st as { error: string }).error)
      let view = st.data
      for (let i = 0; i < maxSteps && view.status === 'MAPPING' && !view.mapping.chunks.some(T.chunkNeedsYou); i++) {
        const r = await I.advanceImport(id, owner.id, view.id)
        if (!r.ok) throw new Error(`${label}: ${(r as { error: string }).error}`)
        view = r.data
      }
      return view
    }

    // (1) the model can read at most 9 rules per call, though the density rule allowed ~25: the pass must split on its own.
    const log1 = { calls: 0, truncated: 0, sizes: [] as number[] }
    const v1 = await run('dense', stub(9, log1))
    ok('(1) DENSE: the import reaches READY with no user action at all', v1.status === 'READY', `${v1.status} ${v1.failure ?? ''}`)
    ok('…every one of the 30 provisions is a row', v1.mapping.items.length === 30 && rules.every((r) => v1.mapping.items.some((it) => it.quote.includes(r.slice(0, 40)))), `${v1.mapping.items.length} rows`)
    ok('…the pass split the too-dense part by itself (>= 1 truncation met, then halves read)', log1.truncated >= 1 && v1.mapping.chunks.some((c) => /[ab]$/.test(c.part ?? '')), `truncated ${log1.truncated}, parts ${v1.mapping.chunks.map((c) => c.part).join(',')}`)
    ok('…the pass kept the parts that read: every part is DONE and none was read twice', v1.mapping.chunks.every((c) => c.status === 'DONE') && v1.chunksDone === v1.mapping.chunks.length)
    ok('…no part is both split and kept (the parent is replaced by its halves)', new Set(v1.mapping.chunks.map((c) => c.index)).size === v1.mapping.chunks.length)
    ok('…each part carries its measured pence, tokens and seconds', v1.mapping.chunks.every((c) => typeof c.pence === 'number' && typeof c.outTokens === 'number' && typeof c.seconds === 'number'))
    ok('…and nothing was written to the actions before confirm', (await prisma.lexCoherentAction.count({ where: { ideaId: id } })) === actionsBefore)
    control('a pass that needed no split reported as having split (must be FALSE)', (await (async () => { const l = { calls: 0, truncated: 0, sizes: [] as number[] }; const c = stub(1000, l); const parts = I.planChunks(text); for (const p of parts) await c({ user: `--- document text begins ---${text.slice(p.from, p.to)}--- document text ends ---` } as never); return l.truncated > 0 })()))
    await I.discardImport(id, v1.id)

    // (2) a part that cannot be read even at the floor: stuck, said ONCE, the others kept
    // Force: the part holding "Rule 30." can never be read (not at any size); every other part reads.
    const log3 = { calls: 0, truncated: 0, sizes: [] as number[] }
    const poison: Caller = (async (o: { user: string }) => {
      const body = o.user.split('--- document text begins ---')[1].split('--- document text ends ---')[0]
      if (/Rule 30\./.test(body)) { log3.calls++; log3.truncated++; return { ok: false, reason: 'truncated', detail: '[action-import-chunk] cut off at max_tokens=20000 — raise the budget or shorten the input', usage: { model: 'stub', tokensIn: 1, tokensOut: 1, recorded: { pence: 0.1 } } } }
      return stub(1000, log3)(o as never)
    }) as unknown as Caller
    const v2 = await run('floor', poison)
    const stuck = v2.mapping.chunks.filter(T.chunkNeedsYou)
    ok('(2) FLOOR: a part that cannot be read even in small pieces leaves the pass WAITING, not failed', v2.status === 'MAPPING' && stuck.length === 1, `${v2.status}; stuck ${stuck.length}`)
    const msg = v2.failure ?? ''
    ok('…the message is final, in plain words, and says nothing was written', /could not be read even in small pieces/.test(msg) && /Nothing has been written|Nothing was written/.test(msg), msg)
    ok('…it never says "raise the budget" (or any developer word) — anywhere in the view', !DEV_WORDS.test(JSON.stringify(v2)), msg)
    ok('…it appears ONCE', msg.split('could not be read even in small pieces').length === 2)
    ok('…the other parts are intact: DONE, with their rows', v2.mapping.chunks.filter((c) => c.status === 'DONE').length === v2.mapping.chunks.length - 1 && v2.mapping.items.length > 0, `${v2.mapping.items.length} rows kept`)
    ok('…it says how many parts were read', /\d+ of \d+ parts read/.test(msg), msg)
    const callsBefore = log3.calls
    const again = await I.advanceImport(id, owner.id, v2.id)
    ok('…and advancing again spends nothing while the part waits (no model call)', again.ok && log3.calls === callsBefore)
    control('the stuck part reported as a pass-ending FAILURE (must be FALSE)', v2.status === 'FAILED')

    // (3) Retry part N: only that part is re-read
    const rowsBefore = v2.mapping.items.length
    const log4 = { calls: 0, truncated: 0, sizes: [] as number[] }
    I.modelCaller.current = stub(1000, log4)
    const rt = await I.retryPart(id, v2.id, stuck[0].index)
    ok('(3) RETRY: "Retry part N" puts only that part back to waiting', rt.ok && rt.data.mapping.chunks.filter((c) => c.status === 'PENDING').length === 1 && rt.data.failure === null)
    let v3 = (rt as { data: T.ImportPassView }).data
    for (let i = 0; i < 20 && v3.status === 'MAPPING'; i++) { const r = await I.advanceImport(id, owner.id, v3.id); v3 = (r as { data: T.ImportPassView }).data }
    ok('…the model is called for that ONE part only', log4.calls === 1, `${log4.calls} calls`)
    ok('…the pass then reaches READY with all 30 rows (the earlier rows kept, none duplicated)', v3.status === 'READY' && v3.mapping.items.length === 30 && v3.mapping.items.length > rowsBefore, `${v3.status}, ${v3.mapping.items.length} rows (had ${rowsBefore})`)
    const refused = await I.retryPart(id, v3.id, 0)
    ok('retrying a pass that is no longer being read is refused in words', !refused.ok && /nothing to retry/.test((refused as { error: string }).error))
    await I.discardImport(id, v3.id)

    // (4) a transient failure (not truncation) is tried once more, then waits — with plain words
    const flaky: Caller = (async () => ({ ok: false, reason: 'http', detail: '[action-import-chunk] HTTP 529 overloaded', usage: { model: 'stub', tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } } })) as unknown as Caller
    const v4 = await run('http', flaky)
    ok('(4) a part that fails for another reason is tried twice, then waits for "Retry part N" (nothing lost)', v4.status === 'MAPPING' && v4.mapping.chunks.some(T.chunkNeedsYou) && !DEV_WORDS.test(JSON.stringify(v4)) && !/HTTP 529/.test(v4.failure ?? ''), v4.failure ?? '')
    await I.discardImport(id, v4.id)

    if (LIVE) {
      section('B+ · the REAL model on the dense fixture (SPENDS)')
      I.modelCaller.current = real
      const t0 = Date.now()
      const live = await run('live', real, 80)
      const rows = live.mapping.items.filter((i) => i.proposal !== 'NOT_ACTION')
      console.log(`    parts ${live.mapping.chunks.length} (${live.mapping.chunks.map((c) => c.part).join(',')}) · rows ${live.mapping.items.length} · spent ${live.spentPence?.toFixed(1)}p · ${Math.round((Date.now() - t0) / 1000)}s · status ${live.status}`)
      ok('(1, live) the real model reads the dense section to READY with no user action', live.status === 'READY', `${live.status} ${live.failure ?? ''}`)
      ok('…one row per provision (>= 28 of 30 as separate rows)', rows.length >= 28, `${rows.length}`)
      await I.discardImport(id, live.id)
    } else skip('(1, live) the real model on the dense fixture', 'needs --live (it spends pence)')
  } finally {
    I.modelCaller.current = real
    await deleteScratch(id)
  }
}


// ── C · THE FOUR STEPS (BRIEF_26S2 §3, §4, §7; §12 item 1) ───────────────────────────────────────────────────

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')

function mkAction(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `a${n}`, number: n, title: `Action ${n}`, practicalStep: `The body of action ${n}, written out in full so a summary line can be cut from it.`, whoImplements: null, wording: null, headingId: null,
    targetCauseIds: [], avenue: null, link: null, sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null,
    facetProposal: null, titleProposal: null, source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null,
    regulatoryFriction: null, policyTest: null, conflictNote: null, ...extra,
  }
}
const renderWs = (step: number, actions: unknown[], open: string[] = [], costLineActionIds: string[] = []) => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
  ideaId: 'idea-x', actions: actions as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: false, orderIndex: 0 }] as never,
  causes: [{ id: 'c1', number: 1, cause: 'A cause', whyPersisted: null }] as never, busy: false, onChanged: () => {}, renderFull: (a: { number: number }, s: number, between?: React.ReactNode) => React.createElement('div', null, `FULL CARD ${a.number} STEP ${s}`, between),
  initiallyOpen: open, step: step as never, costLineActionIds,
}))

function partC() {
  section('C · the four steps — pure and RENDERED (the screen shows only the tools for the step the user is on)')
  const brief = norm(read('../docs/BRIEF_26S2.md'))
  for (const n of ST.STEP_NUMBERS) {
    const s = ST.STEPS[n]
    ok(`step ${n}'s intro is the brief's, word for word (“${s.lead}”)`, brief.includes(norm(`**${s.lead}** ${s.body}`)), s.body.slice(0, 60))
  }
  control('an intro altered by one word still matches the brief (must be FALSE)', brief.includes(norm(`**${ST.STEPS[1].lead}** ${ST.STEPS[1].body.replace('Get the list into shape', 'Get the list in shape')}`)))
  ok('the step labels are the brief\'s four words', ST.STEP_NUMBERS.map((n) => `${n} ${ST.STEPS[n].label}`).join(' · ') === '1 Sort and prune · 2 Who, how and against · 3 Costs · 4 Order')
  ok('clampStep never lets a stored value outside 1–4 through', ST.clampStep(0) === 1 && ST.clampStep(9) === 1 && ST.clampStep(3) === 3 && ST.clampStep('x') === 1 && ST.clampStep(null) === 1)

  // the bar: position + weight + a word, never colour alone
  const bar = renderToStaticMarkup(React.createElement(ActionsSteps, { ideaId: 'idea-x', initialStep: 2 as never, children: () => null }))
  ok('the bar prints the four steps in words, in order', ST.STEP_NUMBERS.every((n) => textOf(bar).includes(`${n} ${ST.STEPS[n].label}`)) && textOf(bar).indexOf('1 Sort and prune') < textOf(bar).indexOf('4 Order'))
  ok('the current step is marked by SHAPE (●), WEIGHT (bold, a 2px border) and a word ("you are here") — and only that one', /aria-current="step"[^>]*data-step="2"|data-step="2"[^>]*aria-current="step"/.test(bar) && (bar.match(/aria-current="step"/g) ?? []).length === 1 && /●/.test(bar) && (bar.match(/○/g) ?? []).length === 3 && /font-bold/.test(bar) && /border-2/.test(bar) && /you are here/.test(bar))
  ok('…and the step\'s intro sits under the bar', textOf(bar).includes(ST.STEPS[2].lead) && textOf(bar).includes('An action is only real when someone named will do it'))
  control('the OTHER steps\' intros printed as well (must be FALSE)', textOf(bar).includes(ST.STEPS[1].body.slice(0, 40)))

  // the workspace, rendered, step by step
  const rows = [
    mkAction(1, { headingId: 'h1', avenue: 'LEGISLATIVE', targetCauseIds: ['c1'], whoImplements: 'Cabinet Office', sequence: 'NOW', policyTest: { verdict: 'FITS', reason: 'ok', from: [] }, implementationCost: { low: 1000, high: 2000, unit: null, basis: null, benchmarkId: null, userOverride: false } }),
    mkAction(2, { policyTest: { verdict: 'CONFLICTS', reason: 'It rules out thresholds.', from: [] } }),
    mkAction(3),
  ]
  const h2 = renderWs(2, rows)
  const s1 = textOf(renderWs(1, rows)), s2 = textOf(h2), s3 = textOf(renderWs(3, rows)), s4 = textOf(renderWs(4, rows))
  ok('STEP 1 offers its tools: Title these for me, Classify with Lex, Find duplicates, Add heading, Suggest headings, the Coverage grid', ['Title these for me', 'Classify with Lex', 'Find duplicates', 'Add heading', 'Suggest headings from my guiding policy', 'Coverage grid'].every((w) => s1.includes(w)))
  ok('STEP 1 row: title, summary, heading, avenue, causes, verdict (shape + word) — and NOTHING of steps 2–4 (no Who, cost, sequence, “specific enough”)', s1.includes('Action 1') && s1.includes('The body of action 1') && s1.includes('Legislation') && s1.includes('Legislative') && s1.includes('1 cause') && s1.includes('✓ Fits') && s1.includes('✗ Conflicts') && !/Who:|Cost:|Sequence:|specific enough|Cabinet Office|Implement £/.test(s1), s1.slice(0, 600))
  control('a step-1 row that still printed "specific enough" (must be FALSE)', /specific enough/.test(s1))
  ok('STEP 1 has no sequence view and no Link tag anywhere', !/○ Sequence|● Sequence/.test(s1) && !/\blink:/i.test(s1))
  ok('STEP 2 row carries Who ("Cabinet Office", else "not yet answered") and none of step 1\'s tools', s2.includes('Who: Cabinet Office') && s2.includes('Who: not yet answered') && !/Title these for me|Find duplicates|Coverage grid|Add heading/.test(s2) && !/Select action|Reorder action|Heading for action/.test(h2))
  ok('…and STEP 2 offers its one tool, “Classify with Lex” (for the seven answers), and the row names the missing slots (“not yet specific — Who and Against unanswered”; “draft text missing” for a legislative one)', /Classify with Lex/.test(s2) && /not yet specific — draft text missing/.test(s2) && /not yet specific — Who and Against unanswered/.test(s2) && /1 of 7 answered/.test(s2) && /0 of 7 answered/.test(s2), s2.slice(0, 500))
  ok('STEP 3 row carries the cost ("Implement £1,000–£2,000", else "Cost: not yet answered") and no Who', s3.includes('Implement £1,000–£2,000') && s3.includes('Cost: not yet answered') && !/Who:/.test(s3))
  ok('…a cost LINE counts as a cost (step 3 reads it as recorded)', textOf(renderWs(3, [mkAction(7)], [], ['a7'])).includes('cost lines recorded'))
  ok('STEP 4 offers Classify with Lex (sequence), the Sequence view and its rows say where each sits; no step-1 tools', s4.includes('Classify with Lex') && /Sequence/.test(s4) && s4.includes('Sequence: not placed yet') && s4.includes('Now') && !/Title these for me|Find duplicates|Add heading|Coverage grid/.test(s4))
  ok('the list is checklist-ended in EVERY step: each step prints its own advisory checklist', ST.STEP_NUMBERS.every((n) => new RegExp(`Step ${n} checklist`).test(textOf(renderWs(n, rows)))))
  ok('…step 1\'s says what is unfinished, in words with counts, and that it never blocks', /2 actions have no heading/.test(s1) && /2 actions have no cause/.test(s1) && /Advisory: it never stops you moving on/.test(s1))
  ok('…step 4\'s counts the actions with no sequence slot', /2 actions have no sequence slot/.test(s4))

  // an OPENED record: this step's section first and open, every other under ONE line each
  const o2 = renderWs(2, rows, ['a1'])
  ok('OPENED in step 2: step 2\'s section is open; steps 1, 3 and 4 are collapsed under one line each saying where they stand', /data-step-section="2" data-step-open="true"/.test(o2) && (o2.match(/<details[^>]*data-step-section/g) ?? []).length === 3 && /from step 1/.test(o2) && /from step 3/.test(o2) && /from step 4/.test(o2) && /data-slots-for="a1"/.test(o2) && (o2.match(/data-slot="/g) ?? []).length === 7)
  ok('…the line for step 3 says "a cost range is recorded" where one is, and the collapsed sections still hold their content (nothing hidden, only out of the way)', /Costs — a cost range is recorded · from step 3/.test(textOf(o2)) && textOf(o2).includes('FULL CARD 1 STEP 3') && textOf(o2).includes('FULL CARD 1 STEP 1'))
  const o1 = renderWs(1, rows, ['a2'])
  ok('OPENED in step 1: the policy test with its reason, the conflict note control, causes, avenue — and "Edit title"', /Policy test/.test(textOf(o1)) && /It rules out thresholds/.test(textOf(o1)) && /Keep it, with a note/.test(textOf(o1)) && /Edit title/.test(textOf(o1)) && /Later phase/.test(textOf(o1)))
  ok('…and "Who, how and against — not yet answered · from step 2" is the line for the Who section while unanswered', /Who, how and against — not yet answered · from step 2/.test(textOf(o1)))
  control('a FITS action offering "Keep it, with a note" (must be FALSE)', /Keep it, with a note/.test(textOf(renderWs(1, rows, ['a1']))))

  // the checklists, pure
  const cl1 = ST.stepChecklist(1, rows as never, { duplicatesChecked: false })
  ok('step 1 checklist: heading, cause, avenue, tested, duplicates, conflicts — six lines, each a count in words', cl1.length === 6 && cl1.map((l) => l.key).join() === 'heading,cause,avenue,tested,duplicates,conflicts' && cl1.find((l) => l.key === 'duplicates')!.done === false)
  ok('…a conflict with a note is no longer waiting for a decision; a conflict without one is', ST.stepChecklist(1, [mkAction(2, { policyTest: { verdict: 'CONFLICTS', reason: 'x', from: [] }, conflictNote: 'We keep it for the pilot.' })] as never, { duplicatesChecked: true }).find((l) => l.key === 'conflicts')!.done === true && ST.stepChecklist(1, [mkAction(2, { policyTest: { verdict: 'CONFLICTS', reason: 'x', from: [] } })] as never, { duplicatesChecked: true }).find((l) => l.key === 'conflicts')!.done === false)
  ok('…an empty list has no checklist (nothing to be unfinished)', ST.stepChecklist(1, [], { duplicatesChecked: false }).length === 0)
  const allDone = [mkAction(1, { headingId: 'h1', avenue: 'LEGISLATIVE', targetCauseIds: ['c1'], policyTest: { verdict: 'FITS', reason: 'ok', from: [] } })]
  ok('…and a list that is finished reads "All actions have a heading", "…at least one cause"', ST.stepChecklist(1, allDone as never, { duplicatesChecked: true }).every((l) => l.done) && ST.stepChecklist(1, allDone as never, { duplicatesChecked: true })[1].text === 'All actions have at least one cause')
  control('a checklist that blocks (a disabled control keyed to it) (must be FALSE)', /disabled=\{[^}]*checklist/.test(read('components/lex/ActionsWorkspace.tsx')))

  // decision 179 — labels
  const cats = read('lib/lex/page4-config.ts')
  ok('179: the cost columns are "Cost to implement / Cost to enforce / Cost of compliance" and are never called Against', /Cost to implement/.test(cats) && /Cost to enforce/.test(cats) && /Cost of compliance/.test(cats) && !/Regulatory friction|Impl:|Enforce:|Friction:/.test(read('components/lex/FieldsPanel.tsx')) && !/Against/.test(read('components/lex/FieldsPanel.tsx').split('function ActionCard')[1] ?? ''))
  ok('…and the cost labels are on the card in step 3 only (the card prints them under `step === 3`)', /\{step === 3 && \(\s*<>\s*<div[^>]*>\s*<span>\{COST_LINE_LABEL\.implementationCost\}/.test(read('components/lex/FieldsPanel.tsx')))
}

async function partD() {
  section('D · the step round-trips, "kept with a note", step-aware Classify — a SCRATCH idea (no model spend)')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 's26s2c')
  const id = copy.id
  const post = async (body: Record<string, unknown>) => {
    const mod = await import('../app/api/ideas/[id]/action-structure/route')
    const res = await mod.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
    return { status: res.status as number, json: (await res.json()) as any }
  }
  try {
    const first = await computeCanonicalState(id)
    ok('a scratch idea opens at step 1 (the default)', first.actionsStep === 1)
    const r3 = await post({ op: 'setStep', step: 3 })
    const back = await computeCanonicalState(id)
    ok('setStep 3 through the real route is read back by the state the screen loads (round-trip)', r3.status === 200 && r3.json.ok && back.actionsStep === 3 && r3.json.state.actionsStep === 3, JSON.stringify(r3.json).slice(0, 200))
    const direct = await prisma.idea.findUnique({ where: { id }, select: { actionsStep: true } })
    ok('…and in the database row itself', direct?.actionsStep === 3)
    const bad = await post({ op: 'setStep', step: 9 })
    ok('a step that does not exist is refused IN WORDS naming the input, and changes nothing', bad.status === 422 && /the step \(1 to 4\)/.test(bad.json.error ?? '') && !/not valid\.?$/.test(bad.json.error ?? '') && (await computeCanonicalState(id)).actionsStep === 3, bad.json.error)
    control('a refused step that moved the idea anyway (must be FALSE)', (await prisma.idea.findUnique({ where: { id }, select: { actionsStep: true } }))?.actionsStep === 9)

    // kept with a note
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    const [x, y] = rows
    await prisma.lexCoherentAction.update({ where: { id: x.id }, data: { policyTestVerdict: 'CONFLICTS', policyTestReason: 'It rules out thresholds.' } })
    await prisma.lexCoherentAction.update({ where: { id: y.id }, data: { policyTestVerdict: 'FITS', policyTestReason: 'ok' } })
    const k = await post({ op: 'keepConflict', actionId: x.id, note: 'We keep it for the pilot year only.' })
    const st = await computeCanonicalState(id)
    const ax = st.actions.find((a) => a.id === x.id)!
    ok('"Keep it, with a note" is saved and read back through the state; the VERDICT is untouched', k.status === 200 && ax.conflictNote === 'We keep it for the pilot year only.' && ax.policyTest?.verdict === 'CONFLICTS' && ax.policyTest?.reason === 'It rules out thresholds.')
    ok('…and the step-1 checklist stops counting it as waiting', !ST.unresolvedConflict(ax) && ST.unresolvedConflict({ policyTest: ax.policyTest, conflictNote: null }))
    const nope = await post({ op: 'keepConflict', actionId: y.id, note: 'a reason' })
    ok('a note on an action that does not conflict is refused in words and not stored', nope.status === 422 && /does not conflict with the policy/.test(nope.json.error ?? '') && (await prisma.lexCoherentAction.findUnique({ where: { id: y.id } }))?.conflictNote == null, nope.json.error)
    const long = await post({ op: 'keepConflict', actionId: x.id, note: 'x'.repeat(601) })
    ok('a 601-character note sent directly is refused with the limit named, and the saved note is unchanged', long.status === 422 && /600/.test(long.json.error ?? '') && (await prisma.lexCoherentAction.findUnique({ where: { id: x.id } }))?.conflictNote === 'We keep it for the pilot year only.', long.json.error)
    const clear = await post({ op: 'keepConflict', actionId: x.id, note: null })
    ok('clearing the note puts the action back to waiting', clear.status === 200 && (await prisma.lexCoherentAction.findUnique({ where: { id: x.id } }))?.conflictNote == null)

    // Classify is a step 1 / step 4 job
    const cls = await post({ op: 'proposeFacets' })   // the idea is at step 3
    ok('"Classify with Lex" in step 3 proposes nothing, spends nothing, and says why in words', cls.status === 422 && /step 1 \(causes and avenue\) or step 4/.test(cls.json.error ?? '') && /Nothing was proposed/.test(cls.json.error ?? ''), cls.json.error)

    // accept / dismiss only this step's part
    const cause = await prisma.diagnosisCause.findFirst({ where: { ideaId: id } })
    await prisma.lexCoherentAction.update({ where: { id: x.id }, data: { targetCauseIds: [], avenue: null, sequence: null, beforeIds: [], facetProposal: { targetCauseIds: [cause!.id], avenue: 'LEGISLATIVE', sequence: 'NOW', link: 'a retired link' } as never } })
    const before = await prisma.lexCoherentAction.findUnique({ where: { id: x.id } })
    const a1 = await post({ op: 'acceptFacets', ids: [x.id], step: 1 })
    const mid = await prisma.lexCoherentAction.findUnique({ where: { id: x.id } })
    ok('accepting STEP 1 copies the causes and avenue only; the step-4 sequence stays waiting as a proposal', a1.status === 200 && mid!.targetCauseIds.includes(cause!.id) && mid!.avenue === 'LEGISLATIVE' && mid!.sequence == null && (mid!.facetProposal as any)?.sequence === 'NOW' && (mid!.facetProposal as any)?.targetCauseIds === undefined, JSON.stringify(mid!.facetProposal))
    const a4 = await post({ op: 'acceptFacets', ids: [x.id], step: 4 })
    const after = await prisma.lexCoherentAction.findUnique({ where: { id: x.id } })
    ok('…then accepting STEP 4 copies the sequence', a4.status === 200 && after!.sequence === 'NOW')
    ok('decision 167: the retired "link" in a proposal is dropped — never written to the column', after!.link === before!.link, `${before!.link} → ${after!.link}`)
    control('a step-1 accept that also copied the sequence (must be FALSE)', mid!.sequence === 'NOW')
    await prisma.lexCoherentAction.update({ where: { id: x.id }, data: { facetProposal: { targetCauseIds: [cause!.id], sequence: 'LATER' } as never } })
    const d1 = await post({ op: 'dismissFacets', ids: [x.id], step: 4 })
    const dd = await prisma.lexCoherentAction.findUnique({ where: { id: x.id } })
    ok('dismissing STEP 4 drops only the sequence proposal; the step-1 proposal stays', d1.status === 200 && (dd!.facetProposal as any)?.sequence === undefined && (dd!.facetProposal as any)?.targetCauseIds?.length === 1)
  } finally {
    await deleteScratch(id)
  }
}

// ── E · 11a — a removed cause is ARCHIVED; its number is never reused (BRIEF_26S2 §12 item 8) ─────────────────────────

async function partE() {
  section('E · archiving a cause keeps its number; the next cause takes one past the highest EVER — a SCRATCH idea')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2e')
  const id = copy.id
  try {
    const before = await prisma.diagnosisCause.findMany({ where: { ideaId: id }, orderBy: { number: 'asc' } })
    const highest = Math.max(...before.map((c) => c.number ?? 0))
    const top = before.find((c) => c.number === highest)!
    // a cause with a sub-cause beneath it, so the subtree goes with it
    const parent = await FM.addCause(id, { cause: 'A parent cause made for the archive check' })
    const child = await FM.addCause(id, { cause: 'A sub-cause beneath it', parentCauseId: parent.id })
    ok('new causes take one past the highest (the trigger)', parent.number === highest + 1 && child.number === highest + 2, `${parent.number}, ${child.number}`)
    const n = await FM.removeCause(id, parent.id)
    ok('removing the parent archives it AND the sub-cause beneath it (the database used to cascade-delete the pair)', n === 2)
    const rows = await prisma.$queryRaw<Array<{ id: string; number: number; archivedAt: Date | null }>>`SELECT "id","number","archivedAt" FROM "DiagnosisCause" WHERE "ideaId" = ${id} AND "id" IN (${parent.id}, ${child.id})`
    ok('…read back with a plain SQL read (not the product\'s reader): BOTH ROWS ARE STILL THERE, with their numbers, marked archived', rows.length === 2 && rows.every((r) => r.archivedAt != null) && rows.some((r) => r.number === parent.number) && rows.some((r) => r.number === child.number), JSON.stringify(rows))
    const st = await computeCanonicalState(id)
    ok('…and out of every list the screen reads: the state\'s causes no longer include them, and it says how many are archived', !st.diagnosisCauses.some((c) => c.id === parent.id || c.id === child.id) && st.archivedCauses === 2)
    ok('…a direct read by the product\'s client leaves them out; naming `archivedAt` asks for them', (await prisma.diagnosisCause.findMany({ where: { ideaId: id } })).every((c) => c.archivedAt == null) && (await prisma.diagnosisCause.findMany({ where: { ideaId: id, archivedAt: { not: null } } })).length === 2 && (await prisma.diagnosisCause.count({ where: { ideaId: id } })) === before.length)
    const next = await FM.addCause(id, { cause: 'The cause added after the archive' })
    ok('THE NEXT CAUSE TAKES ONE PAST THE HIGHEST EVER — not the number the archived pair freed', next.number === highest + 3, `got ${next.number}, highest ever ${highest + 2}`)
    control('the next cause reusing an archived number (must be FALSE)', next.number === parent.number || next.number === child.number)
    // a nested read cannot see them either
    const viaIdea = await prisma.idea.findUnique({ where: { id }, select: { diagnosisCauses: { where: { archivedAt: null }, select: { id: true } } } })
    ok('a nested read that carries the filter leaves them out (the three build reads do)', !viaIdea!.diagnosisCauses.some((c) => c.id === parent.id))
    // removing the root cause clears the field
    const root = before.find((c) => c.isRootCause)
    if (root && !root.parentCauseId) {
      await FM.removeCause(id, root.id)
      const idea = await prisma.idea.findUnique({ where: { id }, select: { rootCause: true } })
      ok('archiving the chosen root cause still clears the rootCause field', idea?.rootCause == null)
    } else skip('archiving the root cause clears the field', 'the scratch idea has no top-level root cause')
    ok('removing a cause that is not on this idea does nothing', (await FM.removeCause(id, '00000000-0000-0000-0000-000000000000')) === 0)
    void top
  } finally {
    await deleteScratch(id)
  }
}

// ── F · 170 — "Test against the policy" ───────────────────────────────────────────────────────────────────────

async function partF() {
  section('F · "Test against the policy" — refusals in words (no spend)' + (LIVE_POLICY ? ' + the REAL model on a scratch idea (SPENDS)' : ''))
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2f')
  const id = copy.id
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    const four = live.slice(0, 4)
    // untested rows: blank their verdicts so they read "? Not tested"
    await prisma.lexCoherentAction.updateMany({ where: { id: { in: four.map((r) => r.id) } }, data: { policyTestVerdict: null, policyTestReason: null } })
    const bad = await S.testAgainstPolicy(id, owner.id, { ids: ['00000000-0000-0000-0000-000000000000'] })
    ok('an action that is not on this idea is refused in words, and nothing is tested', !bad.ok && /not on this idea/.test((bad as { error: string }).error))
    // no accepted policy → refused in words, no model call
    await prisma.idea.update({ where: { id }, data: { chosenApproach: null } })
    await prisma.policyOption.deleteMany({ where: { ideaId: id } })
    const noPol = await S.testAgainstPolicy(id, owner.id, {})
    ok('with no accepted Guiding Policy it refuses in words — "nothing to test the actions against" — and writes nothing', !noPol.ok && /no accepted Guiding Policy/.test((noPol as { error: string }).error) && (await prisma.lexCoherentAction.count({ where: { id: { in: four.map((r) => r.id) }, policyTestVerdict: { not: null } } })) === 0)
    control('a refusal that still wrote a verdict (must be FALSE)', (await prisma.lexCoherentAction.count({ where: { id: { in: four.map((r) => r.id) }, policyTestVerdict: { not: null } } })) > 0)
    if (!LIVE_POLICY) { skip('"Test against the policy" with the real model: a verdict and a reason written, read back, priced', 'needs --live-policy (it spends pence)'); return }
    // the real model
    await prisma.idea.update({ where: { id }, data: { chosenApproach: 'No work of any kind, at any scale, in any publicly funded body may begin or continue unless one named person owns it and answers for its outcome.' } })
    await prisma.policyOption.create({ data: { ideaId: id, approach: 'No work of any kind, at any scale, in any publicly funded body may begin or continue unless one named person owns it and answers for its outcome.', status: 'CHOSEN', kind: 'GUIDING_POLICY', source: 'USER' } as never })
    const t0 = Date.now()
    const r = await S.testAgainstPolicy(id, owner.id, {})
    const secs = Math.round((Date.now() - t0) / 1000)
    ok('(live) the test runs', r.ok, (r as { error?: string }).error ?? '')
    if (!r.ok) return
    const d = (r as { data: { tested: number; counts: Record<string, number>; pence: number | null; batches: number } }).data
    console.log(`    tested ${d.tested} in ${d.batches} call(s) · ${d.pence == null ? 'unpriced' : `${d.pence.toFixed(2)}p`} · ${secs}s · ${JSON.stringify(d.counts)}`)
    const back = await prisma.lexCoherentAction.findMany({ where: { id: { in: four.map((r2) => r2.id) } } })
    ok('(live) every untested action now carries a verdict and a one-line reason, READ BACK from the database', d.tested >= four.length && back.every((b) => ['FITS', 'DOES_NOT_FIT', 'CONFLICTS', 'NOT_TESTED'].includes(b.policyTestVerdict ?? '') && !!b.policyTestReason?.trim()), JSON.stringify(back.map((b) => [b.number, b.policyTestVerdict])))
    ok('(live) the cost is measured and reported', d.pence != null && d.pence > 0)
    const again = await S.testAgainstPolicy(id, owner.id, {})
    ok('(live) running it again tests nothing more — only rows that read "? Not tested" are sent', again.ok && (again as { data: { tested: number } }).data.tested === 0 || (again as { data: { counts: Record<string, number> } }).data.counts.NOT_TESTED > 0)
    const one = await S.testAgainstPolicy(id, owner.id, { ids: [four[0].id] })
    ok('(live) "Test again" on one named action re-tests just that action', one.ok && (one as { data: { tested: number } }).data.tested === 1)
  } finally {
    await deleteScratch(id)
  }
}

// ── G · §8 — the list filter and "· n archived" on a heading, RENDERED ────────────────────────────────────────

function partG() {
  section('G · §8 — the filter (Unreviewed / Conflicts / Not yet specific) and "· n archived" — RENDERED')
  const rows = [
    mkAction(1, { policyTest: { verdict: 'CONFLICTS', reason: 'x', from: [] }, headingId: 'h1' }),
    mkAction(2, { policyTest: { verdict: 'FITS', reason: 'ok', from: [] }, headingId: 'h1', whoImplements: 'Cabinet Office' }),
    mkAction(3, { policyTest: { verdict: 'FITS', reason: 'ok', from: [] }, titleProposal: 'A proposed title' }),
  ]
  const aside = [{ ...mkAction(9), status: 'ARCHIVED', headingId: 'h1', mergedIntoId: 'a1' }, { ...mkAction(10), status: 'RULED_OUT', headingId: 'h1', ruleOutReason: 'no' }]
  const withAside = (step: number) => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: rows as never, setAside: aside as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: false, orderIndex: 0 }] as never,
    causes: [] as never, busy: false, onChanged: () => {}, renderFull: () => null, step: step as never,
  }))
  const h1 = withAside(1), h2 = withAside(2)
  ok('the filter is offered with COUNTS: All actions (3), Unreviewed, Conflicts (1)', /All actions \(3\)/.test(textOf(h1)) && /Conflicts \(1\)/.test(textOf(h1)) && /Unreviewed \(1\)/.test(textOf(h1)), textOf(h1).slice(0, 300))
  ok('"Not yet specific" is offered from step 2 on, not in step 1', /Not yet specific \(\d\)/.test(textOf(h2)) && !/Not yet specific/.test(textOf(h1)))
  ok('a heading reads "· 1 archived" after a merge/rebuild archived one of its actions — a RULED-OUT one is not counted as archived', /1 archived/.test(textOf(h1)) && !/2 archived/.test(textOf(h1)) && /data-archived-count/.test(h1))
  ok('…and in step 1 the word is a button that opens the set-aside block', /<button[^>]*data-archived-count[^>]*>1 archived<\/button>/.test(h1) || /data-archived-count[^>]*>1 archived<\/button>/.test(h1))
  control('a heading with nothing archived printing "archived" (must be FALSE)', /archived/.test(textOf(renderToStaticMarkup(React.createElement(ActionsWorkspace, { ideaId: 'idea-x', actions: rows as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: false, orderIndex: 0 }] as never, causes: [] as never, busy: false, onChanged: () => {}, renderFull: () => null, step: 1 as never })))))
  ok('the Not-tested rows offer the test: the toolbar button counts them', /Test against the policy \(0 untested\)|Test against the policy/.test(textOf(renderWs(1, [mkAction(1), mkAction(2)]))) && /Test against the policy \(2 untested\)/.test(textOf(renderWs(1, [mkAction(1), mkAction(2)]))))
  control('the button offered when every action is already tested (must be FALSE)', /Test against the policy \(/.test(textOf(renderWs(1, [mkAction(1, { policyTest: { verdict: 'FITS', reason: 'ok', from: [] } })]))))
}

// ── H · decisions 181 (statement 1,000 + commentary), 182 (dictated actions), the merge label, the row's "+ New heading…" ──

async function partH() {
  section('H · 181 / 182 — the 1,000-character statement and the commentary; a dictated action is the owner\'s — a SCRATCH idea')
  // pure + rendered
  ok('the statement limit is 1,000 (it was 600 in 26-Q, set without a decision)', LIMITS.actionStatement === 1000)
  const long = 'The Cabinet Office must publish a register naming the accountable owner of each statutory target. '.repeat(14).trim()
  const sc = S.statementAndCommentary(long, 'An earlier note.')
  ok('a restated statement over the limit keeps its first 1,000 characters AND the whole text goes in the commentary — nothing is dropped', long.length > 1000 && sc.statement.length === 1000 && !!sc.commentary && sc.commentary.includes(long) && sc.commentary.startsWith('An earlier note.'))
  control('an over-limit statement that left the commentary empty (must be FALSE)', !S.statementAndCommentary(long).commentary)
  ok('a statement within the limit adds nothing to the commentary', S.statementAndCommentary('Short enough.').commentary === null)
  const wsHtml = renderWs(1, [mkAction(1), mkAction(2)])
  ok('item 2: the bulk-bar control reads "Ask Lex to review and merge" (it always goes through Lex) — and nowhere a bare "Merge" button', renderToStaticMarkup(React.createElement(ActionsWorkspace, { ideaId: 'x', actions: [mkAction(1), mkAction(2)] as never, setAside: [] as never, headings: [] as never, causes: [] as never, busy: false, onChanged: () => {}, renderFull: () => null, step: 1 as never, initiallyOpen: [] })).indexOf('Ask Lex to review and merge') === -1 /* the bar shows only with a selection */ && /Ask Lex to review and merge/.test(read('components/lex/ActionsWorkspace.tsx')) && !/>Merge<\/button>/.test(read('components/lex/ActionsWorkspace.tsx')))
  ok('item 3: the per-row heading menu now offers "+ New heading…" too, so both menus agree', /value="__new"[^>]*>\+ New heading…/.test(wsHtml) && (wsHtml.match(/\+ New heading…/g) ?? []).length >= 2)
  control('step 2 offering a heading menu with "+ New heading…" (must be FALSE)', /\+ New heading…/.test(renderWs(2, [mkAction(1)])))

  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 's26s2h')
  const id = copy.id
  const ctx = (said: string[] = []) => ({ ideaId: id, userId: owner.id, confirmed: false, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: said, pastedText: null } })
  try {
    const t = (name: string) => toolByName(name)!
    const exact = 'Every department must publish, each quarter, the name of the single person who owns each of its statutory delivery targets and answers for them.'
    const prov = (q: string) => ({ kind: 'user_words', refs: [], quote: q.slice(0, 60) })
    // 181 — over the limit is refused in words that offer the commentary
    const tooLong = await execute(t('add_action'), ctx([long]), { practicalStep: long.slice(0, 1001), provenance: prov(long) })
    ok('181: a 1,001-character statement is refused IN WORDS that name the limit and tell Lex to offer the commentary', !tooLong.ok && /1000 characters/.test(tooLong.error ?? '') && /commentary/.test(tooLong.error ?? ''), tooLong.error)
    const atLimit = await execute(t('add_action'), ctx([long]), { practicalStep: long.slice(0, 1000), commentary: 'The intention: one named owner per target.', provenance: prov(long) })
    const rowL = await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, practicalStep: long.slice(0, 1000) } })
    ok('181: exactly 1,000 characters is accepted, with a commentary — both read back', atLimit.ok && rowL?.practicalStep.length === 1000 && rowL.commentary === 'The intention: one named owner per target.', atLimit.error)
    ok('182: the result carries the NEW NUMBER so Lex can say where it landed ("Added as #n")', atLimit.ok && typeof (atLimit.data as { number: number }).number === 'number' && (atLimit.data as { number: number }).number === rowL?.number && /Added as #\d+/.test((atLimit.data as { say: string }).say))
    ok('…and an action Lex drafts (not dictated) is marked LEX', rowL?.source === 'LEX')
    // 182 — dictated = the owner's, enforced
    const dict = await execute(t('add_action'), ctx([`add this action: ${exact}`]), { practicalStep: exact, dictated: true, provenance: prov(exact) })
    const rowD = await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, practicalStep: exact } })
    ok('182: a DICTATED action is the owner\'s — source USER, read back — and its result gives the number', dict.ok && rowD?.source === 'USER' && (dict.data as { number: number }).number === rowD?.number)
    const laundered = await execute(t('add_action'), ctx([`add this action: ${exact}`]), { practicalStep: 'Lex\'s own paraphrase of what the user probably wanted done about delivery targets.', dictated: true, provenance: prov(exact) })
    ok('182: "dictated" over words the user did not write is REFUSED — Lex cannot pass her own wording off as the owner\'s', !laundered.ok && /word for word/.test(laundered.error ?? ''), laundered.error)
    control('a dictated action that landed as LEX-sourced (must be FALSE)', rowD?.source === 'LEX')
    // set_action_commentary
    const num = rowL!.number!
    const a1 = await execute(t('set_action_commentary'), ctx([long]), { action: num, commentary: 'Second paragraph: examples.', mode: 'append', provenance: prov(long) })
    const after = await prisma.lexCoherentAction.findUnique({ where: { id: rowL!.id } })
    ok('181: set_action_commentary APPENDS by default (the earlier commentary is kept) — read back', a1.ok && after?.commentary === 'The intention: one named owner per target.\n\nSecond paragraph: examples.', JSON.stringify(after?.commentary))
    const a2 = await execute(t('set_action_commentary'), ctx([long]), { action: num, commentary: 'x'.repeat(5000), mode: 'replace', provenance: prov(long) })
    ok('…and takes 5,000 characters in "replace" — the commentary has no limit', a2.ok && (await prisma.lexCoherentAction.findUnique({ where: { id: rowL!.id } }))?.commentary?.length === 5000)
    const none = await execute(t('set_action_commentary'), ctx([long]), { action: 9999, commentary: 'x', provenance: prov(long) })
    ok('…an action number that is not on the idea is refused in words', !none.ok && /no live action #9999/.test(none.error ?? ''))
    ok('Lex\'s instructions tell her to offer the commentary whenever she shortens anything, and to say the number', /OFFER to keep the full text in the commentary/.test(read('lib/lex/agent/system-prompt.ts')) && /say its number/.test(read('lib/lex/agent/system-prompt.ts')))
    // the screen's route: 1,000 limit in words; the commentary round-trips through the state the screen loads
    const post = async (body: Record<string, unknown>) => {
      const mod = await import('../app/api/ideas/[id]/actions/route')
      const res = await mod.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
      return { status: res.status as number, json: (await res.json()) as any }
    }
    const bad = await post({ action: 'update', actionId: rowL!.id, practicalStep: 'y'.repeat(1001) })
    ok('the actions route refuses 1,001 characters naming the statement, the limit and the commentary — and changes nothing', bad.status === 422 && /action statement/.test(bad.json.error ?? '') && /1000/.test(bad.json.error ?? '') && /commentary/.test(bad.json.error ?? '') && (await prisma.lexCoherentAction.findUnique({ where: { id: rowL!.id } }))?.practicalStep.length === 1000, bad.json.error)
    const good = await post({ action: 'update', actionId: rowL!.id, commentary: 'Edited on the screen.' })
    const st = await computeCanonicalState(id)
    ok('the screen\'s edit saves the commentary and the state the screen loads carries it', good.status === 200 && st.actions.find((x) => x.id === rowL!.id)?.commentary === 'Edited on the screen.')
  } finally {
    await deleteScratch(id)
  }
}

// ── I · 18 Oct (CCh A, B) — a provider failure retries itself once and says why; the opened record's layout; the commentary renders ──

async function partI() {
  section('I · the import: one provider failure retries itself, and the words on the screen (a SCRATCH idea, the model stood in for)')
  const credit = { reason: 'http', detail: '[action-import-chunk] HTTP 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}' }
  ok('a 529 / 429 / 500 / a dropped connection / an empty or unparseable answer are each worth ONE retry', ['HTTP 529 overloaded', 'HTTP 429 rate', 'HTTP 500 x', 'fetch failed (cause: ECONNRESET)'].every((d) => I.isTransient({ reason: 'http', detail: d })) && I.isTransient({ reason: 'empty', detail: '' }) && I.isTransient({ reason: 'bad-json', detail: '' }))
  ok('…an empty-credit refusal (400), a refusal, a timeout and a truncation are NOT retried inside the call (retrying cannot help, or the split handles it)', !I.isTransient(credit) && !I.isTransient({ reason: 'blocked', detail: '' }) && !I.isTransient({ reason: 'timeout', detail: '' }) && !I.isTransient({ reason: 'truncated', detail: '' }) && !I.isTransient({ reason: 'http', detail: 'HTTP 400 bad schema' }))
  control('a 400 credit refusal judged transient (must be FALSE)', I.isTransient(credit))
  ok('the reason in the sentence is plain: credit says so, anything else says "the model did not answer"', I.failureWhy(credit) === 'the model provider says the account is out of credit' && I.failureWhy({ reason: 'http', detail: 'HTTP 529' }) === 'the model did not answer')
  const lib = read('lib/lex/action-import.ts')
  ok('the old sentence ("the reading service", an undefined noun) is gone', !/reading service/.test(lib))

  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 's26s2i')
  const id = copy.id
  const OWNER: RN.Viewer = { id: owner.id, isOwner: true }
  const real = I.modelCaller.current
  try {
    const { text } = denseDocument()
    const added = await RN.addNote(id, { id: owner.id }, OWNER, { op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'A dense section of rules', fullText: text, rightsConfirmed: true, readStatus: 'READ' } } as never, { readIntoFindings: false })
    const ref = (added as { data: { ref: number } }).data.ref
    const u0 = { model: 'stub', tokensIn: 0, tokensOut: 0, recorded: { pence: 0 } }
    // (1) fails ONCE (529), then answers: ONE advance reads the part — the user sees nothing
    let calls = 0
    const log = { calls: 0, truncated: 0, sizes: [] as number[] }
    const good = stub(1000, log)
    I.modelCaller.current = (async (o: { user: string; label?: string }) => { if (o.label === 'action-import-chunk' && calls++ === 0) return { ok: false, reason: 'http', detail: '[action-import-chunk] HTTP 529 overloaded', usage: u0 }; return good(o as never) }) as unknown as Caller
    const st = await I.startImport(id, owner.id, ref)
    if (!st.ok) throw new Error((st as { error: string }).error)
    const a1 = await I.advanceImport(id, owner.id, st.data.id)
    const v1 = (a1 as { data: T.ImportPassView }).data
    ok('(1) one transient failure retries itself: the FIRST advance reads part 1 — two calls, part DONE, no failure on the screen', calls === 2 && v1.mapping.chunks[0].status === 'DONE' && v1.mapping.chunks[0].tries === 1 && !v1.failure, `calls ${calls}, ${v1.mapping.chunks[0].status}, tries ${v1.mapping.chunks[0].tries}`)
    await I.discardImport(id, v1.id)

    // (2) out of credit: no inner retry; the words say why; the others are untouched
    let c2 = 0
    I.modelCaller.current = (async () => { c2++; return { ok: false, ...credit, usage: u0 } }) as unknown as Caller
    const st2 = await I.startImport(id, owner.id, ref)
    let v2 = (st2 as { data: T.ImportPassView }).data
    for (let i = 0; i < 4 && v2.status === 'MAPPING' && !v2.mapping.chunks.some(T.chunkNeedsYou); i++) v2 = ((await I.advanceImport(id, owner.id, v2.id)) as { data: T.ImportPassView }).data
    const m2 = v2.failure ?? ''
    ok('(2) out of credit: one call per try (no pointless retry), and the screen says exactly why, in the agreed shape', c2 === 2 && /^0 of \d+ parts read\. Lex could not read part 1 \(the model provider says the account is out of credit\)\. Nothing has been written\./.test(m2), `${c2} calls; ${m2}`)
    ok('…it offers "Retry part 1" by name and no developer word reaches the screen', /Retry part 1/.test(m2) && !DEV_WORDS.test(m2) && !/HTTP|credit balance|Anthropic/.test(m2), m2)
    await I.discardImport(id, v2.id)

    // (3) a persistent failure of the other kind: the sentence is Charlie's
    I.modelCaller.current = (async () => ({ ok: false, reason: 'http', detail: '[action-import-chunk] HTTP 529 overloaded', usage: u0 })) as unknown as Caller
    const st3 = await I.startImport(id, owner.id, ref)
    let v3 = (st3 as { data: T.ImportPassView }).data
    for (let i = 0; i < 4 && v3.status === 'MAPPING' && !v3.mapping.chunks.some(T.chunkNeedsYou); i++) v3 = ((await I.advanceImport(id, owner.id, v3.id)) as { data: T.ImportPassView }).data
    ok('(3) a provider that keeps failing: "Lex could not read part 1 (the model did not answer). Nothing has been written."', /Lex could not read part 1 \(the model did not answer\)\. Nothing has been written\./.test(v3.failure ?? ''), v3.failure ?? '')
    control('the failure sentence still naming "the reading service" (must be FALSE)', /reading service/.test(v3.failure ?? ''))
    await I.discardImport(id, v3.id)
  } finally {
    I.modelCaller.current = real
    await deleteScratch(id)
  }
}

function partJ() {
  section('J · the opened record, top to bottom (18 Oct, CCh B) — and the commentary renders')
  const withCom = (n: number, extra: Record<string, unknown> = {}) => mkAction(n, { commentary: 'The intention: one named owner per target.\n\nSecond paragraph: examples.', policyTest: { verdict: 'FITS', reason: 'It fits the policy.', from: [] }, avenue: 'LEGISLATION', targetCauseIds: ['c1'], ...extra })
  const act = withCom(7)
  const openHtml = (step: number, a: unknown = act) => renderToStaticMarkup(React.createElement(ActionsWorkspace, {
    ideaId: 'idea-x', actions: [a] as never, setAside: [] as never, headings: [{ id: 'h1', name: 'Legislation', colourKey: 'blue', hidden: false, orderIndex: 0 }] as never,
    causes: [{ id: 'c1', number: 1, cause: 'A cause', whyPersisted: null }] as never, busy: false, onChanged: () => {},
    renderFull: (x: unknown, s: number, between?: React.ReactNode) => React.createElement(FP.ActionCard, { action: x as never, step: s as never, between, benchmarks: [], costLines: [], busy: false, api: {} as never, costLinesApi: {} as never }),
    initiallyOpen: ['a7'], step: step as never, costLineActionIds: [],
  }))
  const html = openHtml(1)
  const pos = (re: RegExp) => html.search(re)
  const order = [pos(/data-open-title/), pos(/Close −/), pos(/data-statement/), pos(/data-test-line/), pos(/The causes it attacks/), pos(/data-commentary/)]
  ok('top to bottom: [title · Edit title · Close], the full statement, [test | heading menu], avenue and causes, Commentary', order.every((p) => p >= 0) && order.every((p, i) => i === 0 || p > order[i - 1] || (i === 1 && p > 0)), order.join(','))
  const first = textOf(html.slice(pos(/data-open-title/), pos(/data-statement/)))
  ok('the title line carries "Edit title" and Close, once each', /Edit title/.test(first) && (html.match(/Edit title/g) ?? []).length === 1 && (html.match(/Close −/g) ?? []).length === 1)
  ok('the full statement is on the card, uncut', textOf(html).includes(norm(act.practicalStep)) && !/data-row-summary/.test(html))
  ok('the title is not repeated (it appears once on the opened record)', (textOf(html).match(/Action 7/g) ?? []).length === 1, String((textOf(html).match(/Action 7/g) ?? []).length))
  const line = html.slice(pos(/data-test-line/), pos(/The causes it attacks/))
  ok('the policy test and the heading menu are on ONE line (the same flex row), the heading menu right-aligned, the test not full width', /Policy test/.test(line) && /Heading for action 7/.test(line) && /ml-auto/.test(line) && /w-fit/.test(line) && !/w-full/.test(line.slice(0, line.indexOf('Policy test') + 400)))
  ok('the line under the title (avenue · causes · tested) is gone from the opened row', !/>1 cause</.test(html) && !/data-not-tested(?!-box)/.test(html))
  ok('the Commentary renders on the opened card, labelled "Commentary" (not "Mechanism — commentary"), whole', /data-commentary/.test(html) && /Commentary<\/p>/.test(html) && !/Mechanism — commentary/.test(html) && textOf(html).includes('Second paragraph: examples.'))
  control('an action with NO commentary showing a Commentary box (must be FALSE)', /data-commentary/.test(openHtml(1, withCom(7, { commentary: null }))))
  control('the heading menu still sitting in the title line / header (must be FALSE)', /Heading for action 7[\s\S]{0,200}Close −/.test(html) || /Close −[\s\S]{0,300}Heading for action 7[\s\S]{0,30}<\/div><\/div><div class="border-t/.test(html))
  const closed = renderToStaticMarkup(React.createElement(ActionsWorkspace, { ideaId: 'idea-x', actions: [act] as never, setAside: [] as never, headings: [] as never, causes: [] as never, busy: false, onChanged: () => {}, renderFull: () => null, initiallyOpen: [], step: 1 as never, costLineActionIds: [] }))
  ok('the CLOSED row keeps a two-line snippet (clamped to two lines) and its tags', /data-row-summary/.test(closed) && /WebkitLineClamp|-webkit-line-clamp:\s*2/.test(closed) && /1 cause/.test(closed))
  const s2 = openHtml(2)
  ok('step 2 / 3: the opened record has the title line and no heading menu', /data-open-title/.test(s2) && !/Heading for action 7/.test(s2))
}

// ── K · decision 177 — the seven slots, "specific enough", the pass that proposes, the documents, the tools (a SCRATCH idea; the model stood in for) ──

async function partK() {
  section('K · 177 — step 2, "Who, how and against": the record, the tag, Lex proposes beside, never over')
  // pure: "specific enough" — the three fixtures of BRIEF_26S2 §12.1, and their controls
  const orgDone = { avenue: 'ORGANISATIONAL', whoImplements: 'The Cabinet Office', wording: null, record: { against: { text: 'Departments will resist the reporting burden; the counter is a single template.', by: 'USER', at: '2026-10-18T09:00:00.000Z' } } }
  const draftOnly = { avenue: 'LEGISLATIVE', whoImplements: null, wording: 'The Secretary of State must publish a register.', record: null }
  const neither = { avenue: 'ORGANISATIONAL', whoImplements: null, wording: null, record: null }
  ok('fixture 1 — Who AND Against answered (organisational) reads "specific enough"', RC.specificEnough(orgDone) && RC.specificTag(orgDone) === 'specific enough')
  ok('fixture 2 — draft text present (legislative) reads "specific enough"', RC.specificEnough(draftOnly))
  ok('fixture 3 — neither: "not yet specific — Who and Against unanswered"', !RC.specificEnough(neither) && RC.specificTag(neither) === 'not yet specific — Who and Against unanswered')
  ok('Who answered, Against not: "not yet specific — Against unanswered" (the tag names the missing slot)', RC.specificTag({ avenue: 'FINANCIAL', whoImplements: 'HM Treasury', wording: null, record: null }) === 'not yet specific — Against unanswered')
  ok('a legislative action with no draft text: "not yet specific — draft text missing", even with a Who and an Against', RC.specificTag({ ...orgDone, avenue: 'LEGISLATIVE' }) === 'not yet specific — draft text missing')
  control('a Who with no Against reading "specific enough" (the old rule — must be FALSE)', RC.specificEnough({ avenue: 'ORGANISATIONAL', whoImplements: 'The Cabinet Office', wording: null, record: null }))
  control('a proposal waiting beside an empty Against counting as an answer (must be FALSE)', RC.specificEnough({ avenue: 'ORGANISATIONAL', whoImplements: 'X', wording: null, record: { against: { text: '', by: 'LEX', at: '', proposal: { text: 'Opposition', reason: '', source: null, at: '' } } } }))
  ok('the facets module delegates to the one definition (the grid, the filter and the checklist cannot differ)', F.specificEnough(orgDone as never) === RC.specificEnough(orgDone) && F.specificEnough(neither as never) === RC.specificEnough(neither))

  // a COLD READ of the live data: the flip, counted (CLAUDE.md §26 - nothing arranged by this check)
  const live = await prisma.lexCoherentAction.findMany({ where: { status: 'LIVE', idea: { deletedAt: null } }, select: { whoImplements: true, wording: true, avenue: true, record: true } })
  const oldRule = live.filter((a) => !!(a.wording?.trim() || a.whoImplements?.trim())).length
  const newRule = live.filter((a) => RC.specificEnough(a)).length
  console.log(`    the flip, on the live data: ${live.length} live actions; "specific enough" under the OLD rule (draft text or a Who): ${oldRule}; under the NEW rule: ${newRule}`)
  ok('the new rule is never looser than the old one (no action became specific by the redefinition)', newRule <= oldRule)
  ok('every action the old rule called specific only for its Who and that has no Against now reads "not yet specific"', live.filter((a) => a.whoImplements?.trim() && !a.wording?.trim() && !RC.slotAnswered(a, 'against')).every((a) => !RC.specificEnough(a)))

  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 's26s2k')
  const id = copy.id
  const realModel = SL.slotModel.current
  const ctx = (said: string[] = []) => ({ ideaId: id, userId: owner.id, confirmed: false, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: said, pastedText: null } })
  try {
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' } })
    // a clean slate: no Who, no record, an organisational avenue — so the slots are the only thing under test
    await prisma.lexCoherentAction.updateMany({ where: { ideaId: id }, data: { whoImplements: null, record: Prisma.DbNull, avenue: 'ORGANISATIONAL', wording: null } })
    const [A, B, C] = rows
    const st = async () => (await computeCanonicalState(id)).actions
    const rec = async (aid: string) => RC.parseRecord((await prisma.lexCoherentAction.findUnique({ where: { id: aid }, select: { record: true } }))?.record)

    // the user's own answers: stored with writer + timestamp; read back through the state the screen loads
    const w = await SL.setSlot(id, A.id, 'who', { text: 'The Cabinet Office (inside government)' })
    const ag = await SL.setSlot(id, A.id, 'against', { text: 'Departments will resist the reporting burden.' })
    const aState = (await st()).find((x) => x.id === A.id)!
    ok('Who is written to its COLUMN and the writer + date go in the record; Against is written to the record — both read back through the screen\'s state', w.ok && ag.ok && aState.whoImplements === 'The Cabinet Office (inside government)' && aState.record?.who?.by === 'USER' && !!aState.record?.who?.at && aState.record?.against?.text === 'Departments will resist the reporting burden.' && aState.record?.against?.by === 'USER' && !Number.isNaN(Date.parse(aState.record?.against?.at ?? '')))
    ok('…and with Who + Against answered the action now reads "specific enough" (the state the screen loads)', RC.specificEnough(aState))
    control('an action with only a Who reading "specific enough" after the write (must be FALSE)', RC.specificEnough((await st()).find((x) => x.id === B.id)!))
    const inc = await SL.setSlot(id, A.id, 'incentiveNow', { text: 'Their present incentive is to avoid new duties.', direction: 'AGAINST' })
    const chg = await SL.setSlot(id, A.id, 'whatChangesIt', { text: 'A public duty to report makes avoiding it costly.', linkActionId: B.id })
    const a2 = (await rec(A.id))
    ok('Incentive now keeps its direction (a word and a shape); What changes it keeps its link to another action', inc.ok && chg.ok && a2.incentiveNow?.direction === 'AGAINST' && a2.whatChangesIt?.linkActionId === B.id)
    const selfLink = await SL.setSlot(id, A.id, 'whatChangesIt', { text: 'x', linkActionId: A.id })
    ok('linking an action to itself is refused in words, and nothing changed', !selfLink.ok && /is not on this idea/.test((selfLink as { error: string }).error) && (await rec(A.id)).whatChangesIt?.linkActionId === B.id)
    const tooLong = await SL.setSlot(id, A.id, 'skill', { text: 'y'.repeat(LIMITS.slotAnswer + 1) })
    ok('a 1,201-character answer is refused in words naming the slot and the limit, and nothing is written', !tooLong.ok && /“Skill” is limited to 1200 characters/.test((tooLong as { error: string }).error) && !(await rec(A.id)).skill, (tooLong as { error?: string }).error)
    const cleared = await SL.setSlot(id, A.id, 'skill', { text: '' })
    ok('an empty answer clears the slot (no record of an empty answer)', cleared.ok && !(await rec(A.id)).skill)
    ok('the writer words are honest: "you, 18 Oct" for a user answer; "writer not recorded" where none was', /^you, \d+ \w{3}$/.test(RC.writerWords(RC.slotWriter(aState, 'against'))) && RC.writerWords(null) === 'writer not recorded')

    // the route (the screen's door): the limit in words, "Not saved"-ready, and the write lands
    const post = async (body: Record<string, unknown>) => {
      const mod = await import('../app/api/ideas/[id]/action-structure/route')
      const res = await mod.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
      return { status: res.status as number, json: (await res.json()) as any }
    }
    const badRoute = await post({ op: 'setSlot', actionId: B.id, slot: 'how', text: 'z'.repeat(LIMITS.slotAnswer + 1) })
    ok('the route refuses 1,201 characters naming the answer and the limit; nothing written', badRoute.status === 422 && /answer/.test(badRoute.json.error ?? '') && !(await rec(B.id)).how, badRoute.json.error)
    const goodRoute = await post({ op: 'setSlot', actionId: B.id, slot: 'how', text: 'The National Audit Office checks it each year; a missed target is reported to Parliament.' })
    ok('the route writes a slot, and the screen\'s state carries it with its writer', goodRoute.status === 200 && (await st()).find((x) => x.id === B.id)?.record?.how?.by === 'USER')
    const noSlot = await post({ op: 'setSlot', actionId: B.id, slot: 'friction', text: 'x' })
    ok('a slot that does not exist is refused naming the input', noSlot.status === 422 && /slot|question/i.test(noSlot.json.error ?? ''), noSlot.json.error)

    // ── the pass: the model stood in for ──
    const OWNER: RN.Viewer = { id: owner.id, isOwner: true }
    const filed = await RN.addNote(id, { id: owner.id }, OWNER, { op: 'addNote', newSource: { kind: 'DOCUMENT', title: 'A note on public registers', fullText: denseDocument().text, rightsConfirmed: true, readStatus: 'READ' } } as never, { readIntoFindings: false })
    const validRef = filed.ok ? (filed as { data: { ref: number } }).data.ref : 0
    ok('a real source is filed on the scratch idea, so a proposal can cite it', validRef > 0)
    const u0 = { model: 'stub', tokensIn: 10, tokensOut: 10, recorded: { pence: 0.2 } }
    const seen: string[] = []
    const asked = (user: string, n: number) => (user.match(new RegExp(`\\[${n}\\][^\\n]*\\n(?:[^\\[]*?)ASK: ([^\\n]+)`))?.[1] ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    const stubModel = (opts: { onCall?: (user: string) => Promise<void>; truncateOver?: number; log?: { calls: number; sizes: number[] } } = {}) => (async (o: { user: string }) => {
      opts.log && (opts.log.calls++)
      const nums = [...o.user.split('ANSWER FOR THESE ACTIONS:')[1].matchAll(/^\[(\d+)\]/gm)].map((m) => Number(m[1]))
      opts.log?.sizes.push(nums.length)
      seen.push(o.user)
      if (opts.truncateOver && nums.length > opts.truncateOver) return { ok: false, reason: 'truncated', detail: 'cut off', usage: u0 }
      await opts.onCall?.(o.user)
      const actions = nums.map((n) => ({
        number: n,
        // the stand-in answers EVERY slot (even those not asked): a pass must keep to its ASK list
        slots: RC.ALL_SLOTS.map((slot) => ({ slot, text: `Lex's answer for ${slot} on #${n}.`, reason: 'From the action wording and the settled policy.', direction: slot === 'incentiveNow' ? 'WITH' : 'NONE', linkNumber: slot === 'whatChangesIt' ? (n === rows[0].number ? rows[1].number : rows[0].number) : 0, sourceRef: slot === 'how' ? validRef : slot === 'against' ? 999999 : 0 })),
      }))
      return { ok: true, usage: u0, value: { actions } }
    }) as unknown as typeof SL.slotModel.current

    // the user wrote A's Who + Against and B's How: the pass asks for the REST, never for those
    const log1 = { calls: 0, sizes: [] as number[] }
    SL.slotModel.current = stubModel({ log: log1 })
    const r1 = await SL.proposeSlots(id, owner.id)
    const d1 = (r1 as { data: SL.SlotPassResult }).data
    ok('ONE request does at most a dozen actions (a request has a time limit) and says how many are left, so the screen goes on by itself', r1.ok && d1.actions === SL.SLOT_MAX_PER_CALL && d1.remaining === rows.length - SL.SLOT_MAX_PER_CALL && d1.remaining > 0 && log1.calls === 2, JSON.stringify(d1))
    // the loop the screen runs: request after request until none is left
    let dMore = d1
    for (let n = 0; n < 40 && dMore.remaining > 0; n++) dMore = (await SL.proposeSlots(id, owner.id) as { data: SL.SlotPassResult }).data
    ok('…the following requests finish the list (remaining 0)', dMore.remaining === 0 && (await st()).filter((x) => RC.proposalCount(x) > 0).length === rows.length, JSON.stringify(dMore))
    ok('the pass runs (stood-in model), prices itself, and returns what it did', r1.ok && (r1 as { data: SL.SlotPassResult }).data.proposed > 0 && Math.abs((r1 as { data: SL.SlotPassResult }).data.pence! - 2 * 0.2) < 1e-9, JSON.stringify((r1 as { data?: unknown }).data))
    const aAfter = (await st()).find((x) => x.id === A.id)!
    ok('A USER-WRITTEN ANSWER IS NEVER OVERWRITTEN: Who and Against on A are exactly as the user wrote them, though the stand-in answered every slot', aAfter.whoImplements === 'The Cabinet Office (inside government)' && aAfter.record?.against?.text === 'Departments will resist the reporting burden.' && aAfter.record?.against?.by === 'USER')
    ok('…the prompt did not even ASK for the slots the user had answered (A: no who, no against)', !asked(seen[0], A.number!).includes('who') && !asked(seen[0], A.number!).includes('against') && asked(seen[0], A.number!).includes('skill'), `ASK for A: ${asked(seen[0], A.number!).join(', ')}`)
    control('the user\'s Who changed by the pass (must be FALSE)', aAfter.whoImplements !== 'The Cabinet Office (inside government)')
    const aRec = (await rec(A.id))
    ok('…and the proposals sit BESIDE: a proposed Skill is stored as a proposal with its one-line reason, and is not an answer (A is still "specific enough" for its own reasons; the Skill slot reads unanswered)', aRec.skill?.proposal?.text === `Lex's answer for skill on #${A.number}.` && aRec.skill?.proposal?.reason.length! > 0 && !RC.slotAnswered(aAfter, 'skill') && RC.slotProposal(aAfter, 'skill')?.text === aRec.skill?.proposal?.text)
    ok('...Incentive now carries Lex direction; What changes it carries a link only to a real, OTHER action (A own were answered by the user, so the proposals are read on C)', (await rec(C.id)).incentiveNow?.proposal?.direction === 'WITH' && (await rec(C.id)).whatChangesIt?.proposal?.linkNumber === rows[0].number && !aRec.incentiveNow?.proposal && !aRec.whatChangesIt?.proposal)
    const cRec = (await rec(C.id))
    ok('a proposal cites a [Ref: n] ONLY if that source is on the idea: How cites the real one; Against (the stand-in invented 999999) cites none', validRef > 0 && cRec.how?.proposal?.source === validRef && cRec.against?.proposal?.source === null && seen[0].includes(`[Ref: ${validRef}]`), `how ${cRec.how?.proposal?.source}, against ${cRec.against?.proposal?.source}`)
    ok('B\'s How (the user\'s) is untouched and was not asked for', (await rec(B.id)).how?.text?.startsWith('The National Audit Office') === true && !asked(seen[0], B.number!).includes('how'))
    ok(`the pass is chunked: ${rows.length} actions in ${log1.calls} calls of at most 6 across two requests`, log1.calls === Math.ceil(rows.length / 6) && Math.max(...log1.sizes) <= 6, JSON.stringify(log1))

    // a second pass asks only where there is neither an answer nor a proposal waiting - so it asks for nothing
    const log2 = { calls: 0, sizes: [] as number[] }
    SL.slotModel.current = stubModel({ log: log2 })
    const r2 = await SL.proposeSlots(id, owner.id)
    ok('running it again proposes nothing and spends nothing (every open slot already has a proposal waiting)', r2.ok && (r2 as { data: SL.SlotPassResult }).data.proposed === 0 && log2.calls === 0, JSON.stringify((r2 as { data?: unknown }).data))

    // the user answers a slot WHILE the pass runs: the answer wins, the proposal for it is dropped
    await SL.dismissAllSlotProposals(id)
    ok('"Dismiss them all" removes every proposal and leaves every answer', !(await st()).some((x) => RC.proposalCount(x) > 0) && (await st()).find((x) => x.id === A.id)?.record?.against?.text === 'Departments will resist the reporting burden.')
    SL.slotModel.current = stubModel({ onCall: async () => { await SL.setSlot(id, C.id, 'skill', { text: 'Typed by the user while Lex was working.' }) } })
    await SL.proposeSlots(id, owner.id, { ids: [C.id] })
    const cRace = (await rec(C.id))
    ok('an answer typed WHILE the pass ran is kept and the late proposal for that slot is dropped', cRace.skill?.text === 'Typed by the user while Lex was working.' && !cRace.skill?.proposal && cRace.skill?.by === 'USER')
    control('the late proposal replacing the answer typed while it ran (must be FALSE)', cRace.skill?.text !== 'Typed by the user while Lex was working.')

    // too much for one call: the pass splits, it does not fail
    await SL.dismissAllSlotProposals(id)
    const log3 = { calls: 0, sizes: [] as number[] }
    SL.slotModel.current = stubModel({ log: log3, truncateOver: 2 })
    let r3: Awaited<ReturnType<typeof SL.proposeSlots>> = await SL.proposeSlots(id, owner.id)
    for (let n = 0; n < 40 && r3.ok && (r3 as { data: SL.SlotPassResult }).data.remaining > 0; n++) r3 = await SL.proposeSlots(id, owner.id)
    ok('a call that is cut off is split in halves down to the floor, and the pass still completes', r3.ok && log3.sizes.some((n) => n <= 2) && (await st()).filter((x) => RC.proposalCount(x) > 0).length === rows.length, JSON.stringify(log3))

    // the per-action "Ask Lex": only that action
    await SL.dismissAllSlotProposals(id)
    const log4 = { calls: 0, sizes: [] as number[] }
    SL.slotModel.current = stubModel({ log: log4 })
    const r4 = await SL.proposeSlots(id, owner.id, { ids: [B.id] })
    ok('per-action "Ask Lex" proposes for that one action only', r4.ok && log4.sizes.join() === '1' && RC.proposalCount((await st()).find((x) => x.id === B.id)!) > 0 && RC.proposalCount((await st()).find((x) => x.id === C.id)!) === 0)
    const notMine = await SL.proposeSlots(id, owner.id, { ids: ['not-an-action-here'] })
    ok('…an action that is not on this idea is refused in words, nothing proposed', !notMine.ok && /not on this idea/.test((notMine as { error: string }).error))

    // accept / replace / dismiss
    const bState = (await st()).find((x) => x.id === B.id)!
    const accWho = await SL.acceptSlot(id, B.id, 'who')
    const bAfter = (await st()).find((x) => x.id === B.id)!
    ok('"Use it" copies the proposal into an EMPTY slot, marked as accepted from Lex, and the proposal is cleared', !!RC.slotProposal(bState, 'who') && accWho.ok && bAfter.whoImplements === `Lex's answer for who on #${B.number}.` && bAfter.record?.who?.by === 'LEX' && !RC.slotProposal(bAfter, 'who') && /Lex \(accepted\)/.test(RC.writerWords(RC.slotWriter(bAfter, 'who'))))
    await SL.proposeSlotText(id, B.id, 'how', { text: 'Lex would have the Treasury enforce it instead.', reason: 'The policy gives the Treasury the power.' })
    const refuse = await SL.acceptSlot(id, B.id, 'how')
    ok('accepting onto an answer the USER wrote is refused in words ("Replace mine with this"), and nothing changes', !refuse.ok && /Replace mine with this/.test((refuse as { error: string }).error) && (await rec(B.id)).how?.text?.startsWith('The National Audit Office') === true)
    const repl = await SL.acceptSlot(id, B.id, 'how', { replace: true })
    ok('…with the user\'s explicit "replace" it replaces', repl.ok && (await rec(B.id)).how?.by === 'LEX' && (await rec(B.id)).how?.text === 'Lex would have the Treasury enforce it instead.' && !(await rec(B.id)).how?.proposal)
    const dis = await SL.dismissSlot(id, B.id, 'skill')
    ok('"Dismiss" removes the proposal and leaves the slot as it was', dis.ok && !RC.slotProposal((await st()).find((x) => x.id === B.id)!, 'skill') && !(await rec(B.id)).skill)
    const noProp = await SL.acceptSlot(id, B.id, 'skill')
    ok('accepting where nothing is waiting is refused in words', !noProp.ok && /no proposal waiting/.test((noProp as { error: string }).error))

    // the checklist and the row's words
    const cl = ST.stepChecklist(2, (await st()).filter((x) => !x.parked) as never, { duplicatesChecked: false })
    ok('the step-2 checklist uses the new definition and counts proposals waiting', cl.some((l) => l.key === 'specific' && !l.done && /not yet specific enough/.test(l.text)) && cl.some((l) => l.key === 'waiting'), cl.map((l) => l.text).join(' | '))

    // ── the documents print Who / How / Against under each action, "not yet stated" when not ──
    const snap = await buildProposalSnapshot(id)
    const doc = JSON.stringify(buildProposalDocument(snap).model)
    ok('the Proposal prints Who / How / Against under an action: the answered ones as written, the rest "not yet stated"', /Who: /.test(doc) && /not yet stated/.test(doc) && doc.includes('Lex would have the Treasury enforce it instead.') && doc.includes('Departments will resist the reporting burden.'), JSON.stringify({ who: /Who: /.test(doc), notStated: /not yet stated/.test(doc), how: doc.includes('Lex would have the Treasury'), against: doc.includes('Departments will resist'), len: doc.length, nActions: snap.actions.length }))
    const pack = JSON.stringify(buildMeetingPackDocument(snap).model)
    ok('the Meeting Pack prints them too', /Who: /.test(pack) && /Against: /.test(pack) && pack.includes('Departments will resist the reporting burden.'))
    control('a Proposal that prints no "not yet stated" for a scratch idea with open slots (must be FALSE)', !/not yet stated/.test(doc))

    // ── Lex's tools ──
    const t = (name: string) => toolByName(name)!
    ok('Lex has the four tools: get_action, set_action_slot, propose_action_slots, test_actions_against_policy', ['get_action', 'set_action_slot', 'propose_action_slots', 'test_actions_against_policy'].every((n) => !!toolByName(n)))
    const prov = (q: string) => ({ kind: 'user_words', refs: [], quote: q.slice(0, 60) })
    const g = await execute(t('get_action'), ctx(), { action: A.number })
    const gd = g.data as { statement: string; step2: { slots: Record<string, { answer: string | null; writtenBy: string | null }>; answeredOf7: number } }
    ok('get_action reads ONE record in full: the whole statement and the seven slots, each with its writer', g.ok && gd.statement === A.practicalStep && gd.step2.slots.who.answer === 'The Cabinet Office (inside government)' && gd.step2.slots.against.writtenBy === 'the user' && gd.step2.answeredOf7 >= 2, g.error)
    const prop = await execute(t('set_action_slot'), ctx(['please look at this']), { action: C.number, slot: 'skill', text: 'They already run similar registers.', reason: 'The action wording', provenance: prov('please look at this') })
    ok('set_action_slot WITHOUT dictated stores a PROPOSAL, not an answer', prop.ok && !RC.slotAnswered((await st()).find((x) => x.id === C.id)!, 'worked') && RC.slotProposal((await st()).find((x) => x.id === C.id)!, 'skill')?.text === 'They already run similar registers.')
    const said = 'The measure is the share of targets with a named owner.'
    const dic = await execute(t('set_action_slot'), ctx([`for #${C.number}, what tells us it worked: ${said}`]), { action: C.number, slot: 'worked', text: said, dictated: true, provenance: prov(said) })
    ok('set_action_slot dictated:true is THE USER\'S answer (written by USER), and the tool says where it landed', dic.ok && (await rec(C.id)).worked?.by === 'USER' && /Saved as your answer/.test((dic.data as { say: string }).say))
    const laund = await execute(t('set_action_slot'), ctx([`for #${C.number}, what tells us it worked: ${said}`]), { action: C.number, slot: 'how', text: 'Lex\'s own paraphrase of what they probably meant by enforcement.', dictated: true, provenance: prov(said) })
    ok('dictated over words the user did not write is REFUSED — Lex cannot pass her wording off as the user\'s', !laund.ok && /word for word/.test(laund.error ?? ''), laund.error)
    control('a laundered dictation that landed as the user\'s answer (must be FALSE)', (await rec(C.id)).how?.by === 'USER' && /paraphrase/.test((await rec(C.id)).how?.text ?? ''))
    const overUser = await execute(t('set_action_slot'), ctx(['please look at this']), { action: A.number, slot: 'against', text: 'Lex thinks something else will oppose it.', provenance: prov('please look at this') })
    ok('a Lex-authored slot over an answer the user wrote lands BESIDE it — the user\'s Against is intact', overUser.ok && (await rec(A.id)).against?.text === 'Departments will resist the reporting burden.' && (await rec(A.id)).against?.proposal?.text === 'Lex thinks something else will oppose it.')
    SL.slotModel.current = stubModel()
    await SL.dismissAllSlotProposals(id)
    const viaTool = await execute(t('propose_action_slots'), ctx(), { actions: [C.number] })
    ok('propose_action_slots (the stood-in model) proposes for the named action and says the answers are proposals', viaTool.ok && /proposed/.test(String((viaTool.data as { status: string }).status)) && RC.proposalCount((await st()).find((x) => x.id === C.id)!) > 0)
    if (LIVE_POLICY) {
      const tp = await execute(t('test_actions_against_policy'), ctx(), { actions: [A.number] })
      ok('test_actions_against_policy (LIVE) writes a verdict and reason to the action, read back', tp.ok && !!(await prisma.lexCoherentAction.findUnique({ where: { id: A.id } }))?.policyTestVerdict, tp.error)
    } else skip('test_actions_against_policy (live)', 'needs --live-policy (it spends pence)')
    ok('the chat tools are named in Lex\'s instructions, with the dictated rule for slots', /get_action/.test(read('lib/lex/agent/system-prompt.ts')) && /set_action_slot/.test(read('lib/lex/agent/system-prompt.ts')) && /test_actions_against_policy/.test(read('lib/lex/agent/system-prompt.ts')))
    ok('Lex\'s "I\'ve saved it" claims are checked against set_action_slot too', /'set_action_slot'/.test(read('lib/lex/agent/honesty.ts')))

    // the live run (spends): the real model on the scratch idea, price measured (n=)
    if (LIVE_SLOTS) {
      section('K+ · the REAL model proposes step 2 on a scratch copy (SPENDS)')
      SL.slotModel.current = realModel
      await prisma.lexCoherentAction.updateMany({ where: { ideaId: id }, data: { whoImplements: null, record: Prisma.DbNull } })
      const t0 = Date.now()
      // the loop the screen runs: a request does a dozen actions; go on while some remain
      const agg: SL.SlotPassResult = { proposed: 0, actions: 0, skipped: 0, remaining: 0, pence: 0, calls: 0 }
      let live: Awaited<ReturnType<typeof SL.proposeSlots>> = { ok: true, data: agg }
      for (let round = 0; round < 10; round++) {
        live = await SL.proposeSlots(id, owner.id)
        if (!live.ok) break
        const x = (live as { data: SL.SlotPassResult }).data
        agg.proposed += x.proposed; agg.actions += x.actions; agg.calls += x.calls; agg.pence = agg.pence != null && x.pence != null ? agg.pence + x.pence : null
        console.log(`      request ${round + 1}: ${x.actions} actions, ${x.proposed} answers, ${x.calls} call(s), ${x.pence?.toFixed(2)}p, ${x.remaining} left`)
        if (!x.remaining || !x.proposed) break
      }
      const secs = Math.round((Date.now() - t0) / 100) / 10
      const d = agg
      console.log(`    MEASURED: ${rows.length} actions · proposed ${d?.proposed} answers on ${d?.actions} actions · ${d?.calls} call(s) · ${d?.pence?.toFixed(2)}p · ${secs}s  →  ${d?.pence != null ? (d.pence / rows.length).toFixed(2) : '?'}p per action`)
      ok('(live) the real model proposes answers for every action, cost measured', live.ok && (d?.proposed ?? 0) >= rows.length && d.actions === rows.length, (live as { error?: string }).error)
      const sample = (await st()).find((x) => RC.proposalCount(x) > 0)
      if (sample) for (const k of RC.ALL_SLOTS) { const p = RC.slotProposal(sample, k); if (p) console.log(`      #${sample.number} ${k}: ${p.direction ? `[${p.direction}] ` : ''}${p.text.slice(0, 140)}${p.source ? ` [Ref: ${p.source}]` : ''}  — ${p.reason.slice(0, 90)}`) }
    } else skip('K+ the real model on step 2', 'needs --live-slots (it spends pence)')
  } finally {
    SL.slotModel.current = realModel
    await deleteScratch(id)
  }
}

// ── L · BRIEF_26S2 sec 6 (step 3, costs), 184 (the filter's help text), the checklists on the worklist (a SCRATCH idea) ──

async function partL() {
  section('L · step 3 — the cost form (one-off / per year, price year, "no cost, because"), the cost summary, the worklist, the filter help (184)')
  // 184 - pure render: the filter's own help text carries the definitions
  const htmlF = renderWs(1, [mkAction(1), mkAction(2)])
  ok('184: the filter has its own HELP TEXT in words — what "Unreviewed" means (a proposal of Lex\'s waiting, or never tested) and what "Conflicts" means', /data-filter-help/.test(htmlF) && /Unreviewed<\/span> — Lex has a proposal waiting for you/.test(htmlF) && /has not been tested against the policy/.test(htmlF) && /Conflicts<\/span> — the policy test says/.test(htmlF))
  ok('…and in step 2 it adds "Not yet specific" and the answers', /data-filter-help/.test(renderWs(2, [mkAction(1)])) && /Not yet specific<\/span> — Who and Against are not both answered/.test(renderWs(2, [mkAction(1)])) && /this step’s classification or answers/.test(renderWs(2, [mkAction(1)])))
  control('step 1 describing "Not yet specific" (a step-2 tool; must be FALSE)', /Not yet specific<\/span>/.test(htmlF))
  ok('"Unreviewed" in step 2 counts an action with a proposed answer waiting (and not one without)', (() => {
    const fits = { verdict: 'FITS', reason: 'ok', from: [] }
    const withP = mkAction(1, { policyTest: fits, record: { against: { text: '', by: 'LEX', at: '', proposal: { text: 'Opposition from the department.', reason: 'x', source: null, at: '' } } } })
    const h = textOf(renderWs(2, [withP, mkAction(2, { policyTest: fits })]))
    return /Unreviewed \(1\)/.test(h)
  })())

  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) { skip('the scratch run', 'cl@scrutinise.org is not in this database'); return }
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  const copy = await scratchCopy('452c5ade', 's26s2l')
  const id = copy.id
  try {
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, take: 4 })
    const [A, B, C] = rows
    await prisma.lexCoherentAction.updateMany({ where: { ideaId: id }, data: { implementationCost: Prisma.DbNull, enforcementCost: Prisma.DbNull, regulatoryFriction: Prisma.DbNull, noCostReason: null } })
    const st = async () => (await computeCanonicalState(id))
    const call = async (route: string, body: Record<string, unknown>) => {
      const mod = await import(route === 'cost' ? '../app/api/ideas/[id]/cost-lines/route' : '../app/api/ideas/[id]/actions/route')
      const res = await mod.POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
      return { status: res.status as number, json: (await res.json()) as any }
    }
    // the cost form: low, high, basis, price year, one-off or per year
    const add1 = await call('cost', { action: 'add', actionId: A.id, label: 'A new registry team', category: 'IMPLEMENTATION', costType: 'STAFF', low: 100000, high: 250000, basis: 'Six staff for a year at the median civil service grade', priceYear: 2025, recurrence: 'ONE_OFF' })
    const add2 = await call('cost', { action: 'add', actionId: A.id, label: 'Running the registry', category: 'ENFORCEMENT', costType: 'OTHER', low: 40000, high: 60000, basis: 'Two staff a year', priceYear: 2025, recurrence: 'PER_YEAR' })
    const s1 = await st()
    const lines = s1.costLines.filter((l) => l.actionId === A.id)
    ok('the form saves low, high, basis, price year and one-off / per year, and the screen\'s state carries all five', add1.status === 200 && add2.status === 200 && lines.length === 2 && lines.some((l) => l.recurrence === 'ONE_OFF' && l.priceYear === 2025 && l.low === 100000 && l.high === 250000 && l.basis?.startsWith('Six staff')) && lines.some((l) => l.recurrence === 'PER_YEAR'))
    const badYear = await call('cost', { action: 'add', actionId: A.id, label: 'x', priceYear: 3025 })
    ok('a price year of 3025 is refused (not a year), and nothing is written', badYear.status === 422 && (await st()).costLines.filter((l) => l.actionId === A.id).length === 2)
    const badRec = await call('cost', { action: 'add', actionId: A.id, label: 'x', recurrence: 'MONTHLY' })
    ok('a recurrence other than one-off / per year is refused', badRec.status === 422)

    // "no cost, because"
    const nc = await call('actions', { action: 'update', actionId: B.id, noCostReason: 'It restates a duty departments already carry; no new work is created.' })
    const s2 = await st()
    const bNow = s2.actions.find((x) => x.id === B.id)!
    ok('"no cost, because ..." saves through the actions route and the state carries it', nc.status === 200 && bNow.noCostReason === 'It restates a duty departments already carry; no new work is created.')
    const tooLongNc = await call('actions', { action: 'update', actionId: B.id, noCostReason: 'q'.repeat(LIMITS.noCostReason + 1) })
    ok('…over the limit is refused naming it, and the saved reason is kept', tooLongNc.status === 422 && (await st()).actions.find((x) => x.id === B.id)?.noCostReason === bNow.noCostReason, tooLongNc.json.error)
    const cl3 = ST.stepChecklist(3, s2.actions.filter((x) => !x.parked) as never, { duplicatesChecked: false }, { actionIdsWithCostLines: new Set(s2.costLines.map((l) => l.actionId)) })
    const none = s2.actions.filter((x) => !x.parked && !ST.costAnswered(x, s2.costLines.some((l) => l.actionId === x.id))).length
    ok('the step-3 checklist counts an action with a costed line (A) and one with "no cost, because" (B) as ANSWERED, and the rest as open', ST.costAnswered(bNow) && !ST.costAnswered(s2.actions.find((x) => x.id === C.id)!) && cl3[0].text.startsWith(`${none} `), cl3.map((l) => l.text).join(' | '))
    control('an action with only a "no cost" reason still counted as having no cost answer (must be FALSE)', !ST.costAnswered(bNow))
    const row3 = textOf(renderToStaticMarkup(React.createElement(ActionsWorkspace, { ideaId: id, actions: s2.actions.filter((x) => [A.id, B.id, C.id].includes(x.id)) as never, setAside: [] as never, headings: [] as never, causes: [] as never, busy: false, onChanged: () => {}, renderFull: () => null, initiallyOpen: [], step: 3 as never, costLineActionIds: [A.id] })))
    ok('the step-3 row says "No cost, because ..." where that is the answer, the cost where there is one, and "Cost: not yet answered" where neither', /No cost ?, because It restates a duty/.test(row3) && /Cost: not yet answered/.test(row3) && /cost lines recorded/.test(row3), row3.slice(0, 400))
    ok('…and the collapsed line for step 3 on an opened record says "no cost, because"', /Costs — no cost, because It restates/.test(ST.otherStepLine(3, bNow as never, false)))

    // the cost summary reads these
    const sum = await FM.computeCostSummary(id)
    const t = sum.totals as { oddRecurrence: number; noCost: number }
    ok('the cost summary SAYS an action is recorded as costing nothing (and counts it)', t.noCost === 1 && /1 action is recorded as costing nothing, each with the reason given/.test(sum.summary), sum.summary)
    await call('cost', { action: 'add', actionId: A.id, label: 'A yearly licence', category: 'IMPLEMENTATION', costType: 'OTHER', low: 1000, high: 2000, basis: 'Vendor quote', priceYear: 2025, recurrence: 'PER_YEAR' })
    const sum2 = await FM.computeCostSummary(id)
    ok('a "per year" line entered under the one-off category is SUMMED where it was entered and SAID (not silently regular)', (sum2.totals as { oddRecurrence: number }).oddRecurrence === 1 && /recurring differently from the usual pattern/.test(sum2.summary), sum2.summary)
    control('a clean set of lines reporting a recurrence anomaly (must be FALSE)', (sum.totals as { oddRecurrence: number }).oddRecurrence > 0)

    // the documents
    const snap = await buildProposalSnapshot(id)
    const doc = JSON.stringify(buildProposalDocument(snap).model)
    ok('the Proposal prints "No cost, because: ..." in the user\'s words, and labels a costed line one-off / per year', doc.includes('No cost, because: ') && doc.includes('It restates a duty departments already carry') && /one-off/.test(doc) && /per year/.test(doc))
    ok('the headline cost is not blanked by an action the user answered "no cost, because"', (() => { const a = snap.actions.map((x) => x.id === B.id ? { ...x, implementationCost: null } : { ...x, implementationCost: { low: 10, high: 20, unit: 'GBP', basis: 'b', benchmarkId: null, userOverride: false, priceYear: 2025 } as never }); return DOCS.headlineCost(a as never) !== null })())
    control('the headline cost with a plain gap (no reason) still refuses to sum (must be FALSE as "summed")', DOCS.headlineCost(snap.actions.map((x) => x.id === B.id ? { ...x, implementationCost: null, noCostReason: null } : { ...x, implementationCost: { low: 10, high: 20, unit: 'GBP', basis: 'b', benchmarkId: null, userOverride: false, priceYear: 2025 } as never }) as never) !== null)

    // the worklist: the step checklists are on it
    const wl = await import('../app/api/ideas/[id]/worklist/route')
    const res = await wl.GET(new Request('http://internal.invalid/'), { params: Promise.resolve({ id }) })
    const wj = (await res.json()) as { parts: Array<{ key: string; items: Array<{ key: string; text: string; ticked: boolean }> }> }
    const decide = wj.parts.find((p) => p.key === 'decide')!.items
    const stepItems = decide.filter((i) => i.key.startsWith('actions-step:'))
    ok('the worklist\'s "Decisions to make" carries the step checklists: each open line, in the step\'s words, for all four steps', stepItems.length >= 4 && [1, 2, 3, 4].every((n) => stepItems.some((i) => i.key.startsWith(`actions-step:${n}:`))) && stepItems.some((i) => /Coherent actions, step 2 \(Who, how and against\): \d+ actions? (is|are) not yet specific enough/.test(i.text)), stepItems.map((i) => i.text).join(' | ').slice(0, 400))
    ok('…derived, never ticked by a measurement; the "Find duplicates" line (only the open screen can know it) is left out', stepItems.every((i) => !i.ticked) && !stepItems.some((i) => /Find duplicates/.test(i.text)))
    control('a worklist for an idea with no actions listing action steps (must be FALSE)', await (async () => {
      const empty = await scratchCopy('452c5ade', 's26s2l-empty')
      try {
        await prisma.lexCoherentAction.deleteMany({ where: { ideaId: empty.id } })
        const r = await wl.GET(new Request('http://internal.invalid/'), { params: Promise.resolve({ id: empty.id }) })
        const j = (await r.json()) as { parts: Array<{ key: string; items: Array<{ key: string }> }> }
        return j.parts.flatMap((p) => p.items).some((i) => i.key.startsWith('actions-step:'))
      } finally { await deleteScratch(empty.id) }
    })())
    ok('the form\'s words are on the screen: Price year, one-off / per year, "no cost, because…" (source-shaped)', /Price year/.test(read('components/lex/FieldsPanel.tsx')) && /one-off/.test(read('components/lex/FieldsPanel.tsx')) && /no cost, because…/.test(read('components/lex/FieldsPanel.tsx')))
  } finally {
    await deleteScratch(id)
  }
}

// ── M · 11b (decision 176) — an ambient PURPOSE on the spend ledger; product spend and engineering spend apart ──

async function partM() {
  section('M · 11b — purpose on the ledger: measurement | check, set at the call site; product calls carry none')
  ok('a script is known by its name: check-/verify-/audit- are checks; measure-/probe-/sweep-/benchmark- are measurements', BC.purposeFromScriptName('C:\\Code\\x\\scrutinise-web\\scripts\\check-lex-26s2.ts', undefined) === 'check' && BC.purposeFromScriptName('/app/scripts/verify-lex-26q-ui.tsx', undefined) === 'check' && BC.purposeFromScriptName('/app/scripts/measure-s14-merge.ts', undefined) === 'measurement' && BC.purposeFromScriptName('/app/scripts/probe-s11-reachability.ts', undefined) === 'measurement')
  ok('…a WEB REQUEST never has one: under a Next runtime, or from an entry that is not a script, the answer is none', BC.purposeFromScriptName('/app/scripts/check-a.ts', 'nodejs') === null && BC.purposeFromScriptName('/var/task/server.js', undefined) === null && BC.purposeFromScriptName('/app/scripts/build-worker.ts', undefined) === null && BC.purposeFromScriptName('', undefined) === null)
  control('a product entry point reading as engineering (must be FALSE)', BC.purposeFromScriptName('/var/task/.next/server/app/api/ideas/route.js', undefined) !== null)
  ok('attribution: a row with a purpose is attributed (to engineering); a person-caused row with neither a user nor a purpose is MISSING', SO.personRowsMissingAttribution({ n: 5, attributed: 5 }) === 0 && SO.personRowsMissingAttribution({ n: 5, attributed: 3 }) === 2)
  control('five person-caused rows with no user and no purpose reading as attributed (must be FALSE)', SO.personRowsMissingAttribution({ n: 5, attributed: 0 }) === 0)
  ok('the attribution check counts a purpose row as attributed (source-shaped: the script\'s own SQL)', /FILTER \(WHERE "userId" IS NOT NULL OR purpose IS NOT NULL\)/.test(read('scripts/check-spend-attribution.ts')) && /personRowsMissingAttribution/.test(read('scripts/check-spend-attribution.ts')))

  // the real ledger: a row written from THIS script is a check; an explicit purpose wins; a request carries none
  const tag = `26s2m-${Date.now()}`
  const at = (ref: string) => prisma.$queryRawUnsafe<Array<{ purpose: string | null; attrSource: string | null }>>(`SELECT purpose, "attrSource" FROM "LlmSpend" WHERE ref = $1`, ref)
  const entry = (ref: string) => ({ stream: 'lex' as const, pass: 'test.26s2m', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 1, ref })
  try {
    await SP.recordSpend(entry(`${tag}-a`))
    const a = (await at(`${tag}-a`))[0]
    ok('a row written from a check script carries purpose "check" (the script\'s own name), and its attrSource says why it is attributed', a?.purpose === 'check' && a?.attrSource === 'purpose', JSON.stringify(a))
    BC.enterPurpose('measurement')
    await SP.recordSpend(entry(`${tag}-b`))
    const b = (await at(`${tag}-b`))[0]
    ok('enterPurpose("measurement") is explicit and wins over the script\'s name', b?.purpose === 'measurement', JSON.stringify(b))
    await SP.recordSpend({ ...entry(`${tag}-c`), purpose: 'check' })
    ok('…and an explicit purpose on the entry wins over both', (await at(`${tag}-c`))[0]?.purpose === 'check')
    // a request: Next sets NEXT_RUNTIME; the script's name must not leak into a product call
    const bc = BC.currentBuildContext()
    const saved = process.env.NEXT_RUNTIME
    process.env.NEXT_RUNTIME = 'nodejs'
    try {
      // run outside the ambient purpose this script entered above
      await BC.runWithSpendContext({ userId: null, ideaId: null, purpose: null }, () => SP.recordSpend(entry(`${tag}-d`)))
    } finally { if (saved === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = saved }
    const d = (await at(`${tag}-d`))[0]
    ok('a PRODUCT call (inside a web runtime) carries NO purpose - product spend is never read as engineering', d?.purpose === null && bc?.purpose === 'measurement', JSON.stringify(d))
    control('a product call recorded as engineering (must be FALSE)', d?.purpose != null)
  } finally {
    await prisma.$executeRawUnsafe(`DELETE FROM "LlmSpend" WHERE ref LIKE $1`, `${tag}-%`)
  }

  // the dashboard: product and engineering apart, from the live ledger
  const ov = await SA.spendOverview(new Date('2026-09-29T00:00:00Z'), new Date())
  const by = Object.fromEntries(ov.byPurpose.map((x) => [x.purpose, x]))
  console.log(`    since 29 Sep: product ${by.product?.calls} calls ${by.product?.pence?.toFixed(1)}p · measurement ${by.measurement?.calls} calls ${by.measurement?.pence?.toFixed(1)}p · check ${by.check?.calls} calls ${by.check?.pence?.toFixed(1)}p`)
  ok('the dashboard returns product, measurement and check apart; the 266 history rows are labelled "measurement"', ov.byPurpose.map((x) => x.purpose).join() === 'product,measurement,check' && by.measurement.calls >= 266 && by.product.calls > 0)
  ok('…and the screen carries the split (source-shaped: the Admin spend section)', /data-spend-split/.test(read('components/admin/SpendSection.tsx')) && /Engineering spend/.test(read('components/admin/SpendSection.tsx')))
  control('the product total including the measurement rows (must be FALSE: they are labelled out of it)', (by.product.calls) === ov.byPurpose.reduce((n, x) => n + x.calls, 0))
}

async function main() {
  partA()
  await partB()
  partC()
  await partD()
  await partE()
  await partF()
  partG()
  await partH()
  await partI()
  partJ()
  await partK()
  await partL()
  await partM()
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
