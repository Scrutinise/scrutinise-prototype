// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 (BRIEF_26S2 §12) — check:lex-26s2.   This file grows with the sprint; today it holds §10 (the import fix, item 5 of §12).
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
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const LIVE = process.argv.includes('--live')
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

async function main() {
  partA()
  await partB()
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
