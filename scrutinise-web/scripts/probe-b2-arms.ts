/**
 * probe-b2-arms.ts — B2, before anything is built on it: what do the two arms
 * actually return, and what fields does a row carry?
 *
 * ⚠ The brief says argument-questions.ts is "queryable". It is not — see the
 * report. This probe establishes what IS.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { PARLIAMENTARY_CORPORA } from './argument/taxonomy'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const F = 'https://fts-serve-production.up.railway.app'

async function main() {
  console.log('VECTOR_SEARCH_URL =', V || '(unset)')
  console.log('FTS_SEARCH_URL    = (unset in .env; using the production host found in the repo):', F)
  console.log('parliamentary corpora:', PARLIAMENTARY_CORPORA.join(', '), '\n')

  // ── keyword arm ──────────────────────────────────────────────────────────
  const q = 'putting the civil service on a statutory basis'
  const t0 = Date.now()
  const fr = await fetch(`${F}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: q, limit: 5, corpora: PARLIAMENTARY_CORPORA }),
  })
  console.log(`FTS  status=${fr.status} in ${Date.now() - t0}ms`)
  const fj = await fr.json() as any
  console.log('FTS top-level keys:', Object.keys(fj).join(', '))
  const fres = fj.results ?? []
  console.log('FTS result count:', fres.length)
  if (fres[0]) console.log('FTS row keys:', Object.keys(fres[0]).join(', '), '\n  sample:', JSON.stringify(fres[0]).slice(0, 400))

  // ── dense arm ────────────────────────────────────────────────────────────
  const t1 = Date.now()
  const vr = await fetch(`${V}/vector-search-batch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queries: [{ query: q, limit: 5, corpora: PARLIAMENTARY_CORPORA }] }),
  })
  console.log(`\nVEC  status=${vr.status} in ${Date.now() - t1}ms`)
  const vj = await vr.json() as any
  console.log('VEC top-level keys:', Object.keys(vj).join(', '))
  const vres = vj.queries?.[0]?.results ?? []
  console.log('VEC ok =', vj.queries?.[0]?.ok, 'result count:', vres.length)
  if (vres[0]) console.log('VEC row keys:', Object.keys(vres[0]).join(', '), '\n  sample:', JSON.stringify(vres[0]).slice(0, 400))

  // ── what metadata is available to attach ─────────────────────────────────
  const ids = [...new Set([...fres, ...vres].map((h: any) => h.id))].slice(0, 6)
  if (ids.length) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, corpus, "sectionTitle", speaker, "itemDate", "wordCount", "r2Key", "parentDocId", "sourceUrl"
      FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
    console.log('\nhydrated rows:', rows.length)
    for (const r of rows.slice(0, 4)) {
      console.log(`  ${r.id}`)
      console.log(`     corpus=${r.corpus} speaker=${JSON.stringify(r.speaker)} date=${r.itemDate?.toISOString?.().slice(0, 10)} words=${r.wordCount}`)
      console.log(`     sectionTitle=${JSON.stringify(r.sectionTitle)} parentDocId=${JSON.stringify(r.parentDocId)}`)
      console.log(`     sourceUrl=${r.sourceUrl}`)
    }
    // does the parent carry the debate title?
    const parents = rows.map(r => r.parentDocId).filter(Boolean)
    if (parents.length) {
      const p = await prisma.$queryRaw<any[]>`
        SELECT id, "sectionTitle", "itemDate", corpus FROM corpus_sections WHERE id IN (${Prisma.join(parents)})`
      console.log('\nparent rows:', p.length)
      for (const r of p.slice(0, 4)) console.log(`  ${r.id} → sectionTitle=${JSON.stringify(r.sectionTitle)}`)
    } else {
      console.log('\n⚠ no parentDocId on any sampled row — the debate title must come from sectionTitle or the id')
    }
    // read one body back
    const withKey = rows.find(r => r.r2Key)
    if (withKey) {
      const body = await r2Get(withKey.r2Key)
      console.log(`\nR2 read-back of ${withKey.r2Key}: ${body ? body.length + ' chars' : 'NULL'}`)
      if (body) console.log('  first 300:', JSON.stringify(body.replace(/\s+/g, ' ').slice(0, 300)))
    }
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
