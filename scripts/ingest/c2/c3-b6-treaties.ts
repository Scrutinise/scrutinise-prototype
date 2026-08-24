/** B6 — the two unreachable treaty collections, verified LIVE rather than read off a comment. */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { pool } from './db'
const FTS = (process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')

async function search(body: any) {
  const r = await fetch(`${FTS}/fts-search`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`FTS ${r.status}`)
  const j = await r.json() as any
  return (j.results ?? []) as any[]
}
const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
const NON_DEBATE_PARLIAMENTARY = [...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may']

async function main() {
  const p = pool(); const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  console.log('=== B6 — uk-treaties and tax-treaties-dta, measured through the live index ===\n')
  for (const c of ['uk-treaties', 'tax-treaties-dta', 'uk-treaties-fcdo', 'parliament-treaties']) {
    const r = (await q(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1 AND status='compiled'`, [c]))[0].n
    console.log(`  ${c.padEnd(22)} ${String(r).padStart(7)} compiled sections`)
  }
  console.log('')
  // pick a distinctive phrase actually IN one of the two collections
  for (const corpus of ['uk-treaties', 'tax-treaties-dta']) {
    const row = (await q(`SELECT id, "sectionTitle" FROM corpus_sections WHERE corpus=$1 AND status='compiled' AND "sectionTitle" IS NOT NULL ORDER BY md5(id) LIMIT 1`, [corpus]))[0]
    const phrase = String(row?.sectionTitle ?? '').slice(0, 90)
    console.log(`── ${corpus}   probe phrase: "${phrase}"`)
    // ⚠ COUNT THE HITS FROM THIS COLLECTION, NOT THE HITS. A stream scope returns 10 rows
    //   whatever happens — other parliamentary collections match the phrase too. The first
    //   version of this probe counted `.length` and reported 10 for a scope that excludes the
    //   collection by name, which reads as "reachable" and is meaningless.
    const from = (rs: any[]) => rs.filter((x: any) => x.corpus === corpus).length
    const own = await search({ query: phrase, limit: 20, corpora: [corpus] })
    console.log(`   scoped to its own corpus         → ${from(own)}/${own.length} from ${corpus}   (CONTROL: proves the text IS indexed)`)
    const deb = await search({ query: phrase, limit: 20, tier: 'parliamentary', excludeCorpora: NON_DEBATE_PARLIAMENTARY })
    console.log(`   through the DEBATES stream scope → ${from(deb)}/${deb.length} from ${corpus}   (must be 0 — excludeCorpora names it)`)
    const com = await search({ query: phrase, limit: 20, tier: 'parliamentary', corpora: COMMITTEE_CORPORA })
    console.log(`   through the COMMITTEES scope     → ${from(com)}/${com.length} from ${corpus}   (must be 0 — the corpora prefilter omits it)`)
    for (const t of ['legislation', 'caselaw', 'guidance', 'other']) {
      const r = await search({ query: phrase, limit: 20, tier: t })
      if (from(r) > 0) console.log(`   ⚠ REACHED through tier '${t}': ${from(r)}/${r.length}`)
    }
    const bare = await search({ query: phrase, limit: 20, tier: 'parliamentary' })
    console.log(`   tier only, NO stream filter      → ${from(bare)}/${bare.length} from ${corpus}   (what a sixth stream would see)`)
    console.log('')
  }
  await p.end()
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
