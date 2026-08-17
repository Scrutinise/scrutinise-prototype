/**
 * claims-bottomup.ts — BRIEF_GRAPH_2D5 §4: read each submission once and pull out every claim it
 * makes, instead of asking it about 83 claims we wrote in advance.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE TWO ARCHITECTURES, AND WHY THIS IS A TEST RATHER THAN A SWITCH
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * TOP-DOWN (what we do now): write 83 propositions for a policy area, ask every submission about
 * each one. It can only ever find positions on claims somebody thought of in advance.
 *
 * BOTTOM-UP (Charlie's proposal): read the submission once, pull out every claim it makes, whatever
 * the inquiry was about. The output is a corpus of claims with an author, a date and a source.
 *
 * §4 is explicit: "Do not switch architecture on an argument. Run both on the same submissions and
 * compare." So both arms run over the SAME 49 submissions in the SAME session with the SAME meter,
 * because a cost comparison against a figure remembered from a previous run is not a comparison.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE SCORING, DESIGNED BEFORE THE EXTRACTION RAN — §4 REQUIRES THIS IN TERMS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "There is no answer key. Bottom-up produces claims nobody specified, and 'is this a good claim to
 * have extracted?' is a harder thing to score. DESIGN THE SCORING BEFORE RUNNING THE EXTRACTION, or
 * the result will be unmeasurable and therefore unusable."
 *
 * Four measures, fixed in advance:
 *
 *   1. RECALL AGAINST WHAT WE KNOW IS TRUE. The only answer key that exists is the 23 positions the
 *      hand-read certified CORRECT. For each, did the bottom-up pass produce a claim covering the
 *      same ground from the same submission? ⚠ Scored by MATCHING, which is itself a judgement, so
 *      matches are made by a separate call that must quote the bottom-up claim verbatim, and every
 *      match is listed in the output for inspection rather than only counted.
 *
 *   2. WHAT THE 83 DO NOT COVER. Claims for which no proposition is a match. This is the number the
 *      whole proposal turns on — "it finds what we did not think to ask" — and it is worthless
 *      without measure 4.
 *
 *   3. COST PER SUBMISSION, BOTH ARMS, MEASURED NOT ESTIMATED.
 *
 *   4. ⚠ THE HAND READ, WHICH DECIDES IT. A sample of extracted claims read by a person and sorted
 *      into: REAL (a contestable claim about the world or about policy, worth holding), or one of
 *      TRIVIA / RESTATEMENT / SELF-DESCRIPTION / NOT-A-CLAIM. §4: "how many are real claims worth
 *      holding against how many are trivia, restatement, or the submission describing itself."
 *      A large measure-2 number made of self-description is a worse outcome than top-down, not a
 *      better one.
 *
 * ⚠ MEASURE 2 WITHOUT MEASURE 4 IS THE TRAP THIS DESIGN EXISTS TO AVOID. "Bottom-up found 900 claims
 * the 83 do not cover" is a fact about volume, not about value, and it is exactly the shape of
 * number that has misled this workstream before.
 *
 * ⚠ NOT MEASURED, AND NAMED SO IT IS NOT MISTAKEN FOR MEASURED: clustering. §4 says two organisations
 * saying the same thing in different words must end up together or the corpus is unqueryable. This
 * run does not attempt it. The duplicate rate WITHIN the sample is reported as a floor on the size
 * of that problem, and nothing more.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/claims-bottomup.ts --self-test
 *   npx tsx position-graph/claims-bottomup.ts --design      # prints the scoring, before any spend
 *   npx tsx position-graph/claims-bottomup.ts --run         # arm B: bottom-up over the 49
 *   npx tsx position-graph/claims-bottomup.ts --topdown     # arm A: the same 49, metered here
 *   npx tsx position-graph/claims-bottomup.ts --match       # measure 1
 *   npx tsx position-graph/claims-bottomup.ts --novelty     # measure 2
 *   npx tsx position-graph/claims-bottomup.ts --report
 *   npx tsx position-graph/claims-bottomup.ts --handsample 40
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA } from './area-2d3'
import { geminiJson, mapLimit, MODEL } from './llm-2d3'
import { newMeter, meterLine, meterUsd, type Meter } from './cost-2d3'
import { getDocText, firstWords, findExtract } from './text-2d3'
import { prefixKey } from './extract-positions'
// ⚠ 2D-4's WINNING PROMPT, IMPORTED NOT COPIED. A re-typed copy would make the cost comparison
// measure a prompt nobody uses. trial-positions.ts guards its main(), so importing runs nothing.
import { V2 } from './trial-positions'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const MAX_WORDS = num('max-words', 9000)
const RUN = 'bu1'

const DDL = `
CREATE TABLE IF NOT EXISTS graph_claim_bottomup (
  id           BIGSERIAL PRIMARY KEY,
  run_id       TEXT NOT NULL,
  section_id   TEXT NOT NULL,
  inquiry_ref  TEXT,
  claim        TEXT NOT NULL,
  stance       TEXT,
  subject      TEXT,
  quote        TEXT,
  quote_found  BOOLEAN,
  is_about_self BOOLEAN,
  confidence   REAL,
  model        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graph_claim_bottomup_sec ON graph_claim_bottomup (run_id, section_id);
CREATE TABLE IF NOT EXISTS graph_claim_match (
  run_id        TEXT NOT NULL,
  position_id   BIGINT NOT NULL,
  matched       BOOLEAN NOT NULL,
  claim_id      BIGINT,
  claim_echo    TEXT,
  echo_ok       BOOLEAN,
  note          TEXT,
  model         TEXT NOT NULL,
  PRIMARY KEY (run_id, position_id)
);
CREATE TABLE IF NOT EXISTS graph_claim_cost (
  run_id     TEXT NOT NULL,
  arm        TEXT NOT NULL,
  submissions INTEGER NOT NULL,
  in_tokens  BIGINT NOT NULL,
  out_tokens BIGINT NOT NULL,
  usd        NUMERIC NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, arm)
);`

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ARM B — BOTTOM-UP
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ THE PROMPT CARRIES NO VOCABULARY, AND THAT IS THE POINT OF THE ARM.
 *
 * Nothing about the 83 propositions, nothing about health and social care, nothing about the
 * inquiry's subject. If any of it were here the arm would be a disguised top-down run and measure 2
 * would be meaningless — it would find what we told it to look for.
 *
 * ⚠ `isAboutSelf` is asked for EXPLICITLY rather than filtered afterwards, because "the submission
 * describing itself" is one of the failure categories §4 names, and a category the extractor can
 * label is a category that can be counted honestly instead of estimated.
 */
