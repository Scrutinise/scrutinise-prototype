// ─────────────────────────────────────────────────────────────────────────────
// 292 (CCh-Lex 28 Oct (5)) — copy every idea's stored chat (`Idea.aiChatHistory`) into the LexMessage table, numbering Lex's
// replies (282). Calls the SAME function a turn calls the first time it touches an idea (`ensureCopied`), so an idea a turn has
// already copied is skipped, and nothing here can number a conversation differently from the live path.
// ⚠ Run AFTER the code that writes the table is deployed: before then a turn writes only the JSON, and an idea copied early
// would miss it for good (a copied idea is never copied again).
//
//   npx tsx --env-file=.env scripts/backfill-292-messages.ts            (dry run: what would be copied)
//   npx tsx --env-file=.env scripts/backfill-292-messages.ts --apply    (copies, then reads back)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { ensureCopied } from '../lib/lex/agent/messages'
import type { ChatMsg } from '../lib/lex/agent/loop'

const APPLY = process.argv.includes('--apply')

async function main() {
  const ideas = await prisma.idea.findMany({ where: { isScratch: false }, select: { id: true, title: true, aiChatHistory: true } })
  let ideasWith = 0, ideasCopied = 0, msgs = 0, already = 0
  for (const i of ideas) {
    const h = (Array.isArray(i.aiChatHistory) ? i.aiChatHistory : []) as ChatMsg[]
    const real = h.filter((m) => (m.role === 'user' || m.role === 'lex') && typeof m.content === 'string' && m.content.trim())
    if (!real.length) continue
    ideasWith++
    if (await prisma.lexMessage.count({ where: { ideaId: i.id } })) { already++; continue }
    if (!APPLY) { msgs += real.length; ideasCopied++; continue }
    const r = await ensureCopied(i.id, h)
    if (r.copied) { ideasCopied++; msgs += r.copied }
    if (r.copied !== real.length) console.log(`  ${i.id.slice(0, 8)}: ${real.length} messages in the JSON, ${r.copied} copied`)
  }
  console.log(`${APPLY ? 'COPIED' : 'WOULD COPY'}: ${msgs} messages on ${ideasCopied} ideas; ${already} ideas already in the table; ${ideasWith} ideas hold a conversation`)
  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }
  // ── read back, plain client: every idea's table matches its JSON, message for message, and its replies run 1..N ──
  let match = 0, mismatch = 0
  for (const i of await prisma.idea.findMany({ where: { isScratch: false }, select: { id: true, aiChatHistory: true } })) {
    const h = ((Array.isArray(i.aiChatHistory) ? i.aiChatHistory : []) as ChatMsg[]).filter((m) => (m.role === 'user' || m.role === 'lex') && typeof m.content === 'string' && m.content.trim())
    if (!h.length) continue
    const rows = await prisma.lexMessage.findMany({ where: { ideaId: i.id }, orderBy: { n: 'asc' }, select: { role: true, content: true, replyNo: true } })
    const tail = rows.slice(-h.length)
    const same = tail.length === h.length && tail.every((r, k) => r.role === h[k].role && r.content === h[k].content && (r.replyNo ?? null) === ((h[k].replyNo as number | undefined) ?? null))
    const nums = rows.filter((r) => r.replyNo != null).map((r) => r.replyNo!)
    same && nums.every((v, k) => v === k + 1) ? match++ : (mismatch++, console.log(`  MISMATCH ${i.id.slice(0, 8)}`))
  }
  console.log(`READ BACK: ${match} ideas' tables match their JSON and number replies 1..N; ${mismatch} do not`)
}
main().finally(() => prisma.$disconnect())
