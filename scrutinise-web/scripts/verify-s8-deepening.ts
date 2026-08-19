// ─────────────────────────────────────────────────────────────────────────────
// verify-s8-deepening.ts — BRIEF_SEARCH_S8 §1's live verification.
//
// "run the Deepening on at least two real ideas (one with a clear instrument, one without).
//  Read the persisted artefacts back from Neon — the artefact, not the counter."
//
// ⚠⚠ THE ARTEFACT, NOT THE COUNTER, IS THE WHOLE POINT. `RunOutcome.findings` moving from 4 to 6
// proves that six rows were counted, not that any of them says anything. Every assertion below
// is made against the `body` TEXT of a row re-read from Neon after the run — which is how the
// V36 sprint found that its best pilot result was 137 sections of dot leaders.
//
// ⚠ IT RUNS ON HARNESS IDEAS IT CREATES AND HARD-DELETES, not on ideas belonging to a user.
// A Deepening run writes PROPOSED evidence into an idea's panel; doing that to somebody's real
// idea to take a measurement would put rows in front of them that they did not ask for. The
// ideas are seeded with real corpus-anchored content and one carries a REAL `IdeaLegislation`
// link, so the code paths exercised are the production ones. `--keep` skips the delete.
//
//   FTS_SEARCH_URL=… LEX_QUERY_ROUTER=true LEX_VECTOR_STREAMS=… GEMINI_API_KEY=… \
//     npx tsx --env-file=.env scripts/verify-s8-deepening.ts
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { claimPass, runPass } from '../lib/lex/deepening'
import { assertRetrievalConfig, resolvedConfigLine } from '../lib/lex/harness-preflight'
import { MAX_INSTRUMENTS } from '../lib/lex/deepening-jobs'

