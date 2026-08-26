/**
 * audit-25h-citations.ts — Sprint 25-H Task 1: does the corpus we STORE retain
 * the CLML cross-reference markup, and if not, where does it live?
 *
 * The brief's rule is bytes before hypotheses, so this reads two stores and
 * reports each separately rather than collapsing them into one "yes/no":
 *
 *   PART A  the corpus we store — per-section raw CLML in R2 (`r2RawKey`) and
 *           the `xmlPreview` column in Neon. Counts <Citation>, <CitationSubRef>
 *           AND <CommentaryRef> separately, because a CommentaryRef is NOT a
 *           citation and conflating them is how this audit would report a false
 *           positive. Pastes the first fragment it finds either way.
 *
 *   PART B  the whole-document CLML bulk (best-collection-xml.zip). Per doctype:
 *           total citation elements, body-only citation elements (outside
 *           <Commentaries>/<Footnote>/<SecondaryPreamble>, mirroring
 *           extract-cites-edges.ts exactly), distinct URI values, distinct
 *           target gids, and what proportion of those gids resolve to an
 *           instrument the corpus actually holds text for.
 *
 * Resolution reuses v37-citation-gaps.ts's identity logic: a cited gid counts as
 * held if IT, its regnal/calendar twin, or a prefix/zero-padded alias is held.
 * Without that the pre-1963 acts alone would inflate the miss rate by thousands.
 *
 *   npx tsx graph/audit-25h-citations.ts --part a [--sample 40]
 *   npx tsx graph/audit-25h-citations.ts --part b [--types ukpga,uksi] [--limit N]
 * Writes: docs/citation_audit_25h.json (merged; each part updates its own key)
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'
import { parseLegUri } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const ALIAS_PATH = path.join(__dirname, '..', 'v36', 'source-entries.json')
const OUT_JSON = path.join(__dirname, '../../../docs/citation_audit_25h.json')
const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}

/** Force a flat string copy — V8 sliced strings from matchAll on a multi-MB
 *  document pin the WHOLE document; retaining them in a Set leaks ~0.6 MB/doc.
 *  This is the same fix GRAPH_TIER1_REPORT.md §3.3 records for the extractor. */
function flat(s: string): string {
  return Buffer.from(s, 'utf8').toString('utf8')
}

// ── PART A — the corpus we store ─────────────────────────────────────────────

type SampleResult = {
  id: string; corpus: string; r2Key: string
  bytes: number
  citation: number; citationSubRef: number; commentaryRef: number
  error?: string
}

/**
 * Sampling profiles. `random` alone is weak evidence: the first run drew 40
 * objects averaging 2 KB, many of them repealed dot-leader stubs, and "no
 * citations in 2 KB of nothing" would prove nothing. `big` and `amend` are the
 * two places citation markup would survive if it survived anywhere — the
 * longest provisions, and provisions whose whole job is to amend another Act.
 */
const PROFILES: Record<string, { order: string; where: string }> = {
  random: { order: 'md5(id)', where: '' },
  big: { order: '"wordCount" DESC NULLS LAST', where: '' },
  amend: { order: '"wordCount" DESC NULLS LAST', where: `AND ("sectionTitle" ILIKE '%amendment%' OR "sectionTitle" ILIKE '%amend%' OR "sectionTitle" ILIKE '%repeal%')` },
}

