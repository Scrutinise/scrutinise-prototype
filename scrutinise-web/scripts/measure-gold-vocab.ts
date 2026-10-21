/**
 * measure-gold-vocab.ts - SEARCH-29 stage 2 input. The 65 gold questions do not carry orientation vocabulary, so stage 1 is run on EACH QUESTION'S
 * TEXT (noise filter on, web + X) and its terms are what stage 2 hands the router. SAID IN EVERY REPORT: the vocabulary here is generated from the
 * question, not from a real idea's full input, so it is the weakest fair test of stage 2, not the strongest.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-gold-vocab.ts [--concurrency 4] [--only <id,id>]
 *
 * Writes docs/census/s29-gold-terms.json  ({ "<question id>": ["term", …] } — what measure-s19-grain.ts --terms reads) and
 * docs/census/s29-gold-vocab-detail.json (everything, with cost and time). RESUMABLE: a question already in the detail file is skipped, so a
 * restarted job does not pay twice. Spend is labelled `measurement`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { enterPurpose } from '../lib/lex/build-context'
import { runOrientationV2, termsForSearch } from '../lib/lex/orientation/v2'
import { ALL_GOLD_QUESTIONS } from './gold/all-questions'

enterPurpose('measurement')

const argv = process.argv.slice(2)
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const CONC = Math.max(1, parseInt(arg('concurrency') ?? '4', 10))
const ONLY = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const DIR = path.join(__dirname, '../../docs/census')
const TERMS = path.join(DIR, 's29-gold-terms.json')
const DETAIL = path.join(DIR, 's29-gold-vocab-detail.json')

type Detail = { terms: string[]; vocabulary: unknown; arguments: number; dropped: number; costUsd: number; ms: number; failed: boolean; web: boolean; x: boolean }

async function main() {
  fs.mkdirSync(DIR, { recursive: true })
  const have: Record<string, Detail> = fs.existsSync(DETAIL) ? JSON.parse(fs.readFileSync(DETAIL, 'utf8')).byId ?? {} : {}
  const todo = ALL_GOLD_QUESTIONS.filter((q) => (!ONLY.length || ONLY.includes(q.id)) && !have[q.id])
  console.log(`gold questions ${ALL_GOLD_QUESTIONS.length}; already done ${Object.keys(have).length}; to run ${todo.length}; concurrency ${CONC}`)
  const save = () => {
    fs.writeFileSync(DETAIL, JSON.stringify({ takenAt: new Date().toISOString(), note: 'stage 1 run on each question text, noise filter ON, web + X; NOT a real idea\'s full input', byId: have }, null, 1))
    fs.writeFileSync(TERMS, JSON.stringify(Object.fromEntries(Object.entries(have).map(([id, d]) => [id, d.terms])), null, 1))
  }
  let next = 0, done = 0
  async function worker() {
    while (next < todo.length) {
      const q = todo[next++]
      const t0 = Date.now()
      const o = await runOrientationV2({ input: q.question, noiseFilter: true })
      const web = o.calls.find((c) => c.call === 'v2-web')?.ok ?? false, x = o.calls.find((c) => c.call === 'v2-x')?.ok ?? false
      have[q.id] = { terms: termsForSearch(o), vocabulary: o.vocabulary, arguments: o.arguments.length, dropped: o.dropped.length, costUsd: o.totalCostUsd, ms: Date.now() - t0, failed: o.failed, web, x }
      done++
      console.log(`  [${done}/${todo.length}] ${q.id.padEnd(9)} terms ${String(have[q.id].terms.length).padStart(2)}  args ${String(o.arguments.length).padStart(2)}  $${o.totalCostUsd.toFixed(3)}  ${Math.round((Date.now() - t0) / 1000)}s  ${o.failed ? '⚠ FAILED' : (web && x ? '' : `⚠ web=${web} x=${x}`)}  ${q.question.slice(0, 50)}`)
      if (done % 5 === 0) save()
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker))
  save()
  const all = Object.values(have)
  const sum = all.reduce((a, d) => a + d.costUsd, 0)
  console.log(`\nDONE ${all.length} questions. failed ${all.filter((d) => d.failed).length}; web failed ${all.filter((d) => !d.web).length}; x failed ${all.filter((d) => !d.x).length}; no terms ${all.filter((d) => !d.terms.length).length}`)
  console.log(`cost $${sum.toFixed(2)} total, $${(sum / (all.length || 1)).toFixed(3)} per question; median ${[...all.map((d) => d.ms)].sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? 0}ms`)
  console.log(`-> ${TERMS}\n-> ${DETAIL}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
