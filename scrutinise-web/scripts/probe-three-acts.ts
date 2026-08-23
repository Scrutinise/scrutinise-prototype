/**
 * probe-three-acts.ts — one question, three named Acts, answered from the LIVE retrieval path.
 *
 * WHY IT EXISTS. `docs/GOLD_CANDIDATES_V2.md` records the Vagrancy Act 1824, the Housing Act 1996
 * and the National Minimum Wage Act 1998 as ABSENT from the corpus. Two of the three are held in
 * full and the third is held under its REGNAL id (`ukpga/Geo4/5/83`, 5 Geo 4 c 83) — the exact
 * trap V36 §1 recorded for the Law of Property Act 1925. So the absence claim needs settling
 * against retrieval rather than against a `LIKE '%ukpga/1824/83%'`.
 *
 * ⚠ It calls `runSearch()` — the real gateway, not a copy — and refuses to report a number under a
 * degraded configuration (`harness-preflight.ts`). `served` deltas are read either side, because a
 * run that reached no service returns zeros that look exactly like an absence.
 *
 * Usage (from scrutinise-web):
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *   LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=legislation \
 *     npx tsx --env-file=.env scripts/probe-three-acts.ts
 */
import { runSearch, type SearchIntent } from '../lib/lex/search-gateway'
import { assertRetrievalConfig, resolvedConfigLine, readServiceConfig, servedDelta } from '../lib/lex/harness-preflight'

interface Probe {
  act: string
  /** The gid every hit for this Act carries, whichever section is returned. */
  gid: string
  question: string
  tier?: string
}

const PROBES: Probe[] = [
  { act: 'Vagrancy Act 1824', gid: 'ukpga/Geo4/5/83', question: 'is it illegal to sleep rough or beg in a public place' },
  { act: 'Vagrancy Act 1824', gid: 'ukpga/Geo4/5/83', question: 'Vagrancy Act 1824 rogue and vagabond wandering abroad begging', tier: 'legislation' },
  { act: 'Housing Act 1996', gid: 'ukpga/1996/52', question: 'what duty does a council owe someone who is homeless' },
  { act: 'Housing Act 1996', gid: 'ukpga/1996/52', question: 'Housing Act 1996 homelessness duty local housing authority', tier: 'legislation' },
  { act: 'National Minimum Wage Act 1998', gid: 'ukpga/1998/39', question: 'who is entitled to the national minimum wage and how is it enforced' },
  { act: 'National Minimum Wage Act 1998', gid: 'ukpga/1998/39', question: 'National Minimum Wage Act 1998 remuneration worker enforcement notice', tier: 'legislation' },
]

async function main() {
  assertRetrievalConfig('probe-three-acts')
  const before = await readServiceConfig()

  for (const p of PROBES) {
    const out = await runSearch({
      intent: 'LEGAL_LANDSCAPE' as SearchIntent,
      keywords: p.question.split(/\s+/),
      limit: 20,
      ...(p.tier ? { tier: p.tier } : {}),
    } as Parameters<typeof runSearch>[0])

    const ids = out.results.map((r) => r.id)
    const rank = ids.findIndex((id) => id.includes(p.gid))
    console.log(`\n── ${p.act}  ${p.tier ? `[tier=${p.tier}]` : '[untiered/routed]'}`)
    console.log(`   q: "${p.question}"`)
    console.log(`   returned ${ids.length}; streams=${out.meta.routedStreams?.join(',') ?? 'none'}; failed=${out.failed}`)
    console.log(`   ${p.gid} → ${rank >= 0 ? `RANK ${rank}  (${ids[rank]})` : 'NOT RETURNED'}`)
    console.log(`   top5: ${ids.slice(0, 5).join('\n         ')}`)
  }

  const after = await readServiceConfig()
  console.log(`\n${resolvedConfigLine()}`)
  console.log(servedDelta(before, after))
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
