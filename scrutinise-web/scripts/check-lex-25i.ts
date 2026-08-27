// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25i — the Sprint 25-I guards.
//
// ⚠ THE TWO THAT MATTER MOST ARE BEHAVIOURAL, NOT TEXTUAL, because both defects this
// sprint found were invisible to a source grep and only appeared when something ran:
//
//   · `verbatimSpan` threw away 73% of the findings from Charlie's own document, and
//     `quoteIsInText` — the function a grep would have found — returned TRUE for the
//     quotes being dropped. The bug was in the SHAPE of the check, not its presence.
//   · `carryEvidenceForward` MOVED evidence instead of copying it, so one aborted re-run
//     destroyed the research of the build it reused. Every word of its comment block said
//     it carried evidence forward. It did. It just took it away from the source.
//
// Offline: no database, no API key, no network.
//
// Usage:
//   npm run check:lex-25i
//   npm run check:lex-25i -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verbatimSpan, quoteIsInText, normalise } from '../lib/lex/user-material'
import { fieldDef, ALL_FIELDS } from '../lib/lex/page1-config'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

/**
 * ⚠ STRIP COMMENTS BEFORE ASSERTING ON CODE — this check failed on its first run against
 * correct code because of it.
 *
 * The §5 assertion looks for the MOVE that used to destroy the reused evidence. The fix
 * removed the move and, being a serious defect, documented it — so the function now carries
 * the line *"`updateMany({ data: { runVersion: toVersion } })` took the rows OFF the source
 * build"* in its comment block. The guard matched its own explanation and reported the bug
 * it was written to prove absent.
 *
 * The general form: **a source-text guard that does not distinguish code from prose is a
 * guard against the topic, not against the behaviour** — and it gets stricter every time
 * somebody documents the thing properly.
 */
function codeOnly(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

type Sources = Record<string, string>
interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
  control?: () => string | null
}

const FILES = [
  'lib/lex/build.ts',
  'lib/lex/build-estimate.ts',
  'lib/lex/elicitation.ts',
  'lib/lex/user-material.ts',
  'lib/lex/page1-config.ts',
  'app/ideas/build/page.tsx',
  'app/ideas/build/BuildIdeaClient.tsx',
  'app/ideas/create/page.tsx',
  'app/api/ideas/[id]/material/route.ts',
  'components/lex/FieldsPanel.tsx',
]

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

// ── §2's property, stated once so a broken implementation can be run through it ──
const DOC = normalise(
  'Dennis Thompson identified the problem of many hands: once many people contribute to a '
  + 'decision, no one of them is answerable for it. There is evidence that autonomy changes '
  + 'how accountability affects performance, and the private sector has one huge advantage '
  + 'over government there are imperfect but ultimately fair measures of success.',
)

type Span = (quote: string, text: string) => string | null

/**
 * §2's actual property, in three parts:
 *   1. a quote the model has TIDIED still yields a finding   — the 73% loss
 *   2. what comes back is a LITERAL substring of the document — provenance by construction
 *   3. a reconstruction is still refused                      — the guarantee is not weakened
 */
function spanProperty(span: Span): string | null {
  // 1. The model quotes correctly and then adds a full stop the document does not have —
  //    the exact divergence measured on Charlie's document.
  const tidied = 'Dennis Thompson identified the problem of many hands: once many people contribute to a decision. No one of them is answerable.'
  const got = span(tidied, DOC)
  if (!got) return 'a quote the model tidied mid-way yields nothing — the 73% loss is back'
  if (!DOC.includes(got)) return 'what it returned is NOT a literal substring of the document'
  if (got.length < 60) return 'the anchor is shorter than the floor it claims to enforce'
  // 2. A reconstruction that diverges early must still be refused.
  if (span('Dennis Thompson identified the challenge of numerous hands: once people help', DOC)) {
    return 'a reworded quote was accepted — the provenance guarantee is gone'
  }
  // 3. Too short to be provenance.
  if (span('many hands', DOC)) return 'a ten-character phrase was accepted as a quote'
  return null
}

/** The defect §2 fixed: all-or-nothing over the whole passage. */
const allOrNothingStub: Span = (q, t) => (quoteIsInText(q, t) ? q : null)

