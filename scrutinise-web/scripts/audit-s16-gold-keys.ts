/**
 * audit-s16-gold-keys.ts — S16 §3.3. WHAT KIND OF DOCUMENT IS EACH GOLD ANSWER KEY?
 *
 * ⚠⚠ THE QUESTION THIS ANSWERS IS NOT "IS RETRIEVAL GOOD" BUT "CAN THIS QUESTION BE SCORED AT
 * ALL". The brief says committees at 2 of 10 is *"either a retrieval defect or a question-set
 * defect, and both are worth knowing."* Probing the five failures individually showed the
 * documents ARE indexed and retrievable — searching each key's own title returns it at ranks 1, 1,
 * 2 and 4 — so it is the second.
 *
 * Two shapes make a question unscoreable as posed, and both are counted here rather than argued:
 *
 *  1. **The key is a `Correspondence:` ministerial letter** while the question asks what a
 *     COMMITTEE said or examined. Measured: 10 of committees' 19 keys, against 0 of 19 in every
 *     other collection.
 *  2. **The key is ONE written-evidence submission** out of an inquiry holding many equally valid
 *     ones. Measured separately by counting the inquiry's submissions: S10-Q8's key is 1 of 525,
 *     S10-Q6's 1 of 115, S10-Q9's 1 of 54 — and the control is exact, because the only
 *     evidence-keyed committees question that IS found, S10-Q7, is drawn from the smallest class
 *     at 1 of 26. With a 20-wide window and 525 equally good documents, perfect retrieval scores
 *     wrong ~96% of the time.
 *
 * ⚠ This is offered to whoever re-keys the gold set (the debates re-key is already with Charlie).
 * It changes no code and asserts nothing about the retriever.
 *
 * Usage:
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s16-gold-keys.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

async function main() {
  const arms = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/census/s15-arms.json'), 'utf8'))
  const rows: any[] = arms.rows
  const keys = Array.from(new Set(rows.flatMap((r) => r.keys as string[])))
  const meta = await prisma.$queryRaw<Array<{ id: string; corpus: string; sectionTitle: string | null; words: number | null }>>`
    SELECT id, corpus, "sectionTitle", "wordCount" AS words FROM corpus_sections WHERE id IN (${Prisma.join(keys)})`
  const byId = new Map(meta.map((m) => [m.id, m]))

  const isCorr = (t: string | null) => !!t && /^correspondence\b/i.test(t.trim())
  console.log('collection          n   keys  CORRESPONDENCE  other   found  median words')
  const byColl = new Map<string, any[]>()
  for (const r of rows) {
    const a = byColl.get(r.collection) ?? []
    a.push(r); byColl.set(r.collection, a)
  }
  for (const [coll, rs] of [...byColl.entries()].sort()) {
    const ks = rs.flatMap((r) => (r.keys as string[]).map((k) => byId.get(k)).filter(Boolean)) as any[]
    const corr = ks.filter((m) => isCorr(m.sectionTitle)).length
    const found = rs.filter((r) => r.foundInStream && r.inStream >= 0 && r.inStream < 20).length
    const ws = ks.map((m) => Number(m.words ?? 0)).sort((a, b) => a - b)
    console.log(
      `${coll.padEnd(19)} ${String(rs.length).padStart(2)}  ${String(ks.length).padStart(5)}  ` +
      `${String(corr).padStart(14)}  ${String(ks.length - corr).padStart(5)}   ${String(found).padStart(5)}  ${String(ws[Math.floor(ws.length / 2)] ?? 0).padStart(12)}`)
  }

  console.log('\ncommittees keys, one per line (title kind is the finding):')
  for (const r of rows.filter((x) => x.collection === 'committees')) {
    const hit = (r.keys as string[]).map((k) => byId.get(k)).find(Boolean) as any
    const ok = r.foundInStream && r.inStream >= 0 && r.inStream < 20
    console.log(`  ${r.id.padEnd(9)} ${ok ? 'FOUND  ' : 'MISS   '} ${isCorr(hit?.sectionTitle) ? '[CORRESPONDENCE] ' : '[report/evidence] '}${JSON.stringify((hit?.sectionTitle ?? '(no title)').slice(0, 78))}`)
    console.log(`            asked: ${r.query}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
