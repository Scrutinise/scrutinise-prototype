// ─────────────────────────────────────────────────────────────────────────────
// check:lex-287 — CCh-Lex 28 Oct (3). Charlie's request on 452c5ade (02:55 UTC) for long Action details on #59 was cut off at the output
// limit three times in a row and saved nothing (47.2p): one set_action_detail call was being written when the 4,096-token ceiling hit.
//
// A · offline: the ceiling is 16,000; the cut-off sentence names what was being written and what was saved; the platform record carries
//     the cut so the next turn sees it. Built from a real-shaped Anthropic message, not prose.
// B · live (--live): CHARLIE'S OWN WORDS, read from his stored history, sent to a SCRATCH copy through handleAgentTurn with the ceiling
//     forced low (the seam), then "carry on" with the stored history — exactly what he did. Asserted on the scratch action's saved
//     Action details (plain prisma): sections land before the cut, the cut names them, "carry on" ADDS sections and repeats none.
//     Then the same request at the real ceiling, to price it. Costs about 40–80p; prints every turn's cost.
//
//   npm run check:lex-287 [-- --live]
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { handleAgentTurn } from '../lib/lex/agent/turn'
import { cutOffRecord, cutOffSentence, platformRecord, type ChatMsg } from '../lib/lex/agent/loop'
import { MODEL_TOOLS } from '../lib/lex/agent/tools'
import { enterPurpose } from '../lib/lex/build-context'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade-3153-400a-bf48-3b71aaa52773'
const LIVE = process.argv.includes('--live')

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

