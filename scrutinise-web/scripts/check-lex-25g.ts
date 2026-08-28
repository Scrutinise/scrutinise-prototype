// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25g — the Sprint 25-G guards.
//
// Same contract as 25-a/b/f: every assertion that CAN have a negative control has one, and
// `--self-test` proves each control rejects a corrupted copy. A guard that cannot fail is
// not a guard.
//
// ⚠ THE ONE THIS FILE EXISTS FOR IS §6. The cutover is gated on §1a, §2, §3 and §4 being
// DONE and on Charlie's confirmation, "and the ordering is not negotiable". So the flag's
// default is asserted here, and a check that could not tell a prepared cutover from a
// performed one would be worth nothing at all.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:lex-25g
//   npm run check:lex-25g -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUILD_PASSES, REUSABLE_PASSES, ORIENT_SOURCE_CAP, isBuildMode } from '../lib/lex/build-config'
import { freshPassLog, reusedPassLog, nextPassKey, type PassRecord } from '../lib/lex/build-carry'
import { DEFAULT_DOOR, doorPath } from '../lib/lex/new-idea-door'

/** CRLF normalised on read — see the note in check-build-25b.ts. */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
}

const FILES = [
  'lib/lex/build.ts',
  'lib/lex/build-carry.ts',
  'lib/lex/build-config.ts',
  'lib/lex/build-client.ts',
  'lib/lex/stage-context.ts',
  'lib/lex/new-idea-door.ts',
  'app/api/ideas/[id]/build/route.ts',
  'app/ideas/build/page.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/create/page.tsx',
  'app/ideas/create/CreateIdeaClient.tsx',
  'components/lex/StageBar.tsx',
  'components/lex/BuildProgress.tsx',
  'components/lex/HowItWorksModal.tsx',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/** A finished previous log, for the reuse tests. */
function doneLog(): PassRecord[] {
  return freshPassLog().map((p) => ({
    ...p,
    status: 'DONE',
    output: `${p.key} did something`,
    carry: p.key === 'ORIENT' ? { orientation: 'the terrain' }
      : p.key === 'RESEARCH' ? { research: 'THE FINDINGS THEMSELVES …' } : {},
    usages: [{ model: 'gemini-2.5-flash', tokensIn: 40000, tokensOut: 2000 }],
    queries: p.key === 'ORIENT' ? [{ by: 'ORIENT', terms: ['a'], purpose: 'p', provenance: 'written' as const }] : [],
  }))
}

const CHECKS: Check[] = [
  // ═══ §1a — THE RE-RUN REUSES THE RESEARCH ════════════════════════════════
  {
    name: '§1a exactly the two search passes are reusable — no drafting pass is',
    run: () => {
      const expected = ['ORIENT', 'RESEARCH']
      if ([...REUSABLE_PASSES].join(',') !== expected.join(',')) {
        return `REUSABLE_PASSES is [${REUSABLE_PASSES.join(', ')}]; it must be exactly [${expected.join(', ')}]`
      }
      // ⚠ THE REASON, ASSERTED. A drafting pass reads the DRAFT, which is the thing a
      // re-run exists to change; reusing one would re-present the same draft.
      const drafting = BUILD_PASSES.filter((p) => !['ORIENT', 'RESEARCH'].includes(p.key))
      return drafting.some((p) => (REUSABLE_PASSES as readonly string[]).includes(p.key))
        ? 'a drafting pass is marked reusable'
        : null
    },
  },
  {
    name: '§1a a reused pass CARRIES ITS CARRY and DROPS ITS USAGES',
    run: () => {
      const log = reusedPassLog(doneLog(), REUSABLE_PASSES, () => 'Reused')
      const orient = log.find((p) => p.key === 'ORIENT')!
      const research = log.find((p) => p.key === 'RESEARCH')!
      if (orient.status !== 'SKIPPED') return 'the reused pass is not marked SKIPPED'
      if (!orient.carry?.orientation) return 'the orientation carry was not copied — later passes get nothing'
      if (!research.carry?.research) return 'the research carry was not copied — the revision gets nothing'
      // ⚠ THE LINE THAT DECIDES WHETHER THE SAVING IS REAL OR MERELY REPORTED.
      if ((orient.usages ?? []).length) return 'the reused pass carried its usages forward — every re-run would report the full price'
      if ((research.usages ?? []).length) return 'the research usages were carried forward'
      return null
    },
    // ⚠ NO NEGATIVE CONTROL, AND IT IS REPORTED RATHER THAN FAKED. This assertion calls
    // the IMPORTED `reusedPassLog` with a real previous log — the strongest form it could
    // take, and precisely why corrupting the source text does nothing to it: the function
    // is already loaded. A control that rewrote `build-carry.ts` and then re-ran the
    // in-memory function would pass every time and prove nothing, which is the exact shape
    // this harness exists to remove. It is counted as uncontrolled instead.
  },
  {
    name: '§1a a SKIPPED pass is stepped over, so the build does not stall on it',
    run: () => {
      const log = reusedPassLog(doneLog(), REUSABLE_PASSES, () => 'Reused')
      const next = nextPassKey(log)
      return next === 'DIAGNOSIS' ? null : `the next pass after a reuse is ${next}, expected DIAGNOSIS`
    },
  },
  {
    name: '§1a a previous pass that did NOT complete is re-run rather than reused',
    run: () => {
      const broken = doneLog().map((p) => (p.key === 'RESEARCH' ? { ...p, status: 'FAILED' as const } : p))
      const log = reusedPassLog(broken, REUSABLE_PASSES, () => 'Reused')
      const research = log.find((p) => p.key === 'RESEARCH')!
      return research.status === 'PENDING' ? null : 'a failed research pass was reused, so nothing was reused and it was called a saving'
    },
  },
  {
    name: '§1a the reused EVIDENCE moves to the new run version, or nothing can see it',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/async function carryEvidenceForward/.test(s)) return 'the evidence is skipped, not reused'
      if (!/await carryEvidenceForward\(ideaId, reuseFrom\.version, version\)/.test(s)) {
        return 'carryEvidenceForward is defined and never called'
      }
      // ⚠ ONLY PROPOSED ROWS. An ACCEPTED or REJECTED finding is the user's judgement.
      if (!/status: 'PROPOSED'/.test(s)) return 'it moves rows the user has already judged'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('await carryEvidenceForward(').join('void 0 && ('),
    }),
  },
  {
    name: '§1a reuse is REFUSED when the elicitation changed since the last build',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      if (!/elicitation\.updatedAt > previous\.startedAt/.test(s)) {
        return 'nothing compares the elicitation against the build that used it'
      }
      // And the user is told which of the reasons applies.
      return /You’ve changed what you told me since the last build/.test(s)
        ? null
        : 'the user is not told why the cheap option is unavailable'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .split('elicitation.updatedAt > previous.startedAt').join('false'),
    }),
  },
  {
    name: '§1a/§1b BOTH prices are on the screen, and the expensive one is the explicit choice',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/Re-running from the research already gathered/.test(s)) return 'the reuse sentence §1a specifies is missing'
      if (!/Search again from scratch/.test(s)) return '§1b\'s explicit re-search is not offered'
      if (!/startBuild\('REUSE'\)/.test(s) || !/startBuild\('FULL'\)/.test(s)) return 'one of the two modes has no control'
      return null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('Search again from scratch').join('x'),
    }),
  },
  {
    name: '§1a the ROUTE defaults to FULL — a build never quietly reuses a search nobody asked it to',
    run: (src) => {
      const s = src['app/api/ideas/[id]/build/route.ts']
      if (!isBuildMode('FULL') || !isBuildMode('REUSE') || isBuildMode('CHEAP')) return 'the mode type does not police its own values'
      return /parsed\.data\.mode \?\? 'FULL'/.test(s) ? null : 'an omitted mode does not default to FULL'
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/build/route.ts': src['app/api/ideas/[id]/build/route.ts']
        .replace("parsed.data.mode ?? 'FULL'", "parsed.data.mode ?? 'REUSE'"),
    }),
  },

  // ═══ §1c — THE INPUT TOKENS ══════════════════════════════════════════════
  {
    name: '§1c the orient pass reads a CAPPED set, and the cap is above what it stores',
    run: (src) => {
      if (ORIENT_SOURCE_CAP < 20) return `the cap is ${ORIENT_SOURCE_CAP}, below the 20 the pass stores — the user could see a source the model never read`
      const s = src['lib/lex/build.ts']
      if (!/const forReading = merged\.slice\(0, readCap\)/.test(s)) return 'the pass still hands the model everything the gateway returned'
      if (!/results: forReading/.test(s)) return 'the cap is computed and the full set is still sent'
      // ⚠ THE RETRIEVED COUNT IS STILL REPORTED. Capping what is READ must not shrink what
      // the build says the corpus returned.
      return /\$\{merged\.length\} retrieved, \$\{forReading\.length\} read/.test(s)
        ? null
        : 'the output no longer says how many were retrieved'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace('results: forReading', 'results: merged'),
    }),
  },
  {
    name: '§1c a citation is checked against what the model was HANDED, not everything retrieved',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      return /if \(readable\.has\(id\)\) citedAll\.add\(id\)/.test(s)
        ? null
        : 'a cited id is validated against the whole retrieved set, so a source the model never saw counts as cited'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace('if (readable.has(id)) citedAll.add(id)', 'if (seen.has(id)) citedAll.add(id)'),
    }),
  },
  {
    name: '§1c NO PASS IS GIVEN A SUMMARY IN PLACE OF FINDINGS — 25-F\'s fix is not undone',
    run: (src) => {
      // The brief's explicit warning. `carry.research` must still carry the findings.
      const s = src['lib/lex/build-research.ts'] ?? read('lib/lex/build-research.ts')
      if (!/═══ THE FINDINGS THEMSELVES ═══/.test(s)) return 'the research carry is back to headings and counts'
      return /CITATION: \$\{f\.citation\}/.test(s) ? null : 'the findings travel without their citations'
    },
  },

  // ═══ §2 — NAVIGATION ═════════════════════════════════════════
  //
  // ⚠⚠ 25-K §1 SUPERSEDES THE WORDS AND KEEPS EVERY PROPERTY. 25-G built a switch
  // between two screens called "the build" and "the proposal"; those are how they were
  // MADE, not what a user does on them, and Charlie — who designed it — got lost in his
  // own product. `SurfaceSwitch` and `lib/lex/surfaces.ts` are gone; `StageBar` and
  // `lib/lex/stages.ts` replace them.
  //
  // ⚠ THE ASSERTIONS ARE REPOINTED, NOT RELAXED. What 25-G's checks actually guard is
  // three properties — both surfaces render the indicator, it names where you are, and
  // the offer of the other place is COUNTED rather than labelled. All three still hold and
  // are still asserted here, against the file that now carries them. Deleting the checks
  // with the component would have retired the guard along with the vocabulary.
  {
    name: '§2 (as §25-K §1) BOTH surfaces render the stage indicator, so the route exists in every direction',
    run: (src) => {
      if (!/<StageBar context=\{stageCtx\} \/>/.test(src['app/ideas/build/BuildIdeaClient.tsx'])) {
        return 'stage 1 has no stage indicator'
      }
      if (!/<StageBar context=\{stageCtx\} \/>/.test(src['app/ideas/create/CreateIdeaClient.tsx'])) {
        return 'stages 2 and 3 have no stage indicator'
      }
      return null
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split('<StageBar context={stageCtx} />').join(''),
    }),
  },
  {
    name: '§2 (as §25-K §1) each screen NAMES ITSELF as well as offering the others',
    run: (src) => {
      const s = src['components/lex/StageBar.tsx']
      // The words, not a highlight — docs/CLAUDE.md §21, Charlie is colour blind and a
      // "which one am I on" signalled by hue answers the question for everyone except him.
      if (!/You are here/.test(s)) return 'the current stage is not named in words'
      if (!/Stage \{here\.n\} of 3/.test(s)) return 'the screen does not say which stage of how many'
      if (!/\{here\.purpose\}/.test(s)) return 'the stage is named without saying what it is for'
      if (!/s\.detail/.test(s)) return 'the other stages are offered without saying what is on them'
      return null
    },
    break: (src) => ({
      ...src,
      'components/lex/StageBar.tsx': src['components/lex/StageBar.tsx']
        .split('You are here').join('x'),
    }),
  },
  {
    name: '§2 (as §25-K §1) the detail is COUNTED, not a label',
    run: (src) => {
      // ⚠ THE COUNTS MOVED to `stage-context.ts` when the vocabulary had to be made
      // client-safe (a prisma import beside it put `pg` in the browser bundle). Same
      // property, same expressions, new file.
      const s = src['lib/lex/stage-context.ts']
      if (!/plural\(strategy\.fields, 'field'\)/.test(s)) return 'the strategy stage does not count its fields'
      if (!/plural\(strategy\.waiting, 'decision'\)/.test(s)) return 'it does not count the decisions waiting'
      // ⚠ Forks AND issues. Counting only forks told the second build's user there were 4
      // when there were 21.
      return /forks\.length \+ issues/.test(s) ? null : 'open issues are not counted as decisions waiting'
    },
    break: (src) => ({
      ...src,
      'lib/lex/stage-context.ts': src['lib/lex/stage-context.ts'].replace('forks.length + issues', 'forks.length'),
    }),
  },
  {
    name: '§2 a returning user lands on the PROPOSAL, with an escape that stops a bounce',
    run: (src) => {
      const s = src['app/ideas/build/page.tsx']
      if (!/redirect\(`\/ideas\/create\?ideaId=\$\{params\.ideaId\}`\)/.test(s)) {
        return 'a returning user still lands on the build screen'
      }
      if (!/params\.build !== '1'/.test(s)) return 'there is no escape, so the proposal link back here would bounce'
      // And the client writes the flag, so a refresh mid-build does not throw the user off.
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      return /url\.searchParams\.set\('build', '1'\)/.test(c)
        ? null
        : 'the build screen does not mark its own URL, so a refresh mid-build redirects away'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/page.tsx': src['app/ideas/build/page.tsx']
        .split("params.build !== '1'").join('true'),
    }),
  },

  // ═══ §3 — WHAT THE NEW DOOR LOST ═════════════════════════════════════════
  {
    name: '§3 A1 feedback capture is present — the FIRST of the seven, per the brief',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/<FeedbackDialog/.test(s)) return 'there is no way for a user to tell us the new door is broken'
      if (!/CRITIQUE_INTENT/.test(s)) return 'the offer never appears where the criticism was made'
      // ⚠ AND A PERMANENT ROUTE. A control that only appears when we correctly guess the
      // user is unhappy is not a feedback route.
      return /Something wrong with this\? Tell us/.test(s)
        ? null
        : 'feedback is only reachable when we guess the user is unhappy'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('Something wrong with this? Tell us').join('x'),
    }),
  },
  {
    name: '§3 A2/A4 the tour and the FAQ are on the new door, in ITS words',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/<HowItWorksModal variant="build"/.test(s)) return 'the tour is absent, or shows the create page\'s three panels'
      const modal = src['components/lex/HowItWorksModal.tsx']
      if (!/const BUILD_STEPS/.test(modal)) return 'there is no build-door tour copy'
      // ⚠ THE FAQ IS SHARED, and that is the point of a variant rather than a second modal.
      return /Read the FAQs/.test(modal) ? null : 'the FAQ view was lost'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('<HowItWorksModal variant="build"').join('<HowItWorksModal variant="create"'),
    }),
  },
  {
    name: '§3 A3 the first-idea tour opens unprompted, and the greeting uses the preferred name',
    run: (src) => {
      const page = src['app/ideas/build/page.tsx']
      if (!/isFirstIdea=\{ideaCount === 0\}/.test(page)) return 'first-idea is not detected the way the old door detects it'
      if (!/preferredName\?\.trim\(\) \|\| dbUser\?\.firstName/.test(page)) return 'the greeting does not use the preferred name'
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/useState\(Boolean\(isFirstIdea\)\)/.test(c)) return 'the tour does not open unprompted on a first idea'
      return /Good \{timeOfDay\(\)\} \{displayName\}/.test(c) ? null : 'there is no greeting'
    },
    // ⚠⚠ THE CONTROL CORRUPTS THE PAGE, NOT THE CLIENT, AND THE FIRST VERSION GOT IT
    // WRONG TWICE OVER — both mistakes worth recording because they are the same family
    // as the five 25-F found.
    //
    //   1. It rewrote `useState(Boolean(isFirstIdea))` in the CLIENT, which this check does
    //      read — but the check reads the PAGE's `isFirstIdea={ideaCount === 0}` FIRST and
    //      returns on it, so the corrupted client was never reached. A control must break
    //      the assertion's FIRST condition or it tests the order of the ifs.
    //   2. `.replace` takes the FIRST match, and the first occurrence of that string in the
    //      client is a COMMENT quoting it. The control corrupted a comment.
    break: (src) => ({
      ...src,
      'app/ideas/build/page.tsx': src['app/ideas/build/page.tsx']
        .split('isFirstIdea={ideaCount === 0}').join('isFirstIdea={false}'),
    }),
  },
  {
    name: '§3 A5 "say the word" opens the tour AND does not swallow the answer',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/HELP_INTENT\.test\(text\.trim\(\)\)/.test(s)) return 'asking how it works is filed as an answer'
      // ⚠ THE BOX IS NOT CLEARED. A false positive here would cost the user their own words.
      const block = s.slice(s.indexOf('if (HELP_INTENT.test(text.trim()))'), s.indexOf('setFeedbackOffer(CRITIQUE_INTENT'))
      return /setText\(''\)/.test(block) ? 'a false positive would throw away what they typed' : null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace("      setShowHelp(true)\n      return", "      setShowHelp(true)\n      setText('')\n      return"),
    }),
  },
  {
    name: '§3 A6 Exit exists and asks before discarding a half-typed answer',
    run: (src) => {
      const s = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/setExitPrompt\(true\)/.test(s)) return 'Exit throws away unsent work without asking'
      if (!/Leave without sending that\?/.test(s)) return 'there is no prompt'
      return /text\.trim\(\) \|\| correction\.trim\(\)/.test(s)
        ? null
        : 'the prompt does not check whether anything is actually unsent'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace("if (text.trim() || correction.trim() || ruledOut.trim()) setExitPrompt(true)", "if (false) setExitPrompt(true)"),
    }),
  },

  // ═══ §4 — THE FIVE PRESENTATION DEFECTS ══════════════════════════════════
  {
    name: '§4a the build summary is not rendered twice on one screen',
    run: (src) => {
      const s = src['components/lex/BuildProgress.tsx']
      // The transcript (rendered by BuildIdeaClient) already carries it.
      return /\{build\.summaryMessage\}/.test(s)
        ? 'BuildProgress renders the summary the transcript already shows'
        : null
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildProgress.tsx': `${src['components/lex/BuildProgress.tsx']}\n// {build.summaryMessage}`,
    }),
  },
  {
    name: '§4b a query with no terms cannot render as a silent empty bullet',
    run: (src) => {
      const s = src['components/lex/BuildProgress.tsx']
      if (!/no terms recorded for this query/.test(s)) return 'an empty query renders as a blank line under a count'
      return /terms\.length \?/.test(s) ? null : 'the guard is written and not branched on'
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildProgress.tsx': src['components/lex/BuildProgress.tsx']
        .split('no terms recorded for this query').join('x'),
    }),
  },
  {
    name: '§4c every fork says WHAT IS BEING DECIDED, keyed on the field not the model\'s slug',
    run: (src) => {
      const s = src['components/lex/BuildProgress.tsx']
      if (!/const FORK_LABELS/.test(s)) return 'the forks render identically whatever they decide'
      for (const k of ['rootCause', 'pivotalObstacle', 'chosenApproach', 'summaryGuidingPolicy']) {
        if (!new RegExp(`${k}: \\{ label:`).test(s)) return `no label for the ${k} fork`
      }
      // ⚠ ON `fieldKey`. The model invents its own fork keys — the two builds produced
      // `approach:chosen` and `approach:primaryLever` for the same decision.
      if (!/forkLabel\(group\[0\]\.fieldKey, key\)/.test(s)) return 'the label is keyed on the model-chosen fork key'
      return null
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildProgress.tsx': src['components/lex/BuildProgress.tsx']
        .replace('forkLabel(group[0].fieldKey, key)', 'forkLabel(key, key)'),
    }),
  },
  {
    name: '§4d conditions for success is a LIST, and the repeated stem is stripped',
    run: (src) => {
      const client = src['lib/lex/build-client.ts']
      if (!/conditionsForSuccess: \{ type: 'array'/.test(client)) return 'it is still asked for as one blob'
      if (!/DO NOT START THEM ALL THE SAME WAY/.test(client)) return 'nothing tells the model to vary the opening'
      const s = src['lib/lex/build.ts']
      // ⚠ Telling a model not to repeat an opener is a request; removing it is the guarantee.
      return /\^for \(this\|it\) to work/.test(s) ? null : 'the stem is not stripped if it survives the prompt'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('^for (this|it) to work').join('^zzz'),
    }),
  },

  // ═══ §5 — FINDABILITY ════════════════════════════════════════════════════
  {
    name: '§5 a build that STOPPED EARLY still names its idea',
    run: (src) => {
      const s = src['lib/lex/build.ts']
      const stop = s.slice(s.indexOf('async function stopBuild'), s.indexOf('async function settleBuild'))
      if (!stop) return 'stopBuild could not be located'
      return /await nameTheIdea\(row\.ideaId\)/.test(stop)
        ? null
        : 'a build that hit a ceiling leaves its idea called "Untitled idea"'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .replace('if (row?.ideaId) await nameTheIdea(row.ideaId)', ''),
    }),
  },

  // ═══ §6 — THE CUTOVER, STILL GATED ═══════════════════════════════════════
  {
    // ⚠⚠ RENAMED AFTER THE FLIP, BECAUSE THE OLD NAME BECAME FALSE.
    //
    // It read "THE FLIP HAS NOT HAPPENED", which was true while the cutover was pending and
    // stopped being true the moment Charlie confirmed and the row was written. The
    // ASSERTION never changed — it has always been about `DEFAULT_DOOR`, the CODE default,
    // which is the state the platform falls back to when the row is absent, unreadable or
    // deleted. That is the revert target, and it must stay `create` for the revert to be
    // one row rather than a deploy.
    //
    // A check whose name says something false is worse than one with no name: the next
    // reader trusts the name and not the code.
    name: '§6 the REVERT TARGET is intact — the code default is still `create`',
    run: () => {
      if (DEFAULT_DOOR !== 'create') {
        return `the code default is "${DEFAULT_DOOR}". With the live flag on "build", a default of `
          + '"build" would mean a deleted or unreadable row leaves users on the new door with no '
          + 'one-row way back — which is the whole property §6 was built around.'
      }
      return doorPath(DEFAULT_DOOR) === '/ideas/create' ? null : 'the default does not resolve to /ideas/create'
    },
  },
  {
    name: '§6 the flip is still ONE ROW, and the revert is the same row',
    run: (src) => {
      const s = src['lib/lex/new-idea-door.ts']
      if (!/prisma\.platformConfig\.findUnique/.test(s)) return 'the switch is no longer a database row'
      if (!/DEFAULT_DOOR/.test(s)) return 'there is no default to revert to'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/new-idea-door.ts': src['lib/lex/new-idea-door.ts']
        .replace('prisma.platformConfig.findUnique', 'prisma.nothing.findUnique'),
    }),
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0
  let fail = 0
  let uncontrolled = 0

  console.log(`── check:lex-25g${selfTest ? ' --self-test' : ''} ──`)

  for (const c of CHECKS) {
    let err: string | null
    try { err = c.run(src) } catch (e) {
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
  process.exit(fail ? 1 : 0)
}

main()
