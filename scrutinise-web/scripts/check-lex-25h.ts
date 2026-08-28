// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25h — the Sprint 25-H guards.
//
// Same contract as 25-a/b/f/g. Every assertion that CAN have a negative control has one,
// and `--self-test` proves each control rejects a corrupted copy.
//
// ⚠ THE ONE THIS FILE EXISTS FOR IS §1's REFRESH PATH. The brief's stated cause was wrong
// — `confirmElicitation` did write the page-one fields — and the real defect is that it
// wrote them ONCE. So the assertion is not "something writes them"; it is "editing an
// answer changes them", which is a different property and the only one that survives §3.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:lex-25h
//   npm run check:lex-25h -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DERIVED_PAGE_ONE_FIELDS, isDerivedPageOneField, projectedValues,
  AGREED_IDEA_FIELD, RETIRED_PAGE_ONE_FIELD,
} from '../lib/lex/page-one'
import { ALL_FIELDS, fieldDef } from '../lib/lex/page1-config'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  /** Corrupt the source so `run` must reject it. For checks that grep source text. */
  break?: (src: Sources) => Sources
  /**
   * A negative control for checks that call imported code rather than reading source text.
   * It must return a non-null failure — i.e. the check rejects a deliberately broken
   * implementation of the very property it asserts.
   */
  control?: () => string | null
}

