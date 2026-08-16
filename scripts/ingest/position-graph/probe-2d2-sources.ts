/**
 * probe-2d2-sources.ts — the second half of "bytes before hypotheses" for BRIEF_GRAPH_2D2.
 *
 * Everything here is a READ against a live source or against R2. It answers four questions the
 * database alone cannot:
 *
 *   A  does the EDM list item really carry PrimarySponsor.MnisId?         (brief §3)
 *   B  does the pwdata XML really carry person_id, and on what share?     (brief §2)
 *   C  is there a cheaper crosswalk than sweeping every day-file?         (brief §2)
 *   D  is a consultation's RESPONDER structured, or only in prose?        (brief §4)
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-2d2-sources.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'

export {}

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
function head(s: string) { console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 76 - s.length))}`) }

async function getText(url: string, accept = 'text/plain'): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA } })
    const body = await res.text()
    return { status: res.status, body }
  } catch (e) { console.log(`   fetch failed: ${(e as Error).message}`); return null }
}

async function probeEdmMnisId() {
  head('A — EDM list item: is PrimarySponsor.MnisId on the wire?')
  const r = await getText('https://oralquestionsandmotions-api.parliament.uk/EarlyDayMotions/list?parameters.take=2&parameters.skip=0', 'application/json')
  if (!r) return
  console.log(`   HTTP ${r.status}, ${r.body.length} bytes`)
  if (r.status !== 200) { console.log(r.body.slice(0, 400)); return }
  const d = JSON.parse(r.body)
  console.log(`   PagingInfo.Total = ${d?.PagingInfo?.Total}`)
  const item = d?.Response?.[0]
  if (!item) { console.log('   no Response[0]'); return }
  console.log(`   top-level keys: ${Object.keys(item).join(', ')}`)
  console.log(`   PrimarySponsor keys: ${item.PrimarySponsor ? Object.keys(item.PrimarySponsor).join(', ') : '(null)'}`)
  console.log(`   PrimarySponsor: ${JSON.stringify(item.PrimarySponsor)}`)
  if (Array.isArray(item.Sponsors)) {
    console.log(`   ⚠ Sponsors ARRAY present, length ${item.Sponsors.length}; first = ${JSON.stringify(item.Sponsors[0])}`)
  }
}

async function probePwdataPersonId() {
  head('B — pwdata XML: does the speech carry person_id?')
  // Take a real day-file URL straight from the source module's own listing logic.
  const urls = [
    'https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates2024-07-17b.xml',
    'https://www.theyworkforyou.com/pwdata/scrapedxml/debates/debates2015-06-02b.xml',
    'https://www.theyworkforyou.com/pwdata/scrapedxml/lords/daylord2024-07-17a.xml',
  ]
  for (const u of urls) {
    const r = await getText(u, 'text/xml')
    if (!r) continue
    console.log(`\n   ${u}\n     HTTP ${r.status}, ${r.body.length} bytes`)
    if (r.status !== 200) continue
    const speeches = r.body.match(/<speech\b[^>]*>/g) ?? []
    const withPerson = speeches.filter((s) => /person_id="[^"]+"/.test(s))
    const nonEmptyPerson = speeches.filter((s) => /person_id="uk\.org\.publicwhip\/person\/\d+"/.test(s))
    const withSpeakerId = speeches.filter((s) => /speakerid="uk\.org\.publicwhip\/member\/\d+"/.test(s))
    console.log(`     <speech> tags: ${speeches.length}`)
    console.log(`     person_id present:        ${withPerson.length} (${speeches.length ? (100 * withPerson.length / speeches.length).toFixed(1) : '—'}%)`)
    console.log(`     person_id NON-EMPTY:      ${nonEmptyPerson.length} (${speeches.length ? (100 * nonEmptyPerson.length / speeches.length).toFixed(1) : '—'}%)`)
    console.log(`     speakerid (member) form:  ${withSpeakerId.length}`)
    for (const s of speeches.slice(0, 3)) console.log(`     eg  ${s.slice(0, 220)}`)
  }
}

async function probeCrosswalk() {
  head('C — is there a one-file crosswalk instead of a 50k-file sweep?')
  const candidates = [
    'https://www.theyworkforyou.com/pwdata/members/people.json',
    'https://raw.githubusercontent.com/mysociety/parlparse/master/members/people.json',
    'https://www.theyworkforyou.com/pwdata/members/',
  ]
  for (const u of candidates) {
    const r = await getText(u, 'application/json')
    if (!r) continue
    console.log(`\n   ${u}\n     HTTP ${r.status}, ${r.body.length} bytes`)
    if (r.status !== 200) { console.log(`     body head: ${r.body.slice(0, 200).replace(/\s+/g, ' ')}`); continue }
    if (u.endsWith('.json')) {
      try {
        const d = JSON.parse(r.body)
        console.log(`     top-level keys: ${Object.keys(d).join(', ')}`)
        for (const k of Object.keys(d)) if (Array.isArray(d[k])) console.log(`       ${k}: ${d[k].length} rows; first = ${JSON.stringify(d[k][0]).slice(0, 300)}`)
        // The thing we actually need: does any record carry an MNIS id next to a publicwhip person id?
        const ids: any[] = Array.isArray(d.persons) ? d.persons : []
        const withIdentifiers = ids.filter((p) => Array.isArray(p.identifiers) && p.identifiers.length)
        console.log(`     persons with identifiers[]: ${withIdentifiers.length} / ${ids.length}`)
        const schemes = new Map<string, number>()
        for (const p of withIdentifiers) for (const i of p.identifiers) schemes.set(i.scheme, (schemes.get(i.scheme) ?? 0) + 1)
        console.log(`     identifier schemes: ${[...schemes].map(([k, v]) => `${k}=${v}`).join(', ')}`)
      } catch (e) { console.log(`     not JSON: ${(e as Error).message}; head: ${r.body.slice(0, 200)}`) }
    } else {
      console.log(`     listing head: ${r.body.slice(0, 600).replace(/\s+/g, ' ')}`)
    }
  }
}

async function probeConsultationResponders() {
  head('D — consultation responders: structured, or prose?')
  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT id, "sourceUrl", "r2Key", "sectionTitle", "wordCount" FROM corpus_sections
     WHERE corpus='consultations' ORDER BY "wordCount" DESC NULLS LAST LIMIT 4`)
  for (const r of rows) {
    console.log(`\n   ${r.id}\n     ${r.sourceUrl}  (${r.wordCount} words)`)
    if (r.r2Key) {
      try {
        const body = await r2Get(r.r2Key)
        const txt = typeof body === 'string' ? body : String(body)
        console.log(`     R2 ${r.r2Key} → ${txt.length} chars`)
        console.log(`     ── head ──\n${txt.slice(0, 900).split('\n').map((l: string) => '       ' + l).join('\n')}`)
        for (const pat of [/respond(ent|ers|ees)/i, /\bsummary of responses\b/i, /organisations? (who|that) responded/i]) {
          const m = pat.exec(txt)
          if (m) console.log(`     ⚑ matches ${pat} at ${m.index}: …${txt.slice(Math.max(0, m.index - 120), m.index + 200).replace(/\s+/g, ' ')}…`)
        }
      } catch (e) { console.log(`     R2 read failed: ${(e as Error).message}`) }
    }
  }
  // And the API side: does the gov.uk content API give a structured responder list?
  const slug = rows[0]?.sourceUrl?.replace('https://www.gov.uk', '') ?? ''
  if (slug) {
    const r = await getText(`https://www.gov.uk/api/content${slug}`, 'application/json')
    if (r) {
      console.log(`\n   gov.uk content API ${slug} → HTTP ${r.status}, ${r.body.length} bytes`)
      if (r.status === 200) {
        const d = JSON.parse(r.body)
        console.log(`     document_type=${d.document_type}  schema=${d.schema_name}`)
        console.log(`     details keys: ${Object.keys(d.details ?? {}).join(', ')}`)
        const atts = d.details?.attachments ?? []
        console.log(`     attachments: ${atts.length}`)
        for (const a of atts.slice(0, 6)) console.log(`       · ${a.title} [${a.content_type}] ${a.url}`)
        console.log(`     links keys: ${Object.keys(d.links ?? {}).join(', ')}`)
      }
    }
  }
  await endNeonPool()
}

async function main() {
  await probeEdmMnisId()
  await probePwdataPersonId()
  await probeCrosswalk()
  await probeConsultationResponders()
}
main().catch((e) => { console.error('[probe-2d2-sources] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