const KEEP = process.argv.includes('--keep')
let pass = 0
let fail = 0
function check(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${name}${detail ? `  — ${detail}` : ''}`) }
}

/**
 * ⚠ THE ANCHOR IS CHOSEN AT RUN TIME, NOT HARDCODED. The first draft pinned
 * `ukpga/2010/15` (Equality Act 2010) as "an instrument that certainly has explanatory
 * material" — and the run reported that it is not in `LegislationItem` at all, so the link
 * could not be seeded and the linked-instrument path went untested while the harness still
 * printed a mostly-green result. A fixture that cannot be verified against the store is a
 * fixture that quietly tests nothing.
 *
 * So the harness QUERIES for an instrument that satisfies both halves — a `LegislationItem`
 * row exists (so a link is seedable) AND the corpus holds explanatory material for it (so the
 * job has legs to assemble) — and refuses to run if it cannot find one.
 */
async function findAnchor(): Promise<{ gid: string; itemId: string; title: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ gid: string }>>`
    SELECT DISTINCT split_part(s.id, ':', 3) AS gid
    FROM (SELECT id FROM corpus_sections
          WHERE corpus IN ('explanatory-notes', 'impact-assessments')
            AND status = 'compiled' LIMIT 60000) s
    WHERE s.id LIKE '%:ukpga/%'
    LIMIT 400`
  for (const r of rows) {
    if (!r.gid) continue
    const item = await prisma.legislationItem.findFirst({
      where: { legislationGovUkId: r.gid }, select: { id: true, title: true },
    })
    if (item) return { gid: r.gid, itemId: item.id, title: item.title }
  }
  return null
}

async function seedIdea(opts: {
  title: string; challenge: string; keywords: string[]; userId: string; govtArea: string
  linkGid: string | null; linkItemId: string | null
}): Promise<string> {
  const idea = await prisma.idea.create({
    data: {
      title: opts.title,
      summaryDescription: opts.challenge,
      challenge: opts.challenge,
      keywords: opts.keywords,
      govtArea: opts.govtArea,
      creator: { connect: { id: opts.userId } },
    },
    select: { id: true },
  })
  if (opts.linkItemId) {
    await prisma.ideaLegislation.create({ data: { ideaId: idea.id, legislationItemId: opts.linkItemId, linkType: 'target' } })
    console.log(`   seeded ${idea.id} WITH a real IdeaLegislation link → ${opts.linkGid}`)
  } else {
    console.log(`   seeded ${idea.id} with NO instrument link`)
  }
  return idea.id
}

async function readBack(ideaId: string, passKey: string) {
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId, passKey }, orderBy: { createdAt: 'asc' },
  })
  const passRow = await prisma.deepeningPass.findUnique({ where: { ideaId_passKey: { ideaId, passKey } } })
  return { rows, passRow }
}

async function main() {
  assertRetrievalConfig('verify-s8-deepening')
  console.log(resolvedConfigLine())
  console.log(`MAX_INSTRUMENTS = ${MAX_INSTRUMENTS}\n`)

  const user = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  if (!user) throw new Error('no user to own the harness ideas')

  const anchor = await findAnchor()
  if (!anchor) throw new Error('no instrument satisfies BOTH halves (LegislationItem row + explanatory material) — cannot test the linked path honestly')
  console.log(`anchor instrument: ${anchor.gid} — ${anchor.title}`)

  console.log('\n── seeding two harness ideas ──')
  const withInstrument = await seedIdea({
    userId: user.id, govtArea: 'Work and Pensions',
    title: 'S8 harness — an idea with a clear instrument',
    challenge: `A proposal that amends ${anchor.title}.`,
    keywords: anchor.title.split(/\s+/).filter((w) => w.length > 3).slice(0, 5),
    linkGid: anchor.gid, linkItemId: anchor.itemId,
  })
  const withoutInstrument = await seedIdea({
    userId: user.id, govtArea: 'Culture, Media and Sport',
    title: 'S8 harness — an idea with no identifiable instrument',
    challenge: 'Community choirs in rural villages have nowhere affordable to rehearse.',
    keywords: ['community choir rehearsal space rural village hall'],
    linkGid: null, linkItemId: null,
  })

  const created = [withInstrument, withoutInstrument]

  try {
    for (const [label, ideaId, passKey] of [
      ['WITH an instrument', withInstrument, 'EVIDENCE_PRECEDENT'],
      ['WITH an instrument', withInstrument, 'LEGAL'],
      ['WITHOUT an instrument', withoutInstrument, 'EVIDENCE_PRECEDENT'],
      ['WITHOUT an instrument', withoutInstrument, 'LEGAL'],
    ] as const) {
      console.log(`\n════ ${passKey} on the idea ${label} ════`)
      const v = await claimPass(ideaId, passKey)
      const outcome = await runPass(ideaId, passKey, v)
      console.log(`   outcome: status=${outcome.status} findings=${outcome.findings} issues=${outcome.issues} knownUnknowns=${outcome.knownUnknowns}${outcome.failureReason ? ` failureReason=${outcome.failureReason}` : ""}`)
      for (const j of outcome.jobs ?? []) {
        console.log(`   job ${j.job}: written=${j.written} detail=${j.detail}`)
        if (j.skipReason) console.log(`      SKIPPED: ${j.skipReason}`)
      }

      // ── READ BACK FROM NEON. Everything below is asserted on stored text. ────────────────
      const { rows, passRow } = await readBack(ideaId, passKey)
      const jobRows = rows.filter((r) => r.sourceType === 'PRECEDENT_GROUP' || r.sourceType === 'DEVOLUTION_SCOPE')
      console.log(`   read back from Neon: ${rows.length} evidence row(s), ${jobRows.length} of them from a job`)

      for (const r of jobRows) {
        console.log(`\n   ── stored row [${r.sourceType}] status=${r.status} kind=${r.kind}`)
        console.log(`      title: ${r.title}`)
        console.log(`      body:\n${r.body.split('\n').map((l) => `        ${l}`).join('\n')}`)
      }

      const ku = (passRow?.knownUnknowns ?? []) as Array<{ question: string; why: string }>
      const jobKu = ku.filter((k) => /comparable instrument|parliaments and assemblies/.test(k.question))
      if (jobKu.length) {
        console.log('\n   ── known unknowns written by a skipped job')
        for (const k of jobKu) console.log(`      Q: ${k.question}\n         ${k.why}`)
      }

      // ── the constraints, on the stored artefact ──────────────────────────────────────────
      if (passKey === 'EVIDENCE_PRECEDENT') {
        const groups = jobRows.filter((r) => r.sourceType === 'PRECEDENT_GROUP')
        if (ideaId === withInstrument) {
          check(groups.length > 0, '⚠ the linked instrument produced a stored PRECEDENT group',
            `${groups.length} group(s)`)
          for (const g of groups) {
            check(/INTENDED|PREDICTED|OBSERVED/.test(g.body),
              '   …whose body is the intended/predicted/observed GROUP, not a ranked list')
            check(!/^\s*\d+\.\s/m.test(g.body), '   …and carries no rank numbering')
            check(g.status === 'PROPOSED', '   …stored PROPOSED, so the user judges it')
            check(/linked to your idea|found by the search for your idea/.test(g.body),
              '   …and states HOW the instrument was identified')
            if (/linked to your idea/.test(g.body)) {
              check(true, '⚠⚠ the LINKED-instrument path produced a group — the strongest source works end to end')
            }
            // ⚠ The sentence §1 requires to be REACHABLE in real output.
            if (/NO POST-IMPLEMENTATION REVIEW EXISTS/.test(g.body)) {
              check(true, '⚠⚠ the "nobody has checked whether this worked" sentence IS in real stored output')
              check(/Do NOT substitute what was PREDICTED for what was OBSERVED/.test(g.body),
                '   …with the instruction never to substitute the prediction for the outcome')
            } else {
              console.log('      (this instrument has all three legs — the missing-PIR sentence did not fire here)')
            }
          }
        } else {
          check(groups.length === 0 || groups.every((g) => /INTENDED|PREDICTED|OBSERVED/.test(g.body)),
            'an idea with no linked instrument writes a group only if retrieval identified one')
          if (groups.length === 0) {
            check(jobKu.some((k) => /comparable instrument/.test(k.question)),
              '⚠ …and when it writes nothing it says WHY, as a known unknown the user can act on',
              jobKu[0]?.why?.slice(0, 90) ?? 'NO REASON RECORDED')
          }
        }
      }

      if (passKey === 'LEGAL') {
        const dev = jobRows.filter((r) => r.sourceType === 'DEVOLUTION_SCOPE')
        if (dev.length) {
          for (const d of dev) {
            check(/WHO HAS LEGISLATED/.test(d.body), 'the devolution row leads with WHO HAS LEGISLATED')
            check(/\[(UK-wide|Scotland|Wales|Northern Ireland|England & Wales|unknown)\]/.test(d.body),
              '   …and every item is jurisdiction-labelled')
            check(/NOT a ruling on whether the subject is reserved or devolved/.test(d.body),
              '⚠⚠ …and the stored body REFUSES the reservation question')
            check(/Schedule 5 to the Scotland Act 1998/.test(d.body) && /Schedule 7A/.test(d.body)
              && /Schedules 2 and 3 to the Northern Ireland Act 1998/.test(d.body),
              '   …naming all three schedules that actually decide it')
            check(d.precedentTestPassed === null,
              '   …and carries precedentTestPassed NULL, not false ("not assessed" ≠ "assessed and failed")')
            // ⚠ The 577-line body defect. `retrieveDevolutionScope(query, limit=24)` was rendering
            // every result the ROUTED path returned (5 streams x ~60), not `limit`.
            const items = (d.body.match(/^- \[/gm) ?? []).length
            check(items > 0 && items <= 24,
              '⚠⚠ …and the block honours its limit — the 577-line body defect stays fixed',
              `${items} rendered items (cap 24)`)
          }
        } else {
          check(jobKu.some((k) => /parliaments and assemblies/.test(k.question)),
            'a devolution job that wrote nothing recorded why',
            jobKu.find((k) => /parliaments/.test(k.question))?.why?.slice(0, 90) ?? 'NO REASON RECORDED')
        }
      }

      // The standing invariant, checked against stored rows rather than trusted.
      check(rows.every((r) => r.status === 'PROPOSED' || r.status === 'REJECTED'),
        'every stored row is PROPOSED or REJECTED — nothing auto-ACCEPTED',
        [...new Set(rows.map((r) => r.status))].join(','))
    }
  } finally {
    if (KEEP) {
      console.log(`\n--keep set; harness ideas left in place: ${created.join(', ')}`)
    } else {
      for (const id of created) {
        await prisma.evidenceItem.deleteMany({ where: { ideaId: id } })
        await prisma.deepeningIssue.deleteMany({ where: { ideaId: id } })
        await prisma.deepeningPass.deleteMany({ where: { ideaId: id } })
        await prisma.ideaLegislation.deleteMany({ where: { ideaId: id } })
        await prisma.idea.delete({ where: { id } }).catch((e) => console.warn(`   could not delete ${id}: ${e.message}`))
      }
      console.log(`\nharness ideas hard-deleted: ${created.join(', ')}`)
    }
  }

  console.log(`\n════ ${fail ? `${fail} FAILED, ${pass} passed` : `all ${pass} checks pass`} ════`)
  console.log(resolvedConfigLine())
  await prisma.$disconnect()
  if (fail) process.exit(1)
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
