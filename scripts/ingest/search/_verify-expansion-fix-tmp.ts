/**
 * _verify-expansion-fix-tmp.ts — THROWAWAY. Confirm the thinkingBudget:0 fix works in
 * the REAL lib/lex/query-expansion.ts (not the standalone debug re-implementation).
 * Same require pattern score-fts.ts already uses to load this web-side module.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

type Expansion = { anchors: string[]; termsOfArt: string[]; rephrasings: string[] }
const { expandQuery } = require(path.join(__dirname, '../../../scrutinise-web/lib/lex/query-expansion')) as {
  expandQuery: (keywords: string[], ideaContext: string) => Promise<Expansion>
}

async function main() {
  console.log('LEX_QUERY_EXPANSION:', process.env.LEX_QUERY_EXPANSION)
  const result = await expandQuery(['I want to stop people renting out whole houses as Airbnbs all year round'], '')
  console.log('anchors:', result.anchors)
  console.log('termsOfArt:', result.termsOfArt)
  console.log('rephrasings:', result.rephrasings)
  const ok = result.anchors.length > 0 || result.termsOfArt.length > 0 || result.rephrasings.length > 0
  console.log(ok ? 'PASS — expansion returned real terms' : 'FAIL — still empty')
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
