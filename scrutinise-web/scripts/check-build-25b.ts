// ─────────────────────────────────────────────────────────────────────────────
// check:build-25b — the Sprint 25-B guards.
//
// Same contract as check:build-25a, and for the same reason: EVERY ASSERTION THAT CAN
// HAVE A NEGATIVE CONTROL HAS ONE, and `--self-test` runs them. A guard that cannot fail
// is not a guard. Each source-text check carries a `break` — a deliberately corrupted
// copy of the sources — and `--self-test` exits 0 only if every such check REJECTS it.
//
// Checks that run against IMPORTED CODE cannot be corrupted from in-process, so they are
// REPORTED AS HAVING NO CONTROL rather than counted as controlled. An untestable control
// quietly counted as a pass is the exact thing this file exists to prevent.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:build-25b
//   npm run check:build-25b -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILD_PASSES, passDef, perspectivesFor, PERSPECTIVES, HOUSE_PERSPECTIVE,
  COST_CEILING_PENCE, PASS_COST_CEILING_PENCE, PASS_BUDGET_MS, HARD_STOP_MS,
  isBuildPassKey, modelForPass,
} from '../lib/lex/build-config'
import {
  INTERROGATION_LIBRARY, QUESTION_IDS, questionsFor, retrievalStanding, retrievalNote,
  type DraftFacts,
} from '../lib/lex/interrogation-library'
import {
  freshPassLog, readPassLog, carryInto, nextPassKey, isResumable, allUsages, passesComplete,
  type PassRecord,
} from '../lib/lex/build-carry'
import { mergePerspectives, divergenceLine, type PerspectiveRun } from '../lib/lex/build-perspectives'
import { priceBuild } from '../lib/lex/build-cost'
import { humaniseSeconds, MIN_SAMPLE, EMAIL_OFFER_SECONDS } from '../lib/lex/build-estimate'

/**
 * ⚠ LINE ENDINGS ARE NORMALISED ON READ, AND THIS IS NOT A NICETY.
 *
 * This repo checks out CRLF on Windows. An assertion that slices a function body on a bare
 * newline-brace-newline matches NOTHING there: `indexOf` returns -1, the slice collapses to two
 * characters, and the check reports a failure that has nothing to do with the code it guards.
 *
 * 25-B's worker-loop guard did exactly that the moment an edit rewrote `build.ts` with CRLF — it
 * reported the loop had stopped reading the stored pass log while the loop was perfectly correct.
 * The same class already bit `check:build-25a` once, with a control that matched a literal
 * newline and therefore tested an unmodified file. Normalise once, here, and the class is gone.
 */
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>

interface Check {
  name: string
  /** The real assertion. Returns an error string, or null when it holds. */
  run: (src: Sources) => string | null
  /** The negative control: a corrupted source bag `run` MUST reject. Omit when the
   *  assertion runs against imported code and cannot be corrupted from here. */
  break?: (src: Sources) => Sources
}

const LIBRARY = 'lib/lex/interrogation-library.ts'

const FILES = [
  'lib/lex/build.ts',
  'lib/lex/build-config.ts',
  'lib/lex/build-carry.ts',
  'lib/lex/build-research.ts',
  'lib/lex/build-perspectives.ts',
  'lib/lex/build-estimate.ts',
  'scripts/build-worker.ts',
  'lib/lex/build-client.ts',
  'lib/lex/build-settle.ts',
  'lib/lex/build-cost.ts',
  LIBRARY,
  // Read, never rewritten by this sprint — §2's "reuse, do not rebuild" can only be
  // asserted by looking at the files 25-B promised to reuse rather than copy.
  'lib/lex/deepening.ts',
  'lib/lex/deepening-sift.ts',
  'lib/lex/deepening-client.ts',
  'lib/lex/deepening-adversarial.ts',
  'app/api/ideas/[id]/build/route.ts',
  'app/ideas/build/BuildIdeaClient.tsx',
  'components/lex/BuildProgress.tsx',
] as const

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/** Every file except the library — where a question id is allowed to appear. */
const outsideLibrary = (src: Sources) =>
  Object.entries(src).filter(([f]) => f !== LIBRARY)

// ── Draft fixtures. Unmistakable, so a predicate misfiring is visible. ───────

const PRIMARY_DRAFT: DraftFacts = {
  text: 'A Bill to require councils to meet the collection standard they publish under the ' +
    'Environmental Protection Act 1990, section 45.',
  instrument: 'primary legislation · national · reserved',
  instrumentIsPrimary: true,
  devolution: 'reserved',
  namesExistingLaw: true,
  hasCauses: true,
  hasChosenApproach: true,
}

const DEVOLVED_DRAFT: DraftFacts = {
  ...PRIMARY_DRAFT,
  instrument: 'secondary legislation · national · devolved',
  instrumentIsPrimary: false,
  devolution: 'devolved',
}

const BARE_DRAFT: DraftFacts = {
  text: 'Something should be done about the bins.',
  instrument: '',
  instrumentIsPrimary: true,
  devolution: 'unknown',
  namesExistingLaw: false,
  hasCauses: false,
  hasChosenApproach: false,
}

