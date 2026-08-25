// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25f — the Sprint 25-F guards.
//
// Same contract as check:build-25a and 25b: EVERY ASSERTION THAT CAN HAVE A NEGATIVE
// CONTROL HAS ONE, and `--self-test` runs them. A guard that cannot fail is not a guard
// (docs/CLAUDE.md — "a check that cannot fail", nine recorded shapes and counting).
//
// ⚠ THE MOST IMPORTANT CHECK IN THIS FILE IS THE ONE THAT RUNS THE REAL HISTORIC QUERY.
// §4's rule — "no issued query ends mid-token or is a stopword-bearing keyword dump" —
// is only worth anything if the query that shipped on 22 August FAILS it. So it is here,
// verbatim from `docs/LEX_FIRST_BUILD_KERNEL.md` line 255, and the check asserts it is
// REJECTED. An assertion tested only against a made-up bad example is an assertion
// tuned to a made-up bad example.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:lex-25f
//   npm run check:lex-25f -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUILD_PASSES, passDef, modelForPass, type BuildPassKey } from '../lib/lex/build-config'
import { INTERROGATION_LIBRARY } from '../lib/lex/interrogation-library'
import { queryDefects, queryIsWellFormed, QUERY_STOPWORDS, extractedQuery } from '../lib/lex/build-query'
import { KERNEL_TESTS, CHEAPEST_MODEL, verifyModel, complianceIssueText, logicIssueText } from '../lib/lex/build-verify'
import { smartPanelModels, smartCritiqueModel, PAGE_ONE_CAP, normalisePanelAnswer } from '../lib/lex/build-smart'
import { DEFAULT_DOOR, doorPath, isNewIdeaDoor, NEW_IDEA_PATH, NEW_IDEA_DOOR_KEY } from '../lib/lex/new-idea-door'
import { TESTIMONY_INSTRUCTION, bearsTestimonyMarks, testimonyBlock } from '../lib/lex/testimony'

/** CRLF normalised on read — see the note in check-build-25b.ts. */
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>

interface Check {
  name: string
  run: (src: Sources) => string | null
  /** The negative control: a corrupted source bag `run` MUST reject. */
  break?: (src: Sources) => Sources
}

