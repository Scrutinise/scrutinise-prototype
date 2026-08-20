// ─────────────────────────────────────────────────────────────────────────────
// check:build-25a — the Sprint 25-A guards.
//
// ⚠ EVERY ASSERTION IN HERE THAT CAN HAVE A NEGATIVE CONTROL HAS ONE, and
// `--self-test` runs them. The house rule this exists to satisfy: a guard that cannot
// fail is not a guard. Each check carries a `break` — a deliberately corrupted copy of
// the source — and `--self-test` exits 0 only if every such check REJECTS it. Checks
// whose assertion runs against imported code cannot be corrupted in-process; those are
// REPORTED AS HAVING NO CONTROL rather than counted as passing, because an untestable
// control quietly counted as a pass is the exact thing this file exists to prevent.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:build-25a
//   npm run check:build-25a -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  frameQuery, effectiveBudgetMs, trimForkAlternatives, ALTERNATIVES_PER_FORK,
  BUILD_PASSES, DEFAULT_FRAMING, isFraming, HARD_STOP_MS, REQUEST_BUDGET_MS,
} from '../lib/lex/build-config'
import { priceBuild, formatSpend } from '../lib/lex/build-cost'
import { briefingBody } from '../lib/lex/build-briefing'
import { ALL_FIELDS, PAGE_SEQUENCE } from '../lib/lex/page1-config'
import { ELICITATION_STEPS, CREDIBILITY_NOTE, OPENING_ASK } from '../lib/lex/elicitation-config'
import { looksLikeASolution, MAX_PROBLEM_PRESSES } from '../lib/lex/method'
import { llmFailed, llmOk, type LlmResult } from '../lib/lex/build-llm'
import { stripNullBytes, countNullBytes } from '../lib/lex/json-safe'
import { thinkingConfigFor } from '../lib/lex/model-thinking'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

type Sources = Record<string, string>

interface Check {
  name: string
  /** The real assertion. Returns an error string, or null when it holds. */
  run: (src: Sources) => string | null
  /** The negative control: a corrupted source bag `run` MUST reject. Omit when the
   *  assertion runs against imported code and cannot be corrupted from here. */
  break?: (src: Sources) => Sources
}

const FILES = [
  'lib/lex/build.ts',
  'lib/lex/build-config.ts',
  'lib/lex/build-cost.ts',
  'lib/lex/build-client.ts',
  'lib/lex/build-llm.ts',
  'lib/lex/build-settle.ts',
  'lib/lex/build-briefing.ts',
  'lib/lex/json-safe.ts',
  'lib/lex/stage-search.ts',
  'lib/lex/transcript.ts',
  'lib/lex/field-machine.ts',
  'lib/lex/elicitation.ts',
  'lib/lex/elicitation-client.ts',
  'lib/lex/elicitation-config.ts',
  // Read, never written by this sprint — the source half of the "25-A adds a path, it
  // does not remove one" assertions has to look at the files it promises not to change.
  'lib/lex/page1-config.ts',
  'lib/lex/method.ts',
  'app/api/ideas/[id]/build/route.ts',
  'app/api/ideas/[id]/build/cancel/route.ts',
  'app/api/ideas/[id]/elicitation/route.ts',
  'app/ideas/build/BuildIdeaClient.tsx',
  'components/lex/BuildProgress.tsx',
  'prisma/lex_build_25a.sql',
] as const

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/** A fixture with unmistakable markers, so a leak between the two framing arms is
 *  detectable rather than a judgement call about prose. */
const CTX = {
  problem: 'Bin collections in my ward were cut to fortnightly and the side streets are now full of fly-tipping.',
  goalKind: 'APPLICATION_CHANGE',
  goalKindLabel: 'A change in how a rule is applied',
  goalDetail: 'I want the council held to the collection standard it publishes.',
  ruledOut: 'UNIQUERULEDOUTMARKER a new national Act',
  ownKnowledge: 'UNIQUETESTIMONYMARKER the depot supervisor told me two rounds were merged without notice.',
  aboutYou: 'UNIQUEPROFILEMARKER I chair the residents association.',
  reading: { url: null, fileName: null, read: false as const },
}

