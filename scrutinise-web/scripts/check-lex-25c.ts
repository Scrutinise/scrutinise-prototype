// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25c — the Sprint 25-C guards.
//
// Same contract as check:build-25a/25b: EVERY ASSERTION THAT CAN HAVE A NEGATIVE CONTROL
// HAS ONE, and `--self-test` runs them. A guard that cannot fail is not a guard.
//
// ⚠ THE TWO §1 CHECKS EXIST BECAUSE THE THING THEY GUARD WENT WRONG BY STANDING STILL.
// Neither `attribution.ts` nor `corpus-type-map.ts` was edited into a false state — the
// WORLD moved underneath them when CC-Ingest recovered case names and committee speakers
// on 19 Aug 2026, and two hardcoded claims about coverage silently inverted. A check that
// only fires when someone edits the file would not have caught either. So both assert the
// SHAPE that cannot decay: the note must be derived from counts, and the corpus must be
// listed by name.
//
// Offline by design: no database, no API key, no network.
//
// Usage:
//   npm run check:lex-25c
//   npm run check:lex-25c -- --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { attributionAbsenceNote } from '../lib/lex/attribution'
import { dbTitleSupersedesIndex } from '../lib/lex/corpus-type-map'
import { DEVOLUTION_NOTE, precedentNote } from '../lib/lex/deepening-retrieval'
import { evidenceLabel } from '../lib/lex/evidence-labels'
import { collapseKnownUnknowns, subjectsLost, type KnownUnknown } from '../lib/lex/known-unknowns'
import { AGENDA_SECTIONS, READING_COUNT } from '../lib/lex/agenda'

/**
 * ⚠ LINE ENDINGS ARE NORMALISED ON READ. This repo checks out CRLF on Windows, and any
 * assertion that slices source on a newline silently matches nothing there — reporting a
 * failure that has nothing to do with the code. See the fuller note in check-build-25b.ts,
 * where that cost a false failure during this sprint.
 */
const read = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join('\n')

type Sources = Record<string, string>

interface Check {
  name: string
  run: (src: Sources) => string | null
  break?: (src: Sources) => Sources
}

const FILES = [
  'lib/lex/attribution.ts',
  'lib/lex/chat-retrieval.ts',
  'lib/lex/corpus-type-map.ts',
  'lib/lex/deepening.ts',
  'lib/lex/deepening-sift.ts',
  'lib/lex/deepening-jobs.ts',
  'lib/lex/deepening-retrieval.ts',
  'lib/lex/known-unknowns.ts',
  'lib/lex/evidence-labels.ts',
  'components/lex/DeepeningPanel.tsx',
  'lib/lex/agenda.ts',
  'components/lex/AgendaPanel.tsx',
  'app/api/ideas/[id]/agenda/route.ts',
  'prisma/schema.prisma',
  'lib/lex/build-client.ts',
  'lib/lex/build-research.ts',
  'lib/lex/build.ts',
] as const

function loadSources(): Sources {
  const out: Sources = {}
  for (const f of FILES) out[f] = read(f)
  return out
}

