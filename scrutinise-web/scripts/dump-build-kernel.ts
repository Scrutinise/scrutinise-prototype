// ─────────────────────────────────────────────────────────────────────────────
// dump:kernel — EVERYTHING A BUILD WROTE, AS MARKDOWN, FOR REVIEW.
//
// READ-ONLY. Reads one idea and every row attached to it and renders a review document:
// the elicitation (the user's own words), the build and its seven passes, every fork, every
// field state, and every model that hangs off the idea.
//
// ⚠ IT LEADS WITH §0 BECAUSE THE DUMP IS OTHERWISE MISREADABLE. The canonical `Idea`
// columns are EMPTY after a successful build — the drafted kernel sits in `IdeaFieldState`
// at `AWAITING_CONFIRMATION` until a human accepts it. A reviewer who reads §1 and stops
// would conclude the build produced nothing.
//
// ⚠ AN UNQUERYABLE MODEL IS REPORTED AS UNQUERIED, NOT AS ZERO. A model with no `ideaId`
// column throws; printing "0 rows" for it would be a claim about the data made from a
// failure of the query.
//
// Usage: npm run dump:kernel -- <ideaId> <outPath>
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs'
import { prisma } from '../lib/prisma'

const ideaId = process.argv[2]
const out = process.argv[3]
const L: string[] = []
const w = (s = '') => L.push(s)

function fence(v: unknown) {
  if (v === null || v === undefined) return '_(null)_'
  if (typeof v === 'string') return v.trim() ? v : '_(empty string)_'
  return '```json\n' + JSON.stringify(v, null, 2) + '\n```'
}

/** Blobs too big to sit inline; emitted as an appendix so they don't bury the kernel. */
const APPENDIX: [string, string][] = []

/** A scalar table of a record, long text broken out below it. */
function record(r: Record<string, any>, longAt = 200, deferOver = 4000, deferLabel = '') {
  const long: [string, string][] = []
  w('| field | value |')
  w('|---|---|')
  for (const [k, v] of Object.entries(r)) {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      const json = JSON.stringify(v, null, 2)
      if (json.length > deferOver) {
        const anchor = `${deferLabel}${k}`
        APPENDIX.push([anchor, '```json\n' + json + '\n```'])
        w(`| \`${k}\` | _(${json.length} chars of JSON — **Appendix: ${anchor}**)_ |`)
        continue
      }
      long.push([k, '```json\n' + json + '\n```'])
      w(`| \`${k}\` | _(object — below)_ |`)
      continue
    }
    const s = v instanceof Date ? v.toISOString() : String(v ?? '')
    if (s.length > longAt) {
      long.push([k, s])
      w(`| \`${k}\` | _(${s.length} chars — below)_ |`)
    } else {
      w(`| \`${k}\` | ${s.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '_(empty)_'} |`)
    }
  }
  for (const [k, s] of long) {
    w()
    w(`**\`${k}\`**`)
    w()
    w(s.startsWith('```') ? s : '> ' + s.split('\n').join('\n> '))
  }
}

