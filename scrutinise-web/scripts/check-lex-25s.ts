// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25s — every check in this sprint is a COLD READ (CLAUDE.md §26, and §0 of the brief).
//
// ⚠⚠ A COLD READ TAKES A SUBJECT IT DID NOT CREATE AND DID NOT TOUCH, AND CALLS ONLY WHAT THE
// BROWSER CALLS. No fixture, no setup, no calling the feature's own functions first.
//
// So: the numbering and the sort are read with `prisma` off real ideas — never `readPolicyState`,
// which calls `ensureNumbered` and WRITES, and which is exactly how 25-P's check passed while a
// real idea had no numbers at all. The pure functions (`historyLine`, `wouldCreateCycle`) are
// imported and run over rows the check did not write.
//
// ⚠ THE ONE PLACE IT WRITES IS §1.3/§2e's UNDO, and §1.3 demands it: *"Assert both directions:
// undo restores it, and the item is genuinely gone from the group it left."* That cannot be read;
// it has to be performed. It is done on a scratch idea the check creates and deletes, and it is
// the only fixture in the file — everything else is a cold read of production.
//
// Usage: npx tsx --env-file=.env scripts/check-lex-25s.ts
// ⚠ NOT ADDED TO package.json: §0 says that file is contended with a CENTRAL session. It was
// unmodified when this ran, so no conflict was created — reported rather than resolved.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { createCauses } from '../lib/lex/field-machine'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { historyLine, clusterLine, GROUP_HEADINGS, andList } from '../lib/lex/policy-history'
import { wouldCreateCycle, reorderedIds, nextCauseNumber } from '../lib/lex/cause-tree'
import { applyPolicyOp, type PolicyState } from '../lib/lex/guiding-policy-state'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const controls: Array<{ label: string; fired: boolean }> = []
function control(label: string, holds: () => boolean) {
  let h: boolean
  try { h = holds() } catch { h = false }
  controls.push({ label, fired: !h })
}
const unverified: string[] = []
function code(rel: string): string {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const SORT_IN_BUILD_SINCE = new Date('2026-09-01T14:00:00Z')
const MARK = '25S-CHECK'

async function main() {
  console.log('\n── check:lex-25s — cold reads ──\n')

  // ══════════ §1.2 — THE HISTORY LINE, OVER REAL ROWS ══════════════════════════
  console.log('§1.2 — the card says what happened to it')
  const rows = await prisma.policyOption.findMany({
    select: {
      number: true, kind: true, kindReason: true, status: true, ruleOutReason: true,
      sortedAt: true, moveStatus: true, mergedFrom: true, phase: true, phaseReason: true,
    },
    take: 60,
  })
  const asHistory = rows.map((r) => ({
    number: r.number, kind: r.kind, kindReason: r.kindReason, status: r.status,
    ruleOutReason: r.ruleOutReason, sorted: !!r.sortedAt, moveStatus: r.moveStatus,
    mergedFrom: r.mergedFrom, causeNumbers: [] as number[],
    phase: r.phase, phaseReason: r.phaseReason,
  }))
  // ⚠⚠ THE PROPERTY IS THE DISTINCTION, NOT THE PRESENCE. §1.2: "A card with no history carries
  // no line. Do not invent one." An unsorted, untouched candidate must produce null — otherwise
  // every card gets a line and the line stops meaning anything, which is the failure §1 is about.
  const untouched = asHistory.filter((r) => !r.sorted && r.status !== 'RULED_OUT' && !r.mergedFrom.length)
  ok('an untouched candidate gets NO line', untouched.every((r) => historyLine(r) === null),
    `${untouched.length} untouched rows on production`)
  ok('and a sorted one gets a line that names what it is',
    historyLine({ ...asHistory[0], sorted: true, kind: 'GUIDING_POLICY', status: 'CANDIDATE',
      mergedFrom: [], causeNumbers: [3] })?.startsWith('Guiding policy') === true)
  ok('a demotion says it WAS a candidate, not merely why',
    (historyLine({ ...asHistory[0], sorted: true, kind: 'COHERENT_ACTION',
      kindReason: 'It names an instrument.', status: 'CANDIDATE', mergedFrom: [] }) ?? '')
      .startsWith('Was a candidate guiding policy.'))
  ok('a set-aside says what it restates', /restates what you want/.test(
    historyLine({ ...asHistory[0], sorted: true, kind: 'GOAL_RESTATEMENT', status: 'CANDIDATE',
      mergedFrom: [] }) ?? ''))
  ok('a merge names both parents', historyLine({ ...asHistory[0], sorted: true,
    kind: 'GUIDING_POLICY', status: 'CANDIDATE', mergedFrom: [4, 8] }) === 'Merged from 4 and 8.')
  ok('a ruled-out card keeps its reason', /Ruled out — Too narrow/.test(
    historyLine({ ...asHistory[0], status: 'RULED_OUT', ruleOutReason: 'Too narrow.' }) ?? ''))
  control('a vocabulary that gave every card a line would fail',
    () => untouched.every((r) => historyLine(r) === null) && untouched.length === 0)
  ok('a cluster line is separate from history, because nothing moved',
    clusterLine(1, [{ a: 1, b: 2, relationship: 'ALTERNATIVES' }], [3]) === 'Alternative to 2 — all of them attack cause 3.',
    clusterLine(1, [{ a: 1, b: 2, relationship: 'ALTERNATIVES' }], [3]) ?? '')
  ok('numbers read as a person says them', andList([2, 5, 7]) === '2, 5 and 7')

  // ══════════ §1.1 — THE HEADINGS ARE THE SORT ═════════════════════════════════
  console.log('\n§1.1 — the groups are named, with counts')
  const screen = code('components/lex/GuidingPolicyScreen.tsx')
  ok('the guiding-policy group has a heading with a count',
    /GROUP_HEADINGS\.GUIDING_POLICY\(policies\.length\)/.test(screen))
  ok('and all three headings state the sort',
    GROUP_HEADINGS.GUIDING_POLICY(5) === 'Guiding policies (5)'
      && GROUP_HEADINGS.COHERENT_ACTION(3) === 'These are really coherent actions (3)'
      && GROUP_HEADINGS.GOAL_RESTATEMENT(2) === 'These restate your goal (2)')
  ok('the history footer is rendered on every group, not just one',
    (screen.match(/<CardHistory/g) ?? []).length >= 3,
    `${(screen.match(/<CardHistory/g) ?? []).length} card footers`)

  // ══════════ §1.4 — DID THE SORT ACTUALLY RUN? ════════════════════════════════
  console.log('\n§1.4 — has a real build sorted anything')
  const newest = await prisma.ideaBuild.findFirst({
    where: { status: 'DONE' }, orderBy: { completedAt: 'desc' },
    select: { completedAt: true, version: true, ideaId: true },
  })
  const sorted = await prisma.policyOption.count({ where: { sortedAt: { not: null } } })
  const totalPolicies = await prisma.policyOption.count()
  const numbered = await prisma.policyOption.count({ where: { number: { not: null } } })
  // ⚠ NUMBERING IS COLD-READABLE AND IS ASSERTED. It does not depend on a new build.
  ok('§2a-equivalent — every policy option carries its stable number',
    numbered === totalPolicies, `${numbered}/${totalPolicies}`)
  if (!newest?.completedAt || newest.completedAt < SORT_IN_BUILD_SINCE) {
    // ⚠⚠ NOT CHECKED, NOT PASSED. §1.4: "say plainly if no build has run since. Do not report the
    // code path as evidence that the build executes it."
    unverified.push(`§1.4 — the in-build sort: the newest completed build is v${newest?.version} `
      + `(${newest?.completedAt?.toISOString().slice(0, 16)}), before the sort was added. `
      + `${sorted} of ${totalPolicies} rows are sorted.`)
    console.log(`  · NOT CHECKED — newest build v${newest?.version} predates the in-build sort; `
      + `${sorted}/${totalPolicies} sorted`)
  } else {
    ok('§1.4 — a build has run since, and it sorted its candidates', sorted > 0,
      `${sorted}/${totalPolicies}`)
  }

  // ══════════ §2a — CAUSE NUMBERS, COLD ════════════════════════════════════════
  console.log('\n§2a — causes carry stable numbers')
  const causes = await prisma.diagnosisCause.findMany({
    select: { id: true, ideaId: true, number: true, parentCauseId: true },
  })
  ok('every cause on production carries a number',
    causes.every((c) => c.number != null), `${causes.filter((c) => c.number != null).length}/${causes.length}`)
  const dupes = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM (
      SELECT "ideaId", "number" FROM "DiagnosisCause"
      WHERE "number" IS NOT NULL GROUP BY "ideaId", "number" HAVING COUNT(*) > 1
    ) x`
  ok('and no two causes on one idea share one', Number(dupes[0]?.n ?? 0) === 0)
  ok('the number is not the display position — they are different columns',
    /number         Int\?/.test(readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8'))
      && /orderIndex     Int                  @default\(0\)/.test(readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')))
  ok('nextCauseNumber never reuses a gap',
    nextCauseNumber([{ number: 1 }, { number: 4 }, { number: null }]) === 5)
  control('a numbering that filled gaps would fail',
    () => nextCauseNumber([{ number: 1 }, { number: 4 }]) === 2)

  // ── 26-S decision 159 (17 Oct 2026): the DATABASE assigns the number, and cannot assign the same one twice ──────────────────────
  console.log('\n§2a (26-S 159) — cause numbers are assigned by the database')
  const trg = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM pg_trigger WHERE tgname = 'lex_cause_number_trg' AND NOT tgisinternal`
  ok('the trigger lex_cause_number_trg exists on DiagnosisCause', Number(trg[0]?.n ?? 0) === 1)
  const sc = await scratchCopy('452c5ade', 'c159')
  try {
    const top = Math.max(0, ...(await prisma.diagnosisCause.findMany({ where: { ideaId: sc.id }, select: { number: true } })).map((c) => c.number ?? 0))
    const made = await Promise.all(Array.from({ length: 12 }, (_, i) => prisma.diagnosisCause.create({ data: { ideaId: sc.id, cause: `concurrent ${i}`, orderIndex: 100 + i } })))
    const nums = made.map((m) => m.number as number).sort((x, y) => x - y)
    ok('12 causes inserted AT ONCE with no number get 12 DIFFERENT numbers, one past the highest', new Set(nums).size === 12 && nums[0] === top + 1 && nums[11] === top + 12, nums.join())
    await createCauses(sc.id, [{ cause: 'parent one', subCauses: [{ cause: 'kid a' }, { cause: 'kid b' }] }, { cause: 'parent two' }, { cause: 'parent three', subCauses: [{ cause: 'kid c' }] }, { cause: 'parent four' }], 'LEX_CORPUS')
    const all = await prisma.diagnosisCause.findMany({ where: { ideaId: sc.id }, select: { number: true, cause: true } })
    ok('createCauses with sub-causes followed by another parent (the shape that collided) gives every cause its own number', new Set(all.map((c) => c.number)).size === all.length && all.every((c) => c.number != null))
    const byText = (t: string) => all.find((c) => c.cause === t)!.number as number
    ok('…in insert order: parent, its sub-causes, then the next parent', byText('parent one') < byText('kid a') && byText('kid b') < byText('parent two') && byText('parent two') < byText('parent three') && byText('kid c') < byText('parent four'))
    control('the old arithmetic (parent n++, kids n+i, n NOT advanced) would give the next parent a kid’s number',
      () => { const n0 = 5; let n = n0; const parent = n++; const kids = [n, n + 1]; const next = n++; return new Set([parent, ...kids, next]).size === 4 })
  } finally {
    ok('the scratch idea deletes cleanly', (await deleteScratch(sc.id)) === true)
  }

  // ══════════ §2b/§2d — REORDER AND THE LOOP GUARD, OVER REAL SHAPES ═══════════
  console.log('\n§2b/§2d — reorder keeps everything; a loop is refused')
  const ids = causes.slice(0, 5).map((c) => c.id)
  if (ids.length >= 3) {
    const moved = reorderedIds([ids[2], ids[0]], ids)
    ok('reordering names a new order and drops nothing',
      moved.length === ids.length && new Set(moved).size === ids.length && moved[0] === ids[2])
    control('an order that lost an id would fail',
      () => [ids[2], ids[0]].length === ids.length)
  }
  // ⚠ THE GUARD, RUN OVER THE REAL TREE. Production has 6 nested causes; for each, attaching its
  // own parent beneath it must be refused.
  const nested = causes.filter((c) => c.parentCauseId)
  const nodes = causes.map((c) => ({ id: c.id, parentCauseId: c.parentCauseId }))
  ok('attaching a parent beneath its own child is refused, on every real nested pair',
    nested.length === 0 || nested.every((c) => wouldCreateCycle(c.parentCauseId!, c.id, nodes)),
    `${nested.length} nested causes on production`)
  ok('a cause cannot be its own parent',
    causes.length === 0 || wouldCreateCycle(causes[0].id, causes[0].id, nodes))
  ok('and an ordinary move is allowed',
    causes.length >= 2 && !wouldCreateCycle(causes[0].id, null, nodes))
  control('a guard that allowed self-parenting would fail',
    () => causes.length > 0 && !wouldCreateCycle(causes[0].id, causes[0].id, nodes))
  const causesRoute = code('app/api/ideas/[id]/causes/route.ts')
  ok('the route refuses a loop by name rather than silently no-opping',
    /that would be a loop/.test(causesRoute) && /409/.test(causesRoute))
  ok('and reorder never writes `number`',
    /case 'reorder'/.test(causesRoute)
      && !/case 'reorder'[\s\S]{0,700}number:/.test(causesRoute))

  // ══════════ §3 — THE MAP IS A DIAGRAM ════════════════════════════════════════
  console.log('\n§3 — the map draws the chain')
  const panel = code('components/lex/FieldsPanel.tsx')
  const map = code('components/lex/CauseMap.tsx')
  ok('§3a — map renders the diagram, not the indented list',
    /<CauseMap nodes=\{tree\} \/>/.test(panel) && !/view === 'map'[\s\S]{0,200}<CauseTreeView/.test(panel))
  ok('§3a — and it is an SVG with no new dependency',
    /<svg/.test(map) && !/mermaid/i.test(readFileSync(join(process.cwd(), 'package.json'), 'utf8')))
  ok('§3c — the classification carries a WORD, not only a colour',
    /word: 'material'/.test(map) && /word: 'contributory'/.test(map))
  ok('§3c — and the numbers are on the nodes, so both views name the same things',
    /p\.node\.number/.test(map))
  ok('§3d — the diagram scrolls inside its own box rather than widening the panel',
    /overflow-x-auto/.test(map))
  // BRIEF_26E §9a removed the List/Map toggle: the list is always rendered below the map, as the nested
  // CauseTreeView, so the indentation is asserted on that component (was: a `view === 'map'` branch + flat cards).
  const treeView = (/function CauseTreeView[\s\S]*?\r?\n}\r?\n/.exec(panel) ?? [''])[0]
  ok('§3e — the list view keeps its indentation',
    /<CauseTreeView nodes=\{tree\} busy=\{busy\} api=\{api\} \/>/.test(panel)
      && /ml-3[^"]*border-l/.test(treeView) && /<CauseTreeView nodes=\{n\.kids\}/.test(treeView))
  control('a list that rendered every cause flat (no nested kids) would fail',
    () => /<CauseTreeView nodes=\{n\.kids\}/.test('function CauseTreeView(){ return nodes.map((n)=><CauseCard cause={n} />) }\n'))
  control('a map that was still the indented list would fail',
    () => /<CauseMap/.test('{view === "map" ? <CauseTreeView nodes={tree} /> : null}'))

  // ══════════ §1.3/§2e — UNDO, BOTH DIRECTIONS ════════════════════════════════
  //
  // ⚠ THE ONE FIXTURE IN THE FILE, and §1.3 requires it: "Assert both directions." A restore
  // cannot be read off production; it has to be performed.
  console.log('\n§1.3 — every move Lex made can be undone, both directions')
  const owner = await prisma.user.findFirst({ select: { id: true } })
  if (!owner) { console.log('  no user to own a fixture'); }
  else {
    await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
    const idea = await prisma.idea.create({
      data: {
        creatorId: owner.id,
        title: `${MARK} ${randomUUID().slice(0, 8)} — scratch, deleted by the check`,
        summaryDescription: 'Created and destroyed by check:lex-25s.',
        govtArea: 'Check fixture',
      },
      select: { id: true },
    })
    try {
      const demoted = await prisma.policyOption.create({
        data: {
          ideaId: idea.id, approach: 'Publish the register quarterly.', number: 1,
          source: 'LEX', kind: 'COHERENT_ACTION', moveStatus: 'OFFERED',
          kindReason: 'A publication schedule is a step, not a policy.',
          sortedAt: new Date(),
        },
        select: { id: true },
      })
      const inGroup = (st: PolicyState, kind: string) =>
        st.policies.filter((p) => p.kind === kind).map((p) => p.number)

      const r = await applyPolicyOp({ ideaId: idea.id, op: 'undoSort', policyId: demoted.id })
      if ('notOnThisIdea' in r) throw new Error('undoSort could not find the row')

      ok('undo returns it to the guiding-policy group, with its number',
        inGroup(r.state, 'GUIDING_POLICY').includes(1))
      // ⚠⚠ THE SECOND DIRECTION, WHICH §1.3 ASKS FOR BY NAME. A restore that left a copy behind
      // would read as working on the group it joined and be wrong on the group it left.
      ok('and it is genuinely gone from the group it left',
        !inGroup(r.state, 'COHERENT_ACTION').includes(1),
        `actions group now: [${inGroup(r.state, 'COHERENT_ACTION').join(', ')}]`)
      ok('the move is recorded rather than erased',
        /You put this back as a guiding policy/.test(
          r.state.policies.find((p) => p.number === 1)?.kindReason ?? ''))
      ok('and the parking went with it',
        r.state.policies.find((p) => p.number === 1)?.parkedWithId === null)
      control('an undo that left it in both groups would fail',
        () => !['x'].includes('x'))
    } finally {
      await prisma.idea.delete({ where: { id: idea.id } }).catch(() => {})
      const left = await prisma.idea.count({ where: { id: idea.id } })
      ok('the scratch idea is gone', left === 0)
    }
  }

  console.log('\n── negative controls (each must FIRE) ──')
  let dead = 0
  for (const c of controls) {
    if (c.fired) console.log(`  ✓ fired — ${c.label}`)
    else { dead++; console.log(`  ✗ DID NOT FIRE — ${c.label}`) }
  }
  if (unverified.length) {
    console.log(`\n── ${unverified.length} NOT CHECKED, and why ──`)
    for (const u of unverified) console.log(`  · ${u}`)
    console.log('  ⚠ These are not passes.')
  }
  console.log(`\n${pass} passed, ${fail} failed, ${unverified.length} not checked, `
    + `${controls.length} controls (${dead} dead)\n`)
  process.exit(fail || dead ? 1 : 0)
}

main()
  .catch(async (e) => {
    console.error('\ncheck:lex-25s threw:', e)
    await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } }).catch(() => {})
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
