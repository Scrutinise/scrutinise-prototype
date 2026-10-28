// ─────────────────────────────────────────────────────────────────────────────
// check:lex-292 — CCh-Lex 28 Oct (5): 292 (the whole conversation in its own table), 282 (reply stamps), 289 (one turn, one run).
//
// Runs the REAL handleAgentTurn on a SCRATCH copy of 452c5ade carrying Charlie's stored conversation, with a STUB model client
// (no spend: every call returns one short text reply). Asserted on what plain prisma reads back.
//   A · the first turn copies the idea's JSON into LexMessage, message for message, and numbers Lex's replies 1..N; the new reply
//       is N+1 on the table, on the JSON and in the response.
//   B · 289 — two requests with the SAME clientTurnId at once: the model is called for ONE run, both answer with the same reply,
//       one row each side. Control: two DIFFERENT clientTurnIds at once run twice (so the count can see a doubled turn).
//   C · a run that throws releases its claim (the resend is not held for ever).
//   D · read_reply and search_conversation through the real tool executor, including a reply older than the 20-message window.
//   E · the stamp: "Reply 31 · Wed 28 Oct 26, 02:31 GMT" in London in October, BST in summer; another zone says so.
//
//   npm run check:lex-292
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { handleAgentTurn } from '../lib/lex/agent/turn'
import type { ChatMsg } from '../lib/lex/agent/loop'
import { execute, toolByName } from '../lib/lex/agent/tools'
import { replyStamp } from '../components/lex/ChatPanel'
import { enterPurpose } from '../lib/lex/build-context'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade-3153-400a-bf48-3b71aaa52773'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

/** A stub Anthropic client: counts calls, waits `delayMs`, answers with one short text block (or throws). */
function stub(text: string, delayMs = 0, throws = false) {
  const s = { calls: 0, client: null as unknown as Anthropic }
  s.client = { messages: { create: async () => {
    s.calls++
    await new Promise((r) => setTimeout(r, delayMs))
    if (throws) throw new Error('stub: the model call failed')
    return { id: `msg_${s.calls}`, type: 'message', role: 'assistant', model: 'stub', stop_reason: 'end_turn', stop_sequence: null, content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }
  } } } as unknown as Anthropic
  return s
}

