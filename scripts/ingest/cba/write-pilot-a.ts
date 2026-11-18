/**
 * write-pilot-a.ts — BRIEF_INGEST_CBA_1_EXECUTE §2 (decision 326). Writes Pilot A to production:
 * the October 2026 Green Book by PARAGRAPH (+ its 13 HTML tables), the discounting guidance and the
 * optimism-bias guidance, each under a NEW docId so the 89 heading rows of `the-green-book--2` stay
 * until nothing cites them.
 *
 *   npx tsx cba/write-pilot-a.ts             CHECK (default): edition check + read-back identity, no writes
 *   npx tsx cba/write-pilot-a.ts --apply     CHECK, then R2 → Neon, then read every row back from R2
 *   npx tsx cba/write-pilot-a.ts readback    read the written rows back (R2 text vs DB wordCount)
 *
 * ── WHY THE CHECK IS THE GATE ────────────────────────────────────────────────────────────────────
 * 1. SAME EDITION (brief §2). The 391 paragraphs come from the PDF and the 13 tables from the HTML.
 *    A citation that resolves to text from one edition and a table from another never announces
 *    itself, so before any write: (a) the PDF and the HTML publication must both be attachments of
 *    the one gov.uk publication, (b) the PDF's paragraphs must be found in the HTML body, and (c) the
 *    HTML tables' figures must be found in the PDF text. Each is a measured ratio with a floor.
 * 2. WHAT WAS REVIEWED IS WHAT IS WRITTEN. The split is re-run from the publisher's files and the
 *    read-back text is regenerated exactly as `pilot-text.ts` wrote it; it must equal the committed
 *    `docs/ingest_traces/cba1_pilot_readback.txt` byte for byte (CRLF-normalised). A publisher edit or
 *    a splitter change since 4 Nov fails here instead of shipping unreviewed text.
 *
 * ── KEYS ─────────────────────────────────────────────────────────────────────────────────────────
 * The section ref IS the paragraph number (`…:6.58`), not a running sequence, so a later re-cut cannot
 * make an id silently point at a different paragraph (brief §6). Front matter → `front`; the
 * unnumbered annex blocks → a slug of their own words; tables → `table-<the Book's own number>`.
 */
import fs from 'fs'
import path from 'path'
import { pdfToText } from '../shared/compile'
import { splitNumberedParagraphs, htmlTables, dekern, ParaSection } from './numbered-paras'
import { r2Put, r2Get, compiledKey } from '../shared/r2-client'
import { bulkUpsertSections, sectionId, countWords, SectionMeta } from '../shared/db-metadata'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const CORPUS = 'govuk-core-docs'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const TRACE_DIR = path.join(__dirname, '../../../docs/ingest_traces')
const CMD = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'check'
const APPLY = process.argv.includes('--apply')

// The three documents, exactly as pilot-text.ts (keys, cites, URLs, running titles) so the read-back
// regenerates identically — plus the new docId, the display title and the publisher date of record.
const DOCS = [
  { key: 'green-book-2026', cite: 'Green Book', page: 'government/publications/the-green-book--2', html: 'government/publications/the-green-book--2/the-green-book-2026',
    pdf: 'https://assets.publishing.service.gov.uk/media/6ae0ba897b7111c482d80a3b/The_Green_Book_2026.pdf', runningTitle: 'The Green Book',
    docId: 'government/publications/the-green-book-2026-paragraphs', title: 'The Green Book (October 2026)', updated: '2026-10-28T13:30:39' },
  { key: 'gb-discounting', cite: 'Green Book discounting', page: 'government/publications/green-book-supplementary-guidance-discounting', html: null,
    pdf: 'https://assets.publishing.service.gov.uk/media/6ae0b34016428df537606216/Green_Book_supplementary_guidance_-_discounting.pdf', runningTitle: null,
    docId: 'government/publications/green-book-supplementary-guidance-discounting-paragraphs', title: 'Green Book supplementary guidance: discounting (October 2026)', updated: '2026-10-28T13:30:57' },
  { key: 'gb-optimism-bias', cite: 'Green Book optimism bias', page: 'government/publications/green-book-supplementary-guidance-optimism-bias', html: null,
    pdf: 'https://assets.publishing.service.gov.uk/media/5a74dae740f0b65f61322c72/Optimism_bias.pdf', runningTitle: null,
    docId: 'government/publications/green-book-supplementary-guidance-optimism-bias-paragraphs', title: 'Green Book supplementary guidance: optimism bias (April 2013)', updated: '2013-04-21T01:00:00' },
] as const