const BU_PROMPT = `You read one submission of written evidence and extract EVERY CLAIM it makes.

A CLAIM is a contestable assertion — something a reasonable person could disagree with. It may be
about the world ("delays have doubled since 2019"), about cause ("the reforms reduced continuity"),
or about what should happen ("the budget should be ring-fenced").

⚠ THESE ARE NOT CLAIMS AND MUST NOT BE RETURNED:
  · who the submitter is, how many members they have, what they do — however impressive
  · a heading, a question the inquiry asked, a table row, a reference-list entry
  · a definition, or an uncontestable statement of fact ("the Act came into force in 1998")
  · a courtesy ("we welcome the Committee's inquiry")
  · a description of the submitter's own programme, UNLESS it asserts that the programme works

Extract claims on ANY subject, whether or not they relate to the inquiry's title. If a submission
about one subject makes a claim about an entirely different one, return that claim too — that is
the point of this task.

FOR EACH CLAIM, return:
  · claim        the claim in ONE sentence, in neutral terms, as a standalone assertion that makes
                 sense to somebody who has not read the submission. Do NOT begin "the submission
                 says" — state the claim itself.
  · stance       "asserts"     the submitter puts this forward as true or as what should happen
                 "denies"      the submitter argues against it
                 "reports"     the submitter attributes it to someone else without endorsing it
  · subject      two to five words naming what the claim is about, e.g. "GP funding", "school meals"
  · quote        a passage COPIED VERBATIM AND CONTIGUOUSLY from the submission, 20 to 300
                 characters, that makes the claim. Copy it character for character. Do NOT
                 paraphrase, do NOT stitch separated sentences together. If you cannot find such a
                 passage, do not return the claim.
  · isAboutSelf  true if the claim is principally about the submitting organisation rather than
                 about policy or the world
  · confidence   0.0 to 1.0

Return at most 40 claims. British English. No markdown.`

const BU_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          stance: { type: 'string', enum: ['asserts', 'denies', 'reports'] },
          subject: { type: 'string' },
          quote: { type: 'string' },
          isAboutSelf: { type: 'boolean' },
          confidence: { type: 'number' },
        },
        required: ['claim', 'stance', 'subject', 'quote', 'isAboutSelf', 'confidence'],
      },
    },
  },
  required: ['claims'],
}

