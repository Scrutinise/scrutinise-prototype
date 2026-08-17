/**
 * probe-spend-write.ts — does a recorded call actually land, with the right numbers?
 *
 * ⚠ tsc-clean and check-passing is not evidence that a write path works: this project has
 * already shipped a stats layer that was both and had six real bugs, three reporting SUCCESS.
 * This puts a synthetic Gemini body through the exact function the ten call sites use, then
 * reads the row back and reconciles it against what was sent.
 */
import { recordGeminiUsage, priceEntry } from '../lib/lex/spend-ledger'
import { prisma } from '../lib/prisma'
export {}

async function main() {
  const ref = `probe-${Date.now()}`
  // A real Gemini usage block, thinking included.
  const body = { usageMetadata: { promptTokenCount: 1234, candidatesTokenCount: 567, thoughtsTokenCount: 89 } }
  const priced = await recordGeminiUsage(body, {
    stream: 'admin', pass: 'lex.chat', model: 'gemini-2.5-flash',
    userId: null, ideaId: null, groupId: 'probe-group', ref,
  })
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT "tokensIn", "tokensOut", "tokensThinking", "estCostPence", unpriced, "groupId", pass
    FROM "LlmSpend" WHERE ref = ${ref}`
  console.log('\n════ ATTEMPTED vs STORED ════')
  if (!rows.length) { console.log('  ✗ NO ROW WAS WRITTEN — the ledger is not recording'); process.exit(1) }
  const r = rows[0]
  const ok = (n: string, a: unknown, b: unknown) =>
    console.log(`  ${String(a) === String(b) ? '✓' : '✗'} ${n.padEnd(16)} sent ${String(a).padEnd(10)} stored ${String(b)}`)
  ok('tokensIn', 1234, r.tokensIn)
  ok('tokensOut', 567, r.tokensOut)
  ok('tokensThinking', 89, r.tokensThinking)
  ok('groupId', 'probe-group', r.groupId)
  ok('pass', 'lex.chat', r.pass)
  console.log(`  ⚠ thinking billed as OUTPUT: priced from ${567 + 89} out tokens`)
  console.log(`    priced ${priced.pence?.toFixed(4)}p · stored ${r.estCostPence}p · unpriced=${r.unpriced}`)
  const expect = priceEntry({ model: 'gemini-2.5-flash', tokensIn: 1234, tokensOut: 567, tokensThinking: 89 })
  console.log(`  ${Math.abs((expect.pence ?? 0) - Number(r.estCostPence)) < 0.001 ? '✓' : '✗'} the stored price matches an independent recomputation`)
  // ⚠ leave no probe rows behind
  await prisma.$executeRaw`DELETE FROM "LlmSpend" WHERE ref = ${ref}`
  console.log('  probe row deleted')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