const CHECKS: Check[] = [
  // ═══ §1a — the absence note is MEASURED ══════════════════════════════════
  {
    name: '§1a the absence note reports the actual counts it was given',
    run: () => {
      const note = attributionAbsenceNote(11, 12)
      if (!note.includes('11')) return 'the held count does not appear in the note'
      if (!note.includes('12')) return 'the total does not appear in the note'
      // 12 - 11 = 1 missing, and the note must say so rather than leaving the reader to
      // subtract — the whole point is that the model reads it, not computes it.
      if (!/\b1\b/.test(note)) return 'the missing count is not stated'
      return null
    },
  },
  {
    name: '§1a it still says an absence is NOT anonymity — the rule it exists for',
    run: () => {
      const note = attributionAbsenceNote(3, 10)
      return /not the same as the source being anonymous/i.test(note)
        ? null
        : 'the never-claim sentence has been lost from the note'
    },
  },
  {
    name: '§1a it no longer claims we hold NO committee speaker names',
    run: (src) => {
      // ⚠ THE EXACT FALSE CLAIM, BY SHAPE. 96.87% of committee evidence rows carry
      // attribution as of 19 Aug 2026, so any sentence of this form is now a statement
      // that Lex should disclaim names it is holding and displaying.
      const note = attributionAbsenceNote(0, 5)
      const stale = [
        /do not store that name as a field/i,
        /in no metadata we (store|hold)/i,
        /we hold no .{0,20}names/i,
      ]
      for (const re of stale) {
        if (re.test(note)) return `the note still asserts the pre-19-Aug gap: ${re}`
      }
      // ⚠ AND THE SAME CLAIM MUST NOT SURVIVE IN PROSE. It was in THREE places — the note,
      // the module header, and the EvidenceResult field doc — and fixing only the one the
      // model reads would leave the next reader believing the gap is still open. A stale
      // comment is a slower version of the same failure.
      //
      // Present-tense assertions only: a DATED past-tense record of the measurement is
      // history and stays, which is why the test is the phrase and not the percentage.
      for (const re of stale) {
        for (const f of ['lib/lex/attribution.ts', 'lib/lex/chat-retrieval.ts'] as const) {
          const m = src[f].match(new RegExp(`.{0,80}${re.source}.{0,60}`, 'i'))
          if (!m) continue
          // "…and in no metadata we held" (past) is the record; "hold" (present) is a claim.
          if (/\b(held|was|were|had)\b/i.test(m[0])) continue
          return `${f} still asserts it in the present tense: "…${m[0].trim()}…"`
        }
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/attribution.ts': `${src['lib/lex/attribution.ts']}\n// we simply do not store that name as a field yet`,
    }),
  },
  {
    name: '§1a the note is DERIVED, not a constant the world can invalidate',
    run: (src) => {
      const attr = src['lib/lex/attribution.ts']
      if (/export const ATTRIBUTION_ABSENCE_NOTE/.test(attr)) {
        return 'the note is a constant again — a hardcoded coverage claim decays silently, which is how this broke'
      }
      const chat = src['lib/lex/chat-retrieval.ts']
      // The caller must pass real counts rather than literals, or "derived" is cosmetic.
      return /attributionAbsenceNote\(held, items\.length\)/.test(chat)
        ? null
        : 'the caller does not pass the counted rows, so the note is not actually measured'
    },
    break: (src) => ({
      ...src,
      'lib/lex/attribution.ts': `${src['lib/lex/attribution.ts']}\nexport const ATTRIBUTION_ABSENCE_NOTE = 'x'`,
    }),
  },

  // ═══ §1b — one document, one title ═══════════════════════════════════════
  {
    name: '§1b tna-caselaw takes its title from the database, not the stale index',
    run: () => (dbTitleSupersedesIndex('tna-caselaw')
      ? null
      : 'the keyword half will show the literal string "tna-caselaw" while the dense half shows the case name'),
    // Cannot be broken from source text: it asserts imported behaviour.
  },
  {
    name: '§1b CONTROL — it is an explicit list, not "always prefer the database"',
    run: () => {
      // Preferring Neon everywhere would silently re-title any collection where the two
      // have drifted for any reason, which is what check:annotation-titles exists to stop.
      if (dbTitleSupersedesIndex('legislation')) return 'legislation is taking its title from the DB — the list has become a blanket rule'
      if (dbTitleSupersedesIndex('made-up-corpus')) return 'an unknown corpus takes its title from the DB — the guard is not deciding anything'
      return dbTitleSupersedesIndex('bills-api') ? null : 'bills-api lost its entry'
    },
  },

  // ═══ §2.1 — the sift runs ════════════════════════════════════════════════
  {
    name: '§2.1 the candidate set is capped at the configured target',
    run: (src) => {
      const d = src['lib/lex/deepening.ts']
      // ⚠ `limit` is per STREAM. Without a cap the sift is handed ~6× the target and its output
      // ceiling fires — which is exactly what took the sift out of service on 19 Aug.
      return /deduped\.slice\(0, SIFT_CANDIDATE_TARGET\)/.test(d)
        ? null
        : 'nothing bounds the candidate set, so the sift will be handed whatever the routed path returns'
    },
    break: (src) => ({
      ...src,
      'lib/lex/deepening.ts': src['lib/lex/deepening.ts']
        .replace('deduped.slice(0, SIFT_CANDIDATE_TARGET)', 'deduped'),
    }),
  },
  {
    name: '§2.1 the unjudged discard is reported, not silent',
    run: (src) => /discardedUnjudged/.test(src['lib/lex/deepening.ts'])
      ? null
      : 'retrieval we paid for and did not judge disappears without a word',
    break: (src) => ({
      ...src,
      'lib/lex/deepening.ts': src['lib/lex/deepening.ts'].replace(/discardedUnjudged/g, 'x'),
    }),
  },
  {
    name: '§2.1 the sift budget is sized from the input, not a flat number',
    run: (src) => {
      const s = src['lib/lex/deepening-sift.ts']
      if (!/function maxTokensFor/.test(s)) return 'the ceiling is still flat, so it can fire for an arithmetic reason'
      return /maxOutputTokens: MAX_TOKENS/.test(s) && /const MAX_TOKENS = maxTokensFor\(reviewed\)/.test(s)
        ? null
        : 'the sized ceiling is computed but not used'
    },
    break: (src) => ({
      ...src,
      'lib/lex/deepening-sift.ts': src['lib/lex/deepening-sift.ts']
        .replace('const MAX_TOKENS = maxTokensFor(reviewed)', 'const MAX_TOKENS = 8000'),
    }),
  },

  // ═══ §2.2 — the model's instructions are not on the screen ═══════════════
  {
    name: '§2.2 no instruction text is stored in a rendered evidence body',
    run: (src) => {
      // ⚠ COMPARED AGAINST THE CONSTANTS, not a hand-written phrase list — the brief's
      // requirement, and the reason is that a phrase list stops matching the day someone
      // rewords the sentence, silently, which is how the leak would come back.
      const forModel = [DEVOLUTION_NOTE.forModel, precedentNote(['observed']).forModel]
      const jobs = src['lib/lex/deepening-jobs.ts']
      for (const instruction of forModel) {
        if (!instruction.trim()) continue
        if (jobs.includes(instruction)) return `deepening-jobs.ts writes a model instruction into a stored body: "${instruction.slice(0, 60)}…"`
      }
      // And the writer must take the user's half explicitly.
      if (!/precedentBlock\(p\)\.forUser/.test(jobs)) return 'the precedent body is not taking the user half'
      if (!/devolutionBlock\(scope\)\.forUser/.test(jobs)) return 'the devolution body is not taking the user half'
      return null
    },
    // ⚠ THE CONTROL PLANTS THE SENTENCE ITSELF, not an expression that evaluates to it.
    // The first version appended `+ DEVOLUTION_NOTE.forModel` and the check passed — because
    // the check looks for the instruction TEXT in the source, and the corrupted source only
    // contained the identifier. That is the realistic regression anyway: someone pastes the
    // sentence back in rather than re-importing it.
    break: (src) => ({
      ...src,
      'lib/lex/deepening-jobs.ts': `${src['lib/lex/deepening-jobs.ts']}\nconst leak = \`${DEVOLUTION_NOTE.forModel}\``,
    }),
  },
  {
    name: '§2.2 the split is AT CONSTRUCTION — the user half carries no imperative',
    run: () => {
      const userHalves = [DEVOLUTION_NOTE.forUser, precedentNote(['observed', 'predicted']).forUser]
      // The imperatives that were on screen. Present tense, addressed to a reader who is not
      // the user: if any survives in `forUser`, the split has been undone.
      const imperatives = [/Never tell a user/i, /Say so plainly/i, /Do NOT substitute/i]
      for (const half of userHalves) {
        for (const re of imperatives) {
          if (re.test(half)) return `an instruction survives in the user half: ${re}`
        }
      }
      // …and the substance must NOT have been lost with it.
      return /Schedule 5 to the Scotland Act 1998/.test(DEVOLUTION_NOTE.forUser)
        ? null
        : 'the caveat the user needs was moved into the model half — a caveat they cannot see cannot protect them'
    },
  },

  // ═══ §2.3 — two kinds, two labels ════════════════════════════════════════
  {
    name: '§2.3 an assembled precedent and a model-written one are labelled apart',
    run: () => {
      const assembled = evidenceLabel('PRECEDENT', 'PRECEDENT_GROUP')
      const written = evidenceLabel('PRECEDENT', 'legislation')
      if (assembled === written) return `both render as "${assembled}"`
      if (!/assembled/i.test(assembled)) return `the assembled label does not say so: "${assembled}"`
      if (!/one document/i.test(written)) return `the model-written label does not say so: "${written}"`
      return null
    },
  },
  {
    name: '§2.3 the label derives from provenance, not from the call site',
    run: (src) => {
      const panel = src['components/lex/DeepeningPanel.tsx']
      // A literal label in the renderer is the drift this exists to prevent.
      if (/KIND_LABEL\[f\.kind\]/.test(panel)) return 'the panel still labels from the kind alone'
      return /evidenceLabel\(f\.kind, f\.sourceType\)/.test(panel)
        ? null
        : 'the panel does not derive the label from the provenance field'
    },
    break: (src) => ({
      ...src,
      'components/lex/DeepeningPanel.tsx': src['components/lex/DeepeningPanel.tsx']
        .replace('evidenceLabel(f.kind, f.sourceType)', 'KIND_LABEL[f.kind]'),
    }),
  },
  {
    name: '§2.3 CONTROL — the model-written precedents are still shown',
    run: () => {
      // The brief: "Do not solve it by removing the model-written items — they were useful."
      const written = evidenceLabel('PRECEDENT', null)
      return written && /precedent/i.test(written)
        ? null
        : 'a model-written precedent no longer renders as a precedent at all'
    },
  },

  // ═══ §2.4 — collapsed, and provably lossless ═════════════════════════════
  {
    name: '§2.4 the unknowns collapse on type and subject, not on wording',
    run: () => {
      const input: KnownUnknown[] = [
        { question: 'What was it intended to do?', why: 'No note held.', kind: 'job-unmet', subjects: ['uksi/2006/3189'] },
        { question: 'What was it intended to do?', why: 'No note held.', kind: 'job-unmet', subjects: ['uksi/1999/2210'] },
        { question: 'What was it intended to do?', why: 'No note held.', kind: 'job-unmet', subjects: ['ukpga/1999/17'] },
      ]
      const out = collapseKnownUnknowns(input)
      if (out.length !== 1) return `three statements of one type collapsed to ${out.length}, expected 1`
      return null
    },
  },
  {
    name: '§2.4 …and it is LOSSLESS — every instrument named survives',
    run: () => {
      const input: KnownUnknown[] = [
        { question: 'Q', why: 'r', kind: 'job-unmet', subjects: ['uksi/2006/3189', 'uksi/1999/2210'] },
        { question: 'Q', why: 'r', kind: 'job-unmet', subjects: ['ukpga/1999/17'] },
        { question: 'Q', why: 'r', kind: 'job-unmet', subjects: ['ukpga/2010/15'] },
      ]
      const lost = subjectsLost(input, collapseKnownUnknowns(input))
      return lost.length ? `the collapse dropped: ${lost.join(', ')}` : null
    },
  },
  {
    name: '§2.4 CONTROL — the losslessness test CATCHES a lossy collapse',
    run: () => {
      // ⚠ Without this, the check above passes against any collapse at all, including one that
      // throws four instruments away. A naive dedupe on the question is exactly what a future
      // tidy-up would reach for.
      const input: KnownUnknown[] = [
        { question: 'Q', why: 'r', kind: 'job-unmet', subjects: ['uksi/2006/3189'] },
        { question: 'Q', why: 'r', kind: 'job-unmet', subjects: ['ukpga/1999/17'] },
      ]
      const naive = [input[0]] // keep the first, drop the rest — the tempting wrong answer
      const lost = subjectsLost(input, naive)
      return lost.includes('ukpga/1999/17')
        ? null
        : 'subjectsLost did not notice a dropped instrument, so it cannot police the real collapse'
    },
  },
  {
    name: '§2.4 different TYPES of statement are never merged',
    run: () => {
      const input: KnownUnknown[] = [
        { question: 'Q', why: 'nothing answered it', kind: 'unanswered' },
        { question: 'Q', why: 'the search broke', kind: 'search-failed', subjects: ['PRECEDENT'] },
      ]
      const out = collapseKnownUnknowns(input)
      return out.length === 2
        ? null
        : '"nothing answered this" and "the search broke" were merged — the §19-C distinction destroyed'
    },
  },
  {
    name: '§2.4 an untagged legacy row is kept, never swallowed',
    run: () => {
      const input: KnownUnknown[] = [
        { question: 'Q', why: 'one reason' },
        { question: 'Q', why: 'a different reason' },
      ]
      return collapseKnownUnknowns(input).length === 2
        ? null
        : 'two legacy rows with different reasons were merged on the question alone'
    },
  },

  // ═══ §3 — THE REVIEW AGENDA ══════════════════════════════════════════════
  {
    name: '§3b CONTRADICTIONS LEAD THE AGENDA — the ordering is the design',
    run: () => {
      if (AGENDA_SECTIONS[0] !== 'contradictions') {
        return `the agenda opens with "${AGENDA_SECTIONS[0]}" — §3b says the contradiction is the most valuable sentence a build produces`
      }
      // Decisions second: what to DO comes before what to read about.
      return AGENDA_SECTIONS[1] === 'decisions' ? null : `second section is "${AGENDA_SECTIONS[1]}", expected decisions`
    },
  },
  {
    name: '§3b …and the panel renders them in that order, not its own',
    run: (src) => {
      const panel = src['components/lex/AgendaPanel.tsx']
      const at = (marker: string) => panel.indexOf(marker)
      const contradictions = at('Where the research changed my mind')
      const decisions = at('title="Decisions"')
      const reading = at('Read these')
      if (contradictions < 0 || decisions < 0 || reading < 0) return 'a section is missing from the panel'
      return contradictions < decisions && decisions < reading
        ? null
        : 'the panel renders the sections in a different order from AGENDA_SECTIONS'
    },
    break: (src) => ({
      ...src,
      'components/lex/AgendaPanel.tsx': src['components/lex/AgendaPanel.tsx']
        .replace('Where the research changed my mind', 'ZZZ moved to the bottom'),
    }),
  },
  {
    name: '§3 the framing comes AFTER the work, never before it',
    run: (src) => {
      const panel = src['components/lex/AgendaPanel.tsx']
      // ⚠ `indexOf`, NOT `lastIndexOf`. The control planted a SECOND `{a.framing}` above the
      // work and `lastIndexOf` still found the legitimate one at the bottom, so the check passed
      // on a panel that showed the disclaimer first. What matters is that the framing appears
      // nowhere BEFORE the work — so the FIRST occurrence is the one to test.
      const framing = panel.indexOf('{a.framing}')
      const firstSection = panel.indexOf('Where the research changed my mind')
      if (framing < 0) return 'the framing paragraph is not rendered'
      return framing > firstSection
        ? null
        : '§19-E: the same words before the work read as a disclaimer, after it as an invitation'
    },
    break: (src) => ({
      ...src,
      'components/lex/AgendaPanel.tsx': src['components/lex/AgendaPanel.tsx']
        .replace('{error && ', '{a.framing}{error && '),
    }),
  },
  {
    name: '§3a resolving a decision KEEPS the alternative and the recommendation',
    run: (src) => {
      const route = src['app/api/ideas/[id]/agenda/route.ts']
      // Only the three decision columns may be written. Touching `chosen`, `alternative`,
      // `caseForAlternative` or `recommendationReason` would erase what was set aside — the
      // opposite of "a proposal that shows what it considered is stronger".
      const m = /data: \{ resolved: true, resolvedChoice: choice, resolvedAt: new Date\(\) \}/.exec(route)
      if (!m) return 'the resolve write is not the three-column form'
      for (const forbidden of ['chosen:', 'alternative:', 'caseForAlternative:', 'recommendationReason:']) {
        if (new RegExp(`data: \\{[^}]*${forbidden.replace(':', '')}\\s*:`).test(route)) {
          return `the resolve write also sets ${forbidden} — the record would stop keeping both`
        }
      }
      return null
    },
    break: (src) => ({
      ...src,
      'app/api/ideas/[id]/agenda/route.ts': src['app/api/ideas/[id]/agenda/route.ts']
        .replace('data: { resolved: true, resolvedChoice: choice, resolvedAt: new Date() }',
                 'data: { resolved: true, alternative: "" }'),
    }),
  },
  {
    name: '§3a a decision records WHICH WAY, not merely that one happened',
    run: (src) => {
      const schema = src['prisma/schema.prisma']
      if (!/resolvedChoice\s+String\?/.test(schema)) return 'BuildFork has no resolvedChoice'
      // ⚠ A boolean would repeat the very defect being fixed.
      return /resolvedChoice\s+Boolean/.test(schema)
        ? 'resolvedChoice is a boolean — it records THAT a decision happened and loses WHAT was decided'
        : null
    },
  },
  {
    name: '§3a the recommendation carries its reasoning, and its absence is not faked',
    run: (src) => {
      if (!/recommendationReason/.test(src['prisma/schema.prisma'])) return 'nowhere to store why Lex chose what it chose'
      if (!/whyChosen/.test(src['lib/lex/build-client.ts'])) return 'the build never asks for the case for the road taken'
      const panel = src['components/lex/AgendaPanel.tsx']
      // A build made before 25-C has none, and the panel must SAY so rather than showing a blank
      // that reads as "no reason needed".
      return /didn’t record why I chose this/.test(panel)
        ? null
        : 'a missing reasoning renders as nothing at all, which reads as a recommendation needing none'
    },
    break: (src) => ({
      ...src,
      'components/lex/AgendaPanel.tsx': src['components/lex/AgendaPanel.tsx']
        .replace('didn’t record why I chose this', ''),
    }),
  },
  {
    name: '§3d the agenda names what matters rather than reproducing the library',
    run: () => (READING_COUNT >= 2 && READING_COUNT <= 4
      ? null
      : `READING_COUNT is ${READING_COUNT} — §3d says two or three sources, not a list`),
  },
  {
    name: '§3 the agenda ASSEMBLES — no model call on a page load',
    run: (src) => {
      const a = src['lib/lex/agenda.ts']
      for (const call of ['callJson', 'generativelanguage', 'generateDeepeningFindings', 'generateAdversarialIssues']) {
        if (a.includes(call)) return `the agenda calls a model (${call}) — it would be a fifth opinion, billed per page load`
      }
      return null
    },
    break: (src) => ({
      ...src,
      'lib/lex/agenda.ts': `${src['lib/lex/agenda.ts']}\nawait callJson({})`,
    }),
  },
  {
    name: '§3a the instrument verdict reads EVERY finding, not one question’s',
    run: (src) => {
      const r = src['lib/lex/build-research.ts']
      // ⚠ THIS GUARD ENCODES FOUR CONSECUTIVE FALSE NEGATIVES. `EXISTING_POWER` reported
      // powerFound:false on every 25-B run, and the gate was never the problem — isolating it
      // (scripts/probe-existing-power.ts) recognised 3 of 3 real powers with a working control.
      // The assessment ran INSIDE the question loop, on the leading question's own findings,
      // while the powers were surfaced by the OTHER questions. Asking first and deciding last
      // are not in conflict; deciding early is what broke it.
      if (/findings: merged\.findings/.test(r)) {
        return 'the verdict reads only the leading question’s findings — the power is usually found by another question'
      }
      return /findings: allFindings/.test(r)
        ? null
        : 'the verdict does not read the pass’s full finding set'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build-research.ts': src['lib/lex/build-research.ts']
        .replace('findings: allFindings', 'findings: merged.findings'),
    }),
  },
  {
    name: '§3a the fork move READS ITS OWN RESULT, and creates a fork when none exists',
    run: (src) => {
      const b = src['lib/lex/build.ts']
      const at = b.indexOf('async function recordInstrumentRetirement')
      if (at < 0) return 'recordInstrumentRetirement is gone'
      // ⚠ Sliced to the function's own closing brace rather than a fixed character count. A
      // fixed window silently stops covering the tail of the function the moment somebody adds a
      // comment — which is exactly what happened here, and the check reported the create path
      // missing while it sat forty lines below the cut.
      const rest = b.slice(at)
      const end = rest.indexOf('\n}\n')
      const body = end > 0 ? rest.slice(0, end) : rest
      // ⚠ This logged "instrument fork changed by research" without looking at how many rows the
      // updateMany had touched — announcing the sprint's headline acceptance criterion as met on a
      // run where no such fork existed. A claim whose result is not checked is not a claim.
      if (!/moved\.count/.test(body)) {
        return 'the updateMany result is not read — the "fork changed" line can announce a change that did not happen'
      }
      // And a real power with no fork to carry it must not be dropped on the floor.
      return /buildFork\.create/.test(body)
        ? null
        : 'when no instrument fork exists the finding is lost, which is the worst available outcome'
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(/moved\.count/g, '1'),
    }),
  },
  {
    name: '§3a resolving a fork in pass 4 does NOT erase what pass 3 wrote on it',
    run: (src) => {
      const b = src['lib/lex/build.ts']
      // ⚠ THIS COST THE ACCEPTANCE CRITERION TWICE. The research writes "THE RESEARCH FOUND AN
      // EXISTING POWER" onto the instrument fork's `caseForAlternative`; pass 4 then resolved the
      // same fork and replaced that text with its own settlement note. The fork provably moved and
      // the database showed no trace of it — two passes both behaving reasonably, the more
      // valuable write lost.
      const at = b.indexOf('for (const f of r.forksResolved')
      if (at < 0) return 'the fork-resolution loop is gone'
      const body = b.slice(at, at + 1800)
      return /caseForAlternative:/.test(body)
        ? 'resolving a fork writes caseForAlternative — it would erase the research finding on the instrument fork'
        : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/build.ts': src['lib/lex/build.ts'].replace(
        'resolvedChoice: \'chosen\',',
        'resolvedChoice: \'chosen\', caseForAlternative: settled,',
      ),
    }),
  },
  {
    name: '§3a …and it is taken AFTER the loop, so every question has run',
    run: (src) => {
      const r = src['lib/lex/build-research.ts']
      const loopEnd = r.indexOf('if (instrumentQuestion && allFindings.length)')
      const forStart = r.indexOf('for (const q of questions) {')
      if (loopEnd < 0 || forStart < 0) return 'the assessment block or the question loop is missing'
      return loopEnd > forStart
        ? null
        : 'the assessment runs before the questions do'
    },
  },
  {
    name: '§3e a gap is classified from its TAG, never from its wording',
    run: (src) => {
      const a = src['lib/lex/agenda.ts']
      if (!/switch \(g\.kind\)/.test(a)) return 'classifyGap does not switch on the structural tag'
      // A regex over the reason would put "only you can answer this" on a search failure.
      return /g\.why\.(match|includes|test)|\/.*\/\.test\(g\.why\)/.test(a)
        ? 'classifyGap reads the prose — a search failure would be classified as the user\'s job'
        : null
    },
    break: (src) => ({
      ...src,
      'lib/lex/agenda.ts': src['lib/lex/agenda.ts'].replace('switch (g.kind)', 'switch (g.why)'),
    }),
  },
]

function main() {
  const selfTest = process.argv.includes('--self-test')
  const src = loadSources()
  let pass = 0
  let fail = 0
  let uncontrolled = 0

  console.log(`── check:lex-25c${selfTest ? ' --self-test' : ''} ──`)

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
    if (broken) console.log('       ↳ control OK — rejects the corrupted source')
    else { fail++; console.log('       ✗ CONTROL FAILED — the corrupted source PASSES, so this check proves nothing') }
  }

  console.log(`\n${pass} passed, ${fail} failed${selfTest ? `, ${uncontrolled} with no negative control` : ''}.`)
  process.exit(fail ? 1 : 0)
}

main()
