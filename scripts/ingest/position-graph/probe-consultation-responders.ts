/**
 * probe-consultation-responders.ts — BRIEF_GRAPH_2D2 §4. REPORT ONLY. Builds no edge.
 *
 * The question is the one §1 of 2D-1 asked about committee evidence and got a decisive answer to:
 * **is the responding organisation structured, or is it only inside the document text?** If it is
 * structured this is a metadata sweep and a large win; if it is prose it is an extraction job and a
 * different sprint. The brief's instruction is counts, not impressions — so this reads a random
 * sample of the actual documents and the actual API rather than four cherry-picked examples.
 *
 * Two places a responder could be hiding, and both are checked:
 *   1  the gov.uk content API's structured fields (details.*, links.*)
 *   2  the compiled text we already hold in R2 — specifically the "list of respondents" annex that
 *      a well-run consultation response publishes
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-consultation-responders.ts [--n 300]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'

export {}

const N = Number(process.argv[process.argv.indexOf('--n') + 1]) || 300
const API_N = 60
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

/**
 * The signals, in descending order of how much they would be worth.
 *
 * A NAMED LIST is the prize: "Annex A — list of respondents" followed by organisation names is a
 * `responded-to-consultation` edge per line. An AGGREGATE ("we received 59 responses, 66% from
 * organisations") is worth something but is NOT an actor edge and must never be rendered as one.
 * A MENTION of respondents in prose is worth nothing on its own.
 */
const SIGNALS: Array<{ key: string; re: RegExp; worth: string }> = [
  { key: 'named-list-heading', worth: 'NAMED LIST — one edge per line', re: /\b(annex|appendix)\s*[a-z0-9]?\s*[:.\-–—]?\s*(list of |the )?(respondents|responses received|organisations that responded|consultation responses)\b/i },
  { key: 'list-of-respondents', worth: 'NAMED LIST — one edge per line', re: /\blist of (respondents|organisations (that|who) responded|consultees)\b/i },
  { key: 'who-responded-heading', worth: 'NAMED LIST — one edge per line', re: /\b(organisations|bodies|stakeholders) (that|who|which) responded\b/i },
  { key: 'aggregate-count', worth: 'AGGREGATE — a number, not an actor', re: /\bwe received (a total of )?[\d,]+\s+(responses|replies)\b/i },
  { key: 'aggregate-pct', worth: 'AGGREGATE — a number, not an actor', re: /\b\d+%\s+of\s+(respondents|responders|responses)\b/i },
  { key: 'prose-mention', worth: 'PROSE — worth nothing on its own', re: /\brespond(ents|ers)\b/i },
]

