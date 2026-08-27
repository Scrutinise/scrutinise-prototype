// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25j — the ideas hub, one voice, and where consequences appear.
//
// ⚠ §1's assertion is a SWEEP, not a spot-check. The brief is explicit: "Sweep the whole
// app for the inconsistency rather than fixing the two Charlie noticed." So the check
// walks every component and page and fails on ANY collection heading still in the second
// person — which means a new screen that says "Your ideas" fails on the day it is written,
// not on the day somebody notices.
//
// Offline: no database, no API key, no network.
//
//   npm run check:lex-25j
//   npm run check:lex-25j -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { QUESTION_HEADINGS, HEADING_ORDER, isHeadingKey, headingFor } from '../lib/lex/question-headings'
import { PASSES } from '../lib/lex/deepening-config'
import { hasRealTitle, hrefFor, PLACEHOLDER_TITLE, type MyIdea } from '../components/lex/MyIdeasList'
import { describeMembers, MEMBERS_SHOWN } from '../lib/lex/statutory-consequences'
import type { InboundRow } from '../lib/lex/statutory-graph'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').split('\r\n').join('\n')

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
 * §1's rule, as a function so a control can plant a violation and watch it fire.
 *
 * A heading IS the whole label, so the phrase must occupy the entire text node or string:
 * bounded left by `>` or a quote, bounded right by `<`, a quote, or an opening bracket for
 * a count. Embedded in a sentence it is left alone — "Export all your ideas, contributions
 * and votes" is correct English and none of §1's business.
 */
