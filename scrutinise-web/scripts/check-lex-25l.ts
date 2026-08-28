// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25l — the re-run dialogue, the rejection log, the resource library, the
// panels, and the blind-first graph review.
//
// ⚠ THE ASSERTION THIS FILE EXISTS FOR IS §5's ORDER. Everything else here is ordinary
// guarding; "our assessment is not in the response until the user has judged" is a property
// that is true today, invisible in the UI, and would be destroyed by one well-meaning line
// spreading the assessment into the GET. Nothing but a check will catch that.
//
// ⚠ AND EVERY COMPONENT THIS SPRINT ADDS IS PROVED REACHABLE (docs/CLAUDE.md §23.1). 25-J's
// rename shipped into a file nothing renders and `check:lex-25j` passed for a sprint with a
// firing negative control. A control cannot catch that; a reachability walk can.
//
// Offline: no database, no API key, no network.
//
//   npm run check:lex-25l
//   npm run check:lex-25l -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertReachable } from './reachability'
import {
  QUESTION_HEADINGS, HEADING_ORDER, statedGap, type HeadingKey,
} from '../lib/lex/question-headings'
import { headingsWithProducers } from '../lib/lex/heading-map'
import { critiqueBlock } from '../lib/lex/build-config'
import {
  isVideoUrl, isKnownPaywall, REJECTION_KINDS, rejectionsAsGaps, VIDEO_MESSAGE,
  type RejectionRow,
} from '../lib/lex/material-rejection'
import {
  normaliseLayout, DEFAULT_LAYOUT, MIN_WIDTH, PANEL_ROLES, PANEL_KEYS,
} from '../lib/lex/panel-layout'
import { USER_VERDICTS, isUserVerdict } from '../lib/graph/claim-review'
import { RERUN_PROMPT_HEADING, RERUN_PROMPT_BODY } from '../components/lex/RerunDialogue'

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
  'lib/lex/build-config.ts',
  'lib/lex/build.ts',
  'lib/lex/build-client.ts',
  'lib/lex/build-smart.ts',
  'lib/lex/user-material.ts',
  'lib/lex/material-rejection.ts',
  'lib/lex/question-panel.ts',
  'lib/lex/panel-layout.ts',
  'lib/lex/sources.ts',
  'lib/graph/claim-review.ts',
  'lib/documents/build-proposal.ts',
  'lib/documents/proposal-snapshot.ts',
  'components/lex/RerunDialogue.tsx',
  'components/lex/QuestionPanel.tsx',
  'components/lex/ClaimReview.tsx',
  'components/lex/PanelDivider.tsx',
  'components/lex/WorkList.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/create/CreateIdeaClient.tsx',
  'app/api/graph/claim/route.ts',
  'app/api/ideas/[id]/material/route.ts',
  'app/api/ideas/[id]/build/route.ts',
  'app/api/ideas/[id]/sources/route.ts',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

/** Every component this sprint adds, and the surfaces they must be reachable from. */
const NEW_COMPONENTS = [
  'components/lex/RerunDialogue.tsx',
  'components/lex/ClaimReview.tsx',
  'components/lex/PanelDivider.tsx',
  'components/lex/usePanelLayout.ts',
]

