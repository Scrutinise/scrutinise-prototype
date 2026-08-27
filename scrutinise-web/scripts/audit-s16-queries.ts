/**
 * audit-s16-queries.ts — S16 §4. WHAT DO WE ACTUALLY SEND TO THE INDEX?
 *
 * The Lex stream reported a real build issuing this, reading 231 sources and citing 0:
 *
 *     civil service public failure accountability responsibility cost deliver sector process
 *     accountable those system pr
 *
 * **A truncated term-frequency dump of the user's own prose. It contains "those" and ends
 * mid-word.** Nobody has ever printed what the VALIDATED questions travel as, so this does.
 *
 * ⚠ TWO DIFFERENT QUERY BUILDERS EXIST AND THIS SPRINT MUST NOT CONFUSE THEM.
 *   · The BUILD-side query (the one above) is written by the Lex stream. `BRIEF_25F.md` §4 owns
 *     it. **Not touched here — reported and handed on** (S16 §4's explicit instruction).
 *   · The GOLD-set query is the user's question, rewritten per stream by `routeQueryDetailed`.
 *     That is what search owns and what this prints.
 *
 * ⚠ THE ASSERTIONS ARE PROPERTIES OF A WRITTEN QUERY, and each states what it counted:
 *   · ends mid-token — the last token is a fragment of a longer word
 *   · stopword-bearing — a keyword dump keeps words a written query would not
 *   · duplicated terms — a term-frequency dump repeats; a written query does not
 *   · degenerate — identical for every stream, i.e. the router did not rewrite at all
 *
 * ⚠ ROUTES ARE READ FROM THE CACHE S15's RUN ALREADY PAID FOR (`scripts/gold/s14-routes.json`)
 * so this costs nothing and — more importantly — prints the STRINGS THAT WERE ACTUALLY ISSUED in
 * the measured run, not fresh ones from a second routing call that might differ.
 *
 * Usage:
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s16-queries.ts [--all]
 */
import fs from 'node:fs'
import path from 'node:path'

const AUTOPSY = path.join(__dirname, '../../docs/census/s16-autopsy.json')
const ROUTES = path.join(__dirname, 'gold/s14-routes.json')
const ALL = process.argv.includes('--all')

/**
 * ⚠⚠ TWO CLASSES OF FUNCTION WORD, AND CONFLATING THEM MAKES THE CHECK USELESS. THE SELF-TEST
 * PROVED THAT ON THIS FILE'S FIRST RUN.
 *
 * The first version of this counted "stopwords" and failed at 3 or more. Run against the real
 * defect — the query a live build issued — it **did not fire**, because that string contains
 * exactly ONE stopword ("those"). A threshold I had picked by feel could not catch the only
 * example I had. Meanwhile a threshold of 1 would have flagged every GOOD query, because
 * "duty to investigate deaths in custody" legitimately contains "to" and "in".
 *
 * So the discriminator is not the COUNT, it is WHICH:
 *
 *   GRAMMATICAL — of, to, in, for, and, the… These appear in a written noun phrase doing real
 *                 work, and carry retrieval signal in a phrase query. Never a defect.
 *   ORPHAN      — those, these, them, they, their, there, such, some… A query WRITER never emits
 *                 these: they refer to something outside the query and match nothing. Their
 *                 presence means the string was EXTRACTED from prose, not written for an index.
 *
 * One orphan is enough, because one is what the real defect had.
 */
const ORPHAN = new Set(['those', 'these', 'they', 'them', 'their', 'theirs', 'there', 'this',
  'that', 'such', 'some', 'any', 'it', 'its', 'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our',
  'you', 'your', 'other', 'others', 'same', 'own', 'both', 'each', 'either', 'neither'])

