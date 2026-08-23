/**
 * audit-section-titles.ts — INGEST-LABELS §4.1. DOES THE STORED TITLE DESCRIBE THE STORED BODY?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE ADJUDICATOR IS THE SOURCE AND NOT A JUDGEMENT CALL
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "Does this title correspond to this body?" read by hand over 200 sections is 200 opinions. It is
 * also unnecessary: legislation.gov.uk publishes the heading itself, and for a section it is
 * exactly one thing — the `<Title>` of the `<P1group>` that directly wraps `<P1 id="section-N">`.
 * So the comparison is stored-title vs published-heading, which is a fact, and the error rate is
 * counted rather than adjudicated.
 *
 * ⚠ THE HEADING IS NOT IN WHAT WE STORE. `corpus_sections.r2RawKey` holds the bare `<P1>` — the
 * writer kept the provision and discarded the `<P1group>` wrapper the heading lives in. Verified on
 * four sections across three collections: every stored raw begins `<P1 …><Pnumber>`, no `<Title>`.
 * So this audit must FETCH, and so must any fix. That is the same family as the case-law stylesheet
 * (the value was in the response and the writer threw it away) but with the opposite consequence:
 * there, the text was recoverable from R2 for £0; here it is not.
 *
 * ⚠ THE URL IS DERIVED, NOT READ. `corpus_sections.sourceUrl` on the legislation corpora is known
 * to 404 (it pastes the hyphenated ref token onto the act URL — lib/lex/legislation-url.ts). This
 * builds `{gid}/{unit}/{num}/data.xml` from the id, and reports any non-200 rather than scoring it.
 *
 * SAMPLING. Random over rows that HAVE a stored title, per collection — that is the population the
 * question is about. The proportion of rows with NO title is reported separately and is not mixed
 * into the error rate; they are different defects with different fixes.
 *
 * CLASSIFICATION, per sampled section:
 *   match              stored title == published heading (normalised)
 *   MISMATCH           both exist and differ
 *   no-heading-source  the source publishes no P1group Title for this unit (common for SI articles)
 *   fetch-failed       non-200 / no P1 found — reported, never scored as either
 *
 * And for every MISMATCH it asks the shape question: is the stored title a real heading of some
 * OTHER unit of the SAME instrument (a displacement), or foreign to the instrument entirely? That
 * is answered from the legacy table for free, no extra fetch.
 *
 * Politeness: TNA 429'd a 200ms sweep in V19; the playbook says halve, so the floor is 500ms.
 *
 * Usage:
 *   tsx labels/audit-section-titles.ts --n 60 [--out docs/label_audit.json]
 *   tsx labels/audit-section-titles.ts --ids <id>,<id>      # named sections, for a spot check
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

const arg = (k: string): string | null => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const N_PER = arg('n') ? parseInt(arg('n')!, 10) : 60
const OUT = arg('out') ?? path.join(__dirname, '../../../docs/label_audit.json')
const IDS = arg('ids')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
const THROTTLE = parseInt(process.env.TNA_THROTTLE_FLOOR_MS!, 10)

const COLLECTIONS = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010']
const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org; section-heading label audit)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Normalise for comparison: the question is whether it is the same heading, not the same bytes. */
function norm(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/[‘’“”]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase()
    .replace(/[.,;:]+$/, '')
}

/**
 * The heading of `<P1 id="{unitId}">` = the `<Title>` of the `<P1group>` directly wrapping it.
 *
 * ⚠ Walked as a tag stream rather than matched with one regex. `<Title>` also appears on `Part`,
 * `Chapter`, `Pblock` (crossheading) and `P2group` (a heading INSIDE the section), and the nearest
 * preceding `<Title>` is the `Pblock` crossheading about as often as it is the right answer. Taking
 * the innermost OPEN P1group at the moment the P1 opens is the only reading that cannot pick up a
 * sibling's or a child's heading.
 */
