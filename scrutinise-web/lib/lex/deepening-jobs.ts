// ─────────────────────────────────────────────────────────────────────────────
// deepening-jobs.ts — BRIEF_SEARCH_S8 §1. The wiring S7 left out.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS
// ════════════════════════════════════════════════════════════════════════════════════════════
// S7 built `retrievePrecedent()` and `retrieveDevolutionScope()` in `deepening-retrieval.ts`,
// tested them 31/31, and shipped with NOTHING CALLING THEM. That is the pattern this project
// keeps paying for — the spend meter that existed and recorded nothing, the stats layer that was
// "built inert" and had six real bugs on its first live run. Built-but-unwired is not 90% done;
// it is 0% delivered and it looks like 100%.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠ WHAT THE AUDIT FOUND, AND WHY IT CHANGES THE SHAPE OF THIS FILE
// ════════════════════════════════════════════════════════════════════════════════════════════
// §1 asked me to confirm what actually executes retrieval for each intent. They are not alike:
//
//   DEVOLUTION_SCOPE  `retrieveDevolutionScope()` calls `runSearch()` with the intent, which is
//                     DESCRIPTIVE at the gateway — it selects no streams. So the retrieval is an
//                     ordinary routed search, and the job's contribution is the JURISDICTION
//                     LABELLING it applies afterwards (derived from the id, never the title) plus
//                     the note that refuses the reservation question.
//
//   PRECEDENT         `retrievePrecedent()` DOES NOT GO THROUGH THE GATEWAY AT ALL. It is a
//                     direct `$queryRaw` against `corpus_sections`, keyed on an instrument gid,
//                     restricted to three collections. The `PRECEDENT` gateway intent is
//                     therefore descriptive in the fullest sense: declaring it in a pass's
//                     `intents` runs a general search that has nothing to do with this job.
//
// That asymmetry is why a pass cannot express these as intents, and why `jobs` is a separate
// axis on `PassDef`. A job takes an instrument or a query and returns a RENDERED BLOCK; an
// intent takes keywords and returns candidates for the sift.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ AND THE ONE RULE THAT GOVERNS ALL OF IT: NEVER INVENT AN INSTRUMENT
// ════════════════════════════════════════════════════════════════════════════════════════════
// §1: "If an idea has no identifiable instrument, the pass writes nothing and logs why — a pass
// that invents an instrument to have something to say is the never-claim rule broken upstream."
// So an instrument must be POINTED AT by the idea's own record, and every one this file uses
// carries the provenance of how it was identified into the artefact the user reads.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'
import {
  retrievePrecedent, retrieveDevolutionScope, precedentBlock, devolutionBlock,
  type Precedent,
} from './deepening-retrieval'
import { gidFromId } from './legislation-url'
import type { HeadingKey } from './question-headings'
import { inboundFor, describeCoverage } from './statutory-graph'
import { groupReferences, classifyGroups, describeScale } from './statutory-consequences'

/** The structured retrieval jobs a pass can declare. Adding one is an entry here plus a case in
 *  `runJob` — never a branch in the engine, which must not know a pass key or a job key. */
export type JobKey = 'PRECEDENT' | 'DEVOLUTION_SCOPE' | 'CITATION_CONSEQUENCES'

/** How an instrument came to be on the list. Carried into the artefact so a user is never shown
 *  "this instrument" without being told why we think it is theirs. */
export type InstrumentProvenance = 'linked-to-this-idea' | 'retrieved-and-kept-by-the-sift'

export interface IdentifiedInstrument {
  gid: string
  provenance: InstrumentProvenance
}

/** ⚠ Bounded. Each instrument costs one `$queryRaw` over `corpus_sections`; three is enough to
 *  make a comparison and small enough that a pass cannot turn into a corpus sweep. */
export const MAX_INSTRUMENTS = 3