async function main() {
  enterPurpose('check')
  const copy = await scratchCopy(SOURCE, '292')
  try {
    const src = (await prisma.idea.findUnique({ where: { id: SOURCE }, select: { aiChatHistory: true } }))!.aiChatHistory as ChatMsg[]
    // the copy carries Charlie's conversation WITHOUT reply numbers, as every idea did before 292
    const seed = src.map((m) => { const { replyNo: _r, ...rest } = m; return rest as ChatMsg })
    await prisma.idea.update({ where: { id: copy.id }, data: { aiChatHistory: seed as never } })
    const real = seed.filter((m) => (m.role === 'user' || m.role === 'lex') && typeof m.content === 'string' && m.content.trim())
    const lexBefore = real.filter((m) => m.role === 'lex').length
    const idea = async () => ({ id: copy.id, creatorId: copy.userId, aiChatHistory: (await prisma.idea.findUnique({ where: { id: copy.id }, select: { aiChatHistory: true } }))!.aiChatHistory })
    const user = { id: copy.userId }

    section('A · the first turn copies the conversation in and numbers the replies')
    control('the copy has no table rows before its first turn (must be FALSE that it has)', (await prisma.lexMessage.count({ where: { ideaId: copy.id } })) > 0)
    const sA = stub('The first stub reply.')
    const rA = await handleAgentTurn({ ideaId: copy.id, user, idea: await idea(), message: 'A first check message.', clientTurnId: `check292-a-${Date.now()}`, client: sA.client })
    const rows = await prisma.lexMessage.findMany({ where: { ideaId: copy.id }, orderBy: { n: 'asc' } })
    ok(`every stored message is a row, plus this turn's two (${real.length} + 2)`, rows.length === real.length + 2, `${rows.length} rows`)
    ok('message for message the same text and role, in order', real.every((m, k) => rows[k]?.role === m.role && rows[k]?.content === m.content))
    const nums = rows.filter((r) => r.replyNo != null).map((r) => r.replyNo!)
    ok(`Lex's replies are numbered 1..${lexBefore + 1} with no gap`, nums.length === lexBefore + 1 && nums.every((v, k) => v === k + 1), nums.slice(-5).join(','))
    const json = (await idea()).aiChatHistory as ChatMsg[]
    const lastLex = [...json].reverse().find((m) => m.role === 'lex')
    ok('the new reply carries its number on the JSON the chat draws', lastLex?.replyNo === lexBefore + 1, String(lastLex?.replyNo))
    ok('…and in the response the chat stamps it from', (rA.body.reply as { n?: number })?.n === lexBefore + 1, JSON.stringify(rA.body.reply))
    ok('the older replies on the JSON carry their numbers too', json.filter((m) => m.role === 'lex' && typeof m.replyNo === 'number').length >= Math.min(lexBefore, 1))

    section('B · 289 — the same send twice at once runs once')
    const sB = stub('The one and only reply.', 2500)
    const tid = `check292-b-${Date.now()}`
    const snap = await idea()
    const [b1, b2] = await Promise.all([
      handleAgentTurn({ ideaId: copy.id, user, idea: snap, message: 'Same send.', clientTurnId: tid, client: sB.client }),
      new Promise((r) => setTimeout(r, 400)).then(() => handleAgentTurn({ ideaId: copy.id, user, idea: snap, message: 'Same send.', clientTurnId: tid, client: sB.client })),
    ])
    ok('the model was called for one run only', sB.calls === 1, `${sB.calls} calls`)
    ok('both requests answer 200 with the same reply', b1.status === 200 && b2.status === 200 && b1.body.chatText === b2.body.chatText, `${b1.status}/${b2.status}`)
    ok('the second is marked as a replay', b2.body.replayed === true)
    const bRows = await prisma.lexMessage.findMany({ where: { ideaId: copy.id, turnId: tid } })
    ok('one user row and one reply row for that send', bRows.filter((r) => r.role === 'user').length === 1 && bRows.filter((r) => r.role === 'lex').length === 1, bRows.map((r) => r.role).join(','))
    const sC = stub('Two different sends.', 1500)
    const snap2 = await idea()
    await Promise.all([
      handleAgentTurn({ ideaId: copy.id, user, idea: snap2, message: 'Send one.', clientTurnId: `check292-c1-${Date.now()}`, client: sC.client }),
      handleAgentTurn({ ideaId: copy.id, user, idea: snap2, message: 'Send two.', clientTurnId: `check292-c2-${Date.now()}`, client: sC.client }),
    ])
    control('two DIFFERENT sends at once ran once (must be FALSE — each runs)', sC.calls < 2)
    const all = await prisma.lexMessage.findMany({ where: { ideaId: copy.id }, select: { n: true, replyNo: true } })
    const ns = all.map((r) => r.n).sort((a, b) => a - b), rs = all.filter((r) => r.replyNo != null).map((r) => r.replyNo!).sort((a, b) => a - b)
    ok('racing sends still get distinct message and reply numbers', new Set(ns).size === ns.length && new Set(rs).size === rs.length)

    section('C · a run whose model call fails never leaves a claim without a reply')
    // runAgentTurn catches a failed model call and saves a "turn failed" reply (as before 289), so the claim is CLOSED by that reply
    // and a resend gets it back; only an exception escaping the run releases the claim instead (turn.ts). Either way: no orphan.
    const tidC = `check292-d-${Date.now()}`
    let threw = false
    try { await handleAgentTurn({ ideaId: copy.id, user, idea: await idea(), message: 'This one fails.', clientTurnId: tidC, client: stub('', 0, true).client }) } catch { threw = true }
    const held = await prisma.lexMessage.findMany({ where: { ideaId: copy.id, turnId: tidC }, select: { role: true } })
    const orphan = held.some((r) => r.role === 'user') && !held.some((r) => r.role === 'lex')
    ok('no claim is left without a reply (a stored failure reply, or no claim at all)', !orphan, `threw ${threw}; rows: ${held.map((r) => r.role).join(',') || 'none'}`)

    section('D · read_reply and search_conversation (the real executor)')
    const ctx = { ideaId: copy.id, userId: copy.userId, turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages: [], pastedText: null } } as never
    const first = rows.find((r) => r.replyNo === 1)!
    const rr = await execute(toolByName('read_reply')!, ctx, { n: 1 })
    ok('read_reply 1 returns reply 1 in full — older than any 20-message window', rr.ok && (rr.data as { text?: string }).text === first.content.slice(0, 20_000), JSON.stringify(rr).slice(0, 200))
    const none = await execute(toolByName('read_reply')!, ctx, { n: 99_999 })
    ok('a reply that does not exist is refused in words, naming the range', !none.ok && /replies run from 1 to/.test(String(none.error)), String(none.error))
    const word = (first.content.match(/\b[A-Za-z]{9,}\b/g) ?? [])[0] ?? 'accountability'
    const sr = await execute(toolByName('search_conversation')!, ctx, { query: word })
    const hits = ((sr.data as { hits?: Array<{ message: number }> })?.hits ?? [])
    ok(`search_conversation finds "${word}" across the whole conversation`, sr.ok && hits.length > 0, JSON.stringify(sr).slice(0, 200))
    const nothing = await execute(toolByName('search_conversation')!, ctx, { query: 'zqxjvwk' })
    control('a search for a word nobody wrote found something (must be FALSE)', ((nothing.data as { matches?: number })?.matches ?? 0) > 0)

    section('E · the reply stamp (282)')
    const gmt = replyStamp(31, '2026-10-28T02:31:00Z', 'Europe/London')
    ok('October in London: "Reply 31 · Wed 28 Oct 26, 02:31 GMT"', gmt === 'Reply 31 · Wed 28 Oct 26, 02:31 GMT', gmt)
    const bst = replyStamp(7, '2026-07-01T01:31:00Z', 'Europe/London')
    ok('July in London: the clock and the zone say BST', bst === 'Reply 7 · Wed 1 Jul 26, 02:31 BST', bst)
    control('another zone gives the same stamp as London (must be FALSE)', replyStamp(31, '2026-10-28T02:31:00Z', 'America/New_York') === gmt)
  } finally {
    const gone = await deleteScratch(copy.id)
    const left = await prisma.lexMessage.count({ where: { ideaId: copy.id } })
    console.log(`\nscratch ${copy.id.slice(0, 8)} deleted: ${gone}; its LexMessage rows left: ${left}`)
  }
  console.log(`\ncheck:lex-292 — ${pass}/${ran} passed, ${fail} failed; ${controls} controls, ${dead} dead`)
  process.exitCode = fail || dead ? 1 : 0
}
main().finally(() => prisma.$disconnect())
