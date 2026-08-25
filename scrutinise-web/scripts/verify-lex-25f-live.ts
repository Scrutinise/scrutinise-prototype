// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-25f — RUN THE REBUILD, ON A COPY, AND READ WHAT COMES OUT.
//
// §8's single measure: *"the rebuild surfaces at least one term of art Charlie did not
// supply — Carltona, Osmotherly, Accounting Officer, SRO or equivalent."* That cannot be
// asserted from source text. It needs a build to actually run.
//
// ⚠⚠ IT RUNS ON A COPY, AND THAT IS NOT CAUTION — IT IS THE DIFFERENCE BETWEEN VERIFYING
// AND DESTROYING.
//
// Re-running the build on Charlie's own idea `452c5ade` would create version 2, and
// `supersedeOlderProposals` marks every PROPOSED `EvidenceItem` from an earlier run
// REJECTED. That is exactly right for a real re-run and exactly wrong here: those 70 rows
// ARE `docs/LEX_FIRST_BUILD_KERNEL.md`, they are the artefact this whole brief is written
// from, and a verification run that quietly rejected them would have destroyed the only
// before-picture we have.
//
// So this COPIES the elicitation onto a new idea, marks it CONFIRMED, and builds that. The
// original is untouched and the comparison stays possible.
//
// ⚠ IT SPENDS REAL MONEY on real production data. `--dry-run` prints what it would do and
// stops; nothing runs without `--execute`.
//
// ⚠ AND RETRIEVAL IS WEAKER HERE THAN IN PRODUCTION. `.env` on this machine has no
// `FTS_SEARCH_URL`, no `LEX_VECTOR_STREAMS` and no `LEX_QUERY_ROUTER`, so the corpus half
// runs degraded (see docs/CLAUDE.md §19 and the local-search-flags note). A term the corpus
// fails to confirm HERE may well be confirmed in production. That cuts one way only: a
// CONFIRMED term is real evidence; an UNVERIFIED one here is not evidence of absence.
//
// Usage:
//   npm run verify:lex-25f -- --dry-run
//   npm run verify:lex-25f -- --execute
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { claimBuild, runBuildToCompletion, buildState } from '../lib/lex/build'
import { confirmElicitation } from '../lib/lex/elicitation'
import { DEFAULT_FRAMING } from '../lib/lex/build-config'
import { buildHighlights } from '../lib/lex/build-highlights'
import { SMART_VOCABULARY_PASS_KEY } from '../lib/lex/build-smart'
import { resolvedConfigLine, retrievalFlagState } from '../lib/lex/harness-preflight'

/** The terms §8 names. "or equivalent" is why the check reports rather than asserts a set. */
const TERMS_OF_ART = [
  'carltona', 'osmotherly', 'accounting officer', 'senior responsible owner',
  'accounting direction', 'ministerial responsibility', 'next steps agency',
  'permanent secretary', 'arm\'s-length body', 'accounting officer memorandum',
]

