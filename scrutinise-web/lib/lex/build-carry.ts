// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §1 — THE PASS LOG, AND WHAT SURVIVES BETWEEN REQUESTS.
//
// 25-A ran every pass inside one function call, so each pass simply handed the next one
// an in-memory `RunAccumulator`. 25-B runs ONE PASS PER REQUEST (§1), and an in-memory
// accumulator does not survive a request boundary. Something has to carry the
// orientation into the diagnosis, the diagnosis into the approach, and the whole draft
// into the research pass — and that something has to be STORED, because the next pass
// runs in a different process.
//
// ⚠ THE CARRY IS THE PASS LOG, NOT A SECOND STATE. This is the decision this file
// exists to record. The alternatives were a new column (a migration, for state that is
// already conceptually "what this pass produced") or re-deriving each pass's output from
// the canonical fields it wrote (subtly lossy: `acc.diagnosis` is the model's own prose,
// not a concatenation of the fields, and reconstructing it would silently change what
// pass 3 is researching). Storing each pass's carry ON THE PASS RECORD keeps the
// codebase's own rule — "the status shown is the status stored" — true of the inputs as
// well as the outputs, and it needs no migration.
//
// ⚠ AND THE SPEND IS PER PASS, FOR THE SAME REASON (§8). A build-level token total
// cannot answer "which pass cost that", which is exactly the question Charlie is being
// asked to judge. The usages live on the pass that spent them; the build total is their
// sum, so the two can never disagree.
// ─────────────────────────────────────────────────────────────────────────────

import { BUILD_PASSES, type BuildPassKey } from './build-config'
import type { LlmUsage } from './build-llm'
import type { IssuedQuery } from './build-query'

export type PassStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED' | 'SKIPPED'

/**
 * What one pass hands to the passes after it.
 *
 * Deliberately flat strings rather than structured objects: every consumer is a PROMPT,
 * and a prompt takes prose. Anything a later pass needs as data (findings, forks,
 * proposals) is already a row in the database and is read from there.
 */
export interface PassCarry {
  /** ORIENT — the terrain plus the domain-transfer answer. */
  orientation?: string
  /** DIAGNOSIS — challenge, summary, root cause, pivotal obstacle. */
  diagnosis?: string
  /** APPROACH — chosen approach, leverage, what it rules out. */
  approach?: string
  /** APPROACH — the instrument, as one line. Pass 3's EXISTING_POWER question reads it. */
  instrument?: string
  /** ORIENT — TRUE when a corpus search did not complete. Never conflated with silence. */
  searchFailed?: boolean
  /** RESEARCH — the findings, as prose, for the revision and the adversarial read. */
  research?: string
  /** REVISE — what changed and what contradicted pass 2, for the adversarial read. */
  revision?: string
  /** 25-F §2 — the smart pass's verdict, rewrites and prognosis, for the passes after it. */
  smart?: string
  /** 25-F §3 — what the two verification passes found, for the hostile clerk to press on. */
  verification?: string
}

export interface PassRecord {
  key: BuildPassKey
  label: string
  detail: string
  status: PassStatus
  startedAt: string | null
  completedAt: string | null
  /** A one-line account of what this pass produced, for the progress display. */
  output: string | null
  failureReason: string | null
  /**
   * §8 — "Progress must show what is happening, not a spinner: the current pass, the
   * question being asked, and findings appearing as they land."
   *
   * Written DURING the pass, not after it, which is the whole point: a ten-minute wait
   * with no evidence of work is indistinguishable from a hang.
   */
  activity?: string | null
  /** What this pass hands forward. See the header. */
  carry?: PassCarry
  /** §8 — every model call this pass made. The build total is the sum of these. */
  usages?: LlmUsage[]
  /**
   * 25-F §4 — EVERY QUERY THIS PASS ISSUED, with how it was built.
   *
   * ⚠ Stored on the pass record for the same reason the carry is (see the header): it
   * needs no migration, and it keeps "what was asked" inspectable next to "what came
   * back". Before this existed the only record of a query was `IdeaBuild.queryUsed` —
   * ONE string, from pass 1 — so the nine near-identical queries the research pass
   * issued left no trace at all, and "231 sources read; 0 cited" had no diagnosable
   * cause on the row.
   */
  queries?: IssuedQuery[]
}

export function freshPassLog(): PassRecord[] {
  return BUILD_PASSES.map((p) => ({
    key: p.key, label: p.label, detail: p.detail,
    status: 'PENDING' as PassStatus,
    startedAt: null, completedAt: null, output: null, failureReason: null,
    activity: null, carry: {}, usages: [],
  }))
}