function partA() {
  section('A · offline — the ceiling, the sentence, the record')
  const src = readFileSync(join(__dirname, '../lib/lex/agent/loop.ts'), 'utf8')
  ok('the agent turn\'s output ceiling is 16,000', /const MAX_OUTPUT_TOKENS = 16000\b/.test(src))
  ok('add_action_details_section is offered to the model', MODEL_TOOLS.some((t) => t.name === 'add_action_details_section'))

  const cutMsg = { content: [{ type: 'tool_use', id: 't1', name: 'add_action_details_section', input: { action: 59, heading: 'Point 4' } }] } as unknown as Anthropic.Message
  const log = [
    { name: 'get_action', input: { action: 59 }, ok: true, pending: false, summary: '{}', ms: 1 },
    { name: 'add_action_details_section', input: { action: 59, heading: 'Points 1 to 3' }, ok: true, pending: false, summary: '{}', ms: 1 },
  ]
  const c = cutOffRecord(cutMsg, log as never)
  const s = cutOffSentence(c)
  ok('the cut names what was being written and for which action', /a section of the Action details for #59/.test(s), s)
  ok('…and what was saved before it', /Points 1 to 3/.test(s) && !/Nothing was saved/.test(s), s)
  ok('a read is not reported as saved', !c.saved.some((x) => /get_action/.test(x)), JSON.stringify(c.saved))
  const rec = platformRecord({ role: 'lex', content: s, cut: c } as ChatMsg)
  ok('the platform record carries the cut into the next turn', /CUT OFF/.test(rec) && /Points 1 to 3/.test(rec), rec)
  const none = cutOffSentence(cutOffRecord(cutMsg, []))
  ok('with nothing saved, it says so', /Nothing was saved this turn/.test(none), none)
  control('a cut-off record built from a reply that saved nothing claiming something was saved (must be FALSE)', !/Nothing was saved/.test(none))
}

async function partB() {
  section('B · live — Charlie\'s own request, forced cut, then "carry on", on a scratch copy')
  if (!LIVE) { skip('B', 'pass --live; it spends about 40–80p on a scratch copy'); return }
  const hist = ((await prisma.idea.findUnique({ where: { id: SOURCE }, select: { aiChatHistory: true } }))!.aiChatHistory as ChatMsg[])
  const ask = hist.find((m) => m.role === 'user' && String(m.content).startsWith('This accountability code action should have a "detail" box'))
  if (!ask) { skip('B', 'Charlie\'s 02:55 request is not in the stored history'); return }

  const copy = await scratchCopy(SOURCE, '287')
  // ⚠ The request says "all those 13 items" — it only means something with the conversation before it. A copy with no history made Lex
  // (rightly) ask which action was meant, and the first two runs measured that, not 287. So the copy gets Charlie's history up to the
  // request, and his summary, exactly as Lex had them at 02:55.
  const src = (await prisma.idea.findUnique({ where: { id: SOURCE }, select: { aiChatSummary: true } }))!
  const prior = hist.slice(0, hist.indexOf(ask))
  await prisma.idea.update({ where: { id: copy.id }, data: { aiChatHistory: prior as never, aiChatSummary: src.aiChatSummary } })
  const target = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: 59 }, select: { id: true, commentary: true } })
  const before = target?.commentary ?? ''
  const headings = (t: string) => (t.match(/^## .+$/gm) ?? []).map((h) => h.trim())
  const total = { forced: 0, real: 0 }
  enterPurpose('check')
  try {
    let history: ChatMsg[] = prior
    const turn = async (message: string, maxOutputTokens?: number) => {
      const r = await handleAgentTurn({ ideaId: copy.id, user: { id: copy.userId }, idea: { id: copy.id, creatorId: copy.userId, aiChatHistory: history }, message, clientTurnId: `check287-${Date.now()}`, maxOutputTokens })
      history = ((await prisma.idea.findUnique({ where: { id: copy.id }, select: { aiChatHistory: true } }))!.aiChatHistory as ChatMsg[])
      const last = history[history.length - 1]
      console.log(`  turn "${message.slice(0, 30)}…" ceiling ${maxOutputTokens ?? 16000}: ended ${r.result?.ended}, ${r.result?.cost.pence.toFixed(2)}p, out ${r.result?.cost.tokensOut} tokens, ${r.result?.cost.calls} calls, ${r.result?.toolLog.length} tools`)
      // Every writing tool, with its target, size and result — so a failure says WHERE the text went.
      for (const t of r.result?.toolLog ?? []) {
        if (['get_action', 'read_field', 'list_actions', 'read_reply', 'search_conversation', 'explain'].includes(t.name)) continue
        const i = (t.input ?? {}) as Record<string, unknown>
        const size = ['detail', 'text', 'value', 'practicalStep'].map((k) => (typeof i[k] === 'string' ? `${k}=${(i[k] as string).length}ch` : '')).filter(Boolean).join(' ')
        console.log(`    ${t.name} action=${i.action ?? i.fieldKey ?? ''} ${i.heading ? `"${i.heading}" ` : ''}${size} mode=${i.mode ?? ''} → ${t.ok ? 'ok' : `FAILED: ${t.error}`}`)
      }
      if (r.result?.cut) console.log(`    cut: ${JSON.stringify(r.result.cut)}`)
      console.log(`    reply ends: ${JSON.stringify(String(last.content).slice(-260))}`)
      return { r, last }
    }
    const explanations = async () => new Map((await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id }, select: { number: true, commentary: true } })).map((a) => [a.number, a.commentary ?? '']))
    const diff = (a: Map<number | null, string>, b: Map<number | null, string>) => [...b].filter(([n, t]) => (a.get(n) ?? '') !== t).map(([n, t]) => `#${n} ${(a.get(n) ?? '').length}→${t.length}ch`)

    // B1 · Charlie's own request at the real ceiling. ⚠ Lex may sensibly ASK which action is meant (#59 or #207 — his screen had one
    // open; a script has no screen), so the property asserted is the one 287 is about: the turn is not cut off. What it wrote is printed.
    console.log('  B1 · Charlie\'s request, his history, the real ceiling')
    const e0 = await explanations()
    const t1 = await turn(String(ask.content))
    total.real += t1.r.result?.cost.pence ?? 0
    ok('his request is no longer cut off at the length limit', t1.r.result?.ended !== 'max_tokens', `ended ${t1.r.result?.ended}`)
    console.log(`    Action details changed: ${diff(e0, await explanations()).join(', ') || 'none — Lex asked first'}`)

    // B2 · the cut, forced: an explicit instruction to write, under a ceiling one section cannot fit in; then "carry on" at the real one.
    console.log('  B2 · a forced cut, then "carry on"')
    await prisma.lexCoherentAction.update({ where: { id: target!.id }, data: { commentary: before } })
    await prisma.idea.update({ where: { id: copy.id }, data: { aiChatHistory: prior as never, aiChatSummary: src.aiChatSummary } })
    history = prior
    const t2 = await turn('Write the Action details of #59 now, without asking me first: four sections, one per call, each about 400 words — the 13 points, the guiding policy\'s requirements, the legislation actions\' requirements, and guidance for the drafter.', 700)
    total.forced += t2.r.result?.cost.pence ?? 0
    const after2 = (await prisma.lexCoherentAction.findUnique({ where: { id: target!.id }, select: { commentary: true } }))?.commentary ?? ''
    if (t2.r.result?.ended !== 'max_tokens') skip('the cut-off message', `the forced turn ended ${t2.r.result?.ended}, not at the limit`)
    else {
      ok('the cut-off reply says what Lex was writing and what was saved', /I was cut off at the length limit while writing/.test(String(t2.last.content)) && /Saved before the cut|Nothing was saved/.test(String(t2.last.content)), String(t2.last.content).slice(-320))
      ok('the stored reply carries the cut record for the next turn', !!t2.last.cut, JSON.stringify(t2.last.cut))
    }
    const t3 = await turn('carry on')
    total.real += t3.r.result?.cost.pence ?? 0
    const after3 = (await prisma.lexCoherentAction.findUnique({ where: { id: target!.id }, select: { commentary: true } }))?.commentary ?? ''
    const h2 = headings(after2), h3 = headings(after3)
    console.log(`    #59 sections: before ${headings(before).length}, after the cut ${h2.length}, after "carry on" ${h3.length} (${after3.length} chars)`)
    ok('"carry on" built on #59\'s Action details rather than ending without writing', h3.length > h2.length, `sections ${h2.length} → ${h3.length}`)
    ok('…keeping what was saved before the cut', after3.includes(after2.trim().slice(0, 300)))
    ok('…and not cut off itself', t3.r.result?.ended !== 'max_tokens', `ended ${t3.r.result?.ended}`)
    const dupes = h3.filter((h, i) => h3.indexOf(h) !== i)
    ok('no section was written twice', dupes.length === 0, dupes.join(' | '))
    const planted = ['## A', '## B', '## A']
    control('the duplicate test finding nothing in a list planted with one (must be FALSE)', planted.filter((h, i) => planted.indexOf(h) !== i).length === 0)
  } finally {
    await deleteScratch(copy.id)
    const left = await prisma.idea.findUnique({ where: { id: copy.id }, select: { deletedAt: true } })
    ok('the scratch copy is gone (re-read)', !left || !!left.deletedAt)
    console.log(`  spent: forced-ceiling turns ${total.forced.toFixed(2)}p, real-ceiling turn ${total.real.toFixed(2)}p`)
  }
}

async function main() {
  partA()
  await partB()
  console.log(`\ncheck:lex-287 — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main()