interface Sub { section_id: string; r2key: string; words: number; inquiry_ref: string; inquiry_label: string | null; submitter: string | null }

/** The submissions behind the fifty hand-scored positions — §4: "Take the submissions behind the existing fifty". */
async function sample(pool: ReturnType<typeof getNeonPool>): Promise<Sub[]> {
  const { rows } = await pool.query<Sub>(`
    SELECT DISTINCT p.section_id, c."r2Key" r2key, c."wordCount" words, p.inquiry_ref,
           (SELECT MIN(ge.object_label) FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id=ge.id
             WHERE gv.section_id=p.section_id AND ge.predicate='gave-evidence-to') inquiry_label,
           (SELECT string_agg(DISTINCT en.canonical_name, '; ') FROM graph_evidence gv2
              JOIN graph_edge ge2 ON ge2.id=gv2.edge_id JOIN graph_entity en ON en.id=ge2.subject_id
             WHERE gv2.section_id=p.section_id) submitter
    FROM graph_position p JOIN graph_position_review r ON r.position_id = p.id
    JOIN corpus_sections c ON c.id = p.section_id
    ORDER BY p.section_id`)
  return rows
}

async function runBottomUp() {
  const pool = getNeonPool()
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const subs = await sample(pool)
  await pool.query('DELETE FROM graph_claim_bottomup WHERE run_id=$1', [RUN])
  console.log(`\n════ ARM B — BOTTOM-UP over ${subs.length} submissions ════`)
  console.log('  ⚠ the prompt carries NO vocabulary: no propositions, no policy area, no inquiry subject\n')

  const meter = newMeter()
  const stats = { calls: 0, failed: 0, claims: 0, quoteFound: 0, quoteMissing: 0, aboutSelf: 0 }
  const reasons = new Map<string, number>()

  await mapLimit(subs, 6, async (s) => {
    const text = await getDocText(s.r2key)
    if (!text) return
    const body = s.words > MAX_WORDS ? firstWords(text, MAX_WORDS) : text
    const res = await geminiJson<{ claims: Array<{ claim: string; stance: string; subject: string; quote: string; isAboutSelf: boolean; confidence: number }> }>({
      system: BU_PROMPT, user: `--- SUBMISSION ---\n${body}`, schema: BU_SCHEMA,
      maxOutputTokens: 16384, label: `${RUN}:${s.section_id}`, meter, temperature: 0.1,
    })
    stats.calls++
    if (res.kind !== 'ok') {
      stats.failed++
      const k = `${res.kind}: ${String((res as { detail?: string }).detail ?? '').slice(0, 100)}`
      reasons.set(k, (reasons.get(k) ?? 0) + 1)
      return
    }
    for (const c of res.value.claims ?? []) {
      const quote = (c.quote ?? '').trim()
      const found = quote.length >= 20 ? findExtract(quote, text).found : false
      found ? stats.quoteFound++ : stats.quoteMissing++
      if (c.isAboutSelf) stats.aboutSelf++
      stats.claims++
      await pool.query(
        `INSERT INTO graph_claim_bottomup (run_id, section_id, inquiry_ref, claim, stance, subject, quote, quote_found, is_about_self, confidence, model)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [RUN, s.section_id, s.inquiry_ref, (c.claim ?? '').trim().slice(0, 600), c.stance ?? null,
          (c.subject ?? '').trim().slice(0, 120) || null, quote.slice(0, 800) || null, found,
          !!c.isAboutSelf, typeof c.confidence === 'number' ? c.confidence : null, MODEL])
    }
  })

  console.log(`  calls ${stats.calls} (${stats.failed} failed)`)
  for (const [why, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ⚠ ${String(n).padStart(3)} × ${why}`)
  console.log(`  claims ${stats.claims} · ${(stats.claims / Math.max(1, stats.calls)).toFixed(1)} per submission`)
  console.log(`  quote located ${stats.quoteFound} · ⚠ NOT located ${stats.quoteMissing} (${(100 * stats.quoteMissing / Math.max(1, stats.claims)).toFixed(1)}%)`)
  console.log(`  flagged by the model as about the submitter itself: ${stats.aboutSelf}`)
  console.log(`  ${meterLine(meter)}`)
  await recordCost(pool, 'bottom-up', subs.length, meter)
  await endNeonPool()
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ARM A — TOP-DOWN, RE-RUN HERE SO THE COST IS MEASURED IN THE SAME SESSION
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHY THE TOP-DOWN ARM IS RE-RUN RATHER THAN QUOTED FROM 2D-4.
 *
 * §4 asks for "the cost per submission for each approach". A remembered figure from a run with a
 * different cap, a different concurrency and possibly a different model price is not a comparison —
 * it is two numbers next to each other. This runs 2D-4's winning prompt (v2) over the SAME 49
 * submissions with the SAME meter, and writes both arms to `graph_claim_cost`.
 *
 * It writes NO positions. The graph of record stays untouched (§5); only the meter is kept.
 */
async function runTopDownCost() {
  const pool = getNeonPool()
  for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const subs = await sample(pool)
  const { rows: props } = await pool.query<{ text: string; refs: string[] }>(
    `SELECT text, ARRAY(SELECT jsonb_array_elements_text(inquiry_refs)) refs
     FROM graph_proposition WHERE area=$1 ORDER BY id`, [AREA])
  const coded = props.map((p, i) => ({ ...p, code: `P${String(i + 1).padStart(2, '0')}` }))
  console.log(`\n════ ARM A — TOP-DOWN over the same ${subs.length} submissions, ${coded.length} propositions ════`)
  console.log('  ⚠ metered only. No positions are written; the graph of record is untouched.\n')

  const meter = newMeter()
  let calls = 0; let failed = 0; let kept = 0
  await mapLimit(subs, 6, async (s) => {
    const text = await getDocText(s.r2key)
    if (!text) return
    const body = s.words > MAX_WORDS ? firstWords(text, MAX_WORDS) : text
    const block = coded.map((p) => `${p.code}${p.refs.includes(s.inquiry_ref) ? '*' : ' '} ${p.text}`).join('\n')
    const user = `INQUIRY: ${s.inquiry_label ?? ''}\nSUBMITTED BY: ${s.submitter ?? '(not recorded)'}\n`
      + `\nPROPOSITIONS (a * marks one derived from THIS inquiry):\n${block}\n\n--- SUBMISSION ---\n${body}`
    const res = await geminiJson<{ positions: Array<Record<string, unknown>> }>({
      system: V2, user, schema: TD_SCHEMA, maxOutputTokens: 16384,
      label: `td:${s.section_id}`, meter, temperature: 0.1,
    })
    calls++
    if (res.kind !== 'ok') { failed++; return }
    kept += (res.value.positions ?? []).length
  })
  console.log(`  calls ${calls} (${failed} failed) · positions returned ${kept}`)
  console.log(`  ${meterLine(meter)}`)
  await recordCost(pool, 'top-down', subs.length, meter)
  await endNeonPool()
}

const TD_SCHEMA = {
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

async function recordCost(pool: ReturnType<typeof getNeonPool>, arm: string, n: number, m: Meter) {
  await pool.query(
    `INSERT INTO graph_claim_cost (run_id, arm, submissions, in_tokens, out_tokens, usd)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (run_id, arm) DO UPDATE SET submissions=EXCLUDED.submissions, in_tokens=EXCLUDED.in_tokens,
       out_tokens=EXCLUDED.out_tokens, usd=EXCLUDED.usd, measured_at=now()`,
    [RUN, arm, n, Math.round(m.inTokens), Math.round(m.outTokens + m.thoughtTokens), meterUsd(m).toFixed(4)])
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// MEASURE 1 and 2 — matching, by verbatim echo
// ════════════════════════════════════════════════════════════════════════════════════════════════

const MATCH_PROMPT = `You are given ONE proposition and a numbered list of CLAIMS extracted from a
single submission. Decide whether any claim covers the same ground as the proposition — the same
question, not merely the same subject.

⚠ A claim about the same POLICY AREA is not a match. A proposition about the LENGTH of consultations
is not matched by a claim about GP workload, however strongly worded. Only the same question counts.

Return:
  · matched    true or false
  · claimEcho  when matched, the matching claim COPIED EXACTLY as it appears in the list, character
               for character, with no number prefix. Empty when matched is false.
  · note       one short sentence of reasoning.

⚠ If in doubt, answer false. British English. No markdown.`

const MATCH_SCHEMA = {
  type: 'object',
  properties: { matched: { type: 'boolean' }, claimEcho: { type: 'string' }, note: { type: 'string' } },
  required: ['matched', 'claimEcho', 'note'],
}

/**
 * ⚠ MATCHES ARE CORRELATED BY VERBATIM ECHO, NOT BY AN ARRAY INDEX.
 *
 * This workstream has already been bitten once by trusting a model-supplied index: in 2D-3 a
 * dietary-salt motion was filed under a Scottish SI's index, and the same prompt returned 0 bad
 * indexes on the next run — an intermittent fault that a spot check cannot find. Every match here
 * must quote the claim back; a mismatch is counted, not silently resolved to the nearest row.
 */
async function match() {
  const pool = getNeonPool()
  const { rows: targets } = await pool.query<{ position_id: string; section_id: string; proposition: string }>(`
    SELECT r.position_id::text, p.section_id, pr.text proposition
    FROM graph_position_review r
    JOIN graph_position p ON p.id = r.position_id
    JOIN graph_proposition pr ON pr.id = p.proposition_id
    WHERE r.verdict = 'correct' ORDER BY r.position_id`)
  console.log(`\n════ MEASURE 1 — did bottom-up find the ${targets.length} positions the hand-read certified CORRECT? ════`)
  console.log('  ⚠ the only answer key that exists. Matches are echoed verbatim, never taken by index.\n')

  const meter = newMeter()
  let matched = 0; let echoBad = 0; let failed = 0
  await mapLimit(targets, 6, async (t) => {
    const { rows: claims } = await pool.query<{ id: string; claim: string }>(
      'SELECT id::text, claim FROM graph_claim_bottomup WHERE run_id=$1 AND section_id=$2 ORDER BY id', [RUN, t.section_id])
    if (!claims.length) {
      await pool.query(`INSERT INTO graph_claim_match (run_id, position_id, matched, note, model) VALUES ($1,$2,FALSE,$3,$4)
                        ON CONFLICT (run_id, position_id) DO UPDATE SET matched=FALSE, note=EXCLUDED.note`,
      [RUN, t.position_id, 'no bottom-up claims for this submission', MODEL])
      return
    }
    const list = claims.map((c, i) => `${i + 1}. ${c.claim}`).join('\n')
    const res = await geminiJson<{ matched: boolean; claimEcho: string; note: string }>({
      system: MATCH_PROMPT, user: `PROPOSITION: ${t.proposition}\n\nCLAIMS:\n${list}`,
      schema: MATCH_SCHEMA, maxOutputTokens: 2048, label: `m:${t.position_id}`, meter, temperature: 0.1,
    })
    if (res.kind !== 'ok') { failed++; return }
    const echo = (res.value.claimEcho ?? '').trim()
    const hit = res.value.matched ? claims.find((c) => prefixKey(c.claim) === prefixKey(echo)) : undefined
    const echoOk = !res.value.matched || !!hit
    if (!echoOk) echoBad++
    if (res.value.matched && hit) matched++
    await pool.query(
      `INSERT INTO graph_claim_match (run_id, position_id, matched, claim_id, claim_echo, echo_ok, note, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (run_id, position_id) DO UPDATE SET matched=EXCLUDED.matched, claim_id=EXCLUDED.claim_id,
         claim_echo=EXCLUDED.claim_echo, echo_ok=EXCLUDED.echo_ok, note=EXCLUDED.note`,
      [RUN, t.position_id, !!(res.value.matched && hit), hit ? Number(hit.id) : null,
        echo.slice(0, 600) || null, echoOk, (res.value.note ?? '').slice(0, 400), MODEL])
  })
  console.log(`  ✓ MATCHED   ${matched} / ${targets.length} = ${(100 * matched / Math.max(1, targets.length)).toFixed(0)}%`)
  console.log(`  ⚠ echo did not match any claim on the list: ${echoBad} (counted as NOT matched, never resolved to a nearest row)`)
  console.log(`  ⚠ calls failed: ${failed}`)
  console.log(`  ${meterLine(meter)}`)
  await endNeonPool()
}

// ════════════════════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════════════════════
// MEASURE 2 — what the 83 do not cover
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ THIS IS A CORRECTION TO MY OWN FIRST IMPLEMENTATION, AND THE FIRST ONE WOULD HAVE LIED.
 *
 * Measure 2 was originally going to be computed as "claims minus claims matched in measure 1". But
 * measure 1 only tests 23 propositions — the certified-correct ones — so that subtraction would have
 * reported 1,920 of 1,933 claims as "not covered by the 83" when 60 of the 83 were never put to a
 * single claim. It would have been the biggest number in the sprint and it would have been an
 * artefact of the test, not a fact about the corpus.
 *
 * So coverage is asked properly: one call per submission carrying ALL 83 propositions and that
 * submission's claims, returning which claim numbers are covered by any proposition. Claim numbers
 * ARE used here rather than verbatim echo, so the response is checked — a number outside the list is
 * discarded and counted, never clamped to the nearest row.
 */
const COVER_PROMPT = `You are given a numbered list of PROPOSITIONS and a numbered list of CLAIMS
extracted from one submission. For each CLAIM, decide whether ANY proposition asks about the same
question.

⚠ THE SAME SUBJECT IS NOT THE SAME QUESTION. A proposition about the LENGTH of consultations is not
covered by a claim about GP workload, however strongly worded. Only the same question counts.

Return "covered": the numbers of the claims that ARE covered by some proposition, and for each, the
proposition code. Omit every claim that no proposition asks about.

⚠ If in doubt, leave the claim out — an over-generous coverage count understates what bottom-up
found, which is the safer direction for this measurement. British English. No markdown.`

const COVER_SCHEMA = {
  type: 'object',
  properties: {
    covered: {
      type: 'array',
      items: {
        type: 'object',
        properties: { claimNumber: { type: 'number' }, propositionCode: { type: 'string' } },
        required: ['claimNumber', 'propositionCode'],
      },
    },
  },
  required: ['covered'],
}

async function novelty() {
  const pool = getNeonPool()
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_claim_coverage (
    run_id TEXT NOT NULL, claim_id BIGINT NOT NULL, proposition_code TEXT,
    PRIMARY KEY (run_id, claim_id))`)
  await pool.query('DELETE FROM graph_claim_coverage WHERE run_id=$1', [RUN])
  const { rows: props } = await pool.query<{ text: string }>(
    `SELECT text FROM graph_proposition WHERE area=$1 ORDER BY id`, [AREA])
  const block = props.map((p, i) => `P${String(i + 1).padStart(2, '0')} ${p.text}`).join('\n')
  const { rows: subs } = await pool.query<{ section_id: string }>(
    'SELECT DISTINCT section_id FROM graph_claim_bottomup WHERE run_id=$1 ORDER BY 1', [RUN])

  console.log(`\n════ MEASURE 2 — how much of the bottom-up output do the ${props.length} propositions already cover? ════`)
  console.log('  ⚠ ALL 83 are put to every claim. Computing this from measure 1 would have tested only 23.\n')
  const meter = newMeter()
  let covered = 0; let outOfRange = 0; let failed = 0; let total = 0
  await mapLimit(subs, 6, async (s) => {
    const { rows: claims } = await pool.query<{ id: string; claim: string }>(
      'SELECT id::text, claim FROM graph_claim_bottomup WHERE run_id=$1 AND section_id=$2 ORDER BY id', [RUN, s.section_id])
    total += claims.length
    const list = claims.map((c, i) => `${i + 1}. ${c.claim}`).join('\n')
    const res = await geminiJson<{ covered: Array<{ claimNumber: number; propositionCode: string }> }>({
      system: COVER_PROMPT, user: `PROPOSITIONS:\n${block}\n\nCLAIMS:\n${list}`,
      schema: COVER_SCHEMA, maxOutputTokens: 8192, label: `cov:${s.section_id}`, meter, temperature: 0.1,
    })
    if (res.kind !== 'ok') { failed++; return }
    for (const c of res.value.covered ?? []) {
      const idx = Number(c.claimNumber) - 1
      // ⚠ AN INDEX OUTSIDE THE LIST IS DISCARDED AND COUNTED, never clamped to the nearest row.
      if (!Number.isInteger(idx) || idx < 0 || idx >= claims.length) { outOfRange++; continue }
      covered++
      await pool.query(
        `INSERT INTO graph_claim_coverage (run_id, claim_id, proposition_code) VALUES ($1,$2,$3)
         ON CONFLICT (run_id, claim_id) DO NOTHING`,
        [RUN, Number(claims[idx].id), String(c.propositionCode ?? '').slice(0, 8)])
    }
  })
  console.log(`  claims                                   ${total}`)
  console.log(`  covered by one of the 83                 ${covered}  (${(100 * covered / Math.max(1, total)).toFixed(1)}%)`)
  console.log(`  ⚠ NOT covered by any of the 83           ${total - covered}  (${(100 * (total - covered) / Math.max(1, total)).toFixed(1)}%)`)
  console.log(`  ⚠ claim numbers returned outside the list, discarded: ${outOfRange} · calls failed: ${failed}`)
  console.log(`  ⚠⚠ this is a VOLUME. Measure 4 (the hand read) is what says whether it is worth having.`)
  console.log(`  ${meterLine(meter)}`)
  await endNeonPool()
}

async function handsample(n: number) {
  const pool = getNeonPool()
  // ⚠ A DETERMINISTIC SPREAD, NOT A RANDOM DRAW — the same sample can be re-read and argued with.
  const { rows } = await pool.query<{ id: string; claim: string; subject: string; stance: string; quote: string; is_about_self: boolean; quote_found: boolean }>(
    `SELECT id::text, claim, subject, stance, quote, is_about_self, quote_found FROM (
       SELECT *, row_number() OVER (ORDER BY id) rn, count(*) OVER () total FROM graph_claim_bottomup WHERE run_id=$1
     ) x WHERE rn % GREATEST(1, (total / $2)::int) = 1 ORDER BY id LIMIT $2`, [RUN, n])
  console.log(`\n════ MEASURE 4 — ${rows.length} claims for a hand read (every Nth by id, so it is reproducible) ════\n`)
  for (const r of rows) {
    console.log(`${r.id.padStart(6)} [${r.stance}${r.is_about_self ? ' ·SELF' : ''}${r.quote_found ? '' : ' ·⚠NOQUOTE'}] (${r.subject})`)
    console.log(`       ${r.claim}`)
    console.log(`       "${(r.quote ?? '').slice(0, 180)}"`)
  }
  await endNeonPool()
}

async function report() {
  const pool = getNeonPool()
  const { rows: cost } = await pool.query<{ arm: string; submissions: number; in_tokens: string; out_tokens: string; usd: string }>(
    'SELECT arm, submissions, in_tokens, out_tokens, usd FROM graph_claim_cost WHERE run_id=$1 ORDER BY arm', [RUN])
  const { rows: [c] } = await pool.query<{ n: string; subs: string; self: string; noquote: string; dupes: string }>(`
    SELECT count(*)::text n, count(DISTINCT section_id)::text subs,
           count(*) FILTER (WHERE is_about_self)::text self,
           count(*) FILTER (WHERE NOT quote_found)::text noquote,
           (count(*) - count(DISTINCT lower(claim)))::text dupes
    FROM graph_claim_bottomup WHERE run_id=$1`, [RUN])
  const { rows: [m] } = await pool.query<{ matched: string; total: string }>(
    `SELECT count(*) FILTER (WHERE matched)::text matched, count(*)::text total FROM graph_claim_match WHERE run_id=$1`, [RUN])
  // ⚠ Coverage comes from graph_claim_coverage (all 83 put to every claim), NOT from the measure-1
  // matches, which only ever tested 23 propositions. See the note on novelty() — the subtraction
  // that looked obvious would have produced the sprint's biggest number as a pure artefact.
  const { rows: covered } = await pool.query<{ n: string }>(
    `SELECT count(DISTINCT claim_id)::text n FROM graph_claim_coverage WHERE run_id=$1`, [RUN])
  const { rows: hand } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM graph_claim_bottomup WHERE run_id=$1`, [RUN])
  void hand

  console.log(`\n════ §4 — THE COMPARISON THAT DECIDES THE ARCHITECTURE ════\n`)
  console.log(`  MEASURE 3 — cost, both arms metered in the same session over the same submissions`)
  for (const a of cost) {
    const per = Number(a.usd) / Math.max(1, a.submissions)
    console.log(`    ${a.arm.padEnd(11)} ${String(a.submissions).padStart(3)} submissions · in ${Number(a.in_tokens).toLocaleString('en-GB').padStart(9)} · out ${Number(a.out_tokens).toLocaleString('en-GB').padStart(7)} · $${Number(a.usd).toFixed(4)} · $${per.toFixed(5)}/submission`)
  }
  if (cost.length === 2) {
    const bu = cost.find((x) => x.arm === 'bottom-up')!; const td = cost.find((x) => x.arm === 'top-down')!
    const r = Number(bu.usd) / Math.max(1e-9, Number(td.usd))
    console.log(`    → bottom-up costs ${r.toFixed(2)}× top-down`)
  }
  console.log(`\n  MEASURE 1 — recall against the only answer key there is`)
  console.log(`    ${m.matched} of ${m.total} hand-certified CORRECT positions were also found bottom-up = ${(100 * Number(m.matched) / Math.max(1, Number(m.total))).toFixed(0)}%`)
  console.log(`\n  MEASURE 2 — what the 83 do not cover`)
  console.log(`    claims extracted        ${Number(c.n).toLocaleString('en-GB')} over ${c.subs} submissions (${(Number(c.n) / Math.max(1, Number(c.subs))).toFixed(1)} each)`)
  console.log(`    matched to a proposition ${covered[0].n}`)
  console.log(`    ⚠ NOT covered by any of the 83: ${Number(c.n) - Number(covered[0].n)}`)
  console.log(`    ⚠⚠ that number is a VOLUME, not a value. Measure 4 is what decides whether it is worth having.`)
  console.log(`\n  hygiene`)
  console.log(`    flagged as about the submitter itself  ${c.self}`)
  console.log(`    quote not locatable in the document    ${c.noquote}`)
  console.log(`    ⚠ exact duplicate claim strings        ${c.dupes}  — see the caveat below`)
  console.log(`\n  ⚠⚠ THE CLUSTERING PROBLEM IS NOT MEASURED, AND THE NUMBER ABOVE DOES NOT MEASURE IT.`)
  console.log(`     I intended the duplicate-string count as a floor. It came back ZERO, which tells us`)
  console.log(`     the model never emitted the same string twice — a fact about its phrasing, not about`)
  console.log(`     the corpus. "Continuity of care benefits" appears as three separate subject labels.`)
  console.log(`     A floor of zero is uninformative, so it is reported as uninformative rather than as`)
  console.log(`     reassurance. §4's clustering difficulty stands entirely unaddressed.`)
  await endNeonPool()
}

function design() {
  console.log(`
════ THE SCORING, FIXED BEFORE ANY EXTRACTION RAN (§4 requires this) ════

  1. RECALL   For each of the 23 positions the hand-read certified CORRECT, did the bottom-up pass
              produce a claim covering the same question from the same submission? Matching is by a
              separate call that must ECHO the claim verbatim; an unmatched echo counts as no match.

  2. NOVELTY  How many extracted claims match none of the 83. ⚠ A volume, not a value.

  3. COST     Both arms over the same submissions, in the same session, on the same meter.

  4. HAND READ  A reproducible sample, read by a person, sorted into REAL vs
              TRIVIA / RESTATEMENT / SELF-DESCRIPTION / NOT-A-CLAIM.
              ⚠ THIS IS THE MEASURE THAT DECIDES. Measure 2 without it is the trap.

  NOT MEASURED: clustering across wordings. The duplicate-string count is a floor on that problem
  and is reported as a floor.

  DECISION RULE, stated before the numbers exist: bottom-up replaces top-down only if it matches a
  majority of the certified-correct positions AND its novel claims survive the hand read AND the
  cost is comparable. Failing any one of the three, it is a supplement or a no.
`)
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const cases: Array<[string, boolean]> = [
    ['⚠ the bottom-up prompt names no policy area', !/health|social care|NHS/i.test(BU_PROMPT)],
    ['⚠ the bottom-up prompt names no proposition', !/proposition/i.test(BU_PROMPT)],
    ['it refuses self-description', /who the submitter is/i.test(BU_PROMPT)],
    ['it refuses reference-list entries', /reference-list entry/i.test(BU_PROMPT)],
    ['it refuses courtesies', /we welcome the Committee/i.test(BU_PROMPT)],
    ['it asks for claims off the inquiry\'s subject', /whether or not they relate to the inquiry/i.test(BU_PROMPT)],
    ['it demands a verbatim quote', /COPIED VERBATIM AND CONTIGUOUSLY/.test(BU_PROMPT)],
    ['isAboutSelf is a returned field, so self-description is counted not estimated',
      Object.keys((BU_SCHEMA.properties.claims.items as { properties: Record<string, unknown> }).properties).includes('isAboutSelf')],
    ['⚠ no enum in either schema contains an empty string — Gemini 400s on that',
      !JSON.stringify([BU_SCHEMA, MATCH_SCHEMA, TD_SCHEMA]).includes('""')],
    ['the matcher refuses same-subject matches', /not merely the same subject/i.test(MATCH_PROMPT)],
    ['the matcher requires a verbatim echo', /COPIED EXACTLY as it appears/i.test(MATCH_PROMPT)],
    ['the matcher defaults to false', /If in doubt, answer false/i.test(MATCH_PROMPT)],
    ['the top-down arm writes no positions', !/INSERT INTO graph_position/.test(String(runTopDownCost))],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) return selftest()
  if (flag('design')) return design()
  if (flag('topdown')) return runTopDownCost()
  if (flag('match')) return match()
  if (flag('novelty')) return novelty()
  if (flag('report')) return report()
  if (flag('handsample')) return handsample(num('handsample', 40))
  await runBottomUp()
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
