/**
 * extract-positions.ts — BRIEF_GRAPH_2D3 §1, "the extraction". The first inferred edges in the graph.
 *
 * For each submission in the run: does it take a position on each proposition, and which way?
 * `holds-position`, polarity for / against / balanced, **with the extract that supports it**, dated.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR DECISIONS THAT ARE NOT OBVIOUS FROM THE BRIEF
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. **The model identifies a proposition by CODE PLUS A VERBATIM PREFIX, and both are checked.**
 *    Not by array index. The Amendment 1 EDM test caught gemini-2.5-flash returning index values
 *    that disagreed with its own output order — the salt motion's proposition filed under the
 *    Scottish SI's number. It did not reproduce on the next run, which makes it INTERMITTENT and
 *    therefore worse: a systematic error is visible, an intermittent one corrupts a fraction of
 *    rows and looks like model error. Every returned position must carry P-code and the first
 *    words of the proposition, and a row whose prefix does not match its code is DISCARDED and
 *    counted (`mismatched` in the run report).
 *
 * 2. **"No position" is written down, but only where silence means something** (design §5.4). A
 *    body that submitted to THIS inquiry and did not address one of THIS inquiry's propositions has
 *    been asked and was silent — that is a fact and it is stored. Silence on a proposition derived
 *    from a different inquiry is not informative and is not stored, because recording it would
 *    manufacture ~226,000 rows of "did not mention" that nobody asked anybody.
 *
 * 3. **The extract is checked against the document by us** (`findExtract`). The model cannot certify
 *    its own quotation. `extract_found_in_source = false` is not an error to be retried away; it is
 *    the fabricated-quotation rate and it is reported as one.
 *
 * 4. **A long submission is CAPPED, and the cap is reported.** p99 in this area is 23,393 words.
 *    Truncating silently would produce "no position" rows that mean "we did not look", which is
 *    exactly the silence-as-fact confusion §5.4 rules out — so a capped submission is flagged on
 *    every row it produces and counted in the run report.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/extract-positions.ts --self-test         # offline
 *   npx tsx position-graph/extract-positions.ts --pilot 60          # bounded pilot, then STOP
 *   npx tsx position-graph/extract-positions.ts --predict           # price the real vocabulary
 *   npx tsx position-graph/extract-positions.ts --run               # the full bounded run
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA, areaEdgeCte, areaInquirySql } from './area-2d3'
import { geminiJson, mapLimit, MODEL } from './llm-2d3'
import { newMeter, meterLine, meterUsd, FLASH_IN_PER_M, FLASH_OUT_PER_M, wordsToTokens } from './cost-2d3'
import { getDocText, firstWords, findExtract, normaliseForMatch } from './text-2d3'
// S6 §3: every stream's spend goes into ONE ledger. Ingest's cost is not a user's, but it is
// Charlie's, and a single number for what the platform spends is worth more than four.
import { recordMeter } from '../shared/spend-ledger'

export {}

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const num = (name: string, dflt: number) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? parseInt(argv[i + 1], 10) : dflt }

const N_INQUIRIES = num('inquiries', 12)
const PILOT = num('pilot', 0)
/** Words of a submission shown to the extractor. See decision 4 above — capping is REPORTED. */
const MAX_WORDS = num('max-words', 9000)
const CONCURRENCY = num('concurrency', 6)
const RUN_ID = process.env.GRAPH_2D3_RUN_ID ?? (PILOT ? 'pilot-2d3' : 'run-2d3')

