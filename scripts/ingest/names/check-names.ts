/**
 * check-names.ts — the sprint's standing check. BRIEF_INGEST_NAMES §3.
 *
 * Every assertion is paired with a NEGATIVE CONTROL that must fail on broken input — a check that
 * has only ever been seen passing is not a check. The LIVE half reads the numbers back off Neon
 * rather than trusting a sweep's own tally.
 *
 *   npx tsx scripts/ingest/names/check-names.ts
 */
import { namesPool, endNamesPool } from './names-pool'
import {
  nameFromAkn, nameFromCompiledText, isCitationShaped, firstWords, stripAknPreamble,
} from '../shared/caselaw-name'
import {
  witnessName, attributeWritten, attributeOral, attributePublication, dedupeJoin,
} from '../shared/committee-attribution'

type Case = { name: string; run: () => boolean | Promise<boolean> }

const ORG = { submitterType: 'Organisation', name: null, organisations: [{ name: 'International Alert' }] }
const IND = { submitterType: 'Individual', name: 'Mikaela Gavas', organisations: [{ name: 'CGD' }] }

const UNIT: Case[] = [
  // ── case-law names ──────────────────────────────────────────────────────────────────────────
  { name: 'FRBRname is read from the AKN',
    run: () => nameFromAkn('<FRBRname value="Mensah v Jones"/>')?.title === 'Mensah v Jones' },
  { name: 'the route on a fetched name is `source`, never `parsed`',
    run: () => nameFromAkn('<FRBRname value="A v B"/>')?.route === 'source' },
  { name: 'NEG: no FRBRname yields null, not a placeholder',
    run: () => nameFromAkn('<akomaNtoso/>') === null },
  { name: 'NEG: an empty FRBRname is a miss, not an empty title',
    run: () => nameFromAkn('<FRBRname value="   "/>') === null },
  { name: 'NEG: a citation is refused as a name',
    run: () => isCitationShaped('[2015] EWHC 1842 (Fam)') && isCitationShaped('EWHC 2021 123') },
  { name: 'a real case name is not refused',
    run: () => !isCitationShaped('Mensah v Jones') && !isCitationShaped('K (Children), Re') },
  { name: 'entities are decoded through the SHARED decoder',
    run: () => nameFromAkn('<FRBRname value="X &amp; Y v Z"/>')?.title === 'X & Y v Z' },
  { name: 'the parsed fallback labels itself parsed:v1',
    run: () => nameFromCompiledText(
      '#judgment .a { font-size: 1pt; } Between : ACME LTD Claimant - and - J SMITH Defendant')?.route === 'parsed:v1' },
  { name: 'NEG: the parsed fallback refuses text it cannot read',
    run: () => nameFromCompiledText('#judgment .a { font-size: 1pt; } no party line here at all') === null },

  // ── the AKN CSS preamble ────────────────────────────────────────────────────────────────────
  { name: 'the CSS preamble is stripped',
    run: () => firstWords('#judgment .N { font-size: 12pt; } Neutral Citation Number', 4) === 'Neutral Citation Number' },
  { name: 'an EMPTY css rule does not stop the strip (the 8-of-30 defect)',
    run: () => firstWords('#judgment .P { } #judgment .N { font-size: 1pt; } Neutral Citation', 3) === 'Neutral Citation' },
  { name: 'NEG: a brace inside the judgment does not over-trim',
    run: () => firstWords('#judgment .N { font-size: 1pt; } Neutral Citation and "{sic}" as drafted', 2) === 'Neutral Citation …' },
  { name: 'NEG: a document with no CSS is returned untouched',
    run: () => stripAknPreamble('Neutral Citation Number: [2004] EWHC 1') === 'Neutral Citation Number: [2004] EWHC 1' },

  // ── committee attribution ───────────────────────────────────────────────────────────────────
  { name: 'an ORGANISATION witness is read from organisations[], not the null .name',
    run: () => witnessName(ORG)?.name === 'International Alert' && witnessName(ORG)?.kind === 'body' },
  { name: 'an INDIVIDUAL witness is a person',
    run: () => witnessName(IND)?.kind === 'person' },
  { name: 'NEG: a witness with no name and no organisation is a miss',
    run: () => witnessName({ submitterType: 'Individual', name: null, organisations: [] }) === null },
  { name: 'NEG: an ANONYMOUS submission is never named',
    run: () => attributeWritten({ anonymous: true, witnesses: [IND] }).speaker === null },
  { name: 'an individual submission lands in SPEAKER',
    run: () => attributeWritten({ witnesses: [IND] }).speaker === 'Mikaela Gavas' },
  { name: 'an organisation submission lands in ATTRIBUTION',
    run: () => attributeWritten({ witnesses: [ORG] }).attribution === 'International Alert' },
  { name: 'NEG: an ORAL panel never lands in speaker',
    run: () => attributeOral({ witnesses: [IND, ORG] }).speaker === null },
  { name: 'an oral panel is a deduped body list',
    run: () => attributeOral({ witnesses: [ORG, { ...ORG }] }).attribution === 'International Alert' },
  { name: 'dedupeJoin is order-preserving and case-insensitive',
    run: () => dedupeJoin(['B', 'b', 'A']) === 'B; A' },
  { name: 'a committee Report is attributed to its committee',
    run: () => attributePublication('Report', 'Transport Committee').attribution === 'Transport Committee' },
  { name: 'NEG: a GOVERNMENT RESPONSE is NOT attributed to the committee',
    run: () => attributePublication('Government Response', 'Public Accounts Committee').attribution === null },
  { name: 'NEG: an unknown publication type is refused, not assumed committee-authored',
    run: () => attributePublication('Correspondence', 'X Committee').attribution === null },
  { name: 'NEG: a blank committee name is a miss, not an empty attribution',
    run: () => attributePublication('Report', '  ').attribution === null },
]

