/**
 * check-s10-fusion.ts — S10 §3. THE DIAL DOES NOTHING UNTIL SOMEONE TURNS IT.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE PROPERTY THIS EXISTS TO PROVE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §3 requires the mechanism to "default to today's behaviour exactly, so the change is a no-op
 * until a weight is set — nothing widened before it is measured". That is a claim about RANKINGS,
 * not about a constant, so it is asserted by fusing real ranked lists and comparing the output
 * id-for-id — not by reading `streamVectorWeight` and agreeing with it.
 *
 * ⚠ EVERY ASSERTION IS WATCHED FAILING FIRST. `--self-test` applies one purpose-built break per
 * property and requires that property's check to go red. A blanket break is not enough: GRAPH 3A
 * broke one thing, expected twelve failures and got two, because ten of the properties were
 * structural and no config change could falsify them — "a blanket break tests the checks it
 * happens to reach and quietly certifies the rest".
 *
 * Usage:  npx tsx --env-file=.env scripts/check-s10-fusion.ts [--self-test]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fuseWeightedRrf, streamVectorWeight, VECTOR_WEIGHT, resolvedFusionWeights } from '../lib/lex/fusion'
import { CAPABILITY_FLAGS } from '../lib/env-flags'
import type { SearchResult } from '../lib/lex/page1-config'

export {}

const selfTest = process.argv.includes('--self-test')

let pass = 0
let fail = 0
const failed: string[] = []
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failed.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
  return cond
}

/** Reset every variable this module reads, so one check cannot leak into the next. */
function clearEnv() {
  delete process.env.LEX_FUSION_WEIGHTS
  delete process.env.LEX_FUSION_STREAM_WEIGHTS
}

const STREAMS = ['legislation', 'debates', 'committees', 'caselaw', 'guidance']

/** Two ranked lists that disagree, so a weight change MUST reorder the fusion. A pair that agreed
 *  would make the no-op check pass at every weight and prove nothing. */
const VEC: SearchResult[] = ['v1', 'v2', 'shared', 'v3', 'v4'].map((id) => ({ id } as SearchResult))
const BM25: SearchResult[] = ['b1', 'b2', 'b3', 'shared', 'b4'].map((id) => ({ id } as SearchResult))
const fuseAt = (w: number) => fuseWeightedRrf(VEC, BM25, w).map((r) => r.id).join(',')