const SYSTEM = `You read one submission to a UK parliamentary select committee inquiry and record which of a
given list of policy PROPOSITIONS it takes a position on.

You are building an evidence record that a reader will check against the document. Everything you
return must be defensible by pointing at the text.

FOR EACH PROPOSITION THE SUBMISSION ACTUALLY ADDRESSES, return:
  · code            the proposition's code exactly as given, e.g. P07
  · textStart       the FIRST EIGHT WORDS of that proposition, copied exactly as given
  · polarity        "for"      — the submission argues for the proposition, or would clearly welcome it
                    "against"  — the submission argues against it, or against a necessary part of it
                    "balanced" — the submission explicitly weighs both sides and lands on neither
  · extract         a passage COPIED VERBATIM AND CONTIGUOUSLY from the submission, between 20 and
                    400 characters, that a reader can find in the document and that shows the
                    position. Copy it character for character. Do NOT paraphrase, do NOT stitch two
                    separated sentences together, do NOT tidy the punctuation. If you cannot find
                    such a passage, do not return the proposition at all.
  · capacity        "own-view"        the body's own view
                    "representative"  given on behalf of members, a sector or a client
                    "government-line" a department or minister stating government policy
                    "commissioned"    a commissioned or devil's-advocate piece
                    "unclear"         the document does not let you tell — use this rather than guess
  · confidence      0.0 to 1.0

RULES, AND THE FIRST TWO MATTER MOST
1. OMIT any proposition the submission does not address. Silence is silence. Mentioning a topic is
   NOT taking a position on a claim about that topic: a submission that describes waiting times has
   not thereby argued for any particular remedy.
2. NEVER invent an extract. The passage must be in the document, word for word. A position without a
   real passage is worse than no position at all, and every extract is checked mechanically.
3. "against" includes arguing against a necessary component of the proposition, or warning that it
   would be harmful. Expressing a practical concern while supporting the aim is "balanced".
4. Judge what the submission ARGUES, not what its author probably believes.
5. Return at most 12 propositions. If the submission addresses more, return the clearest 12.
6. British English. No markdown.`

const SCHEMA = {
  type: 'object',
  properties: {
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          textStart: { type: 'string' },
          polarity: { type: 'string', enum: ['for', 'against', 'balanced'] },
          extract: { type: 'string' },
          capacity: { type: 'string', enum: ['own-view', 'representative', 'government-line', 'commissioned', 'unclear'] },
          confidence: { type: 'number' },
        },
        required: ['code', 'textStart', 'polarity', 'extract', 'capacity', 'confidence'],
      },
    },
  },
  required: ['positions'],
}

interface Prop { id: string; code: string; text: string; refs: string[] }
interface Sub { section_id: string; r2key: string; inquiry_ref: string; inquiry_label: string; d: string; words: number; url: string | null; entity_ids: string[]; submitters: string[] }

/**
 * Is this extract prose, or is it a table row?
 *
 * ⚠ Three of the re-pilot's 60 calls hit `maxOutputTokens`, and their tails said why: a submission
 * containing a wide table makes the model copy a run of tabs into an extract, which eats the output
 * budget and truncates the whole response. Raising the budget (8,192 → 16,384) stops the
 * truncation; this stops the row that caused it being stored as a quotation. §18 rule 5 covers the
 * first half — size the budget to the output — and a run of layout characters is not evidence of
 * anything, which is the second.
 */
export function looksLikeProse(extract: string): boolean {
  const words = extract.split(/\s+/).filter((w) => /[a-z]{3}/i.test(w))
  if (words.length < 5) return false
  const junk = (extract.match(/[\s\t|·•—–_]/g) ?? []).length
  return junk / extract.length < 0.4
}

/**
 * The first eight words, normalised — the key the model's echo is checked against.
 *
 * Punctuation is stripped, because the job of this key is to prove the model quoted the SAME
 * proposition its code names, not to police a comma. It still fails on a paraphrase, which is the
 * failure it exists to catch, and the self-test asserts both directions.
 */
export function prefixKey(text: string): string {
  return normaliseForMatch(text).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 8).join(' ')
}

async function loadPropositions(pool: ReturnType<typeof getNeonPool>): Promise<Prop[]> {
  const { rows } = await pool.query<{ id: string; text: string; refs: string[] }>(
    `SELECT id::text, text, ARRAY(SELECT jsonb_array_elements_text(inquiry_refs)) refs
     FROM graph_proposition WHERE area=$1 ORDER BY id`, [AREA])
  return rows.map((r, i) => ({ ...r, code: `P${String(i + 1).padStart(2, '0')}` }))
}

