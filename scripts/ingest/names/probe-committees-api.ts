/**
 * probe-committees-api.ts — BRIEF_INGEST_NAMES §2.1. What does the source actually publish?
 *
 * ⚠ HOST NOTE, READ BEFORE ASSUMING A 403. The brief warns that Node's `fetch` is refused by
 * `committees.parliament.uk` (Cloudflare TLS fingerprinting) — that is true and documented in
 * `sources/committees-portal.ts`. It is a DIFFERENT HOST from the one this probe uses.
 * `committees-api.parliament.uk` is the open JSON API and carries no CF challenge (verified from
 * a residential IP, 12 Jun 2026, `sources/committees-api.ts` header). This probe touches the API
 * host ONLY.
 *
 * Prints raw JSON for a handful of real items of each kind, then measures field population over
 * a sample so the §2.2 route is chosen on numbers rather than on the presence of a field name in
 * a TypeScript interface.
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const API = 'https://committees-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (legal corpus research)'

async function get(path: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return { status: res.status, json: null }
  return { status: res.status, json: await res.json() }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

;(async () => {
  const pool = getNeonPool()

  // Sample REAL stored item ids, so the probe describes the rows we actually hold.
  const sample = async (kind: 'writtenevidence' | 'oralevidence', n: number) =>
    (await pool.query(
      `SELECT DISTINCT "parentDocId" FROM corpus_sections
        WHERE corpus='committees-evidence' AND "parentDocId" LIKE $1
        ORDER BY "parentDocId" LIMIT $2`, [`${kind}:%`, n])).rows
      .map(r => Number(String(r.parentDocId).split(':')[1]))

  for (const [kind, apiKind] of [['writtenevidence', 'WrittenEvidence'], ['oralevidence', 'OralEvidence']] as const) {
    const ids = await sample(kind, 3)
    console.log(`\n${'═'.repeat(96)}\n${apiKind} — RAW API RESPONSES for stored items\n${'═'.repeat(96)}`)
    for (const id of ids) {
      const { status, json } = await get(`/${apiKind}/${id}`)
      console.log(`\n── /${apiKind}/${id}  HTTP ${status}`)
      if (!json) { console.log('   (no body)'); continue }
      // Print the whole item minus the document blob, which is base64 noise here.
      const { document, ...rest } = json
      console.log(JSON.stringify(rest, null, 2).slice(0, 2600))
      await sleep(600)
    }
  }

  // ── Field population over a larger sample, via the LISTING endpoint ─────────────────────────
  console.log(`\n${'═'.repeat(96)}\nFIELD POPULATION (listing endpoint, Take=100)\n${'═'.repeat(96)}`)
  for (const apiKind of ['WrittenEvidence', 'OralEvidence'] as const) {
    const { status, json } = await get(`/${apiKind}?Skip=0&Take=100`)
    if (!json?.items) { console.log(`${apiKind}: HTTP ${status}, no items`); continue }
    const items: any[] = json.items
    const t = {
      total: json.totalResults,
      sampled: items.length,
      'witnesses[] present': items.filter(i => Array.isArray(i.witnesses)).length,
      'witnesses[] non-empty': items.filter(i => i.witnesses?.length).length,
      'witness .name non-null': items.filter(i => i.witnesses?.some((w: any) => w?.name)).length,
      'witness .organisations non-empty': items.filter(i => i.witnesses?.some((w: any) => w?.organisations?.length)).length,
      'committee present': items.filter(i => i.committee?.name).length,
      'committees[] present': items.filter(i => i.committees?.length).length,
      'committeeBusiness.title': items.filter(i => i.committeeBusiness?.title).length,
      'internalReference': items.filter(i => i.internalReference).length,
    }
    console.log(`\n── ${apiKind}`)
    console.table([t])
    const w = items.find(i => i.witnesses?.length)
    if (w) console.log('  example witnesses[]:', JSON.stringify(w.witnesses).slice(0, 900))
    const c = items.find(i => i.committee || i.committees?.length)
    if (c) console.log('  example committee:', JSON.stringify({ committee: c.committee, committees: c.committees }).slice(0, 500))
    await sleep(600)
  }

  // ── Publications: is the author the committee, and what about Government Responses? ─────────
  console.log(`\n${'═'.repeat(96)}\nPublications — the author question (committee vs responding department)\n${'═'.repeat(96)}`)
  const { json: pub } = await get(`/Publications?Skip=0&Take=100`)
  if (pub?.items) {
    const items: any[] = pub.items
    const byType: Record<string, number> = {}
    for (const i of items) byType[i.type?.name ?? '(none)'] = (byType[i.type?.name ?? '(none)'] ?? 0) + 1
    console.log('type distribution in 100:', JSON.stringify(byType))
    console.log('committee present:', items.filter(i => i.committee?.name || i.committees?.length).length, '/', items.length)
    console.log('respondingDepartment present:', items.filter(i => i.respondingDepartment).length)
    const gr = items.find(i => i.type?.name === 'Government Response')
    if (gr) {
      const { documents, ...rest } = gr
      console.log('\nexample GOVERNMENT RESPONSE item:\n', JSON.stringify(rest, null, 2).slice(0, 1800))
    }
  }

  await endNeonPool()
})().catch(e => { console.error(e); process.exit(1) })