/**
 * 25-G §1a — THE PASSES A RE-RUN REUSES RATHER THAN REPEATING.
 *
 * ⚠ THE ECONOMICS ARE THE WHOLE REASON, and they are not marginal. Measured on the second
 * build of Charlie's idea (`42d68bea`, 217,687 input tokens, 33.4p):
 *
 *     ORIENT     77,970 in   2.26p   ← 36% of the input tokens
 *     RESEARCH   63,956 in   3.88p   ← 29%
 *
 * Two passes are **65% of what a build reads** and 6.14p of what it costs. At 1,000 pilot
 * users a free build each is £330, and "run it again" at full price makes iteration
 * unaffordable exactly where it is most valuable. **Unless the elicitation changed, they
 * should not run again.**
 *
 * ⚠⚠ THE CARRY IS COPIED AND THE USAGES ARE NOT. This is the line that decides whether the
 * saving is real or merely reported. `carry.orientation` and `carry.research` are what the
 * later passes actually read — and since 25-F `carry.research` carries the FINDINGS
 * THEMSELVES rather than a count of them, so reusing it hands the revision the same
 * material it had. `usages` are deliberately emptied: those tokens were spent on the
 * PREVIOUS build and are recorded there. Copying them forward would make every re-run
 * report the full price of a build it did not run, which is the opposite failure and
 * harder to notice.
 *
 * ⚠ SKIPPED, NOT DONE. A pass that did not run this time must not claim it did.
 * `nextPassKey` steps over SKIPPED; the progress display shows it as reused, with what is
 * being reused named on the line.
 */
export function reusedPassLog(
  previous: PassRecord[],
  reuse: readonly BuildPassKey[],
  note: (key: BuildPassKey, previousOutput: string | null) => string,
): PassRecord[] {
  return freshPassLog().map((p) => {
    if (!reuse.includes(p.key)) return p
    const before = previous.find((q) => q.key === p.key)
    // A pass that did not complete last time has nothing worth reusing — it runs again.
    if (!before || before.status !== 'DONE') return p
    return {
      ...p,
      status: 'SKIPPED' as PassStatus,
      startedAt: null,
      completedAt: new Date().toISOString(),
      output: note(p.key, before.output),
      carry: { ...(before.carry ?? {}) },
      // ⚠ EMPTY. See above — these tokens belong to the build that spent them.
      usages: [],
      // The queries are the record of what was ASKED, and the answers are being reused, so
      // the questions travel with them. They cost nothing to carry and a re-run that
      // showed no queries would look like a build that searched nothing.
      queries: before.queries ?? [],
    }
  })
}

export function readPassLog(raw: unknown): PassRecord[] {
  if (!Array.isArray(raw) || !raw.length) return freshPassLog()
  // Reconcile against the configured passes, so adding a pass in a later sprint does
  // not make an old row unreadable — and so a pass that is configured but missing from
  // a stored log shows as PENDING rather than vanishing.
  //
  // ⚠ THIS IS WHAT MAKES A 25-A BUILD READABLE BY 25-B. A row written when there were
  // four passes gains three PENDING ones here rather than failing to parse, and an
  // unfinished 25-A build can therefore be RESUMED into its research pass rather than
  // being stranded by the upgrade.
  const stored = raw as PassRecord[]
  return BUILD_PASSES.map((p) => {
    const found = stored.find((s) => s?.key === p.key)
    return found
      ? {
          ...found,
          label: p.label,
          detail: p.detail,
          carry: found.carry ?? {},
          usages: Array.isArray(found.usages) ? found.usages : [],
          activity: found.activity ?? null,
        }
      : {
          key: p.key, label: p.label, detail: p.detail, status: 'PENDING' as PassStatus,
          startedAt: null, completedAt: null, output: null, failureReason: null,
          activity: null, carry: {}, usages: [],
        }
  })
}

/**
 * Everything the passes before `key` handed forward, merged in pass order.
 *
 * Later passes win on a key they both set — REVISE's `diagnosis` supersedes DIAGNOSIS's,
 * which is exactly what pass 5 should be reading.
 */