async function loadSubmissions(pool: ReturnType<typeof getNeonPool>, refs: string[]): Promise<Sub[]> {
  const { rows } = await pool.query<Sub>(`
    WITH ${areaEdgeCte()},
    s AS (
      SELECT gv.section_id, e.object_ref AS inquiry_ref, MIN(e.object_label) AS inquiry_label,
             array_agg(DISTINCT e.subject_id::text) AS entity_ids
      FROM e JOIN graph_evidence gv ON gv.edge_id = e.edge_id
      WHERE e.object_ref = ANY($1::text[])
      GROUP BY gv.section_id, e.object_ref
    )
    SELECT s.section_id, s.inquiry_ref, s.inquiry_label, s.entity_ids,
           c."r2Key" AS r2key, c."itemDate"::text AS d, c."wordCount" AS words, c."sourceUrl" AS url,
           ARRAY(SELECT en.canonical_name FROM graph_entity en WHERE en.id::text = ANY(s.entity_ids)) AS submitters
    FROM s JOIN corpus_sections c ON c.id = s.section_id
    WHERE c."r2Key" IS NOT NULL
    ORDER BY s.section_id`, [refs])
  return rows
}

/** The proposition block put to one submission. Its own inquiry's claims are marked. */
function propBlock(props: Prop[], inquiryRef: string): string {
  return props.map((p) => `${p.code}${p.refs.includes(inquiryRef) ? '*' : ' '} ${p.text}`).join('\n')
}

interface Row {
  entityId: string; propId: string; polarity: string; extract: string | null
  found: boolean | null; offset: number | null; capacity: string | null; confidence: number | null
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    const props = await loadPropositions(pool)
    if (!props.length) { console.error('no propositions — run derive-propositions.ts first'); process.exit(1) }
    const byCode = new Map(props.map((p) => [p.code, p]))
    const { rows: inqRows } = await pool.query<{ object_ref: string }>(areaInquirySql())
    const refs = inqRows.slice(0, N_INQUIRIES).map((r) => r.object_ref)
    let subs = await loadSubmissions(pool, refs)

    // ── price it against the REAL vocabulary before spending ────────────────────────────────────
    const propTokens = Math.round(wordsToTokens(props.reduce((a, p) => a + p.text.split(/\s+/).length + 2, 0)))
    const overhead = propTokens + 700
    const cappedWords = subs.reduce((a, s) => a + Math.min(s.words, MAX_WORDS), 0)
    const inTok = wordsToTokens(cappedWords) + subs.length * overhead
    const outTok = subs.length * 500
    console.log(`\n════ POPULATION AND PRICE ════`)
    console.log(`  area                 ${AREA}`)
    console.log(`  inquiries            ${refs.length}`)
    console.log(`  submissions          ${subs.length.toLocaleString('en-GB')}`)
    console.log(`  propositions         ${props.length}  (${propTokens.toLocaleString('en-GB')} tokens of vocabulary on every call)`)
    console.log(`  words, uncapped      ${subs.reduce((a, s) => a + s.words, 0).toLocaleString('en-GB')}`)
    console.log(`  words, capped @${MAX_WORDS}  ${cappedWords.toLocaleString('en-GB')}  (${subs.filter((s) => s.words > MAX_WORDS).length} submissions capped)`)
    console.log(`  predicted            $${((inTok / 1e6) * FLASH_IN_PER_M + (outTok / 1e6) * FLASH_OUT_PER_M).toFixed(2)}`)
    if (flag('predict')) return

    if (PILOT) subs = subs.filter((_, i) => i % Math.max(1, Math.floor(subs.length / PILOT)) === 0).slice(0, PILOT)

    // Idempotence: a section already carrying rows for this run is not re-called.
    const { rows: done } = await pool.query<{ section_id: string }>(
      `SELECT DISTINCT section_id FROM graph_position WHERE run_id=$1`, [RUN_ID])
    const doneSet = new Set(done.map((d) => d.section_id))
    const todo = subs.filter((s) => !doneSet.has(s.section_id))
    console.log(`\n════ EXTRACT — run_id=${RUN_ID} · ${todo.length} to do (${doneSet.size} already done) · model ${MODEL} ════`)
    if (!todo.length) return

