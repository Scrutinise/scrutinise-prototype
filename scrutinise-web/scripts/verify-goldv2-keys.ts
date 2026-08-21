/**
 * verify-goldv2-keys.ts — READ EVERY GOLD v2 ANSWER KEY BACK OUT OF THE CORPUS.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. `BRIEF_GOLD_V2.md` §1 trap 2: *"Four of the first ten case-law keys were wrong,
 * including the same judgment offered as the answer to two unrelated questions. Every key must be
 * verified by reading the document back out of `corpus_sections` and confirming it answers the
 * question. Print the confirming line in the file."*
 *
 * ⚠ A KEY THAT EXISTS IS NOT A KEY THAT ANSWERS. S8 could only get half way — `tna-caselaw` rows
 * have no title, so it could confirm a citation was PRESENT and had to assert the SUBJECT from
 * outside knowledge, which is exactly where the four wrong keys came from. Debates and legislation
 * do not have that problem: both carry real titles, and the body is in R2. So every key in this set
 * gets both halves, and the confirming extract is printed into the candidates file where Charlie
 * can see the document rather than take my word for it.
 *
 * ⚠⚠ IT READS THE DATABASE AND R2 DIRECTLY, NEVER `runSearch()`. §1 trap 4: keying a question on
 * whatever retrieval returns for it makes recall 100% by construction and measures nothing.
 *
 * Usage:  npx tsx --env-file=.env scripts/verify-goldv2-keys.ts [--chars 240]
 */
import { Pool } from 'pg'
import { r2Get } from '../../scripts/ingest/shared/r2-client'

export {}

const CHARS = (() => {
  const i = process.argv.indexOf('--chars')
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 240
})()

/** Every key in `docs/GOLD_CANDIDATES_V2.md`, with what it is CLAIMED to show. The claim is written
 *  here so the printed extract can be read against it — an extract with no claim beside it invites
 *  the reader to rationalise whatever comes back. */