/**
 * The instruments this idea can honestly be said to have identified, strongest source first.
 *
 * 1. `IdeaLegislation` — somebody explicitly linked this Act or SI to this idea. Unambiguous.
 * 2. Legislation-typed results the SIFT KEPT for this run. Weaker, and labelled as such: the
 *    sift's question is "does this bear on this proposal's problem, and how?", which is a real
 *    judgement about relevance made before the gather decided what to say — not a topical
 *    coincidence. `kept`, not `retrieved`: an unsifted ranked list is exactly the "topically
 *    related document" the precedent test exists to reject.
 *
 * ⚠ RETURNS AN EMPTY ARRAY RATHER THAN A GUESS. There is deliberately no third fallback — no
 * "most-cited Act in the policy area", no keyword-to-instrument lookup. An empty list means the
 * pass writes nothing and says why, which is the required behaviour and not a degradation.
 */
export async function identifiedInstruments(
  ideaId: string, kept: SearchResult[],
): Promise<IdentifiedInstrument[]> {
  const out: IdentifiedInstrument[] = []
  const seen = new Set<string>()

  // ⚠⚠ THE GID IS `legislationGovUkId`, NOT `id`. `LegislationItem.id` is a UUID; the
  // `ukpga/2006/46` form lives in `legislationGovUkId`. The first draft of this function read
  // `IdeaLegislation.legislationItemId` and treated it as a gid, which meant the linked-instrument
  // path — the STRONGEST of the two sources — could never return anything at all, silently, on
  // every idea. Nothing failed; the pass simply fell through to the retrieval path every time.
  //
  // It was caught by the live verification run and not by any check: `scripts/verify-s8-deepening.ts`
  // tried to seed a link for `ukpga/2010/15`, could not find the row, and said so. A unit test
  // over a fixture would have agreed with the bug.
  const linked = await prisma.ideaLegislation.findMany({
    where: { ideaId },
    select: { legislationItem: { select: { legislationGovUkId: true } } },
    orderBy: { createdAt: 'asc' },
  }).catch(() => [] as Array<{ legislationItem: { legislationGovUkId: string } }>)
  for (const l of linked) {
    const gid = l.legislationItem?.legislationGovUkId
    if (!gid || seen.has(gid)) continue
    seen.add(gid)
    out.push({ gid, provenance: 'linked-to-this-idea' })
  }

  for (const r of kept) {
    if (out.length >= MAX_INSTRUMENTS) break
    if (r.type !== 'PRIMARY_LEGISLATION' && r.type !== 'STATUTORY_INSTRUMENT') continue
    const gid = gidFromId(r.id)
    if (!gid || seen.has(gid)) continue
    seen.add(gid)
    out.push({ gid, provenance: 'retrieved-and-kept-by-the-sift' })
  }

  return out.slice(0, MAX_INSTRUMENTS)
}

export interface JobOutcome {
  job: JobKey
  /** Rows written to the evidence layer. */
  written: number
  /** ⚠ Why nothing was written, when nothing was. Never left blank — "the pass wrote nothing"
   *  and "the pass wrote nothing BECAUSE no instrument is identified for this idea" are
   *  different facts, and only the second is usable. */
  skipReason: string | null
  /**
   * The question this job would have answered, phrased for the user, so a skip can become a
   * known unknown.
   *
   * ⚠ IT LIVES HERE AND NOT IN THE ENGINE, and `check:deepening` is what forced that. The first
   * draft built this sentence in `deepening.ts` with `o.job === 'PRECEDENT' ? … : …`, which put a
   * job key in the engine — the same rule that keeps a PASS key out of it, failed on its first
   * run. A third job must be an entry in this file and nothing else.
   */
  unmetQuestion: string
  /** For the report and the run log. */
  detail: string
  /**
   * 25-C §2.4 — WHAT THIS OUTCOME IS ABOUT, as identifiers rather than prose.
   *
   * The known-unknowns collapse groups on (statement type, question) and unions these. They are
   * carried structurally BECAUSE the alternative is parsing gids back out of `skipReason`, and a
   * regex over a sentence is exactly the "string similarity" the brief forbids — it would drop an
   * instrument the day someone rewords the reason, and drop it invisibly.
   */
  subjects?: string[]
}

/** The user-facing question each job answers. Declared beside the job, never in the engine. */
const PRECEDENT_QUESTION =
  'What was a comparable instrument intended to do, predicted to do, and observed to do?'
