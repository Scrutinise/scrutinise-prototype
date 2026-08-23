/**
 * a2-register.ts — CENSUS C1 Part A2. THE REGISTER, REGENERATED FROM LIVE DATA.
 *
 * READ-ONLY.
 *
 * ⚠ THE SCAFFOLD NAMED IN THE BRIEF DOES NOT EXIST. `docs/CORPUS_REGISTER_V31.csv` is listed as
 * "the scaffold this sprint fills", with `denominator_source_to_walk` leads marked "CC to verify".
 * It is not in the repository, tracked or untracked, and neither are `DAILY_EMAIL_V31_REBUILT.md`,
 * `CORPUS_SCOPE.md` or `OPEN_ITEMS.md`. The columns below are therefore MINE, not CCh's, and the
 * `denominator_source_to_walk` column is my own reading of where each publisher's index lives —
 * every value is marked `CC-proposed`, none is a verification of a lead I was given, and the whole
 * column needs CCh's review before Part B walks anything.
 *
 * Every collection appears — live, retired, blocked, not-started — plus the legacy table as its own
 * row, outside the sum. The reconciliation is printed at the foot of the file.
 *
 * Usage: tsx census/a2-register.ts
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { tierFor } from '../search/corpus-map'

const OUT = path.join(__dirname, '../../../docs/CORPUS_REGISTER_V31.csv')
const CENSUS_EMBED = path.join(__dirname, '../../../docs/embed_census.json')

/** Unit = the thing the PUBLISHER counts (brief §1). Never a section, never a chunk. */
const UNIT: Record<string, string> = {
  legislation: 'instrument', caselaw: 'judgment', parliamentary: 'sitting-day or item',
  guidance: 'document', other: 'document',
}
const UNIT_OVERRIDE: Record<string, string> = {
  'historic-hansard': 'House + sitting date', 'pwdata-debates': 'sitting-day file',
  'pwdata-lords': 'sitting-day file', 'pwdata-wrans': 'sitting-day file',
  'pwdata-lordswrans': 'sitting-day file', 'pwdata-wms': 'sitting-day file',
  'pwdata-lordswms': 'sitting-day file', 'pwdata-westminster': 'sitting-day file',
  'senedd-cofnod': 'plenary meeting', 'scottish-parliament-or': 'meeting',
  'niassembly-hansard': 'sitting', 'et-decisions': 'decision', 'tna-caselaw': 'judgment',
  'petitions': 'petition', 'early-day-motions': 'motion', 'members-interests': 'register edition',
  'commons-divisions-votes': 'division', 'lords-divisions-votes': 'division',
  'hmrc-manuals': 'manual page', 'bills-api': 'bill publication', 'consultations': 'consultation',
  'impact-assessments': 'impact assessment', 'nao-reports': 'report', 'inquiry-reports': 'report',
}
/** Where the publisher's own index lives. ⚠ ALL CC-PROPOSED — the scaffold's leads were unavailable. */
const WALK: Record<string, string> = {
  'primary-acts-pre-2000': 'legislation.gov.uk year feeds /ukpga/{year}/data.feed (walked 2026-08-12)',
  'primary-acts-2000plus': 'legislation.gov.uk year feeds /ukpga/{year}/data.feed (walked 2026-08-12)',
  'si-pre-2010': 'legislation.gov.uk /uksi/{year}/data.feed (walked 2026-08-12)',
  'si-2010plus': 'legislation.gov.uk /uksi/{year}/data.feed (walked 2026-08-12)',
  'regional': 'legislation.gov.uk asp/ssi/wsi/anaw/asc/nia/nisi/nisr year feeds (walked 2026-08-12)',
  'retained-eu': 'legislation.gov.uk eur/eudn/eudr year feeds (walked 2026-08-12)',
  'tna-caselaw': 'Find Case Law Atom feed, per court per year',
  'et-decisions': 'gov.uk/employment-tribunal-decisions paginated listing',
  'historic-hansard': 'api.parliament.uk/historic-hansard sittings index',
  'pwdata-debates': 'ParlParse scrapedxml/debates/ directory index (latest revision letter per day)',
  'pwdata-lords': 'ParlParse scrapedxml/lordspages/ directory index',
  'pwdata-wrans': 'ParlParse scrapedxml/wrans/ directory index',
  'pwdata-lordswrans': 'ParlParse scrapedxml/lordswrans/ directory index',
  'pwdata-wms': 'ParlParse scrapedxml/wms/ directory index',
  'pwdata-lordswms': 'ParlParse scrapedxml/lordswms/ directory index',
  'pwdata-westminster': 'ParlParse scrapedxml/westminhall/ directory index',
  'senedd-cofnod': 'record.senedd.wales /Meeting/{id} redirect classification (713 plenaries held)',
  'scottish-parliament-or': 'parliament.scot Official Report meeting index',
  'niassembly-hansard': 'aims.niassembly.gov.uk official report index',
  'committees-reports': 'committees.parliament.uk publications API',
  'committees-evidence': 'committees.parliament.uk written-evidence API',
  'bills-api': 'bills-api.parliament.uk /Bills + /Publications',
  'petitions': 'petition.parliament.uk/petitions.json (open + archived)',
  'early-day-motions': 'edm.parliament.uk paginated listing',
  'commons-divisions-votes': 'commonsvotes-api.parliament.uk',
  'lords-divisions-votes': 'lordsvotes-api.parliament.uk',
  'echr-hudoc': 'HUDOC API, respondent=GBR',
  'ni-judgments': 'judiciaryni.uk decisions listing',
  'scottish-courts': 'scotcourts.gov.uk opinions listing (⚠ V27 recorded the search API as blocked)',
  'hmrc-manuals': 'gov.uk HMRC manual index + per-manual contents tree',
  'consultations': 'gov.uk /search/policy-papers-and-consultations',
  'impact-assessments': 'legislation.gov.uk /ukia/ bulk feed',
  'quangos-govuk': 'gov.uk /api/organisations, then per-organisation content — needs a DECLARED scope list',
  'oecd': '⚠ NO WALK POSSIBLE AS SEEDED — the collection holds no OECD content (A3)',
  'ots-reports': 'gov.uk OTS publication listing (⚠ contaminated with news/speeches — A3)',
}

