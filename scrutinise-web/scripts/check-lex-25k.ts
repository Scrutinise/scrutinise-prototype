// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25k — three stages, named for what the user does.
//
// ⚠ THE SPRINT EXISTS BECAUSE THE MAN WHO DESIGNED THE PRODUCT GOT LOST IN IT: "I'm
// confused about where I am now, and I know it back to front." So the assertions are about
// ORIENTATION, and two of them are sweeps rather than spot-checks — a new screen that
// labels a link "The proposal" fails on the day it is written, not on the day somebody
// notices.
//
// Offline: no database, no API key, no network.
//
//   npm run check:lex-25k
//   npm run check:lex-25k -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { LEX_STAGES, stageHref, stageByKey } from '../lib/lex/stages'
import { PLATFORM_CONTROLS } from '../lib/lex/platform-controls'
import { tasksFrom } from '../components/lex/WorkList'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
  control?: () => string | null
}

const FILES = [
  'lib/lex/stages.ts',
  'lib/lex/stage-context.ts',
  'lib/lex/question-headings.ts',
  'components/lex/FieldsPanel.tsx',
  'lib/lex/platform-controls.ts',
  'lib/lex/lex-client.ts',
  'components/lex/StageBar.tsx',
  'components/lex/WorkList.tsx',
  'components/lex/ElicitationCards.tsx',
  'components/lex/YourMaterial.tsx',
  'components/lex/AgendaPanel.tsx',
  'components/lex/DeepeningPanel.tsx',
  'components/PublicNav.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/build/page.tsx',
  'app/ideas/create/CreateIdeaClient.tsx',
  'app/ideas/create/page.tsx',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/** Every .tsx under app/ and components/ — the surfaces a user reads. */
function screens(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`
      if (statSync(join(ROOT, rel)).isDirectory()) { walk(rel); continue }
      if (rel.endsWith('.tsx')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

/**
 * Comments, gone — all three kinds, before anything is swept.
 *
 * ⚠⚠ A LINE-PREFIX TEST IS NOT ENOUGH AND THE FIRST VERSION OF THIS CHECK PROVED IT.
 * A JSX comment runs `{/* … *\/}` across many lines, and its CONTINUATION lines start with
 * whatever word happens to be there — so this file's own comment explaining the rule
 * ("THE LABEL IS NOT \"YOUR PROPOSAL\" ANY MORE") was reported as a violation of it. A
 * sweep that flags the documentation of its own rule teaches everyone to ignore it.
 */
export function stripComments(src: string): string {
  return src
    .split(/\/\*[\s\S]*?\*\//).join(' ')   // /* … */ and {/* … */}
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
}

/**
 * §1's sweep, as a function so a control can plant a violation and watch it fire.
 *
 * ⚠ THE RULE IS ABOUT NAVIGATION, NOT THE WORD. "A proposal a Member of Parliament could
 * read" is correct English and none of §1's business; a TAB, LINK or PANEL LABEL reading
 * "The build" is the thing a user has to translate before they can move. So a hit needs
 * both halves:
 *
 *   · a JSX TEXT NODE that is entirely the phrase        — `>The proposal<`
 *   · or a QUOTED STRING that is entirely the phrase WITH ITS ARTICLE — `'Your proposal'`
 *
 * ⚠ THE ARTICLE IS WHAT SEPARATES A LABEL FROM AN IDENTIFIER, and without it this check
 * flagged `searchParams.get('build')` and `variant="build"` — the route and the query
 * parameter, which §1 explicitly allows to survive as "the technical record". A rule that
 * cannot tell a label from a key would have forced a rename of the URL scheme to satisfy a
 * grep.
 */
export function navigationImplementationWords(files: Array<[string, string]>): string[] {
  const jsxText = /(?:^|>)\s*(?:The|Your|the|your)?\s*(?:build|proposal|Build|Proposal)s?\s*(?:<|$)/
  const label = /['"`]\s*(?:The|Your|the|your)\s+(?:build|proposal|Build|Proposal)s?\s*['"`]/
  const out: string[] = []
  for (const [path, content] of files) {
    for (const line of stripComments(content).split('\n')) {
      if (!line.trim()) continue
      if (jsxText.test(line) || label.test(line)) out.push(`${relative('.', path)}: ${line.trim().slice(0, 90)}`)
    }
  }
  return out
}

/**
 * The nav items, in source order, from one block of `PublicNav`.
 *
 * ⚠ READ OFF THE SOURCE, NOT LISTED HERE. An expected list written out twice is two lists
 * that will disagree; this extracts what the file actually renders and compares it to the
 * brief's order once.
 */
export function navOrder(src: string, marker: string): string[] {
  const i = src.indexOf(marker)
  if (i < 0) return []
  const block = src.slice(i, src.indexOf('{isLoaded && !isSignedIn && (', i))
  const out: string[] = []
  for (const m of block.matchAll(/<Link[\s\S]*?>\s*\n?\s*([A-Z][A-Za-z ]*?)\s*\n?\s*<\/Link>/g)) {
    out.push(m[1].trim())
  }
  return out
}

// ⚠ 25-L — "My ideas", not "Create". 25-J's rename reached a file nothing renders; this
// list is checked against `PublicNav`, which every page draws. The five that follow are
// unchanged — only the first label moved.
const NAV_ORDER = ['My ideas', 'Browse', 'Central', 'About', 'Support', 'Admin']

/**
 * §1's table, as a property, so a deliberately broken table can be run through it.
 *
 * ⚠ THREE PARTS, ALL THREE LOAD-BEARING: the names are the brief's, they are numbered so
 * "stage 2 of 3" can be said, and every one carries a line saying what the user DOES there.
 * A table with names and numbers and no purposes is a progress bar.
 */
function stageTableProperty(stages: ReadonlyArray<{ n: number; name: string; purpose: string }>): string | null {
  const names = stages.map((s) => s.name)
  const want = ['The Idea', 'The Strategy', 'The Deepening']
  if (names.join(' | ') !== want.join(' | ')) return `the stages are ${names.join(' | ')}`
  if (stages.map((s) => s.n).join('') !== '123') return 'the stages are not numbered 1, 2, 3'
  const mute = stages.filter((s) => s.purpose.trim().length < 20)
  return mute.length ? `${mute.map((s) => s.name).join(', ')} has no purpose line` : null
}

// A fixture agenda, so the ordering rules can be asserted without a database.
const AGENDA = {
  buildVersion: 3,
  contradictions: [{ id: 'c1', status: 'PROPOSED' }],
  decisions: [{ forkKey: 'f1', resolved: false, changedByResearch: true }],
  challenges: [{ id: 'i1', status: 'OPEN' }, { id: 'i2', status: 'DISMISSED' }],
  reading: [{ id: 'r1', title: 'CRaG 2010' }],
  gaps: [
    { question: 'How many?', why: 'x', task: 'research' as const },
    { question: 'What did you see?', why: 'y', task: 'only-you' as const },
    { question: 'Not held', why: 'z', task: 'limitation' as const },
  ],
}
const PASSES = [
  { passKey: 'a', label: 'A', status: 'RUN' as const },
  { passKey: 'b', label: 'B', status: 'NOT_RUN' as const },
  { passKey: 'c', label: 'C', status: 'FAILED' as const },
]

const CHECKS: Check[] = [
  // ═══ §1 — THREE STAGES, NAMED FOR THE USER ═══════════════════════════════
  {
    name: '§1 the three stages are named for what the user DOES, and the table is the brief\'s',
    run: () => stageTableProperty(LEX_STAGES),
    // ⚠ A TABLE WITH A NAME AND NO PURPOSE is a progress bar, and a progress bar does not
    // answer "what do I do next" — which is the question the sprint exists for. The control
    // feeds exactly that.
    control: () => stageTableProperty(
      LEX_STAGES.map((s) => (s.key === 'strategy' ? { ...s, purpose: 'Stage two.' } : s)),
    ),
  },
  {
    name: '§1 the indicator says which stage, what it is for, and how to move',
    run: (src) => {
      const s = src['components/lex/StageBar.tsx']
      if (!/Stage \{here\.n\} of 3/.test(s)) return 'it does not say which stage of how many'
      if (!/\{here\.purpose\}/.test(s)) return 'it does not say what this stage is for'
      if (!/href=\{s\.href\}/.test(s)) return 'the other stages are not links — there is no way to move'
      return null
    },
    break: (src) => ({
      ...src,
      'components/lex/StageBar.tsx': src['components/lex/StageBar.tsx']
        .split('href={s.href}').join('data-x={s.href}'),
    }),
  },
  {
    name: '§1 which stage you are on is NOT signalled by colour alone',
    // ⚠ docs/CLAUDE.md §21. Charlie is colour blind; a bar whose only "you are here" cue is
    // a hue answers the orientation question for everyone except the person who asked it.
    // Three cues, and each survives greyscale: the words, two different glyph characters,
    // and a 2px border weight.
    run: (src) => {
      const s = src['components/lex/StageBar.tsx']
      if (!/You are here/.test(s)) return 'there is no worded cue'
      if (!/\{current \? '●' : '○'\}/.test(s)) return 'the filled/hollow glyph pair is gone'
      return /border-2/.test(s) ? null : 'the weight cue is gone'
    },
    break: (src) => ({
      ...src,
      'components/lex/StageBar.tsx': src['components/lex/StageBar.tsx'].split('You are here').join('x'),
    }),
  },
  {
    name: '§1 movement is FREE IN BOTH DIRECTIONS — stage 1 cannot bounce you back to stage 2',
    // ⚠⚠ THE ONE THAT WOULD HAVE SHIPPED BROKEN. 25-G §2 redirects a returning user with a
    // finished build from /ideas/build to /ideas/create. Without an escape in the link the
    // indicator writes, pressing "1 · The Idea" would land the user straight back where
    // they were — a control that visibly does nothing, which is this sprint's own fault
    // wearing a new coat.
    run: (src) => {
      const href = stageHref('idea', 'abc')
      if (!href.includes('stage=idea')) return `stage 1's link carries no escape: ${href}`
      const page = src['app/ideas/build/page.tsx']
      return /params\.stage !== 'idea'/.test(page)
        ? null
        : 'the build page ignores the escape, so the stage-1 tile bounces back'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/page.tsx': src['app/ideas/build/page.tsx']
        .split("params.stage !== 'idea'").join('true'),
    }),
  },
  {
    name: '§1 no user-facing "build" or "proposal" is left as a label — swept, not spot-checked',
    run: () => {
      const offenders = navigationImplementationWords(screens().map((f) => [f, read(f)]))
      return offenders.length ? `still implementation words:\n       ${offenders.join('\n       ')}` : null
    },
    // ⚠ THE CONTROL PLANTS ONE. Without it this passes trivially the day the regex stops
    // matching anything at all — which is what happened twice to 25-J's sweep while it was
    // being narrowed.
    control: () => {
      const planted = navigationImplementationWords([
        ['fake/Screen.tsx', '  return <a href="/x">The proposal</a>\n'],
      ])
      return planted.length ? 'rejected' : null
    },
  },

  // ═══ §2 — STAGE 1: ONE CLEAN PANEL ═══════════════════════════════════════
  {
    name: '§2 stage 1 is a SINGLE column — no three-panel layout, no draft or legislation panel',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (/lg:grid-cols-\[/.test(c)) return 'the three-column grid has appeared on stage 1'
      if (/<FieldsPanel/.test(c)) return 'the draft panel is on stage 1, where there is nothing in it'
      return /<BackgroundPanel/.test(c) ? 'the legislation panel is on stage 1' : null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx':
        src['app/ideas/build/BuildIdeaClient.tsx'] + '\n// lg:grid-cols-[1fr_1fr]\nconst x = <FieldsPanel />\n',
    }),
  },
  {
    name: '§2 file AND link upload are one control in the composer, not a panel elsewhere',
    run: (src) => {
      const card = src['components/lex/ElicitationCards.tsx']
      if (!/p\.onToggleAttach && \(/.test(card)) return 'the composer has no attach control'
      if (!/\{p\.attachOpen \? '−' : '\+'\}/.test(card)) return 'the control is not a "+"'
      // ⚠ LINKS TOO, SAME CONTROL (§2). Charlie asked for both in the obvious place; a "+"
      // that only takes files sends him hunting for the link box he was promised.
      const mat = src['components/lex/YourMaterial.tsx']
      if (!/placeholder="Paste a link"/.test(mat)) return 'the panel takes no links'
      return /type="file"/.test(mat) ? null : 'the panel takes no files'
    },
    break: (src) => ({
      ...src,
      'components/lex/ElicitationCards.tsx': src['components/lex/ElicitationCards.tsx']
        .split('p.onToggleAttach && (').join('false && ('),
    }),
  },
  {
    name: '§2 the re-run is on the page in EVERY state, and says what it will do',
    // ⚠⚠ THE OLD ONE WAS INVISIBLE FOUR WAYS: gated on `(finished || stopped)`, gated again
    // on `canStart`, and at the bottom of the page under the findings. A running build, a
    // blocked one, or a user who had not scrolled saw nothing at all — which is how Charlie
    // came to ask Lex to do it in conversation.
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      const i = c.indexOf('25-K §2 — THE RE-RUN, PRESENT, NOT CONDITIONAL')
      if (i < 0) return 'the persistent re-run block is gone'
      const block = c.slice(i, i + 5200)
      if (!/\{latest && ideaId && \(/.test(block)) return 'the re-run is conditional on the build having finished again'
      if (!/It is running now/.test(block)) return 'a running build shows no re-run state at all'
      if (!/blockedReason/.test(block)) return 'a blocked re-run does not say why'
      // ⚠⚠ REPOINTED BY 25-L §1. The two mode buttons MOVED INTO THE RE-RUN DIALOGUE,
      // because choosing a price before being asked the only question that changes the
      // result is the wrong order. The property 25-K was protecting — both routes offered,
      // the expensive one explicit, and each saying what it costs — still holds; it now
      // holds one screen further in, so the assertion follows it rather than forbidding the
      // improvement. The button that remains here must still OPEN that dialogue.
      if (!/Re-run this idea…/.test(block)) return 'the re-run control no longer opens the dialogue'
      const dialogue = read('components/lex/RerunDialogue.tsx')
      if (!/Redraft from what I found/.test(dialogue)) return 'the cheap route is not offered'
      if (!/Search again from scratch/.test(dialogue)) return 'the expensive route is not offered'
      // §2: "The re-run states what it will do … and what each costs."
      return /estimateLine/.test(dialogue) ? null : 'neither route says what it costs'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('{latest && ideaId && (').join('{(finished || stopped) && ideaId && ('),
    }),
  },
  {
    name: '§2 asked to do something the platform controls, Lex gives DIRECTIONS, not a refusal',
    run: (src) => {
      // ⚠ THE MAP IS BUILT FROM THE STAGE TABLE, so a renamed stage cannot leave Lex
      // directing users to a place with a different name on the door.
      for (const st of LEX_STAGES) {
        if (!PLATFORM_CONTROLS.includes(st.name)) return `the control map never mentions ${st.name}`
      }
      if (!/never a bare "I can't"/.test(PLATFORM_CONTROLS)) return 'the rule against a bare refusal is gone'
      if (!/Redraft from what I found/.test(PLATFORM_CONTROLS)) return 'the re-run control is not named as it is labelled'
      // And it has to actually reach the prompt.
      const client = src['lib/lex/lex-client.ts']
      return /\$\{PLATFORM_CONTROLS\}/.test(client) ? null : 'the map is written but never injected into the prompt'
    },
    break: (src) => ({
      ...src,
      'lib/lex/lex-client.ts': src['lib/lex/lex-client.ts'].split('${PLATFORM_CONTROLS}').join(''),
    }),
  },

  // ═══ §3 — STAGE 2: THE TASK LIST IS THE POINT ════════════════════════════
  {
    name: '§3 the left column leads with the worklist and the chat is BENEATH it',
    run: (src) => {
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      // ⚠ 25-L §6 gave `<WorkList>` a fourth prop, so it wraps across lines. Matched on
      // the tag rather than on one formatting of its attributes — an assertion that a
      // component is RENDERED must not fail because Prettier moved a line.
      const list = c.indexOf('<WorkList')
      const chat = c.indexOf('<ChatPanel')
      if (list < 0) return 'there is no worklist'
      if (chat < 0) return 'the chat is gone'
      if (list > chat) return 'the chat is above the worklist — the column is a transcript again'
      // §3.2 — and the one-line "what this stage is" between them.
      return /stageByKey\(lexStage\)\.purpose/.test(c) ? null : 'the column never says what this stage is'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split('stageByKey(lexStage).purpose').join("''"),
    }),
  },
  {
    name: '§3 the list is ORDERED — contradictions, then decisions, then reading, then gaps',
    // ⚠ 25-C §3b's ordering, and it is not a styling choice: "I first concluded X; the
    // evidence says Y" is the most valuable sentence a build produces, and it was buried.
    run: () => {
      const keys = tasksFrom(AGENDA, [], 'strategy').map((t) => t.key)
      const want = ['contradictions', 'decisions', 'reading', 'gaps']
      return keys.join(',') === want.join(',') ? null : `the order is ${keys.join(',')}`
    },
    control: () => {
      // A worklist that led with the reading would pass a "the list exists" check and fail
      // the only property that matters.
      const shuffled = tasksFrom({ ...AGENDA, contradictions: [] }, [], 'strategy').map((t) => t.key)
      return shuffled[0] === 'contradictions' ? null : 'rejected'
    },
  },
  {
    name: '§3 only the gaps that are the USER\'S to close reach the user\'s list',
    // A `research` gap is our job and a `limitation` is nobody's. Putting either on the
    // list would be telling the user to do our work, or work that cannot be done.
    run: () => {
      const gaps = tasksFrom(AGENDA, [], 'strategy').find((t) => t.key === 'gaps')
      if (!gaps) return 'the only-you gap never reaches the list'
      return gaps.count === 1 ? null : `${gaps.count} gaps listed — a research or limitation gap leaked in`
    },
    // ⚠ AN AGENDA WITH NOTHING BUT OUR OWN WORK ON IT MUST PRODUCE NO ROW. Without this,
    // a `tasksFrom` that listed every gap regardless of tag would still satisfy "count === 1"
    // on the fixture above by luck of how many of each kind it happens to hold.
    control: () => {
      const oursOnly = {
        ...AGENDA,
        gaps: AGENDA.gaps.filter((g) => g.task !== 'only-you'),
      }
      return tasksFrom(oursOnly, [], 'strategy').some((t) => t.key === 'gaps')
        ? null
        : 'rejected'
    },
  },
  {
    name: '§3 carried over unchanged: the honest empty state and the FROM LEX provenance chips',
    // §3: these work and the brief says to keep them. A sprint that rebuilt the column
    // around them could drop either without anyone noticing until the pilot.
    run: (src) => {
      // ⚠ THE STRING LIVES IN `question-headings.ts` (`statedGap`) AND THE CHIP IN
      // `FieldsPanel` — not, as the first version of this check assumed, both in the panel
      // that renders them. A carry-over assertion pointed at the wrong file passes or fails
      // for reasons that have nothing to do with the thing it is protecting.
      const headings = src['lib/lex/question-headings.ts']
      if (!/which is not the same as nothing existing/.test(headings)) return 'the honest empty state is gone'
      const fields = src['components/lex/FieldsPanel.tsx']
      return /from Lex<\/span>/.test(fields) ? null : 'the "from Lex" provenance chips are gone'
    },
    break: (src) => ({
      ...src,
      'lib/lex/question-headings.ts': src['lib/lex/question-headings.ts']
        .split('which is not the same as nothing existing').join('x'),
    }),
  },

  // ═══ §4 — STAGE 3 IS A STAGE ═════════════════════════════════════════════
  {
    name: '§4 the Deepening has its own stage, its own screen and its own worklist',
    run: (src) => {
      const page = src['app/ideas/create/page.tsx']
      if (!/params\.stage === 'deepening'/.test(page)) return 'nothing routes to stage 3'
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      if (!/lexStage === 'deepening' \? \(/.test(c)) return 'stage 3 renders the same middle column as stage 2'
      if (!/<DeepeningPanel/.test(c)) return 'the deepening panel is not rendered'
      // The worklist follows the stage, which is what makes it "the same shape as §3".
      return /<WorkList[\s\S]{0,200}?scope=\{lexStage\}/.test(c)
        ? null
        : 'the worklist does not follow the stage'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split("lexStage === 'deepening' ? (").join('false ? ('),
    }),
  },
  {
    name: '§4 stage 3\'s worklist names the passes that have not run, apart from the ones that FAILED',
    // A list that merged them would tell the user to "run" something that already tried and
    // stopped — the same blurring of two states §18 forbids for a degraded model call.
    run: () => {
      const keys = tasksFrom(AGENDA, PASSES, 'deepening').map((t) => t.key)
      if (!keys.includes('passes')) return 'an unrun pass is not on the list'
      if (!keys.includes('failed')) return 'a failed pass is not distinguished from an unrun one'
      return keys[0] === 'issues' ? null : `the list leads with ${keys[0]}, not the issues raised`
    },
    // ⚠ THE CONTROL IS "NO PASSES → NO PASS ROWS", and the first version of it was
    // WRITTEN BACKWARDS: it returned null — which this harness reads as "the broken
    // version passed" — in the case where the property actually held. A control that
    // cannot fail and a control that always fails are the same bug; this one was caught by
    // `--self-test`, which is what `--self-test` is for.
    control: () => (
      tasksFrom(AGENDA, [], 'deepening').some((t) => t.key === 'passes' || t.key === 'failed')
        ? null
        : 'rejected'
    ),
  },
  {
    name: '§4 the worklist rows are JUMPS — every anchor it names exists on a panel',
    run: (src) => {
      const anchors = new Set(
        [...tasksFrom(AGENDA, PASSES, 'strategy'), ...tasksFrom(AGENDA, PASSES, 'deepening')]
          .map((t) => t.anchor).filter(Boolean) as string[],
      )
      const markup = src['components/lex/AgendaPanel.tsx'] + src['components/lex/DeepeningPanel.tsx']
      const missing = [...anchors].filter((a) => !markup.includes(`"${a}"`))
      return missing.length ? `no such anchor: ${missing.join(', ')}` : null
    },
    break: (src) => ({
      ...src,
      'components/lex/AgendaPanel.tsx': src['components/lex/AgendaPanel.tsx']
        .split('"agenda-contradictions"').join('"x"'),
    }),
  },

  // ═══ §5 — NAVIGATION ═════════════════════════════════════════════════════
  {
    name: '§5 the nav is in the brief\'s order, and Legislation is gone from both navs',
    run: (src) => {
      // ⚠ THE LINK LABELS, NOT THE FILE. A bare `/Legislation/` over the source flagged
      // the comment recording that the item was REMOVED — a check that fails on its own
      // changelog.
      const nav = stripComments(src['components/PublicNav.tsx'])
      if (/>\s*Legislation\s*</.test(nav)) return 'the Legislation item is still in the nav'
      const desktop = navOrder(nav, 'hidden items-center gap-6 md:flex')
      if (desktop.join(' · ') !== NAV_ORDER.join(' · ')) return `desktop order is ${desktop.join(' · ')}`
      // ⚠ THE DRAWER TOO. A phone menu in a different order is a second thing to learn, and
      // the phone is where a pilot tester is most likely to be.
      const mobile = navOrder(nav, 'border-t border-border px-4 py-4 md:hidden')
      return mobile.join(' · ') === NAV_ORDER.join(' · ') ? null : `mobile order is ${mobile.join(' · ')}`
    },
    break: (src) => ({
      ...src,
      'components/PublicNav.tsx': src['components/PublicNav.tsx']
        .replace('            About\n', '            Legislation\n'),
    }),
  },

  // ═══ THE VOCABULARY IS SHARED, NOT RESTATED ══════════════════════════════
  {
    name: 'every stage name on a screen comes from LEX_STAGES, never typed out again',
    // ⚠ THE FAILURE THIS FORBIDS IS 25-J's, ONE LEVEL UP: a rename that reaches one file
    // and not the screen. Nothing may hardcode "The Strategy"; it comes from the table or
    // it does not appear.
    run: (src) => {
      const offenders: string[] = []
      for (const [path, content] of Object.entries(src)) {
        if (path === 'lib/lex/stages.ts') continue
        for (const st of LEX_STAGES) {
          const lit = new RegExp(`['"\`>]\\s*${st.name}\\s*['"\`<]`)
          for (const line of content.split('\n')) {
            const t = line.trimStart()
            if (t.startsWith('//') || t.startsWith('*')) continue
            if (lit.test(line)) offenders.push(`${path}: ${line.trim().slice(0, 80)}`)
          }
        }
      }
      return offenders.length ? `hardcoded stage names:\n       ${offenders.join('\n       ')}` : null
    },
    control: () => {
      const name = stageByKey('strategy').name
      const lit = new RegExp(`['"\`>]\\s*${name}\\s*['"\`<]`)
      return lit.test(`  <h2>${name}</h2>`) ? 'rejected' : null
    },
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25k${selfTest ? ' --self-test' : ''} ──`)
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
      uncontrolled++; console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported behaviour'); continue
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
