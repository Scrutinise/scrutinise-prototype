/**
 * v36-bodymiss-triage.ts — split the catch-up's 227 body misses into the benign kind
 * and the kind that means a section we recorded is not actually in R2.
 *
 * `v33-vec-catchup.ts` counts a miss for two very different reasons:
 *
 *   !m?.r2Key   the section has no R2 key at all — an `unavailable` marker, which is a
 *               recorded FACT about an instrument and correctly has no body. Benign.
 *   !raw        the key exists and `r2Get` returned nothing — we wrote a row claiming
 *               text that is not there. NOT benign: that section is unreachable and
 *               nothing downstream would ever say so.
 *
 * One counter covers both, so the number alone cannot tell you whether the run is
 * fine. This separates them, and spot-checks the second class against R2 rather than
 * inferring it from the arithmetic.
 *
 * Usage: tsx v36-bodymiss-triage.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const WORKLIST = path.join(__dirname, 'v36-vec-delta.jsonl')

async function main() {
  const ids: string[] = []
  for (const line of fs.readFileSync(WORKLIST, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { ids.push(JSON.parse(line).id) } catch { /* skip */ }
  }
  console.log(`work list: ${ids.length.toLocaleString()} sections`)

  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT id, "r2Key", format, availability_status
       FROM corpus_sections WHERE id = ANY($1::text[])`, [ids])

  const noKey = rows.filter((r: any) => !r.r2Key)
  const withKey = rows.filter((r: any) => r.r2Key)
  console.log(`\nresolved ${rows.length.toLocaleString()} of ${ids.length.toLocaleString()}`)
  console.log(`  no r2Key at all : ${noKey.length.toLocaleString()}   (benign — nothing to embed)`)
  console.log(`  has an r2Key    : ${withKey.length.toLocaleString()}`)

  const byFormat: Record<string, number> = {}
  for (const r of noKey) byFormat[r.format ?? 'null'] = (byFormat[r.format ?? 'null'] ?? 0) + 1
  console.log(`\n  the no-key rows by format:`)
  for (const [f, n] of Object.entries(byFormat).sort((a, b) => b[1] - a[1])) console.log(`    ${f.padEnd(16)} ${n}`)

  // The class that matters: key present, object absent. Sampled against R2 rather
  // than deduced, because "227 minus the no-key count" is arithmetic, not evidence.
  const SAMPLE = Math.min(300, withKey.length)
  const step = Math.max(1, Math.floor(withKey.length / SAMPLE))
  const sample = withKey.filter((_: any, i: number) => i % step === 0).slice(0, SAMPLE)
  let absent = 0
  const absentIds: string[] = []
  for (const r of sample) {
    const raw = await r2Get(r.r2Key).catch(() => null)
    if (!raw) { absent++; absentIds.push(`${r.id} → ${r.r2Key}`) }
  }
  console.log(`\nR2 spot-check of ${sample.length} keyed sections: ${absent} absent`)
  if (absent) {
    console.log(`  ⚠ KEY PRESENT BUT OBJECT MISSING — these sections are unreachable:`)
    for (const a of absentIds.slice(0, 15)) console.log(`    ${a}`)
    console.log(`  extrapolated across ${withKey.length.toLocaleString()} keyed rows: ~${Math.round((absent / sample.length) * withKey.length).toLocaleString()}`)
  } else {
    console.log(`  ✅ every sampled key resolved — the misses are the no-key class, not lost objects`)
  }

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
