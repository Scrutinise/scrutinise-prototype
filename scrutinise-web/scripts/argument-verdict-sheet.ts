/**
 * argument-verdict-sheet.ts — ARGUMENT 1A §4. DRAW 50 TAGGED PASSAGES TO BE READ BY HAND.
 *
 * ⚠ DRAWN FROM WHAT PROPAGATION ACTUALLY PRODUCED (`argument_tag`), not from the candidate pool
 * the seeds came from. Measuring the method on the sample the method was built from would be a
 * different and much kinder question.
 *
 * ⚠ SPREAD ACROSS TAGS AND METHODS, and `ORDER BY md5(...)` inside each so the draw is not the
 * top-scoring rows. A hand-read of the fifty best-scoring passages measures the top of the
 * ranking, which is not what §4 asks about.
 *
 * Usage:  npm run argument:verdict-sheet -- [--per-tag 5]
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { TAGS } from './argument/taxonomy'

const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? parseInt(process.argv[i + 1], 10) : d }
const PER_TAG = arg('per-tag', 5)

async function main() {
  const rows: any[] = []
  for (const tag of TAGS) {
    for (const method of ['prototype:v1', 'pattern:v1']) {
      const take = method === 'prototype:v1' ? PER_TAG : Math.max(1, Math.floor(PER_TAG / 2))
      const r = await prisma.$queryRaw<any[]>`
        SELECT chunk_id, section_id, tag, method, score, evidence
        FROM argument_tag WHERE tag = ${tag} AND method = ${method}
        ORDER BY md5(chunk_id) LIMIT ${take}`
      rows.push(...r)
    }
  }
  const ids = Array.from(new Set(rows.map((r) => r.section_id)))
  const meta = new Map((await prisma.$queryRaw<any[]>`
    SELECT id, corpus, "sectionTitle", speaker, "itemDate", "wordCount" AS w, "r2Key"
    FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`).map((m) => [m.id, m]))

  console.log(`# ${rows.length} TAGGED PASSAGES FOR HAND-READING (§4)`)
  console.log('# For each: is the TAG RIGHT, and SHOULD IT HAVE BEEN TAGGED AT ALL — two answers, not one.')
  console.log('')
  let i = 0
  for (const r of rows) {
    i++
    const m = meta.get(r.section_id)
    const body = m?.r2Key ? await r2Get(m.r2Key).catch(() => null) : null
    console.log(`[${i}] ${r.tag} · ${r.method}${r.score != null ? ` · ${Number(r.score).toFixed(3)}` : ''}`)
    console.log(`    ${r.chunk_id}`)
    console.log(`    ${m?.corpus ?? '?'} · ${m?.speaker ?? '(no speaker)'} · ${String(m?.itemDate ?? '').slice(0, 15)} · ${m?.w ?? '?'}w`)
    console.log(`    title: ${String(m?.sectionTitle ?? '(none)').slice(0, 110)}`)
    console.log(`    ${(body ?? '(body unreadable)').replace(/\s+/g, ' ').trim().slice(0, 620)}`)
    console.log('')
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