async function partA(sample: number, profile: string) {
  const pool = getNeonPool()
  const p = PROFILES[profile] ?? PROFILES.random
  console.log(`[25h-A] sampling ${sample} stored per-section raw XML objects (profile: ${profile})…`)
  // Deliberately spread across the four legislation corpora that hold Acts and
  // SIs — a sample drawn from one corpus proves nothing about the others.
  const corpora = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010']
  const per = Math.max(1, Math.floor(sample / corpora.length))
  const results: SampleResult[] = []
  let firstFragment: { id: string; where: string; text: string } | null = null
  let firstCommentaryRef: { id: string; text: string } | null = null
  let previewWithCitation = 0
  let previewChecked = 0

  for (const corpus of corpora) {
    const { rows } = await pool.query(
      `SELECT id, corpus, "r2RawKey", "xmlPreview", "wordCount", "sectionTitle"
       FROM corpus_sections
       WHERE corpus = $1 AND status = 'compiled' AND "r2RawKey" IS NOT NULL ${p.where}
       ORDER BY ${p.order} LIMIT $2`, [corpus, per])
    console.log(`  ${corpus}: ${rows.length} rows drawn`)
    for (const r of rows) {
      const preview: string | null = r.xmlPreview
      if (preview) {
        previewChecked++
        if (/<Citation\b|<CitationSubRef\b/.test(preview)) previewWithCitation++
      }
      let xml: string | null = null
      try {
        xml = await r2Get(r.r2RawKey)
      } catch (e) {
        results.push({ id: r.id, corpus, r2Key: r.r2RawKey, bytes: 0, citation: 0, citationSubRef: 0, commentaryRef: 0, error: (e as Error).message })
        continue
      }
      if (xml == null) {
        results.push({ id: r.id, corpus, r2Key: r.r2RawKey, bytes: 0, citation: 0, citationSubRef: 0, commentaryRef: 0, error: 'R2 object missing' })
        continue
      }
      const cit = (xml.match(/<Citation\b/g) ?? []).length
      const sub = (xml.match(/<CitationSubRef\b/g) ?? []).length
      const com = (xml.match(/<CommentaryRef\b/g) ?? []).length
      results.push({ id: r.id, corpus, r2Key: r.r2RawKey, bytes: xml.length, citation: cit, citationSubRef: sub, commentaryRef: com })
      if (!firstFragment && cit + sub > 0) {
        const m = xml.match(/[\s\S]{0,200}<Citation(?:SubRef)?\b[\s\S]{0,300}/)
        firstFragment = { id: r.id, where: 'r2RawKey', text: flat(m ? m[0] : '') }
      }
      if (!firstCommentaryRef && com > 0) {
        const m = xml.match(/[\s\S]{0,200}<CommentaryRef\b[\s\S]{0,200}/)
        firstCommentaryRef = { id: r.id, text: flat(m ? m[0] : '') }
      }
    }
  }

  const ok = results.filter(r => !r.error)
  const totals = {
    sampled: results.length,
    read: ok.length,
    errors: results.length - ok.length,
    bytes: ok.reduce((a, r) => a + r.bytes, 0),
    citation: ok.reduce((a, r) => a + r.citation, 0),
    citationSubRef: ok.reduce((a, r) => a + r.citationSubRef, 0),
    commentaryRef: ok.reduce((a, r) => a + r.commentaryRef, 0),
    objectsWithAnyCitation: ok.filter(r => r.citation + r.citationSubRef > 0).length,
    objectsWithCommentaryRef: ok.filter(r => r.commentaryRef > 0).length,
    previewChecked, previewWithCitation,
  }
  console.log('\n[25h-A] stored per-section raw XML:', JSON.stringify(totals, null, 1))
  if (firstFragment) console.log('[25h-A] FIRST CITATION FRAGMENT:', firstFragment.id, '\n', firstFragment.text)
  else console.log('[25h-A] no <Citation>/<CitationSubRef> found in any sampled object')
  if (firstCommentaryRef) console.log('[25h-A] first CommentaryRef (NOT a citation):', firstCommentaryRef.id, '\n', firstCommentaryRef.text)

  writeOut(`partA_${profile}`, { profile, totals, results, firstFragment, firstCommentaryRef })
  await endNeonPool()
}

// ── PART B — the whole-doc CLML bulk ────────────────────────────────────────