/**
 * ══ 25-P §5 — THE PASSES THIS BUILD NEVER KNEW ABOUT ═══════════════════════════════
 *
 * §5: *"Inserting the commentary pass changed what a historic build says about itself: v7 now
 * reads '8 of 11' and resumes at the commentary. Not harmful, and '8 of 11' is true — but a
 * resumed historic build runs one pass it is not billed for. Fix or record with a stated
 * reason."*
 *
 * ⚠⚠ THE ANSWER IS "RECORD", AND HERE IS THE REASON, IN THE PLACE THAT PRODUCES THE FACT.
 *
 * A resume is not a purchase. The user already paid for this build at its own mode's price and
 * it stopped without finishing; billing again for finishing what they bought is the wrong
 * direction, and `resumeBuild` deliberately charges nothing. What §5 spotted is narrower: a
 * build that stopped BEFORE we added a pass gains that pass on resume, so it runs work that did
 * not exist when it was priced.
 *
 * We are not charging for it, for three reasons that are worth stating rather than assuming:
 *   1. **The pass exists because we added it, not because the user asked for it.** Charging for
 *      our own change of mind is not a thing to do quietly.
 *   2. **The money is already bounded.** `resumeBuild` caps resumes at MAX_RESUMES, and the
 *      per-build spend ceiling counts every pass including the stopped attempt's — so a free
 *      pass cannot become an unbounded one.
 *   3. **The alternative is worse.** Billing on resume would mean a stopped build costs more
 *      than a finished one, which is the opposite of what a user would expect and would make
 *      "carry on" a control people learn not to press.
 *
 * ⚠ WHAT WE DO OWE IS THE SENTENCE. The user should be told a pass has been added since their
 * build ran, and that it is included — which is what this function exists to let the UI say.
 * An unannounced free extra is still an unannounced change to something they paid for.
 */
export function passesAddedSince(raw: unknown): string[] {
  if (!Array.isArray(raw) || !raw.length) return []
  const stored = raw as PassRecord[]
  return BUILD_PASSES.filter((p) => !stored.some((s) => s?.key === p.key)).map((p) => p.label)
}

export function carryInto(log: PassRecord[], key: BuildPassKey): PassCarry {
  const upto = log.findIndex((p) => p.key === key)
  const out: PassCarry = {}
  for (const p of log.slice(0, upto < 0 ? log.length : upto)) {
    // ⚠⚠ `SKIPPED` COUNTS, AND LEAVING IT OUT BROKE EVERY REUSE BUILD.
    //
    // A reused pass is written to the log as SKIPPED with the previous build's carry copied
    // onto it (`reusedPassLog`). This filter accepted only DONE, so the carry was stored
    // correctly and then discarded on the way back out — `carry.research` arrived at REVISE
    // empty and the build died with "the research pass produced nothing to revise against".
    //
    // ⚠ IT LOOKED LIKE A DIFFERENT BUG, TWICE. 25-I fixed the evidence carry (which really
    // was moving rather than copying) and the same message came back, because two
    // independent defects sat on the same path: the ROWS were carried and the STRING was
    // not. The second was invisible until the first was fixed — measured on v4, which has
    // `research=6031ch` sitting on a SKIPPED record that nothing would read.
    //
    // The distinction the filter was reaching for is "a pass that produced nothing has
    // nothing to contribute". SKIPPED-with-a-carry is the opposite of that: it is a pass
    // whose output we deliberately kept. FAILED and PENDING still contribute nothing.
    if (p.status !== 'DONE' && p.status !== 'SKIPPED') continue
    for (const [k, v] of Object.entries(p.carry ?? {})) {
      if (v === undefined || v === null || v === '') continue
      ;(out as Record<string, unknown>)[k] = v
    }
  }
  return out
}

/** Every model call the build has made so far, across all its requests. */
export function allUsages(log: PassRecord[]): LlmUsage[] {
  return log.flatMap((p) => p.usages ?? [])
}

/**
 * §1 — WHICH PASS RUNS NEXT, and it is a question about the STORED log rather than
 * about what the caller believes.
 *
 * Returns null when there is nothing left to run, which is how the engine knows to
 * finish the build rather than asking the client to trigger a pass that does not exist.
 *
 * ⚠ A FAILED PASS STOPS THE BUILD; a SKIPPED one does not. A pass that could not run at
 * all (its question had no retrieval, say) is not the same event as a pass that ran and
 * broke, and collapsing them would let a build limp past a real failure.
 */