const CHECKS: Check[] = [
  // ═══ §3 — THE LIBRARY IS CONFIGURATION ═══════════════════════════════════
  {
    name: '§3 no question id appears anywhere outside the library file',
    run: (src) => {
      const offences: string[] = []
      for (const [file, text] of outsideLibrary(src)) {
        for (const id of QUESTION_IDS) {
          // Word-boundary match, so DEVOLUTION_SCOPE as a SearchIntent in the gateway
          // type — a legitimate, different thing — is not confused with the question id.
          // The test is specifically about the BUILD's own files naming a question.
          if (!/^lib\/lex\/build|^app\/|^components\//.test(file)) continue
          if (new RegExp(`['"\`]${id}['"\`]`).test(text)) offences.push(`${file} names ${id}`)
        }
      }
      return offences.length
        ? `adding a question would mean a code change: ${offences.join('; ')}`
        : null
    },
    // The control names a REAL id rather than a literal, so it keeps working if the ids
    // are ever renamed — a control that silently stops matching is a control that passes
    // for the wrong reason, which is the failure this whole harness is built against.
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': `${src['lib/lex/build-research.ts']}\nif (q.id === '${QUESTION_IDS[0]}') lead()`,
    }),
  },
  {
    name: '§3 every question declares a heading, a method, must-answers and anchors',
    run: () => {
      // ⚠ 25-F §4 — `terms` became `anchors`. The field was a `(d) => string[]` builder
      // that read `termsFrom(d.text, 14)`, so every question's "own query" was the same
      // fourteen frequency-ranked words; the query is now WRITTEN per question by
      // `writeQueries`, and what configuration owns is the terms of art it always wants.
      const bad = INTERROGATION_LIBRARY.filter(
        (q) => !q.panelHeading?.trim() || q.method.length < 100 || !q.mustAnswer.length || !Array.isArray(q.anchors),
      )
      return bad.length ? `incomplete entries: ${bad.map((q) => q.id).join(', ')}` : null
    },
  },
  {
    name: '§3 a question whose retrieval mode Search has not built SAYS SO',
    run: () => {
      const unrouted = INTERROGATION_LIBRARY.filter((q) => q.wantedIntent)
      if (!unrouted.length) return 'no question declares a wantedIntent — the honest half of §3 is missing'
      const silent = unrouted.filter((q) => {
        const note = retrievalNote(q)
        return !note || !/no dedicated/i.test(note)
      })
      return silent.length ? `silent about their gap: ${silent.map((q) => q.id).join(', ')}` : null
    },
  },
  {
    name: '§3 an unrouted question still RUNS on a real intent, rather than being skipped',
    run: () => {
      // The gap is reported as a limit in our tooling; it must not become an excuse to
      // ask nothing, which would turn "we cannot search this way" into "there is nothing".
      const bad = INTERROGATION_LIBRARY.filter(
        (q) => q.wantedIntent && q.kind === 'CORPUS' && !q.intents.length,
      )
      return bad.length ? `unrouted AND unasked: ${bad.map((q) => q.id).join(', ')}` : null
    },
  },
  {
    name: '§3 the audit finding is recorded: intent is a LABEL, and no state claims otherwise',
    run: (src) => {
      // `retrievalStanding` must not have grown a 'routed' state. Adding one would require
      // a caller whose retrieval actually changes with the intent, and there is none —
      // every intent in the gateway is descriptive. See the library header.
      const bad = INTERROGATION_LIBRARY.filter((q) => !['reasoned', 'unrouted', 'general'].includes(retrievalStanding(q)))
      if (bad.length) return `unknown standing on ${bad.map((q) => q.id).join(', ')}`
      return /intent` NEVER SELECTS STREAMS|intent NEVER SELECTS STREAMS/i.test(src[LIBRARY])
        ? null
        : 'the library no longer records WHY intents are labels — the next reader will re-derive it'
    },
    break: (src) => ({ ...src, [LIBRARY]: src[LIBRARY].replace(/NEVER SELECTS STREAMS/g, 'selects streams') }),
  },

  // ═══ §4 — THE LEADING QUESTION ═══════════════════════════════════════════
  {
    name: '§4 exactly one question leads, and it is the one that can retire the instrument',
    run: () => {
      const leaders = INTERROGATION_LIBRARY.filter((q) => q.leads)
      if (leaders.length !== 1) return `${leaders.length} questions claim the lead`
      return leaders[0].retiresTheInstrument
        ? null
        : 'the leading question cannot short-circuit the instrument, so leading buys nothing'
    },
  },
  {
    name: '§4 the leading question RUNS FIRST on every draft it fires on',
    run: () => {
      for (const [label, draft] of [['primary', PRIMARY_DRAFT], ['bare', BARE_DRAFT]] as const) {
        const firing = questionsFor(draft as DraftFacts)
        if (!firing.length) return `nothing fired on the ${label} draft`
        if (!firing[0].leads) return `on the ${label} draft the first question is ${firing[0].id}, which does not lead`
      }
      return null
    },
  },
  {
    name: '§9 the instrument question fires on EVERY primary-legislation draft',
    run: () => {
      const leader = INTERROGATION_LIBRARY.find((q) => q.leads)!
      if (!leader.firesWhen(PRIMARY_DRAFT)) return 'it does not fire on a primary-legislation draft'
      // …and on a draft that named no instrument at all, which is where a user is most
      // likely to drift into drafting a Bill by default.
      if (!leader.firesWhen(BARE_DRAFT)) return 'it does not fire when no instrument was named'
      return null
    },
  },
  {
    name: '§9 CONTROL — it does NOT fire once the draft has settled on a non-primary instrument',
    run: () => {
      const leader = INTERROGATION_LIBRARY.find((q) => q.leads)!
      return leader.firesWhen(DEVOLVED_DRAFT)
        ? 'it fires on a secondary-legislation draft too, so `firesWhen` is not deciding anything'
        : null
    },
  },
  {
    name: '§3 relevance is real: the devolution question does not fire on a reserved matter',
    run: () => {
      const devo = INTERROGATION_LIBRARY.find((q) => q.intents.includes('DEVOLUTION_SCOPE') && q.kind === 'CORPUS')
      if (!devo) return 'no devolution question in the library'
      if (devo.firesWhen(PRIMARY_DRAFT)) return 'it fires on a draft already established as reserved'
      if (!devo.firesWhen(DEVOLVED_DRAFT)) return 'CONTROL FAILED — it does not fire on a devolved draft either, so it never fires'
      return null
    },
  },
  {
    name: '§4 a question contributes terms of art of its own, and no two questions contribute the same set',
    run: () => {
      // ⚠⚠ 25-F §4 — THIS CHECK USED TO PASS ON A DEFECT IT WAS WRITTEN TO CATCH.
      //
      // It asserted `q.terms(PRIMARY_DRAFT).length > 8`, and every question passed —
      // because `withTerms` returned fourteen shared draft words PLUS the question's own
      // four or five, so the LENGTH was always comfortable while the CONTENT was 74%
      // identical across all nine. A count cannot see a shared prefix.
      //
      // It now tests the thing that matters: does this question contribute anything of
      // its own, and does it contribute something DIFFERENT from its neighbours.
      const corpusQs = INTERROGATION_LIBRARY.filter((q) => q.intents.length)
      const bare = corpusQs.filter((q) => (q.anchors ?? []).length < 3)
      if (bare.length) return `these contribute fewer than three terms of art: ${bare.map((q) => q.id).join(', ')}`
      const seen = new Map<string, string>()
      for (const q of corpusQs) {
        const key = [...q.anchors].map((t) => t.toLowerCase()).sort().join('|')
        const prev = seen.get(key)
        if (prev) return `${q.id} and ${prev} contribute an identical set of terms`
        seen.set(key, q.id)
      }
      return null
    },
  },

  // ═══ §7 — PERSPECTIVES ═══════════════════════════════════════════════════
  {
    name: '§7 perspectives are OFF by default',
    run: () => {
      const before = process.env.LEX_BUILD_PERSPECTIVES
      delete process.env.LEX_BUILD_PERSPECTIVES
      const n = perspectivesFor('RESEARCH').length
      if (before !== undefined) process.env.LEX_BUILD_PERSPECTIVES = before
      return n === 1 ? null : `${n} perspectives run with the flag unset`
    },
  },
  {
    name: '§7 perspectives NEVER apply to a drafting pass, even with the flag on',
    run: () => {
      const before = process.env.LEX_BUILD_PERSPECTIVES
      process.env.LEX_BUILD_PERSPECTIVES = 'true'
      const drafting = BUILD_PASSES.filter((p) => !p.coverage).map((p) => [p.key, perspectivesFor(p.key).length] as const)
      const coverage = BUILD_PASSES.filter((p) => p.coverage).map((p) => [p.key, perspectivesFor(p.key).length] as const)
      if (before === undefined) delete process.env.LEX_BUILD_PERSPECTIVES
      else process.env.LEX_BUILD_PERSPECTIVES = before

      const leaked = drafting.filter(([, n]) => n > 1)
      if (leaked.length) return `merging drafts: ${leaked.map(([k]) => k).join(', ')}`
      // And the control: the coverage passes MUST get more than one, or the flag is inert.
      const inert = coverage.filter(([, n]) => n <= 1)
      return inert.length ? `CONTROL FAILED — the flag does nothing on ${inert.map(([k]) => k).join(', ')}` : null
    },
  },
  {
    name: '§7 the merge PRESERVES a finding only one perspective produced',
    run: () => {
      const runs: PerspectiveRun[] = [
        {
          perspective: PERSPECTIVES[0],
          result: { findings: [{ kind: 'FINDING', title: 'Shared claim about section 45', body: 'a', sourceId: 's1' }], issues: [], answered: [], gaps: [] },
        },
        {
          perspective: PERSPECTIVES[1],
          result: {
            findings: [
              { kind: 'FINDING', title: 'Shared claim about section 45', body: 'a longer body', sourceId: 's1' },
              { kind: 'CONTRADICTS', title: 'Only this reading found the evaluation', body: 'b', sourceId: 's2' },
            ],
            issues: [], answered: [], gaps: [],
          },
        },
      ]
      const merged = mergePerspectives(runs)
      const solo = merged.findings.find((f) => f.sourceId === 's2')
      if (!solo) return 'the singleton finding was dropped by the merge — the point of §7 destroyed'
      if (!solo.unique) return 'the singleton was not marked unique, so nothing can surface it'
      if (merged.divergence.findingsUnique !== 1) return `divergence count is ${merged.divergence.findingsUnique}, expected 1`
      if (merged.divergence.findingsShared !== 1) return `shared count is ${merged.divergence.findingsShared}, expected 1`
      // The wording-proof denominator: s1 was read by both, s2 by one.
      if (merged.divergence.sourcesTotal !== 2) return `sourcesTotal is ${merged.divergence.sourcesTotal}, expected 2`
      if (merged.divergence.sourcesShared !== 1) return `sourcesShared is ${merged.divergence.sourcesShared}, expected 1`
      // Unique findings must sort FIRST — burying them is a quieter way of losing them.
      if (!merged.findings[0].unique) return 'unique findings are not surfaced first'
      // The fuller body wins on a merge.
      const shared = merged.findings.find((f) => f.sourceId === 's1')!
      if (shared.body !== 'a longer body') return 'the merge kept the shorter of two bodies'
      return null
    },
  },
  {
    name: '§7 a CONTRADICTS reading survives a merge with a neutral one',
    run: () => {
      const merged = mergePerspectives([
        { perspective: PERSPECTIVES[0], result: { findings: [{ kind: 'CONTRADICTS', title: 'Same claim here', body: 'x', sourceId: 's1' }], issues: [], answered: [], gaps: [] } },
        { perspective: PERSPECTIVES[1], result: { findings: [{ kind: 'FINDING', title: 'Same claim here', body: 'x', sourceId: 's1' }], issues: [], answered: [], gaps: [] } },
      ])
      return merged.findings[0].kind === 'CONTRADICTS'
        ? null
        : 'a neutral reading overwrote a contradicting one — the sceptical perspective silenced'
    },
  },
  {
    name: '§7 a perspective that FAILED is named, not absorbed',
    run: () => {
      const merged = mergePerspectives([
        { perspective: PERSPECTIVES[0], result: { findings: [], issues: [], answered: [], gaps: [] } },
        { perspective: PERSPECTIVES[1], result: null },
      ])
      if (!merged.divergence.perspectivesFailed.length) return 'a failed perspective left no trace'
      const line = divergenceLine(merged.divergence)
      return line && /did not complete/.test(line) ? null : 'the failure is not in the line the user reads'
    },
  },

  // ═══ §1 — PASS PER REQUEST ═══════════════════════════════════════════════
  {
    name: '§1 the engine runs ONE pass per request — no loop over every pass',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      return /for\s*\(\s*const\s+pass\s+of\s+BUILD_PASSES\s*\)/.test(build)
        ? 'build.ts still loops over every pass in one call, so the 300s ceiling still binds the whole build'
        : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': `${src['lib/lex/build.ts']}\nfor (const pass of BUILD_PASSES) { run(pass) }`,
    }),
  },
  {
    name: '§1 a 25-A four-pass log upgrades to the full set rather than becoming unreadable',
    run: () => {
      const old = [
        { key: 'ORIENT', status: 'DONE', carry: { orientation: 'terrain' } },
        { key: 'DIAGNOSIS', status: 'DONE', carry: { diagnosis: 'diag' } },
        { key: 'APPROACH', status: 'DONE', carry: { approach: 'app', instrument: 'primary legislation' } },
        { key: 'ACTIONS', status: 'DONE' },
      ]
      const log = readPassLog(old)
      if (log.length !== BUILD_PASSES.length) return `read ${log.length} passes, expected ${BUILD_PASSES.length}`
      if (passesComplete(log) !== 4) return 'the completed passes were lost in the upgrade'
      const next = nextPassKey(log)
      if (next !== 'RESEARCH') return `next pass is ${next}, expected the first 25-B pass`
      if (!isResumable(log)) return 'a half-finished 25-A build is not resumable'
      return null
    },
  },
  {
    name: '§1 the carry reaches the later passes, and a later pass overrides an earlier one',
    run: () => {
      const log = readPassLog([
        { key: 'ORIENT', status: 'DONE', carry: { orientation: 'terrain', searchFailed: false } },
        { key: 'DIAGNOSIS', status: 'DONE', carry: { diagnosis: 'FIRST' } },
        { key: 'APPROACH', status: 'DONE', carry: { approach: 'app', instrument: 'primary legislation' } },
        { key: 'ACTIONS', status: 'DONE' },
        { key: 'RESEARCH', status: 'DONE', carry: { research: 'findings' } },
        { key: 'REVISE', status: 'DONE', carry: { diagnosis: 'REVISED' } },
        { key: 'ADVERSARIAL', status: 'PENDING' },
      ])
      const intoResearch = carryInto(log, 'RESEARCH')
      if (intoResearch.diagnosis !== 'FIRST') return 'the research pass cannot see the drafted diagnosis'
      if (intoResearch.instrument !== 'primary legislation') return 'the research pass cannot see the instrument'
      const intoAdversarial = carryInto(log, 'ADVERSARIAL')
      if (intoAdversarial.diagnosis !== 'REVISED') return 'the adversarial pass reads the PRE-revision diagnosis'
      return null
    },
  },
  {
    name: '§1 a FAILED pass stops the build rather than being stepped over',
    run: () => {
      const log = readPassLog([
        { key: 'ORIENT', status: 'DONE' },
        { key: 'DIAGNOSIS', status: 'FAILED' },
        { key: 'APPROACH', status: 'PENDING' },
      ])
      return nextPassKey(log) === null ? null : 'the build would carry on past a failed pass'
    },
  },
  {
    name: '§1 a fresh build is NOT reported as resumable',
    run: () => (isResumable(freshPassLog()) ? 'a build that has done nothing claims to be resumable' : null),
  },
  {
    name: '§1 the settle RESUMES a stalled pass rather than only failing the build',
    run: (src) => {
      const settle = src['lib/lex/build-settle.ts']
      if (!/resumeStalledPasses/.test(settle)) return 'the settle has no resume path at all'
      if (!/status:\s*'PENDING'/.test(settle)) return 'nothing is ever reset to PENDING, so no pass can be picked up again'
      return /updatedAt/.test(settle)
        ? null
        : 'the abandoned check still ages off startedAt, which would kill a healthy multi-request build'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-settle.ts': src['lib/lex/build-settle.ts'].replace(/resumeStalledPasses/g, 'noop'),
    }),
  },
  {
    name: '§1 the client drives the next pass, and guards against stacking requests',
    run: (src) => {
      const client = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/nextPass/.test(client)) return 'the client never reads nextPass, so a build stops after one pass'
      return /drivingRef/.test(client) ? null : 'nothing stops a 3-second poll firing a POST per tick'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx'].replace(/drivingRef/g, 'x'),
    }),
  },
  {
    name: '§1 the server decides which pass runs — the client cannot name one',
    run: (src) => {
      const route = src['app/api/ideas/[id]/build/route.ts']
      // The body's `pass` may be validated and compared, but must never be handed to the
      // engine as the pass to run: that would let a stale client re-run a completed pass.
      return /runNextPass\([^)]*parsed\.data\.pass/.test(route)
        ? 'the client-supplied pass is passed to the engine'
        : null
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/build/route.ts': `${src['app/api/ideas/[id]/build/route.ts']}\nawait runNextPass(id, u, parsed.data.pass)`,
    }),
  },

  // ═══ §2 — REUSE, NOT REBUILD ═════════════════════════════════════════════
  {
    name: '§2 there is exactly ONE sift in the codebase',
    run: (src) => {
      const definers = Object.entries(src).filter(([, t]) => /export async function siftCandidates/.test(t))
      return definers.length === 1 && definers[0][0] === 'lib/lex/deepening-sift.ts'
        ? null
        : `sift defined in: ${definers.map(([f]) => f).join(', ') || '(nowhere)'}`
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': `${src['lib/lex/build-research.ts']}\nexport async function siftCandidates() {}`,
    }),
  },
  {
    name: '§2 there is exactly ONE adversarial reading, and the build imports it',
    run: (src) => {
      const definers = Object.entries(src).filter(([, t]) => /export async function generateAdversarialIssues/.test(t))
      if (definers.length !== 1 || definers[0][0] !== 'lib/lex/deepening-adversarial.ts') {
        return `adversarial defined in: ${definers.map(([f]) => f).join(', ') || '(nowhere)'}`
      }
      return /generateAdversarialIssues/.test(src['lib/lex/build.ts'])
        ? null
        : 'the build does not use it, so pass 5 is a second implementation somewhere'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/generateAdversarialIssues/g, 'ownAdversarial'),
    }),
  },
  {
    name: '§2 the build writes into the EXISTING evidence layer, not a new table',
    run: (src) => {
      const research = src['lib/lex/build-research.ts']
      if (!/prisma\.evidenceItem\.create/.test(research)) return 'findings are not written as EvidenceItem rows'
      if (!/supersedeOlderProposals/.test(research)) return 'a re-run does not supersede, so findings would accumulate silently'
      const invented = Object.entries(src).filter(([, t]) => /prisma\.buildFinding|prisma\.buildIssue|prisma\.researchFinding/.test(t))
      return invented.length ? `a second evidence layer appeared in ${invented.map(([f]) => f).join(', ')}` : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': `${src['lib/lex/build-research.ts']}\nawait prisma.buildFinding.create({})`,
    }),
  },

  // ═══ §5 — THE CONTRADICTIONS ═════════════════════════════════════════════
  {
    name: '§5 a contradiction is persisted, with the first conclusion kept',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      if (!/kind: 'CONTRADICTS'/.test(build)) return 'nothing is stored as a contradiction'
      for (const phrase of ['I first concluded', 'The evidence says', 'Why I changed my mind']) {
        if (!build.includes(phrase)) return `the stored contradiction does not carry "${phrase}"`
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/I first concluded/g, 'Updated'),
    }),
  },
  {
    name: '§5 a contradiction NEVER carries an invented citation',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      // Its source is the research pass, named in the body. Attaching a document citation
      // to a reasoning step is the never-claim breach the rest of the build refuses.
      const block = build.slice(build.indexOf("kind: 'CONTRADICTS'"), build.indexOf("kind: 'CONTRADICTS'") + 1400)
      return /sourceType: null, sourceId: null, citation: null/.test(block)
        ? null
        : 'the contradiction record does not explicitly null its citation fields'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(
        /sourceType: null, sourceId: null, citation: null/g, "citation: 'ibid'",
      ),
    }),
  },
  {
    name: '§5 the revision prompt refuses to treat an empty contradictions list as success',
    run: (src) => {
      const client = src['lib/lex/build-client.ts']
      return /EMPTY contradictions list is a strong claim/i.test(client)
        ? null
        : 'nothing pushes back on a revision that claims the research changed nothing'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts'].replace(/EMPTY contradictions list is a strong claim/gi, 'ok'),
    }),
  },

  // ═══ §8 — CEILINGS, SPEND AND FAILURE HONESTY ════════════════════════════
  {
    name: '§8 a per-pass ceiling exists and is BELOW the whole-build one',
    run: () => {
      if (!(PASS_COST_CEILING_PENCE > 0)) return 'the per-pass spend ceiling is not set'
      if (PASS_COST_CEILING_PENCE >= COST_CEILING_PENCE) {
        return `per-pass ${PASS_COST_CEILING_PENCE}p is not below the build's ${COST_CEILING_PENCE}p, so it can never fire first`
      }
      if (PASS_BUDGET_MS >= HARD_STOP_MS) return 'the pass time budget is not below the whole-build hard stop'
      // The pass budget must also stay under the platform's own 300s, with room to write
      // the failure — a pass killed before it can record why is the failure it prevents.
      return PASS_BUDGET_MS <= 285_000 ? null : `pass budget ${PASS_BUDGET_MS}ms exceeds the platform ceiling`
    },
  },
  {
    name: '§8 the per-pass ceilings are CHECKED, not merely declared',
    run: (src) => {
      const research = src['lib/lex/build-research.ts']
      if (!/PASS_COST_CEILING_PENCE/.test(research)) return 'the per-pass spend ceiling is never read'
      if (!/PASS_BUDGET_MS/.test(research)) return 'the per-pass time budget is never read'
      return /stoppedEarly\s*=\s*true/.test(research) ? null : 'nothing ever stops the pass, so both ceilings are decorative'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts'].replace(/PASS_BUDGET_MS/g, 'IGNORED'),
    }),
  },
  {
    name: '§8 hitting a PASS ceiling does not kill the build',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      // The research pass returns ok:true with `stoppedReason` folded into its carry —
      // losing the research is bad; losing passes 4 and 5 as well is worse.
      return /stoppedReason/.test(build) ? null : 'a pass that stopped early is not distinguishable from one that failed'
    },
    break: (src) => ({ ...src, 'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/stoppedReason/g, 'x') }),
  },
  {
    name: '§8 the spend is broken down by pass, and sums to the build total',
    run: () => {
      const log: PassRecord[] = readPassLog([
        { key: 'ORIENT', status: 'DONE', usages: [{ model: 'gemini-2.5-flash', tokensIn: 1000, tokensOut: 100 }] },
        { key: 'RESEARCH', status: 'DONE', usages: [{ model: 'gemini-2.5-flash', tokensIn: 4000, tokensOut: 400 }] },
      ])
      const total = priceBuild(allUsages(log))
      const perPass = log.map((p) => priceBuild(p.usages ?? []))
      const summedIn = perPass.reduce((n, p) => n + p.tokensIn, 0)
      if (summedIn !== total.tokensIn) return `per-pass tokens sum to ${summedIn}, the build reports ${total.tokensIn}`
      return total.tokensIn === 5000 ? null : `expected 5000 input tokens, got ${total.tokensIn}`
    },
  },
  {
    name: '§8 an unpriced model still costs null, never zero',
    run: () => {
      const p = priceBuild([{ model: 'a-model-with-no-rate', tokensIn: 10, tokensOut: 10 }])
      if (p.pence !== null) return `an unpriced call was priced at ${p.pence}`
      return p.unpriced.length ? null : 'the unpriced model is not named'
    },
  },
  {
    name: '§8 the three silences are kept apart in the research pass',
    run: (src) => {
      const research = src['lib/lex/build-research.ts']
      for (const kind of ['search-broke', 'corpus-silent', 'nothing-bore-on-it', 'gather-failed']) {
        if (!research.includes(kind)) return `"${kind}" is not a distinct outcome`
      }
      // And each must produce a DIFFERENT sentence, or naming them apart buys nothing.
      const sentences = research.match(/'The search for this question did not complete[^']*'|'The search ran and the corpus returned nothing[^']*'/g) ?? []
      return sentences.length >= 2 ? null : 'the distinct outcomes share their user-facing wording'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts'].replace(/'nothing-bore-on-it'/g, "'corpus-silent'"),
    }),
  },
  {
    name: '§8 the progress display shows the QUESTION being asked, not a spinner',
    run: (src) => {
      if (!/activity/.test(src['components/lex/BuildProgress.tsx'])) return 'the panel never renders an activity line'
      return /onActivity|activity:/.test(src['lib/lex/build-research.ts'])
        ? null
        : 'the research pass never writes what it is doing, so the line is always empty'
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildProgress.tsx': src['components/lex/BuildProgress.tsx'].replace(/activity/g, 'zzz'),
    }),
  },

  // ═══ §6 — THE ADVERSARIAL READ ═══════════════════════════════════════════
  {
    name: '§6 pass 5 reads the WHOLE kernel, not one pass\'s findings',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      return /COMPLETE proposal after research and revision/i.test(build)
        ? null
        : 'the clerk is not told it is reading the finished proposal'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/COMPLETE proposal after research and revision/gi, 'one pass'),
    }),
  },
  {
    name: '§6 the adversarial model is configurable, and named in what the user sees',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      if (!isBuildPassKey('ADVERSARIAL')) return 'there is no adversarial pass'
      if (!modelForPass('ADVERSARIAL')) return 'no model resolves for the adversarial pass'
      return /read by \$\{model\}/.test(build)
        ? null
        : 'the model is not named in the pass output, so a model comparison cannot be attributed'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/read by \$\{model\}/g, 'read'),
    }),
  },
  {
    name: '§6 a failed clerk is a FAILED pass, never an empty issues list',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      return /NOT AN EMPTY ISSUES LIST/i.test(build) && /adversarial reading did not complete/.test(build)
        ? null
        : 'a failed adversarial read could be presented as a proposal that survived one'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/adversarial reading did not complete/g, 'ok'),
    }),
  },

  // ═══ AMENDMENT_25B §B — THE WORKER ═══════════════════════════════════════
  {
    name: '§B the web request ENQUEUES and runs nothing under the worker driver',
    run: (src) => {
      const route = src['app/api/ideas/[id]/build/route.ts']
      if (!/buildDriver\(\) === 'client'/.test(route)) {
        return 'the route runs a pass unconditionally, so the request still does the work'
      }
      const build = src['lib/lex/build.ts']
      return /if \(buildDriver\(\) === 'worker'\)[\s\S]{0,400}return created\.id/.test(build)
        ? null
        : 'claimBuild still claims the row to RUNNING, so the worker will never see it queued'
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/build/route.ts': src['app/api/ideas/[id]/build/route.ts']
        .replace(/buildDriver\(\) === 'client'/g, 'true'),
    }),
  },
  {
    name: '§B the worker loop reads the STORED LOG, not the client-facing nextPass',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      // ⚠ THIS GUARD ENCODES A BUG THE CLOSED-TAB TEST CAUGHT ON 19 AUG. The first
      // version of runBuildToCompletion looped on `view.nextPass`, which is deliberately
      // NULL under the worker driver so a browser never drives a pass the worker owns —
      // so the worker ran exactly ONE pass and reported "stopped cleanly". The two
      // questions ("should the client ask for another" and "is there another") are not
      // the same question, and the engine must ask the second.
      const fn = build.slice(build.indexOf('export async function runBuildToCompletion'))
      const body = fn.slice(0, fn.indexOf('\n}\n') + 3)
      if (/while\s*\(\s*view\.nextPass/.test(body)) {
        return 'the worker loop conditions on view.nextPass, which is null under the worker driver — it will run one pass and stop'
      }
      return /nextPassKey\(readPassLog/.test(body)
        ? null
        : 'the loop does not read the stored pass log, so it cannot know whether work remains'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(
        /const remaining = async[\s\S]*?\n  \}\n/,
        'const remaining = async () => null\n',
      ).replace(/while \(next && guard/, 'while (view.nextPass && guard'),
    }),
  },
  {
    name: '§B a build cannot sit QUEUED for ever when no worker exists',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      // ⚠ THE FAILURE THE ARCHITECTURE CREATES. Enqueue-and-return means that with no
      // worker running — unprovisioned, crash-looping, paused on a usage limit — the row
      // sits at QUEUED and nothing ever happens, which is strictly worse than the design
      // it replaced. The page must take it over, and must SAY it has.
      if (!/workerLate/.test(build)) return 'nothing detects a build the worker never picked up'
      if (!/WORKER_PICKUP_GRACE_MS/.test(build)) return 'there is no grace period, so the fallback would race a healthy worker'
      const route = src['app/api/ideas/[id]/build/route.ts']
      // And the handover must be one-way: claim it off the queue before driving it, or a
      // worker starting up later takes the same build.
      return /claimQueuedBuild\(latest\.id\)/.test(route)
        ? null
        : 'the page drives a QUEUED build without claiming it, so a worker could take it too'
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/build/route.ts': src['app/api/ideas/[id]/build/route.ts']
        .replace(/claimQueuedBuild\(latest\.id\)/g, 'true'),
    }),
  },
  {
    name: '§B a build is SERIAL inside itself, so one build is one search in flight',
    run: (src) => {
      const research = src['lib/lex/build-research.ts']
      // §B's concurrency warning: the vector service handles four at once. A build that
      // fanned its questions out in parallel would be 9 searches from one user.
      if (/Promise\.all\([\s\S]{0,200}questions/.test(research)) {
        return 'the research pass fans its questions out in parallel'
      }
      return /for \(const q of questions\)/.test(research)
        ? null
        : 'the research pass no longer walks its questions one at a time'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts']
        .replace('for (const q of questions) {', 'await Promise.all(questions.map(async (q) => {'),
    }),
  },

  // ═══ AMENDMENT_25B §C/§C4 — TELLING THE USER, AND THE ESTIMATE ═══════════
  {
    name: '§C4 the estimate EXCLUDES builds that did not finish',
    run: (src) => {
      const est = src['lib/lex/build-estimate.ts']
      return /status: 'DONE'/.test(est)
        ? null
        : 'the estimate is taken over builds that failed, so a run of early failures would report "about a minute"'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-estimate.ts': src['lib/lex/build-estimate.ts'].replace(/status: 'DONE',/g, ''),
    }),
  },
  {
    name: '§C4 below the floor it says it does not know, rather than quoting a mean',
    run: () => {
      if (MIN_SAMPLE < 2) return `MIN_SAMPLE is ${MIN_SAMPLE} — one build would set the estimate`
      return MIN_SAMPLE >= 5 ? null : `MIN_SAMPLE is ${MIN_SAMPLE}, below the five the brief asks for`
    },
  },
  {
    name: '§C4 the figure is rounded to something a human says',
    run: () => {
      // "About 7 minutes", not "6.8 minutes".
      const cases: Array<[number, string]> = [
        [45, 'about a minute'],
        [408, 'about 7 minutes'],      // 6.8 minutes
        [409, 'about 7 minutes'],
        [1020, 'about 15 minutes'],    // 17 → nearest 5
      ]
      for (const [secs, want] of cases) {
        const got = humaniseSeconds(secs)
        if (got !== want) return `${secs}s rendered as "${got}", expected "${want}"`
      }
      // And no decimal ever reaches the user.
      for (const s of [61, 100, 250, 500, 1000, 2000]) {
        if (/\d+\.\d/.test(humaniseSeconds(s))) return `${s}s produced false precision: ${humaniseSeconds(s)}`
      }
      return null
    },
  },
  {
    name: '§C4 the email is offered on length, and not for a short build',
    run: () => {
      if (EMAIL_OFFER_SECONDS < 60) return `the offer threshold is ${EMAIL_OFFER_SECONDS}s — it would offer for everything`
      return EMAIL_OFFER_SECONDS <= 300 ? null : `the threshold is ${EMAIL_OFFER_SECONDS}s, so a long build would never offer`
    },
  },
  {
    name: '§C4 the choice is frozen on the build row, not read from the user at send time',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      if (!/notifyEmail: wantsEmail/.test(build)) return 'the choice is not stored on the build row'
      // The send path must read the ROW's flag. Reading the user's preference there would
      // make a change in another tab retroactive to a build already running.
      return /if \(!row\.notifyEmail\) return/.test(build)
        ? null
        : 'the send path does not gate on the row, so the preference would be retroactive'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/if \(!row\.notifyEmail\) return/g, 'if (false) return'),
    }),
  },
  {
    name: '§C4 a build that stopped early emails too',
    run: (src) => {
      const build = src['lib/lex/build.ts']
      // notifyByEmail is called from settleBuild, which is every terminal path — DONE,
      // FAILED and CANCELLED alike. Only telling people about success is how someone
      // waits ten minutes for something that stopped after two.
      return /await notifyByEmail\(row, status\)/.test(build)
        ? null
        : 'the email is not sent from the one place every terminal path goes through'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace('await notifyByEmail(row, status)', "if (status === 'DONE') await notifyByEmail(row, status)")
        .replace(/await notifyByEmail\(row, status\)/, 'noop()'),
    }),
  },
  {
    name: '§C the notification fires on an observed TRANSITION, never on what was found',
    run: (src) => {
      const client = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/lastStatusRef/.test(client)) return 'nothing tracks the previous status, so opening a finished build would notify'
      return /const wasRunning =/.test(client) && /if \(!wasRunning \|\| !hasFinished\) return/.test(client)
        ? null
        : 'the notification does not require a running-to-finished transition'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace('if (!wasRunning || !hasFinished) return', 'if (!hasFinished) return'),
    }),
  },
  {
    name: '§C the permission is NOT requested on page load',
    run: (src) => {
      const client = src['app/ideas/build/BuildIdeaClient.tsx']
      // A prompt before the user has asked for anything gets dismissed, and a dismissal is
      // permanent — `Notification.permission` becomes "denied" and cannot be asked again.
      const start = client.indexOf('const startBuild = useCallback')
      const idx = client.indexOf('Notification.requestPermission')
      if (idx < 0) return 'the permission is never requested at all'
      return idx > start
        ? null
        : 'requestPermission is called outside startBuild — a prompt on load is dismissed and cannot be re-asked'
    },
  },

  // ═══ Passes as configuration ═════════════════════════════════════════════
  {
    name: 'the three new passes exist and each declares its label and detail',
    run: () => {
      for (const key of ['RESEARCH', 'REVISE', 'ADVERSARIAL'] as const) {
        const def = passDef(key)
        if (!def) return `${key} is not configured`
        if (!def.label?.trim() || !def.detail?.trim()) return `${key} has no label or detail for the progress display`
      }
      // ⚠ 25-F ADDED THREE (SMART, KERNEL_CHECK, LOGIC_CHECK), so this reads 10.
      //
      // The literal is kept rather than removed. Its job is not to know the number: it is
      // to make a pass appearing or disappearing a DELIBERATE act, because `readPassLog`
      // reconciles a stored log against this array and a pass added by accident changes
      // what every historic build reports about itself.
      return BUILD_PASSES.length === 10 ? null : `${BUILD_PASSES.length} passes configured, expected 10`
    },
  },
  {
    name: 'the house perspective is the first one, so a single-perspective run is named',
    run: () => (PERSPECTIVES[0]?.id === HOUSE_PERSPECTIVE.id ? null : 'the default run is not the house perspective'),
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0
  let fail = 0
  let uncontrolled = 0

  console.log(`── check:build-25b${selfTest ? ' --self-test' : ''} ──`)

  for (const c of CHECKS) {
    const err = c.run(src)
    if (err) { fail++; console.log(`  ✗  ${c.name}\n       ${err}`); continue }
    pass++
    console.log(`  ✓  ${c.name}`)

    if (!selfTest) continue
    if (!c.break) {
      uncontrolled++
      console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported code, not source text')
      continue
    }
    const broken = c.run(c.break(src))
    if (broken) console.log(`       ↳ control OK — rejects the corrupted source`)
    else { fail++; console.log(`       ✗ CONTROL FAILED — the corrupted source PASSES, so this check proves nothing`) }
  }

  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  if (selfTest && uncontrolled) {
    console.log('⚠ The uncontrolled checks run against imported code and cannot be corrupted from here.')
    console.log('  They are REPORTED, not counted as controlled — an untestable control quietly')
    console.log('  counted as a pass is what this harness exists to prevent.')
  }
  process.exit(fail ? 1 : 0)
}

main()
