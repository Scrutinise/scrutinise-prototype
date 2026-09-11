export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §1 (addendum) — RE-RUN THE ADVERSARIAL READING WITH A PREPARED OPPONENT.
//
// One export per measure, `critique/B23_OPPONENT_M-XX.md`, so CCW can place each beside its
// own measure.
//
// ══ ⚠⚠ TWO ARMS, AND THE UNHINTED ONE RUNS FIRST ═════════════════════════════════════════
//
// The finding behind this change is that since 2013 the senior judiciary has been moving
// rights protection off the Human Rights Act and onto the common law — Osborn, Kennedy,
// A v BBC, UNISON — so repeal does not restore 1997. The old pass did not find that.
//
// **Handing the new pass that paragraph would tell it the answer and prove nothing.** So:
//
//   ARM A (default)   persona only. Does a prepared public lawyer, told to look for narrow
//                     readings rather than refusals, reach the common-law migration alone?
//   ARM B (--hinted)  the same pass with `COMMON_LAW_MIGRATION` supplied, LABELLED in the
//                     prompt as context it was given rather than found.
//
// The harness scores arm A for whether it reached the migration — by looking for the case
// names and the doctrine in its own output — and prints that verdict whichever way it goes.
// ⚠ **A pass that only finds the answer when handed the answer is not a pass**, and this is
// the check that can say so.
//
//   npx tsx --env-file=.env scripts/b23-prepared-opponent.ts                 (plan)
//   npx tsx --env-file=.env scripts/b23-prepared-opponent.ts --go
//   npx tsx --env-file=.env scripts/b23-prepared-opponent.ts --go --only M-01 --hinted
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { kernelText, costLinesFor } from '../lib/lex/build'
import { evidenceForBuild } from '../lib/lex/evidence-scope'
import {
  runPreparedOpponent, COMMON_LAW_MIGRATION,
  type PreparedOpponentResult, type AttackRoute,
} from '../lib/lex/adversarial-prepared'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/critique')
const GO = process.argv.includes('--go')
const HINTED = process.argv.includes('--hinted')
const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null
/**
 * B23 §1 — `--run N` labels a repeat run so it does not overwrite the first. Files become
 * `B23_OPPONENT_M-XX_runN.md` and the structured routes go to `B23_OPPONENT_runN.json`, which
 * is what `b23-opponent-spread.ts` compares. ⚠ The pass is not deterministic; one run is not a
 * measurement, and the point of the label is that three runs can sit side by side.
 */
const runArg = process.argv.indexOf('--run')
const RUN = runArg > -1 ? process.argv[runArg + 1] : null
const SUFFIX = (HINTED ? '_hinted' : '') + (RUN ? `_run${RUN}` : '')
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

/**
 * ⚠ THE MARKERS OF THE MIGRATION, FOR SCORING ARM A. Case names and the doctrine, matched
 * case-insensitively over the pass's own words. This is a crude test and it is the right kind
 * of crude: a false positive here would need the pass to name Osborn or UNISON by accident.
 */
const MIGRATION_MARKERS = [
  'osborn', 'kennedy', 'a v bbc', 'unison',
  'common law', 'common-law',
]
const STRONG_MARKERS = ['osborn', 'kennedy', 'unison', 'a v bbc']

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()

const CLOSES_WORDS: Record<AttackRoute['planCloses'], string> = {
  CLOSES: '✔ the plan closes it',
  PARTLY: '◐ partly closed',
  DOES_NOT_CLOSE: '⚠ **the plan does NOT close it**',
  MAKES_IT_WORSE: '⚠⚠ **the plan makes it worse**',
}

interface Row {
  ref: string; title: string; ideaId: string
  result: PreparedOpponentResult | null
  hinted: boolean
  tokensIn: number; tokensOut: number
  /** Which migration markers appeared in the pass's own output. */
  markersHit: string[]
  strongHit: boolean
}

async function runOne(ref: string, hinted: boolean): Promise<Row | null> {
  let ideaId: string
  try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { return null }
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  if (!idea) return null

  const build = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: 'DONE' }, orderBy: { version: 'desc' }, select: { version: true },
  })
  const kernel = await kernelText(ideaId)
  const costLines = await costLinesFor(ideaId)
  const evidence = build ? await prisma.evidenceItem.findMany({
    where: { ...evidenceForBuild(ideaId, build.version), status: { not: 'REJECTED' } },
    select: { title: true, body: true },
    orderBy: { createdAt: 'asc' },
  }) : []

  const usages: Array<{ tokensIn: number; tokensOut: number }> = []
  const result = await runPreparedOpponent({
    kernel,
    costLines,
    findings: evidence.map((e) => `- ${e.title}: ${e.body}`),
    doctrinalContext: hinted ? COMMON_LAW_MIGRATION : undefined,
    onUsage: (u) => usages.push(u),
  })

  // ⚠ Scored over the pass's OWN WORDS, and the supplied context is not part of them.
  const text = result
    ? [result.overallLine, result.couldNotFind,
      ...result.routes.flatMap((r) => [r.route, r.restsOn, r.theOpening, r.planClosesWhy, r.whatWouldClose])]
      .join(' ').toLowerCase()
    : ''
  const markersHit = MIGRATION_MARKERS.filter((m) => text.includes(m))

  return {
    ref, title: idea.title, ideaId, result, hinted,
    tokensIn: usages.reduce((a, b) => a + (b.tokensIn ?? 0), 0),
    tokensOut: usages.reduce((a, b) => a + (b.tokensOut ?? 0), 0),
    markersHit,
    strongHit: STRONG_MARKERS.some((m) => text.includes(m)),
  }
}