/** A last token that looks like a truncation: short, and not a plausible whole word. */
function endsMidToken(q: string): boolean {
  const toks = q.trim().split(/\s+/)
  const last = toks[toks.length - 1] ?? ''
  if (last.length === 0 || last.length > 3) return false
  // 1–3 characters that are not a real short word. `pr`, `sy`, `ac` are fragments; `tax`, `vat`,
  // `eu`, `ai`, `mp` are not.
  const REAL_SHORT = new Set(['tax', 'vat', 'eu', 'ai', 'mp', 'nhs', 'uk', 'act', 'law', 'pay',
    'gp', 'cps', 'hmo', 'car', 'gas', 'net', 'aid', 'sen', 'ni', 'us', 'un', 'war', 'job', 'age'])
  return !REAL_SHORT.has(last.toLowerCase())
}

interface Finding { id: string; stream: string; query: string; flags: string[] }

function inspect(q: string): string[] {
  const flags: string[] = []
  const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (endsMidToken(q)) flags.push('ENDS-MID-TOKEN')
  const orphans = toks.filter((t) => ORPHAN.has(t))
  if (orphans.length) flags.push(`ORPHAN-REFERENT(${[...new Set(orphans)].join(',')})`)
  const seen = new Set<string>()
  const dupes = toks.filter((t) => t.length > 3 && (seen.has(t) || (seen.add(t), false)))
  if (dupes.length) flags.push(`DUPLICATED(${[...new Set(dupes)].slice(0, 4).join(',')})`)
  if (toks.length > 24) flags.push(`LONG(${toks.length} tokens)`)
  if (!toks.length) flags.push('EMPTY')
  return flags
}

/**
 * ⚠ THE SELF-TEST USES THE REAL BAD STRING, NOT AN INVENTED ONE.
 *
 * This is the query a real Lex build issued, quoted in BRIEF_SEARCH_S16 §4 — it read 231 sources
 * and cited none. If the assertions below cannot catch THIS, they cannot catch anything, and a
 * clean run over the gold set would mean nothing. Watched failing before it is watched passing.
 */
const REAL_BAD_QUERY =
  'civil service public failure accountability responsibility cost deliver sector process accountable those system pr'

function selfTest(): boolean {
  const flags = inspect(REAL_BAD_QUERY)
  console.log('⚠ SELF-TEST — the query a real build actually issued (S16 §4):')
  console.log(`   ${JSON.stringify(REAL_BAD_QUERY)}`)
  console.log(`   flags: ${flags.join(' · ') || '(none)'}`)
  const caughtMidToken = flags.some((f) => f.startsWith('ENDS-MID-TOKEN'))
  const caughtOrphan = flags.some((f) => f.startsWith('ORPHAN-REFERENT'))
  // ⚠ BOTH must fire. Catching only one would mean the other assertion is decorative, and a
  // future dump that happened to end on a whole word would sail through.
  if (caughtMidToken && caughtOrphan) {
    console.log('   ✅ SELF-TEST PASSED — both ENDS-MID-TOKEN and ORPHAN-REFERENT fired.\n')
    return true
  }
  console.log(`   ❌ SELF-TEST FAILED — midToken=${caughtMidToken} orphan=${caughtOrphan}.`)
  console.log('      These assertions cannot catch the defect they exist for. Do not trust a clean run.\n')
  return false
}