const CHECKS: Check[] = [
  // ── §0 — 25-A ADDS A PATH, IT DOES NOT REMOVE ONE ──────────────────────────
  {
    name: '§0 the existing kernel pages are untouched (4 pages, all 23 field keys present)',
    run: (s) => {
      const pages = PAGE_SEQUENCE.map((p) => p.key).join(',')
      if (pages !== 'ORIENTATION,DIAGNOSIS,GUIDING_POLICY,COHERENT_ACTIONS') {
        return `PAGE_SEQUENCE changed: ${pages}`
      }
      const required = [
        'ideaNarrative', 'youAndIdeaNarrative', 'aboutYou', 'title', 'keywords',
        'challenge', 'whoAffectedImpactCost', 'causes', 'rootCause', 'legalLandscape',
        'pivotalObstacle', 'summaryDiagnosis', 'policyOptions', 'chosenApproach',
        'whatItRulesOut', 'leverage', 'anticipatedResponses', 'conditionsForSuccess',
        'summaryGuidingPolicy', 'actions', 'coherenceCheck', 'costSummary', 'summaryCoherentActions',
      ]
      const have = new Set(ALL_FIELDS.map((f) => f.key))
      const missing = required.filter((k) => !have.has(k))
      if (missing.length) return `field(s) removed from the existing kernel: ${missing.join(', ')}`
      // Source half, so this assertion has something it can be watched failing on.
      return /export const PAGE_SEQUENCE: PageDef\[\] = \[\s*ORIENTATION_PAGE,\s*DIAGNOSIS_PAGE,\s*GUIDING_POLICY_PAGE,\s*COHERENT_ACTIONS_PAGE,\s*\]/.test(s['lib/lex/page1-config.ts'])
        ? null
        : 'PAGE_SEQUENCE in page1-config.ts is no longer exactly the four existing kernel pages'
    },
    break: (s) => ({ ...s, 'lib/lex/page1-config.ts': s['lib/lex/page1-config.ts'].replace('COHERENT_ACTIONS_PAGE,', 'COHERENT_ACTIONS_PAGE, ELICITATION_PAGE,') }),
  },
  {
    name: '§0 no elicitation step key collides with an existing field key',
    run: (s) => {
      const fields = new Set(ALL_FIELDS.map((f) => f.key))
      const clash = ELICITATION_STEPS.map((x) => x.key).filter((k) => fields.has(k))
      if (clash.length) return `elicitation step keys collide with field keys: ${clash.join(', ')}`
      // Source half. The keys are also read straight out of the config, so a collision
      // introduced by hand is caught even if the import were somehow stale.
      const declared = [...s['lib/lex/elicitation-config.ts'].matchAll(/^\s{4}key: '([a-zA-Z]+)',$/gm)].map((m) => m[1])
      if (!declared.length) return 'no step keys could be read out of elicitation-config.ts'
      const clash2 = declared.filter((k) => fields.has(k))
      return clash2.length ? `declared step key(s) collide with field keys: ${clash2.join(', ')}` : null
    },
    break: (s) => ({ ...s, 'lib/lex/elicitation-config.ts': s['lib/lex/elicitation-config.ts'].replace("    key: 'problem',", "    key: 'challenge',") }),
  },
  {
    name: '§0 the 25-A schema is additive only — no ALTER/DROP of an existing table',
    run: (s) => {
      const sql = s['prisma/lex_build_25a.sql']
      const forbidden = [...sql.matchAll(/^(ALTER TABLE|DROP\s+\w+)\s+"?(\w+)"?/gim)]
        .filter((m) => !['IdeaElicitation', 'IdeaBuild', 'BuildFork'].includes(m[2]))
      return forbidden.length
        ? `the 25-A schema touches an existing object: ${forbidden.map((m) => m[0]).join(', ')}`
        : null
    },
    break: (s) => ({ ...s, 'prisma/lex_build_25a.sql': s['prisma/lex_build_25a.sql'] + '\nALTER TABLE "Idea" DROP COLUMN "challenge";\n' }),
  },

  // ── §1 — the four exchanges ────────────────────────────────────────────────
  {
    name: '§1b the opening ask is Charlie’s wording, verbatim',
    run: (s) => {
      const must = 'The outlying details are often what change the whole approach'
      if (!OPENING_ASK.includes(must)) return 'OPENING_ASK no longer carries the outlying-details sentence'
      // ⚠ The source splits the sentence across a `' +` concatenation, so a raw
      // `includes` on the file finds nothing even when the wording is intact. Join the
      // adjacent literals first — searching the unjoined source is how this check
      // reported a failure on correct code the first time it ran.
      const joined = s['lib/lex/elicitation-config.ts'].replace(/'\s*\+\s*[\r\n]+\s*'/g, '')
      return joined.includes(must) ? null : 'the config file no longer holds it'
    },
    break: (s) => ({
      ...s,
      'lib/lex/elicitation-config.ts': s['lib/lex/elicitation-config.ts']
        .replace(/details are often what change/g, 'things are sometimes relevant to'),
    }),
  },
  {
    name: '§1a exchange 4 is CAPTURED, NOT READ — readingStatus is only ever NOT_READ',
    run: (s) => {
      const bad: string[] = []
      for (const [file, src] of Object.entries(s)) {
        if (!file.startsWith('lib/') && !file.startsWith('app/')) continue
        for (const m of src.matchAll(/readingStatus:\s*([^,\n]+)/g)) {
          const value = m[1].trim()
          const literal = value.startsWith("'") || value.startsWith('"')
          if (literal && value !== "'NOT_READ'") bad.push(`${file}: readingStatus: ${value}`)
        }
      }
      return bad.length ? `25-A must never claim to have read a document — ${bad.join(' · ')}` : null
    },
    break: (s) => ({ ...s, 'lib/lex/elicitation.ts': s['lib/lex/elicitation.ts'].replace("readingStatus: 'NOT_READ'", "readingStatus: 'READ'") }),
  },
  {
    name: '§1a exchange 3 is labelled USER TESTIMONY wherever it enters a prompt',
    run: (s) => {
      const files = ['lib/lex/build-config.ts', 'lib/lex/elicitation-client.ts']
      const bad: string[] = []
      let found = 0
      for (const f of files) {
        const src = s[f]
        // Only INTERPOLATIONS — the places the text actually enters a prompt. The same
        // value in a retrieval-steering array is not a prompt and needs no label; a
        // `${...}` inside a template a model will read does.
        for (const m of src.matchAll(/\$\{(?:ctx|input)\.ownKnowledge/g)) {
          found++
          const window = src.slice(Math.max(0, (m.index ?? 0) - 400), (m.index ?? 0) + 40)
          if (!/USER TESTIMONY/.test(window)) bad.push(`${f}@${m.index}`)
        }
      }
      if (!found) return 'the user’s own knowledge no longer reaches any prompt at all'
      return bad.length ? `own-knowledge reaches a prompt without its provenance label: ${bad.join(', ')}` : null
    },
    break: (s) => ({ ...s, 'lib/lex/build-config.ts': s['lib/lex/build-config.ts'].replace(/USER TESTIMONY/g, 'BACKGROUND') }),
  },
  {
    name: '§1a the problem gate still caps at two presses and still fires on a solution',
    run: (s) => {
      if (MAX_PROBLEM_PRESSES !== 2) return `MAX_PROBLEM_PRESSES is ${MAX_PROBLEM_PRESSES}, not 2`
      if (!looksLikeASolution('I want to change the amount charged for plastic bags in shops')) {
        return 'the canonical 10-Aug solution-shaped answer no longer trips the gate'
      }
      if (looksLikeASolution('Fly-tipping is rising and the council cannot keep up')) {
        return 'a plainly-stated problem is being treated as a solution'
      }
      return /export const MAX_PROBLEM_PRESSES = 2\b/.test(s['lib/lex/method.ts'])
        ? null
        : 'method.ts no longer declares the two-press cap'
    },
    break: (s) => ({ ...s, 'lib/lex/method.ts': s['lib/lex/method.ts'].replace('export const MAX_PROBLEM_PRESSES = 2', 'export const MAX_PROBLEM_PRESSES = 5') }),
  },
  {
    name: '§1a the gate is capped in the engine too, not only in the prompt',
    run: (s) => {
      const src = s['lib/lex/elicitation.ts']
      return /const willPress = shaped && presses < MAX_PROBLEM_PRESSES/.test(src)
        ? null
        : 'the elicitation no longer caps the problem gate at MAX_PROBLEM_PRESSES'
    },
    break: (s) => ({ ...s, 'lib/lex/elicitation.ts': s['lib/lex/elicitation.ts'].replace('const willPress = shaped && presses < MAX_PROBLEM_PRESSES', 'const willPress = shaped') }),
  },
  {
    name: '§1c a failed confirmation is REPORTED, never a stitched-together paragraph',
    run: (s) => {
      const src = s['lib/lex/elicitation.ts']
      if (!/NO DETERMINISTIC FALLBACK PARAGRAPH/.test(src)) {
        return 'the no-fallback decision has been removed from runUnderstanding'
      }
      // The only DB write of `understanding` must be the model's paragraph — scoped to
      // the prisma update so the interface declaration does not count.
      const writes = [...src.matchAll(/prisma\.ideaElicitation\.update\([\s\S]{0,300}?understanding:\s*([A-Za-z_][\w.]*)/g)].map((m) => m[1])
      if (!writes.length) return 'nothing writes the understanding paragraph any more'
      const bad = writes.filter((w) => w !== 'paragraph')
      return bad.length ? `understanding written from something other than the model’s paragraph: ${bad.join(', ')}` : null
    },
    break: (s) => ({ ...s, 'lib/lex/elicitation.ts': s['lib/lex/elicitation.ts'].replace('understanding: paragraph', 'understanding: stitchedFallback') }),
  },

  // ── §2 — the harness ───────────────────────────────────────────────────────
  {
    name: '§2 the confirmation blocks the build IN THE CLAIM, not just in the UI',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      const claim = src.slice(src.indexOf('export async function claimBuild'))
      return /if \(!\(await isConfirmed\(ideaId\)\)\) throw new ElicitationNotConfirmed\(\)/.test(claim)
        ? null
        : 'claimBuild no longer refuses an unconfirmed elicitation'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('if (!(await isConfirmed(ideaId))) throw new ElicitationNotConfirmed()', '// gate removed') }),
  },
  {
    name: '§2 the claim is a conditional update WHOSE COUNT IS CHECKED',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      return /const claimed = await prisma\.ideaBuild\.updateMany\(\{[\s\S]{0,400}?\}\)\s*\n\s*if \(claimed\.count === 0\) throw new BuildAlreadyRunning\(\)/.test(src)
        ? null
        : 'the build claim no longer reads the update count'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('if (claimed.count === 0) throw new BuildAlreadyRunning()', '// count unchecked') }),
  },
  {
    name: '§2 one active build per idea is enforced by a PARTIAL unique index',
    run: (s) => {
      const sql = s['prisma/lex_build_25a.sql']
      return /CREATE UNIQUE INDEX IF NOT EXISTS "IdeaBuild_one_active_per_idea"[\s\S]{0,200}WHERE "status" IN \('QUEUED', 'RUNNING'\)/.test(sql)
        ? null
        : 'the partial unique index is gone, or is no longer partial — a plain unique on ideaId would make a second build impossible'
    },
    break: (s) => ({ ...s, 'prisma/lex_build_25a.sql': s['prisma/lex_build_25a.sql'].replace(/WHERE "status" IN \('QUEUED', 'RUNNING'\)/, '') }),
  },
  {
    name: '§2 an abandoned RUNNING build is settled by WRITING it to FAILED',
    run: (s) => {
      const src = s['lib/lex/build-settle.ts']
      if (!/prisma\.ideaBuild\.updateMany/.test(src)) return 'settleAbandonedBuilds no longer writes'
      if (!/status: 'FAILED'/.test(src)) return 'settleAbandonedBuilds no longer writes FAILED'
      return /status: \{ in: \['QUEUED', 'RUNNING'\] \}/.test(src) ? null : 'the settle no longer targets QUEUED/RUNNING rows'
    },
    break: (s) => ({ ...s, 'lib/lex/build-settle.ts': s['lib/lex/build-settle.ts'].replace("status: 'FAILED',", '// status left as it was,') }),
  },
  {
    name: '§2 the settle happens on the READ, so nothing can sit at RUNNING for ever',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      const state = src.slice(src.indexOf('export async function buildState'), src.indexOf('export async function buildState') + 900)
      return /await settleAbandonedBuilds\(ideaId\)/.test(state)
        ? null
        : 'buildState no longer settles abandoned builds before reporting'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace(/(export async function buildState[\s\S]{0,400}?)await settleAbandonedBuilds\(ideaId\)/, '$1// no settle on read') }),
  },
  {
    name: '§2 the ceiling that fires is the SMALLER of the two, and it names which binds',
    run: (s) => {
      const eff = effectiveBudgetMs()
      if (eff.ms !== Math.min(HARD_STOP_MS, REQUEST_BUDGET_MS)) {
        return `effectiveBudgetMs returned ${eff.ms}, not min(${HARD_STOP_MS}, ${REQUEST_BUDGET_MS})`
      }
      if (!['request', 'hard-stop'].includes(eff.binding)) return `binding is "${eff.binding}"`
      // The whole point: on this platform the request budget is the one that can fire.
      // A budget above the 300s function ceiling could never fire, and a guard that
      // cannot fail is not a guard.
      if (eff.ms > 300_000) return 'the effective budget exceeds the platform’s 300s function ceiling — it could never fire'
      // Source half: BOTH numbers stay declared and exported. Collapsing them into one
      // is how the brief's 15-minute ceiling would quietly start pretending to be the
      // limit that fires.
      const cfg = s['lib/lex/build-config.ts']
      return /export const HARD_STOP_MS/.test(cfg) && /export const REQUEST_BUDGET_MS/.test(cfg)
        ? null
        : 'one of the two ceilings has gone — the brief’s fifteen minutes and the platform’s limit are different facts and must stay separately visible'
    },
    break: (s) => ({ ...s, 'lib/lex/build-config.ts': s['lib/lex/build-config.ts'].replace('export const REQUEST_BUDGET_MS', 'const REQUEST_BUDGET_MS') }),
  },
  {
    name: '§2 a ceiling produces a FAILED/CANCELLED build, never a silently shortened DONE',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      const stop = src.slice(src.indexOf('async function stopBuild'), src.indexOf('async function settleBuild'))
      if (!/const status = stop\.kind === 'cancel' \? 'CANCELLED' : 'FAILED'/.test(stop)) {
        return 'stopBuild no longer settles to FAILED/CANCELLED'
      }
      return /settleBuild\(buildId, status, stopMessage\(stop\)/.test(stop) ? null : 'stopBuild no longer records the reason'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace("const status = stop.kind === 'cancel' ? 'CANCELLED' : 'FAILED'", "const status = 'DONE' as const") }),
  },
  {
    name: '§2 cancel is co-operative — the route records it, the engine settles',
    run: (s) => {
      const route = s['app/api/ideas/[id]/build/cancel/route.ts']
      if (/status: 'CANCELLED'/.test(route)) {
        return 'the cancel route flips the status itself, so the row would say CANCELLED while work carried on underneath it'
      }
      if (!/cancelRequested/.test(route)) return 'the cancel route no longer records the request'
      const engine = s['lib/lex/build.ts']
      return /row\?\.cancelRequested\) return \{ kind: 'cancel' \}/.test(engine)
        ? null
        : 'the engine no longer checks cancelRequested between passes'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace("if (row?.cancelRequested) return { kind: 'cancel' }", '// cancel ignored') }),
  },
  {
    name: '§2 spend is written on EVERY terminal path, failures included',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      const settle = src.slice(src.indexOf('async function settleBuild'))
      return /tokensIn: price\.tokensIn/.test(settle) && /estCostPence: price\.pence/.test(settle)
        ? null
        : 'settleBuild no longer records the spend'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('estCostPence: price.pence,', '') }),
  },
  {
    name: '§2 the pass log distinguishes “not reached” from “still to come”',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      if (!/'NOT_REACHED'/.test(src)) return 'NOT_REACHED is gone — a finished build would show unrun passes as PENDING, i.e. "still to come"'
      return /status: 'NOT_REACHED' as PassStatus/.test(src) || /status: 'NOT_REACHED' \}/.test(src)
        ? null
        : 'nothing writes NOT_REACHED, so the state is decorative'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace(/NOT_REACHED/g, 'PENDING') }),
  },

  // ── cost: null means UNPRICED, never 0 ─────────────────────────────────────
  {
    name: 'an unpriced model costs NULL, not zero, and says so',
    run: (s) => {
      const known = priceBuild([{ model: 'gemini-2.5-flash', tokensIn: 100_000, tokensOut: 10_000 }])
      if (known.pence == null) return 'a known model came back unpriced'
      if (!(known.pence > 0)) return `a known model priced at ${known.pence}p`
      const unknown = priceBuild([{ model: 'some-model-we-have-no-rate-for', tokensIn: 100_000, tokensOut: 10_000 }])
      if (unknown.pence !== null) return `an unknown model priced at ${unknown.pence}p instead of null`
      if (!unknown.unpriced.length) return 'an unknown model did not report itself as unpriced'
      if (!/not estimated/.test(formatSpend(unknown))) return `formatSpend hid the gap: "${formatSpend(unknown)}"`
      // A model configured but never called must not blank out an otherwise good estimate.
      const mixed = priceBuild([
        { model: 'gemini-2.5-flash', tokensIn: 1000, tokensOut: 100 },
        { model: 'never-called', tokensIn: 0, tokensOut: 0 },
      ])
      if (mixed.pence == null) return 'a never-called model blanked out an otherwise good estimate'
      return /pence: unpriced\.size \? null :/.test(s['lib/lex/build-cost.ts'])
        ? null
        : 'priceBuild no longer returns null for an unpriced run — zero is a claim, and it is the claim most likely to be believed'
    },
    break: (s) => ({ ...s, 'lib/lex/build-cost.ts': s['lib/lex/build-cost.ts'].replace('pence: unpriced.size ? null :', 'pence: unpriced.size ? 0 :') }),
  },
  {
    name: 'an unpriced run says out loud that the cost ceiling is not in force',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      return /cost ceiling NOT ENFORCEABLE this run/.test(src)
        ? null
        : 'an unpriced run no longer reports that the cost ceiling cannot be enforced'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('cost ceiling NOT ENFORCEABLE this run', 'cost ok') }),
  },

  // ── §3 — the framing experiment ────────────────────────────────────────────
  {
    name: '§3a the two framings are genuinely different (A carries no context, B carries it)',
    run: (s) => {
      const a = frameQuery('A_NAIVE', CTX)
      const b = frameQuery('B_CONTEXTUALISED', CTX)
      for (const marker of ['UNIQUERULEDOUTMARKER', 'UNIQUETESTIMONYMARKER', 'UNIQUEPROFILEMARKER']) {
        if (a.promptBlock.includes(marker)) return `arm A leaked ${marker} — the arms are not distinct`
        if (!b.promptBlock.includes(marker)) return `arm B is missing ${marker}`
      }
      if (a.ideaContext !== '') return 'arm A is passing context to the gateway'
      if (!b.ideaContext) return 'arm B is passing no context to the gateway'
      if (a.promptBlock === b.promptBlock) return 'both arms produced the same prompt block'
      // Both arms must issue the SAME search terms: the variable under test is the
      // framing, and changing the term extraction as well would confound the result.
      if (a.keywords.join(' ') !== b.keywords.join(' ')) {
        return 'the arms differ in their search terms, which confounds the experiment'
      }
      if (!a.queryUsed.startsWith('A_NAIVE') || !b.queryUsed.startsWith('B_CONTEXTUALISED')) {
        return 'queryUsed no longer records the arm'
      }
      // Source half: arm A's branch must not so much as MENTION the contextual fields.
      // Two arms that converge would keep running, keep reporting, and be measuring
      // nothing — the worst possible outcome for an experiment.
      const cfg = s['lib/lex/build-config.ts']
      const iA = cfg.indexOf("if (framing === 'A_NAIVE')")
      const iB = cfg.indexOf('// B — the problem plus goal')
      if (iA < 0 || iB < 0 || iB < iA) return 'frameQuery no longer has two distinguishable arms'
      const armA = cfg.slice(iA, iB)
      const leaked = ['ownKnowledge', 'ruledOut', 'aboutYou', 'goalKindLabel'].filter((f) => armA.includes(f))
      return leaked.length ? `arm A’s branch references ${leaked.join(', ')} — the arms are converging` : null
    },
    break: (s) => ({ ...s, 'lib/lex/build-config.ts': s['lib/lex/build-config.ts'].replace('const plain = ctx.problem.trim().slice(0, 4000)', 'const plain = (ctx.problem + ctx.ownKnowledge).trim().slice(0, 4000)') }),
  },
  {
    name: '§3a the arm is written onto the row, and the column has NO default',
    run: (s) => {
      const sql = s['prisma/lex_build_25a.sql']
      if (/"framing"\s+"BuildFraming"\s+NOT NULL\s+DEFAULT/.test(sql)) {
        return 'framing has a DEFAULT — a build could then fail to say which arm it ran'
      }
      if (!/"framing"\s+"BuildFraming"\s+NOT NULL/.test(sql)) return 'framing is no longer NOT NULL'
      if (!isFraming(DEFAULT_FRAMING)) return `DEFAULT_FRAMING is not a framing: ${DEFAULT_FRAMING}`
      return /queryUsed: framed\.queryUsed/.test(s['lib/lex/build.ts'])
        ? null
        : 'the issued query is no longer written onto the build row'
    },
    break: (s) => ({ ...s, 'prisma/lex_build_25a.sql': s['prisma/lex_build_25a.sql'].replace('"framing"        "BuildFraming" NOT NULL,', `"framing"        "BuildFraming" NOT NULL DEFAULT 'A_NAIVE',`) }),
  },
  {
    name: '§3 the domain-transfer answer is LABELLED as reasoning, not corpus-grounded',
    run: (s) => {
      const body = briefingBody('terrain text', 'analogue text', [], false)
      if (!/Reasoning, not retrieval/i.test(body)) {
        return 'the briefing no longer labels the domain-transfer answer as reasoning'
      }
      return /THIS IS REASONING, NOT RETRIEVAL/.test(s['lib/lex/build-client.ts'])
        ? null
        : 'the orient prompt no longer tells Lex to say that its domain-transfer answer is reasoning'
    },
    break: (s) => ({ ...s, 'lib/lex/build-client.ts': s['lib/lex/build-client.ts'].replace('THIS IS REASONING, NOT RETRIEVAL', 'Just answer it') }),
  },
  {
    name: '§3 a failed search and a silent corpus are told apart',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      if (!/searchFailed = anyFailed \|\| !anyRan/.test(src)) {
        return 'the build no longer records that a corpus search failed — a broken search would read as a silent corpus'
      }
      const failed = briefingBody('t', 'd', [], true)
      const clean = briefingBody('t', 'd', [], false)
      if (!/did not complete/.test(failed)) return 'a failed search is not reported in the briefing'
      return /did not complete/.test(clean) ? 'a successful search is being reported as failed' : null
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('searchFailed = anyFailed || !anyRan', 'searchFailed = false') }),
  },
  {
    name: '§3 a citation the corpus did not return cannot be persisted',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      return /citedSourceIds[\s\S]{0,90}seen\.has\(id\)/.test(src)
        ? null
        : 'the orient pass no longer drops source ids that were never handed to the model'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace(/citedSourceIds[\s\S]{0,90}seen\.has\(id\)/g, 'citedSourceIds') }),
  },

  // ── §4 — forks and the instrument ──────────────────────────────────────────
  {
    name: '§4 two alternatives per fork, and the excess is counted rather than dropped silently',
    run: (s) => {
      if (ALTERNATIVES_PER_FORK !== 2) return `ALTERNATIVES_PER_FORK is ${ALTERNATIVES_PER_FORK}, not 2`
      const four = trimForkAlternatives([
        { alternative: 'a', caseForAlternative: 'ca' },
        { alternative: 'b', caseForAlternative: 'cb' },
        { alternative: 'c', caseForAlternative: 'cc' },
        { alternative: 'd', caseForAlternative: 'cd' },
      ])
      if (four.kept.length !== 2) return `kept ${four.kept.length} alternatives, not 2`
      if (four.trimmed !== 2) return `trimmed count was ${four.trimmed}, not 2`
      // An alternative with no case for it is not an alternative.
      if (trimForkAlternatives([{ alternative: 'a', caseForAlternative: '  ' }]).kept.length !== 0) {
        return 'an alternative with no case for it was kept'
      }
      const one = trimForkAlternatives([{ alternative: 'a', caseForAlternative: 'ca' }])
      if (!(one.kept.length === 1 && one.trimmed === 0)) return 'a single honest alternative was not accepted'
      return /export const ALTERNATIVES_PER_FORK = 2\b/.test(s['lib/lex/build-config.ts'])
        ? null
        : 'the two-alternatives-per-fork decision has changed — two strong beats three with filler was Charlie’s call'
    },
    break: (s) => ({ ...s, 'lib/lex/build-config.ts': s['lib/lex/build-config.ts'].replace('export const ALTERNATIVES_PER_FORK = 2', 'export const ALTERNATIVES_PER_FORK = 3') }),
  },
  {
    name: '§4 the instrument question is asked, and a build that skips it says so',
    run: (s) => {
      // The options live in build-config (INSTRUMENTS) and are interpolated into the
      // approach prompt. Both halves are asserted: a list nothing reads is decoration,
      // and an interpolation of an empty list is an unanswerable question.
      const cfg = s['lib/lex/build-config.ts']
      for (const option of ['primary legislation', 'secondary legislation', 'regulator rule or guidance', 'funding', 'organisational change']) {
        if (!cfg.includes(option)) return `the instrument option "${option}" is gone from INSTRUMENTS`
      }
      const client = s['lib/lex/build-client.ts']
      if (!/INSTRUMENTS\.join/.test(client)) {
        return 'the instrument options are no longer put into the approach prompt'
      }
      const engine = s['lib/lex/build.ts']
      if (!/INSTRUMENT_FORK_KEY/.test(engine)) return 'the instrument choice is no longer recorded as a fork'
      return /APPROACH named no instrument/.test(engine)
        ? null
        : 'a build that names no instrument no longer reports the gap'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('APPROACH named no instrument', 'all fine') }),
  },
  {
    name: '§4 a model-emitted duplicate of the instrument fork is dropped, and the drop is counted',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      if (!/if \(f\.forkKey !== INSTRUMENT_FORK_KEY && \/instrument\/i\.test\(f\.forkKey\)\)/.test(src)) {
        return 'the duplicate-instrument filter is gone — measured on 2026-08-17, every build emits one'
      }
      // ⚠ Inside persistForks, so it holds for EVERY pass. A filter scoped to the
      // approach pass was tried and failed: the duplicate does not always come from
      // that pass.
      const fn = src.slice(src.indexOf('async function persistForks'), src.indexOf('function mergeUncertainties'))
      if (!/INSTRUMENT_FORK_KEY/.test(fn)) return 'the filter is not inside persistForks, so it only covers some passes'
      return /dropped model-emitted instrument fork/.test(src)
        ? null
        : 'the drop is silent — a silent de-duplication is indistinguishable from a model that stopped doing it'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace('if (f.forkKey !== INSTRUMENT_FORK_KEY && /instrument/i.test(f.forkKey)) {', 'if (false) {') }),
  },
  {
    name: '§4 pass 2 writes PROPOSALS — nothing is accepted on the user’s behalf',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      if (/\bacceptField\(/.test(src)) return 'the build calls acceptField — it must only ever propose'
      if (/\bsubmitBox\(/.test(src)) return 'the build calls submitBox — the user’s own words are written by the elicitation, not here'
      return /setProposal\(/.test(src) ? null : 'the build no longer writes proposals at all'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace("await setProposal(ideaId, 'challenge'", "await acceptField(ideaId, 'challenge'") }),
  },
  {
    name: '§4 the build never invents a cost',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      for (const field of ['implementationCost', 'enforcementCost', 'regulatoryFriction', 'costSummary']) {
        if (new RegExp(`${field}\\s*:`).test(src)) {
          return `the build writes ${field} — costing is the user’s work, and an invented range travels into a cost-benefit case as though it had a source`
        }
      }
      return /NO COSTS/.test(src) ? null : 'the no-costs decision has been removed from the actions pass'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace("source: 'LEX' as const,", "implementationCost: { low: 1, high: 2 }, source: 'LEX' as const,") }),
  },
  {
    name: '§4 every page is opened after a build, or the drafts could not be saved',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      // `assertWritableField` refuses a write to a page ahead of Idea.lexPage. Without
      // this the panel would fill with drafts the user could look at and not save.
      return /data: \{ lexPage: 'COHERENT_ACTIONS' \}/.test(src)
        ? null
        : 'openAllPages no longer moves the page pointer, so every drafted field beyond Orientation would 409 on save'
    },
    break: (s) => ({ ...s, 'lib/lex/build.ts': s['lib/lex/build.ts'].replace("data: { lexPage: 'COHERENT_ACTIONS' }", 'data: {}') }),
  },

  // ── §5 — presenting the draft ──────────────────────────────────────────────
  {
    name: '§5 the credibility note comes AFTER the work, not before it',
    run: (s) => {
      const src = s['lib/lex/build.ts']
      const start = src.indexOf('async function composeSummary')
      if (start < 0) return 'composeSummary is gone'
      const block = src.slice(start)
      const iMessage = block.indexOf("lexBubble(message, BUILD_STAGE, 'build:summary')")
      const iCred = block.indexOf('CREDIBILITY_NOTE')
      if (iMessage < 0) return 'the build summary bubble is gone'
      if (iCred < 0) return 'the credibility note is no longer written'
      if (iCred < iMessage) return 'the credibility note is written BEFORE the summary — a warning before the work reads as a threat'
      return /Everything above is mine until you’ve been through it/.test(CREDIBILITY_NOTE)
        ? null
        : 'the credibility note has been reworded away from Charlie’s wording'
    },
    // ⚠ CRLF-TOLERANT, and the first version was not. It used a literal "\n" and
    // silently matched nothing on this Windows checkout, so the assertion reported a
    // pass while testing an unmodified file. `--self-test` caught it. A control that
    // cannot fire is the same defect as a check that cannot fail.
    break: (s) => ({
      ...s,
      'lib/lex/build.ts': s['lib/lex/build.ts'].replace(
        /lexBubble\(message, BUILD_STAGE, 'build:summary'\),(\s*)lexBubble\(CREDIBILITY_NOTE, BUILD_STAGE, 'build:credibility'\),/,
        "lexBubble(CREDIBILITY_NOTE, BUILD_STAGE, 'build:credibility'),$1lexBubble(message, BUILD_STAGE, 'build:summary'),",
      ),
    }),
  },
  {
    name: '§5 the progress display shows named passes and elapsed time, not a percentage',
    run: (s) => {
      const ui = s['components/lex/BuildProgress.tsx']
      const code = ui.replace(/\/\/.*$/gm, '').replace(/className="[^"]*"/g, '')
      if (/percent|progressBar|\bpct\b/i.test(code)) {
        return 'the progress display has grown a percentage — the row stores passes, not a fraction of the work'
      }
      for (const label of ['Understanding the terrain', 'Drafting the diagnosis', 'Drafting the approach', 'Drafting the actions']) {
        if (!BUILD_PASSES.some((p) => p.label === label)) return `the named pass "${label}" is gone`
      }
      return /elapsed\(build\.elapsedSeconds\)/.test(ui) ? null : 'elapsed time is no longer shown'
    },
    // ⚠ `split/join`, NOT `.replace` — which substitutes only the FIRST occurrence. 25-C added a
    // second `elapsed(build.elapsedSeconds)` (the actual-vs-estimate line), so the single-shot
    // mutation left the other one standing, the assertion still matched, and the harness correctly
    // reported the control as inert: "this assertion cannot fail, so it is asserting nothing".
    // A control that stops mutating everything it names decays into a guard that always passes.
    break: (s) => ({
      ...s,
      'components/lex/BuildProgress.tsx':
        s['components/lex/BuildProgress.tsx'].split('elapsed(build.elapsedSeconds)').join("''"),
    }),
  },
  {
    name: '§5 the draft is presented in the EXISTING panel, not a second viewer',
    run: (s) => {
      const client = s['app/ideas/build/BuildIdeaClient.tsx']
      return /\/ideas\/create\?ideaId=\$\{ideaId\}/.test(client)
        ? null
        : 'the build no longer hands off to the existing create panel — §5 says present it as it stands today'
    },
    break: (s) => ({ ...s, 'app/ideas/build/BuildIdeaClient.tsx': s['app/ideas/build/BuildIdeaClient.tsx'].replace('/ideas/create?ideaId=${ideaId}', '/ideas/build/preview') }),
  },

  // ── the NUL byte, found by the framing harness on 2026-08-17 ───────────────
  {
    name: 'a NUL byte cannot reach a jsonb column — every corpus-carrying write strips it',
    run: (s) => {
      // The behaviour first, so this is not only a grep.
      const dirty = { a: 'x y', b: ['p ', { c: 'q r' }], n: 3, d: null }
      if (countNullBytes(dirty) !== 3) return `countNullBytes found ${countNullBytes(dirty)}, not 3`
      const clean = stripNullBytes(dirty)
      if (countNullBytes(clean) !== 0) return 'stripNullBytes left a NUL behind'
      if (clean.a !== 'xy' || clean.n !== 3 || clean.d !== null) return 'stripNullBytes mangled a value it should have left alone'
      if (stripNullBytes('a\tb\nc') !== 'a\tb\nc') return 'stripNullBytes removed TAB/LF, which carry meaning in extracted text'
      // Then the three write paths that carry corpus text into jsonb.
      const sites: Array<[string, RegExp]> = [
        ['stage searches', /stageSearches: stripNullBytes\(next\)/],
        ['legislationRefs (existing path)', /legislationRefs: stripNullBytes\(refs\)/],
        ['legislationRefs (25-A build)', /legislationRefs: stripNullBytes\(merged/],
        ['the transcript', /aiChatHistory: stripNullBytes\(updated\)/],
      ]
      const all = Object.values(s).join('\n')
      const unguarded = sites.filter(([, re]) => !re.test(all)).map(([n]) => n)
      return unguarded.length
        ? `unguarded jsonb write(s): ${unguarded.join(', ')} — one U+0000 in one snippet rejects the whole write`
        : null
    },
    break: (s) => ({ ...s, 'lib/lex/stage-search.ts': s['lib/lex/stage-search.ts'].replace('stageSearches: stripNullBytes(next)', 'stageSearches: next') }),
  },

  // ── §18 — every LLM call checks finishReason before parsing ────────────────
  {
    name: '§18 finishReason is checked BEFORE the payload is parsed',
    run: (s) => {
      const src = s['lib/lex/build-llm.ts']
      const iFinish = src.indexOf('geminiFinishProblem(')
      const iParse = src.indexOf('JSON.parse(text)')
      if (iFinish < 0) return 'the finishReason guard is gone'
      if (iParse < 0) return 'the parse is gone'
      return iFinish < iParse
        ? null
        : 'the payload is parsed before finishReason is checked, which turns a length limit into a parse error'
    },
    break: (s) => ({ ...s, 'lib/lex/build-llm.ts': s['lib/lex/build-llm.ts'].replace(/const cut = geminiFinishProblem\([\s\S]{0,200}?\n/, '') }),
  },
  {
    name: '§18 a truncated call still reports its token usage',
    run: (s) => {
      const src = s['lib/lex/build-llm.ts']
      return /return \{ ok: false, reason: cut\.reason, detail: cut\.detail, usage \}/.test(src)
        ? null
        : 'a truncated call no longer returns its usage — a cost ceiling that only counts successes is one a failing loop walks through'
    },
    break: (s) => ({ ...s, 'lib/lex/build-llm.ts': s['lib/lex/build-llm.ts'].replace('return { ok: false, reason: cut.reason, detail: cut.detail, usage }', 'return { ok: false, reason: cut.reason, detail: cut.detail, usage: ZERO(opts.model) }') }),
  },
  {
    name: '§18 thinking is OFF on every build call (it ate three generators’ budgets in §19-D)',
    run: (s) => {
      const src = s['lib/lex/build-llm.ts']
      // ⚠ 25-C §4c — THE RULE IS UNCHANGED; THE LITERAL MOVED. Thinking must still be OFF for
      // every model that accepts a zero budget. It is now decided per model, because
      // `gemini-2.5-pro` REJECTS a zero budget outright and this very line is what made it
      // unreachable through all seven build passes while the registry listed it as available.
      // So the assertion is the property — the config comes from the one helper that decides it —
      // rather than a string that pins one model's answer for all of them.
      if (!/thinkingConfig: thinkingConfigFor\(opts\.model\)/.test(src)) {
        return 'the build no longer routes its thinking budget through model-thinking.ts'
      }
      // …and that helper must still answer ZERO for an ordinary model.
      return thinkingConfigFor('gemini-2.5-flash').thinkingBudget === 0
        ? null
        : 'thinking is no longer disabled for models that accept it — §19-D Task 2b: three generators returned nothing because thinking ate the whole output budget'
    },
    break: (s) => ({ ...s, 'lib/lex/build-llm.ts': s['lib/lex/build-llm.ts'].replace('thinkingConfig: thinkingConfigFor(opts.model)', 'thinkingConfig: { thinkingBudget: 4096 }') }),
  },
  {
    name: '§18 failure reasons are named apart, not collapsed into one',
    run: (s) => {
      const reasons = ['no-key', 'http', 'timeout', 'truncated', 'blocked', 'bad-json', 'empty'] as const
      const seen = new Set<string>()
      for (const r of reasons) {
        const fail: LlmResult<unknown> = { ok: false, reason: r, detail: 'x', usage: { model: 'm', tokensIn: 0, tokensOut: 0 } }
        if (!llmFailed(fail)) return `llmFailed did not recognise a failure with reason ${r}`
        if (llmOk(fail)) return `llmOk accepted a failure with reason ${r}`
        seen.add(r)
      }
      const ok: LlmResult<number> = { ok: true, value: 1, usage: { model: 'm', tokensIn: 0, tokensOut: 0 } }
      if (llmFailed(ok)) return 'llmFailed rejected a successful result'
      if (seen.size !== reasons.length) return 'a failure reason was lost'
      const src = s['lib/lex/build-llm.ts']
      const missing = reasons.filter((r) => !src.includes(`'${r}'`))
      return missing.length
        ? `LlmFailureReason no longer names ${missing.join(', ')} — a caller that degrades gracefully must still log WHICH`
        : null
    },
    // Global, because `'truncated'` appears in the union AND in `plainFailure`'s switch:
    // removing it from only one of the two leaves the string in the file and the control
    // silently does not fire. (Caught by --self-test, which is the point of running it.)
    break: (s) => ({ ...s, 'lib/lex/build-llm.ts': s['lib/lex/build-llm.ts'].replace(/'truncated'/g, "'failed'") }),
  },
]

// ── runner ───────────────────────────────────────────────────────────────────

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let failures = 0
  let controlsFired = 0
  let noControl = 0

  console.log(selfTest
    ? '── check:build-25a --self-test — every assertion with a control must REJECT its corrupted input ──'
    : '── check:build-25a ──')

  for (const c of CHECKS) {
    if (selfTest) {
      if (!c.break) {
        // Reported, not silently counted as a pass. These assertions run against
        // imported code, which cannot be corrupted from inside this process; their
        // controls are the fixtures inside `run` (an unknown model, a four-alternative
        // fork, a solution-shaped problem), which do fail when the logic breaks.
        noControl++
        console.log(`  ~  ${c.name}\n       no source-level control — the assertion executes imported code directly`)
        continue
      }
      const err = c.run(c.break(src))
      if (err) {
        controlsFired++
        console.log(`  ✓  ${c.name}\n       control fired: ${err}`)
      } else {
        failures++
        console.log(`  ✗  ${c.name}\n       CONTROL DID NOT FIRE — this assertion cannot fail, so it is asserting nothing`)
      }
      continue
    }

    const err = c.run(src)
    if (err) {
      failures++
      console.log(`  ✗  ${c.name}\n       ${err}`)
    } else {
      console.log(`  ✓  ${c.name}`)
    }
  }

  console.log('')
  if (selfTest) {
    console.log(`${controlsFired} control(s) fired · ${noControl} without a source-level control · ${failures} that could not fail.`)
  } else {
    console.log(`${CHECKS.length - failures}/${CHECKS.length} checks pass.`)
  }
  process.exit(failures ? 1 : 0)
}

main()
