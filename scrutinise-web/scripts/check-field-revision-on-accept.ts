// ─────────────────────────────────────────────────────────────────────────────
// check:field-revision-on-accept — 21 Oct, 452c5ade: the owner's accepted Summary of Guiding Policy was replaced by
// Lex's draft (taken from beside it) and NOTHING kept the words it replaced. Every accept that changes an accepted value
// now records the old text in FieldRevision, and read_field shows it to Lex.
//
// ⚠ Runs on a scratch copy of 452c5ade (deleted in a `finally`). No model is called; nothing is spent.
// ⚠ Every case has a CONTROL that must come out false, or the check proves nothing.
//
// Usage:  npm run check:field-revision-on-accept
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { acceptField, offerRedraft, editRedraft } from '../lib/lex/field-machine'
import { applyFieldEdit } from '../lib/lex/field-edit-write'
import { toolByName, execute } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const KEY = 'summaryGuidingPolicy'
let pass = 0, fail = 0
function ok(name: string, cond: boolean, control: boolean, why = '') {
  const good = cond && !control
  good ? pass++ : fail++
  console.log(`${good ? '✓' : '✗'} ${name}${good ? '' : `  [assertion ${cond}, control ${control}] ${why}`}`)
}

async function main() {
  const copy = await scratchCopy('452c5ade', 'revision-check')
  const revs = () => prisma.fieldRevision.findMany({ where: { ideaId: copy.id, fieldKey: KEY }, orderBy: { createdAt: 'asc' } })
  const value = async () => (await prisma.ideaFieldState.findUniqueOrThrow({ where: { ideaId_fieldKey: { ideaId: copy.id, fieldKey: KEY } } })).value
  try {
    const mine = 'The owner’s own edited paragraph, accepted. Statute fixes the principles; the Code holds the rules.'
    await acceptField(copy.id, copy.userId, KEY, mine)
    const base = (await revs()).length

    // ── 1. "Use this version" on a redraft beside accepted words ─────────────────────
    const lex1 = 'Lex’s shorter draft, number one.'
    ok('a redraft is offered BESIDE the accepted words, not over them', (await offerRedraft(copy.id, KEY, { value: lex1, rationale: 'r', againstPolicyId: '' })) === 'beside' && (await value()) === mine, false)
    await acceptField(copy.id, copy.userId, KEY, lex1)
    const r1 = (await revs()).slice(base)
    ok('taking it keeps the replaced words, marked REDRAFT_TAKEN', r1.length === 1 && r1[0].previousText === mine && r1[0].newText === lex1 && r1[0].origin === 'REDRAFT_TAKEN' && r1[0].previousSource === 'USER', r1.length === 0, JSON.stringify(r1))

    // ── 2. "Edit it" then Save ───────────────────────────────────────────────────────
    await acceptField(copy.id, copy.userId, KEY, mine) // back to the owner's words (itself a revision)
    const before2 = (await revs()).length
    await offerRedraft(copy.id, KEY, { value: 'Lex’s draft two.', rationale: 'r', againstPolicyId: '' })
    await editRedraft(copy.id, KEY)
    ok('"Edit it" leaves the accepted value untouched until Save', (await value()) === mine, false)
    await acceptField(copy.id, copy.userId, KEY, 'Lex’s draft two, edited by the owner.')
    const r2 = (await revs()).slice(before2)
    ok('Save after "Edit it" keeps the replaced words too', r2.length === 1 && r2[0].previousText === mine, r2.length === 0)

    // ── 3. accepting the SAME value writes nothing ───────────────────────────────────
    const before3 = (await revs()).length
    await acceptField(copy.id, copy.userId, KEY)
    ok('re-accepting unchanged words writes no revision', (await revs()).length === before3, false)

    // ── 4. a chat rewrite is recorded ONCE, not again on Save ────────────────────────
    const now = await value()
    const rewritten = 'A chat rewrite of the summary, at the owner’s request.'
    const w = await applyFieldEdit({ ideaId: copy.id, userId: copy.userId, kind: 'field', fieldKey: KEY, text: rewritten } as never)
    const before4 = (await revs()).length
    await acceptField(copy.id, copy.userId, KEY)
    const r4 = (await revs()).filter((r) => r.previousText === now && r.newText === rewritten)
    ok('a chat rewrite then Save: one revision, not two', w.ok && r4.length === 1 && (await revs()).length === before4, r4.length === 2, JSON.stringify(w))

    // ── 5. read_field shows Lex the replaced wording ─────────────────────────────────
    const def = toolByName('read_field')!
    const ctx = { ideaId: copy.id, userId: copy.userId, confirmed: false, turn: { userMessages: [], corpusIds: new Set(), tainted: false } } as unknown as ToolCtx
    const out = await execute(def, ctx, { fieldKey: KEY })
    const text = JSON.stringify(out)
    ok('read_field returns the history, with the owner’s replaced words in it', text.includes('"history"') && text.includes('owner’s own edited paragraph'), !text.includes('"history"'), text.slice(0, 400))
  } finally {
    await deleteScratch(copy.id)
    await prisma.$disconnect()
  }
  console.log(`\ncheck:field-revision-on-accept ${pass}/${pass + fail}${fail ? ` — ${fail} FAILED` : ''}`)
  process.exitCode = fail ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
