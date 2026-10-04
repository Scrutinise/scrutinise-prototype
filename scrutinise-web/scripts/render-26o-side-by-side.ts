// BRIEF_26O §6b — "Quality is Charlie's judgement, not a check's. Present the two kernels side by side, UNLABELLED, for him
// to read." Reads the two arms' saved results and writes two files:
//   docs/REPORT_26O_FLASH_SIDE_BY_SIDE.md   — per idea, kernel "A" and kernel "B", NOTHING saying which model wrote which
//   docs/REPORT_26O_FLASH_KEY.md            — which was which. Read it AFTER forming a view.
// Which arm is A is decided per idea by a hash of the idea id, so it is neither always the cheaper one nor in a fixed order.
//
//   npx tsx scripts/render-26o-side-by-side.ts <dir containing b-flash-<idea>.json and b-default-<idea>.json> <ideaPrefix> ...
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const ideas = process.argv.slice(3)
const ORDER = ['title', 'challenge', 'whoAffectedImpactCost', 'rootCause', 'pivotalObstacle', 'summaryDiagnosis', 'chosenApproach', 'whatItRulesOut', 'leverage', 'conditionsForSuccess', 'summaryGuidingPolicy', 'summaryCoherentActions']
const LABEL: Record<string, string> = {
  title: 'Working title', challenge: 'The problem', whoAffectedImpactCost: 'Who is affected', rootCause: 'Root cause', pivotalObstacle: 'Pivotal obstacle',
  summaryDiagnosis: 'Summary of Diagnosis', chosenApproach: 'Guiding Policy', whatItRulesOut: 'What it rules out', leverage: 'Leverage',
  conditionsForSuccess: 'Conditions for success', summaryGuidingPolicy: 'Summary of Guiding Policy', summaryCoherentActions: 'Summary of Coherent Actions',
}
type Result = { arm: string; kernel: Record<string, string>; causes: Array<{ cause: string; classification: string; isRootCause: boolean }>; actions: Array<{ practicalStep: string; whoImplements: string | null }> }
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function render(r: Result): string {
  const out: string[] = []
  const plain = (v: string) => {
    const t = v.trim()
    if (!t.startsWith('{')) return t
    try { return Object.entries(JSON.parse(t) as Record<string, unknown>).map(([k, x]) => `${k}: ${String(x)}`).join(' · ') } catch { return t }
  }
  for (const k of ORDER) if (r.kernel[k]?.trim()) out.push(`**${LABEL[k]}.** ${plain(r.kernel[k])}`)
  if (r.causes.length) out.push('**Causes.**\n' + r.causes.map((c) => `- (${c.classification.toLowerCase()}${c.isRootCause ? ', root' : ''}) ${c.cause}`).join('\n'))
  if (r.actions.length) out.push('**Coherent actions.**\n' + r.actions.map((a) => `- ${a.practicalStep}${a.whoImplements ? ` — ${a.whoImplements}` : ''}`).join('\n'))
  return out.join('\n\n')
}

const body: string[] = ['# 26-O §6 — two kernels, side by side\n', 'For each idea below: two kernels, **A** and **B**, written from the same inputs on the same day. Nothing says which model wrote which — read them, then open `REPORT_26O_FLASH_KEY.md`.\n']
const key: string[] = ['# 26-O §6 — the key\n', 'Read **after** forming a view of `REPORT_26O_FLASH_SIDE_BY_SIDE.md`.\n']
for (const id of ideas) {
  const flash = JSON.parse(readFileSync(join(dir, `b-flash-${id}.json`), 'utf8')) as Result
  const base = JSON.parse(readFileSync(join(dir, `b-default-${id}.json`), 'utf8')) as Result
  const flashIsA = hash(id) % 2 === 0
  const [A, B] = flashIsA ? [flash, base] : [base, flash]
  body.push(`\n---\n\n## Idea ${id}\n\n### Kernel A\n\n${render(A)}\n\n### Kernel B\n\n${render(B)}\n`)
  key.push(`- **${id}** — A = ${A.arm === 'flash38' ? 'gemini-3.8-flash (every Gemini pass)' : 'the current build models'}; B = ${B.arm === 'flash38' ? 'gemini-3.8-flash (every Gemini pass)' : 'the current build models'}.`)
}
writeFileSync(join(__dirname, '../../docs/REPORT_26O_FLASH_SIDE_BY_SIDE.md'), body.join('\n'))
writeFileSync(join(__dirname, '../../docs/REPORT_26O_FLASH_KEY.md'), key.join('\n') + '\n')
console.log('written: docs/REPORT_26O_FLASH_SIDE_BY_SIDE.md, docs/REPORT_26O_FLASH_KEY.md')
