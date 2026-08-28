// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25m — the outputs, the snapshot, and the pilot allowance.
//
// ⚠ THE ASSERTIONS THIS FILE EXISTS FOR ARE THE TWO THAT COST MONEY IF THEY ROT:
//
//   1. A FAILED BUILD DOES NOT SPEND THE ALLOWANCE. Charlie's decision, and the tie-break
//      matters more than the rule — ambiguous is NOT spent. Asserted by running the pricing
//      over every status, including a status that does not exist yet.
//   2. THE COUNTER IS NOT `LlmSpend`. §4 said it should be; the data says it cannot be
//      (2,702 rows, 2 with a userId). A future edit "restoring" the brief's wording would
//      hand out unlimited free builds and nothing would look wrong.
//
// Offline: no database, no API key, no network.
//
//   npm run check:lex-25m
//   npm run check:lex-25m -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertReachable } from './reachability'
import { HEADING_ORDER } from '../lib/lex/question-headings'
import { FULL_BUILD_THIRDS, REUSE_BUILD_THIRDS } from '../lib/lex/allowance'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').split('\r\n').join('\n')

/**
 * ⚠ COMMENTS OUT, BEFORE ANY GREP. A guard almost always lives beside a comment explaining
 * the rule it enforces, and that comment contains the forbidden string — five instances in
 * one day on 17 Aug 2026 (docs/CLAUDE.md §23's register, fourth shape). This file's own first
 * run flagged `allowance.ts` for "counting LlmSpend" on the strength of the paragraph
 * explaining why it does not.
 */
const strip = (s: string) => s
  .split(/\/\*[\s\S]*?\*\//).join(' ')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
  control?: () => string | null
}

