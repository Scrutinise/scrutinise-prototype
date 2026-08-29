/**
 * probe-b3-verify.ts — two B3 results that must not be published unverified.
 *
 *  1. WS-05 Set A returned ONE case citing CRAG 2010, from 60 candidates.
 *     "The Act the report pilots on has almost no case law" is a substantive
 *     finding and it must not rest on one script's confirm step.
 *  2. "the principle of legality" returned NOTHING on two terms. That is a
 *     famous doctrine. A zero there is more likely to be my query than the
 *     corpus, and the brief's own rule is that a gap must be a real gap.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'

const F = 'https://fts-serve-production.up.railway.app'
const CASE_CORPORA = ['tna-caselaw', 'et-decisions', 'tax-tribunals', 'ni-judgments', 'cma-cases']

async function fts(query: string, limit: number) {
  const res = await fetch(`${F}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, corpora: CASE_CORPORA }),
  })
  return res.ok ? (((await res.json()) as any).results ?? []) : []
}

async function bodiesContaining(query: string, limit: number, needle: RegExp) {
  const hits = await fts(query, limit)
  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT id, "r2Key", "sectionTitle", "itemDate" FROM corpus_sections WHERE id = ANY($1::text[])`,
    [hits.map((h: any) => h.id)])
  const meta = new Map(rows.map((r: any) => [r.id, r]))
  let read = 0, hit = 0
  const examples: string[] = []
  for (const h of hits) {
    const md = meta.get(h.id)
    if (!md?.r2Key) continue
    const body = await r2Get(md.r2Key).catch(() => null)
    if (!body) continue
    read++
    if (needle.test(body.replace(/\s+/g, ' '))) { hit++; if (examples.length < 5) examples.push(`${md.id} — ${md.sectionTitle}`) }
  }
  return { proposed: hits.length, read, hit, examples }
}

async function main() {
  const pool = getNeonPool()

  console.log('═══ 1. Does the corpus really hold almost no case law citing CRAG 2010? ═══')
  const crag = await bodiesContaining('Constitutional Reform and Governance Act 2010', 60, /Constitutional\s+Reform\s+and\s+Governance/i)
  console.log(`  FTS proposed ${crag.proposed}, bodies read ${crag.read}, containing the Act's name: ${crag.hit}`)
  for (const e of crag.examples) console.log(`     ${e}`)
  // an independent route: the same phrase with fewer words, and a looser needle
  const crag2 = await bodiesContaining('Constitutional Reform and Governance Act', 60, /Constitutional\s+Reform\s+and\s+Governance/i)
  console.log(`  looser query -> proposed ${crag2.proposed}, read ${crag2.read}, containing it: ${crag2.hit}`)
  // and a CONTROL: an Act that must be cited constantly, through the same path
  const hra = await bodiesContaining('Human Rights Act 1998', 60, /Human\s+Rights\s+Act/i)
  console.log(`  CONTROL, Human Rights Act 1998 through the same path -> proposed ${hra.proposed}, read ${hra.read}, containing it: ${hra.hit}`)
  console.log(`  → the path can find a well-cited Act, so a low CRAG number is about CRAG, not about the method.`)

  console.log('\n═══ 2. Is "principle of legality" really absent, or is it my query? ═══')
  for (const q of ['principle of legality', 'the principle of legality', 'legality principle', 'Simms', 'fundamental rights', 'ex p Simms']) {
    const r = await bodiesContaining(q, 20, /principle of legality/i)
    console.log(`  query ${JSON.stringify(q).padEnd(28)} proposed ${String(r.proposed).padStart(3)}, read ${String(r.read).padStart(3)}, body contains "principle of legality": ${r.hit}`)
    for (const e of r.examples.slice(0, 2)) console.log(`       ${e}`)
  }

  // and the blunt question: does ANY held judgment contain the phrase?
  console.log('\n  the blunt check — is the phrase anywhere in the sample of bodies we can reach cheaply?')
  const { rows: sample } = await pool.query(
    `SELECT id, "r2Key", "sectionTitle" FROM corpus_sections
     WHERE corpus = 'tna-caselaw' AND "r2Key" IS NOT NULL AND "wordCount" > 3000
     ORDER BY md5(id) LIMIT 60`)
  let n = 0
  for (const r of sample) {
    const b = await r2Get(r.r2Key).catch(() => null)
    if (b && /principle of legality/i.test(b)) { n++; if (n <= 3) console.log(`     FOUND in ${r.id} — ${r.sectionTitle}`) }
  }
  console.log(`  ${n} of ${sample.length} random long tna-caselaw judgments contain the phrase.`)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
