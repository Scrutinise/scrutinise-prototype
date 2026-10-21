// SEARCH-28 - no script that can spend on a Search pass may run without a ledger purpose.
//   npx tsx scripts/check-search-purpose.ts   (npm run check:search-purpose)
// A script's purpose is inferred from its NAME (check|verify|audit- = check; measure|probe|sweep|benchmark- = measurement, lib/lex/build-context.ts
// purposeFromScriptName) or stated with enterPurpose(). A script that imports a model-spending Search module and has neither writes ledger rows with
// no user and no purpose - the £11.53 of £32.16 that read as unattributed on 29 Sep. This is a property of SOURCE, so it is a source check (§25).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { purposeFromScriptName } from '../lib/lex/build-context'

const SPENDS = /from ['"][^'"]*(search-gateway|query-router|reranker|rerank|search-stub|general-chat|stage-search|gateway-legacy|query-expansion|web-search|orientation)['"]|\b(runSearch|routeQuery)\(/
const dir = __dirname
const skip = (n: string) => n.startsWith('_') || !n.endsWith('.ts')
const bare: string[] = []
let scanned = 0, spenders = 0
for (const n of readdirSync(dir)) {
  if (skip(n)) continue
  scanned++
  const src = readFileSync(join(dir, n), 'utf8')
  if (!SPENDS.test(src)) continue
  spenders++
  const named = purposeFromScriptName(join('scripts', n), undefined) !== null
  const stated = /\benterPurpose\(/.test(src)
  if (!named && !stated) bare.push(n)
}
console.log(`scanned ${scanned} scripts · ${spenders} import a spending Search module · ${bare.length} with no purpose`)
for (const b of bare) console.log(`  ✗ ${b}`)
// control: a script with a spending import and a neutral name MUST be flagged by the same rule
const ctl = SPENDS.test("import { runSearch } from '../lib/lex/search-gateway'") && purposeFromScriptName('scripts/gold-lookup.ts', undefined) === null
console.log(ctl ? '  · control fired — a spending script with a neutral name is flagged by this rule' : '  ✗ DEAD CONTROL')
process.exit(bare.length || !ctl ? 1 : 0)
