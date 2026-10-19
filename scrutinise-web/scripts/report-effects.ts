// ─────────────────────────────────────────────────────────────────────────────
// report:effects — the numbers for BRIEF_GRAPH_6's REPORT, regenerable.
//
//   · per-type counts for five named Acts, with the source split shown for each;
//   · one worked example of an excluded / applied-by row, as the reader returns it, as the sentence
//     a screen would print, and as the tool hands it to Lex.
//
// Read-only. Calls what the product calls (`effectsFor`, the `statute_effects` tool); computes nothing
// itself, so the report cannot drift from the code. Markdown to stdout.
//
// Usage:  npm run report:effects
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { effectsFor, ALL_EDGE_TYPES, type EffectsResult } from '../lib/lex/statutory-graph'
import { describeEffects, describeEffectRow, effectsHeadline } from '../lib/lex/effects-describe'
import { execute, toolByName } from '../lib/lex/agent/tools'
import { EDGE_SOURCES } from '../lib/lex/effect-kinds'

const ACTS = [
  'ukpga/2010/15',          // Equality Act 2010
  'ukpga/1998/42',          // Human Rights Act 1998
  'ukpga/2018/12',          // Data Protection Act 2018
  'ukpga/2006/46',          // Companies Act 2006
  'ukpga/Vict/24-25/100',   // Offences against the Person Act 1861 — pre-1963, through the identity bridge
]

const ctx = () => ({ ideaId: 'report', userId: 'report', confirmed: false, turn: { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: [] as string[] } })

function table(r: EffectsResult): string[] {
  const out = [
    '| type | rows | change the words | do NOT change the words | not classified | source split |',
    '|---|--:|--:|--:|--:|---|',
  ]
  for (const c of r.perType) {
    const isEffect = ['amends', 'repeals', 'modifies'].includes(c.edgeType)
    const split = c.bySource.map((s) => `${s.source} — ${s.origin ?? 'UNRECOGNISED'} — ${s.rows}`).join('<br>') || '—'
    out.push(`| ${c.edgeType} | ${c.total} | ${isEffect ? c.byKind.textual : 'n/a'} | ${isEffect ? c.byKind['not-textual'] : 'n/a'} | ${isEffect ? c.byKind.unclassified : 'n/a'} | ${split} |`)
  }
  return out
}

;(async () => {
  console.log('## Per-type counts, five Acts, with the source split\n')
  for (const given of ACTS) {
    const r = await effectsFor(given, { edgeTypes: [...ALL_EDGE_TYPES], limitPerType: 1 })
    console.log(`### ${r.target.title ?? r.target.gid} — \`${r.target.gid}\`${r.resolution.bridge === 'bridged' ? ` (bridged: ${r.resolution.candidates.join(', ')})` : ''}\n`)
    console.log(table(r).join('\n'))
    console.log(`\n_${r.examined.rowsCounted} rows counted for this Act. ${r.freshness.caveat}_\n`)
  }

  console.log('\n## Worked example — an `excluded` row under `amends` (Human Rights Act 1998)\n')
  const hra = await effectsFor('ukpga/1998/42', { edgeTypes: ['amends'], limitPerType: 100 })
  const x = hra.rows.find((row) => /^excluded/i.test(row.subType))
  if (!x) { console.log('_no excluded row found_'); await prisma.$disconnect(); return }
  console.log('**What the reader returns for the row** (`effectsFor`):\n')
  console.log('```json\n' + JSON.stringify({
    edgeType: x.edgeType, subType: x.subType, changeKind: x.changeKind, changeRule: x.changeRule, changeReason: x.changeReason,
    otherEnd: x.otherEnd, thisEndProvision: x.thisEndProvision, scope: x.scope, source: x.source, origin: x.origin, quote: x.quote, inForce: x.inForce,
  }, null, 2) + '\n```\n')
  console.log('**The sentence a screen prints for it** (`describeEffectRow`):\n')
  console.log('> ' + describeEffectRow(x) + '\n')
  console.log('**The count line it sits under** (`describeEffects`):\n')
  console.log('> ' + describeEffects(hra).find((l) => /^\d+ amends/.test(l)) + '\n')
  console.log(`**Headline:** ${effectsHeadline(hra)}\n`)

  const tool = await execute(toolByName('statute_effects')!, ctx() as any, { act: 'ukpga/1998/42', edge_types: ['amends'], limit_per_type: 50 })
  const d: any = tool.data
  const trow = d.rows.find((row: any) => /^excluded/i.test(row.sub_type))
  console.log('**What the tool hands Lex for the same row** (`statute_effects`):\n')
  console.log('```json\n' + JSON.stringify(trow, null, 2) + '\n```\n')
  console.log(`**The tool's per_type for the Act:** \`${JSON.stringify(d.per_type[0])}\`\n`)
  console.log('**The rules the tool returns with every answer:**\n')
  for (const rule of d.rules) console.log(`- ${rule}`)

  console.log('\n## Sources the reader knows\n')
  for (const [k, v] of Object.entries(EDGE_SOURCES)) console.log(`- \`${k}\` — **${v.origin}** — ${v.what}`)
  await prisma.$disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