    const meter = newMeter()
    const t0 = Date.now()
    const stats = { calls: 0, failed: 0, noText: 0, capped: 0, positions: 0, noPosition: 0,
      mismatched: 0, unknownCode: 0, extractFound: 0, extractMissing: 0, tooShort: 0 }

    await mapLimit(todo, CONCURRENCY, async (s, i) => {
      const text = await getDocText(s.r2key)
      if (!text) { stats.noText++; return }
      const capped = s.words > MAX_WORDS
      if (capped) stats.capped++
      const body = capped ? firstWords(text, MAX_WORDS) : text

      const user = `INQUIRY: ${s.inquiry_label}\nSUBMITTED BY: ${s.submitters.join('; ') || '(not recorded)'}\nDATE: ${s.d}\n`
        + `${capped ? `NOTE: this is the first ${MAX_WORDS} words of a ${s.words}-word submission.\n` : ''}`
        + `\nPROPOSITIONS (a * marks one derived from THIS inquiry):\n${propBlock(props, s.inquiry_ref)}\n`
        + `\n--- SUBMISSION ---\n${body}`

      const res = await geminiJson<{ positions: Array<{ code: string; textStart: string; polarity: string; extract: string; capacity: string; confidence: number }> }>({
        system: SYSTEM, user, schema: SCHEMA, maxOutputTokens: 16384, label: `extract:${s.section_id}`, meter, temperature: 0.1,
      })
      stats.calls++
      if (res.kind !== 'ok') {
        stats.failed++
        if (stats.failed <= 8) console.warn(`  ✗ ${s.section_id} — ${res.kind}: ${res.detail.slice(0, 160)}`)
        return
      }

      const rows: Row[] = []
      const taken = new Set<string>()
      for (const p of res.value.positions ?? []) {
        const prop = byCode.get((p.code ?? '').trim().toUpperCase())
        if (!prop) { stats.unknownCode++; continue }
        // THE CHECK THAT CAN FIRE: the echoed prefix must belong to the code the model used.
        if (prefixKey(p.textStart ?? '') !== prefixKey(prop.text)) { stats.mismatched++; continue }
        const extract = (p.extract ?? '').trim()
        if (extract.length < 20 || !looksLikeProse(extract)) { stats.tooShort++; continue }
        const m = findExtract(extract, text)
        if (m.found) stats.extractFound++; else stats.extractMissing++
        taken.add(prop.id)
        for (const entityId of s.entity_ids) {
          rows.push({ entityId, propId: prop.id, polarity: p.polarity, extract: extract.slice(0, 2000),
            found: m.found, offset: m.offset, capacity: p.capacity ?? null,
            confidence: typeof p.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : null })
        }
        stats.positions++
      }
      // §5.4: silence on THIS inquiry's own propositions is a recorded fact.
      for (const prop of props) {
        if (!prop.refs.includes(s.inquiry_ref) || taken.has(prop.id)) continue
        for (const entityId of s.entity_ids) {
          rows.push({ entityId, propId: prop.id, polarity: 'no-position', extract: null, found: null, offset: null, capacity: null, confidence: null })
        }
        stats.noPosition++
      }
      if (rows.length) await insertRows(pool, s, rows, capped)

      if ((i + 1) % 100 === 0) {
        const rate = (i + 1) / ((Date.now() - t0) / 1000)
        console.log(`  … ${i + 1}/${todo.length} · ${rate.toFixed(1)}/s · $${meterUsd(meter).toFixed(3)} · eta ${Math.round((todo.length - i - 1) / rate / 60)} min`)
      }
    })