const DEVOLUTION_QUESTION = 'Which parliaments and assemblies have legislated on this subject?'

/**
 * The question a job answers, by key — so a CALLER that has to synthesise an outcome (the
 * engine's defence-in-depth catch) can do it without knowing which job it is holding.
 * `jobQuestion(k)` takes the key as a value; `k === 'PRECEDENT' ? …` would be the branch this
 * whole arrangement exists to keep out of the engine.
 */
const CONSEQUENCES_QUESTION =
  'What else in the statute book refers to the enactment this proposal would change, and what would each kind of reference need?'

/**
 * ⚠ A MAP, NOT A TERNARY, AND THE FILE PREDICTED THIS EXACT MOMENT.
 *
 * It read `key === 'PRECEDENT' ? PRECEDENT_QUESTION : DEVOLUTION_QUESTION`, which is correct
 * for two jobs and silently WRONG for three — a third key would have been handed the
 * devolution question, and the failure would have surfaced as a known-unknown about
 * parliaments and assemblies attached to a statutory-consequences skip. A `Record` keyed by
 * `JobKey` cannot do that: leaving an entry out is a compile error.
 */
const JOB_QUESTIONS: Record<JobKey, string> = {
  PRECEDENT: PRECEDENT_QUESTION,
  DEVOLUTION_SCOPE: DEVOLUTION_QUESTION,
  CITATION_CONSEQUENCES: CONSEQUENCES_QUESTION,
}

export function jobQuestion(key: JobKey): string {
  return JOB_QUESTIONS[key]
}

const PROVENANCE_WORDS: Record<InstrumentProvenance, string> = {
  'linked-to-this-idea': 'this instrument is linked to your idea',
  'retrieved-and-kept-by-the-sift':
    'this instrument was found by the search for your idea and kept as relevant — it is not '
    + 'something you have told us your proposal amends',
}

/**
 * PRECEDENT — one evidence row PER INSTRUMENT, holding the whole intended/predicted/observed
 * group.
 *
 * ⚠⚠ ONE ROW PER INSTRUMENT IS THE DESIGN, NOT A CONVENIENCE. S7: "The value is the comparison —
 * intended, predicted, observed — and a flat ranking destroys it." Writing one evidence row per
 * LEG would put three documents about one instrument into a list beside twenty unrelated ones,
 * which is precisely the flat ranking the job was built to avoid. The group survives to the user
 * because it survives as one artefact.
 *
 * ⚠⚠ AND THE MISSING LEG IS THE POINT. `precedentNote()` produces "NO POST-IMPLEMENTATION REVIEW
 * EXISTS for this instrument — nobody has published an assessment of whether it worked", and this
 * function neither suppresses it nor fills the gap from the impact assessment. Most instruments
 * have never had a PIR; a proposal that cites a prediction as though it were an outcome is the
 * single most misleading thing this pass could produce.
 */
