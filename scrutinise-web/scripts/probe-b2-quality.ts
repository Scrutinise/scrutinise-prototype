/**
 * probe-b2-quality.ts — read B2's output back and look at what it actually says.
 * A confirm rate of 6.1% is either a tight filter or a broken one, and only
 * reading the passages tells you which.
 */
import fs from 'node:fs'
import path from 'node:path'
const DIR = path.join(__dirname, '../../docs/report_run')

for (const ws of ['WS-01', 'WS-04', 'WS-05']) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `argument_${ws}.json`), 'utf8'))
  const o = d.objections as any[]
  console.log(`\n##################### ${ws} — ${o.length} objections #####################`)
  console.log(`  earliest ${o[0]?.date}  latest ${o[o.length - 1]?.date}`)
  const decades: Record<string, number> = {}
  for (const x of o) { const y = x.date ? `${x.date.slice(0, 3)}0s` : 'undated'; decades[y] = (decades[y] ?? 0) + 1 }
  console.log('  by decade:', Object.entries(decades).sort().map(([k, v]) => `${k} ${v}`).join(', '))
  const corp: Record<string, number> = {}
  for (const x of o) corp[x.corpus] = (corp[x.corpus] ?? 0) + 1
  console.log('  by corpus:', Object.entries(corp).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
  console.log('  rows with a speaker:', o.filter(x => x.speaker).length, '/ with a date:', o.filter(x => x.date).length,
    '/ with a house:', o.filter(x => x.house).length, '/ with a source key:', o.filter(x => x.source_key).length)
  console.log('  extracts (long passages windowed):', o.filter(x => x.quoted_paragraph_is_extract).length)

  // three passages a person can judge
  for (const pick of [0, Math.floor(o.length / 2), o.length - 1]) {
    const x = o[pick]
    if (!x) continue
    console.log(`\n  ---- [${x.retrieval_arm}] ${x.date} · ${x.speaker ?? '(no speaker)'} · ${x.house ?? '(house unknown)'}`)
    console.log(`       debate: ${x.debate_title}`)
    console.log(`       query : "${x.query}"`)
    console.log(`       move  : ${x.argument_moves[0].tag} via ${x.confirmed_by_pattern}`)
    console.log(`       words : ${x.word_count}  fragment=${x.fragment}`)
    console.log(`       "${String(x.quoted_paragraph).slice(0, 620)}"`)
  }
}