function render(r: Row): string[] {
  const L: string[] = []
  L.push(`# ${r.ref} — ${r.title}`)
  L.push('')
  L.push('## Read by a prepared opponent')
  L.push('')
  L.push(`*${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · `
    + `${r.hinted ? '⚠ **hinted arm** — doctrinal context supplied' : 'unhinted — persona only'} · `
    + `${r.tokensIn} tokens in / ${r.tokensOut} out.*`)
  L.push('')
  L.push('> The reviewer is a specialist in public law, instructed **against** this proposal, holding a')
  L.push('> position he has already settled. The question is not whether the proposal will annoy anyone.')
  L.push('> It is **where a first-rate lawyer would attack it, and whether the plan closes that route.**')
  L.push('')
  L.push('⚠ **The attack that works is almost never a refusal. It is a reading.** A court does not')
  L.push('decline to apply an Act; it construes it. So the routes below are the ones that leave the')
  L.push('words intact and take their effect away.')
  L.push('')
  if (!r.result) {
    L.push('⚠⚠ **The pass did not complete.** That is recorded as a failure to produce a reading, never')
    L.push('as "there is no route" — the same rule the rest of the build holds.')
    L.push('')
    return L
  }
  if (r.result.overallLine) {
    L.push(`**The opponent's line:** ${r.result.overallLine}`)
    L.push('')
  }
  if (!r.result.routes.length) {
    L.push('**No route found.**')
    L.push('')
    if (r.result.couldNotFind) { L.push(`*In the pass's own words:* ${r.result.couldNotFind}`); L.push('') }
    return L
  }

  const open = r.result.routes.filter((x) => x.planCloses === 'DOES_NOT_CLOSE' || x.planCloses === 'MAKES_IT_WORSE')
  L.push(`**${r.result.routes.length} route(s). ${open.length} the plan does not close.**`)
  L.push('')
  L.push('| # | Route | Mechanism | Does the plan close it? |')
  L.push('|---|---|---|---|')
  r.result.routes.forEach((x, i) => {
    L.push(`| ${i + 1} | ${esc(x.route).slice(0, 140)} | \`${x.mechanism}\` | ${CLOSES_WORDS[x.planCloses] ?? x.planCloses} |`)
  })
  L.push('')
  r.result.routes.forEach((x, i) => {
    L.push(`### ${i + 1}. ${x.route}`)
    L.push('')
    L.push(`**Mechanism:** \`${x.mechanism}\`${x.mechanismOther ? ` — ${x.mechanismOther}` : ''}`)
    L.push('')
    L.push(`**Rests on:** ${x.restsOn}`)
    L.push('')
    if (x.theOpening) { L.push(`**The opening, in the proposal's own words:**`); L.push(''); L.push(`> ${x.theOpening}`); L.push('') }
    L.push(`**${CLOSES_WORDS[x.planCloses] ?? x.planCloses}** — ${x.planClosesWhy}`)
    L.push('')
    if (x.whatWouldClose) { L.push(`*What would close it:* ${x.whatWouldClose}`); L.push('') }
  })
  if (r.result.couldNotFind) {
    L.push(`⚠ *What the opponent could not find:* ${r.result.couldNotFind}`)
    L.push('')
  }
  L.push('---')
  L.push('')
  L.push('⚠ **`restsOn` may name an authority the pass is not certain of.** The prompt asks it to name')
  L.push('the doctrine and say so rather than invent a citation, because a fabricated authority')
  L.push('destroys the whole reading while an unnamed doctrine weakens only one route. **Check every')
  L.push('citation before any of this is quoted.**')
  L.push('')
  return L
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const refs = ONLY ? [ONLY] : ALL
  console.log(`${refs.length} measure(s) · ${HINTED ? '⚠ HINTED arm' : 'unhinted — persona only'}\n`)
  if (!GO) { console.log('PLAN ONLY — nothing called. Re-run with --go.'); await prisma.$disconnect(); return }

  const rows: Row[] = []
  for (const ref of refs) {
    const t = Date.now()
    const r = await runOne(ref, HINTED)
    if (!r) { console.log(`  ${ref}  skipped`); continue }
    rows.push(r)
    const open = r.result?.routes.filter((x) => x.planCloses === 'DOES_NOT_CLOSE' || x.planCloses === 'MAKES_IT_WORSE').length ?? 0
    console.log(`  ${ref}  ${r.result?.routes.length ?? 'null'} route(s), ${open} not closed  `
      + `${r.strongHit ? '★ named a migration case' : ''}  ${((Date.now() - t) / 1000).toFixed(0)}s`)

    const file = join(OUT, `B23_OPPONENT_${ref}${SUFFIX}.md`)
    writeFileSync(file, render(r).join('\n'), 'utf8')
  }

  // ══ THE INDEX, AND THE ARM-A VERDICT ═══════════════════════════════════════════════════
  const idx: string[] = []
  idx.push(`# The prepared opponent — ${HINTED ? 'hinted arm' : 'unhinted arm'}`)
  idx.push('')
  idx.push(`*${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  idx.push('')
  idx.push('The adversarial reading, re-run with the reviewer specified as a public-law specialist')
  idx.push('instructed against the proposal and holding a prepared position — looking for where a')
  idx.push('first-rate lawyer would attack, and whether the plan closes that route.')
  idx.push('')
  idx.push('| Measure | Routes | Plan does NOT close | Named a migration case |')
  idx.push('|---|---|---|---|')
  for (const r of rows) {
    const open = r.result?.routes.filter((x) => x.planCloses === 'DOES_NOT_CLOSE' || x.planCloses === 'MAKES_IT_WORSE').length ?? 0
    idx.push(`| [${r.ref}](B23_OPPONENT_${r.ref}${SUFFIX}.md) — ${esc(r.title)} `
      + `| ${r.result?.routes.length ?? '⚠ failed'} | ${open} | ${r.strongHit ? '**yes**' : 'no'} |`)
  }
  idx.push('')

  if (!HINTED) {
    const m01 = rows.find((r) => r.ref === 'M-01')
    idx.push('## ⚠⚠ Did the persona alone reach the common-law migration?')
    idx.push('')
    idx.push('The finding behind this change is that since 2013 the senior judiciary has been moving')
    idx.push('rights protection off the Human Rights Act and onto the common law — Osborn, Kennedy,')
    idx.push('A v BBC, UNISON — so repeal does not restore 1997. **The old pass did not find that.**')
    idx.push('')
    idx.push('This arm was NOT told. Handing it the paragraph would have told it the answer and proved')
    idx.push('nothing, so the question is whether a properly specified opponent gets there alone.')
    idx.push('')
    if (m01) {
      idx.push(m01.strongHit
        ? `✔ **On M-01 it did.** It named at least one of the authorities in its own reasoning `
          + `(markers hit: ${m01.markersHit.map((x) => `\`${x}\``).join(', ')}). The reframing is doing `
          + 'the work, not the hint.'
        : `⚠⚠ **On M-01 it did NOT name any of the four authorities.** Markers hit: `
          + `${m01.markersHit.length ? m01.markersHit.map((x) => `\`${x}\``).join(', ') : 'none'}. `
          + 'The persona alone is not enough to reach the prepared defence, which means the doctrinal '
          + 'context has to be supplied — and a pass that only finds the answer when handed the answer '
          + 'is not finding it. See the hinted arm.')
      idx.push('')
    }
    const anyStrong = rows.filter((r) => r.strongHit)
    idx.push(`Across all ${rows.length} measure(s), ${anyStrong.length} named one of the migration `
      + `authorities: ${anyStrong.length ? anyStrong.map((r) => r.ref).join(', ') : '—'}.`)
    idx.push('')
  }
  idx.push('⚠ **Every citation in these files needs checking before it is quoted.** The prompt asks the')
  idx.push('pass to name a doctrine rather than invent a citation, but that is an instruction and not a')
  idx.push('guarantee — and a fabricated authority would destroy the reading it sits in.')
  idx.push('')

  writeFileSync(join(OUT, `B23_OPPONENT_INDEX${SUFFIX}.md`), idx.join('\n'), 'utf8')
  if (RUN) {
    // The structured record, so a later comparison reads routes and not re-parsed prose.
    // ⚠ Runs 2 and 3 on 11 Sep were made before this block existed (a botched edit left the
    // index unsuffixed and no JSON); `b23-opponent-spread.ts` therefore parses the per-measure
    // markdown, which every run writes, and this JSON is for the next run.
    writeFileSync(join(OUT, `B23_OPPONENT${SUFFIX}.json`), JSON.stringify({
      run: RUN, hinted: HINTED, at: new Date().toISOString(),
      rows: rows.map((r) => ({
        ref: r.ref, title: r.title, tokensIn: r.tokensIn, tokensOut: r.tokensOut,
        strongHit: r.strongHit, markersHit: r.markersHit,
        overallLine: r.result?.overallLine ?? null,
        routes: r.result?.routes.map((x) => ({
          route: x.route, mechanism: x.mechanism, planCloses: x.planCloses, restsOn: x.restsOn,
        })) ?? null,
      })),
    }, null, 2), 'utf8')
  }
  console.log(`\nwritten: ${rows.length} file(s) + index`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