interface T {
  corpus_key: string; display_label: string | null; est_sections: number | null
  est_is_confirmed: boolean; retired: boolean; blocked: boolean; blocked_reason: string | null
}

const csv = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
  const { rows: targets } = await pool.query<T>(`
    SELECT corpus_key, display_label, est_sections, est_is_confirmed,
           COALESCE(retired,false) retired, COALESCE(blocked,false) blocked, blocked_reason
      FROM corpus_targets ORDER BY corpus_key`)
  const { rows: held } = await pool.query<{ corpus: string; compiled: string; total: string }>(`
    SELECT corpus, count(*) FILTER (WHERE status='compiled')::text compiled, count(*)::text total
      FROM corpus_sections GROUP BY 1`)
  const { rows: legacy } = await pool.query<{ n: string; items: string }>(`
    SELECT count(*)::text n, count(DISTINCT "legislationItemId")::text items FROM "LegislationSection"`)
  await pool.end()

  const heldBy = new Map(held.map(h => [h.corpus, { compiled: Number(h.compiled), total: Number(h.total) }]))
  const embedBy = new Map<string, number>()
  if (fs.existsSync(CENSUS_EMBED)) {
    const e = JSON.parse(fs.readFileSync(CENSUS_EMBED, 'utf8')) as { collections: Array<{ corpus: string; embedded_sections: number }> }
    for (const c of e.collections) embedBy.set(c.corpus, c.embedded_sections)
  }

  const HEADERS = ['corpus_key', 'display_label', 'tier', 'unit', 'state', 'held_sections', 'held_sections_total_incl_unavailable',
    'embedded_sections', 'est_sections', 'est_provenance', 'denominator_source_to_walk', 'walk_lead_status', 'notes']
  const lines: string[] = [HEADERS.join(',')]

  let liveSum = 0, retiredSum = 0
  const keys = new Set([...targets.map(t => t.corpus_key), ...heldBy.keys()])
  for (const key of [...keys].sort()) {
    const t = targets.find(x => x.corpus_key === key)
    const h = heldBy.get(key)
    const compiled = h?.compiled ?? 0
    const retired = !!t?.retired
    if (retired) retiredSum += compiled; else liveSum += compiled

    const state = retired ? 'RETIRED'
      : t?.blocked ? 'BLOCKED'
      : compiled === 0 ? 'NOT STARTED'
      : t?.est_sections == null ? 'UNMEASURED (no denominator)'
      : t.est_sections <= compiled ? 'UNMEASURED (denominator set from this count)'
      : 'CLAIMED (target above count, provenance unproven)'
    const prov = t?.est_sections == null ? 'none'
      : t.est_sections <= compiled ? 'self-referential — set from the compiled count'
      : 'unproven'

    lines.push([
      key, t?.display_label ?? '', tierFor(key), UNIT_OVERRIDE[key] ?? UNIT[tierFor(key)] ?? 'document',
      state, compiled, h?.total ?? 0, embedBy.get(key) ?? '', t?.est_sections ?? '', prov,
      WALK[key] ?? '⚠ NO LEAD — needs a publisher index or a DECLARED scope',
      WALK[key] ? 'CC-proposed (scaffold unavailable)' : 'CC-proposed: none found',
      t?.blocked_reason ?? '',
    ].map(csv).join(','))
  }

  // The legacy table: its own row, OUTSIDE the sum.
  lines.push([
    'legacy-legislation-section', 'Legacy LegislationSection table (pre-Railway pipeline)', 'legislation', 'instrument',
    'OUTSIDE THE CORPUS — not searchable, excluded from every total', Number(legacy[0].n), Number(legacy[0].n), 0, '',
    'n/a', 'n/a — superseded by corpus_sections', 'n/a',
    `${Number(legacy[0].items).toLocaleString()} instruments; A7 finds only 29 of them are an independent gap`,
  ].map(csv).join(','))

  const total = liveSum + retiredSum
  lines.push('')
  lines.push('# RECONCILIATION')
  lines.push(`# live collections (searchable),${liveSum}`)
  lines.push(`# retired collections (still held and still indexed),${retiredSum}`)
  lines.push(`# sum,${total}`)
  lines.push(`# corpus_sections compiled total,${[...heldBy.values()].reduce((s, v) => s + v.compiled, 0)}`)
  lines.push(`# legacy LegislationSection (outside the sum),${Number(legacy[0].n)}`)
  lines.push(`# searchable corpus per the brief's definition = live only,${liveSum}`)

  fs.writeFileSync(OUT, lines.join('\n') + '\n')
  const compiledTotal = [...heldBy.values()].reduce((s, v) => s + v.compiled, 0)
  console.log(`[A2] ${keys.size} collections + legacy row → ${OUT}`)
  console.log(`[A2] live ${liveSum.toLocaleString()} + retired ${retiredSum.toLocaleString()} = ${total.toLocaleString()}`)
  console.log(`[A2] corpus_sections compiled total ${compiledTotal.toLocaleString()} — ${total === compiledTotal ? 'RECONCILES ✓' : '⚠ DOES NOT RECONCILE'}`)
  console.log(`[A2] searchable corpus (live only) = ${liveSum.toLocaleString()}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