async function runPrecedent(
  ideaId: string, passKey: string, runVersion: number, instruments: IdentifiedInstrument[],
): Promise<JobOutcome> {
  if (!instruments.length) {
    return {
      job: 'PRECEDENT', written: 0, detail: 'no instruments', unmetQuestion: PRECEDENT_QUESTION,
      subjects: [],
      skipReason:
        'No instrument is identified for this idea, so there is nothing to look up the intended, '
        + 'predicted and observed record OF. Link an Act or an SI to the idea, or run this pass '
        + 'again once the search has found the law it touches.',
    }
  }

  let written = 0
  const emptyGids: string[] = []
  for (const inst of instruments) {
    const p: Precedent = await retrievePrecedent(inst.gid)
    if (!p.legs.length) {
      // Held nowhere: no explanatory note, no impact assessment, no review. There is no
      // comparison to show, so nothing is written — and the gid is reported rather than dropped.
      emptyGids.push(inst.gid)
      continue
    }
    await prisma.evidenceItem.create({
      data: {
        ideaId, passKey, runVersion,
        // 25-D §3 — THE JOB'S OWN HEADING, not its pass's. A job is a separate producer and
        // is the one that knows what it assembled; deriving from the pass would be right by
        // accident here and wrong for `runDevolutionScope`, which runs inside LEGAL and
        // answers "what's devolved".
        headingKey: 'TRIED_BEFORE' satisfies HeadingKey,
        fieldRef: null,
        kind: 'PRECEDENT',
        title: `Intended, predicted, observed — ${p.instrumentTitle ?? inst.gid}`,
        // ⚠ `.forUser` is load-bearing and `tsc` CANNOT catch its absence: a RenderedBlock
        // interpolated into a template literal is a legal string — "[object Object]" — so the
        // compiler was happy to write that into every precedent body. check:lex-25c caught it.
        body: `${precedentBlock(p).forUser}\n\n(${PROVENANCE_WORDS[inst.provenance]})`,
        sourceType: 'PRECEDENT_GROUP',
        sourceId: p.legs[0].id,
        citation: p.instrumentTitle ?? inst.gid,
        url: p.legs[0].url,
        status: 'PROPOSED',
        siftReason:
          `Assembled deterministically for ${inst.gid} from the collections that hold each leg — `
          + `not ranked, and not judged by a model.`,
        // ⚠ TRUE, and structurally so: a precedent group exists only when at least one of the
        // three legs was actually found for a NAMED instrument. That is the precedent test —
        // "a comparable measure was tried, and we can say what it was for, what was predicted,
        // or what happened" — satisfied by construction rather than by a model's opinion.
        precedentTestPassed: true,
      },
    })
    written++
  }

  const detail = `${written} group(s) from ${instruments.length} instrument(s)`
    + (emptyGids.length ? `; ${emptyGids.length} held no explanatory note, impact assessment or review (${emptyGids.join(', ')})` : '')
  return {
    job: 'PRECEDENT', written, detail, unmetQuestion: PRECEDENT_QUESTION,
    // The instruments this outcome is ABOUT — the ones that held no note, assessment or review.
    subjects: emptyGids,
    skipReason: written === 0
      ? `The ${instruments.length} instrument(s) identified for this idea have no explanatory note, `
        + `impact assessment or post-implementation review in the corpus, so there is no `
        + `intended/predicted/observed comparison to make: ${emptyGids.join(', ')}.`
      : null,
  }
}

/**
 * DEVOLUTION_SCOPE — one evidence row per run, holding the jurisdiction-led group.
 *
 * ⚠⚠ IT DOES NOT ANSWER "IS IT RESERVED", AND THE ROW IT WRITES SAYS SO. `DEVOLUTION_NOTE`
 * travels inside the body, names Schedule 5 to the Scotland Act, Schedule 7A to the Government of
 * Wales Act and Schedules 2 and 3 to the Northern Ireland Act, and forbids reading the pattern as
 * a ruling. A frequency count is not a constitutional answer, and this is the row where that
 * confusion would otherwise be easiest to make.
 */