const FILES = [
  'lib/lex/build.ts',
  'lib/lex/build-config.ts',
  'lib/lex/build-carry.ts',
  'lib/lex/build-client.ts',
  'lib/lex/build-research.ts',
  'lib/lex/build-query.ts',
  'lib/lex/build-smart.ts',
  'lib/lex/build-verify.ts',
  'lib/lex/build-highlights.ts',
  'lib/lex/testimony.ts',
  'lib/lex/field-machine.ts',
  'lib/lex/interrogation-library.ts',
  'lib/lex/new-idea-door.ts',
  'app/ideas/new/page.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/build/page.tsx',
  'components/lex/BuildFindings.tsx',
  'components/lex/BuildProgress.tsx',
  'components/lex/RecentIdeasPanel.tsx',
  'components/PublicNav.tsx',
  'components/ui/Navbar.tsx',
  'app/dashboard/DashboardClient.tsx',
  'app/page.tsx',
  'app/ideas/page.tsx',
  'app/ideas/[id]/IdeaDetailClient.tsx',
  'lib/email.ts',
  'app/api/admin/config/route.ts',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/**
 * ⚠ THE REAL QUERY, FROM THE FIRST BUILD EVER RUN.
 *
 * `docs/LEX_FIRST_BUILD_KERNEL.md` line 255, `IdeaBuild.queryUsed`, build a7f7151c,
 * 22 August 2026. The brief reads this as truncated mid-word at "pr"; it is not — that is
 * where the brief's own blockquote wrapped, and the stored value continues
 * "…system private care homes northern lack :: context(1359 chars)". What IS wrong with it
 * is everything else, and this is the check that has to reject it.
 */
const HISTORIC_QUERY = [
  'civil', 'service', 'public', 'failure', 'accountability', 'responsibility', 'cost',
  'deliver', 'sector', 'process', 'accountable', 'those', 'system', 'private', 'care',
  'homes', 'northern', 'lack',
]

/** A query as §4 wants them written: terms of art, a phrase, no stopwords. */
const WRITTEN_QUERY = [
  'Accounting Officer', 'Carltona principle', 'Osmotherly Rules',
  'senior responsible owner', 'accounting direction', 'ministerial accountability',
]

const CHECKS: Check[] = [
  // ═══ §4 — A QUERY IS WRITTEN, NOT EXTRACTED ══════════════════════════════
  {
    name: '§4 the query that actually shipped is REJECTED by the rule this sprint adds',
    run: () => {
      const defects = queryDefects(HISTORIC_QUERY)
      if (!defects.length) return 'the historic bag-of-words query passes — the rule catches nothing'
      const kinds = new Set(defects.map((d) => d.kind))
      if (!kinds.has('stopword')) return `it is rejected, but not for its stopwords (got: ${[...kinds].join(', ')})`
      if (!kinds.has('keyword-dump')) return `it is rejected, but not as a keyword dump (got: ${[...kinds].join(', ')})`
      return null
    },
  },
  {
    name: '§4 CONTROL — a written query with terms of art PASSES, so the rule is not "reject everything"',
    run: () => {
      const defects = queryDefects(WRITTEN_QUERY)
      return defects.length
        ? `a well-formed query was rejected: ${defects.map((d) => d.detail).join('; ')}`
        : null
    },
  },
  {
    name: '§4 a term truncated mid-word is caught, even beside its own full form',
    run: () => {
      // The shape a character-limit slice leaves behind — `pr` beside `process`.
      const d = queryDefects(['accountability', 'process', 'pr'])
      return d.some((x) => x.kind === 'mid-token') ? null : 'a mid-token fragment was accepted'
    },
  },
  {
    name: '§4 an empty query is a failure, not a search of everything',
    run: () => (queryDefects([]).some((d) => d.kind === 'empty') ? null : 'an empty query was accepted'),
  },
  {
    name: '§4 the stopword list contains the word that actually shipped ("those")',
    run: () => (QUERY_STOPWORDS.has('those') ? null : '"those" is not a stopword, which is how it reached a live query'),
  },
  {
    name: '§4 the extraction fallback MARKS ITSELF, so it cannot pass as a written query',
    run: () => {
      const q = extractedQuery('X', 'accountability responsibility civil service delivery failure')
      if (q.provenance !== 'extracted') return 'the fallback claims to be written'
      if (!/did not produce/i.test(q.purpose)) return 'the fallback does not say why it is a fallback'
      return null
    },
  },
  {
    name: '§4 the research pass issues the WRITTEN query, not the draft term extraction',
    run: (src) => {
      const s = src['lib/lex/build-research.ts']
      if (!/writeQueries\(/.test(s)) return 'the research pass never calls the query writer'
      if (!/const keywords = query\.terms/.test(s)) return 'retrieval does not use the written query'
      if (/q\.terms\(facts\)/.test(s)) return 'the old term-extraction call is still the query'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts']
        .replace('const keywords = query.terms', 'const keywords = q.terms(facts)'),
    }),
  },
  {
    name: '§4 no question in the library builds its query by counting the draft\'s own words',
    run: (src) => {
      const s = src['lib/lex/interrogation-library.ts']
      // ⚠ THE IMPORT, NOT THE WORD. The first version of this assertion matched
      // `termsFrom` anywhere in the file and failed on the COMMENT that records why the
      // call was removed — a check that forbids explaining a defect is a check that will
      // be answered by deleting the explanation. A module that cannot import it cannot
      // call it.
      if (/import\s*\{[^}]*\btermsFrom\b[^}]*\}\s*from/.test(s)) {
        return 'the library still imports termsFrom — the bag of words is one line from being back'
      }
      const bad = INTERROGATION_LIBRARY.filter((q) => !Array.isArray(q.anchors) || q.anchors.length < 3)
      return bad.length ? `these declare fewer than three terms of art: ${bad.map((q) => q.id).join(', ')}` : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/interrogation-library.ts':
        `import { termsFrom } from './build-config'\n${src['lib/lex/interrogation-library.ts']}`,
    }),
  },
  {
    name: '§4 every query a pass issues is recorded on the pass, not just pass 1\'s on the row',
    run: (src) => {
      if (!/queries\?: IssuedQuery\[\]/.test(src['lib/lex/build-carry.ts'] ?? read('lib/lex/build-carry.ts'))) {
        return 'the pass log has nowhere to record what was asked'
      }
      const s = src['lib/lex/build.ts']
      if (!/writePass\(c\.buildId, 'RESEARCH', \{ queries:/.test(s)) return 'the research pass does not record its queries'
      if (!/writePass\(buildId, 'ORIENT', \{ queries:/.test(s)) return 'the orient pass does not record its query'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace(/await writePass\(c\.buildId, 'RESEARCH', \{ queries: outcome\.queries \}\)/, ''),
    }),
  },

  // ═══ §5 — THE TESTIMONY ══════════════════════════════════════════════════
  {
    name: '§5 the testimony instruction is POSITIVE, not only a prohibition',
    run: () => {
      if (!/there to be USED/i.test(TESTIMONY_INSTRUCTION)) return 'nothing tells the model to use it'
      if (!/ATTRIBUTE IT/i.test(TESTIMONY_INSTRUCTION)) return 'nothing asks for attribution'
      if (!/NEVER A CITATION/i.test(TESTIMONY_INSTRUCTION)) return 'the never-claim half has been lost'
      return null
    },
  },
  {
    name: '§5 every drafting pass carries it — it is in GROUNDING, which they all include',
    run: (src) => {
      const s = src['lib/lex/build-client.ts']
      if (!/TESTIMONY_INSTRUCTION,\n\]\.join/.test(s)) return 'GROUNDING no longer carries the instruction'
      const passes = ['ORIENT', 'DIAGNOSIS', 'APPROACH', 'ACTIONS', 'REVISE']
      const groundingUses = (s.match(/GROUNDING/g) ?? []).length
      // One declaration plus one use per drafting pass.
      return groundingUses >= passes.length + 1
        ? null
        : `GROUNDING appears ${groundingUses} times; ${passes.length + 1} expected`
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts'].replace(/TESTIMONY_INSTRUCTION,\n\]\.join/, '\n].join'),
    }),
  },
  {
    name: '§5 it now reaches the sift, the gather and the hostile clerk, which never saw it',
    run: (src) => {
      const research = src['lib/lex/build-research.ts']
      if (!/idea: ideaWithTestimony/.test(research)) return 'the sift still runs on the drafted kernel alone'
      if (!/testimony: string/.test(research)) return 'the research pass does not take the testimony'
      const build = src['lib/lex/build.ts']
      if (!/testimonyForPrompt\(c\.ctx/.test(build)) return 'the adversarial pass still reads no testimony'
      if (!/testimonyForFacts\(c\.ctx\)/.test(build)) return 'the research pass is not handed the testimony'
      return null
    },
    break: (src) => ({
      ...src,
      // ⚠ `split().join()`, NOT `.replace()`. A string `.replace` changes the FIRST match
      // only — and this symbol appears twice (the sift and the gather), so the first
      // version of this control left the second one standing and the corrupted source
      // passed. That is the control-that-cannot-fail shape, inside the control.
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts']
        .split('ideaWithTestimony').join('facts.text'),
    }),
  },
  {
    name: '§5 CONTROL — the attribution test rejects an unattributed passage and accepts an attributed one',
    run: () => {
      if (bearsTestimonyMarks('Incentives encourage the diffusion of responsibility.')) {
        return 'an abstraction with no attribution reads as attributed'
      }
      if (!bearsTestimonyMarks('The proposer reports waiting four years for a decision.')) {
        return 'an attributed sentence does not read as attributed'
      }
      return null
    },
  },

  // ═══ §6 — THE THREE DEFECTS ══════════════════════════════════════════════
  {
    name: '§6a no loop field is left claiming an empty proposal',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (/setProposal\([^)]*\{ value: '' \}/.test(s)) return 'a field still enters AWAITING_CONFIRMATION with an empty proposal'
      if (!/setLoopProposal\(ideaId, 'causes'/.test(s)) return 'the causes loop does not render its child rows'
      if (!/setLoopProposal\(ideaId, 'actions'/.test(s)) return 'the actions loop does not render its child rows'
      if (!/setLoopProposal\(ideaId, 'policyOptions'/.test(s)) return 'the options loop does not render its child rows'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace(/await setLoopProposal\(ideaId, 'causes'[^\n]*\n/, "await setProposal(ideaId, 'causes', { value: '' })\n"),
    }),
  },
  {
    name: '§6a setLoopProposal REFUSES to write a proposal with nothing in it',
    run: (src) => {
      const s = src['lib/lex/field-machine.ts']
      if (!/refused an empty loop proposal/.test(s)) return 'an empty list would still be written as a proposal'
      return /if \(!items\.length\)/.test(s) ? null : 'there is no guard on the empty case'
    },
    break: (src) => ({
      ...src,
      'lib/lex/field-machine.ts': src['lib/lex/field-machine.ts'].replace('if (!items.length)', 'if (false)'),
    }),
  },
  {
    name: '§6b the four undrafted kernel fields are wired or the reason is stated in code',
    run: (src) => {
      const client = src['lib/lex/build-client.ts']
      if (!/anticipatedResponses: \{/.test(client)) return 'anticipatedResponses is still absent from every pass schema'
      // ⚠ THE FIELD, NOT ITS TYPE. This matched `type: 'string'` and 25-G §4d made it an
      // ARRAY — because the second build returned five sentences in one blob, every one
      // opening "For this to work". The check called that a regression. What §6b actually
      // requires is that the field is IN a pass schema at all; how it is shaped is §4d's
      // business, and asserting both here made one section's fix another's failure.
      if (!/conditionsForSuccess: \{ type: '(string|array)'/.test(client)) return 'conditionsForSuccess is still absent from every pass schema'
      const build = src['lib/lex/build.ts']
      if (!/setProposal\(ideaId, 'anticipatedResponses'/.test(build)) return 'anticipatedResponses is never persisted'
      if (!/setProposal\(ideaId, 'conditionsForSuccess'/.test(build)) return 'conditionsForSuccess is never persisted'
      return null
    },
    break: (src) => ({
      ...src,
      // Every occurrence: the interface and the schema both declare it, and corrupting
      // one left the other matching.
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts']
        .split('anticipatedResponses').join('somethingElse'),
    }),
  },
  {
    name: '§6c the research finding no longer overwrites every alternative of the instrument fork',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      // The defect was an updateMany scoped only by (buildId, forkKey) — which is every
      // row of the group — writing one alternative over all of them.
      if (/updateMany\(\{\s*where: \{ buildId: c\.buildId, forkKey: INSTRUMENT_FORK_KEY \},\s*data: \{[^}]*alternative:/s.test(s)) {
        return 'the unfiltered updateMany is back — it writes one alternative onto every row'
      }
      if (!/alreadyCarrying/.test(s)) return 'the append is not idempotent, so a re-run adds a duplicate'
      if (!/nextIndex/.test(s)) return 'the finding is not appended as its own alternative'
      return null
    },
    break: (src) => ({
      ...src,
      // ⚠ RENAMED TO A NON-SUPERSTRING. The first version renamed it to
      // `alreadyCarryingXX`, which still contains `alreadyCarrying` — so the assertion's
      // substring test matched the corrupted source and the control passed.
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .split('alreadyCarrying').join('zzIdempotenceGone'),
    }),
  },
  {
    name: '§6c two forks bearing on the same field with the same choice are ONE decision',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/function decisionIdentity/.test(s)) return 'nothing identifies a decision apart from the model-chosen key'
      if (!/seenDecisions/.test(s)) return 'the de-duplication never reads what is already recorded'
      if (!/droppedSameDecision/.test(s)) return 'the drop is silent, which is indistinguishable from it not happening'
      return null
    },
    break: (src) => ({
      ...src,
      // The symbol is DECLARED above the guard, so disabling the guard alone left the
      // declaration matching. Remove the symbol entirely.
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('seenDecisions').join('zzGone'),
    }),
  },

  // ═══ §7 — FINDABLE ═══════════════════════════════════════════════════════
  {
    name: '§7 a finished build names its idea, and only ever over the placeholder',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/async function nameTheIdea/.test(s)) return 'nothing ever names the idea'
      if (!/await nameTheIdea\(ideaId\)/.test(s)) return 'nameTheIdea is defined and never called'
      if (!/current !== UNTITLED/.test(s)) return 'it would overwrite a title the user chose'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace('await nameTheIdea(ideaId)', ''),
    }),
  },
  {
    name: '§7 naming the row does NOT accept the title field on the user\'s behalf',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      const fn = s.slice(s.indexOf('async function nameTheIdea'), s.indexOf('async function finishBuild'))
      if (!fn) return 'nameTheIdea could not be located'
      if (/acceptField|setStatus\(/.test(fn)) return 'it accepts the field, breaking invariant 5'
      return /prisma\.idea\.update/.test(fn) ? null : 'it does not write Idea.title'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace('await prisma.idea.update({ where: { id: ideaId }, data: { title: title.slice(0, 120) } })',
          'await acceptField(ideaId, "x", "title")'),
    }),
  },
  {
    name: '§7 the build screen links to the idea it made, by name',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/ideaTitle/.test(s)) return 'the client never learns the idea\'s name'
      if (!/href=\{`\/ideas\/\$\{ideaId\}`\}/.test(s)) return 'there is no link to the idea itself'
      return null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('ideaTitle').join('somethingElse'),
    }),
  },

  // ═══ §1 — THE SCREEN ═════════════════════════════════════════════════════
  {
    name: '§1 the build screen renders the findings, which it never did',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/BuildFindings/.test(s)) return 'the findings component is not on the page'
      if (!/latest\?\.highlights && <BuildFindings/.test(s)) return 'it is imported and never rendered'
      return null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace('{latest?.highlights && <BuildFindings highlights={latest.highlights} />}', ''),
    }),
  },
  {
    name: '§1 the drafted kernel is read from the field PROPOSALS, not the empty Idea columns',
    run: (src) => {
      const s = src['lib/lex/build-highlights.ts']
      if (!/prisma\.ideaFieldState\.findMany/.test(s)) return 'it reads the Idea row, which is empty after a build'
      if (!/proposalText/.test(s)) return 'it does not fall back to the proposal'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-highlights.ts': src['lib/lex/build-highlights.ts']
        .replace('prisma.ideaFieldState.findMany', 'prisma.idea.findMany'),
    }),
  },
  {
    name: '§1 a citation is what leads, and a contradiction leads among the cited',
    run: (src) => {
      const s = src['lib/lex/build-highlights.ts']
      // ⚠ THIS CHECK USED TO ASSERT THE OPPOSITE ORDERING, and it passed on it. It read
      // `CONTRADICTS += 100` and `citation += 50` and called that correct — which is the
      // arrangement the second full rebuild proved wrong on screen. An assertion written
      // from the code it guards agrees with the code by construction; this one now states
      // §1's own sentence instead, and `live-3` compares the two numbers rather than
      // matching either literal.
      if (!/if \(row\.citation\?\.trim\(\)\) r \+= 100/.test(s)) return 'a citation does not lead the ranking'
      if (!/if \(row\.kind === 'CONTRADICTS'\) r \+= 60/.test(s)) return 'a contradiction buys nothing'
      if (!/if \(row\.precedentTestPassed\) r \+= 25/.test(s)) return "the sift's precedent verdict is discarded again"
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-highlights.ts': src['lib/lex/build-highlights.ts']
        .replace("if (row.citation?.trim()) r += 100", "if (row.citation?.trim()) r += 0"),
    }),
  },
  {
    name: 'live-3 an UNCITED process note never outranks a CITED finding, and has its own section',
    run: (src) => {
      const s = src['lib/lex/build-highlights.ts']
      // ⚠ THE ORDER OF THE TWO WEIGHTS IS THE ASSERTION. The second full rebuild put eight
      // rows saying "the critique rewrote summaryDiagnosis" above 56 cited sources,
      // because CONTRADICTS was worth 100 and a citation 50.
      const cite = /if \(row\.citation\?\.trim\(\)\) r \+= (\d+)/.exec(s)
      const contra = /if \(row\.kind === 'CONTRADICTS'\) r \+= (\d+)/.exec(s)
      if (!cite || !contra) return 'the two weights could not be read out of rankOf'
      if (Number(cite[1]) <= Number(contra[1])) {
        return `a citation is worth ${cite[1]} and CONTRADICTS ${contra[1]} — an uncited contradiction `
          + 'outranks a cited finding, which is the opposite of §1'
      }
      if (!/function isProcessNote/.test(s)) return 'process notes are not separated from findings'
      if (!/changes\.push\(asHighlight\(r\)\); continue/.test(s)) return 'they are identified and not separated'
      const ui = src['components/lex/BuildFindings.tsx']
      return /highlights\.changes\.length > 0/.test(ui) ? null : 'the changes section is never rendered'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-highlights.ts': src['lib/lex/build-highlights.ts']
        .replace("if (row.citation?.trim()) r += 100", "if (row.citation?.trim()) r += 50")
        .replace("if (row.kind === 'CONTRADICTS') r += 60", "if (row.kind === 'CONTRADICTS') r += 100"),
    }),
  },
  {
    name: '§1 what is cut from the screen is COUNTED, never silently dropped',
    run: (src) => {
      if (!/demotedCount/.test(src['lib/lex/build-highlights.ts'])) return 'nothing counts what was demoted'
      const ui = src['components/lex/BuildFindings.tsx']
      return /highlights\.demotedCount > 0/.test(ui) ? null : 'the count is computed and never shown'
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildFindings.tsx': src['components/lex/BuildFindings.tsx']
        .replace('highlights.demotedCount > 0', 'false'),
    }),
  },
  {
    name: '§1 a cited finding is never demoted as a restatement',
    run: (src) => {
      const s = src['lib/lex/build-highlights.ts']
      return /if \(!r\.citation\?\.trim\(\) && isRestatement/.test(s)
        ? null
        : 'the restatement test can remove a finding that carries a source'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-highlights.ts': src['lib/lex/build-highlights.ts']
        .replace('if (!r.citation?.trim() && isRestatement(r.title, r.body))', 'if (isRestatement(r.title, r.body))'),
    }),
  },
  {
    name: '§1 an UNVERIFIED term is rendered as unverified, with its reason',
    run: (src) => {
      const s = src['components/lex/BuildFindings.tsx']
      if (!/Unverified —/.test(s)) return 'an unconfirmed term of art renders like a confirmed one'
      if (!/\{u\.why\}/.test(s)) return 'the reason it is unverified is not shown'
      return null
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildFindings.tsx': src['components/lex/BuildFindings.tsx']
        .split('Unverified — ').join(''),
    }),
  },

  // ═══ §2 — THE SMART PASS ═════════════════════════════════════════════════
  {
    name: '§2 the smart pass runs AFTER revision and BEFORE the hostile clerk',
    run: () => {
      const keys = BUILD_PASSES.map((p) => p.key)
      const revise = keys.indexOf('REVISE')
      const smart = keys.indexOf('SMART')
      const adversarial = keys.indexOf('ADVERSARIAL')
      if (smart < 0) return 'there is no SMART pass'
      if (!(revise < smart)) return 'the smart pass runs before the revision it is meant to read'
      if (!(smart < adversarial)) return 'the hostile clerk reads the kernel before the critique rewrites it'
      return null
    },
  },
  {
    name: '§2a the whole of page one goes out, verbatim, and a truncation is stated',
    run: (src) => {
      if (PAGE_ONE_CAP < 4000) return `the payload cap is ${PAGE_ONE_CAP}, below the 2,934 characters one real user wrote`
      const s = src['lib/lex/build.ts']
      if (!/pageOnePayload\(c\.ctx\)/.test(s)) return 'the smart pass does not send page one'
      return /page one hit the payload cap/.test(s) ? null : 'a truncation would be silent'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('page one hit the payload cap').join('x'),
    }),
  },
  {
    name: '§2b a term another model names is CONFIRMED only by a retrieved document mentioning it',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      if (!/function corpusMentions/.test(s)) return 'nothing tests whether the corpus actually mentions the term'
      if (!/corpusMentions\(e\.name, results\)/.test(s)) return 'confirmation is not decided by the test'
      // The fail-open shape: treating "the search returned results" as confirmation.
      if (/confirmed = tested\.filter\(\(e\) => results\.length\)/.test(s)) {
        return 'a non-empty result set is being treated as confirmation'
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts']
        .replace('const confirmed = tested.filter((e) => corpusMentions(e.name, results))',
          'const confirmed = tested.filter((e) => results.length)'),
    }),
  },
  {
    name: '§2b an unconfirmed term is KEPT and labelled, never dropped and never asserted',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      if (!/recordUnverifiedVocabulary/.test(s)) return 'unconfirmed terms are discarded'
      if (!/UNVERIFIED: this is a lead worth/.test(s)) return 'they are recorded without being labelled unverified'
      return /nothing in the proposal may cite it/.test(s) ? null : 'nothing forbids citing an unverified term'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts'].split('UNVERIFIED: this is a lead worth').join('x'),
    }),
  },
  {
    name: '§2b the entity cap says what it dropped',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      if (!/droppedByCap/.test(s)) return 'the cap is silent'
      return /entity cap dropped terms without testing them/.test(s) ? null : 'the drop is never logged'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts'].split('entity cap dropped terms without testing them').join('x'),
    }),
  },
  {
    name: '§2c every point another model made becomes an issue when our kernel misses it',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/coverageCheck\(/.test(s)) return 'the coverage check never runs'
      return /ANOTHER MODEL MADE THIS POINT AND OUR PROPOSAL DOES NOT ADDRESS IT/.test(s)
        ? null
        : 'a missed point does not reach the issues list'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('ANOTHER MODEL MADE THIS POINT').join('x'),
    }),
  },
  {
    name: '§2d the critique REWRITES rather than commenting, and records what it changed',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/const rewrites: Array<\[string, string\]>/.test(s)) return 'the critique produces no rewrite'
      if (!/kind: 'CONTRADICTS',\n[^}]*title: `The critique rewrote/.test(s)) {
        return 'what changed is not recorded in the revision pass\'s shape'
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('The critique rewrote').join('x'),
    }),
  },
  {
    name: '§2d an empty rewrite means LEAVE IT, not "write an empty proposal"',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      return /if \(!value\.trim\(\)\) continue\n\s*await setProposal\(ideaId, key/.test(s)
        ? null
        : 'an empty rewrite would be written over a good field'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace('if (!value.trim()) continue\n      await setProposal(ideaId, key', '      await setProposal(ideaId, key'),
    }),
  },
  {
    name: '§2d the four questions are answered in the output, where the user meets them',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      for (const t of ['How hard this will be to pass', 'The barriers this will actually meet',
        'How likely this is to succeed', 'What is most likely to go wrong']) {
        if (!s.includes(t)) return `"${t}" is never stored`
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts'].split('What is most likely to go wrong').join('x'),
    }),
  },
  {
    name: '§2d a judgement carries NO citation, because none would be honest',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      const fn = s.slice(s.indexOf('export async function recordPrognosis'))
      if (!fn) return 'recordPrognosis could not be located'
      return /sourceType: null, sourceId: null, citation: null, url: null/.test(fn)
        ? null
        : 'a reasoned judgement is being given a source'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts']
        .replace('sourceType: null, sourceId: null, citation: null, url: null,\n        status: \'PROPOSED\',\n      },\n    })\n  }\n  return rows.length',
          'sourceType: "x", sourceId: "x", citation: "x", url: null,\n        status: \'PROPOSED\',\n      },\n    })\n  }\n  return rows.length'),
    }),
  },
  {
    name: '§2e a panel model with no key is SKIPPED AND SAID, never silently absent',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      if (!/skipped\.push\(\{ model: m, why:/.test(s)) return 'an unreachable model vanishes without trace'
      const build = src['lib/lex/build.ts']
      if (!/panel models skipped/.test(build)) return 'the skip is never logged'
      // ⚠ AND IT MUST REACH THE USER, not only the log. A panel that silently shrank from
      // three models to one would make "nothing was missed" a claim about our configuration
      // wearing the clothes of a claim about the proposal.
      return /unavailable \(\$\{skipped\.map/.test(build)
        ? null
        : 'the user is never told the panel was short'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('panel models skipped').join('x'),
    }),
  },

  // ═══ §2e / §3 — MODEL SELECTION ══════════════════════════════════════════
  {
    name: '§2e the adversarial pass no longer runs on the cheapest model we have',
    run: () => {
      const before = process.env.LEX_BUILD_MODEL_ADVERSARIAL
      const beforeAll = process.env.LEX_BUILD_MODEL
      delete process.env.LEX_BUILD_MODEL_ADVERSARIAL
      delete process.env.LEX_BUILD_MODEL
      const m = modelForPass('ADVERSARIAL')
      if (before !== undefined) process.env.LEX_BUILD_MODEL_ADVERSARIAL = before
      if (beforeAll !== undefined) process.env.LEX_BUILD_MODEL = beforeAll
      return m === CHEAPEST_MODEL
        ? `the adversarial read still defaults to ${CHEAPEST_MODEL} — 407 output tokens for six issues`
        : null
    },
  },
  {
    name: '§2e no verification pass defaults to the cheapest model either',
    run: () => {
      const saved: Record<string, string | undefined> = {}
      for (const k of ['LEX_BUILD_MODEL_KERNEL_CHECK', 'LEX_BUILD_MODEL_LOGIC_CHECK', 'LEX_BUILD_MODEL_VERIFY', 'LEX_BUILD_MODEL_SMART']) {
        saved[k] = process.env[k]; delete process.env[k]
      }
      const bad = ([['KERNEL_CHECK', verifyModel('KERNEL_CHECK')], ['LOGIC_CHECK', verifyModel('LOGIC_CHECK')],
        ['SMART', smartCritiqueModel()]] as const).filter(([, m]) => m === CHEAPEST_MODEL)
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
      return bad.length ? `these default to the cheapest model: ${bad.map(([k]) => k).join(', ')}` : null
    },
  },
  {
    name: '§2e the model that ANSWERED is reported per pass, not the one configured',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/modelsByPass/.test(s)) return 'nothing reports a model per pass'
      if (!/u\.echoedModel \|\| u\.model/.test(s)) return 'it reports what was asked, not what answered'
      return /read by \{modelsFor/.test(src['components/lex/BuildProgress.tsx'])
        ? null
        : 'the model is computed and never shown'
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildProgress.tsx': src['components/lex/BuildProgress.tsx']
        .split('read by {modelsFor').join('x{modelsFor'),
    }),
  },

  // ═══ §3 — THE TWO VERIFICATION PASSES ════════════════════════════════════
  {
    name: '§3 both verification passes exist and run before the hostile clerk',
    run: () => {
      const keys = BUILD_PASSES.map((p) => p.key)
      for (const k of ['KERNEL_CHECK', 'LOGIC_CHECK'] as BuildPassKey[]) {
        if (!passDef(k)) return `${k} is not configured`
        if (!passDef(k)!.label?.trim() || !passDef(k)!.detail?.trim()) return `${k} has no label or detail`
        if (keys.indexOf(k) > keys.indexOf('ADVERSARIAL')) return `${k} runs after the adversarial pass`
      }
      return null
    },
  },
  {
    name: '§3a the kernel tests are DATA, so every one of them can be counted',
    run: () => {
      if (KERNEL_TESTS.length < 9) return `only ${KERNEL_TESTS.length} tests — §3a names nine`
      const ids = new Set(KERNEL_TESTS.map((t) => t.id))
      if (ids.size !== KERNEL_TESTS.length) return 'two tests share an id'
      const thin = KERNEL_TESTS.filter((t) => t.ask.length < 120)
      return thin.length ? `these are too thin to mark against: ${thin.map((t) => t.id).join(', ')}` : null
    },
  },
  {
    name: '§3a a test the model did not answer is UNRUN, not a pass',
    run: (src) => {
      const s = src['lib/lex/build-verify.ts']
      if (!/const unrun = KERNEL_TESTS\.filter/.test(s)) return 'a skipped test would silently read as a pass'
      if (!/passes: false,/.test(s)) return 'an unrun test is not recorded as failing'
      return /UNRUN rather than passed/.test(s) ? null : 'the distinction is not said in words the user reads'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-verify.ts': src['lib/lex/build-verify.ts']
        .replace('const unrun = KERNEL_TESTS.filter((t) => !answered.has(t.id))', 'const unrun: typeof KERNEL_TESTS = []'),
    }),
  },
  {
    name: '§3 every failure becomes an issue that QUOTES the text that fails it',
    run: () => {
      const text = complianceIssueText(
        { id: 'X', test: 'The guiding policy rules things out', ask: '…' },
        { id: 'X', passes: false, whatFails: 'It forbids nothing.', theTextThatFails: 'a statutory framework' },
      )
      if (!/a statutory framework/.test(text)) return 'the failing text is not quoted'
      const logic = logicIssueText({ kind: 'CIRCULAR', theText: 'accountability is poor because officials are not accountable', problem: 'it rests on itself' })
      return /accountability is poor/.test(logic) ? null : 'a logic defect does not quote the text'
    },
  },
  {
    name: '§3 a verification pass that did not complete FAILS rather than reporting a clean bill',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/the kernel-compliance check did not complete/.test(s)) return 'a failed compliance check does not fail the pass'
      if (!/the logical-consistency check did not complete/.test(s)) return 'a failed logic check does not fail the pass'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('the kernel-compliance check did not complete').join('x'),
    }),
  },
  {
    name: '§3 the chain does not "mostly hold" — one broken link is false',
    run: (src) => {
      const s = src['lib/lex/build-verify.ts']
      return /`chainHolds` IS FALSE IF ANY LINK IS BROKEN/.test(s)
        ? null
        : 'nothing forbids averaging a broken link away'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-verify.ts': src['lib/lex/build-verify.ts'].split('IS FALSE IF ANY LINK IS BROKEN').join('x'),
    }),
  },
  {
    name: '§25.7 the six answer-quality instructions reach every drafting pass',
    run: (src) => {
      const s = src['lib/lex/build-client.ts']
      if (!/const ANSWER_QUALITY = \[/.test(s)) return 'the six instructions are not in the prompts'
      for (const marker of ['A CAUSAL CHAIN, NOT AN INVENTORY', 'THE COUNTERINTUITIVE RESULT',
        'CITE THE FINDING, NOT THE CITATION', 'REFRAME THE INSTRUMENT IF IT IS WRONG',
        'GIVE A TEST THE USER CAN APPLY', 'PROPOSE THE NEXT ACTION']) {
        if (!s.includes(marker)) return `instruction missing: ${marker}`
      }
      const uses = (s.match(/ANSWER_QUALITY/g) ?? []).length
      return uses >= 6 ? null : `ANSWER_QUALITY appears ${uses} times; one declaration and five uses expected`
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts'].split('CITE THE FINDING, NOT THE CITATION').join('x'),
    }),
  },
  {
    name: '§1/§3 the revision pass now reads the FINDINGS, not a count of them',
    run: (src) => {
      const s = src['lib/lex/build-research.ts']
      if (!/═══ THE FINDINGS THEMSELVES ═══/.test(s)) return 'the carry is still headings and counts'
      if (!/CITATION: \$\{f\.citation\}/.test(s)) return 'the findings travel without their citations'
      if (!/interface CitedFinding/.test(s)) return 'nothing carries a finding with its citation'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts'].split('═══ THE FINDINGS THEMSELVES ═══').join('x'),
    }),
  },
  {
    name: '§1/§3 the cap on findings in the carry is stated, not silent',
    run: (src) => {
      const s = src['lib/lex/build-research.ts']
      return /further finding\$\{ordered\.length - shown\.length === 1 \? '' : 's'\}/.test(s)
        ? null
        : 'findings beyond the cap disappear without the pass saying so'
    },
    break: (src) => ({
      ...src,
      // ⚠ DISABLING THE BLOCK IS NOT ENOUGH: the sentence stays in the source inside the
      // now-dead branch, so the assertion still matched. The sentence itself is what the
      // check reads, so the sentence is what the control has to remove.
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts']
        .split('further finding').join('x'),
    }),
  },

  // ═══ WHAT THE FIRST LIVE RUN FOUND ═══════════════════════════════════════
  //
  // Neither of these two came from the brief. They came from running the thing.
  {
    name: 'live-1 a panel model’s reply is NORMALISED at the boundary, because `?? []` is not a guard',
    run: (src) => {
      const s = src['lib/lex/build-smart.ts']
      if (!/export function normalisePanelAnswer/.test(s)) return 'the reply is trusted as the schema described it'
      if (!/return normalisePanelAnswer\(input\.model, result\.value\)/.test(s)) {
        return 'the normaliser exists and the raw value is still returned'
      }
      // ⚠ A STRING WHERE A LIST WAS ASKED FOR MUST NOT BECOME AN EMPTY LIST. That would
      // lose the content silently, which is the failure one level along from the crash.
      const norm = normalisePanelAnswer('test-model', {
        diagnosis: 'd', guidingPolicy: 'g', instrument: 'i',
        coherentActions: 'one thing to do' as never,
        substantivePoints: null as never,
        entities: 'not a list' as never,
      })
      if (!Array.isArray(norm.coherentActions)) return 'a string is not turned into a list'
      if (norm.coherentActions[0] !== 'one thing to do') return 'the content of a stringified list is lost'
      if (!Array.isArray(norm.substantivePoints) || norm.substantivePoints.length) {
        return 'a null list does not become an empty one'
      }
      if (!Array.isArray(norm.entities) || norm.entities.length) return 'an unusable entities shape is not emptied'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts']
        .split('return normalisePanelAnswer(input.model, result.value)')
        .join('return { model: input.model, ...result.value }'),
    }),
  },
  {
    name: 'live-2 a 25-F pass that fails does NOT take the hostile clerk down with it',
    run: (src) => {
      // Only the three passes 25-F added, and no others.
      const marked = BUILD_PASSES.filter((p) => p.continueOnFailure).map((p) => p.key)
      const expected = ['SMART', 'KERNEL_CHECK', 'LOGIC_CHECK']
      if (marked.join(',') !== expected.join(',')) {
        return `continueOnFailure is on [${marked.join(', ')}]; it must be exactly [${expected.join(', ')}]`
      }
      const carry = src['lib/lex/build-carry.ts'] ?? read('lib/lex/build-carry.ts')
      if (!/\?\.continueOnFailure\) continue/.test(carry)) return 'nextPassKey still stops on every failure'
      return /export function steppedOverFailures/.test(carry)
        ? null
        : 'nothing can name what was stepped over'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-carry.ts': (src['lib/lex/build-carry.ts'] ?? read('lib/lex/build-carry.ts'))
        .split('?.continueOnFailure) continue').join('?.continueOnFailure) return null'),
    }),
  },
  {
    name: 'live-2 …and a build that survived one SAYS SO in the message read first',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/steppedOverFailures\(log\)/.test(s)) return 'the summary never looks for a stepped-over failure'
      if (!/parts of this build did not run/.test(s)) return 'the user is not told a part is missing'
      // ⚠ IT MUST BE APPENDED DETERMINISTICALLY. The summary is written by a model that was
      // never told about the failure; a warning that depends on a model remembering to
      // include it is not a warning.
      return /\$\{baseMessage\}/.test(s) ? null : 'the warning is not appended to the model’s own message'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('parts of this build did not run').join('x'),
    }),
  },

  // ═══ §9 — THE CUTOVER, PREPARED AND NOT THROWN ═══════════════════════════
  {
    name: '§9 THE CUTOVER HAS NOT HAPPENED — the default door is still `create`',
    run: () => {
      if (DEFAULT_DOOR !== 'create') return `the default door is "${DEFAULT_DOOR}" — the cutover has been executed`
      if (doorPath(DEFAULT_DOOR) !== '/ideas/create') return 'the default door does not resolve to /ideas/create'
      return null
    },
  },
  {
    name: '§9a the switch is a database row, so flipping and reverting need no deploy',
    run: (src) => {
      const s = src['lib/lex/new-idea-door.ts']
      if (!/prisma\.platformConfig\.findUnique/.test(s)) return 'the flag is not read from the database'
      if (/^\s*return process\.env\.LEX_NEW_IDEA_DOOR/m.test(s)) return 'the env var is the primary switch, which needs a redeploy'
      // ⚠ THE IDENTIFIER, NOT THE STRING. The route uses `[NEW_IDEA_DOOR_KEY]:` as a
      // computed key, so the literal "newIdeaDoor" never appears in it — and an assertion
      // on the string reported a missing write surface for a write surface that was there.
      const admin = src['app/api/admin/config/route.ts']
      if (!admin.includes('NEW_IDEA_DOOR_KEY')) return 'there is no write surface for the flag'
      return /z\.enum\(\['create', 'build'\]\)/.test(admin)
        ? null
        : 'the write surface does not constrain the value, so a typo could name a door that does not exist'
    },
    break: (src) => ({
      ...src,
      'lib/lex/new-idea-door.ts': src['lib/lex/new-idea-door.ts']
        .replace('prisma.platformConfig.findUnique', 'prisma.somethingElse.findUnique'),
    }),
  },
  {
    name: '§9a an unrecognised flag value falls back to the working door AND says so',
    run: (src) => {
      const s = src['lib/lex/new-idea-door.ts']
      if (!isNewIdeaDoor('create') || !isNewIdeaDoor('build')) return 'the door type does not recognise its own values'
      if (isNewIdeaDoor('TRUE') || isNewIdeaDoor('')) return 'an unrecognised value is accepted as a door'
      return /is neither "create" nor "build"/.test(s) ? null : 'an unrecognised value would be silent'
    },
    break: (src) => ({
      ...src,
      'lib/lex/new-idea-door.ts': src['lib/lex/new-idea-door.ts'].split('is neither "create" nor "build"').join('x'),
    }),
  },
  {
    name: '§9a the redirect route is never cached, or the flip would not take effect',
    run: (src) => {
      const s = src['app/ideas/new/page.tsx']
      if (!/force-dynamic/.test(s)) return 'a statically rendered redirect would keep sending people to the old door'
      return /redirect\(doorPath\(await newIdeaDoor\(\)\)\)/.test(s) ? null : 'the route does not read the switch'
    },
    break: (src) => ({
      ...src,
      'app/ideas/new/page.tsx': src['app/ideas/new/page.tsx'].split('force-dynamic').join('force-static'),
    }),
  },
  {
    name: '§9b EVERY creation entry points at the switch — none is left on the old door',
    run: (src) => {
      const entries: Array<[string, RegExp]> = [
        ['app/dashboard/DashboardClient.tsx', /href="\/ideas\/new">Create new idea/],
        ['app/dashboard/DashboardClient.tsx', /href="\/ideas\/new">Start your first idea/],
        ['app/ideas/page.tsx', /href="\/ideas\/new"/],
        ['app/page.tsx', /href="\/ideas\/new">\s*\n\s*Get Started/],
        ['components/PublicNav.tsx', /href="\/ideas\/new"/],
        ['components/ui/Navbar.tsx', /href: '\/ideas\/new'/],
      ]
      for (const [f, re] of entries) {
        if (!re.test(src[f])) return `${f} still points a creation entry somewhere other than ${NEW_IDEA_PATH}`
      }
      // Two links in PublicNav — desktop and the mobile menu.
      const nav = (src['components/PublicNav.tsx'].match(/\/ideas\/new/g) ?? []).length
      return nav >= 2 ? null : `PublicNav has ${nav} switched links; the desktop nav and the mobile menu both need one`
    },
    break: (src) => ({
      ...src,
      'components/ui/Navbar.tsx': src['components/ui/Navbar.tsx']
        .replace("href: '/ideas/new'", "href: '/ideas/create'"),
    }),
  },
  {
    name: '§9b NOTHING A RETURNING USER TOUCHES MOVED — every editing link still goes to /ideas/create',
    run: (src) => {
      const editing: Array<[string, RegExp]> = [
        ['app/ideas/[id]/IdeaDetailClient.tsx', /\/ideas\/create\?ideaId=\$\{idea\.id\}/],
        ['components/lex/RecentIdeasPanel.tsx', /\/ideas\/create\?ideaId=\$\{r\.ideaId\}/],
        ['app/ideas/build/BuildIdeaClient.tsx', /\/ideas\/create\?ideaId=\$\{ideaId\}/],
        ['lib/email.ts', /\/ideas\/create\?ideaId=\$\{ideaId\}/],
      ]
      for (const [f, re] of editing) {
        if (!re.test(src[f])) return `${f} — an EDITING link was changed; only the creation entry moves (§9b)`
      }
      // And the inverse: no link carrying an idea id may point at the creation switch.
      for (const f of Object.keys(src)) {
        if (/\/ideas\/new\?ideaId=|\/ideas\/new\?[^"'`]*ideaId/.test(src[f])) {
          return `${f} sends an existing idea through the creation switch`
        }
      }
      return null
    },
    break: (src) => ({
      ...src,
      'components/lex/RecentIdeasPanel.tsx': src['components/lex/RecentIdeasPanel.tsx']
        .replace('/ideas/create?ideaId=${r.ideaId}', '/ideas/new?ideaId=${r.ideaId}'),
    }),
  },
  {
    name: '§9d the old elicitation is still there — nothing was deleted',
    run: () => {
      for (const f of ['app/ideas/create/page.tsx', 'app/ideas/create/CreateIdeaClient.tsx',
        'components/lex/HowItWorksModal.tsx']) {
        try { if (!read(f).length) return `${f} is empty` } catch { return `${f} has been deleted` }
      }
      return null
    },
  },
  {
    name: '§9c the inventory exists and names the tour, which is the brief\'s stated risk',
    run: () => {
      let doc: string
      try { doc = read('../docs/LEX_25F_CUTOVER.md') } catch { return 'docs/LEX_25F_CUTOVER.md does not exist' }
      for (const marker of ['How this works', 'HowItWorksModal', 'first-idea modal',
        'returning-user greeting', 'FAQ']) {
        if (!doc.includes(marker)) return `the inventory does not name: ${marker}`
      }
      return null
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0
  let fail = 0
  let uncontrolled = 0

  console.log(`── check:lex-25f${selfTest ? ' --self-test' : ''} ──`)

  for (const c of CHECKS) {
    let err: string | null
    try {
      err = c.run(src)
    } catch (e) {
      err = `the check itself threw: ${e instanceof Error ? e.message : String(e)}`
    }
    if (err) { fail++; console.log(`  ✗  ${c.name}\n       ${err}`); continue }
    pass++
    console.log(`  ✓  ${c.name}`)

    if (!selfTest) continue
    if (!c.break) {
      uncontrolled++
      console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported code, not source text')
      continue
    }
    let broken: string | null
    try { broken = c.run(c.break(src)) } catch { broken = 'threw' }
    if (broken) console.log('       ↳ control OK — rejects the corrupted source')
    else { fail++; console.log('       ✗ CONTROL FAILED — the corrupted source PASSES, so this check proves nothing') }
  }

  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  if (selfTest && uncontrolled) {
    console.log('⚠ The uncontrolled checks run against imported code and cannot be corrupted from here.')
    console.log('  They are REPORTED, not counted as controlled.')
  }
  process.exit(fail ? 1 : 0)
}

main()
