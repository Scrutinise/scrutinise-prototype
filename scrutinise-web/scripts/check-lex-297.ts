// ─────────────────────────────────────────────────────────────────────────────
// check:lex-297 (CCh-Lex 2 Nov (1) B) — a "not found" carries its working: what was searched, what was found and why it falls short,
// "+ Add research", and where the official text is published. The honesty check refuses a bare one.
//
//   A · COLD READ (§26): Charlie's real Reply 64 on 452c5ade ("The corpus holds only a summary of the current Civil Service Code…"),
//       read with a plain prisma read, through the REAL checkReply → flagged bare-not-found, naming the missing parts.
//   B · the same reply with its working added → not flagged (the control that stays false).
//   C · the last resort keeps the TRUE sentence, adds the fill sentence, and does not claim anything was removed.
//   D · "not found" about the screen, a field, the chat or the user's own search is not flagged (the four seen in stored replies).
//   E · the rule is in the system prompt the agent loop sends.
// Read-only. No model call.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/check-lex-297.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { checkReply, stripViolations, notFoundGaps, NOT_FOUND_FILL } from '../lib/lex/agent/honesty'
import { knownLabels } from '../lib/lex/agent/controls'
import { SYSTEM_PREFIX } from '../lib/lex/agent/system-prompt'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
let pass = 0, fail = 0, run = 0
function ok(name: string, cond: boolean, detail = '') {
  run++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function main() {
  const labels = knownLabels()
  const searchRan = [{ name: 'search_corpus', category: 'search' as const, ok: true }]

  console.log('A · cold read — Reply 64 on 452c5ade')
  const real = await prisma.lexMessage.findFirst({ where: { ideaId: IDEA, role: 'lex', content: { contains: 'holds only a summary of the current Civil Service Code' } }, select: { replyNo: true, content: true } })
  ok('the reply Charlie was given is in the store', !!real, 'not found — the check cannot run its cold read')
  if (real) {
    const v = checkReply({ reply: real.content, outcomes: searchRan, knownLabels: labels })
    const bare = v.find((x) => x.kind === 'bare-not-found')
    ok(`Reply ${real.replyNo} is flagged bare-not-found`, !!bare, JSON.stringify(v.map((x) => x.kind)))
    ok('…naming “+ Add research” as missing', !!bare && /Add research/.test(bare.detail), bare?.detail)
    ok('…and where the official text is published', !!bare && /published/.test(bare.detail), bare?.detail)

    console.log('B · the same reply, with its working')
    const fixed = real.content.replace(
      'The corpus holds only a summary of the current Civil Service Code, not its full text.',
      'I searched the corpus for "Civil Service Code". The corpus holds only a summary of the current Civil Service Code, not its full text: the gov.uk publication page\'s 42-word description, which names the core values but none of the clauses. The full text is published at https://www.gov.uk/government/publications/civil-service-code/the-civil-service-code — add it with “+ Add research” and I will read it.')
    ok('the control: the reply with all four parts is not flagged', !checkReply({ reply: fixed, outcomes: searchRan, knownLabels: labels }).some((x) => x.kind === 'bare-not-found'),
      JSON.stringify(notFoundGaps(fixed)))

    console.log('C · the last resort')
    const stripped = stripViolations(real.content, v.filter((x) => x.kind === 'bare-not-found'), searchRan)
    ok('the true sentence is kept', stripped.includes('The corpus holds only a summary of the current Civil Service Code, not its full text.'))
    ok('the fill sentence is added once', stripped.split(NOT_FOUND_FILL).length === 2)
    ok('no "Nothing was changed" / "I removed part" note (nothing was removed)', !/Nothing was changed on your idea this turn\.$|I removed part of that reply/.test(stripped))
    ok('the reply\'s layout survives (its ## headings are still on their own lines)', (stripped.match(/^## /gm) ?? []).length === (real.content.match(/^## /gm) ?? []).length)
  }

  console.log('D · a "not found" that is not about material is left alone')
  for (const s of [
    'I have not found your second paragraph in either field, and I can\'t say what happened to it.',
    'I found nothing in the controls for adding to the "things to read" list in the Working Area, so I can\'t confirm it appears there.',
    'I can\'t find a record in this chat of an agreed split between the Civil Service Code and a separate management code.',
    'That is why you couldn\'t find it.',
    'The draft Code is not in the Documents section, because I wrote it into the Action details of #207, which is a separate field.',
  ]) ok(`not flagged: "${s.slice(0, 60)}…"`, notFoundGaps(s) === null)
  ok('a question is not a claim: "Could I not find it in the corpus?"', notFoundGaps('Could I not find it in the corpus?') === null)

  console.log('E · the rule reaches the model')
  ok('SYSTEM_PREFIX carries the rule', /WHEN YOU CANNOT FIND SOMETHING, a bare “not found” is not an answer/.test(SYSTEM_PREFIX))
  ok('…and the agent loop sends SYSTEM_PREFIX', /SYSTEM_PREFIX/.test(readFileSync('lib/lex/agent/loop.ts', 'utf8')))
  ok('"Add research" is a known control, so naming it is never itself flagged', labels.has('add research'))

  console.log(`\ncheck:lex-297 — ${run} run, ${pass} passed, ${fail} failed`)
  process.exitCode = fail ? 1 : 0
}
main().finally(() => prisma.$disconnect())