function secondPersonHeadings(files: Array<[string, string]>): string[] {
  const banned =
    /(?:>|['"`])\s*Your\s+(?:previous\s+)?(?:ideas|communities|teams|listings|matches)\s*(?:\(|<|['"`])/i
  const out: string[] = []
  for (const [path, content] of files) {
    for (const line of content.split('\n')) {
      // Skip comments — including the ones that document this very rule.
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
      if (banned.test(line)) out.push(`${relative('.', path)}: ${line.trim().slice(0, 80)}`)
    }
  }
  return out
}

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
  control?: () => string | null
}

const FILES = [
  'components/ui/Navbar.tsx',
  'components/lex/MyIdeasList.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/build/page.tsx',
  'app/ideas/create/CreateIdeaClient.tsx',
  'lib/lex/question-headings.ts',
  'lib/lex/deepening-config.ts',
  'lib/lex/deepening-jobs.ts',
]
function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

const row = (gid: string, prov: string | null): InboundRow => ({
  sourceDocUri: gid, sourceGid: gid, sourceProvisionRef: prov,
  citationText: 'within the meaning of section 3 of the target Act 2010 for these purposes',
  sourceType: 'primary', detection: 'text', targetProvisionRef: null,
})

const CHECKS: Check[] = [
  // ═══ §1 — ONE VOICE, SWEPT ═══════════════════════════════════════════════
  {
    name: '§1 no screen names the user\'s own collections in the second person',
    run: () => {
      // ⚠ COLLECTION HEADINGS ONLY. The product still says "your" when it TALKS to the
      // user — "Your answer is worth more on a question people are already reading" is
      // correct English and must not be swept. What §1 is about is the label on a list of
      // the user's own things, where the app was saying both at once.
      //
      // ⚠ THIS CHECK FIRED ON CORRECT PROSE ON ITS FIRST RUN, and the fix is the rule, not
      // an exclusion list. It matched `ideas?`, so "Your idea has reached Parliament" and
      // "Ways to improve your idea" came back as violations. They are the product SPEAKING
      // to the user about one idea, which is correct English and none of §1's business.
      //
      // Narrowing to the plural was not enough either: "Export all your ideas, contributions
      // and votes" and "It will disappear from your ideas straight away" are also sentences.
      //
      // ⚠ THE REAL DISTINCTION IS HEADING vs SENTENCE, and a heading IS THE WHOLE LABEL.
      // So the phrase must occupy the entire text node or string — bounded on the left by
      // `>` or a quote, and on the right by `<`, a quote, or an opening bracket (a count
      // like "My ideas (3)"). Embedded in prose, it is left alone. That is a rule about
      // structure rather than a list of exceptions, so a NEW screen with a
      // `<h2>Your ideas</h2>` fails on the day it is written.
      const offenders = secondPersonHeadings(screens().map((f) => [f, read(f)]))
      return offenders.length ? `still second-person:\n       ${offenders.join('\n       ')}` : null
    },
    // ⚠ THE CONTROL PLANTS A HEADING. Without it this check passes trivially if the regex
    // ever stops matching anything at all — which is exactly what happened twice while it
    // was being narrowed.
    control: () => {
      const planted = secondPersonHeadings([
        ['fake/Screen.tsx', '  return <h2 className="x">Your ideas</h2>\n'],
      ])
      return planted.length ? 'rejected' : null
    },
  },
  {
    name: '§2 the nav says "My ideas" — and the STAGE is still called Create',
    run: (src) => {
      const nav = src['components/ui/Navbar.tsx']
      if (!/label: 'My ideas', href: '\/ideas\/new'/.test(nav)) return 'the nav item was not renamed'
      // ⚠⚠ THE FIVE-STAGE VOCABULARY IS NOT NAVIGATION. docs/CLAUDE.md §4: use exactly,
      // never substitute. A sweep that renamed STAGE_1 would have broken the vocabulary the
      // whole product shares, and it would have looked like a tidy-up.
      const card = read('components/IdeaCard.tsx')
      return /STAGE_1: 'Create'/.test(card) ? null : 'the STAGE_1 label was renamed — the five-stage vocabulary is broken'
    },
    break: (src) => ({
      ...src,
      'components/ui/Navbar.tsx': src['components/ui/Navbar.tsx']
        .replace("label: 'My ideas', href: '/ideas/new'", "label: 'Create', href: '/ideas/new'"),
    }),
  },

  // ═══ §2 — THE HUB ════════════════════════════════════════════════════════
  {
    name: '§2 an untitled idea is identified by the user\'s own words, not "Untitled idea"',
    run: () => {
      const c = read('components/lex/MyIdeasList.tsx')
      if (!/In your words:/.test(c)) return 'the excerpt is not labelled as the user\'s words'
      if (!/hasRealTitle\(i\.title\)/.test(c)) return 'the component does not choose between title and excerpt'
      // ⚠ THE PLACEHOLDER TEST IS EXACT. A heuristic ("looks generated") would misfire the
      // day someone genuinely names an idea "Untitled", and would do it silently.
      if (hasRealTitle(PLACEHOLDER_TITLE)) return `"${PLACEHOLDER_TITLE}" is treated as a real title`
      return hasRealTitle('Untitled thoughts on buses') ? null : 'a real title containing "Untitled" is rejected'
    },
  },
  {
    name: '§2 a built idea opens on the proposal; an unbuilt one opens the build',
    run: () => {
      const base: MyIdea = {
        ideaId: 'abc', title: PLACEHOLDER_TITLE, excerpt: 'x', stage: 'STAGE_1',
        elicitationStatus: 'IN_PROGRESS', buildStatus: null, passesComplete: null,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }
      if (hrefFor(base) !== '/ideas/build?ideaId=abc') return 'an unbuilt idea does not open the build'
      // 25-G §2: "the build is how it was made, the proposal is the work."
      return hrefFor({ ...base, buildStatus: 'DONE' }) === '/ideas/create?ideaId=abc'
        ? null
        : 'a built idea does not land on the proposal'
    },
  },
  {
    name: '§2 the hub list shows ONLY before an idea exists — the transition is a transition',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/<MyIdeasList ideas=\{recent\} hiddenEmpty=\{hiddenEmpty\} \/>/.test(c)) {
        return 'the hub list is not rendered'
      }
      // ⚠ GATED ON `!ideaId`. A list that persisted into the working view would be a
      // permanent invitation to abandon what you are doing.
      return /\{!ideaId && elicit\.phase === 'QUESTION' && \(/.test(c)
        ? null
        : 'the list is not gated on there being no idea yet'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace("{!ideaId && elicit.phase === 'QUESTION' && (", '{true && ('),
    }),
  },
  {
    name: '§2 25-I §1 HELD — nothing is created by arriving',
    run: (src) => {
      // ⚠ THE BRIEF ASKS FOR THIS EXPLICITLY: "Keep: ideas are created on the first answer,
      // never on page load (25-I §1). Verify the sweep held." A hub that re-introduced the
      // mint would refill the list it exists to make trustworthy.
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      const boot = c.slice(c.indexOf('// ── Boot'), c.indexOf('const refresh = useCallback'))
      if (/fetch\('\/api\/ideas'|getJson\('\/api\/ideas'/.test(boot)) {
        return 'the boot effect POSTs /api/ideas again — a page load mints a draft'
      }
      return /const ensureIdea = useCallback/.test(c) ? null : 'the first-answer creation path is gone'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace('if (blankState) setElicit(blankState)', "await getJson('/api/ideas', cid, {})"),
    }),
  },

  // ═══ §3 — PROGRESSIVE DISCLOSURE ═════════════════════════════════════════
  {
    name: '§3 panels collapse to labelled EDGES and follow content until the user decides',
    run: (src) => {
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      if (!/function PanelEdge/.test(c)) return 'a collapsed panel vanishes rather than becoming an edge'
      if (!/fields: boolean \| null; background: boolean \| null/.test(c)) {
        return 'the panels cannot tell "not yet decided" from "closed"'
      }
      // The restore control has to exist in both directions.
      if (!/setPanelOpen\(\(p\) => \(\{ \.\.\.p, fields: true \}\)\)/.test(c)) return 'no control restores a collapsed panel'
      return /setPanelOpen\(\(p\) => \(\{ \.\.\.p, fields: false \}\)\)/.test(c) ? null : 'no control collapses an open panel'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split('function PanelEdge').join('function PanelGone'),
    }),
  },
  {
    name: '§3 returning to a BUILT idea lands on the proposal',
    run: (src) => {
      const p = src['app/ideas/build/page.tsx']
      // 25-G §2, re-asserted here because §3 depends on it and §2 moved the surrounding code.
      if (!/status: \{ in: \['DONE', 'FAILED', 'CANCELLED'\] \}/.test(p)) {
        return 'the landing redirect no longer keys on a finished build'
      }
      return /redirect\(`\/ideas\/create\?ideaId=\$\{params\.ideaId\}`\)/.test(p)
        ? null
        : 'a returning user does not land on the proposal'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/page.tsx': src['app/ideas/build/page.tsx']
        .replace('redirect(`/ideas/create?ideaId=${params.ideaId}`)', 'void built'),
    }),
  },

  // ═══ §4 — WHERE THE USER MEETS STATUTORY CONSEQUENCES ════════════════════
  {
    name: '§4 consequences have their OWN question heading, not LAW_NOW',
    run: () => {
      if (!isHeadingKey('REFERS_TO_THIS')) return 'the heading is not registered'
      const h = headingFor('REFERS_TO_THIS')
      if (!h || !/refers to this law/i.test(h.heading)) return 'the heading is not the one §4 names'
      const pass = PASSES.find((p) => p.key === 'STATUTORY_CONSEQUENCES')
      if (!pass) return 'the pass is missing'
      // ⚠ NOT LAW_NOW. "What the law says now" and "what would break if you changed it" are
      // two questions; sharing a heading made the pass invisible among the legal map.
      if (pass.heading !== 'REFERS_TO_THIS') return `the pass still declares ${pass.heading}`
      // The panel order IS this array's order — it must sit beside LAW_NOW, not at the end.
      const i = HEADING_ORDER.indexOf('REFERS_TO_THIS')
      return i === HEADING_ORDER.indexOf('LAW_NOW') + 1
        ? null
        : `it is at position ${i}, not immediately after "what the law says now"`
    },
  },
  {
    name: '§4 the written row carries the heading, the quote, the members AND the coverage',
    run: (src) => {
      const j = src['lib/lex/deepening-jobs.ts']
      if (!/headingKey: 'REFERS_TO_THIS'/.test(j)) return 'the row is filed under the wrong heading'
      if (!/One of them, in \$\{g\.evidence\.sourceGid\}/.test(j)) return 'the quotation is not written into the row'
      if (!/describeMembers\(g\)/.test(j)) return 'the group does not open to its members'
      return /\$\{coverage\}/.test(j) ? null : 'the coverage statement is not adjacent to the count'
    },
    break: (src) => ({
      ...src,
      'lib/lex/deepening-jobs.ts': src['lib/lex/deepening-jobs.ts']
        .split('describeMembers(g),').join("'',"),
    }),
  },
  {
    name: '§4 the member list is bounded, deduplicated, and counts what it left out',
    run: () => {
      const many = Array.from({ length: 40 }, (_, i) => row(`act/${i}`, 'section-1'))
      const text = describeMembers({
        kind: 'bare-reference', label: 'x', members: many, exemplar: null, unquotable: 0,
      })
      const listed = (text.match(/\n {2}· /g) ?? []).length
      if (listed !== MEMBERS_SHOWN) return `listed ${listed}, expected the ${MEMBERS_SHOWN} cap`
      if (!/…and 28 more provisions not listed here\./.test(text)) return `the tail is not counted: ${text.slice(-120)}`
      // ⚠ DEDUPLICATED ON (document, provision) — two references in one section are ONE
      // place to go and read, and counting it twice inflates the apparent work.
      const dupes = describeMembers({
        kind: 'bare-reference', label: 'x',
        members: [row('act/a', 'section-1'), row('act/a', 'section-1'), row('act/b', 'section-2')],
        exemplar: null, unquotable: 0,
      })
      return /2 distinct provisions/.test(dupes) ? null : `duplicates were counted: ${dupes.slice(0, 90)}`
    },
  },
  {
    name: '§4 the heading library still declares every heading exactly once',
    run: () => {
      const keys = QUESTION_HEADINGS.map((h) => h.key)
      const dupe = keys.find((k, i) => keys.indexOf(k) !== i)
      if (dupe) return `${dupe} is declared twice`
      return keys.length === HEADING_ORDER.length ? null : 'the order and the library disagree'
    },
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25j${selfTest ? ' --self-test' : ''} ──`)
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
