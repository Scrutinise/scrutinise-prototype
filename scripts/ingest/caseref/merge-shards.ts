/**
 * merge-shards.ts — combine the extraction's shards into one aggregate.
 *
 * ⚠ A SHARD IS A PARTIAL COUNT AND MUST NEVER BE READ AS AN ANSWER. `extract.ts` flushes its
 * aggregate every few thousand documents and clears memory, so the SAME citation appears in several
 * shards with a different `docs` count in each. Reading one shard and reporting its number would
 * understate every citation in the corpus; summing them without merging the names and samples would
 * lose the evidence.
 *
 * This merges by citation — the identity — adding `docs`, adding per-corpus counts, unioning names
 * with their counts, and keeping the first three samples seen.
 *
 * ⚠ It refuses to write an aggregate that is SMALLER than the largest single shard. That is
 * arithmetically impossible for a correct merge, and it is the one cheap check that catches a
 * merge which silently dropped a file.
 *
 * Usage: tsx caseref/merge-shards.ts
 */
import fs from 'fs'
import path from 'path'
import { OUT } from '../c2/db'

const n = (x: number) => x.toLocaleString('en-GB')
const SHARD_DIR = path.join(OUT, 'caseref-shards')
const JSONL = path.join(OUT, 'CASEREF_citations.jsonl')

interface Agg {
  citation: string; kind: string; year: number; series: string
  docs: number; byCorpus: Record<string, number>; names: Record<string, number>
  samples: Array<{ id: string; corpus: string; sentence: string; raw: string }>
}

function main() {
  if (!fs.existsSync(SHARD_DIR)) { console.error(`no ${SHARD_DIR} — run extract.ts first`); process.exit(1) }
  const files = fs.readdirSync(SHARD_DIR).filter((f) => f.endsWith('.jsonl')).sort()
  if (!files.length) { console.error('no shards'); process.exit(1) }
  console.log(`${files.length} shard(s)\n`)

  const agg = new Map<string, Agg>()
  let biggestShard = 0
  for (const f of files) {
    const rows: Agg[] = fs.readFileSync(path.join(SHARD_DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    biggestShard = Math.max(biggestShard, rows.length)
    for (const r of rows) {
      const a = agg.get(r.citation)
      if (!a) { agg.set(r.citation, { ...r, byCorpus: { ...r.byCorpus }, names: { ...r.names }, samples: [...r.samples] }); continue }
      a.docs += r.docs
      for (const [c, k] of Object.entries(r.byCorpus)) a.byCorpus[c] = (a.byCorpus[c] ?? 0) + k
      for (const [nm, k] of Object.entries(r.names)) a.names[nm] = (a.names[nm] ?? 0) + k
      for (const s of r.samples) if (a.samples.length < 3) a.samples.push(s)
    }
    console.log(`   ${f}  ${String(rows.length).padStart(7)} citations  →  ${n(agg.size)} distinct so far`)
  }

  // ⚠ arithmetically impossible for a correct merge
  if (agg.size < biggestShard) {
    console.log(`\n⛔ ABORT — merged ${n(agg.size)} distinct citations from shards whose largest alone held ${n(biggestShard)}.`)
    console.log('   A merge cannot produce fewer distinct keys than one of its inputs. A shard was dropped.')
    process.exit(1)
  }

  fs.writeFileSync(JSONL, [...agg.values()].map((a) => JSON.stringify(a)).join('\n') + '\n')
  const pre2003 = [...agg.values()].filter((a) => a.year < 2003).length
  console.log(`\n── ${n(agg.size)} distinct citations · ${n(pre2003)} pre-2003 (${(pre2003 / agg.size * 100).toFixed(1)}%)`)
  console.log(`── citing-document total: ${n([...agg.values()].reduce((s, a) => s + a.docs, 0))}`)
  console.log(`\nwritten: docs/census/${path.basename(JSONL)}`)
}
main()