const FLOOR = { parasInHtml: 0.95, tableFiguresInPdf: 0.95 }

async function getJson(p: string) { const r = await fetch(`https://www.gov.uk/api/content/${p}`, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${p}`); return r.json() }
const norm = (s: string) => dekern(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9£%.]+/g, ' ').replace(/\s+/g, ' ').trim()
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function refOf(s: ParaSection): string {
  if (s.num === '0') return 'front'
  if (/^([A-Z]\.)?\d+(\.\d+)?$/.test(s.num)) return s.num
  return slug(s.num)                                   // "Example 1 (Part 1) – Capital Expenditure" → example-1-part-1-capital-expenditure
}
function tableRef(title: string, i: number): string {
  const m = /^Table\s+([A-Z]\.)?(\d+)\./.exec(title)
  return m ? `table-${m[1] ?? ''}${m[2]}` : `table-x${i + 1}`
}

interface Built { doc: typeof DOCS[number]; metas: SectionMeta[]; texts: string[]; raws: string[]; readback: string[]; checks: string[]; ok: boolean }

async function build(d: typeof DOCS[number]): Promise<Built> {
  const checks: string[] = []
  let ok = true
  const fail = (m: string) => { ok = false; checks.push(`✗ ${m}`) }
  const pass = (m: string) => checks.push(`✓ ${m}`)

  const page = await getJson(d.page)
  if (page.public_updated_at.slice(0, 19) === d.updated) pass(`publisher date unchanged since the 4 Nov review: ${page.public_updated_at}`)
  else fail(`publisher date CHANGED: reviewed ${d.updated}, now ${page.public_updated_at} — re-review the read-back before writing`)
  const pageJson = JSON.stringify(page)
  if (pageJson.includes(d.pdf)) pass(`the PDF is an attachment of ${d.page}`)
  else fail(`the PDF ${d.pdf} is NOT an attachment of ${d.page}`)

  const r = await fetch(d.pdf, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${d.pdf}`)
  const text = (await pdfToText(Buffer.from(await r.arrayBuffer()), d.pdf)) ?? ''
  const split = splitNumberedParagraphs(text, d.runningTitle)
  const tables = d.html ? htmlTables((await getJson(d.html)).details.body) : []

  // Read-back text, regenerated exactly as pilot-text.ts writes it.
  const readback = [`\n######## ${d.key} — ${d.pdf}`]
  for (const s of split.sections) readback.push(`\n[${d.cite} ${s.num}] ${s.path.join(' › ')}\n${s.text}`)
  for (const t of tables) readback.push(`\n[${d.cite} — ${t.title}]\n${t.text}`)

  // Same-edition check, only where there are two renderings.
  if (d.html) {
    if (pageJson.includes(`/${d.html}`)) pass(`the HTML publication /${d.html} is an attachment of the same publication`)
    else fail(`the HTML publication /${d.html} is NOT an attachment of ${d.page}`)
    const htmlPage = await getJson(d.html)
    const html = norm(htmlPage.details.body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’'))
    const paras = split.sections.filter(s => s.num !== '0')
    let head = 0, tail = 0
    const missed: string[] = []
    const tailMissed: string[] = []
    for (const s of paras) {
      const w = norm(s.text).replace(/^[•·\-–\s]+/, '').split(' ').filter(Boolean)
      const h = w.slice(0, 10).join(' '), t = w.slice(-8).join(' ')
      const hi = html.includes(h), ti = html.includes(t)
      if (hi) head++; if (ti) tail++
      if (!hi && missed.length < 6) missed.push(`${s.num} "${h}"`)
      if (!ti && tailMissed.length < 8) tailMissed.push(`${s.num} "…${t}"`)
    }
    if (tailMissed.length) checks.push(`  closing not found (first ${tailMissed.length}): ${tailMissed.join(' | ')}`)
    const hr = head / paras.length, tr = tail / paras.length
    const msg = `PDF paragraphs found in the HTML body: opening 10 words ${head}/${paras.length} (${(100 * hr).toFixed(1)}%), closing 8 words ${tail}/${paras.length} (${(100 * tr).toFixed(1)}%); floor ${100 * FLOOR.parasInHtml}%`
    if (hr >= FLOOR.parasInHtml && tr >= FLOOR.parasInHtml) pass(msg); else fail(msg)
    if (missed.length) checks.push(`  opening not found (first ${missed.length}): ${missed.join(' | ')}`)

    const pdfFlat = dekern(text).replace(/\s+/g, '')
    let figs = 0, found = 0
    const figMiss: string[] = []
    for (const t of tables) {
      for (const tok of t.text.split('\n').slice(1).join(' ').match(/£?\d[\d,]*(\.\d+)?%?/g) ?? []) {
        if (tok.replace(/[£%,.]/g, '').length < 2) continue
        figs++
        if (pdfFlat.includes(tok)) found++
        else if (figMiss.length < 6) figMiss.push(`${t.title.slice(0, 12)}: ${tok}`)
      }
    }
    const fr = figs ? found / figs : 1
    const fmsg = `HTML table figures found in the PDF text: ${found}/${figs} (${(100 * fr).toFixed(1)}%); floor ${100 * FLOOR.tableFiguresInPdf}%`
    if (fr >= FLOOR.tableFiguresInPdf) pass(fmsg); else fail(fmsg)
    if (figMiss.length) checks.push(`  not found (first ${figMiss.length}): ${figMiss.join(' | ')}`)
    const oct = (s: string) => (s.match(/october 2026/gi) ?? []).length
    checks.push(`  "October 2026" occurs ${oct(text)}× in the PDF text, ${oct(htmlPage.details.body)}× in the HTML body; HTML public_updated_at ${htmlPage.public_updated_at}`)
  }

  // Rows.
  const metas: SectionMeta[] = []
  const texts: string[] = []
  const raws: string[] = []
  const itemDate = d.updated.slice(0, 10)
  const seen = new Set<string>()
  const add = (ref: string, body: string, title: string, sourceUrl: string, format: SectionMeta['format'], raw: string) => {
    raws.push(raw)
    if (seen.has(ref)) throw new Error(`${d.key}: duplicate ref ${ref}`)
    seen.add(ref)
    metas.push({
      id: sectionId(CORPUS, d.docId, ref), corpus: CORPUS, sourceUrl, r2Key: compiledKey(CORPUS, d.docId, ref),
      wordCount: countWords(body), status: 'compiled', format, sectionTitle: title, itemDate, parentDocId: d.docId,
      notes: `cba1x: split by paragraph number (cba/numbered-paras.ts); reviewed read-back docs/ingest_traces/cba1_pilot_readback.txt; publication ${d.page}`,
    })
    texts.push(body)
  }
  for (const s of split.sections) {
    const ref = refOf(s)
    const label = s.num === '0' ? 'front matter' : /^([A-Z]\.)?\d/.test(s.num) ? `paragraph ${s.num}` : s.num
    add(ref, `${d.title}, ${label}\n${s.path.length ? s.path.join(' › ') + '\n' : ''}${s.text}`,
      `${d.title} › ${[...s.path, s.num === '0' ? 'Front matter' : s.num].join(' › ')}`, d.pdf, 'pdf', s.text)
  }
  tables.forEach((t, i) => add(tableRef(t.title, i), `${d.title}, ${t.title}\n${t.text}`, `${d.title} › ${t.title}`, `https://www.gov.uk/${d.html}`, 'html', t.text))
  return { doc: d, metas, texts, raws, readback, checks, ok }
}

async function main() {
  const pool = getNeonPool()
  console.log(`[cba1x] db host ${new URL(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL!).host} | mode ${CMD}${APPLY ? ' --apply' : ''}`)
  if (CMD === 'readback') return readback(pool)
  if (CMD === 'verify-existing') return verifyExisting(pool)

  const built: Built[] = []
  for (const d of DOCS) {
    const b = await build(d)
    built.push(b)
    console.log(`\n== ${d.key} → ${d.docId}: ${b.metas.length} rows (${b.metas.filter(m => m.format === 'html').length} tables)`)
    for (const c of b.checks) console.log('   ' + c)
  }
  const committed = fs.readFileSync(path.join(TRACE_DIR, 'cba1_pilot_readback.txt'), 'utf8').replace(/\r\n/g, '\n')
  const regenerated = built.flatMap(b => b.readback).join('\n')
  let identical = committed === regenerated
  if (identical) console.log(`\n✓ regenerated read-back is byte-identical to the committed cba1_pilot_readback.txt (${committed.length.toLocaleString()} chars)`)
  else {
    let i = 0; while (i < committed.length && committed[i] === regenerated[i]) i++
    console.log(`\n✗ read-back DIFFERS from the reviewed file at char ${i}: committed «${committed.slice(i, i + 120)}» vs now «${regenerated.slice(i, i + 120)}»`)
  }
  const all = built.flatMap(b => b.metas)
  const before = await pool.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1`, [CORPUS])
  const clash = await pool.query(`SELECT count(*)::int n FROM corpus_sections WHERE corpus=$1 AND "parentDocId" = ANY($2)`, [CORPUS, DOCS.map(d => d.docId)])
  console.log(`\n${CORPUS}: ${before.rows[0].n} rows now; ${clash.rows[0].n} already under the three new docIds; this run would write ${all.length}`)

  const allOk = identical && built.every(b => b.ok)
  if (!APPLY) { console.log(`\nCHECK ${allOk ? 'PASSED' : 'FAILED'} — nothing written (pass --apply to write).`); await endNeonPool(); return }
  if (!allOk) { console.log('\nREFUSED: a check failed, so nothing is written.'); await endNeonPool(); process.exit(1) }
  // ⚠ 18 Nov: Pilot A was ALREADY written on 14 Nov 02:16 UTC (468 rows, SEQUENCE refs `…:1`…`:404`) by a
  // session whose code is not in this tree. This run keys by paragraph number, so --apply on top would add a
  // second, differently keyed copy of every section. Refuse while any row exists under the three docIds.
  if (clash.rows[0].n > 0) { console.log(`\nREFUSED: ${clash.rows[0].n} rows already exist under the three docIds (14 Nov write). Use verify-existing.`); await endNeonPool(); process.exit(1) }

  // R2 before Neon.
  const texts = built.flatMap(b => b.texts)
  for (let i = 0; i < all.length; i += 8) await Promise.all(all.slice(i, i + 8).map((m, j) => r2Put(m.r2Key!, texts[i + j])))
  console.log(`R2: ${all.length} objects put`)
  const n = await bulkUpsertSections(all)
  console.log(`Neon: ${n} rows upserted`)
  // Work list for the vector catch-up (v33-vec-catchup.ts --run cba1x): exactly these ids.
  fs.writeFileSync(path.join(__dirname, '../cba1x-vec-delta.jsonl'), all.map(m => JSON.stringify({ id: m.id, corpus: CORPUS, wordCount: m.wordCount })).join('\n') + '\n')
  console.log(`wrote scripts/ingest/cba1x-vec-delta.jsonl (${all.length} ids)`)
  await readback(pool)
}

async function readback(pool: ReturnType<typeof getNeonPool>) {
  const { rows } = await pool.query<{ id: string; r2Key: string; wordCount: number; status: string; parentDocId: string; licence: string | null }>(
    `SELECT id, "r2Key", "wordCount", status, "parentDocId", licence FROM corpus_sections WHERE corpus=$1 AND "parentDocId" = ANY($2) ORDER BY id`, [CORPUS, DOCS.map(d => d.docId)])
  let missing = 0, wcBad = 0, empty = 0
  const per: Record<string, number> = {}
  const licences: Record<string, number> = {}
  for (let i = 0; i < rows.length; i += 16) {
    await Promise.all(rows.slice(i, i + 16).map(async r => {
      per[r.parentDocId] = (per[r.parentDocId] ?? 0) + 1
      licences[r.licence ?? 'NULL'] = (licences[r.licence ?? 'NULL'] ?? 0) + 1
      const t = await r2Get(r.r2Key)
      if (t == null) { missing++; return }
      if (!t.trim()) empty++
      if (countWords(t) !== r.wordCount) wcBad++
    }))
  }
  console.log(`\nREADBACK: ${rows.length} rows; R2 missing ${missing}, empty ${empty}, wordCount≠R2 ${wcBad}; status ${[...new Set(rows.map(r => r.status))].join(',')}; licence ${JSON.stringify(licences)}`)
  for (const [k, v] of Object.entries(per)) console.log(`  ${k}: ${v}`)
  for (const probe of ['the-green-book-2026-paragraphs:6.58', 'the-green-book-2026-paragraphs:A.1', 'the-green-book-2026-paragraphs:table-8', 'discounting-paragraphs:3.8', 'optimism-bias-paragraphs:3.1']) {
    const r = rows.find(x => x.id.endsWith(probe))
    const t = r ? await r2Get(r.r2Key) : null
    console.log(`  ${probe}: ${t ? t.replace(/\s+/g, ' ').slice(0, 200) : 'NOT FOUND'}`)
  }
  await endNeonPool()
}

/** The rows written on 14 Nov (sequence refs, by a session whose code is not in this tree): does each
 *  hold exactly one reviewed section's text, and which? Matching is on the normalised section text
 *  being contained in the stored body (the stored body adds its own title prefix). Read-only. */
async function verifyExisting(pool: ReturnType<typeof getNeonPool>) {
  const out: { key: string; ref: string; id: string | null; words: number }[] = []
  let unmatched = 0, ambiguous = 0, storedUnclaimed = 0
  for (const d of DOCS) {
    const b = await build(d)
    const { rows } = await pool.query<{ id: string; r2Key: string; sectionTitle: string }>(`SELECT id, "r2Key", "sectionTitle" FROM corpus_sections WHERE corpus=$1 AND "parentDocId"=$2`, [CORPUS, d.docId])
    const stored = await Promise.all(rows.map(async r => ({ ...r, body: norm((await r2Get(r.r2Key)) ?? '') })))
    const claimed = new Set<string>()
    b.metas.forEach((m, i) => {
      const ref = m.id.slice(m.id.lastIndexOf(':') + 1)
      const want = norm(b.raws[i])
      const hits = stored.filter(s => s.body.endsWith(want) || s.body.includes(want))
      // Prefer the exact-length match where a short paragraph is contained in a longer one.
      const best = hits.length > 1 ? hits.filter(s => s.body.length - want.length < 160) : hits
      if (best.length === 1) { claimed.add(best[0].id); out.push({ key: d.key, ref, id: best[0].id, words: m.wordCount! }) }
      else { if (best.length === 0) unmatched++; else ambiguous++; out.push({ key: d.key, ref, id: null, words: m.wordCount! }); if (unmatched + ambiguous <= 8) console.log(`  ${d.key} ${ref}: ${best.length} stored rows match`) }
    })
    const unc = stored.filter(s => !claimed.has(s.id))
    storedUnclaimed += unc.length
    for (const u of unc.slice(0, 4)) console.log(`  stored row claimed by no reviewed section: ${u.id} | ${u.sectionTitle}`)
    console.log(`== ${d.key}: reviewed ${b.metas.length}, stored ${rows.length}, matched one-to-one ${b.metas.length - out.filter(o => o.key === d.key && !o.id).length}`)
  }
  console.log(`\nVERIFY-EXISTING: unmatched ${unmatched}, ambiguous ${ambiguous}, stored rows unclaimed ${storedUnclaimed}`)
  fs.writeFileSync(path.join(TRACE_DIR, 'cba1x_existing_map.json'), JSON.stringify(out, null, 1))
  console.log('WROTE docs/ingest_traces/cba1x_existing_map.json')
  await endNeonPool()
}

main().catch(e => { console.error('[cba1x] FATAL', e instanceof Error ? e.stack ?? e.message : e); process.exit(1) })