const FILES = [
  'lib/lex/page-one.ts',
  'lib/lex/page1-config.ts',
  'lib/lex/state.ts',
  'lib/lex/field-machine.ts',
  'lib/lex/elicitation.ts',
  'lib/lex/build.ts',
  'lib/lex/build-client.ts',
  'lib/lex/build-highlights.ts',
  'lib/lex/build-smart.ts',
  'app/api/ideas/[id]/elicitation/route.ts',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/create/CreateIdeaClient.tsx',
  'components/lex/FieldsPanel.tsx',
  'components/lex/BuildFindings.tsx',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

const ELICITATION = {
  problem: 'The problem, in my own words.',
  goalKind: 'APPLICATION_CHANGE',
  goalDetail: 'What I want.',
  ruledOut: 'Not a new Act.',
  ownKnowledge: 'What I saw myself.',
  readingUrl: null as string | null,
  readingFileName: null as string | null,
}

type Projection = (row: typeof ELICITATION) => Record<string, string>

/**
 * §1's actual property, stated once so a broken implementation can be run through it.
 *
 * Three parts, and all three matter:
 *   1. an EDITED answer changes the projected value   — this is the whole defect
 *   2. the projection is VERBATIM                     — §2: the user's own words, unsummarised
 *   3. an UNTOUCHED answer does not churn             — or every read looks like an edit
 */
function refreshProperty(project: Projection): string | null {
  const before = project(ELICITATION)
  const after = project({ ...ELICITATION, problem: 'Something completely different.' })
  if (before.yourAccount === after.yourAccount) return 'editing the problem does not change the projected account'
  if (after.yourAccount !== 'Something completely different.') return 'the projection is not verbatim'
  if (before.yourKnowledge !== after.yourKnowledge) return 'an untouched answer changed too'
  return null
}

/** The defect §1 describes: written once at first confirm, never refreshed afterwards. */
let stubMemo: Record<string, string> | null = null
const writeOnceStub: Projection = (row) => (stubMemo ??= projectedValues(row))

const CHECKS: Check[] = [
  // ═══ §1 — THE REFRESH PATH ═══════════════════════════════════════════════
  {
    name: '§1 page one is PROJECTED on every canonical-state read, not copied once at confirm',
    run: (src) => {
      const state = src['lib/lex/state.ts']
      if (!/await projectElicitationOntoPageOne\(ideaId\)/.test(state)) {
        return 'nothing refreshes page one — an edited answer would leave the proposal stale'
      }
      // ⚠ AND THE ONE-TIME COPY IS GONE. Leaving both would mean two writers for one field,
      // which is how they come to disagree.
      const elic = src['lib/lex/elicitation.ts']
      if (/submitBox\(ideaId, userId, 'ideaNarrative'/.test(elic)) {
        return 'confirmElicitation still copies into page one — two writers for one field'
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/state.ts': src['lib/lex/state.ts'].split('await projectElicitationOntoPageOne(ideaId)').join(''),
    }),
  },
  {
    name: '§1 the projection reflects an EDIT, not just a first answer',
    // ⚠ THE PROPERTY THE BRIEF'S OWN DIAGNOSIS WOULD HAVE MISSED. A write path passes
    // "the fields get filled"; only a refresh path passes "they change when the answer
    // changes", and §3 makes every answer editable.
    //
    // ⚠ THIS ONE CANNOT BE CONTROLLED BY CORRUPTING SOURCE TEXT — it calls the real
    // `projectedValues`. So the comparison is factored out and `--self-test` runs it against
    // a WRITE-ONCE STUB: a projection that ignores the current answer and returns the first
    // one it ever saw. That stub is precisely the defect §1 describes, and the assertion
    // must reject it. Without this, "the check passed" would only mean "a function exists".
    run: () => refreshProperty(projectedValues),
    control: () => refreshProperty(writeOnceStub),
  },
  {
    name: '§1 the retired blob is gone from the kernel, and the four answers replace it',
    run: () => {
      const keys = new Set(ALL_FIELDS.map((f) => f.key))
      if (keys.has(RETIRED_PAGE_ONE_FIELD)) return `${RETIRED_PAGE_ONE_FIELD} is still a kernel field`
      const missing = DERIVED_PAGE_ONE_FIELDS.filter((k) => !keys.has(k))
      return missing.length ? `the replacement fields are missing: ${missing.join(', ')}` : null
    },
  },

  // ═══ §2 — THE PROVENANCE RULE ════════════════════════════════════════════
  {
    name: '§2 the account is DERIVED and the agreed idea is NOT — they move independently',
    run: () => {
      if (!isDerivedPageOneField('yourAccount')) return 'the account is editable, so the first edit destroys the testimony'
      if (isDerivedPageOneField(AGREED_IDEA_FIELD)) return 'the agreed statement is derived, so the user cannot edit it'
      const account = fieldDef('yourAccount')
      const agreed = fieldDef(AGREED_IDEA_FIELD)
      if (!account?.derived) return 'yourAccount is not marked derived in the config'
      if (agreed?.derived) return 'the agreed statement is marked derived'
      return null
    },
  },
  {
    name: '§2 a derived field cannot be written, and the guard is in the MACHINE not the panel',
    run: (src) => {
      const fm = src['lib/lex/field-machine.ts']
      if (!/export function assertWriteable/.test(fm)) return 'there is no guard'
      for (const fn of ['submitBox', 'acceptField', 'reopenField', 'skipField']) {
        const i = fm.indexOf(`export async function ${fn}`)
        if (i < 0) return `${fn} could not be found`
        if (!/assertWriteable\(fieldKey\)/.test(fm.slice(i, i + 700))) return `${fn} does not check`
      }
      // ⚠ IT THROWS. A silent refusal leaves the caller believing the write landed.
      return /class DerivedFieldNotWriteable extends Error/.test(fm) ? null : 'the refusal is silent'
    },
    break: (src) => ({
      ...src,
      'lib/lex/field-machine.ts': src['lib/lex/field-machine.ts']
        .split('  assertWriteable(fieldKey)\n').join(''),
    }),
  },
  {
    name: '§2 the projection NEVER overwrites the agreed statement after the first seed',
    run: (src) => {
      const s = src['lib/lex/page-one.ts']
      if (!/const untouched = !agreed \|\| \(agreed\.status === 'EMPTY' && !agreed\.value\)/.test(s)) {
        return 'the seed is not gated on the field being untouched — an edit would be overwritten'
      }
      // The seed is a PROPOSAL, so even the first version is agreed to rather than asserted.
      return /status: 'AWAITING_CONFIRMATION'/.test(s) ? null : 'the seed is asserted rather than proposed'
    },
    break: (src) => ({
      ...src,
      'lib/lex/page-one.ts': src['lib/lex/page-one.ts']
        .replace("const untouched = !agreed || (agreed.status === 'EMPTY' && !agreed.value)", 'const untouched = true'),
    }),
  },

  // ═══ §3 — THE PILLS ══════════════════════════════════════════════════════
  {
    name: '§3 every pill opens its own answer, populated from what the user wrote',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/const openStep = useCallback/.test(c)) return 'the pills do not open anything'
      // ⚠ SEEDED, NOT BLANK. A pill that opens an empty box loses the answer it was
      // supposed to show — the complaint, one step along.
      if (!/setText\(s\?\.answer \?\? ''\)/.test(c)) return 'the editor opens blank rather than populated'
      return /onClick=\{\(\) => \(open \? setEditingStep\(null\) : openStep\(s\.key\)\)\}/.test(c)
        ? null
        : 'the rail is still inert'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace("setText(s?.answer ?? '')", "setText('')"),
    }),
  },
  {
    name: '§3 a CONFIRMED elicitation is editable — but only by an explicit edit',
    run: (src) => {
      const e = src['lib/lex/elicitation.ts']
      // ⚠ NARROWED, NOT REMOVED. An ordinary answer POST from a stale tab is still refused.
      return /if \(base\.status === 'CONFIRMED' && !input\.editing\) throw new ElicitationClosed\(\)/.test(e)
        ? null
        : 'the guard is gone entirely, or still closes the door on an edit'
    },
    break: (src) => ({
      ...src,
      'lib/lex/elicitation.ts': src['lib/lex/elicitation.ts']
        .replace("if (base.status === 'CONFIRMED' && !input.editing) throw new ElicitationClosed()",
          "if (base.status === 'CONFIRMED') throw new ElicitationClosed()"),
    }),
  },
  {
    name: '§3 an edit says the reading is stale AND that the next build will cost more',
    run: (src) => {
      const e = src['lib/lex/elicitation.ts']
      if (!/const staleUnderstanding =/.test(e)) return 'staleness is never detected'
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/elicit\.staleUnderstanding && \(/.test(c)) return 'the user is never told the reading is out of date'
      // ⚠ BOTH FACTS TOGETHER. They are one event and a user should not have to join them.
      return /search the corpus again rather than reusing/.test(c)
        ? null
        : 'the cost consequence of the edit is not stated with it'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('search the corpus again rather than reusing').join('x'),
    }),
  },

  // ═══ §4 — THE DOCUMENT CHAIN ═════════════════════════════════════════════
  {
    // ⚠⚠ 25-K §2 WIDENED THIS AND THE GUARD FIRED FIRST, WHICH IS WHAT IT IS FOR.
    //
    // 25-H asserted the upload was on the `reading` STEP. That placement is exactly what
    // Charlie could not find: he looked for it in the composer at question one, the way
    // every chat interface offers it, and there was nothing there — it appeared on one of
    // four questions and vanished again once he was past it.
    //
    // So the assertion moves from a PLACEMENT to the stronger PROPERTY: the control is on
    // the composer for EVERY question, and still available after the elicitation. A check
    // that pinned the old placement would now be forbidding the fix.
    name: '§4 (widened by §25-K §2) the material pipeline is on the composer at EVERY question, and after it',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/<YourMaterial\s+ideaId=\{ideaId\}/.test(c)) return 'the build door still has no way to attach a document'
      // The "+" is handed to the question card unconditionally — gated on there being an
      // idea to attach to, never on WHICH question is showing.
      if (!/onToggleAttach=\{ideaId \? \(\) => setAttachOpen/.test(c)) {
        return 'the attach control is not offered from the composer'
      }
      if (/step\?\.key === 'reading' && ideaId/.test(c)) {
        return 'the upload is gated on one step again — that is the placement nobody could find'
      }
      return /elicit\.phase === 'CONFIRMED' && ideaId/.test(c) ? null : 'it is not available after the elicitation'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('onToggleAttach={ideaId ? () => setAttachOpen').join('onToggleAttach={undefined ?? (() => setAttachOpen'),
    }),
  },
  {
    name: '§4 a named-but-never-uploaded document SAYS so rather than looking read',
    run: (src) => {
      const s = src['lib/lex/page-one.ts']
      if (!/NAMED but never/.test(s)) return 'an old filename still renders as though we had read it'
      // The three states named apart, as YourMaterial names them on screen.
      if (!/could not be read/.test(s)) return 'a failed read is not distinguished'
      return /nothing in it bore on this proposal/.test(s)
        ? null
        : '"read and found nothing" is not distinguished from "read and found something"'
    },
    break: (src) => ({
      ...src,
      'lib/lex/page-one.ts': src['lib/lex/page-one.ts'].split('NAMED but never').join('x'),
    }),
  },

  // ═══ §5 · §6 · §7 ════════════════════════════════════════════════════════
  {
    name: '§5 a collapsed panel is a labelled EDGE, and it follows CONTENT until the user decides',
    run: (src) => {
      const c = src['app/ideas/create/CreateIdeaClient.tsx']
      if (!/function PanelEdge/.test(c)) return 'a collapsed panel vanishes rather than becoming an edge'
      // ⚠ `null` MEANS "NOBODY HAS SAID". A boolean would freeze the first render's answer.
      // ⚠ 25-L §4 ADDED A THIRD PANEL TO THE SAME RULE. The left column is hideable
      // too now, so the shape is `{ chat, fields, background }` — the assertion is that
      // EVERY panel can still tell "not yet decided" (null) from "closed" (false), which is
      // the property, rather than that there are exactly two of them.
      for (const k of ['chat', 'fields', 'background']) {
        if (!new RegExp(`${k}: boolean \\| null`).test(c)) {
          return `the ${k} panel cannot tell "not yet decided" from "closed"`
        }
      }
      // ⚠ 25-L §4 PUT A STORED LAYOUT BETWEEN THE TOGGLE AND THE CONTENT RULE, and the
      // precedence order is the design: this session's click, then their saved layout, then
      // — for a user who has never said anything — the content. So the assertion is that
      // `fieldsHaveContent` is still what decides when NOBODY has said, not that it is the
      // only thing consulted.
      return /panelOpen\.fields \?\?[\s\S]{0,120}?fieldsHaveContent/.test(c)
        ? null
        : 'a panel does not open by itself when it has something in it'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/CreateIdeaClient.tsx': src['app/ideas/create/CreateIdeaClient.tsx']
        .replace('panelOpen.fields ?? fieldsHaveContent', 'panelOpen.fields ?? false'),
    }),
  },
  {
    name: '§6 "what I found that you didn\'t mention" leads the panel and separates the unverified',
    run: (src) => {
      const c = src['components/lex/BuildFindings.tsx']
      if (!/What I found that you didn’t mention/.test(c)) return 'the box §6 asks for does not exist'
      // ⚠ ABOVE the findings list — it was fifth, under a heading about vocabulary.
      const vocab = c.indexOf('What I found that you didn’t mention')
      const record = c.indexOf('What the record actually says')
      if (vocab < 0 || record < 0) return 'one of the two sections could not be located'
      if (vocab > record) return 'it still sits below the findings, which is where it read as a footnote'
      return /Unverified —/.test(c) ? null : 'unverified terms are not separated and labelled'
    },
    break: (src) => ({
      ...src,
      'components/lex/BuildFindings.tsx': src['components/lex/BuildFindings.tsx']
        .split('What I found that you didn’t mention').join('Terms of art'),
    }),
  },
  {
    name: '§7a the causal map has edges to draw, and says so when it has none',
    run: (src) => {
      const b = src['lib/lex/build.ts']
      if (!/function nestByDrivenBy/.test(b)) return 'the build still creates a flat list, so the map draws the list'
      if (!/nestByDrivenBy\(causes, buildId\)/.test(b)) return 'the nesting is defined and never used'
      const p = src['components/lex/FieldsPanel.tsx']
      // ⚠ A view that silently looks like another view is indistinguishable from one that failed.
      return /tree\.some\(\(n\) => n\.kids\.length > 0\)/.test(p)
        ? null
        : 'the map still impersonates the list when there is no chain'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('nestByDrivenBy(causes, buildId)').join('causes.map((x) => x)'),
    }),
  },
  {
    name: '§7a a cause whose parent cannot be resolved SURVIVES as a root, and the loss is counted',
    run: (src) => {
      const b = src['lib/lex/build.ts']
      if (!/unresolved\+\+; roots\.push\(shape\(c\)\)/.test(b)) return 'an unmatched parent drops the cause'
      if (!/cycles\+\+/.test(b)) return 'a cycle would make the client recurse for ever'
      return /some causes could not be placed in the chain/.test(b) ? null : 'the loss is silent'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].split('some causes could not be placed in the chain').join('x'),
    }),
  },
  {
    name: '§7b the title follows the USER\'S GOAL, not the loudest term in the sources',
    run: (src) => {
      const c = src['lib/lex/build-client.ts']
      return /IT FOLLOWS WHAT THE USER WANTS TO CHANGE, NOT THE LOUDEST TERM/.test(c)
        ? null
        : 'nothing tells the title to follow the goal rather than the retrieved material'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts']
        .split('IT FOLLOWS WHAT THE USER WANTS TO CHANGE').join('x'),
    }),
  },
  {
    name: '§7c the causes include the incentive-and-culture reading, not only the structural one',
    run: (src) => {
      const c = src['lib/lex/build-client.ts']
      if (!/INCLUDE THE PLAIN HUMAN READING/.test(c)) return 'nothing asks for the motive reading'
      // ⚠ A CAUSE AMONG CAUSES. It must not replace the structural ones.
      return /not a replacement for the structural ones/.test(c)
        ? null
        : 'it could displace the structural causes rather than joining them'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts']
        .split('INCLUDE THE PLAIN HUMAN READING').join('x'),
    }),
  },
  {
    name: '§7d a waiting field NAMES what is holding it up and what releases it',
    run: (src) => {
      const p = src['components/lex/FieldsPanel.tsx']
      if (!/waitingOn\?: string/.test(p)) return 'a queued field still says only "next up", which is a position not a condition'
      if (!/save or skip/.test(p)) return 'it does not say what the user must do'
      return /const blocker = queued \? page\.fields\[currentIdx\]\?\.label : undefined/.test(p)
        ? null
        : 'the blocker is described generically rather than named'
    },
    break: (src) => ({
      ...src,
      'components/lex/FieldsPanel.tsx': src['components/lex/FieldsPanel.tsx']
        .replace('const blocker = queued ? page.fields[currentIdx]?.label : undefined', 'const blocker = undefined'),
    }),
  },
  {
    name: '§7e §25.7\'s six qualities still reach every drafting pass (25-F, not disturbed)',
    run: (src) => {
      const c = src['lib/lex/build-client.ts']
      for (const m of ['A CAUSAL CHAIN, NOT AN INVENTORY', 'THE COUNTERINTUITIVE RESULT',
        'CITE THE FINDING, NOT THE CITATION', 'REFRAME THE INSTRUMENT IF IT IS WRONG',
        'GIVE A TEST THE USER CAN APPLY', 'PROPOSE THE NEXT ACTION']) {
        if (!c.includes(m)) return `§25.7 instruction lost: ${m}`
      }
      return (c.match(/ANSWER_QUALITY/g) ?? []).length >= 6 ? null : 'it no longer reaches every drafting pass'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-client.ts': src['lib/lex/build-client.ts']
        .split('GIVE A TEST THE USER CAN APPLY').join('x'),
    }),
  },
  {
    // ⚠ THIS CHECK FAILED ON ITS FIRST RUN, AND THE DEFECT WAS IN THE CHECK.
    // It looked for `kind === 'CONTRADICTS'` in build.ts, which WRITES `kind: 'CONTRADICTS'`
    // and never compares it — the comparison lives in the ranking, one file over. A guard
    // aimed at the wrong file fails loudly today and, once "fixed" by relaxing it, passes
    // for ever. So it now points at the three files that actually carry §7f's three surfaces.
    name: '§7f the 25-F/25-G output is NOT disturbed',
    run: (src) => {
      const h = src['lib/lex/build-highlights.ts']
      // 1. A finding that cuts against the draft still OUTRANKS one that supports it.
      if (!/row\.kind === 'CONTRADICTS'/.test(h)) return 'the cuts-against-the-draft ranking is gone'
      if (!/citation/i.test(h)) return 'the citation weighting is gone'
      // 2. The unverified vocabulary is still labelled rather than mixed in.
      if (!/Unverified —/.test(src['components/lex/BuildFindings.tsx'])) return 'the unverified labelling is gone'
      // 3. The smart pass still produces its cuts.
      if (!/What I would cut/.test(src['lib/lex/build-smart.ts'])) return "the smart pass's cuts are gone"
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-highlights.ts': src['lib/lex/build-highlights.ts']
        .split("row.kind === 'CONTRADICTS'").join('false'),
    }),
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25h${selfTest ? ' --self-test' : ''} ──`)
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
      uncontrolled++; console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported code'); continue
    }
    let broken: string | null
    try { broken = c.control ? c.control() : c.run(c.break!(src)) } catch { broken = 'threw' }
    if (broken) console.log('       ↳ control OK — rejects the corrupted source')
    else { fail++; console.log('       ✗ CONTROL FAILED — the corrupted source PASSES, so this check proves nothing') }
  }
  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  process.exit(fail ? 1 : 0)
}

main()