/** Exclusion zones, byte-identical in intent to extract-cites-edges.ts. */
function exclusionZones(xml: string): Array<[number, number]> {
  const zones: Array<[number, number]> = []
  for (const rx of [/<Commentaries>[\s\S]*?<\/Commentaries>/g, /<Footnote\b[\s\S]*?<\/Footnote>/g, /<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/g]) {
    for (const m of xml.matchAll(rx)) zones.push([m.index!, m.index! + m[0].length])
  }
  return zones.sort((a, b) => a[0] - b[0])
}
function zoneCursor(zones: Array<[number, number]>) {
  let zi = 0
  return (i: number): boolean => {
    while (zi < zones.length && zones[zi][1] <= i) zi++
    return zi < zones.length && i >= zones[zi][0]
  }
}

/**
 * Zip entry name → doctype/year/number.
 *
 * ⚠ WIDENED, 25-H. `extract-cites-edges.ts` matches `-(\d{4})-` for the year and
 * so silently skips every REGNAL-year document: 2,431 of 132,990 entries,
 * including **1,650 ukpga — 37% of all the Acts in the file** — plus all 660
 * `aep` and all 58 `apgb`. The July cites run never saw them. This is the same
 * class of miss the effects extractor already fixed in its URI parser (see
 * GRAPH_TIER1_REPORT.md §3.1) and it was never carried across to the entry
 * filter, because the two do not share a code path.
 */
export const ENTRY_RX = /\/([a-z]+)-((?:\d{4})|(?:[A-Za-z][A-Za-z0-9]*-[0-9-]+))-(\d+)-[a-z-]+-data\.xml$/

/** Zip entry name → gid, regnal or calendar (`ukpga-Geo3-41-52-…` → `ukpga/Geo3/41/52`). */
export function gidFromEntry(m: RegExpMatchArray): string {
  return `${m[1]}/${m[2].replace(/-/g, '/')}/${m[3]}`
}

const PREFIX_ALIASES: Record<string, string[]> = { eud: ['eudn', 'eudr'] }
function identitiesFor(gid: string, alias: Map<string, string>): string[] {
  const out = new Set<string>([gid])
  const twin = alias.get(gid)
  if (twin) out.add(twin)
  const parts = gid.split('/')
  for (const alt of PREFIX_ALIASES[parts[0]] ?? []) out.add([alt, ...parts.slice(1)].join('/'))
  for (const id of [...out]) {
    const p = id.split('/')
    const last = p[p.length - 1]
    if (/^0\d+$/.test(last)) out.add([...p.slice(0, -1), String(Number(last))].join('/'))
  }
  return [...out]
}
function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>()
  if (!fs.existsSync(ALIAS_PATH)) {
    console.warn(`[25h-B] no alias map at ${ALIAS_PATH} — regnal/calendar false misses will NOT be resolved`)
    return map
  }
  const store: Record<string, { docId: string; calendarId: string | null }[]> = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8'))
  for (const entries of Object.values(store)) {
    for (const e of entries) {
      if (e.calendarId && e.calendarId !== e.docId) { map.set(e.calendarId, e.docId); map.set(e.docId, e.calendarId) }
    }
  }
  return map
}

type TypeStats = {
  docs: number; docsWithBodyCitation: number; docErrors: number
  elementsTotal: number; elementsBody: number; elementsExcluded: number
  elementsSelf: number; elementsBadUri: number
  subRefTotal: number; subRefBody: number; subRefBodyWithSectionRef: number
  bodyWithProvisionText: number
}
function emptyStats(): TypeStats {
  return { docs: 0, docsWithBodyCitation: 0, docErrors: 0, elementsTotal: 0, elementsBody: 0, elementsExcluded: 0, elementsSelf: 0, elementsBadUri: 0, subRefTotal: 0, subRefBody: 0, subRefBodyWithSectionRef: 0, bodyWithProvisionText: 0 }
}

/**
 * A provision reference in the running text immediately BEFORE a citation.
 * This is the load-bearing measurement of the whole audit: CLML body markup
 * names the ACT ("…the Human Rights Act <Citation URI=…>1998 (c. 42)</Citation>")
 * and leaves "section 3 of the" as plain text, so if the target provision is
 * recoverable at all it is recoverable from here and nowhere else.
 */