function headingFor(xml: string, unitId: string): { heading: string | null; found: boolean } {
  const re = /<(\/?)(P1group|P1|Title|Pblock|Part|Chapter|P2group)(\s[^>]*?)?(\/?)>/g
  const stack: Array<{ name: string; title: string | null }> = []
  let m: RegExpExecArray | null
  let pendingTitleFor: { name: string; title: string | null } | null = null
  while ((m = re.exec(xml))) {
    const [, close, name, attrs, selfClose] = m
    if (name === 'Title') {
      if (!close && stack.length) {
        // capture the text of this Title and attach it to the innermost open element
        const end = xml.indexOf('</Title>', m.index)
        if (end > 0) {
          const text = xml.slice(m.index + m[0].length, end).replace(/<[^>]*>/g, '')
          const owner = stack[stack.length - 1]
          if (owner.title === null) owner.title = text
        }
      }
      continue
    }
    if (close) { stack.pop(); continue }
    if (selfClose) continue
    if (name === 'P1') {
      const idm = /\bid="([^"]+)"/.exec(attrs ?? '')
      if (idm && idm[1] === unitId) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === 'P1group') return { heading: stack[i].title, found: true }
        }
        return { heading: null, found: true }
      }
      stack.push({ name, title: null })
      continue
    }
    stack.push({ name, title: null })
  }
  void pendingTitleFor
  return { heading: null, found: false }
}