async function main() {
  if (process.argv.includes('--self-test')) { process.exit(selfTest() ? 0 : 1) }
  const CHECK = process.argv.includes('--check')
  const autopsy = JSON.parse(fs.readFileSync(AUTOPSY, 'utf8'))
  if (!fs.existsSync(ROUTES)) {
    console.error(`⛔ no cached routes at ${ROUTES} — run the gold measurement first.`)
    process.exit(2)
  }
  const routes = JSON.parse(fs.readFileSync(ROUTES, 'utf8'))

  console.log('── S16 §4 — THE QUERY STRINGS ACTUALLY ISSUED ──')
  console.log(`  routes   ${path.basename(ROUTES)} (the cache S15's measured run used)`)
  console.log(`  autopsy  ${path.basename(AUTOPSY)} — ${autopsy.failing} failing questions\n`)

  // The failing questions, worst class first — NOT-MATCHED is where a query defect would live.
  const wanted = (autopsy.rows as any[]).filter((r) => ALL || r.cls === 'NOT-MATCHED')
  const show = ALL ? wanted : wanted.slice(0, 10)
  console.log(`  Showing ${show.length} of ${wanted.length}${ALL ? '' : ' NOT-MATCHED questions (§4 asks for ten)'}\n`)

  const findings: Finding[] = []
  for (const r of show) {
    const entry = routes[r.id] ?? routes[`${r.id}`]
    const route = entry?.plain
    console.log(`  ${r.id}  [${r.collection}]  ${r.cls}`)
    console.log(`    user asked: ${r.question}`)
    if (!route || typeof route !== 'object') { console.log('    ⚠ no cached route for this id\n'); continue }
    for (const [stream, q] of Object.entries(route)) {
      if (typeof q !== 'string') continue
      const flags = inspect(q)
      findings.push({ id: r.id, stream, query: q, flags })
      console.log(`    → ${stream.padEnd(12)} ${JSON.stringify(q)}`)
      if (flags.length) console.log(`      ${'⚠'.padEnd(6)} ${flags.join(' · ')}`)
    }
    console.log('')
  }

  // ── the aggregate, over every routed stream of every failing question ──
  const allF: Finding[] = []
  for (const r of wanted) {
    const entry = routes[r.id]
    const route = entry?.plain
    if (!route || typeof route !== 'object') continue
    for (const [stream, q] of Object.entries(route)) {
      if (typeof q === 'string') allF.push({ id: r.id, stream, query: q, flags: inspect(q) })
    }
  }
  console.log('  ── PROPERTIES OF THE ISSUED QUERIES (every figure is a COUNT) ──')
  console.log(`  queries inspected           ${allF.length}`)
  for (const name of ['ENDS-MID-TOKEN', 'ORPHAN-REFERENT', 'DUPLICATED', 'LONG', 'EMPTY']) {
    const n = allF.filter((f) => f.flags.some((x) => x.startsWith(name))).length
    console.log(`  ${name.padEnd(27)} ${String(n).padStart(3)}${n ? '  ⚠' : ''}`)
  }
  const lens = allF.map((f) => f.query.trim().split(/\s+/).length).sort((a, b) => a - b)
  if (lens.length) {
    console.log(`  tokens per query            min ${lens[0]} · median ${lens[Math.floor(lens.length / 2)]} · max ${lens[lens.length - 1]}`)
  }
  // ⚠ Degenerate routing: the same string sent to every stream means the router did not rewrite.
  let degenerate = 0
  for (const r of wanted) {
    const entry = routes[r.id]
    const route = entry?.plain
    if (!route || typeof route !== 'object') continue
    const qs = Object.values(route).filter((v) => typeof v === 'string') as string[]
    if (qs.length > 1 && new Set(qs).size === 1) degenerate++
  }
  console.log(`  questions where EVERY stream got the SAME string   ${degenerate} of ${wanted.length}`)

  if (CHECK) {
    // ⚠ The check runs its own self-test FIRST. A guard that has not been shown to fire is not a
    // guard, and a clean sweep is exactly the shape that hides a broken assertion.
    console.log('')
    if (!selfTest()) process.exit(1)
    // DUPLICATED alone is not a failure — a written query may legitimately repeat a term
    // ("Phase 1 Phase 2"). The failing properties are the ones that mean EXTRACTED rather than
    // WRITTEN: a truncation, a stopword dump, or nothing at all.
    const bad = allF.filter((f) => f.flags.some((x) =>
      x.startsWith('ENDS-MID-TOKEN') || x.startsWith("ORPHAN-REFERENT") || x.startsWith('EMPTY')))
    if (bad.length) {
      console.log(`  ❌ ${bad.length} of ${allF.length} issued queries look EXTRACTED rather than WRITTEN:`)
      for (const f of bad.slice(0, 10)) console.log(`     ${f.id} ${f.stream}: ${JSON.stringify(f.query)} — ${f.flags.join(' · ')}`)
      process.exit(1)
    }
    console.log(`  ✅ ${allF.length} of ${allF.length} issued queries are written, not extracted.`)
  }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