async function runDevolutionScope(
  ideaId: string, passKey: string, runVersion: number, keywords: string[],
): Promise<JobOutcome> {
  const query = keywords.join(' ').trim()
  if (!query) {
    return {
      job: 'DEVOLUTION_SCOPE', written: 0, detail: 'no keywords', unmetQuestion: DEVOLUTION_QUESTION,
      subjects: [],
      skipReason: 'The idea has no keywords yet, so there was nothing to search across jurisdictions.',
    }
  }

  const scope = await retrieveDevolutionScope(query)
  if (!scope.results.length) {
    return {
      job: 'DEVOLUTION_SCOPE', written: 0, detail: '0 results', unmetQuestion: DEVOLUTION_QUESTION,
      skipReason:
        'The search across jurisdictions returned nothing on this subject, so we cannot show who '
        + 'has legislated on it. That is a gap in what was retrieved, not evidence that nobody has.',
    }
  }

  const shape = Object.entries(scope.byJurisdiction)
    .sort((a, b) => b[1] - a[1]).map(([j, n]) => `${j} ${n}`).join(' · ')
  await prisma.evidenceItem.create({
    data: {
      ideaId, passKey, runVersion,
      // See runPrecedent above: the job's heading, not the pass's. This one runs inside the
      // LEGAL pass and answers a different question.
      headingKey: 'DEVOLVED' satisfies HeadingKey,
      fieldRef: null,
      kind: 'FINDING',
      title: `Who has legislated on this — ${shape}`,
      body: devolutionBlock(scope).forUser,
      sourceType: 'DEVOLUTION_SCOPE',
      sourceId: scope.results[0].id,
      citation: null,
      url: scope.results[0].url,
      status: 'PROPOSED',
      siftReason:
        'Every item is labelled with the parliament or assembly that made it, derived from the '
        + "document's own identifier and never from its title.",
      // ⚠ NULL, not false. This row makes no precedent claim at all, and `false` would read as
      // "assessed and failed" — the distinction deepening.ts already draws for unsifted rows.
      precedentTestPassed: null,
    },
  })
  return {
    job: 'DEVOLUTION_SCOPE', written: 1, unmetQuestion: DEVOLUTION_QUESTION,
    detail: `${scope.results.length} results across ${Object.keys(scope.byJurisdiction).length} jurisdiction(s): ${shape}`,
    skipReason: null,
  }
}

/**
 * Run one declared job. The engine calls this for each key in `def.jobs` and knows nothing about
 * what any of them do — which is what keeps `check:deepening`'s "a fifth pass is configuration"
 * assertion true for jobs as well as for passes.
 */
export async function runJob(
  key: JobKey,
  ctx: { ideaId: string; passKey: string; runVersion: number; keywords: string[]; kept: SearchResult[] },
): Promise<JobOutcome> {
  if (key === 'PRECEDENT') {
    const instruments = await identifiedInstruments(ctx.ideaId, ctx.kept)
    console.log('[deepening-jobs] PRECEDENT instruments', {
      passKey: ctx.passKey, instruments: instruments.map((i) => `${i.gid} (${i.provenance})`),
    })
    return runPrecedent(ctx.ideaId, ctx.passKey, ctx.runVersion, instruments)
  }
  if (key === 'CITATION_CONSEQUENCES') {
    // ⚠ THE SAME RESOLVER THE PRECEDENT JOB USES — see `runStatutoryConsequences`. It
    // refuses to guess an instrument, which is precisely §2's requirement for this pass.
    const instruments = await identifiedInstruments(ctx.ideaId, ctx.kept)
    console.log('[deepening-jobs] CITATION_CONSEQUENCES instruments', {
      passKey: ctx.passKey, instruments: instruments.map((i) => `${i.gid} (${i.provenance})`),
    })
    return runStatutoryConsequences(ctx.ideaId, ctx.passKey, ctx.runVersion, instruments)
  }
  return runDevolutionScope(ctx.ideaId, ctx.passKey, ctx.runVersion, ctx.keywords)
}

// ─────────────────────────────────────────────────────────────────────────────
// CITATION_CONSEQUENCES — what else in the statute book points at the target.
//
// ⚠ THE JOB KEY DIFFERS FROM THE PASS KEY ON PURPOSE, and `check:deepening` is what forced
// it. Both were `STATUTORY_CONSEQUENCES`, and the guard that asserts *no pass key appears
// outside the config* fired on this file — correctly, because from a source-text guard's
// point of view a pass key had leaked into the engine's neighbourhood. Two different things
// in two different registries must not share a name: the check cannot tell them apart, and
// neither could a reader.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠⚠ THE TARGET IS RESOLVED BY `identifiedInstruments`, WHICH REFUSES TO GUESS.
 *
 * §2: *"Resolve the user's plain-language target to a legislation identifier. ⚠ This can
 * fail. When it does, ask; never guess. A confidently wrong target produces a confidently
 * wrong consequence list."*
 *
 * That is already the contract of `identifiedInstruments` — an explicit link, or something
 * the SIFT kept, and *"deliberately no third fallback — no most-cited-Act-in-the-policy-area,
 * no keyword-to-instrument lookup"*. Writing a second, looser resolver here would give this
 * pass the guess the rest of the platform refuses, and it is the pass where a wrong target
 * does the most damage: a list of 1,868 consequences for the wrong Act reads as authoritative.
 *
 * So a skip here is a real answer, and `no-target-resolved` turns it into a question.
 */