const KEYS: Array<{ q: string; id: string; claim: string }> = [
  // ── DEBATES ────────────────────────────────────────────────────────────────────────────────
  { q: 'Q1', id: 'pwdata-debates:debates2024-11-29d:3', claim: 'Leadbeater opening the Commons 2R FOR assisted dying' },
  { q: 'Q1', id: 'pwdata-debates:debates2024-11-29d:78', claim: 'Kruger arguing AGAINST, same debate' },
  { q: 'Q2', id: 'pwdata-lords:daylord2025-09-12c:4', claim: 'Falconer opening the Lords second reading' },
  { q: 'Q3', id: 'niassembly-hansard:286438:151', claim: 'the RHI "cash for ash" ministerial statement, Stormont' },
  // ⚠ WITHDRAWN, and kept here as evidence rather than deleted: these two were keyed as the Senedd
  // 20mph debate on their TITLE and their BODIES are about oesophageal and stomach cancers. See the
  // Senedd heading finding in GOLD_CANDIDATES_V2.md. They are printed so the defect is reproducible.
  { q: 'WITHDRAWN', id: 'senedd-cofnod:13683:322', claim: '⚠ CLAIMED 20mph — EXPECT A CANCER DEBATE (title is wrong)' },
  { q: 'WITHDRAWN', id: 'senedd-cofnod:13683:328', claim: '⚠ CLAIMED 20mph — EXPECT A CANCER DEBATE (title is wrong)' },
  { q: 'Q3b', id: 'senedd-cofnod:13683:153', claim: 'a speech that IS about the 20mph limit — but in Welsh' },
  { q: 'Q4', id: 'pwdata-westminster:westminster2022-04-21a:27', claim: 'Westminster Hall debate on the two-child limit, 2022' },
  { q: 'Q4', id: 'pwdata-westminster:westminster2018-11-27c:55', claim: 'earlier two-child limit debate, 2018' },
  { q: 'Q5', id: 'pwdata-lords:daylord2024-05-13a:113', claim: 'Lords 2R on quashing Horizon convictions' },
  { q: 'Q6', id: 'historic-hansard:S5LV0198P0:1798', claim: 'Lords debating abolition of the death penalty, 1956' },
  { q: 'Q6', id: 'historic-hansard:S5LV0306P0:1905', claim: 'Lords on making abolition permanent, 1969' },
  { q: 'Q7', id: 'pwdata-lords:daylord2012-04-30a:76', claim: 'Lords on the draft House of Lords Reform Bill' },
  { q: 'Q8', id: 'scottish-parliament-or:14066:193', claim: 'MSP at Stage 3 of the Gender Recognition Reform Bill' },
  { q: 'Q9', id: 'pwdata-debates:debates2022-12-15b:298', claim: 'Commons on prepayment meters and self-disconnection' },
  { q: 'Q10', id: 'pwdata-debates:debates2024-12-02c:452', claim: 'minister at the despatch box on the Grenfell Inquiry' },
  { q: 'Q11', id: 'pwdata-debates:debates2025-03-26b:130', claim: 'the Chancellor delivering the Spring Statement 2025' },
  // ── LEGISLATION ────────────────────────────────────────────────────────────────────────────
  { q: 'Q12', id: 'primary-acts-pre-2000:ukpga/1988/50:section-21', claim: 'the no-fault eviction power, Housing Act 1988 s.21' },
  { q: 'Q13', id: 'primary-acts-2000plus:ukpga/2025/26:section-146', claim: 'Renters’ Rights Act 2025 converting existing assured tenancies' },
  { q: 'Q13', id: 'primary-acts-2000plus:ukpga/2025/26:section-147', claim: 'Renters’ Rights Act 2025 on fixed-term/periodic tenancies' },
  { q: 'Q14', id: 'primary-acts-2000plus:ukpga/2010/15:section-20', claim: 'Equality Act 2010 duty to make reasonable adjustments' },
  { q: 'Q15', id: 'primary-acts-pre-2000:ukpga/1988/9:section-28', claim: 'the repealed "Section 28"' },
  { q: 'Q16', id: 'si-2010plus:uksi/2020/971:regulation-2', claim: 'what the plastic straw regulations actually prohibit' },
  { q: 'Q16', id: 'si-2010plus:uksi/2020/971:regulation-20', claim: 'plastic straws regulations, further provision' },
  { q: 'Q17', id: 'regional:ssi/2024/127:article-2', claim: 'continuation of Scottish minimum unit pricing' },
  { q: 'Q18', id: 'primary-acts-pre-2000:ukpga/1985/70:section-11', claim: 'landlord repairing obligation, damp and disrepair' },
  { q: 'Q19', id: 'primary-acts-2000plus:ukpga/2006/28:section-2', claim: 'smoke-free premises, the pub smoking ban' },
  { q: 'Q19', id: 'primary-acts-2000plus:ukpga/2006/28:section-3', claim: 'smoke-free premises exemptions' },
  { q: 'Q20', id: 'primary-acts-2000plus:ukpga/2023/50:section-12', claim: 'Online Safety Act children’s safety duties' },
  { q: 'Q21', id: 'primary-acts-2000plus:ukpga/2018/12:section-45', claim: 'Data Protection Act 2018 right of access' },
]

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 3, statement_timeout: 300_000,
  })

  console.log('='.repeat(110))
  console.log('GOLD v2 — EVERY KEY READ BACK OUT OF THE CORPUS')
  console.log('='.repeat(110))
  console.log(`  ${KEYS.length} keys. DB + R2 only; runSearch() is never called (BRIEF_GOLD_V2 §1 trap 4).\n`)

  let present = 0, bodyOk = 0, missing = 0
  const lines: string[] = []

  for (const k of KEYS) {
    const { rows } = await pool.query<{
      id: string; corpus: string; sectionTitle: string | null; speaker: string | null
      itemDate: string | null; wordCount: number | null; r2Key: string | null; status: string
    }>(`SELECT id, corpus, "sectionTitle", speaker, "itemDate"::text AS "itemDate",
               "wordCount", "r2Key", status
          FROM corpus_sections WHERE id = $1`, [k.id])

    if (!rows.length) {
      missing++
      console.log(`❌ ${k.q.padEnd(4)} ABSENT FROM THE CORPUS  ${k.id}`)
      console.log(`        claimed: ${k.claim}`)
      lines.push(`${k.q}\t${k.id}\tABSENT\t`)
      continue
    }
    const r = rows[0]
    present++

    let extract = ''
    if (r.r2Key) {
      try {
        const body = await r2Get(r.r2Key)
        if (body) { extract = squash(body).slice(0, CHARS); bodyOk++ }
      } catch (e) { extract = `(R2 read failed: ${(e as Error).message})` }
    }

    console.log(`✅ ${k.q.padEnd(4)} ${r.id}`)
    console.log(`        ${r.corpus} · ${r.itemDate ?? 'no date'} · ${r.wordCount ?? '?'}w${r.speaker ? ' · ' + r.speaker : ''}`)
    console.log(`        title:   ${r.sectionTitle ?? '(none)'}`)
    console.log(`        claimed: ${k.claim}`)
    console.log(`        body:    “${extract || '(no body read)'}…”`)
    lines.push([k.q, r.id, r.sectionTitle ?? '', r.speaker ?? '', r.itemDate ?? '', extract].join('\t'))
  }

  console.log('\n' + '='.repeat(110))
  console.log(`present in corpus_sections: ${present}/${KEYS.length}  ·  body read from R2: ${bodyOk}/${KEYS.length}  ·  ABSENT: ${missing}`)
  console.log('='.repeat(110))
  if (missing) console.log('⚠ An absent key is NOT a question. Replace it or record it as a corpus gap (BRIEF_GOLD_V2 §1 trap 3).')

  await pool.end()
  process.exit(missing ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