const PROVISION_TEXT_RX = /\b(sections?|ss?\.|parts?|pts?\.|schedules?|sch\.|paragraphs?|paras?\.|articles?|arts?\.|regulations?|regs?\.|rules?|chapters?)\s+([0-9]+[A-Z]*(?:\([0-9a-zA-Z]+\))*(?:\s*(?:to|and|,|-|–)\s*[0-9]+[A-Z]*(?:\([0-9a-zA-Z]+\))*)*)\s+(?:of|to)\s+(?:the\s+)?[^.;:]{0,80}$/i

async function partB(types: string[], limit: number) {
  const pool = getNeonPool()
  console.log('[25h-B] loading held gids from corpus_sections…')
  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid
     FROM corpus_sections WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  console.log(`[25h-B] corpus holds text for ${held.size.toLocaleString()} instruments`)
  const alias = buildAliasMap()
  console.log(`[25h-B] alias map: ${(alias.size / 2).toLocaleString()} regnal/calendar pairs`)

  console.log(`[25h-B] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const dataEntries = zip.entries.filter(e => e.name.endsWith('-data.xml'))
  const entries = dataEntries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null)
  const oldRx = /\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/
  const oldMatched = dataEntries.filter(e => oldRx.test(e.name)).length
  console.log(`[25h-B] ${entries.length.toLocaleString()} legislation docs in the zip ` +
    `(the shipped extractor's regex matches ${oldMatched.toLocaleString()} — it misses ${(entries.length - oldMatched).toLocaleString()} regnal-year docs)`)

  const out: Record<string, unknown> = {
    zip: {
      path: ZIP_PATH, bytes: fs.statSync(ZIP_PATH).size,
      dataEntries: dataEntries.length, matchedWidened: entries.length, matchedShipped: oldMatched,
    },
    byType: {},
  }

  for (const type of types) {
    const mine = entries.filter(x => x.m[1] === type)
    const take = limit > 0 ? mine.filter((_, i) => i % Math.max(1, Math.floor(mine.length / limit)) === 0).slice(0, limit) : mine
    console.log(`\n[25h-B] ${type}: ${mine.length.toLocaleString()} docs${limit > 0 ? ` (SAMPLE of ${take.length}, every ${Math.max(1, Math.floor(mine.length / limit))}th)` : ''}`)
    const st = emptyStats()
    const urisAll = new Set<string>()
    const urisBody = new Set<string>()
    const gidsBody = new Set<string>()
    const t0 = Date.now()

    for (const { e, m } of take) {
      const gid = gidFromEntry(m)
      let xml: string
      try { xml = zip.readText(e) } catch (err) { st.docErrors++; continue }
      st.docs++
      const zones = exclusionZones(xml)
      const inZone = zoneCursor(zones)
      let docBody = 0
      const rx = /<(Citation|CitationSubRef)\b[^>]*\sURI="([^"]+)"[^>]*>/g
      for (const c of xml.matchAll(rx)) {
        st.elementsTotal++
        if (c[1] === 'CitationSubRef') st.subRefTotal++
        urisAll.add(flat(c[2]))
        if (inZone(c.index!)) { st.elementsExcluded++; continue }
        st.elementsBody++
        docBody++
        if (c[1] === 'CitationSubRef') {
          st.subRefBody++
          if (/\sSectionRef="/.test(c[0])) st.subRefBodyWithSectionRef++
        }
        const target = parseLegUri(c[2])
        if (!target) { st.elementsBadUri++; continue }
        if (target.gid === gid) { st.elementsSelf++; continue }
        const before = xml.slice(Math.max(0, c.index! - 220), c.index!).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        if (PROVISION_TEXT_RX.test(before)) st.bodyWithProvisionText++
        urisBody.add(flat(c[2]))
        gidsBody.add(flat(target.gid))
      }
      if (docBody > 0) st.docsWithBodyCitation++
      if (st.docs % 2000 === 0) {
        const mu = process.memoryUsage()
        console.log(`  ${st.docs}/${take.length} docs, elements=${st.elementsTotal}, body=${st.elementsBody}, gids=${gidsBody.size}, heap=${Math.round(mu.heapUsed / 1e6)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      }
    }

    // resolution: numerator = distinct cited gids (excluding self) that the
    // corpus holds compiled text for, under ANY of their identities.
    let heldDirect = 0, heldByAlias = 0
    const missing: string[] = []
    for (const gid of gidsBody) {
      if (held.has(gid)) { heldDirect++; continue }
      const ids = identitiesFor(gid, alias)
      if (ids.some(id => id !== gid && held.has(id))) { heldByAlias++; continue }
      missing.push(gid)
    }
    const denom = gidsBody.size
    const resolved = heldDirect + heldByAlias

    // what the misses are, by doctype — a miss is not one thing
    const missByType: Record<string, number> = {}
    for (const g of missing) missByType[g.split('/')[0]] = (missByType[g.split('/')[0]] ?? 0) + 1

    const summary = {
      ...st,
      docsInZip: mine.length,
      sampled: take.length,
      distinctUrisAll: urisAll.size,
      distinctUrisBody: urisBody.size,
      distinctTargetGidsBody: denom,
      resolvedHeldDirect: heldDirect,
      resolvedByAlias: heldByAlias,
      resolvedTotal: resolved,
      resolvedPct: denom ? +(100 * resolved / denom).toFixed(1) : 0,
      missing: missing.length,
      missingByDoctype: Object.fromEntries(Object.entries(missByType).sort((a, b) => b[1] - a[1]).slice(0, 15)),
      elapsedSec: +((Date.now() - t0) / 1000).toFixed(0),
    }
    console.log(`[25h-B] ${type}:`, JSON.stringify(summary, null, 1))
    console.log(`[25h-B] ${type} accounting: elementsTotal(${st.elementsTotal}) = body(${st.elementsBody}) + excluded(${st.elementsExcluded}) ` +
      `| body(${st.elementsBody}) = kept(${st.elementsBody - st.elementsSelf - st.elementsBadUri}) + self(${st.elementsSelf}) + badUri(${st.elementsBadUri})`)
    ;(out.byType as Record<string, unknown>)[type] = summary
  }

  zip.close()
  writeOut('partB', out)
  await endNeonPool()
}

/**
 * ⚠ CLML commentary handles are `key-` + 32 hex — BYTE-IDENTICAL IN SHAPE TO A
 * MAILGUN API KEY. GitHub's push protection rejected this sprint's first push
 * over 128 of them in the exported JSON. They are public legislation.gov.uk
 * identifiers and not secrets, but shipping the token shape is what blocks a
 * commit, so the export redacts the handle and nothing else: every quotable
 * word survives, and the true bytes stay in the database.
 */
const CLML_HANDLE_RX = /key-[0-9a-f]{32}/g

function writeOut(key: string, value: unknown) {
  let doc: Record<string, unknown> = {}
  if (fs.existsSync(OUT_JSON)) { try { doc = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) } catch { doc = {} } }
  doc[key] = value
  doc.generatedAt = new Date().toISOString()
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2).replace(CLML_HANDLE_RX, 'key-REDACTED-CLML-COMMENTARY-HANDLE'))
  console.log(`[25h] wrote ${key} → ${OUT_JSON}`)
}

async function main() {
  const part = (arg('part') ?? 'a').toLowerCase()
  if (part === 'a') await partA(parseInt(arg('sample') ?? '40', 10), arg('profile') ?? 'random')
  else await partB((arg('types') ?? 'ukpga,uksi').split(','), parseInt(arg('limit') ?? '0', 10))
}
// ⚠ Guarded: extract-citation-edges.ts imports ENTRY_RX from this file, and an
// unguarded main() ran the whole audit as a side effect of that import.
if (require.main === module) {
  main().catch(e => { console.error('[25h] FATAL', e); process.exit(1) })
}