export function nextPassKey(log: PassRecord[]): BuildPassKey | null {
  for (const p of log) {
    // ⚠ 25-F — A FAILED PASS STILL STOPS THE BUILD, UNLESS IT IS DECLARED OTHERWISE.
    //
    // `continueOnFailure` (build-config.ts) marks the three passes 25-F added, and only
    // those. They run on a kernel that has already been drafted, researched and revised,
    // so losing the hostile clerk because a critique's panel model returned a string where
    // the schema asked for a list — which is exactly what happened on the first live run —
    // costs four passes to save none.
    //
    // ⚠ THE PASS IS STILL FAILED, NOT SKIPPED. It keeps its status and its reason, the
    // progress display renders it in amber, and the build summary names it. Stepping over
    // a failure quietly is the thing this whole file is written against.
    if (p.status === 'FAILED') {
      if (BUILD_PASSES.find((d) => d.key === p.key)?.continueOnFailure) continue
      return null
    }
    if (p.status === 'PENDING' || p.status === 'RUNNING') return p.key
  }
  return null
}

/** The passes that failed but were stepped over. Named so the build can say so. */
export function steppedOverFailures(log: PassRecord[]): PassRecord[] {
  return log.filter(
    (p) => p.status === 'FAILED' && BUILD_PASSES.find((d) => d.key === p.key)?.continueOnFailure,
  )
}

/**
 * ══ 25-N §1a — THE PASS A STOPPED BUILD WOULD PICK UP FROM ══════════════════════
 *
 * ⚠⚠ THIS IS NOT `nextPassKey`, AND THE DIFFERENCE IS THE WHOLE DEFECT. `nextPassKey`
 * answers "what should the engine run next on a build that is still going", so it only
 * looks at PENDING and RUNNING. When a build stops at a ceiling, `stopBuild` REWRITES every
 * remaining pass to NOT_REACHED — which is neither — so from the moment a build stops,
 * `nextPassKey` is null and `isResumable` is false. Measured on build v7 of idea
 * `452c5ade` (30 Aug 2026): 8 passes DONE, LOGIC_CHECK and ADVERSARIAL NOT_REACHED,
 * `resumable: false`, and no control anywhere offering to continue it.
 *
 * ⚠ A HARD FAILURE STILL STOPS IT. The same `continueOnFailure` rule as `nextPassKey`: a
 * pass that ran and broke, and is not declared steppable, is not work a resume can skip
 * past — re-running everything after it would build on an output that does not exist.
 */
export function resumablePassKey(log: PassRecord[]): BuildPassKey | null {
  for (const p of log) {
    if (p.status === 'FAILED') {
      if (BUILD_PASSES.find((d) => d.key === p.key)?.continueOnFailure) continue
      return null
    }
    if (p.status === 'PENDING' || p.status === 'RUNNING' || p.status === 'NOT_REACHED') return p.key
  }
  return null
}

/** The passes a resume would still have to run, in order. Named so the screen can say so. */
export function unrunPasses(log: PassRecord[]): PassRecord[] {
  const from = resumablePassKey(log)
  if (!from) return []
  const i = log.findIndex((p) => p.key === from)
  return log.slice(i).filter((p) => p.status !== 'DONE' && p.status !== 'SKIPPED')
}

/**
 * §1 — "an orphaned build must be resumable from its last completed pass."
 *
 * A build is resumable when it has work left and at least one pass already finished:
 * resuming a build that has done nothing is just starting it, and calling that a resume
 * would tell the user work was preserved when none was.
 *
 * ⚠ 25-N §1a — IT NOW READS `resumablePassKey`, so a build that stopped at a ceiling is
 * resumable rather than merely finished-looking. See the note above it.
 */
export function isResumable(log: PassRecord[]): boolean {
  return resumablePassKey(log) !== null && log.some((p) => p.status === 'DONE')
}

/**
 * The log a resume starts from: every NOT_REACHED pass at or after the resume point goes
 * back to PENDING so the ordinary engine can run it.
 *
 * ⚠ IT WRITES, IT DOES NOT DISPLAY — `build-settle.ts`'s rule. A pass that is going to run
 * again must SAY PENDING; rendering a NOT_REACHED pass as pending while the row says
 * otherwise is the split this codebase keeps finding.
 *
 * ⚠ AND IT KEEPS EVERY RECORDED USAGE. What the stopped attempt spent was really spent, and
 * the spend ceiling has to keep seeing it or a resume becomes a way round the ceiling.
 */
export function reopenForResume(log: PassRecord[]): PassRecord[] {
  const from = resumablePassKey(log)
  if (!from) return log
  const i = log.findIndex((p) => p.key === from)
  return log.map((p, n) =>
    n >= i && (p.status === 'NOT_REACHED' || p.status === 'RUNNING')
      ? { ...p, status: 'PENDING' as PassStatus, startedAt: null, completedAt: null, activity: null }
      : p)
}

export function passesComplete(log: PassRecord[]): number {
  return log.filter((p) => p.status === 'DONE').length
}