const CHECKS: Check[] = [
  // ═══ §1 — THE RE-RUN DIALOGUE ════════════════════════════════════════════
  {
    name: '§1 the re-run opens a DIALOGUE, and asks Charlie\'s question',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      // ⚠⚠ THE BUTTON MUST NOT FIRE A BUILD. A re-run that starts on the click spends four
      // minutes reproducing the draft the user was unhappy with.
      if (!/onClick=\{\(\) => setRerunOpen\(true\)\}/.test(c)) return 'the re-run button still fires directly'
      if (!/<RerunDialogue/.test(c)) return 'the dialogue is never rendered'
      if (!RERUN_PROMPT_HEADING.startsWith('You')) return 'the heading is not the brief\'s'
      // §1's wording, close to Charlie's: the three words are the question's whole job.
      for (const w of ['missing', 'misunderstood', 'misguided']) {
        if (!RERUN_PROMPT_BODY.includes(w)) return `the question does not ask what was ${w}`
      }
      return null
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('onClick={() => setRerunOpen(true)}').join("onClick={() => startBuild('FULL')}"),
    }),
  },
  {
    name: '§1 the dialogue takes text, files AND links before it starts',
    run: (src) => {
      const d = src['components/lex/RerunDialogue.tsx']
      if (!/<textarea/.test(d)) return 'there is nowhere to write the critique'
      // ⚠ THE SAME COMPONENT THE COMPOSER USES, so a document added here goes through the
      // same pipeline and is read on the spot rather than waiting for the build.
      if (!/<YourMaterial/.test(d)) return 'files and links cannot be added before the run'
      return /estimateLine/.test(d) ? null : 'it does not say what the run will cost'
    },
    break: (src) => ({
      ...src,
      'components/lex/RerunDialogue.tsx': src['components/lex/RerunDialogue.tsx']
        .split('<YourMaterial').join('<Nothing'),
    }),
  },
  {
    name: '§1 the critique reaches the passes WITH AN INSTRUCTION TO ACT ON IT',
    // ⚠⚠ THE INSTRUCTION IS THE POINT, NOT THE TEXT. 25-F found that material supplied to a
    // pass without an instruction is material the pass ignores — the same finding as
    // CLAUDE.md §24 from the other end. A block that merely carries the words would satisfy
    // "the critique reaches the passes" and change nothing about the output.
    run: () => {
      const block = critiqueBlock('The costings are wrong and you ignored the Scottish position.')
      if (!block.includes('The costings are wrong')) return 'the critique is not carried at all'
      if (!/ACT ON THIS/.test(block)) return 'it is carried as a note, not as an instruction'
      // ⚠ AND IT MUST NOT DEMAND AGREEMENT. A user can be wrong about what was wrong; a pass
      // told to obey would produce a draft that flatters them.
      if (!/do NOT agree with a criticism the evidence does not/.test(block)) {
        return 'the pass is told to obey rather than to answer'
      }
      // Testimony, never a source.
      return /never cite them as evidence/.test(block) ? null : 'the critique is not labelled as testimony'
    },
    control: () => (critiqueBlock('   ') === '' ? 'rejected' : null),
  },
  {
    name: '§1 the critique is stored against the build that RECEIVED it, and shown back',
    run: (src) => {
      if (!/ctx\.userCritique = row\.userCritique/.test(src['lib/lex/build.ts'])) {
        return 'the running build does not read its own critique'
      }
      if (!/userCritique: userCritique\.trim\(\)/.test(src['lib/lex/build.ts'])) {
        return 'the critique is never written to the build row'
      }
      return /latest\?\.userCritique && \(/.test(src['app/ideas/build/BuildIdeaClient.tsx'])
        ? null
        : 'the user never sees what this run was asked to fix'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts']
        .split('ctx.userCritique = row.userCritique').join('// removed'),
    }),
  },

  // ═══ §2 — MATERIAL WE CANNOT READ ════════════════════════════════════════
  {
    name: '§2 a video link is refused with the transcript route named, and never fetched',
    run: (src) => {
      if (!isVideoUrl('https://www.youtube.com/watch?v=abc')) return 'a YouTube link is not recognised'
      if (!isVideoUrl('https://youtu.be/abc')) return 'the short form is not recognised'
      // ⚠ NOT A KEYWORD MATCH. A false positive refuses something we could have read, and
      // tells the user we cannot do something we can.
      if (isVideoUrl('https://www.bbc.co.uk/news/uk-politics-video-explainer')) {
        return 'an article whose URL contains "video" is refused'
      }
      if (!/transcript/i.test(VIDEO_MESSAGE)) return 'the refusal does not name the way in'
      // ⚠⚠ §2 DEFERS TRANSCRIPT FETCHING DELIBERATELY. Nothing may request one.
      const all = Object.values(src).join('\n')
      return /youtubei|timedtext|get_video_info|youtube-transcript/i.test(all)
        ? 'something is fetching YouTube transcripts — §2 defers that on purpose'
        : null
    },
    control: () => (isVideoUrl('https://example.com/a-report.pdf') ? null : 'rejected'),
  },
  {
    name: '§2 every refusal carries a KIND, and every kind is logged',
    run: (src) => {
      const m = src['lib/lex/user-material.ts']
      // A refusal with no kind fills the log with `unknown`, which is the shape of the
      // problem this section exists to fix, one level down.
      //
      // ⚠ THE FIRST ARGUMENT IS EXTRACTED AND CHECKED AGAINST THE VOCABULARY, rather than
      // matched as a quoted literal. The narrow version flagged
      // `new MaterialRejected(walled ? 'paywalled' : 'unfetchable', …)` — which carries a
      // kind perfectly well — and would have forced the code to be made worse to satisfy a
      // grep. It still rejects a bare variable, because a variable is not a kind anybody has
      // checked.
      for (const call of m.match(/new MaterialRejected\(\s*[^,]+,/g) ?? []) {
        const firstArg = call.slice(call.indexOf('(') + 1, call.lastIndexOf(',')).trim()
        const quoted = firstArg.match(/'([a-z-]+)'/g)?.map((q) => q.slice(1, -1)) ?? []
        if (!quoted.length) return `a refusal throws with no literal kind: ${firstArg.slice(0, 60)}`
        const unknown = quoted.filter((k) => !(REJECTION_KINDS as string[]).includes(k))
        if (unknown.length) return `a refusal uses a kind nothing knows: ${unknown.join(', ')}`
      }
      if (!isKnownPaywall('https://www.ft.com/content/x')) return 'a known paywall is not recognised'
      return /await logRejection\(/.test(src['app/api/ideas/[id]/material/route.ts'])
        ? null
        : 'the route never records a refusal'
    },
    break: (src) => ({
      ...src,
      'lib/lex/user-material.ts': src['lib/lex/user-material.ts']
        .replace("new MaterialRejected('no-text',", 'new MaterialRejected('),
    }),
  },
  {
    name: '§2 an unreadable item becomes a gap only the USER can close',
    // ⚠ A video's transcript and a paywalled article's text are things only the person
    // holding them can fetch. Filing them as `research` would put them on OUR list, where
    // nothing would ever happen to them.
    run: () => {
      const rows: RejectionRow[] = [
        { id: '1', kind: 'video', target: 'https://youtu.be/a', detail: 'x', createdAt: '2026-08-28' },
        { id: '2', kind: 'video', target: 'https://youtu.be/a', detail: 'x', createdAt: '2026-08-28' },
        { id: '3', kind: 'not-a-url', target: 'htp://x', detail: 'x', createdAt: '2026-08-28' },
      ]
      const gaps = rejectionsAsGaps(rows)
      if (gaps.length !== 1) return `${gaps.length} gaps from one video pasted twice and one typo`
      if (!REJECTION_KINDS.includes('video')) return 'the kind vocabulary lost `video`'
      return null
    },
    control: () => (rejectionsAsGaps([]).length ? null : 'rejected'),
  },

  // ═══ §3 — THE RESOURCE LIBRARY ═══════════════════════════════════════════
  {
    name: '§3a the panel opens on a CONTENTS list with a home button',
    run: (src) => {
      const p = src['components/lex/QuestionPanel.tsx']
      // ⚠ `null` IS THE DEFAULT AND THAT IS THE CHANGE. Thirteen headings rendered at once
      // is a scroll, and a scroll is where things go to be missed.
      if (!/useState<string \| null>\(null\)/.test(p)) return 'the panel does not default to the contents'
      if (!/setOpenKey\(null\)/.test(p)) return 'there is no way home'
      // A word, not a bare chevron: a user two items deep needs to know what it returns to.
      return /Contents/.test(p) ? null : 'the home control is unlabelled'
    },
    break: (src) => ({
      ...src,
      'components/lex/QuestionPanel.tsx': src['components/lex/QuestionPanel.tsx']
        .split('setOpenKey(null)').join('void 0'),
    }),
  },
  {
    name: '§3b the contents are DRIVEN FROM THE PASSES, and every producer\'s heading exists',
    run: () => {
      const producers = headingsWithProducers()
      // Every heading a producer declares must be a real heading in the vocabulary.
      const known = new Set<HeadingKey>(HEADING_ORDER)
      const unknown = [...producers].filter((h) => !known.has(h))
      if (unknown.length) return `a producer declares a heading nobody renders: ${unknown.join(', ')}`
      // ⚠ AND EVERY HEADING IS EITHER PRODUCED OR HONESTLY EMPTY. A heading with neither
      // would render "we looked and found nothing" for a question nothing ever asks.
      const orphans = QUESTION_HEADINGS.filter(
        (h) => !producers.has(h.key) && !/no pass|we|our/i.test(statedGap(h.key, 'no-producer')),
      )
      return orphans.length ? `${orphans.map((o) => o.key).join(', ')} is silently unanswerable` : null
    },
    control: () => {
      const producers = new Set<HeadingKey>(['LAW_NOW'])
      const known = new Set<HeadingKey>(HEADING_ORDER)
      return [...producers].every((h) => known.has(h)) ? 'rejected' : null
    },
  },
  {
    name: '§3c the smart pass\'s prognosis has its OWN heading, not "the case against"',
    // ⚠⚠ THIS IS WHY CHARLIE COULD NOT FIND IT. "How hard will this be to pass", the
    // barriers, the likelihood and what could go wrong were written with
    // `headingKey: 'AGAINST'` — filed among the objections. A prognosis is not an objection.
    run: (src) => {
      if (!HEADING_ORDER.includes('HOW_HARD')) return 'there is no home for the prognosis'
      if (!HEADING_ORDER.includes('KEY_SOURCES')) return 'there is no home for the reading list'
      const s = src['lib/lex/build-smart.ts']
      if (/headingKey: 'AGAINST',\s*$/m.test(s.slice(s.indexOf('recordPrognosis')))) {
        return 'the prognosis is filed under the case against again'
      }
      return /r\.title === READ_FIRST_TITLE \? 'KEY_SOURCES' : 'HOW_HARD'/.test(s)
        ? null
        : 'the prognosis rows do not choose their heading'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-smart.ts': src['lib/lex/build-smart.ts']
        .split("r.title === READ_FIRST_TITLE ? 'KEY_SOURCES' : 'HOW_HARD'").join("'AGAINST'"),
    }),
  },
  {
    name: '§3d the tags are NOT decorative — priority reaches the proposal document',
    run: (src) => {
      if (!/'PRIORITY'/.test(src['app/api/ideas/[id]/sources/route.ts'])) return 'the route cannot record a priority'
      if (!/prioritySources/.test(src['lib/documents/proposal-snapshot.ts'])) return 'the snapshot does not carry them'
      const doc = src['lib/documents/build-proposal.ts']
      if (!/priority\.map/.test(doc)) return 'the proposal document never prints them'
      // ⚠⚠ A FROZEN PRE-SPRINT SNAPSHOT HAS NO SUCH KEY, and re-rendering one must not
      // throw. Absent, empty and populated are three cases, not two — this was caught by a
      // fixture and would otherwise have been caught by a user opening last week's PDF.
      return /const priority = snapshot\.prioritySources/.test(doc)
        && /priority && snapshot\.sources\.length/.test(doc)
        ? null
        : 'a version minted before this sprint would throw on render'
    },
    break: (src) => ({
      ...src,
      'lib/documents/build-proposal.ts': src['lib/documents/build-proposal.ts']
        .split('priority && snapshot.sources.length').join('snapshot.sources.length'),
    }),
  },

  // ═══ §4 — PANEL BEHAVIOUR ════════════════════════════════════════════════
  {
    name: '§4 a panel cannot be dragged to unusability, and the clamp is on the SERVER too',
    run: () => {
      const squashed = normaliseLayout({
        open: { left: true, middle: true, right: true },
        width: { left: 0.01, middle: 0.01, right: 0.98 },
      })
      for (const k of PANEL_KEYS) {
        if (squashed.width[k] < MIN_WIDTH - 0.001) return `${k} came back at ${squashed.width[k]}`
      }
      // ⚠ AT LEAST ONE PANEL STAYS OPEN. All three closed is a blank screen with three
      // edges, and a user who reached it would think the app had crashed.
      const none = normaliseLayout({ open: { left: false, middle: false, right: false }, width: DEFAULT_LAYOUT.width })
      if (!PANEL_KEYS.some((k) => none.open[k])) return 'every panel can be closed at once'
      // Garbage repairs to the default rather than throwing — a stored value from an older
      // shape must not leave the user looking at a broken screen with no way back.
      return normaliseLayout('nonsense').width.left === DEFAULT_LAYOUT.width.left
        ? null
        : 'an unreadable layout does not fall back to the default'
    },
    control: () => {
      const raw = { open: DEFAULT_LAYOUT.open, width: { left: 0.01, middle: 0.01, right: 0.98 } }
      return raw.width.left < MIN_WIDTH ? 'rejected' : null
    },
  },
  {
    name: '§4 each panel says what it is FOR, from one shared table',
    run: (src) => {
      for (const k of PANEL_KEYS) {
        if (PANEL_ROLES[k].role.length < 20) return `${k} has no stated role`
      }
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      // Three headers, each printing its role from the table rather than a local string.
      const uses = c.match(/PANEL_ROLES\.(left|middle|right)\.role/g)?.length ?? 0
      return uses >= 3 ? null : `only ${uses} of the three panels states its role`
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split('PANEL_ROLES.right.role').join("''"),
    }),
  },

  // ═══ §6 — MOBILE ═════════════════════════════════════════════════════════
  {
    name: '§6 the mobile tab bar is at the BOTTOM and the draft tab carries a count',
    run: (src) => {
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      // ⚠ THE TOP OF A PHONE SCREEN IS WHERE A THUMB CANNOT REACH. The bar was there.
      if (!/lg:hidden fixed bottom-0/.test(c)) return 'the tab bar is not thumb-reachable'
      // ⚠ THE TASK LIST HAS TO COME TO THEM. On a phone the user cannot see the worklist
      // while doing anything else.
      if (!/badge = t === 'fields' \? waitingCount/.test(c)) return 'the draft tab carries no count'
      // ⚠ A NUMBER AND A WORD, NEVER A COLOURED DOT (docs/CLAUDE.md §21).
      return /aria-label=\{`\$\{badge\} waiting on you`\}/.test(c)
        ? null
        : 'the badge is a mark rather than a count'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .split('lg:hidden fixed bottom-0').join('lg:hidden'),
    }),
  },

  // ═══ §5 — THE ORDER IS THE MEASUREMENT ═══════════════════════════════════
  {
    name: '§5 OUR ASSESSMENT IS NOT IN THE RESPONSE UNTIL THE USER HAS JUDGED',
    // ⚠⚠ THE ONE ASSERTION THIS FILE EXISTS FOR. "Showing it first buys agreement, not
    // information." The property is invisible in the UI and would be destroyed by one
    // well-meaning line spreading the assessment into the GET — and every agreement rate
    // measured afterwards would be worthless without anything looking wrong.
    run: (src) => {
      const r = src['app/api/graph/claim/route.ts']
      const get = r.slice(r.indexOf('export async function GET'), r.indexOf('const PostSchema'))
      if (/assessment/.test(get.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
        return 'the GET returns our assessment — the experiment is over'
      }
      if (!/claim: found\.question/.test(get)) return 'the GET does not return the question'
      // The reveal happens on the POST, which is the write of their verdict.
      const post = r.slice(r.indexOf('export async function POST'))
      return /assessment: found\.assessment/.test(post) ? null : 'the reveal never happens'
    },
    break: (src) => ({
      ...src,
      'app/api/graph/claim/route.ts': src['app/api/graph/claim/route.ts']
        .replace('claim: found.question, invitation: BETA_INVITATION',
                 'claim: found.question, assessment: found.assessment, invitation: BETA_INVITATION'),
    }),
  },
  {
    name: '§5 the FACTS are never gated, and every one carries its source',
    run: (src) => {
      const lib = src['lib/graph/claim-review.ts']
      // The grounds go out with the question — a user cannot judge a record they have not
      // been shown.
      if (!/grounds: actor\.grounds\.map/.test(lib)) return 'the record is withheld with the assessment'
      if (!/sourceUrl: g\.sourceUrl/.test(lib)) return 'a ground travels without its source'
      // ⚠ THE SHAPE CANNOT EXPRESS OUR ASSESSMENT. A type with no room for a stance cannot
      // leak one.
      // ⚠ FIELD DECLARATIONS ONLY. The first version matched the interface's own NAME
      // (`ClaimGround` contains "claim") and failed on a shape that was correct — a check
      // that fires on the thing it is describing is a check somebody switches off.
      const iface = lib.slice(lib.indexOf('export interface ClaimGround'), lib.indexOf('export interface ClaimQuestion'))
      const fields = (iface.match(/^\s{2}(\w+)[?]?:/gm) ?? []).map((f) => f.trim().replace(/[?:]/g, ''))
      const leaks = fields.filter((f) => /^(stance|confidence|claim|score)/i.test(f))
      return leaks.length
        ? `the ground shape has room for our assessment in it: ${leaks.join(', ')}`
        : null
    },
    break: (src) => ({
      ...src,
      'lib/graph/claim-review.ts': src['lib/graph/claim-review.ts']
        .split('sourceUrl: g.sourceUrl').join('sourceUrl: null'),
    }),
  },
  {
    name: '§5 corroboration, not verification — and the caveat travels with the rate',
    run: (src) => {
      const lib = src['lib/graph/claim-review.ts']
      if (!/partisan sample agrees with itself/.test(lib)) return 'the rate can be quoted without its caveat'
      // ⚠ THE DENOMINATOR IS ANSWERED JUDGEMENTS. Counting an abandoned tab as a
      // disagreement would make the rate a measure of how many people finish a form.
      if (!/agreed: \{ not: null \}/.test(lib)) return 'the denominator counts unanswered judgements'
      // The user's answer must not be presented as changing the record.
      const ui = src['components/lex/ClaimReview.tsx']
      return /does not overwrite the sourced record/.test(ui)
        ? null
        : 'a disagreement is presented as a correction'
    },
    break: (src) => ({
      ...src,
      'lib/graph/claim-review.ts': src['lib/graph/claim-review.ts']
        .split('partisan sample agrees with itself').join('proof'),
    }),
  },
  {
    name: '§5 the four verdicts are distinct — "unclear" is not "not enough here"',
    // One says the record is mixed; the other says we have not shown them enough. Merging
    // them would lose the single most useful signal this experiment can produce — that OUR
    // coverage, not the member, is the problem.
    run: (src) => {
      if (USER_VERDICTS.length !== 4) return `${USER_VERDICTS.length} verdicts, expected four`
      if (!isUserVerdict('not-enough') || !isUserVerdict('unclear')) return 'the two absences collapsed'
      if (isUserVerdict('probably')) return 'the vocabulary accepts anything'
      return /not-enough/.test(src['components/lex/ClaimReview.tsx']) ? null : 'the UI offers only three'
    },
    control: () => (isUserVerdict('anything at all') ? null : 'rejected'),
  },

  // ═══ docs/CLAUDE.md §23.1 — REACHABILITY ═════════════════════════════════
  {
    name: '§23.1 every component this sprint adds is REACHABLE from a route',
    // ⚠⚠ 25-J's rename shipped into a file nothing renders and its check passed for a full
    // sprint, with a negative control that fired every run. A control proves the assertion
    // reads the file; only this proves anything else does.
    run: () => {
      const dead = NEW_COMPONENTS.map((f) => assertReachable(f)).filter(Boolean)
      return dead.length ? dead.join('\n       ') : null
    },
    control: () => assertReachable('components/ui/Navbar.tsx') ? 'rejected' : null,
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25l${selfTest ? ' --self-test' : ''} ──`)
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
