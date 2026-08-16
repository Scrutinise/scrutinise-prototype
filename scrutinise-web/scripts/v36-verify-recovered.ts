/**
 * v36-verify-recovered.ts — retrieve a V36-RECOVERED document through the product's own
 * search path, not through a bespoke query against the index.
 *
 * The distinction matters: the index can hold a document that the product still cannot
 * return, because routing, tier scoping, `corpusToType` and the merge all sit between
 * the two. V36's whole claim is "these documents are now reachable by a user", and only
 * the gateway answers that.
 *
 * Targets are instruments V36 recovered — the Companies Act 2006 is the flagship: it was
 * rank 1 in the V37 citation audit (7,354 references), it was the row whose 5-minute
 * ROW_TIMEOUT threw it away on the first attempt, and before this run it was ABSENT.
 *
 * ⚠ Requires the production search configuration. Without FTS_SEARCH_URL the FTS leg
 * throws; without LEX_VECTOR_STREAMS dense retrieval is silently OFF; without
 * LEX_QUERY_ROUTER the router returns null and the gateway fail-opens. All three
 * degrade quietly and would make a healthy corpus look broken.
 *
 * Usage:
 *   LEX_QUERY_ROUTER=true FTS_SEARCH_URL=… LEX_VECTOR_STREAMS=legislation \
 *     npx tsx --env-file=.env --tsconfig tsconfig.json scripts/v36-verify-recovered.ts
 */
import { runSearch } from '../lib/lex/search-gateway'

type Target = { label: string; keywords: string[]; expectIdLike: RegExp }

const TARGETS: Target[] = [
  { label: 'Companies Act 2006 — directors\' duties', keywords: ['companies', 'act', '2006', 'directors', 'duties'], expectIdLike: /ukpga\/2006\/46/i },
  { label: 'Companies Act 2006 — general', keywords: ['Companies', 'Act', '2006'], expectIdLike: /ukpga\/2006\/46/i },
]

async function main() {
  for (const k of ['FTS_SEARCH_URL', 'VECTOR_SEARCH_URL', 'LEX_VECTOR_STREAMS', 'LEX_QUERY_ROUTER']) {
    console.log(`  env ${k.padEnd(20)} ${process.env[k] ? 'set' : 'UNSET ⚠'}`)
  }

  let pass = 0, fail = 0
  for (const t of TARGETS) {
    const res = await runSearch({ keywords: t.keywords, intent: 'legislation_lookup' as any, limit: 16 })
    const rows: any[] = (res as any).results ?? []
    const hitIdx = rows.findIndex((r) => t.expectIdLike.test(String(r.id ?? r.sectionId ?? r.url ?? r.citation ?? '')))
    const ok = hitIdx >= 0
    ok ? pass++ : fail++
    console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${t.label}`)
    console.log(`      returned ${rows.length} results; target ${ok ? `at rank ${hitIdx + 1}` : 'NOT FOUND'}`)
    for (const r of rows.slice(0, 5)) {
      console.log(`        ${String(r.title ?? r.sectionTitle ?? '(untitled)').slice(0, 78)}`)
      console.log(`          id=${String(r.id ?? r.sectionId ?? '')}`)
    }
  }
  console.log(`\n[verify] ${pass}/${pass + fail} targets retrieved through the product`)
  if (fail) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