const CHECKS: Check[] = [
  // ═══ §1 — NOTHING IS CREATED BY ARRIVING ═════════════════════════════════
  {
    name: '§1 the build door does NOT create an idea on mount',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      const boot = c.slice(c.indexOf('// ── Boot'), c.indexOf('const refresh = useCallback'))
      if (/fetch\('\/api\/ideas'|getJson\('\/api\/ideas'/.test(boot)) {
        return 'the boot effect still POSTs /api/ideas — a page load mints a draft'
      }
      // And it must render the first question instead, or the screen is blank.
      return /if \(blankState\) setElicit\(blankState\)/.test(boot)
        ? null
        : 'nothing renders the first question when there is no idea'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace('if (blankState) setElicit(blankState)', "await getJson('/api/ideas', cid, {})"),
    }),
  },
  {
    name: '§1 the idea is created on the FIRST ANSWER, through exactly one path',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      if (!/const ensureIdea = useCallback/.test(c)) return 'there is no creation path at all'
      if (!/const id = await ensureIdea\(\)/.test(c)) return 'post() does not go through it, so an action cannot create'
      // ⚠ THE REF, not the state — the id must be readable on the next line.
      if (!/ideaIdRef\.current = id/.test(c)) return 'the id is not readable synchronously; the first answer would be dropped'
      // ⚠ AND THE URL IS STILL WRITTEN. 25-E's fix must survive creation moving.
      const fn = c.slice(c.indexOf('const ensureIdea'), c.indexOf('const post = useCallback'))
      return /replaceState/.test(fn) ? null : 'the id never reaches the URL — a refresh orphans the first answer'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .replace('ideaIdRef.current = id', 'void id'),
    }),
  },
  {
    name: '§1 the blank state is the SAME projection as the real one, not a second shape',
    run: (src) => {
      const e = src['lib/lex/elicitation.ts']
      if (!/export async function blankElicitationState/.test(e)) return 'there is no blank state'
      // ⚠ It must go through projectState. A hand-written empty view would drift.
      const fn = e.slice(e.indexOf('export async function blankElicitationState'), e.indexOf('function projectState'))
      if (!/return projectState\(/.test(fn)) return 'the blank view is built by hand, so it can drift from the real one'
      // ⚠ And it must write nothing.
      if (/prisma\.\w+\.(create|update|upsert)/.test(fn)) return 'the blank state WRITES — the whole point is that it does not'
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/elicitation.ts': src['lib/lex/elicitation.ts']
        .replace('return projectState(\'\'', 'return handRolled((\'\''),
    }),
  },
  {
    name: '§1 the old door does not mint either, and cannot redirect-loop',
    run: (src) => {
      const p = src['app/ideas/create/page.tsx']
      if (!/if \(!params\.ideaId\)/.test(p)) return 'a bare /ideas/create still boots into a mint'
      // ⚠ THE LOOP GUARD tests the RESOLVED path, not the flag — if the door is ever
      // flipped back to `create`, redirecting here would bounce for ever.
      return /if \(door !== '\/ideas\/create'\) redirect\(door\)/.test(p)
        ? null
        : 'the redirect is unguarded and would loop if the door were flipped back'
    },
    break: (src) => ({
      ...src,
      'app/ideas/create/page.tsx': src['app/ideas/create/page.tsx']
        .replace("if (door !== '/ideas/create') redirect(door)", 'redirect(door)'),
    }),
  },

  // ═══ §2 — THE DOCUMENT PIPELINE ══════════════════════════════════════════
  {
    name: '§2 a tidied quote still yields a finding, and what is stored is the DOCUMENT\'s words',
    run: () => spanProperty(verbatimSpan),
    // ⚠ THE CONTROL IS THE OLD IMPLEMENTATION. `quoteIsInText` is still exported and still
    // correct for what it does; running the property against it proves the property is the
    // thing that changed, not the wording of a comment.
    control: () => spanProperty(allOrNothingStub),
  },
  {
    name: '§2 the findings pass stores the anchored span, never the model\'s string',
    run: (src) => {
      const m = src['lib/lex/user-material.ts']
      if (!/const verbatim = verbatimSpan\(quote, storedText\)/.test(m)) return 'the pass does not anchor the quote'
      if (!/if \(!verbatim\)/.test(m)) return 'a quote that cannot be anchored is not dropped'
      // ⚠ THE STORED BODY. Interpolating `quote` here would put the model's tidied version
      // in quotation marks and attribute it to the user's document.
      if (/body: `\$\{body\}\\n\\n“\$\{quote\}”/.test(m)) return 'the MODEL\'S string is stored as the quotation'
      return /body: `\$\{body\}\\n\\n“\$\{verbatim\}”/.test(m) ? null : 'the anchored span is not what gets stored'
    },
    break: (src) => ({
      ...src,
      'lib/lex/user-material.ts': src['lib/lex/user-material.ts']
        .replace('body: `${body}\\n\\n“${verbatim}”', 'body: `${body}\\n\\n“${quote}”'),
    }),
  },
  {
    name: '§2 deleting a document takes its findings with it, in one transaction',
    run: (src) => {
      const r = src['app/api/ideas/[id]/material/route.ts']
      if (!/prisma\.\$transaction\(\[/.test(r)) return 'the two deletes are not atomic'
      const del = r.slice(r.indexOf('export async function DELETE'))
      if (!/evidenceItem\.deleteMany/.test(del)) return 'the findings survive the document — quotations with no source'
      return /ideaUserMaterial\.delete/.test(del) ? null : 'the material row is not deleted'
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/material/route.ts': src['app/api/ideas/[id]/material/route.ts']
        .split('evidenceItem.deleteMany').join('evidenceItem.count'),
    }),
  },

  // ═══ §5 — THE CARRY THAT DESTROYED WHAT IT REUSED ════════════════════════
  {
    name: '§5 the reuse carry COPIES the evidence — a failed re-run must not destroy it',
    run: (src) => {
      const b = src['lib/lex/build.ts']
      const fn = codeOnly(
        b.slice(b.indexOf('async function carryEvidenceForward'), b.indexOf('/** Ask a running build to stop')),
      )
      if (!fn.trim()) return 'carryEvidenceForward could not be located'
      // ⚠⚠ THE DEFECT, NAMED EXACTLY. An updateMany that rewrites runVersion is a MOVE, and
      // a move off the source is what stranded 69 rows on a cancelled build.
      if (/updateMany\(\{[\s\S]*?data: \{ runVersion: toVersion \}/.test(fn)) {
        return 'the carry still MOVES rows — one aborted re-run destroys the research it reused'
      }
      if (!/evidenceItem\.createMany/.test(fn)) return 'the evidence is not copied'
      return /deepeningPass\.createMany/.test(fn) ? null : 'the stated gaps are not copied'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(
        'const source = await prisma.evidenceItem.findMany({',
        'const _moved = await prisma.evidenceItem.updateMany({ where: {}, data: { runVersion: toVersion } })\n  const source = await prisma.evidenceItem.findMany({',
      ),
    }),
  },

  // ═══ §4 — WHAT IT COSTS, SAID BEFORE IT IS SPENT ═════════════════════════
  {
    name: '§4a the estimate states the COST as well as the duration, and never invents one',
    run: (src) => {
      const e = src['lib/lex/build-estimate.ts']
      if (!/pence: number \| null/.test(e)) return 'the estimate carries no cost at all'
      if (!/function costLine/.test(e)) return 'nothing puts the cost into the sentence'
      // ⚠ BOTH BRANCHES. The "uses one of your builds" half must survive an absent figure,
      // or a build with no priced sample reads as free.
      if (!/if \(pence == null\) return `\$\{duration\} It uses one of your builds\.`/.test(e)) {
        return 'with no measured figure it says nothing about cost — which reads as free'
      }
      // ⚠ MEASURED, not hardcoded.
      if (/costs about \d+p to run/.test(e)) return 'the cost is a hardcoded string'
      return /costs\.reduce/.test(e) ? null : 'the figure is not a mean of real builds'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-estimate.ts': src['lib/lex/build-estimate.ts']
        .replace('if (pence == null) return `${duration} It uses one of your builds.`', 'if (pence == null) return duration'),
    }),
  },
  {
    name: '§4a a build with no recorded cost is EXCLUDED, not counted as free',
    run: (src) => {
      const e = src['lib/lex/build-estimate.ts']
      // ⚠ Counting a null as 0 drags the mean towards free — the one direction a price a
      // user is about to accept must never err in.
      return /\.filter\(\(p\): p is number => p != null && Number\.isFinite\(p\) && p > 0\)/.test(e)
        ? null
        : 'unpriced builds are counted, so the mean understates what a build costs'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-estimate.ts': src['lib/lex/build-estimate.ts']
        .replace('.filter((p): p is number => p != null && Number.isFinite(p) && p > 0)', '.map((p) => p ?? 0)'),
    }),
  },
  {
    name: '§4b the reuse offer names what it reuses (25-G — verified, not rebuilt)',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      return /Re-running from the research already gathered — \{build\.reuse\.findings\}/.test(c)
        ? null
        : 'the cheaper option no longer says what it is reusing'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('Re-running from the research already gathered').join('Re-run'),
    }),
  },
  {
    name: '§4b the stale banner reads the price from the thing that decides it',
    run: (src) => {
      const c = src['app/ideas/build/BuildIdeaClient.tsx']
      // ⚠⚠ THE ASSERTION THAT WAS WRONG ON THE LIVE SITE. `staleUnderstanding` and
      // `reuseSourceFor` have DIFFERENT conditions (confirmedAt vs the last build's
      // startedAt), so inferring the price from staleness told Charlie a re-run would cost
      // three times what it will.
      if (/now out of date, and the next build will search the corpus again/.test(c)) {
        return 'the banner still asserts the cost from staleness alone'
      }
      return /build\?\.reuse[\s\S]{0,200}still stands, so a re-run can reuse it/.test(c)
        ? null
        : 'the banner does not consult the build state for the price'
    },
    break: (src) => ({
      ...src,
      'app/ideas/build/BuildIdeaClient.tsx': src['app/ideas/build/BuildIdeaClient.tsx']
        .split('still stands, so a re-run can reuse it').join('x'),
    }),
  },
  {
    name: '§4c "The idea" explains itself where the user meets it',
    run: () => {
      const def = fieldDef('ideaNarrative')
      if (!def?.note) return 'nothing explains why this field behaves differently'
      if (!/your own words/i.test(def.note)) return 'the note does not contrast it with the derived fields'
      // ⚠ AND NOWHERE ELSE HAS ONE IT SHOULD NOT. A note on a derived field would say the
      // user may edit something they cannot.
      const wrong = ALL_FIELDS.filter((f) => f.derived && f.note)
      return wrong.length ? `a derived field carries an editing note: ${wrong[0].key}` : null
    },
  },
  {
    name: '§4c the note actually renders, and on a proposal too',
    run: (src) => {
      const p = src['components/lex/FieldsPanel.tsx']
      if (!/const note = fieldDef\(field\.key\)\?\.note/.test(p)) return 'the note is never read'
      if (!/\{note && \(/.test(p)) return 'the note is never rendered'
      // ⚠ NOT gated on `!proposed` — the proposal is exactly when the user is deciding
      // whether they may change it.
      return /\{note && \([\s\S]{0,240}\{note\}<\/p>/.test(p) ? null : 'the note is hidden behind a condition'
    },
    break: (src) => ({
      ...src,
      'components/lex/FieldsPanel.tsx': src['components/lex/FieldsPanel.tsx']
        .replace('{note && (', '{note && !proposed && ('),
    }),
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0, fail = 0, uncontrolled = 0
  console.log(`── check:lex-25i${selfTest ? ' --self-test' : ''} ──`)
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
      uncontrolled++; console.log('       ⚠ NO NEGATIVE CONTROL — asserts against imported data'); continue
    }
    let broken: string | null
    try { broken = c.control ? c.control() : c.run(c.break!(src)) } catch { broken = 'threw' }
    if (broken) console.log('       ↳ control OK — rejects the broken version')
    else { fail++; console.log('       ✗ CONTROL FAILED — the broken version PASSES, so this check proves nothing') }
  }
  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  process.exit(fail ? 1 : 0)
}

main()
