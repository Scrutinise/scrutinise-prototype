/**
 * argument-retrievability.ts — ARGUMENT 1A. THE CONTROL THAT DECIDES WHAT 0-OF-20 MEANS.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Propagation from the verified seeds retrieved **0 of the 20 hand-tagged random control passages**.
 * That number has two completely different readings and they must not be confused:
 *
 *   A. **The method does not generalise.** The passages are in the index, retrievable, and
 *      seed-neighbourhood retrieval simply never reaches them. A real and serious result.
 *   B. **The passages are not in the dense index at all.** Then 0 of 20 measures the index's
 *      coverage and says nothing whatever about propagation, and reporting it as recall would be
 *      the sprint's worst mistake.
 *
 * ⚠ THE PROBE THAT SEPARATES THEM IS THE ONE S16 USED ON THE COMMITTEES KEYS: **ask the index for
 * the passage using the passage's own words.** If a document cannot be found by its own text, no
 * amount of seed-neighbourhood search will ever reach it, and the recall figure is void.
 *
 * Prints, per passage: whether it came back, at what rank, out of how many.
 *
 * Usage:  VECTOR_SEARCH_URL=… npm run argument:retrievability
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { CONTROL_LABELS } from './argument/controls'
import { PARLIAMENTARY_CORPORA } from './argument/taxonomy'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const OUT = path.join(__dirname, '../../docs/census/argument-1a-retrievability.json')
const K = 60

async function main() {
  if (!V) { console.error('VECTOR_SEARCH_URL required'); process.exit(2) }
  const tagged = CONTROL_LABELS.filter((c) => c.tags.length > 0)
  console.log('── ARGUMENT 1A · ARE THE HELD-OUT PASSAGES RETRIEVABLE AT ALL? ──')
  console.log(`  ${tagged.length} hand-tagged random control passages, each asked for BY ITS OWN TEXT, top-${K}\n`)

  const ids = tagged.map((c) => c.chunkId.replace(/#\d+$/, ''))
  const meta = new Map((await prisma.$queryRaw<any[]>`
    SELECT id, corpus, "r2Key", "wordCount" AS w FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`)
    .map((m) => [m.id, m]))

  const rows: any[] = []
  let found = 0, atOne = 0, noBody = 0
  for (const c of tagged) {
    const sid = c.chunkId.replace(/#\d+$/, '')
    const m = meta.get(sid)
    const body = m?.r2Key ? await r2Get(m.r2Key).catch(() => null) : null
    if (!body) { noBody++; console.log(`  ⚠ ${c.chunkId} — no body`); rows.push({ chunkId: c.chunkId, status: 'no-body' }); continue }
    // Its own words, trimmed to a sensible query length.
    const q = body.replace(/\s+/g, ' ').trim().slice(0, 900)
    const res = await fetch(`${V}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q, limit: K, corpora: PARLIAMENTARY_CORPORA }),
    })
    if (!res.ok) { console.log(`  ⚠ ${c.chunkId} — vector ${res.status}`); rows.push({ chunkId: c.chunkId, status: `http-${res.status}` }); continue }
    const hits = ((await res.json()) as any).results ?? []
    const rank = hits.findIndex((h: any) => (h.chunkId ?? `${h.id}#0`) === c.chunkId)
    if (rank === 0) atOne++
    if (rank >= 0) found++
    console.log(`  ${rank === 0 ? 'RANK 1  ' : rank > 0 ? `rank ${String(rank + 1).padStart(2)}  ` : 'NOT FOUND'} ${String(m?.w ?? '?').padStart(4)}w  ${c.chunkId}`)
    rows.push({ chunkId: c.chunkId, tags: c.tags, words: m?.w ?? null, rank: rank >= 0 ? rank + 1 : null, returned: hits.length })
  }

  console.log(`\n  found by their own words: ${found} of ${tagged.length}   (at rank 1: ${atOne})`)
  console.log(`  bodies unreadable: ${noBody}`)
  console.log('')
  if (found === tagged.length) {
    console.log('  ⇒ EVERY held-out passage IS in the dense index and IS retrievable.')
    console.log('    So propagation\'s 0-of-20 is reading A: the method does not generalise from a seed')
    console.log('    to other passages making the same move in different words.')
  } else {
    console.log(`  ⇒ ⚠⚠ ${tagged.length - found} of ${tagged.length} could NOT be found by their own words.`)
    console.log('    For those, the recall figure measures index coverage rather than propagation, and')
    console.log('    must be reported that way.')
  }

  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), k: K, n: tagged.length, found, atOne, rows }, null, 2))
  console.log(`\n  wrote ${OUT}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