async function main() {
  head('§4 CONSULTATIONS — IS THE RESPONDER STRUCTURED?')
  const { rows: [tot] } = await pool.query<{ n: string; withKey: string }>(
    `SELECT COUNT(*)::text AS n, COUNT(*) FILTER (WHERE "r2Key" IS NOT NULL)::text AS "withKey"
       FROM corpus_sections WHERE corpus='consultations'`)
  console.log(`   ${tot.n} consultations held, ${tot.withKey} with compiled text in R2`)

  // ── 1. the structured side ────────────────────────────────────────────────────────────────────
  head('§4.1 THE GOV.UK CONTENT API — is a responder a field?')
  const { rows: apiSample } = await pool.query<{ sourceUrl: string }>(
    `SELECT "sourceUrl" FROM corpus_sections WHERE corpus='consultations' AND "sourceUrl" IS NOT NULL
      ORDER BY md5(id) LIMIT $1`, [API_N])
  const detailKeys = new Map<string, number>()
  const linkKeys = new Map<string, number>()
  const docTypes = new Map<string, number>()
  let apiOk = 0, withAttachments = 0, attachmentTotal = 0
  const responderish = /respond|consultee|submission/i
  let anyResponderField = 0
  for (const s of apiSample) {
    const slug = s.sourceUrl.replace('https://www.gov.uk', '')
    try {
      const res = await fetch(`https://www.gov.uk/api/content${slug}`, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (!res.ok) continue
      const d: any = await res.json()
      apiOk++
      docTypes.set(d.document_type, (docTypes.get(d.document_type) ?? 0) + 1)
      for (const k of Object.keys(d.details ?? {})) {
        detailKeys.set(k, (detailKeys.get(k) ?? 0) + 1)
        if (responderish.test(k)) anyResponderField++
      }
      for (const k of Object.keys(d.links ?? {})) linkKeys.set(k, (linkKeys.get(k) ?? 0) + 1)
      const atts = d.details?.attachments ?? []
      if (atts.length) { withAttachments++; attachmentTotal += atts.length }
    } catch { /* skip */ }
  }
  console.log(`   ${apiOk}/${apiSample.length} fetched`)
  console.log(`   document_type: ${[...docTypes].map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log(`   details.* keys seen (count of documents carrying each):`)
  for (const [k, v] of [...detailKeys].sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(28)} ${v}`)
  console.log(`   links.* keys seen:`)
  for (const [k, v] of [...linkKeys].sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(28)} ${v}`)
  console.log(`   ⚠ fields whose NAME suggests a responder: ${anyResponderField}`)
  console.log(`   documents carrying attachments: ${withAttachments}/${apiOk} (${attachmentTotal} attachments total)`)

  // ── 2. the text side ──────────────────────────────────────────────────────────────────────────
  head(`§4.2 THE TEXT WE ALREADY HOLD — random sample of ${N}`)
  const { rows: sample } = await pool.query<{ id: string; r2Key: string; sectionTitle: string; wordCount: number }>(
    `SELECT id, "r2Key", "sectionTitle", "wordCount" FROM corpus_sections
      WHERE corpus='consultations' AND "r2Key" IS NOT NULL ORDER BY md5(id) LIMIT $1`, [N])
  const hits = new Map<string, number>()
  const namedListExamples: Array<{ id: string; ctx: string }> = []
  let read = 0, failed = 0
  for (const s of sample) {
    let txt: string | null = null
    try { txt = await r2Get(s.r2Key) } catch { failed++; continue }
    if (!txt) { failed++; continue }
    read++
    for (const sig of SIGNALS) {
      const m = sig.re.exec(txt)
      if (!m) continue
      hits.set(sig.key, (hits.get(sig.key) ?? 0) + 1)
      if (sig.worth.startsWith('NAMED LIST') && namedListExamples.length < 6) {
        namedListExamples.push({ id: s.id, ctx: txt.slice(Math.max(0, m.index - 80), m.index + 420).replace(/\s+/g, ' ') })
      }
    }
  }
  console.log(`   read ${read}, unreadable ${failed}`)
  console.log(`\n   signal                        documents   %      worth`)
  for (const sig of SIGNALS) {
    const n = hits.get(sig.key) ?? 0
    console.log(`   ${sig.key.padEnd(28)} ${String(n).padStart(6)}  ${((100 * n) / Math.max(1, read)).toFixed(1).padStart(5)}%  ${sig.worth}`)
  }
  const namedAny = SIGNALS.filter((s) => s.worth.startsWith('NAMED LIST')).reduce((a, s) => a + (hits.get(s.key) ?? 0), 0)
  console.log(`\n   ⚠ documents matching ANY named-list signal: at most ${namedAny} of ${read} (${((100 * namedAny) / Math.max(1, read)).toFixed(1)}%) — upper bound, signals overlap`)

  if (namedListExamples.length) {
    console.log(`\n   what a named-list hit actually looks like — read these, do not trust the count:`)
    for (const e of namedListExamples) console.log(`      ${e.id}\n        …${e.ctx}…`)
  }
  await endNeonPool()
}
main().catch((e) => { console.error('[probe-consultation-responders] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