async function main() {
  const execute = process.argv.includes('--execute')
  const sourceArg = process.argv.find((a) => a.startsWith('--idea='))?.split('=')[1]

  // The idea to copy: the first build ever run, unless told otherwise.
  const source = sourceArg
    ? await prisma.ideaElicitation.findFirst({
        where: { ideaId: { startsWith: sourceArg } },
        include: { idea: { select: { id: true, creatorId: true, title: true } } },
      })
    : await prisma.ideaElicitation.findFirst({
        where: { status: 'CONFIRMED', problem: { not: null } },
        orderBy: { updatedAt: 'desc' },
        include: { idea: { select: { id: true, creatorId: true, title: true } } },
      })

  if (!source) {
    console.error('No confirmed elicitation to copy. Nothing to verify against.')
    process.exit(1)
  }

  console.log('── verify:lex-25f ──')
  // ⚠⚠ THE RETRIEVAL CONFIG, PRINTED WITH THE RESULT, ALWAYS. §19's rule, and this run is
  // exactly why it exists: the first attempt on this machine had no `FTS_SEARCH_URL`, so
  // EVERY corpus search returned zero and failed — and "0 terms of art confirmed" would
  // have read as a verdict on the smart pass when it was a verdict on this .env file. A
  // measurement whose configuration is not beside it is not a measurement.
  console.log(resolvedConfigLine())
  for (const d of retrievalFlagState().degraded) console.log(`  ⚠ ${d}`)
  console.log(`source idea      ${source.ideaId} ("${source.idea.title}")`)
  console.log(`problem          ${(source.problem ?? '').length} chars`)
  console.log(`own knowledge    ${(source.ownKnowledge ?? '').length} chars`)
  console.log(`goal / ruled out ${(source.goalDetail ?? '').length} / ${(source.ruledOut ?? '').length} chars`)

  if (!execute) {
    console.log('\n⚠ DRY RUN. Nothing was created and no model was called.')
    console.log('  --execute copies this elicitation onto a NEW idea, marks it CONFIRMED, and')
    console.log('  runs a full build. That spends real money and writes to production.')
    console.log('  ⚠ The SOURCE idea is never touched — see the header for why that matters.')
    await prisma.$disconnect()
    return
  }

  // ── The copy. Additive: a new row, nothing overwritten. ────────────────────
  const copy = await prisma.idea.create({
    data: {
      creatorId: source.idea.creatorId,
      // ⚠ THE PLACEHOLDER, VERBATIM, AND THAT IS THE POINT. The first version of this
      // titled the copy "[25-F verification] rebuild of 452c5ade" — so `nameTheIdea`
      // correctly declined to overwrite a title somebody had chosen, and the §7 assertion
      // reported ✓ having tested nothing. A verification that gives the code an easier
      // input than production does is not a verification.
      title: 'Untitled idea',
      // ⚠ THE SAME SHAPE `POST /api/ideas` WRITES, field for field. Two required columns
      // (`summaryDescription`, `govtArea`) were discovered one failed run at a time by
      // guessing; mirroring the route is the only version of this that stays true when a
      // third is added.
      //
      // ⚠ AND `summaryDescription` STAYS EMPTY ON PURPOSE. The Stage 1→2 transition fires
      // automatically when title AND summaryDescription are both non-empty
      // (docs/CLAUDE.md §3). A verification copy must not advance a stage.
      summaryDescription: '',
      govtArea: '',
      stage: 'STAGE_1',
      visibility: 'PRIVATE',
      status: 'DRAFT',
    },
    select: { id: true },
  })
  await prisma.ideaElicitation.create({
    data: {
      ideaId: copy.id,
      problem: source.problem,
      goalKind: source.goalKind,
      goalDetail: source.goalDetail,
      ruledOut: source.ruledOut,
      ownKnowledge: source.ownKnowledge,
      readingUrl: source.readingUrl,
      readingFileName: source.readingFileName,
      understanding: source.understanding,
      // ⚠⚠ NOT `status: 'CONFIRMED'` — SEE BELOW. Left IN PROGRESS so the real confirm runs.
    },
  })

  // ⚠⚠ THE COPY IS CONFIRMED THROUGH `confirmElicitation`, NOT BY WRITING THE COLUMN.
  //
  // This script used to set `status: 'CONFIRMED', confirmedAt: new Date()` directly, and
  // that made every copy it produced SUBTLY UNFAITHFUL in a way that cost a real user real
  // time.
  //
  // `confirmElicitation` is the ONLY code that writes the page-one kernel fields — it calls
  // `submitBox(ideaNarrative)` with the problem and `submitBox(youAndIdeaNarrative)` with
  // the goal, the ruled-outs and the own-knowledge. Setting the column skips it. So a copy
  // made by this script had a CONFIRMED elicitation and PERMANENTLY EMPTY page-one boxes,
  // where a genuine walk-through fills them (452c5ade: 2,934 and 1,478 characters).
  //
  // On 25 Aug Charlie found one of these copies left behind, re-ran it, opened the proposal
  // and reported the empty boxes as a product defect. They were an artefact of this line.
  //
  // ⚠ THE RULE THIS LEAVES BEHIND: a fixture that reaches a state by writing the state
  // rather than by taking the path is not a fixture of that state. It is a different object
  // that passes the same status check — and every downstream difference is invisible until
  // somebody looks at the screen.
  await confirmElicitation(copy.id, source.idea.creatorId)
  console.log(`\ncopied to        ${copy.id}`)

  const started = Date.now()
  const buildId = await claimBuild(copy.id, DEFAULT_FRAMING)
  console.log(`build            ${buildId} (framing ${DEFAULT_FRAMING})`)
  console.log('running…\n')

  const view = await runBuildToCompletion(copy.id, source.idea.creatorId, buildId)

  // ── What happened ─────────────────────────────────────────────────────────
  console.log(`\n══ ${view.status} · ${view.passesComplete}/${view.passesTotal} passes · `
    + `${Math.round((Date.now() - started) / 1000)}s · ${view.spend.line} ══\n`)
  for (const p of view.passes) {
    console.log(`  ${p.status.padEnd(11)} ${p.label}`)
    if (p.output) console.log(`              ${p.output}`)
    if (p.failureReason) console.log(`              ⚠ ${p.failureReason}`)
  }

  // ── §4 — the queries ──────────────────────────────────────────────────────
  console.log('\n══ QUERIES ISSUED ══')
  for (const q of view.queries) {
    console.log(`  [${q.provenance}] ${q.by}`)
    console.log(`      ${q.terms.join(' · ')}`)
    console.log(`      ${q.purpose}`)
  }
  const extracted = view.queries.filter((q) => q.provenance === 'extracted').length
  console.log(`  → ${view.queries.length - extracted} written, ${extracted} fell back to extraction`)

  // ── §8's single measure ───────────────────────────────────────────────────
  const highlights = await buildHighlights(copy.id, view.version)
  const gapRow = await prisma.deepeningPass.findUnique({
    where: { ideaId_passKey: { ideaId: copy.id, passKey: SMART_VOCABULARY_PASS_KEY } },
    select: { knownUnknowns: true },
  })

  console.log('\n══ TERMS OF ART ══')
  console.log('CONFIRMED by the corpus:')
  for (const t of highlights.vocabulary.confirmed) console.log(`  ✓ ${t}`)
  if (!highlights.vocabulary.confirmed.length) console.log('  (none)')
  console.log('NAMED but UNVERIFIED:')
  for (const u of highlights.vocabulary.unverified) console.log(`  ⚠ ${u.term}`)
  if (!highlights.vocabulary.unverified.length) console.log('  (none)')

  // ⚠ THE MEASURE IS "A TERM CHARLIE DID NOT SUPPLY", so it is checked against what he
  // actually wrote — not against a hardcoded list of five words. The named five are
  // reported separately because §8 names them, but "or equivalent" is the real bar.
  const supplied = `${source.problem ?? ''} ${source.ownKnowledge ?? ''} ${source.goalDetail ?? ''}`.toLowerCase()
  // ⚠ THE ISSUED QUERIES COUNT, AND THE FIRST FULL RUN IS WHY THEY WERE ADDED.
  //
  // The measure originally read only the confirmed and unverified term lists, and reported
  // ONE of §8's five named terms — while the queries the build actually issued carried
  // Carltona, the Osmotherly Rules, the Accounting Officer AND the Senior Responsible
  // Owner, every one of them absent from anything the user wrote. A term that became a
  // corpus query IS surfaced by the build; that is the whole of §2b's "the models supply
  // the vocabulary". Counting only the survivors of retrieval measured the corpus, not the
  // pass.
  const allNamed = [
    ...highlights.vocabulary.confirmed,
    ...highlights.vocabulary.unverified.map((u) => u.term),
    ...view.queries.flatMap((q) => q.terms),
    ...JSON.stringify(gapRow?.knownUnknowns ?? []).split('"').filter((x) => x.length > 3),
  ].map((t) => t.toLowerCase())

  const namedFive = TERMS_OF_ART.filter((t) => allNamed.some((n) => n.includes(t)) && !supplied.includes(t))
  const newToUser = highlights.vocabulary.confirmed.filter(
    (t) => !supplied.includes(t.toLowerCase().slice(0, 30)),
  )

  console.log('\n══ §8 — THE SINGLE MEASURE ══')
  console.log(`terms §8 names, surfaced and NOT supplied by the user: ${namedFive.length ? namedFive.join(', ') : 'none'}`)
  console.log(`cited findings under terms the user did not supply:    ${newToUser.length}`)
  console.log(`  ${namedFive.length || newToUser.length ? '✓ MET' : '✗ NOT MET'}`)

  console.log('\n══ WHAT THE SCREEN NOW SHOWS ══')
  console.log(`drafted fields    ${highlights.drafted.length}`)
  console.log(`leading findings  ${highlights.leading.length} (of ${highlights.leading.length + highlights.supporting.length} kept, ${highlights.demotedCount} demoted)`)
  console.log(`judgements        ${highlights.judgements.map((j) => j.title).join(' · ') || '(none)'}`)
  console.log(`sources cited     ${highlights.sources.length}`)
  console.log('\nTop of the screen:')
  for (const f of highlights.leading.slice(0, 5)) {
    console.log(`  [${f.kind}] ${f.title}`)
    console.log(`      ${f.citation ?? '(no citation)'}`)
  }

  // ── §6 — the three defects, read back from the database ───────────────────
  const [emptyProposals, forks, idea] = await Promise.all([
    prisma.ideaFieldState.findMany({
      where: { ideaId: copy.id, status: 'AWAITING_CONFIRMATION' },
      select: { fieldKey: true, proposal: true },
    }),
    prisma.buildFork.findMany({
      where: { buildId }, select: { forkKey: true, fieldKey: true, chosen: true, alternative: true },
    }),
    prisma.idea.findUnique({ where: { id: copy.id }, select: { title: true } }),
  ])
  const empties = emptyProposals.filter((f) => {
    const v = (f.proposal as { value?: unknown } | null)?.value
    return v === '' || v === null || v === undefined
  })
  const dupeAlts = forks.filter((f, i) =>
    forks.some((g, j) => i !== j && g.forkKey === f.forkKey && g.alternative.trim() === f.alternative.trim()))
  const dupeDecisions = forks.filter((f, i) =>
    forks.some((g, j) => i !== j && g.forkKey !== f.forkKey && g.fieldKey === f.fieldKey
      && g.chosen.trim() === f.chosen.trim()))

  console.log('\n══ §6 — THE THREE DEFECTS, READ BACK ══')
  console.log(`6a fields at AWAITING with an empty proposal: ${empties.length} ${empties.length ? `⚠ ${empties.map((e) => e.fieldKey).join(', ')}` : '✓'}`)
  console.log(`6b anticipatedResponses / conditionsForSuccess drafted: `
    + `${['anticipatedResponses', 'conditionsForSuccess'].filter((k) => emptyProposals.some((f) => f.fieldKey === k)).join(', ') || '⚠ neither'}`)
  console.log(`6c forks with a duplicated alternative:       ${dupeAlts.length} ${dupeAlts.length ? '⚠' : '✓'}`)
  console.log(`6c one decision recorded as two forks:        ${dupeDecisions.length} ${dupeDecisions.length ? '⚠' : '✓'}`)
  console.log(`§7 the idea is named:                        "${idea?.title}" ${idea?.title?.includes('Untitled') ? '⚠' : '✓'}`)

  console.log(`\n▶ The copy is idea ${copy.id}. Delete it when you are done with it.`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