    console.log(`\n════ RUN REPORT ════`)
    console.log(`  calls made                    ${stats.calls}`)
    console.log(`  calls failed                  ${stats.failed}`)
    console.log(`  submissions with no R2 text   ${stats.noText}`)
    console.log(`  submissions capped @${MAX_WORDS}     ${stats.capped}`)
    console.log(`  positions kept                ${stats.positions}`)
    console.log(`  no-position rows recorded     ${stats.noPosition}`)
    console.log(`  ⚠ discarded, prefix ≠ code    ${stats.mismatched}`)
    console.log(`  ⚠ discarded, unknown code     ${stats.unknownCode}`)
    console.log(`  ⚠ discarded, extract too short / not prose ${stats.tooShort}`)
    console.log(`  extract FOUND in the document ${stats.extractFound}`)
    console.log(`  extract NOT found             ${stats.extractMissing}  (${(100 * stats.extractMissing / Math.max(1, stats.extractFound + stats.extractMissing)).toFixed(1)}% — the fabricated-quotation rate)`)
    console.log(`  ${meterLine(meter)}`)
    await recordMeter(meter, { stream: 'graph', pass: 'graph.position-extract', model: MODEL, ref: RUN_ID })
    console.log(`  wall clock                    ${Math.round((Date.now() - t0) / 1000)}s`)
  } finally { await endNeonPool() }
}

async function insertRows(pool: ReturnType<typeof getNeonPool>, s: Sub, rows: Row[], capped: boolean) {
  const vals: string[] = []
  const params: unknown[] = []
  for (const r of rows) {
    const b = params.length
    vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14})`)
    params.push(r.entityId, r.propId, r.polarity, r.extract, r.found, r.offset, s.section_id, s.inquiry_ref,
      s.url, s.d, r.capacity, r.confidence, MODEL, capped ? `${RUN_ID}:capped` : RUN_ID)
  }
  await pool.query(
    `INSERT INTO graph_position (entity_id, proposition_id, polarity, extract, extract_found_in_source,
       extract_offset, section_id, inquiry_ref, source_url, observed_on, capacity, confidence, model, run_id)
     VALUES ${vals.join(',')}
     ON CONFLICT (entity_id, proposition_id, section_id) DO NOTHING`, params)
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const props: Prop[] = [
    { id: '1', code: 'P01', text: 'General Practice funding should be significantly increased as a proportion of the NHS budget.', refs: ['100', '200'] },
    { id: '2', code: 'P02', text: 'Seven-day access to general practice services should be implemented.', refs: ['200'] },
  ]
  const block = propBlock(props, '100')
  const cases: Array<[string, boolean]> = [
    ['own-inquiry propositions are starred', /^P01\* /m.test(block)],
    ['other propositions are not starred', /^P02  /m.test(block)],
    ['prefix key is the first eight words', prefixKey(props[0].text) === 'general practice funding should be significantly increased as'],
    ['prefix key survives punctuation and case', prefixKey('General practice FUNDING should be, significantly increased as a proportion') === prefixKey(props[0].text)],
    ['a prefix from the WRONG proposition does not match', prefixKey(props[1].text) !== prefixKey(props[0].text)],
    ['a paraphrased prefix does not match', prefixKey('GP funding should be greatly increased as a share') !== prefixKey(props[0].text)],
    ['the prompt forbids stitching two passages', /do NOT stitch two\n\s*separated sentences together/.test(SYSTEM)],
    ['the prompt says a topic mention is not a position', /Mentioning a topic is\n\s*NOT taking a position/.test(SYSTEM)],
    ['the schema has no index field', !/index/i.test(JSON.stringify(SCHEMA))],
    ['balanced is a permitted polarity', JSON.stringify(SCHEMA).includes('"balanced"')],
    ['no-position is NOT a polarity the model may return', !JSON.stringify(SCHEMA).includes('no-position')],
    ['prose passes the layout guard', looksLikeProse('We believe Section 21 no-fault eviction should be abolished without delay.')],
    ['a run of tabs is rejected', !looksLikeProse('Trust\t\t\t\t\t\t\t\t2019\t\t\t\t\t\t2020\t\t\t\t\t\t2021\t\t\t\t\t\t')],
    ['a bullet skeleton is rejected', !looksLikeProse('· — · — · — · — · — · — · — a b c')],
    ['a five-word sentence still passes', looksLikeProse('Funding must rise across every trust')],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[extract-positions] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