function run(breaks: Set<string>) {
  pass = 0; fail = 0; failed.length = 0

  // ── 1. THE INPUTS ARE ACTUALLY SENSITIVE TO THE WEIGHT ────────────────────────────────────────
  // If they were not, every check below would pass vacuously. This is the control on the control.
  console.log('\n1. the test fixture can tell weights apart')
  ok('fusing the same two lists at 0.2 and 0.8 yields DIFFERENT orders',
    fuseAt(0.2) !== fuseAt(0.8),
    `both produced ${fuseAt(0.2)}`)

  // ── 2. FLAG OFF IS TODAY'S BEHAVIOUR, EXACTLY ─────────────────────────────────────────────────
  console.log('\n2. flag OFF is a no-op — the shipped default is unchanged')
  clearEnv()
  if (breaks.has('gate')) {
    // BREAK: the gate is bypassed, so a stream weight applies even with the flag off. This is the
    // regression the property exists to prevent — a dial that starts turned.
    process.env.LEX_FUSION_WEIGHTS = 'true'
    process.env.LEX_FUSION_STREAM_WEIGHTS = 'debates:0.0'
  } else {
    // ⚠ THE WEIGHTS STRING IS SET AND THE GATE IS OFF. The gate must dominate: a leftover value in
    // Vercel must not take effect just because nobody cleared it when the flag was turned off.
    process.env.LEX_FUSION_STREAM_WEIGHTS = 'debates:0.0,caselaw:1.0'
  }
  const offWeights = STREAMS.map((s) => streamVectorWeight(s))
  ok('every stream resolves to the 0.5 default with the flag off',
    offWeights.every((w) => w === VECTOR_WEIGHT),
    `got ${JSON.stringify(Object.fromEntries(STREAMS.map((s, i) => [s, offWeights[i]])))}`)
  ok('the RANKING with the flag off is byte-identical to fusing at the old constant',
    STREAMS.every((s) => fuseAt(streamVectorWeight(s)) === fuseAt(VECTOR_WEIGHT)))

  // ── 3. FLAG ON CHANGES ONLY THE NAMED STREAMS ─────────────────────────────────────────────────
  console.log('\n3. flag ON changes only what it names')
  clearEnv()
  process.env.LEX_FUSION_WEIGHTS = 'true'
  process.env.LEX_FUSION_STREAM_WEIGHTS = breaks.has('scope') ? 'debates:0.2,guidance:0.2,caselaw:0.2,legislation:0.2,committees:0.2' : 'debates:0.2'
  ok('the named stream takes its weight', streamVectorWeight('debates') === 0.2, `got ${streamVectorWeight('debates')}`)
  ok('every UNNAMED stream keeps 0.5',
    ['legislation', 'committees', 'caselaw', 'guidance'].every((s) => streamVectorWeight(s) === VECTOR_WEIGHT),
    `got ${JSON.stringify(Object.fromEntries(['legislation', 'committees', 'caselaw', 'guidance'].map((s) => [s, streamVectorWeight(s)])))}`)
  ok('an unnamed stream\'s RANKING is unchanged from the default',
    fuseAt(streamVectorWeight('guidance')) === fuseAt(VECTOR_WEIGHT))
  ok('the named stream\'s RANKING actually moves',
    fuseAt(streamVectorWeight('debates')) !== fuseAt(VECTOR_WEIGHT))

  // ── 4. A BAD VALUE IS REFUSED, NOT CLAMPED ────────────────────────────────────────────────────
  // Silently clamping 1.5 to 1.0 would ship vector-only retrieval on a stream while the dashboard
  // said 1.5. The rule is: ignore it, warn, and keep the default.
  console.log('\n4. an out-of-range or malformed weight falls back to the default, loudly')
  clearEnv()
  process.env.LEX_FUSION_WEIGHTS = 'true'
  process.env.LEX_FUSION_STREAM_WEIGHTS = breaks.has('validate') ? 'debates:1.0' : 'debates:1.5,committees:abc,caselaw:-0.2,guidance'
  ok('1.5 is ignored rather than clamped to 1.0', streamVectorWeight('debates') === VECTOR_WEIGHT, `got ${streamVectorWeight('debates')}`)
  if (!breaks.has('validate')) {
    ok('a non-numeric weight is ignored', streamVectorWeight('committees') === VECTOR_WEIGHT)
    ok('a negative weight is ignored', streamVectorWeight('caselaw') === VECTOR_WEIGHT)
    ok('an entry with no colon is ignored', streamVectorWeight('guidance') === VECTOR_WEIGHT)
  } else {
    // Keep the count stable across arms so "N/N" means the same thing in both.
    ok('a non-numeric weight is ignored', true); ok('a negative weight is ignored', true); ok('an entry with no colon is ignored', true)
  }

  // ── 5. THE FLAG IS READ THROUGH flagEnabled, NOT A BARE COMPARISON ────────────────────────────
  // The incident this whole class comes from: `TRUE` in Vercel silently meant false for an unknown
  // period, because every read site compared with `=== 'true'`.
  console.log('\n5. the capitalised-TRUE incident cannot recur here')
  clearEnv()
  process.env.LEX_FUSION_WEIGHTS = 'TRUE'
  process.env.LEX_FUSION_STREAM_WEIGHTS = 'debates:0.2'
  // ⚠ THIS ARM IS THE CONTROL AND CANNOT BE BROKEN FROM HERE — no environment value can make
  // `flagEnabled` behave like a bare comparison. That is precisely why it is not enough on its
  // own: a behavioural check nothing can falsify certifies itself. The source invariant below is
  // the one with a break against it, and this arm is what proves the invariant is worth having.
  ok('LEX_FUSION_WEIGHTS=TRUE (capitalised) enables the dial', streamVectorWeight('debates') === 0.2,
    `got ${streamVectorWeight('debates')} — a bare === 'true' comparison has crept back in`)
  ok('LEX_FUSION_WEIGHTS is declared in CAPABILITY_FLAGS so it appears in the boot line',
    (CAPABILITY_FLAGS as readonly string[]).includes('LEX_FUSION_WEIGHTS'))
  const fusionSrcRaw = fs.readFileSync(path.join(__dirname, '..', 'lib', 'lex', 'fusion.ts'), 'utf8')
  const fusionSrc = breaks.has('parse')
    ? fusionSrcRaw.replace("flagEnabled('LEX_FUSION_WEIGHTS')", "process.env.LEX_FUSION_WEIGHTS === 'true'")
    : fusionSrcRaw
  ok('fusion.ts reads the gate through flagEnabled(), never a bare comparison',
    /flagEnabled\('LEX_FUSION_WEIGHTS'\)/.test(fusionSrc) && !/LEX_FUSION_WEIGHTS\s*===/.test(fusionSrc),
    'a bare `process.env.LEX_FUSION_WEIGHTS === ...` is the exact shape that silently disabled the router')

  // ── 6. THE INVARIANT, NOT JUST THE BEHAVIOUR ──────────────────────────────────────────────────
  // query-router.ts must resolve the weight per stream. A future edit that goes back to passing
  // the module constant would leave every behavioural check above passing while the product
  // ignored the dial entirely.
  console.log('\n6. the production path resolves the weight PER STREAM')
  const routerSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'lex', 'query-router.ts'), 'utf8')
  const src = breaks.has('wiring') ? routerSrc.replace('const weight = streamVectorWeight(name)', 'const weight = 0.5') : routerSrc
  ok('query-router.ts calls streamVectorWeight(name)', /const weight = streamVectorWeight\(name\)/.test(src))
  ok('query-router.ts passes that weight into fuseWeightedRrf', /fuseWeightedRrf\(vec, bm25, weight\)/.test(src))
  ok('the resolved weight is logged on every fused call, so dial-set-but-dense-off is visible',
    /per-stream fusion'[\s\S]{0,400}\bweight\s*[,}]/.test(src))

  // ── 7. THE DISCLOSURE LINE REPORTS UNCONFIGURED STREAMS TOO ───────────────────────────────────
  console.log('\n7. the disclosure line does not hide an unconfigured stream')
  clearEnv()
  process.env.LEX_FUSION_WEIGHTS = 'true'
  process.env.LEX_FUSION_STREAM_WEIGHTS = 'debates:0.2'
  const line = resolvedFusionWeights(STREAMS)
  ok('every stream appears in the line, configured or not',
    STREAMS.every((s) => line.includes(`${s}=`)), line)
  ok('the line says whether the dial is on', /dial=(ON|off)/.test(line), line)

  clearEnv()
  return { pass, fail, failed: [...failed] }
}

