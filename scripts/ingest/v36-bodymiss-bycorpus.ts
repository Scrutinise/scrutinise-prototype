/**
 * v36-bodymiss-bycorpus.ts — did V36's OWN output write rows whose R2 object is missing?
 *
 * The triage found 2 of 300 sampled keyed sections absent from R2, and both were
 * `fca-handbook` / `scottish-parliament-or` — corpora V36 never touched. That is a
 * very different fact from V36 having written rows it cannot back, and the whole-list
 * sample cannot tell them apart because V36's legislation rows are 99.7% of the list
 * and would swamp a handful of misses from anywhere else.
 *
 * So sample WITHIN each group: V36's legislation output separately from the
 * pre-existing unvectored remainder.
 *
 * Usage: tsx v36-bodymiss-bycorpus.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const WORKLIST = path.join(__dirname, 'v36-vec-delta.jsonl')
const SEED_AT = '2026-08-12 22:57:00Z'

async function sampleGroup(label: string, rows: any[], n: number) {
  if (!rows.length) { console.log(`\n${label}: none`); return }
  const step = Math.max(1, Math.floor(rows.length / n))
  const sample = rows.filter((_, i) => i % step === 0).slice(0, n)
  let absent = 0
  const missing: string[] = []
  for (const r of sample) {
    const raw = await r2Get(r.r2Key).catch(() => null)
    if (!raw) { absent++; missing.push(`${r.id} → ${r.r2Key}`) }
  }
  const pct = (absent / sample.length) * 100
  console.log(`\n${label}`)
  console.log(`  population ${rows.length.toLocaleString()} · sampled ${sample.length} · absent ${absent} (${pct.toFixed(2)}%)`)
  if (absent) {
    for (const m of missing.slice(0, 10)) console.log(`    ⚠ ${m}`)
    console.log(`  extrapolated: ~${Math.round((absent / sample.length) * rows.length).toLocaleString()} of this group`)
  } else {
    console.log(`  ✅ every sampled object resolved`)
  }
}

async function main() {
  const ids: string[] = []
  for (const line of fs.readFileSync(WORKLIST, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { ids.push(JSON.parse(line).id) } catch { /* skip */ }
  }

  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT id, "r2Key", corpus, "createdAt" >= timestamptz '${SEED_AT}' AS from_v36
       FROM corpus_sections WHERE id = ANY($1::text[]) AND "r2Key" IS NOT NULL`, [ids])

  const v36 = rows.filter((r: any) => r.from_v36)
  const older = rows.filter((r: any) => !r.from_v36)
  console.log(`work list resolved: ${rows.length.toLocaleString()}  (V36-written ${v36.length.toLocaleString()} · pre-existing ${older.length.toLocaleString()})`)

  const byCorpus: Record<string, number> = {}
  for (const r of older) byCorpus[r.corpus] = (byCorpus[r.corpus] ?? 0) + 1
  console.log('\npre-existing unvectored rows by corpus:')
  for (const [c, n] of Object.entries(byCorpus).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${c.padEnd(28)} ${n.toLocaleString()}`)
  }

  await sampleGroup('V36-WRITTEN (the run just scored as clean)', v36, 400)
  await sampleGroup('PRE-EXISTING unvectored remainder', older, 200)

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
