// ─────────────────────────────────────────────────────────────────────────────
// check:read-section — 212, the read_section tool (21 Oct, CCh).
//
// ⚠ COLD READS (CLAUDE.md §26): every live case takes a section this script did not create, calls only what the
// product calls (`readSection`, the `read_section` tool through `execute`), and compares against a SEPARATE read
// written here — the row's own r2Key fetched with r2Get — not against a second copy of the reader.
// ⚠ A case that examined nothing FAILS. This script writes nothing; every query is a SELECT.
//
// Usage:  npm run check:read-section
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { readSection, READ_SECTION_PAGE_CHARS } from '../lib/lex/read-section'
import { execute, toolByName, MODEL_TOOLS } from '../lib/lex/agent/tools'
import type { ToolCtx } from '../lib/lex/agent/types'

interface Outcome { examined: number; asserted: number; fail?: string; note?: string }
const CRAG_S5 = 'primary-acts-2000plus:ukpga/2010/25:section-5'

const ctx = (): ToolCtx => ({ ideaId: 'check-read-section', userId: 'check', confirmed: false, turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages: [] } })

async function direct(id: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ r2Key: string | null }>>`SELECT "r2Key" FROM corpus_sections WHERE id = ${id} AND status = 'compiled'`
  return rows[0]?.r2Key ? r2Get(rows[0].r2Key) : null
}