const FILES = [
  'lib/lex/allowance.ts',
  'lib/lex/build.ts',
  'lib/documents/proposal-snapshot.ts',
  'lib/documents/build-proposal.ts',
  'components/lex/OutputsPanel.tsx',
  'components/lex/QuestionPanel.tsx',
  'components/lex/RerunDialogue.tsx',
  'app/api/ideas/[id]/build/route.ts',
  'app/api/admin/allowance/route.ts',
  'app/ideas/build/BuildIdeaClient.tsx',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/**
 * The spend rule, as a pure function, so it can be run over every status including one
 * nobody has invented yet.
 *
 * ⚠ IT MIRRORS `readAllowance`'s WHERE CLAUSE. That is a duplication and it is the point:
 * the check has to be able to state the rule independently of the query, or it is asserting
 * that the query equals itself.
 */
function spendFor(status: string, mode: string): number {
  if (status !== 'DONE') return 0
  return mode === 'REUSE' ? REUSE_BUILD_THIRDS : FULL_BUILD_THIRDS
}

const CHECKS: Check[] = [
  // ═══ §4 — THE ALLOWANCE ══════════════════════════════════════════════════
  {
    name: '§4 a FAILED build does not spend the allowance — and neither does anything ambiguous',
    // ⚠⚠ CHARLIE'S DECISION, AND THE TIE-BREAK IS THE PART THAT NEEDS GUARDING. "Failed does
    // not spend" is easy to keep; "ambiguous does not spend" is what a deny-list would
    // silently break the day somebody adds a status.
    run: () => {
      for (const st of ['FAILED', 'CANCELLED', 'QUEUED', 'RUNNING', 'SOME_FUTURE_STATUS']) {
        if (spendFor(st, 'FULL') !== 0) return `${st} spends the allowance`
        if (spendFor(st, 'REUSE') !== 0) return `${st} spends the allowance`
      }
      if (spendFor('DONE', 'FULL') !== FULL_BUILD_THIRDS) return 'a completed full build is not charged'
      if (spendFor('DONE', 'REUSE') !== REUSE_BUILD_THIRDS) return 'a completed re-run is not charged'
      if (REUSE_BUILD_THIRDS >= FULL_BUILD_THIRDS) return 'a re-run does not cost less than a full build'
      return null
    },
    control: () => {
      // A deny-list — the version that breaks on the next status added.
      const denyList = (status: string) => (['FAILED', 'CANCELLED'].includes(status) ? 0 : FULL_BUILD_THIRDS)
      return denyList('SOME_FUTURE_STATUS') === 0 ? null : 'rejected'
    },
  },
  {
    name: '§4 the counter reads IdeaBuild, NOT LlmSpend',
    // ⚠⚠ §4 SAYS LlmSpend AND THE DATA SAYS IT CANNOT BE. Measured 28 Aug 2026: 2,702 rows,
    // 2 with a userId, and every build-stream row sampled had none — `SpendAttribution` is
    // optional and the build passes have never passed it. An allowance counted there reads
    // ZERO for everybody and hands out unlimited free builds, which is the exact failure the
    // allowance exists to prevent, shipped as a feature.
    run: (src) => {
      // ⚠ COMMENTS STRIPPED FIRST. The un-stripped version fired on this module's own header,
      // which explains at length why it does NOT count LlmSpend — the "guard that fires on
      // its own prose" shape (docs/CLAUDE.md §23's register, fourth entry).
      const a = strip(src['lib/lex/allowance.ts'])
      if (/prisma\.llmSpend/i.test(a)) return 'the allowance counts LlmSpend — it carries no userId for builds'
      if (!/prisma\.ideaBuild\.findMany/.test(a)) return 'the allowance does not count builds'
      // The allow-list, in the query itself.
      return /status: 'DONE'/.test(a) ? null : 'the query does not restrict to DONE'
    },
    break: (src) => ({
      ...src,
      'lib/lex/allowance.ts': src['lib/lex/allowance.ts']
        .replace('prisma.ideaBuild.findMany', 'prisma.llmSpend.findMany'),
    }),
  },
  {
    name: '§4 the hard stop is at the WRITE PATH, not only where the UI reads it',
    // ⚠ A ceiling enforced only in `buildState` is a ceiling a second caller walks through —
    // the worker, a script, a stale tab, a repeated POST. The button being grey is not the
    // control; `claimBuild` refusing is.
    run: (src) => {
      const b = src['lib/lex/build.ts']
      if (!/await allowanceBlock\(/.test(b)) return 'claimBuild does not check the allowance'
      if (!/throw new BuildAllowanceSpent/.test(b)) return 'it does not refuse'
      // And the route answers 402 rather than 500 — the product working, not failing.
      return /BuildAllowanceSpent[\s\S]{0,200}?status: 402/.test(src['app/api/ideas/[id]/build/route.ts'])
        ? null
        : 'a spent allowance surfaces as a generic error'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('await allowanceBlock(').join('await Promise.resolve(null as string | null); void ('),
    }),
  },
  {
    name: '§4 the balance shows BEFORE a build starts, and an admin grant is accountable',
    run: (src) => {
      if (!/allowanceLine/.test(src['components/lex/RerunDialogue.tsx'])) {
        return 'the balance is not shown beside the cost line'
      }
      const admin = src['app/api/admin/allowance/route.ts']
      // ⚠ SETS, DOES NOT INCREMENT: "add 3" applied twice by a double-clicked button gives 6.
      if (/increment:/.test(admin)) return 'the grant increments — a double click doubles it'
      // ⚠ A NOTE IS REQUIRED. An unaccountable grant is what this prevents.
      if (!/note: z\.string\(\)\.trim\(\)\.min\(3\)/.test(admin)) return 'a grant can be made with no reason'
      return /activityLog\.create/.test(admin) ? null : 'the grant is not logged'
    },
    break: (src) => ({
      ...src,
      'app/api/admin/allowance/route.ts': src['app/api/admin/allowance/route.ts']
        .replace('note: z.string().trim().min(3)', 'note: z.string().trim().min(0)'),
    }),
  },

  // ═══ §3 — THE SNAPSHOT ═══════════════════════════════════════════════════
  {
    name: '§3 the snapshot carries the panel material, LABELLED rather than promoted',
    // ⚠⚠ THE SNAPSHOT TOOK `status: 'ACCEPTED'` ONLY — right in principle and it meant the
    // evidence array came back EMPTY for the only built idea in the database, because nothing
    // has ever been accepted. So §2b's write-up would have contained none of the panel's
    // material, and an empty array renders as a document with no findings section rather
    // than as an error.
    run: (src) => {
      const s = src['lib/documents/proposal-snapshot.ts']
      if (/where: \{ ideaId, status: 'ACCEPTED' \}/.test(s)) {
        return 'the snapshot still takes ACCEPTED only — the write-up would be empty'
      }
      if (!/status: \{ not: 'REJECTED' \}/.test(s)) return 'REJECTED findings are no longer excluded'
      // ⚠ AND THE STATUS TRAVELS, or the renderer cannot say whose the finding is and the
      // widening above becomes the silent promotion it must not be.
      return /status: e\.status/.test(s) ? null : 'the review status does not reach the renderer'
    },
    break: (src) => ({
      ...src,
      'lib/documents/proposal-snapshot.ts': src['lib/documents/proposal-snapshot.ts']
        .replace("status: { not: 'REJECTED' }", "status: 'ACCEPTED'"),
    }),
  },
  {
    name: '§3 no renderer reads anything but the snapshot',
    // The seam that has kept the document stack stable through six sprints of change.
    run: () => {
      // ⚠ THE PROPOSAL RENDERERS ONLY. `build-initial-background.ts` is an ASSEMBLER for a
      // different document (the stage briefing) and reads the database by design; the first
      // version of this check listed it as a renderer and failed on correct code.
      // `check:20bd` owns the general rule over its own, accurate, list of five.
      const renderers = ['lib/documents/build-proposal.ts', 'lib/documents/build-evidence-pack.ts']
      for (const r of renderers) {
        const s = strip(read(r))
        if (/from '@?\.{0,2}\/?lib\/prisma'|from '\.\.\/prisma'/.test(s)) return `${r} imports prisma`
        if (/deepening|lex-client|orchestrator/.test(s)) {
          return `${r} reaches into a mid-flight Lex module`
        }
      }
      return null
    },
    control: () => (/from '@\/lib\/prisma'/.test("import { prisma } from '@/lib/prisma'") ? 'rejected' : null),
  },

  // ═══ §2b — THE FULL WRITE-UP ═════════════════════════════════════════════
  {
    name: '§2b the write-up carries every panel section, in the PANEL\'s order',
    run: (src) => {
      const d = src['lib/documents/build-proposal.ts']
      if (!/function panelBlocks/.test(d)) return 'the panel sections are not rendered at all'
      if (!/for \(const key of HEADING_ORDER\)/.test(d)) return 'the sections are not in the panel’s order'
      // ⚠ THE VOCABULARY IS IMPORTED, NEVER RESTATED. A document that listed its own headings
      // would drift from the screen the proposer worked on.
      if (!/from '\.\.\/lex\/question-headings'/.test(d)) return 'the headings are restated rather than imported'
      // ⚠ AND AN UNREVIEWED FINDING IS LABELLED.
      return /not yet reviewed/.test(d) ? null : 'an unreviewed finding is published as the proposer’s'
    },
    break: (src) => ({
      ...src,
      'lib/documents/build-proposal.ts': src['lib/documents/build-proposal.ts']
        .split('not yet reviewed').join(''),
    }),
  },

  // ═══ §1 — OUTPUTS IN THE PANEL ═══════════════════════════════════════════
  {
    name: '§1 Outputs is in the contents, and there is ONE generator',
    run: (src) => {
      const q = src['components/lex/QuestionPanel.tsx']
      if (!/setOpenKey\('__outputs'\)/.test(q)) return 'Outputs is not on the contents list'
      if (!/<OutputsPanel ideaId=\{ideaId\} \/>/.test(q)) return 'the item opens nothing'
      // ⚠⚠ ONE GENERATOR, TWO DOORS. A second renderer would drift, and the two doors would
      // then disagree about what the proposal says — worse than the friction §1 removes.
      const o = src['components/lex/OutputsPanel.tsx']
      if (!/\/api\/ideas\/\$\{ideaId\}\/document`/.test(o)) return 'the panel does not call the existing endpoint'
      if (/buildProposalDocument|renderPdf|renderDocx/.test(o)) return 'the panel renders documents itself — that is a second generator'
      // §1 — "when each was last generated", the staleness fingerprint.
      return /d\.stale/.test(o) ? null : 'the panel does not say whether a document is out of date'
    },
    break: (src) => ({
      ...src,
      'components/lex/QuestionPanel.tsx': src['components/lex/QuestionPanel.tsx']
        .split("setOpenKey('__outputs')").join('void 0'),
    }),
  },
  {
    name: '§1 the contents list is hidden when an item is open',
    // ⚠ Gated on `openKey`, not `openHeading`. The two special items set a key that matches
    // no heading, so a `!openHeading` gate left the whole contents list rendering UNDERNEATH
    // them — introduced with `__unfiled` in 25-L and found when Outputs became the second.
    run: (src) => (/\{!openKey && \(/.test(src['components/lex/QuestionPanel.tsx'])
      ? null
      : 'the contents list renders under the open item'),
    break: (src) => ({
      ...src,
      'components/lex/QuestionPanel.tsx': src['components/lex/QuestionPanel.tsx']
        .replace('{!openKey && (', '{!openHeading && ('),
    }),
  },

  // ═══ REACHABILITY (docs/CLAUDE.md §23.1) ═════════════════════════════════
  {
    name: '§23.1 every component this sprint adds is REACHABLE from a route',
    run: () => {
      const dead = ['components/lex/OutputsPanel.tsx'].map((f) => assertReachable(f)).filter(Boolean)
      return dead.length ? dead.join('\n       ') : null
    },
    control: () => (assertReachable('components/ui/Navbar.tsx') ? 'rejected' : null),
  },
  {
    name: 'the heading vocabulary the document reads is the one the panel renders',
    run: () => (HEADING_ORDER.length === 13 ? null : `${HEADING_ORDER.length} headings, expected 13`),
    control: () => (HEADING_ORDER.length === 12 ? null : 'rejected'),
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25m${selfTest ? ' --self-test' : ''} ──`)
  for (const c of CHECKS) {
    let err: string | null
    try { err = c.run(src) } catch (e) {
      err = `the check itself threw: ${e instanceof Error ? e.message : String(e)}`
    }
    if (err) { fail++; console.log(`  ✗  ${c.name}\n       ${err}`); continue }
    pass++
    console.log(`  ✓  ${c.name}`)
    if (!selfTest) continue
    if (!c.break && !c.control) {
      uncontrolled++; console.log('       ⚠ NO NEGATIVE CONTROL'); continue
    }
    let broken: string | null
    try { broken = c.control ? c.control() : c.run(c.break!(src)) } catch { broken = 'threw' }
    if (broken) console.log('       ↳ control OK — rejects the broken version')
    else { fail++; console.log('       ✗ CONTROL FAILED — the broken version PASSES') }
  }
  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  process.exit(fail ? 1 : 0)
}

main()
