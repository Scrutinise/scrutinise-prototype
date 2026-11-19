/**
 * report-s28-gold.ts — SEARCH-28 item 3: compare the four gold arms (LEX_ROUTER_BILL_VOCAB on/off, two runs each) question by question.
 *
 *   npx tsx scripts/report-s28-gold.ts
 *
 * A HIT is the gold document in the first 20 under document collapse (`arms.gateway.documentCollapse` in 1..20). The per-run totals are
 * checked against each file's own `summary.documentCollapse20`, so this script cannot quietly use a different definition from the harness.
 * Noise floor = questions whose hit/miss differs between the two OFF runs (and between the two ON runs). A flag effect is a question that
 * hits in BOTH runs of one arm and misses in BOTH runs of the other.
 */
import fs from 'node:fs'
import path from 'node:path'
const dir = path.join(__dirname, '../../docs/census')
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const RUNS = { on1: 's28-gold-on-1-19nov.json', on2: 's28-gold-on-2-19nov.json', off1: 's28-gold-off-1-19nov.json', off2: 's28-gold-off-2-19nov.json' } as const
type Key = keyof typeof RUNS

const data = Object.fromEntries(Object.entries(RUNS).map(([k, f]) => [k, load(f)])) as Record<Key, any>
const hit: Record<Key, Map<string, boolean>> = {} as any
const coll = new Map<string, string>()
for (const k of Object.keys(RUNS) as Key[]) {
  const d = data[k]
  if (d.aborted) throw new Error(`${RUNS[k]} aborted: ${d.aborted}`)
  hit[k] = new Map()
  for (const r of d.rows) {
    const rank = r.arms?.gateway?.documentCollapse
    hit[k].set(r.id, typeof rank === 'number' && rank >= 1 && rank <= 20)
    coll.set(r.id, r.collection)
  }
  const mine = [...hit[k].values()].filter(Boolean).length
  const theirs = d.summary.reduce((s: number, x: any) => s + (x.documentCollapse20 ?? 0), 0)
  if (mine !== theirs) throw new Error(`${k}: my total ${mine} != harness summary ${theirs} — definitions differ, stopping`)
  console.log(`${k.padEnd(4)} ${RUNS[k]}  ${mine}/${d.rows.length}  taken ${d.takenAt}  vector p50 ${d.vectorServeAfter?.warm_p50_ms} ms cpu/wall ${d.vectorServeAfter?.stages?.cpu_over_wall}`)
}
const ids = [...coll.keys()]
const flips = (a: Key, b: Key) => ids.filter((id) => hit[a].get(id) !== hit[b].get(id))
const offNoise = flips('off1', 'off2'), onNoise = flips('on1', 'on2')
const gained = ids.filter((id) => hit.on1.get(id) && hit.on2.get(id) && !hit.off1.get(id) && !hit.off2.get(id))
const lost = ids.filter((id) => !hit.on1.get(id) && !hit.on2.get(id) && hit.off1.get(id) && hit.off2.get(id))
console.log(`\nnoise floor: ${offNoise.length} questions flip between the two OFF runs, ${onNoise.length} between the two ON runs`)
console.log(`  OFF flips: ${offNoise.join(', ') || '-'}\n  ON flips:  ${onNoise.join(', ') || '-'}`)
console.log(`\nFLAG EFFECT (consistent across both runs of each arm): +${gained.length} gained, -${lost.length} lost, net ${gained.length - lost.length >= 0 ? '+' : ''}${gained.length - lost.length}`)
for (const id of gained) console.log(`  GAINED ${id} (${coll.get(id)})`)
for (const id of lost) console.log(`  LOST   ${id} (${coll.get(id)})`)
const mean = (a: Key, b: Key) => ([...hit[a].values()].filter(Boolean).length + [...hit[b].values()].filter(Boolean).length) / 2
console.log(`\nmeans: ON ${mean('on1', 'on2')}, OFF ${mean('off1', 'off2')}, difference ${(mean('on1', 'on2') - mean('off1', 'off2')).toFixed(1)}`)
console.log(`C5 (predicted to be lost): ON ${hit.on1.get('C5')}/${hit.on2.get('C5')}, OFF ${hit.off1.get('C5')}/${hit.off2.get('C5')}${coll.has('C5') ? '' : ' (no question with id C5 in this set — see its id in the rows)'}`)