const cases: Array<{ name: string; run: () => Promise<Outcome> }> = [
  { name: 'the tool is offered to the model, free', run: async () => {
    const t = toolByName('read_section')
    if (!t || !MODEL_TOOLS.includes(t)) return { examined: 0, asserted: 1, fail: 'read_section is not in MODEL_TOOLS' }
    return { examined: 1, asserted: 2, fail: t.tier === 'free' ? undefined : `tier is ${t.tier}` }
  } },
  { name: 'CRaG s.5 — the whole held text, identical to the stored object', run: async () => {
    const want = await direct(CRAG_S5)
    if (want == null) return { examined: 0, asserted: 0, fail: `${CRAG_S5} has no readable stored text — the case cannot run` }
    const r = await readSection(CRAG_S5)
    if (r.status !== 'text') return { examined: 1, asserted: 1, fail: `status ${r.status}: ${r.reason}` }
    if (want.length <= READ_SECTION_PAGE_CHARS && (r.text !== want || r.nextFrom != null)) return { examined: 1, asserted: 2, fail: `text differs (${r.text?.length} vs ${want.length}) or not complete` }
    return { examined: 1, asserted: 3, note: `${want.length} chars, "${(r.title ?? '').slice(0, 60)}"` }
  } },
  { name: 'through execute: ok, text fenced as untrusted, id becomes citable', run: async () => {
    const c = ctx()
    const res = await execute(toolByName('read_section')!, c, { id: CRAG_S5 })
    const want = (await direct(CRAG_S5)) ?? ''
    if (!res.ok) return { examined: 1, asserted: 1, fail: res.error }
    if (!res.untrusted?.includes('<untrusted_content') || !res.untrusted.includes(want.slice(0, 200))) return { examined: 1, asserted: 2, fail: 'text not in the untrusted channel' }
    if (JSON.stringify(res.data).includes(want.slice(0, 200))) return { examined: 1, asserted: 3, fail: 'third-party text leaked into data' }
    if (!c.turn.tainted || !c.turn.corpusIds.has(CRAG_S5)) return { examined: 1, asserted: 4, fail: 'turn not tainted or id not citable' }
    return { examined: 1, asserted: 4 }
  } },
  { name: 'a vector chunk id (#k) reads its section', run: async () => {
    const r = await readSection(`${CRAG_S5}#0`)
    return { examined: 1, asserted: 2, fail: r.status === 'text' && r.id === CRAG_S5 ? undefined : `${r.status} ${r.id}` }
  } },
  { name: 'a subsection cite climbs to the held section and says so', run: async () => {
    const held = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM corpus_sections WHERE id = ${CRAG_S5}`
    if (!held.length) return { examined: 0, asserted: 0, fail: 'section-5 not held as a whole row' }
    const r = await readSection(`${CRAG_S5}-2`)
    if (r.status !== 'text' || r.readId !== CRAG_S5 || !/not “section-5-2”/.test(r.reason)) return { examined: 1, asserted: 3, fail: `${r.status} ${r.readId} ${r.reason}` }
    return { examined: 1, asserted: 3 }
  } },
  { name: 'not held: no-row with the store’s reason, and the tool fails with it', run: async () => {
    const id = 'primary-acts-2000plus:ukpga/2010/25:section-9999'
    const r = await readSection(id)
    const t = await execute(toolByName('read_section')!, ctx(), { id })
    if (r.status !== 'no-row' || t.ok || !t.error || t.error !== r.reason) return { examined: 1, asserted: 4, fail: `${r.status} / ${t.ok} / ${t.error}` }
    return { examined: 1, asserted: 4, note: r.reason.slice(0, 110) }
  } },
  { name: 'a non-id is refused as bad-id, not as "not held"', run: async () => {
    const r = await readSection('Constitutional Reform and Governance Act s.5')
    return { examined: 0, asserted: 1, fail: r.status === 'bad-id' ? undefined : r.status }
  } },
  { name: 'a long section reads in pages that join to the stored object exactly', run: async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM corpus_sections WHERE corpus = 'primary-acts-2000plus' AND status = 'compiled' AND "wordCount" > 9000 ORDER BY id LIMIT 1`
    if (!rows.length) return { examined: 0, asserted: 0, fail: 'no long section found' }
    const want = (await direct(rows[0].id)) ?? ''
    if (want.length <= READ_SECTION_PAGE_CHARS) return { examined: 1, asserted: 0, fail: `"long" section is only ${want.length} chars` }
    let got = '', from: number | undefined = 0, pages = 0
    while (from != null && pages < 50) { const r = await readSection(rows[0].id, { from }); got += r.text ?? ''; from = r.nextFrom; pages++ }
    return { examined: 1, asserted: 2, fail: got === want ? undefined : `joined ${got.length} vs ${want.length}`, note: `${rows[0].id}: ${want.length} chars in ${pages} pages` }
  } },
  { name: 'Hansard (any collection) reads by the same key', run: async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM corpus_sections WHERE corpus = 'pwdata-debates' AND status = 'compiled' LIMIT 1`
    if (!rows.length) return { examined: 0, asserted: 0, fail: 'no Hansard row' }
    const want = await direct(rows[0].id)
    const r = await readSection(rows[0].id)
    return { examined: 1, asserted: 1, fail: r.status === 'text' && want != null && want.startsWith(r.text!.slice(0, 500)) ? undefined : `${r.status}: ${r.reason}`, note: rows[0].id }
  } },
]

async function main() {
  let failed = 0, asserted = 0
  for (const c of cases) {
    let o: Outcome
    try { o = await c.run() } catch (err) { o = { examined: 0, asserted: 0, fail: `threw: ${err instanceof Error ? err.message : err}` } }
    asserted += o.asserted
    const bad = o.fail ?? (o.asserted === 0 ? 'asserted nothing' : undefined)
    if (bad) failed++
    console.log(`${bad ? '✗' : '✓'} ${c.name}  [examined ${o.examined}, asserted ${o.asserted}]${o.note ? ` — ${o.note}` : ''}${bad ? `\n    ${bad}` : ''}`)
  }
  console.log(`\ncheck:read-section ${cases.length - failed}/${cases.length} cases, ${asserted} assertions${failed ? `, ${failed} FAILED` : ''}`)
  process.exitCode = failed ? 1 : 0
}
main().finally(() => prisma.$disconnect())