async function runStatutoryConsequences(
  ideaId: string, passKey: string, runVersion: number, instruments: IdentifiedInstrument[],
): Promise<JobOutcome> {
  if (!instruments.length) {
    return {
      job: 'CITATION_CONSEQUENCES',
      written: 0,
      skipReason:
        'No enactment is identified for this idea, so there is nothing to trace references to. '
        + 'Link the Act you want to change, or name it in the proposal.',
      unmetQuestion: jobQuestion('CITATION_CONSEQUENCES'),
      detail: 'no identified instrument',
      subjects: [],
    }
  }

  let written = 0
  const details: string[] = []
  for (const inst of instruments) {
    const inbound = await inboundFor(inst.gid)
    const grouped = groupReferences(inbound.rows, inbound.titleOnly.length)

    if (!grouped.totalReferences && !grouped.titleOnly) {
      details.push(`${inst.gid}: nothing in the graph refers to it`)
      continue
    }

    const classified = await classifyGroups(inst.gid, grouped, { ideaId })
    const coverage = describeCoverage(inbound.coverage)

    for (const g of classified.groups) {
      // ⚠ ONE EVIDENCE ROW PER GROUP, NOT PER REFERENCE. §4: group, classify the group, then
      // let the user open it. Writing 1,868 rows would be the unreadable list the grouping
      // exists to prevent, and would cost a database write per reference.
      await prisma.evidenceItem.create({
        data: {
          ideaId,
          passKey,
          runVersion,
          headingKey: 'LAW_NOW',
          fieldRef: null,
          kind: 'FINDING',
          title: `${g.members.length} ${g.members.length === 1 ? 'reference' : 'references'} that ${g.label} — ${g.disposition}`,
          // ⚠⚠ THE QUOTE TRAVELS WITH THE DISPOSITION, in the same row. §3: "a disposition
          // with no visible source words is Lex putting confident prose on top of a verified
          // fact and destroying its verifiability". And ⚠ THE COVERAGE IS ADJACENT TO THE
          // COUNT (§5) — in the same body, not in a footer a renderer might drop.
          body: [
            g.reason,
            g.evidence
              ? `\nOne of them, in ${g.evidence.sourceGid}${g.evidence.provision ? ` ${g.evidence.provision}` : ''}:\n“${g.evidence.words}”`
              : '\n⚠ None of the references in this group has quotable words in our extract, so this grouping is counted but not evidenced.',
            g.unquotable > 0 && g.evidence
              ? `\n(${g.unquotable} of the ${g.members.length} have no quotable words.)`
              : '',
            `\n\n${describeScale(grouped)}`,
            `\n${coverage}`,
          ].filter(Boolean).join('\n'),
          sourceType: 'CITATION_GRAPH',
          sourceId: inst.gid,
          citation: g.evidence ? `${g.evidence.sourceGid}${g.evidence.provision ? ` ${g.evidence.provision}` : ''}` : null,
          url: `https://www.legislation.gov.uk/${inst.gid}`,
          status: 'PROPOSED',
          siftReason: `From the citation graph: what refers to ${inst.gid}.`,
        },
      })
      written++
    }
    details.push(
      `${inst.gid}: ${grouped.totalGroups} groups over ${grouped.totalReferences} provision references`
      + ` (+${grouped.titleOnly} title-only)${classified.classified ? '' : ' — NOT fully classified'}`
      + `${classified.spend ? `, ${classified.spend.pence.toFixed(4)}p` : ''}`,
    )
  }

  return {
    job: 'CITATION_CONSEQUENCES',
    written,
    skipReason: written === 0 ? 'Nothing in the citation graph refers to the identified enactment.' : null,
    unmetQuestion: jobQuestion('CITATION_CONSEQUENCES'),
    detail: details.join('; '),
    subjects: instruments.map((i) => i.gid),
  }
}