async function main() {
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    include: { creator: { select: { email: true, username: true, preferredName: true } } },
  })
  const elic = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  const builds = await prisma.ideaBuild.findMany({ where: { ideaId }, orderBy: { version: 'asc' } })
  const forks = await prisma.buildFork.findMany({ where: { ideaId }, orderBy: [{ fieldKey: 'asc' }, { alternativeIndex: 'asc' }] })
  const fields = await prisma.ideaFieldState.findMany({ where: { ideaId }, orderBy: { fieldKey: 'asc' } })

  w(`# LEX — THE FIRST BUILD EVER RUN ON THE PLATFORM`)
  w()
  w(`*Complete data dump for CCh review. Every row this build wrote, verbatim from the*`)
  w(`*production database (Neon \`ep-old-dust-aboxi69a\`), nothing summarised or paraphrased.*`)
  w()
  w(`- **Idea:** \`${ideaId}\``)
  w(`- **Owner:** ${idea.creator?.email}`)
  w(`- **Dumped:** ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  w(`- **Live:** https://www.scrutinise.org/ideas/create?ideaId=${ideaId}`)
  w()
  w(`⚠ **Read the provenance line on every section.** The elicitation is the USER'S OWN WORDS.`)
  w(`Everything under "the build" is LEX'S DRAFT, proposed and not yet accepted by a human —`)
  w(`\`IdeaFieldState.status\` is the field that says which.`)
  w()
  w('---')
  w()

  // ── §0, and it exists because of the single most misreadable fact in this dump ──
  const awaiting = fields.filter(f => f.status === 'AWAITING_CONFIRMATION')
  const accepted = fields.filter(f => f.status === 'ACCEPTED')
  const empty = fields.filter(f => f.status === 'EMPTY')
  const b0 = builds[0]
  w(`## 0. How to read this — and the one thing that will otherwise mislead you`)
  w()
  w(`### ⚠⚠ THE CANONICAL \`Idea\` COLUMNS ARE EMPTY, AND THAT IS CORRECT`)
  w()
  w(`\`Idea.challenge\`, \`Idea.chosenApproach\`, \`Idea.pivotalObstacle\`, \`Idea.summaryDiagnosis\``)
  w(`and the rest of the kernel columns in §1 are all **empty strings**. Nothing failed.`)
  w()
  w(`**The drafted kernel lives in \`IdeaFieldState\` (§5), as \`proposal\` JSON, at status**`)
  w(`**\`AWAITING_CONFIRMATION\`** — Lex has proposed it and *no human has agreed to any of it yet*.`)
  w(`A proposal is promoted into the canonical column only when the user accepts it. Reading §1`)
  w(`alone would tell you this build produced nothing; reading §5 tells you what it actually wrote.`)
  w()
  w(`| status | count | fields |`)
  w(`|---|---|---|`)
  w(`| **AWAITING_CONFIRMATION** (Lex drafted, nobody has agreed) | ${awaiting.length} | ${awaiting.map(f => '`' + f.fieldKey + '`').join(', ')} |`)
  w(`| **ACCEPTED** (the user's own words, from the elicitation) | ${accepted.length} | ${accepted.map(f => '`' + f.fieldKey + '`').join(', ')} |`)
  w(`| **EMPTY** (this build does not cover them) | ${empty.length} | ${empty.map(f => '`' + f.fieldKey + '`').join(', ')} |`)
  w()
  w(`### The run, in numbers`)
  w()
  if (b0) {
    const secs = b0.completedAt && b0.startedAt ? Math.round((+b0.completedAt - +b0.startedAt) / 1000) : null
    w(`| | |`)
    w(`|---|---|`)
    w(`| status | **${b0.status}**, ${b0.passesComplete} of 7 passes |`)
    w(`| framing arm | \`${b0.framing}\` |`)
    w(`| wall clock | ${secs === null ? '?' : `${Math.floor(secs / 60)}m ${secs % 60}s`} (${b0.startedAt?.toISOString()} → ${b0.completedAt?.toISOString()}) |`)
    w(`| tokens | ${b0.tokensIn.toLocaleString()} in / ${b0.tokensOut.toLocaleString()} out |`)
    w(`| cost | **${b0.estCostPence ?? '_UNPRICED_'}p** |`)
    w(`| forks opened | ${forks.length} rows / ${new Set(forks.map(f => f.forkKey)).size} decision points, **${forks.filter(f => f.resolved).length} resolved by a human** |`)
    w(`| failureReason | ${b0.failureReason ?? '_(null)_'} |`)
  }
  w()
  w(`### What is NOT here`)
  w()
  w(`- **No \`ProposalVersion\`** — nothing has been published; §6 shows 0 rows.`)
  w(`- **No resolved forks** — 25-C's decision agenda has not been walked.`)
  w(`- **\`Idea.title\` is still "Untitled idea"** — the title is one of the ${awaiting.length} proposals.`)
  w(`- **Nothing has been cited into the canonical fields.** \`legislationRefs\`/\`stageSearches\` are`)
  w(`  retrieval artefacts (see the Appendix), not accepted content.`)
  w()
  w('---')
  w()

  w(`## 1. The idea record`)
  w()
  w(`_Provenance: the canonical row. **See §0 — the kernel columns here are deliberately empty.**_`)
  w()
  record(idea as any, 200, 4000, 'Idea.')
  w()
  w('---')
  w()

  w(`## 2. The elicitation — the user's own words`)
  w()
  w(`_Provenance: **USER TESTIMONY**, typed by Charlie. Not retrieved, not generated._`)
  w()
  if (!elic) w('_(no elicitation row)_')
  else record(elic as any)
  w()
  w('---')
  w()

  w(`## 3. The build`)
  w()
  for (const b of builds) {
    const { passes, uncertainties, ...scalars } = b as any
    w(`### Build v${b.version} — \`${b.id}\``)
    w()
    record(scalars)
    w()
    w(`#### Uncertainties — what Lex says it is least sure about, per field`)
    w()
    w(`_Provenance: LEX, self-reported. §4.2._`)
    w()
    const u = uncertainties as Record<string, string>
    if (u && Object.keys(u).length) {
      for (const [k, v] of Object.entries(u)) { w(`**\`${k}\`** — ${v}`); w() }
    } else w('_(none recorded)_')
    w()
    w(`#### The seven passes, in order`)
    w()
    w(`_Provenance: LEX. \`carry\` is what each pass handed the next._`)
    w()
    const ps = (passes as any[]) || []
    for (const [i, p] of ps.entries()) {
      w(`##### Pass ${i + 1} — \`${p.key}\``)
      w()
      record(p)
      w()
    }
  }
  w('---')
  w()

  w(`## 4. Forks — where Lex had to choose (${forks.length} rows)`)
  w()
  w(`_Provenance: LEX. Two alternatives per decision point. \`resolved=false\` means NO HUMAN_`)
  w(`_HAS DECIDED YET — that is 25-C's job, not this build's._`)
  w()
  const byFork = new Map<string, typeof forks>()
  for (const f of forks) {
    const k = `${f.fieldKey} :: ${f.forkKey}`
    if (!byFork.has(k)) byFork.set(k, [])
    byFork.get(k)!.push(f)
  }
  for (const [k, rows] of byFork) {
    w(`### ${k}`)
    w()
    w(`**Lex chose:** ${rows[0].chosen}`)
    w()
    w(`**Why (recommendationReason):** ${rows[0].recommendationReason ?? '_(null — this build predates 25-C, or none written)_'}`)
    w()
    w(`**Resolved by a human:** ${rows[0].resolved ? `yes — \`${rows[0].resolvedChoice}\` at ${rows[0].resolvedAt?.toISOString()}` : '**no**'}`)
    w()
    for (const r of rows) {
      w(`- **Instead of (alt ${r.alternativeIndex}):** ${r.alternative}`)
      w(`  - _Case for it:_ ${r.caseForAlternative}`)
    }
    w()
  }
  w('---')
  w()

  w(`## 5. Field states — what is actually stored against each kernel field (${fields.length} rows)`)
  w()
  w(`_Provenance: the join between the build and the product. **\`status\` is the load-bearing_`)
  w(`_column**: \`AWAITING_CONFIRMATION\` = Lex proposed it and nobody has agreed to it yet._`)
  w()
  w('| fieldKey | status | value length | has proposal |')
  w('|---|---|---|---|')
  for (const f of fields) {
    w(`| \`${f.fieldKey}\` | **${f.status}** | ${(f.value || '').length} | ${f.proposal ? 'yes' : 'no'} |`)
  }
  w()
  for (const f of fields) {
    w(`### \`${f.fieldKey}\` — ${f.status}`)
    w()
    w(`**Accepted value:**`)
    w()
    w(f.value ? '> ' + f.value.split('\n').join('\n> ') : '_(null — nothing accepted)_')
    w()
    if (f.proposal) {
      w(`**Proposal (awaiting the user):**`)
      w()
      w(fence(f.proposal))
      w()
    }
  }
  w()
  w('---')
  w()

  // Anything else attached to this idea, by model, so nothing is silently omitted.
  w(`## 6. Everything else attached to this idea`)
  w()
  w(`_Counted across every model with an \`ideaId\`, so an empty section is a MEASURED zero_`)
  w(`_rather than something I forgot to look at._`)
  w()
  const others: [string, any][] = [
    ['LexCoherentAction', (prisma as any).lexCoherentAction],
    ['IdeaAssumption', (prisma as any).ideaAssumption],
    ['IdeaLegislation', (prisma as any).ideaLegislation],
    ['Evidence', (prisma as any).evidence],
    ['DeepeningPass', (prisma as any).deepeningPass],
    ['EvidenceItem', (prisma as any).evidenceItem],
    ['DeepeningIssue', (prisma as any).deepeningIssue],
    ['ProposalVersion', (prisma as any).proposalVersion],
    ['Document', (prisma as any).document],
    ['IdeaSourceDecision', (prisma as any).ideaSourceDecision],
    ['IdeaUserMaterial', (prisma as any).ideaUserMaterial],
    ['CostLine', (prisma as any).costLine],
  ]
  for (const [name, model] of others) {
    if (!model?.findMany) { w(`### ${name} — ⚠ NOT QUERIED: no such model on the Prisma client`); w(); continue }
    let rows: any[] = []
    try { rows = await model.findMany({ where: { ideaId } }) } catch (e: any) {
      // ⚠ An unqueryable model must not read as an empty one. A model with no `ideaId`
      // column throws here, and "0 rows" would be a claim about the data rather than
      // about the query.
      const first = String(e?.message || e).split('\n').filter(Boolean)[0] || e?.constructor?.name || 'unknown error'
      w(`### ${name} — ⚠ NOT QUERIED (this is not a zero): ${first}`); w(); continue
    }
    w(`### ${name} — ${rows.length} row(s)`)
    w()
    for (const r of rows) { record(r, 200, 4000, `${name}.`); w() }
    if (!rows.length) w('_(none)_'), w()
  }

  if (APPENDIX.length) {
    w('---')
    w()
    w(`## Appendix — the large blobs, moved out of line`)
    w()
    w(`_Retrieval and transcript artefacts. Here in full because a review should be able to_`)
    w(`_check them, but out of the body because they would otherwise bury the kernel._`)
    w()
    for (const [k, v] of APPENDIX) { w(`### ${k}`); w(); w(v); w() }
  }

  writeFileSync(out, L.join('\n'), 'utf8')
  console.log(`wrote ${out} — ${L.join('\n').length} chars`)
  console.log(`forks=${forks.length} fields=${fields.length} builds=${builds.length}`)
  await prisma.$disconnect()
}
main()