async function dbCases(): Promise<Case[]> {
  const p = namesPool()
  const q = async (sql: string) => (await p.query(sql)).rows[0]
  return [
    { name: 'tna-caselaw is at least 99.9% titled', run: async () => {
      const r = await q(`SELECT COUNT(*)::int n, COUNT(NULLIF(btrim(COALESCE("sectionTitle",'')),''))::int t
                           FROM corpus_sections WHERE corpus = 'tna-caselaw'`)
      console.log(`        ${r.t}/${r.n}`)
      return r.t / r.n >= 0.999
    } },
    { name: 'every recovered case-law title carries its route in `notes`', run: async () => {
      const r = await q(`SELECT COUNT(*)::int bad FROM corpus_sections
                          WHERE corpus = 'tna-caselaw' AND "sectionTitle" IS NOT NULL
                            AND (notes IS NULL OR notes NOT LIKE 'title-route:%')`)
      console.log(`        ${r.bad} titled rows carrying no route`)
      return r.bad === 0
    } },
    { name: 'NEG: NO case-law title is merely its own citation', run: async () => {
      const r = await q(`SELECT COUNT(*)::int bad FROM corpus_sections
                          WHERE corpus = 'tna-caselaw' AND "sectionTitle" IS NOT NULL
                            AND btrim("sectionTitle") = btrim(split_part(id, ':', 2))`)
      console.log(`        ${r.bad} rows titled with their own citation`)
      return r.bad === 0
    } },
    { name: 'NEG: NO Government Response wears a committee\'s name', run: async () => {
      const r = await q(`SELECT COUNT(*)::int bad FROM corpus_sections
                          WHERE corpus = 'committees-reports' AND attribution IS NOT NULL
                            AND notes IS NOT NULL AND notes LIKE '{%'
                            AND (notes::json->>'publicationType') = 'Government Response'`)
      console.log(`        ${r.bad} government responses attributed to a committee`)
      return r.bad === 0
    } },
    { name: 'committees-reports is at least 85% attributed', run: async () => {
      const r = await q(`SELECT COUNT(*)::int n, COUNT(attribution)::int a
                           FROM corpus_sections WHERE corpus = 'committees-reports'`)
      console.log(`        ${r.a}/${r.n}`)
      return r.a / r.n >= 0.85
    } },
    { name: 'NEG: NO oral-evidence row carries a `speaker` (a panel is not a person)', run: async () => {
      const r = await q(`SELECT COUNT(*)::int bad FROM corpus_sections
                          WHERE corpus = 'committees-evidence'
                            AND "parentDocId" LIKE 'oralevidence:%' AND speaker IS NOT NULL`)
      console.log(`        ${r.bad} transcripts attributed to a single speaker`)
      return r.bad === 0
    } },
    { name: 'NEG: a miss is NULL, never a blank string', run: async () => {
      const r = await q(`SELECT COUNT(*)::int bad FROM corpus_sections
                          WHERE corpus IN ('committees-evidence','committees-reports','tna-caselaw')
                            AND (btrim(COALESCE(attribution,'x')) = ''
                              OR btrim(COALESCE(speaker,'x')) = ''
                              OR btrim(COALESCE("sectionTitle",'x')) = '')`)
      console.log(`        ${r.bad} blank-string values`)
      return r.bad === 0
    } },
  ]
}

;(async () => {
  let pass = 0, total = 0
  const run = async (cs: Case[], label: string) => {
    console.log(`\n── ${label}`)
    for (const c of cs) {
      total++
      let ok = false
      try { ok = await c.run() } catch (e) { console.log(`        threw: ${e}`) }
      console.log(`  ${ok ? '✓' : '✗ FAILED'}  ${c.name}`)
      if (ok) pass++
    }
  }
  await run(UNIT, 'UNIT — each decision with its negative control')
  await run(await dbCases(), 'LIVE — read back off Neon, not off a sweep\'s own tally')
  await endNamesPool()
  console.log(`\ncheck:names ${pass}/${total}`)
  if (pass !== total) process.exit(1)
})().catch(e => { console.error(e); process.exit(1) })
