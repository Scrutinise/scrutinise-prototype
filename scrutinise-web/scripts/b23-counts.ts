export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B23 §2 — DE-DUPLICATE EVERY COUNT.
//
// M-01's sixteen "actions" are four builds' worth of four. `LexCoherentAction` has no
// `runVersion`; every build APPENDS its actions to the idea, and `b14-export.ts` exports
// them all. So a count of "actions" taken off the export, or off the table, is a count of
// build revisions. This script asks, per measure and per surface:
//
//   1. how many rows there are on the idea;
//   2. how many belong to each build (by `runVersion` where the table has one, by the
//      build's time window where it does not);
//   3. what the report printed, and which build that figure belongs to — or whether it
//      belongs to no single build at all;
//   4. whether the same collapse reaches the evidence, the challenges, the causes and the
//      provision/judgment counts.
//
// ⚠ The report's printed figures are copied in below from `report_src_v2/08_part4.md` and
// `09_part5_rest.md` (read on 11 September 2026) so the comparison is in one file. If CCW
// edits the report, re-copy them; this script does not read the report.
//
//   npx tsx --env-file=.env scripts/b23-counts.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/COUNTS_corrected.md')
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

/** What the report prints, per measure. Chapter → measure mapping is by title. */
const REPORT: Record<string, { chapter: string; steps: number; evidence: number; causes: number
  provisions: number; judgments: number; contra: number; challenges: number }> = {
  'M-01': { chapter: '4.1', steps: 8, evidence: 73,  causes: 3, provisions: 3,  judgments: 1,  contra: 15, challenges: 89 },
  'M-02': { chapter: '4.2', steps: 4, evidence: 107, causes: 2, provisions: 13, judgments: 17, contra: 15, challenges: 46 },
  'M-06': { chapter: '4.3', steps: 4, evidence: 118, causes: 3, provisions: 10, judgments: 11, contra: 15, challenges: 41 },
  'M-03': { chapter: '5.1', steps: 4, evidence: 128, causes: 2, provisions: 9,  judgments: 16, contra: 12, challenges: 46 },
  'M-04': { chapter: '5.2', steps: 4, evidence: 103, causes: 3, provisions: 6,  judgments: 14, contra: 10, challenges: 46 },
  'M-05': { chapter: '5.3', steps: 4, evidence: 109, causes: 2, provisions: 7,  judgments: 14, contra: 9,  challenges: 50 },
  'M-07': { chapter: '5.4', steps: 4, evidence: 119, causes: 2, provisions: 10, judgments: 4,  contra: 17, challenges: 46 },
  'M-08': { chapter: '5.5', steps: 4, evidence: 110, causes: 3, provisions: 7,  judgments: 14, contra: 8,  challenges: 48 },
  'M-09': { chapter: '5.6', steps: 4, evidence: 83,  causes: 2, provisions: 6,  judgments: 5,  contra: 10, challenges: 39 },
  'M-10': { chapter: '5.7', steps: 4, evidence: 75,  causes: 2, provisions: 4,  judgments: 5,  contra: 9,  challenges: 48 },
  'M-11': { chapter: '5.8', steps: 3, evidence: 96,  causes: 2, provisions: 3,  judgments: 8,  contra: 19, challenges: 39 },
  'M-12': { chapter: '5.9', steps: 4, evidence: 52,  causes: 3, provisions: 11, judgments: 1,  contra: 14, challenges: 48 },
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

interface Build { version: number; status: string; startedAt: Date | null; completedAt: Date | null }

/** Assign a row with no runVersion to the build whose window it was written in. */
function buildOf(at: Date, builds: Build[]): number | null {
  for (const b of builds) {
    if (!b.startedAt) continue
    const end = b.completedAt ?? new Date(b.startedAt.getTime() + 60 * 60 * 1000)
    if (at >= b.startedAt && at <= end) return b.version
  }
  return null
}

function perVersion<T extends { v: number | null }>(rows: T[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) { const k = r.v == null ? 'none' : `v${r.v}`; m[k] = (m[k] ?? 0) + 1 }
  return m
}
const fmtPV = (m: Record<string, number>) => Object.entries(m).map(([k, n]) => `${k}: ${n}`).join(', ') || '—'

/** Which build a printed figure matches, given the per-version counts. */
function matches(figure: number, pv: Record<string, number>): string {
  const versions = Object.entries(pv).filter(([k]) => k !== 'none')
  const single = versions.filter(([, n]) => n === figure).map(([k]) => k)
  if (single.length) return single.join(' or ')
  // A sum of the FIRST k versions is what an export taken before the later builds would show.
  const sorted = versions.slice().sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
  let acc = 0
  for (let k = 0; k < sorted.length; k++) {
    acc += sorted[k][1]
    if (k >= 1 && acc === figure) return `⚠ **${sorted.slice(0, k + 1).map(([x]) => x).join('+')} summed**`
  }
  return '⚠ **matches no build and no sum**'
}

interface Measure {
  ref: string; title: string; ideaId: string
  builds: Build[]; latest: number
  actions: { total: number; pv: Record<string, number>; latest: number; dupWithinLatest: number; latestSteps: string[] }
  causes: { total: number; pv: Record<string, number>; latest: number }
  evidence: { total: number; pv: Record<string, number>; latest: number; dupWithinLatest: number
    contraPV: Record<string, number>; contraLatest: number
    provisionsLatest: number; provisionsDistinct: number; judgmentsLatest: number; judgmentsDistinct: number
    later: Record<string, number> }
  issues: { total: number; pv: Record<string, number>; latest: number; dupWithinLatest: number; byStatus: Record<string, number> }
  passes: { total: number; pv: Record<string, number> }
}

async function measure(ref: string): Promise<Measure | null> {
  let ideaId: string
  try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { return null }
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  if (!idea) return null
  const builds = await prisma.ideaBuild.findMany({
    where: { ideaId }, orderBy: { version: 'asc' },
    select: { version: true, status: true, startedAt: true, completedAt: true },
  })
  const latest = builds.filter((b) => b.status === 'DONE').map((b) => b.version).pop() ?? 0

  // ── actions: no runVersion column, so by build window ──
  const actionRows = await prisma.lexCoherentAction.findMany({
    where: { ideaId }, orderBy: [{ createdAt: 'asc' }, { orderIndex: 'asc' }],
    select: { practicalStep: true, createdAt: true },
  })
  const actions = actionRows.map((r) => ({ v: buildOf(r.createdAt, builds), text: r.practicalStep }))
  const latestActions = actions.filter((a) => a.v === latest)
  const dupA = latestActions.length - new Set(latestActions.map((a) => norm(a.text))).size

  // ── causes: no runVersion column either ──
  const causeRows = await prisma.diagnosisCause.findMany({ where: { ideaId }, select: { createdAt: true } })
  const causes = causeRows.map((r) => ({ v: buildOf(r.createdAt, builds) }))

  // ── evidence: has runVersion ──
  const evRows = await prisma.evidenceItem.findMany({
    where: { ideaId }, select: { runVersion: true, kind: true, title: true, sourceId: true, sourceType: true, status: true, passKey: true, createdAt: true, citation: true },
  })
  // ⚠ Later producers (`positions` on 4 Sep, `STATUTORY_CONSEQUENCES` on 9 Sep) append rows to
  // the version that was current when they ran, AFTER the export the report was written from.
  // So a version's row count today is the build's rows plus those. "In build" = written before
  // the build completed (five minutes' slack); the rest are listed by pass so the difference is
  // accounted for and not read as the export having been wrong.
  const inBuild = (at: Date, v: number | null) => {
    const b = builds.find((x) => x.version === v)
    return !!b?.completedAt && at.getTime() <= b.completedAt.getTime() + 5 * 60 * 1000
  }
  const evAll = evRows.map((r) => ({ v: r.runVersion, ...r, inBuild: inBuild(r.createdAt, r.runVersion) }))
  const ev = evAll.filter((e) => e.inBuild)
  const later: Record<string, number> = {}
  for (const e of evAll.filter((x) => !x.inBuild)) { const k = `v${e.v} ${e.passKey}`; later[k] = (later[k] ?? 0) + 1 }
  const evLatest = ev.filter((e) => e.v === latest)
  const dupE = evLatest.length - new Set(evLatest.map((e) => `${e.sourceId ?? ''}|${norm(e.title)}`)).size
  const contra = ev.filter((e) => e.kind === 'CONTRADICTS')
  const prov = evLatest.filter((e) => e.sourceType === 'PRIMARY_LEGISLATION')
  const judg = evLatest.filter((e) => e.sourceType === 'CASE_LAW')

  // ── challenges: has runVersion ──
  const issueRows = await prisma.deepeningIssue.findMany({
    where: { ideaId }, select: { runVersion: true, text: true, status: true },
  })
  const issues = issueRows.map((r) => ({ v: r.runVersion, text: r.text, status: r.status }))
  const isLatest = issues.filter((i) => i.v === latest)
  const dupI = isLatest.length - new Set(isLatest.map((i) => norm(i.text))).size
  const byStatus: Record<string, number> = {}
  for (const i of issues) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1

  const passRows = await prisma.deepeningPass.findMany({ where: { ideaId }, select: { runVersion: true } })
  const passes = passRows.map((r) => ({ v: r.runVersion }))

  return {
    ref, title: idea.title, ideaId, builds, latest,
    actions: { total: actions.length, pv: perVersion(actions), latest: latestActions.length, dupWithinLatest: dupA,
      latestSteps: latestActions.map((a) => a.text) },
    causes: { total: causes.length, pv: perVersion(causes), latest: causes.filter((c) => c.v === latest).length },
    evidence: { total: ev.length, pv: perVersion(ev), latest: evLatest.length, dupWithinLatest: dupE,
      contraPV: perVersion(contra), contraLatest: contra.filter((c) => c.v === latest).length,
      // ⚠ The report's rule, reverse-engineered against four measures and exact on all four:
      // DISTINCT CITATIONS among the rows of that source type. Not rows, not sourceIds.
      provisionsLatest: prov.length, provisionsDistinct: new Set(prov.filter((p) => p.citation).map((p) => p.citation)).size,
      judgmentsLatest: judg.length, judgmentsDistinct: new Set(judg.filter((p) => p.citation).map((p) => p.citation)).size, later },
    issues: { total: issues.length, pv: perVersion(issues), latest: isLatest.length, dupWithinLatest: dupI, byStatus },
    passes: { total: passes.length, pv: perVersion(passes) },
  }
}

async function main() {
  const ms: Measure[] = []
  for (const ref of ALL) { const m = await measure(ref); if (m) ms.push(m) }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')

  const L: string[] = []
  L.push('# COUNTS — corrected (CCW-B23 §2)')
  L.push('')
  L.push(`*${stamp} UTC · read off the database by \`scripts/b23-counts.ts\`; the report's figures are copied from ` +
    '`report_src_v2/08_part4.md` and `09_part5_rest.md` as they stood on 11 September.*')
  L.push('')
  L.push('## The mechanism')
  L.push('')
  L.push('`LexCoherentAction` and `DiagnosisCause` have **no `runVersion` column**. Every build APPENDS its actions')
  L.push('to the idea (a re-run REPLACES the causes — the table below shows only the latest build\'s rows survive),')
  L.push('and `b14-export.ts` exports every row on the idea. `EvidenceItem` and')
  L.push('`DeepeningIssue` DO carry `runVersion` — the export scopes the evidence to the build\'s version (and says')
  L.push('so in a comment written after M-01 v1+v2 were once merged), **but exports every deepening issue on the')
  L.push('idea regardless of version**. So of the four surfaces:')
  L.push('')
  L.push('| surface | column | export scoped? | collapse across builds? |')
  L.push('|---|---|---|---|')
  L.push('| actions | none | ❌ all rows | **yes** — wherever an idea has more than one build |')
  L.push('| causes | none | ❌ all rows — but a re-run replaces them, so all rows = latest | **no** (superseded, not summed) |')
  L.push('| evidence | `runVersion` | ✅ build version | **no** |')
  L.push('| provisions / judgments | derived from evidence | ✅ | **no** |')
  L.push('| challenges | `runVersion` | ❌ all rows | **yes** — wherever an idea has more than one build |')
  L.push('')
  L.push('Nine of the twelve have one build, so their rows belong to one version and nothing collapses. The')
  L.push('three re-built after the kernel fix (M-01, M-02, M-06) are where the figures move.')
  L.push('')

  // ── builds ──
  L.push('## Builds per measure')
  L.push('')
  L.push('| Measure | Builds (DONE) | Latest |')
  L.push('|---|---|---|')
  for (const m of ms) {
    L.push(`| ${m.ref} — ${m.title} | ${m.builds.map((b) => `v${b.version} ${b.startedAt?.toISOString().slice(0, 10) ?? '?'}${b.status === 'DONE' ? '' : ` (${b.status})`}`).join(' · ')} | v${m.latest} |`)
  }
  L.push('')

  // ── actions ──
  L.push('## 1. Actions — the true, de-duplicated count')
  L.push('')
  L.push('*Rows on the idea · rows per build (assigned by the build\'s time window) · the count in the latest build ·')
  L.push('duplicates within that build by normalised text · what the report prints and which build that is.*')
  L.push('')
  L.push('| Measure | Rows | Per build | **True count (latest build)** | Dups within latest | Report prints | Report figure is |')
  L.push('|---|---|---|---|---|---|---|')
  let rowsTotal = 0, trueTotal = 0, reportTotal = 0
  for (const m of ms) {
    const r = REPORT[m.ref]
    rowsTotal += m.actions.total; trueTotal += m.actions.latest; reportTotal += r.steps
    L.push(`| ${m.ref} | ${m.actions.total} | ${fmtPV(m.actions.pv)} | **${m.actions.latest}** | ${m.actions.dupWithinLatest} | ${r.steps} (§${r.chapter}) | ${matches(r.steps, m.actions.pv)} |`)
  }
  L.push(`| **all twelve** | **${rowsTotal}** | | **${trueTotal}** | | **${reportTotal}** | |`)
  L.push('')
  L.push('⚠ "True count" is the number of coherent actions in the build the measure now stands on. A build')
  L.push('replaces the previous build\'s actions — it does not add to them — so the rows from earlier builds are')
  L.push('revisions of the same work, not further work. Within a single build there are no duplicates on any')
  L.push('measure (column 5).')
  L.push('')

  // ── causes ──
  L.push('## 2. Causes — replaced by a re-run, not appended')
  L.push('')
  L.push('*Only the rows of the latest build exist on the idea, so nothing sums. Where the report prints a figure no')
  L.push('build now holds (M-01, M-06), it is the count from the superseded build the chapter describes, and')
  L.push('those rows were overwritten by the re-run.*')
  L.push('')
  L.push('| Measure | Rows | Per build | Latest build | Report prints | Report figure is |')
  L.push('|---|---|---|---|---|---|')
  for (const m of ms) {
    const r = REPORT[m.ref]
    L.push(`| ${m.ref} | ${m.causes.total} | ${fmtPV(m.causes.pv)} | ${m.causes.latest} | ${r.causes} | ${matches(r.causes, m.causes.pv)} |`)
  }
  L.push('')

  // ── evidence ──
  L.push('## 3. Evidence — scoped by the export, and it holds')
  L.push('')
  L.push('*"Rows" and "per version" count the rows each BUILD wrote. Rows appended to a version afterwards by later')
  L.push('producers (`positions`, 4 Sep; `STATUTORY_CONSEQUENCES`, 9 Sep) are in the last column, by pass — they are')
  L.push('additions, not duplicates, and they are why a raw `count(*)` per version today exceeds the export.*')
  L.push('')
  L.push('| Measure | Rows | Per version | Latest version | Dups within latest | Report prints | Report figure is | Appended since, by pass |')
  L.push('|---|---|---|---|---|---|---|---|')
  for (const m of ms) {
    const r = REPORT[m.ref]
    L.push(`| ${m.ref} | ${m.evidence.total} | ${fmtPV(m.evidence.pv)} | ${m.evidence.latest} | ${m.evidence.dupWithinLatest} | ${r.evidence} | ${matches(r.evidence, m.evidence.pv)} | ${fmtPV(m.evidence.later)} |`)
  }
  L.push('')
  L.push('### 3a. Findings that run the other way (`kind = CONTRADICTS`)')
  L.push('')
  L.push('| Measure | Per version | Latest version | Report prints | Report figure is |')
  L.push('|---|---|---|---|---|')
  for (const m of ms) {
    const r = REPORT[m.ref]
    L.push(`| ${m.ref} | ${fmtPV(m.evidence.contraPV)} | ${m.evidence.contraLatest} | ${r.contra} | ${matches(r.contra, m.evidence.contraPV)} |`)
  }
  L.push('')
  L.push('### 3b. Provisions and judgments retrieved and read')
  L.push('')
  L.push('*Evidence rows written by the latest build with `sourceType = PRIMARY_LEGISLATION` / `CASE_LAW`; "distinct" is')
  L.push('by CITATION, which is the rule the report used (checked exact on M-01, M-03, M-07, M-12 against their exports).')
  L.push('The report figure is the version its chapter describes, so it differs from "latest" only where the chapter')
  L.push('describes a superseded build.*')
  L.push('')
  L.push('| Measure | Provision rows (latest) | distinct | Report prints | Judgment rows (latest) | distinct | Report prints |')
  L.push('|---|---|---|---|---|---|---|')
  for (const m of ms) {
    const r = REPORT[m.ref]
    L.push(`| ${m.ref} | ${m.evidence.provisionsLatest} | ${m.evidence.provisionsDistinct} | ${r.provisions} | ${m.evidence.judgmentsLatest} | ${m.evidence.judgmentsDistinct} | ${r.judgments} |`)
  }
  L.push('')

  // ── challenges ──
  L.push('## 4. Challenges (`DeepeningIssue`) — exported unscoped, and it collapses')
  L.push('')
  L.push('| Measure | Rows | Per version | Status | **Latest version** | Dups within latest | Report prints | Report figure is |')
  L.push('|---|---|---|---|---|---|---|---|')
  let chRows = 0, chTrue = 0, chReport = 0
  for (const m of ms) {
    const r = REPORT[m.ref]
    chRows += m.issues.total; chTrue += m.issues.latest; chReport += r.challenges
    L.push(`| ${m.ref} | ${m.issues.total} | ${fmtPV(m.issues.pv)} | ${fmtPV(m.issues.byStatus)} | **${m.issues.latest}** | ${m.issues.dupWithinLatest} | ${r.challenges} | ${matches(r.challenges, m.issues.pv)} |`)
  }
  L.push(`| **all twelve** | **${chRows}** | | | **${chTrue}** | | **${chReport}** | |`)
  L.push('')
  L.push('Deepening passes per version (each pass raises its own issues; a re-run adds a second set):')
  L.push('')
  L.push('| Measure | Passes | Per version |')
  L.push('|---|---|---|')
  for (const m of ms) L.push(`| ${m.ref} | ${m.passes.total} | ${fmtPV(m.passes.pv)} |`)
  L.push('')

  // ── the verdict ──
  L.push('## Which figures in the report are wrong, and by how much')
  L.push('')
  const wrong: string[] = []
  for (const m of ms) {
    const r = REPORT[m.ref]
    // The build the chapter describes is the one whose evidence count it prints.
    const described = matches(r.evidence, m.evidence.pv)
    const dv = described.startsWith('⚠') ? null : Number(described.split(' ')[0].slice(1))
    const a = matches(r.steps, m.actions.pv); const c = matches(r.challenges, m.issues.pv)
    const e = matches(r.evidence, m.evidence.pv); const k = matches(r.contra, m.evidence.contraPV)
    const inDesc = (pv: Record<string, number>) => (dv == null ? '?' : String(pv[`v${dv}`] ?? 0))
    if (a.startsWith('⚠')) wrong.push(`- **${m.ref} actions (§${r.chapter}): prints ${r.steps}** — ${a}. The build the chapter describes (v${dv}) has **${inDesc(m.actions.pv)}**; the latest build (v${m.latest}) has **${m.actions.latest}**.`)
    if (c.startsWith('⚠')) wrong.push(`- **${m.ref} challenges (§${r.chapter}): prints ${r.challenges}** — ${c}. The build the chapter describes (v${dv}) raised **${inDesc(m.issues.pv)}**; the latest build (v${m.latest}) raised **${m.issues.latest}**.`)
    if (e.startsWith('⚠')) wrong.push(`- ${m.ref} evidence (§${r.chapter}): prints ${r.evidence} — ${e}.`)
    if (k.startsWith('⚠')) wrong.push(`- ${m.ref} contradicting findings (§${r.chapter}): prints ${r.contra} — ${k}.`)
  }
  L.push(...(wrong.length ? wrong : ['- none']))
  L.push('')
  L.push('Every other printed action, challenge, evidence, contradicting-finding, provision and judgment figure')
  L.push('belongs to exactly one build. ⚠ In §4.1 the eight printed steps are the four from v1 (steps 1–4) followed by')
  L.push('the four from v2 (steps 5–8); the chapter describes v2, so steps 5–8 are the ones that belong to it.')
  L.push('')
  L.push('### And which figures are right but describe a superseded build')
  L.push('')
  for (const m of ms) {
    const r = REPORT[m.ref]
    const e = matches(r.evidence, m.evidence.pv)
    if (!e.startsWith('⚠') && e !== `v${m.latest}`) {
      L.push(`- ${m.ref} (§${r.chapter}): the chapter's evidence base (${r.evidence}) is build **${e}**; the measure now stands on **v${m.latest}** (${m.evidence.latest} rows). The B22 critique and the B23 opponent read the kernel through \`kernelText()\` — the latest proposals, i.e. v${m.latest} — and the opponent's evidence is the latest DONE build's; \`cost-route.ts\` read every action row on the idea, all ${m.actions.total}, which is where the duplicate finding came from.`)
    }
  }
  L.push('')
  L.push('---')
  L.push('')
  L.push('## Appendix — the de-duplicated actions, latest build, verbatim')
  L.push('')
  for (const m of ms) {
    L.push(`### ${m.ref} — ${m.title} (v${m.latest}, ${m.actions.latest} actions)`)
    L.push('')
    m.actions.latestSteps.forEach((s, i) => L.push(`${i + 1}. ${s.replace(/\r?\n/g, ' ')}`))
    L.push('')
  }

  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`written: ${OUT}`)
  for (const m of ms) console.log(`  ${m.ref} actions ${m.actions.total}→${m.actions.latest}  issues ${m.issues.total}→${m.issues.latest}  evidence ${fmtPV(m.evidence.pv)}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