interface Row { id: string; corpus: string; sectionTitle: string; wordCount: number }
interface Result {
  id: string; corpus: string; gid: string; ref: string; unit: string; num: string
  stored: string; published: string | null
  verdict: 'match' | 'MISMATCH' | 'no-heading-source' | 'fetch-failed'
  detail?: string
  displaced?: 'same-instrument' | 'foreign' | null
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 2,
    statement_timeout: 900_000, query_timeout: 900_000,
  })

  // Population figures FIRST, so every rate below is a proportion of something stated.
  const { rows: pop } = await pool.query(`
    SELECT corpus,
           count(*)::int rows,
           count(*) FILTER (WHERE "sectionTitle" IS NOT NULL)::int titled
      FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1 ORDER BY 1`, [COLLECTIONS])

  let sample: Row[] = []
  if (IDS) {
    const { rows } = await pool.query<Row>(
      `SELECT id, corpus, "sectionTitle", "wordCount" FROM corpus_sections WHERE id = ANY($1::text[])`, [IDS])
    sample = rows
  } else {
    for (const c of COLLECTIONS) {
      // TABLESAMPLE would be cheaper but is block-biased; this table is large enough that an
      // ORDER BY random() over the titled subset is affordable and is genuinely uniform.
      const { rows } = await pool.query<Row>(`
        SELECT id, corpus, "sectionTitle", "wordCount" FROM corpus_sections
         WHERE corpus = $1 AND "sectionTitle" IS NOT NULL
           AND (split_part(id,':',3) ~ '^section-[0-9]+$' OR split_part(id,':',3) ~ '^article-[0-9]+$')
         ORDER BY random() LIMIT $2`, [c, N_PER])
      sample.push(...rows)
    }
  }
  console.log(`[audit] sampling ${sample.length} rows across ${COLLECTIONS.length} collections, throttle ${THROTTLE}ms`)

  const results: Result[] = []
  let i = 0
  for (const r of sample) {
    i++
    const gid = r.id.split(':')[1]
    const ref = r.id.split(':').slice(2).join(':')
    const mm = /^(section|article)-([0-9A-Za-z]+)$/.exec(ref)
    if (!mm) { results.push({ id: r.id, corpus: r.corpus, gid, ref, unit: '', num: '', stored: r.sectionTitle, published: null, verdict: 'fetch-failed', detail: 'unparsable ref' }); continue }
    const [, unit, num] = mm
    const url = `https://www.legislation.gov.uk/${gid}/${unit}/${num}/data.xml`

    let xml: string | null = null
    let detail: string | undefined
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/xml' } })
      if (res.ok) xml = await res.text()
      else detail = `HTTP ${res.status}`
    } catch (e) { detail = `fetch threw: ${(e as Error).message}` }
    await sleep(THROTTLE)

    if (!xml) { results.push({ id: r.id, corpus: r.corpus, gid, ref, unit, num, stored: r.sectionTitle, published: null, verdict: 'fetch-failed', detail }); continue }

    const { heading, found } = headingFor(xml, ref)
    if (!found) { results.push({ id: r.id, corpus: r.corpus, gid, ref, unit, num, stored: r.sectionTitle, published: null, verdict: 'fetch-failed', detail: `no <P1 id="${ref}"> in response` }); continue }
    if (heading == null) { results.push({ id: r.id, corpus: r.corpus, gid, ref, unit, num, stored: r.sectionTitle, published: null, verdict: 'no-heading-source' }); continue }

    const verdict = norm(heading) === norm(r.sectionTitle) ? 'match' : 'MISMATCH'
    results.push({ id: r.id, corpus: r.corpus, gid, ref, unit, num, stored: r.sectionTitle, published: heading, verdict })
    if (i % 25 === 0) console.log(`  … ${i}/${sample.length}`)
  }

  // Shape: is a mismatched title a real heading of ANOTHER unit of the same instrument?
  // Answered from the legacy table, which is where the wrong titles came from — no extra fetch.
  const mism = results.filter(r => r.verdict === 'MISMATCH')
  for (const r of mism) {
    const { rows } = await pool.query(`
      SELECT count(*)::int n FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
       WHERE li."legislationGovUkId" = $1 AND lower(btrim(ls."sectionTitle")) = lower(btrim($2))`,
      [r.gid, r.stored])
    r.displaced = rows[0].n > 0 ? 'same-instrument' : 'foreign'
  }
  await pool.end()

  const byCorpus: Record<string, Record<string, number>> = {}
  for (const r of results) {
    const b = (byCorpus[r.corpus] ??= { match: 0, MISMATCH: 0, 'no-heading-source': 0, 'fetch-failed': 0 })
    b[r.verdict]++
  }

  fs.writeFileSync(OUT, JSON.stringify({
    generated: new Date().toISOString(), n_per_collection: N_PER,
    population: pop, byCorpus, results,
  }, null, 1))

  console.log('\n=== §4.1 — STORED TITLE vs THE SOURCE\'S PUBLISHED HEADING ===\n')
  console.log('collection                 titled rows / all rows      sampled  match  MISMATCH  no-heading  failed   error rate')
  for (const c of COLLECTIONS) {
    const p = pop.find(x => x.corpus === c)!
    const b = byCorpus[c] ?? { match: 0, MISMATCH: 0, 'no-heading-source': 0, 'fetch-failed': 0 }
    const scored = b.match + b.MISMATCH
    console.log(
      `${c.padEnd(24)} ${String(p.titled).padStart(8)} / ${String(p.rows).padStart(8)} ` +
      `${String((p.titled / p.rows * 100).toFixed(1) + '%').padStart(7)}  ` +
      `${String(scored + b['no-heading-source'] + b['fetch-failed']).padStart(6)} ` +
      `${String(b.match).padStart(6)} ${String(b.MISMATCH).padStart(9)} ` +
      `${String(b['no-heading-source']).padStart(11)} ${String(b['fetch-failed']).padStart(7)}   ` +
      `${scored ? (100 * b.MISMATCH / scored).toFixed(1) + '%' : '—'}  (of ${scored} scored)`)
  }
  const allScored = results.filter(r => r.verdict === 'match' || r.verdict === 'MISMATCH')
  const allMis = allScored.filter(r => r.verdict === 'MISMATCH')
  console.log(`\nOVERALL: ${allMis.length} of ${allScored.length} scored are MISMATCHES = ` +
    `${allScored.length ? (100 * allMis.length / allScored.length).toFixed(1) : '—'}%`)
  console.log(`  of those mismatches: same-instrument displacement ${allMis.filter(r => r.displaced === 'same-instrument').length}, ` +
    `foreign ${allMis.filter(r => r.displaced === 'foreign').length}`)

  console.log('\n--- first 15 mismatches ---')
  for (const r of allMis.slice(0, 15)) {
    console.log(`\n${r.id}  [${r.displaced}]`)
    console.log(`   stored:    ${r.stored}`)
    console.log(`   published: ${r.published}`)
  }
  const failed = results.filter(r => r.verdict === 'fetch-failed')
  if (failed.length) {
    console.log(`\n--- ${failed.length} not scored (reported, never counted either way) ---`)
    for (const r of failed.slice(0, 10)) console.log(`   ${r.id}  ${r.detail}`)
  }
  console.log(`\n[audit] → ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