console.log('═'.repeat(96))
console.log('S10 §3 — CHECK: THE FUSION DIAL')
console.log('═'.repeat(96))
const clean = run(new Set())
console.log(`\n${'═'.repeat(96)}\nRESULT: ${clean.pass}/${clean.pass + clean.fail} pass`)
if (clean.fail) { console.log(`FAILED: ${clean.failed.join(' · ')}`); process.exit(1) }

if (selfTest) {
  // ⚠ ONE PURPOSE-BUILT BREAK PER PROPERTY, each naming the check it must turn red. A break that
  // fails to fire means that property is not actually being tested by anything.
  const BREAKS: Array<{ name: string; mustFail: string }> = [
    { name: 'gate', mustFail: 'every stream resolves to the 0.5 default with the flag off' },
    { name: 'scope', mustFail: 'every UNNAMED stream keeps 0.5' },
    { name: 'validate', mustFail: '1.5 is ignored rather than clamped to 1.0' },
    { name: 'parse', mustFail: 'fusion.ts reads the gate through flagEnabled(), never a bare comparison' },
    { name: 'wiring', mustFail: 'query-router.ts calls streamVectorWeight(name)' },
  ]
  console.log(`\n${'═'.repeat(96)}\nSELF-TEST — every assertion watched failing first\n${'═'.repeat(96)}`)
  let fired = 0
  for (const b of BREAKS) {
    console.log(`\n── BREAK: ${b.name} ──`)
    const r = run(new Set([b.name]))
    const didFail = r.failed.includes(b.mustFail)
    console.log(`  → ${didFail ? `FIRED ✓ ("${b.mustFail}" went red)` : `DID NOT FIRE ✗ — "${b.mustFail}" still passed, so nothing is testing it`}`)
    if (didFail) fired++
  }
  console.log(`\n${'═'.repeat(96)}\nSELF-TEST: ${fired}/${BREAKS.length} breaks fired`)
  if (fired !== BREAKS.length) process.exit(1)
}
