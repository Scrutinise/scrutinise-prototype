// 26-S2 §11c — "The Lex snapshot stays rows-only; get_action(n) for a record. Report the snapshot's token count on 452c5ade before and after."
//
//   npx tsx --env-file=.env scripts/measure-lex-snapshot-tokens.ts [ideaPrefix]
//
// Reads the idea's snapshot (the cached block Lex carries every turn) and counts it: characters, and TOKENS by Gemini's own countTokens endpoint
// (free, exact for that tokenizer; Claude's differs slightly, so the figure is a close guide and is labelled so). Nothing is written.
// Run it on two commits against the SAME data to isolate what the code change did to the snapshot's size.
import { prisma } from '../lib/prisma'
import { buildSnapshot } from '../lib/lex/agent/snapshot'

async function geminiTokens(text: string): Promise<number | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:countTokens?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }] }),
    })
    if (!res.ok) return null
    return ((await res.json()) as { totalTokens?: number }).totalTokens ?? null
  } catch { return null }
}

async function main() {
  const prefix = process.argv[2] ?? '452c5ade'
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: prefix }, deletedAt: null }, select: { id: true, title: true } })
  if (!idea) throw new Error(`no idea starts with ${prefix}`)
  const snap = await buildSnapshot(idea.id, { stage: 'strategy', panel: 'actions' })
  const total = `${snap.stable}\n${snap.volatile}`
  const [st, vo, all] = await Promise.all([geminiTokens(snap.stable), geminiTokens(snap.volatile), geminiTokens(total)])
  console.log(JSON.stringify({
    idea: idea.id.slice(0, 8), counts: snap.counts,
    chars: { stable: snap.stable.length, volatile: snap.volatile.length, total: total.length },
    tokensGemini: { stable: st, volatile: vo, total: all },
    tokensApprox_chars_over_4: Math.round(total.length / 4),
  }, null, 2))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
