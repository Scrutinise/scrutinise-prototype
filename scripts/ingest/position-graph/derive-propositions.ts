/**
 * derive-propositions.ts — BRIEF_GRAPH_2D3 §1, "the proposition unit".
 *
 * The vocabulary has to exist and be READABLE before any position is extracted against it: the
 * brief's instruction is "report the propositions before extracting positions against them, so the
 * vocabulary is inspectable before it is used". So this script is a separate step with its own
 * report, not a stage inside the extractor.
 *
 * Design §2: the atom is a PROPOSITION — a specific contestable claim — never a topic. "Dentistry"
 * is not a proposition. "NHS dental contracts should be renegotiated" is, because an organisation
 * can be for it, against it, or explicitly balanced on it.
 *
 * Steps (each idempotent, each re-runnable alone):
 *   npx tsx position-graph/derive-propositions.ts --self-test        # offline. No network, no DB.
 *   npx tsx position-graph/derive-propositions.ts --edm-test         # Amendment 1's claim, measured
 *   npx tsx position-graph/derive-propositions.ts --derive [--pilot 2]
 *   npx tsx position-graph/derive-propositions.ts --cluster
 *   npx tsx position-graph/derive-propositions.ts --report
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA, areaEdgeCte, areaInquirySql } from './area-2d3'
import { geminiJson, mapLimit, MODEL } from './llm-2d3'
import { newMeter, meterLine } from './cost-2d3'
import { getDocText, firstWords } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const num = (name: string, dflt: number) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? parseInt(argv[i + 1], 10) : dflt }

/** How many inquiries the run covers. 12 is Charlie's bound, priced at ~$6.84 by probe-2d3-cost.ts. */
export const N_INQUIRIES = num('inquiries', 12)
/** Submissions sampled per inquiry to derive its candidate claims. */
const SAMPLE_PER_INQUIRY = num('sample', 14)
/** Words of each sampled submission shown to the deriver. The case is made early in a submission. */
const SAMPLE_WORDS = 900
const RUN_ID = process.env.GRAPH_2D3_RUN_ID ?? 'derive-2d3'
const CONCURRENCY = num('concurrency', 4)

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE PROMPTS. Both are here rather than in a constants file because the wording IS the method.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const DERIVE_SYSTEM = `You build the vocabulary for a UK parliamentary scrutiny tool that maps who supports and who opposes specific policy claims.

Your job: read excerpts from written evidence submitted to one select committee inquiry, and name the CONTESTED PROPOSITIONS running through them.

A PROPOSITION is a specific, contestable claim about what should be done or what is the case, stated as a declarative sentence, on which a submitter can be FOR, AGAINST, or explicitly BALANCED.

Good propositions:
  "Section 21 no-fault eviction should be abolished."
  "NHS dental contracts should be renegotiated to require a minimum NHS commitment."
  "Assisted dying should be legalised for terminally ill adults."

NOT propositions, and never return these:
  · a topic or an area ("dentistry", "workforce pressures")
  · a question ("should assisted dying be legalised?")
  · a claim nobody in the material disputes ("mental health matters")
  · a claim so vague that being against it is meaningless ("services should be improved")
  · a statement of uncontested fact ("the population is ageing")

RULES
1. Every proposition must be CONTESTED — there must be a real prospect that some submitters to this
   inquiry take one side and some the other. If a claim is universally agreed in the excerpts, it is
   not a proposition; leave it out.
2. State it in the AFFIRMATIVE, so that "for" and "against" are both meaningful readings.
3. Be SPECIFIC enough that two people reading it would agree what would count as supporting it.
4. Do not invent claims the excerpts do not raise.
5. Between 4 and 10 propositions. Fewer is better than padding with topics.
6. British English. No markdown.`

// ⚠ THERE IS NO `sourceIndexes` FIELD, AND ITS ABSENCE IS A CORRECTION MADE MID-SPRINT.
// The first version asked the model which excerpt each proposition came from, by index. The EDM
// test then caught the model returning indexes that did not match its own output order — the salt
// motion labelled with the Scottish SI's index, the homelessness proposition labelled with the
// midwifery motion's. A model-supplied index is an UNVERIFIABLE correlation and this sprint does
// not store one. `source_refs` instead records the section ids of every excerpt the call was shown,
// which is true, checkable, and less precise than a fabricated precision.
const DERIVE_SCHEMA = {
  type: 'object',
  properties: {
    propositions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['text', 'rationale'],
      },
    },
  },
  required: ['propositions'],
}

const CLUSTER_SYSTEM = `You are merging a list of candidate policy propositions into one canonical vocabulary.

The candidates were derived independently from different select committee inquiries in the same
policy area, so the SAME claim often appears more than once in different words. Your job is to
produce the canonical list.

RULES
1. Merge candidates that are the SAME CLAIM in different wording. Do NOT merge claims that are
   merely on the same topic — "NHS dentistry needs more funding" and "NHS dental contracts should be
   renegotiated" are different claims and must stay separate. When in doubt, keep them separate: two
   near-duplicate propositions are a visible, fixable problem; one proposition covering two claims
   is an invisible one that will corrupt every position attached to it.
2. Where you merge, choose the clearest, most specific wording — or write a better one that covers
   exactly what the merged candidates say and nothing more.
3. DROP a candidate that is a topic, a question, uncontested, or too vague to be against. Say so by
   simply not including it in any canonical proposition.
4. For every canonical proposition, list the candidates it covers by REPEATING THEIR TEXT EXACTLY,
   character for character, as it was given to you. Do not paraphrase a candidate in this list and
   do not use its number. An entry that does not match a candidate word for word will be discarded.
5. Aim for 25 to 45 canonical propositions. British English. No markdown.`

// ⚠ `candidateTexts`, NOT indexes — same correction as DERIVE_SCHEMA, and here it is load-bearing
// rather than cosmetic: the candidate→proposition mapping decides which inquiries a proposition is
// put to, and a mis-indexed mapping would silently address the wrong submissions. A verbatim echo
// can be CHECKED against the candidate list; an integer cannot.
const CLUSTER_SCHEMA = {
  type: 'object',
  properties: {
    propositions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          candidateTexts: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'candidateTexts'],
      },
    },
    droppedReason: { type: 'string' },
  },
  required: ['propositions'],
}

const EDM_SYSTEM = `You are testing whether an early day motion's text works as a contestable policy PROPOSITION.

An EDM is a motion an MP tables to put a view on the record. Some are genuine policy claims; many
congratulate a constituent, mark an anniversary, or note a local event, and those are not
contestable propositions at all.

For each motion, decide:
  · contestable: could a reasonable, informed person be AGAINST this? If the only possible response
    is agreement or indifference (a congratulation, a tribute, a factual note), it is NOT contestable.
  · proposition: if contestable, the single clearest declarative claim the motion makes, in the
    affirmative, specific enough to be for or against. If not contestable, return an empty string.
  · scope: "general-policy" if the claim is about policy in general and other bodies could plausibly
    take a side on the SAME claim ("NHS dental contracts should require a minimum NHS commitment").
    "specific-instance" if it is about one named place, one named person, one named closure or one
    named statutory instrument, so that nobody else would ever be for or against that same claim
    ("the closure of Calderstones Hospital should be reviewed").

Be strict. A motion that "calls on the Government to do more about X" where X is universally
supported is NOT contestable. British English. No markdown.`

const EDM_SCHEMA = {
  type: 'object',
  properties: {
    motions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          contestable: { type: 'boolean' },
          proposition: { type: 'string' },
          scope: { type: 'string', enum: ['general-policy', 'specific-instance'] },
        },
        required: ['index', 'contestable', 'proposition', 'scope'],
      },
    },
  },
  required: ['motions'],
}

// ════════════════════════════════════════════════════════════════════════════════════════════════

interface Inquiry { object_ref: string; label: string; secs: string; words: string }

async function topInquiries(pool: ReturnType<typeof getNeonPool>, k: number): Promise<Inquiry[]> {
  const { rows } = await pool.query<Inquiry>(areaInquirySql())
  return rows.slice(0, k)
}

/** A deterministic spread of submissions across DISTINCT submitters within one inquiry. */
async function sampleSubmissions(pool: ReturnType<typeof getNeonPool>, inquiryRef: string, n: number) {
  const { rows } = await pool.query<{ section_id: string; r2key: string; org: string; d: string; words: number }>(`
    WITH ${areaEdgeCte()},
    x AS (
      SELECT DISTINCT ON (gv.section_id) gv.section_id, en.canonical_name AS org, en.id AS entity_id
      FROM e JOIN graph_evidence gv ON gv.edge_id = e.edge_id
             JOIN graph_entity en ON en.id = e.subject_id
      WHERE e.object_ref = $1
      ORDER BY gv.section_id, (en.kind = 'organisation') DESC, en.id
    )
    SELECT DISTINCT ON (x.entity_id) x.section_id, c."r2Key" AS r2key, x.org,
           c."itemDate"::text AS d, c."wordCount" AS words
    FROM x JOIN corpus_sections c ON c.id = x.section_id
    WHERE c."r2Key" IS NOT NULL AND c."wordCount" > 250
    ORDER BY x.entity_id, md5(x.section_id)`, [inquiryRef])
  // One submission per submitting entity, then a stable pseudo-random order: the same sample on
  // every re-run, and no bias towards the longest or the earliest submission.
  return shuffleStable(rows).slice(0, n)
}

/** The key an echoed candidate is matched back on. Punctuation and case only — never a paraphrase. */
export const normProp = (s: string) =>
  s.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ').trim()

/** Deterministic shuffle by md5-ish hash of the id — same order on every machine, every run. */
export function shuffleStable<T extends { section_id: string }>(rows: T[]): T[] {
  const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) } return x >>> 0 }
  return [...rows].sort((a, b) => h(a.section_id) - h(b.section_id))
}

// ── step: derive candidates, one call per inquiry ───────────────────────────────────────────────
async function derive(pool: ReturnType<typeof getNeonPool>) {
  const meter = newMeter()
  const inquiries = await topInquiries(pool, N_INQUIRIES)
  console.log(`\n════ DERIVE — ${inquiries.length} inquiries in "${AREA}" ════`)

  let written = 0
  await mapLimit(inquiries, CONCURRENCY, async (inq) => {
    const { rows: existing } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM graph_proposition_candidate WHERE area=$1 AND inquiry_ref=$2`, [AREA, inq.object_ref])
    if (Number(existing[0].n) > 0) { console.log(`  · ${inq.label.slice(0, 58).padEnd(58)} ${existing[0].n} candidates already — skipped`); return }

    const sample = await sampleSubmissions(pool, inq.object_ref, SAMPLE_PER_INQUIRY)
    const texts = await Promise.all(sample.map(async (s) => ({ s, t: await getDocText(s.r2key) })))
    const usable = texts.filter((x) => x.t) as Array<{ s: typeof sample[0]; t: string }>
    if (usable.length < 3) { console.log(`  ✗ ${inq.label.slice(0, 58)} — only ${usable.length} readable submissions, skipped`); return }

    const user = `INQUIRY: ${inq.label}\nCOMMITTEE: ${AREA}\n\n`
      + usable.map((x, i) => `--- EXCERPT ${i} (${x.s.org}, ${x.s.d}) ---\n${firstWords(x.t, SAMPLE_WORDS)}`).join('\n\n')

    const res = await geminiJson<{ propositions: Array<{ text: string; rationale: string }> }>({
      system: DERIVE_SYSTEM, user, schema: DERIVE_SCHEMA, maxOutputTokens: 4096,
      label: `derive:${inq.object_ref}`, meter, temperature: 0.2,
    })
    if (res.kind !== 'ok') { console.log(`  ✗ ${inq.label.slice(0, 58)} — ${res.kind}: ${res.detail.slice(0, 140)}`); return }

    // Provenance is the SET the call was shown, not a per-proposition index the model asserted.
    const refs = usable.map((x) => x.s.section_id)
    const props = res.value.propositions ?? []
    for (const p of props) {
      if (!p.text?.trim()) continue
      await pool.query(
        `INSERT INTO graph_proposition_candidate (area, inquiry_ref, inquiry_label, text, rationale, source_kind, source_refs, run_id)
         VALUES ($1,$2,$3,$4,$5,'committee-evidence',$6::jsonb,$7)`,
        [AREA, inq.object_ref, inq.label, p.text.trim(), p.rationale ?? null, JSON.stringify(refs), RUN_ID])
      written++
    }
    console.log(`  ✓ ${inq.label.slice(0, 58).padEnd(58)} ${String(props.length).padStart(2)} candidates from ${usable.length} submissions`)
  })

  console.log(`\n  ${written} candidates written · ${meterLine(meter)}`)
}

// ── step: cluster candidates into the canonical vocabulary ──────────────────────────────────────
async function cluster(pool: ReturnType<typeof getNeonPool>) {
  const meter = newMeter()
  const { rows: cands } = await pool.query<{ id: string; text: string; inquiry_ref: string; inquiry_label: string }>(
    `SELECT id::text, text, inquiry_ref, inquiry_label FROM graph_proposition_candidate WHERE area=$1 ORDER BY id`, [AREA])
  if (!cands.length) { console.log('  no candidates — run --derive first'); return }
  const { rows: [have] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text n FROM graph_proposition WHERE area=$1`, [AREA])
  if (Number(have.n) > 0) { console.log(`  ${have.n} propositions already exist for this area — nothing to do (delete them to re-cluster)`); return }

  console.log(`\n════ CLUSTER — ${cands.length} candidates from ${new Set(cands.map((c) => c.inquiry_ref)).size} inquiries ════`)
  const user = cands.map((c) => `[${c.inquiry_label}] ${c.text}`).join('\n')
  const res = await geminiJson<{ propositions: Array<{ text: string; candidateTexts: string[] }>; droppedReason?: string }>({
    system: CLUSTER_SYSTEM, user, schema: CLUSTER_SCHEMA, maxOutputTokens: 16384, label: 'cluster', meter, temperature: 0.1,
  })
  if (res.kind !== 'ok') { console.error(`  ✗ cluster ${res.kind}: ${res.detail}`); process.exitCode = 1; return }

  // The echo is matched back to the candidate list by normalised text. An echo that matches nothing
  // is DISCARDED and counted — it is either a paraphrase (the prompt forbids one) or an invention,
  // and either way it cannot be allowed to decide which submissions a proposition is put to.
  const byNorm = new Map<string, typeof cands[0]>()
  for (const c of cands) byNorm.set(normProp(c.text), c)
  let echoHit = 0
  let echoMiss = 0
  const claimed = new Set<string>()

  let n = 0
  for (const p of res.value.propositions ?? []) {
    if (!p.text?.trim()) continue
    const members: typeof cands = []
    for (const echo of p.candidateTexts ?? []) {
      const hit = byNorm.get(normProp(echo))
      if (hit) { members.push(hit); claimed.add(hit.id); echoHit++ } else { echoMiss++ }
    }
    const inquiryRefs = [...new Set(members.map((m) => m.inquiry_ref))]
    const { rows: [row] } = await pool.query<{ id: string }>(
      `INSERT INTO graph_proposition (area, text, inquiry_refs, n_candidates, derived_from, run_id)
       VALUES ($1,$2,$3::jsonb,$4,'committee-evidence',$5)
       ON CONFLICT (area, text) DO UPDATE SET n_candidates = graph_proposition.n_candidates
       RETURNING id::text`,
      [AREA, p.text.trim(), JSON.stringify(inquiryRefs), members.length, RUN_ID])
    if (members.length) {
      await pool.query(`UPDATE graph_proposition_candidate SET proposition_id=$1 WHERE id = ANY($2::bigint[])`,
        [row.id, members.map((m) => m.id)])
    }
    n++
  }
  console.log(`  ${n} canonical propositions from ${cands.length} candidates`)
  console.log(`  candidate echoes matched verbatim   ${echoHit}`)
  console.log(`  echoes matching NO candidate        ${echoMiss}${echoMiss ? '  ⚠ discarded — a paraphrase or an invention, either way unusable as a mapping' : ''}`)
  console.log(`  candidates adopted into a proposition ${claimed.size} · dropped ${cands.length - claimed.size} (${res.value.droppedReason ?? 'no reason given'})`)
  console.log(`  ${meterLine(meter)}`)
}

// ── step: Amendment 1's claim, measured rather than adopted ─────────────────────────────────────
type EdmVerdict = { index: number; contestable: boolean; proposition: string; scope: string }

async function edmTest(pool: ReturnType<typeof getNeonPool>) {
  const meter = newMeter()
  const N = num('edm-sample', 60)
  console.log(`\n════ AMENDMENT 1 TEST — is an EDM's text a proposition? ════`)
  console.log(`  Amendment 1 §1: "an EDM's text is usually a single compound proposition … it may make`)
  console.log(`  EDMs the cheapest place to BOOTSTRAP the proposition set". Two samples, because one`)
  console.log(`  of them would answer a different question than the amendment asks:`)
  console.log(`    A — 60 EDMs whose TITLE matches a health keyword. ⚠ That filter is a curation act`)
  console.log(`        and is used ONLY to test the claim on material from the chosen area.`)
  console.log(`    B — 60 EDMs drawn at random from all 60,737, no filter. This is the UNCONDITIONAL`)
  console.log(`        rate, and it is the one that says what the register is actually made of.`)

  const HEALTH_RE = '(health|nhs|social care|hospital|patient|general practi|nurs|dentist|mental health|care home|ambulance|pharmac|maternity|cancer|obesity|smoking|vaping|alcohol|carers)'
  const draw = async (where: string) => {
    const { rows } = await pool.query<{ id: string; t: string; k: string; d: string }>(`
      SELECT id, "sectionTitle" t, "r2Key" k, "itemDate"::text d
      FROM corpus_sections
      WHERE corpus='early-day-motions' AND "r2Key" IS NOT NULL ${where}
      ORDER BY md5(id) LIMIT $1`, [N])
    const texts = await Promise.all(rows.map(async (r) => ({ r, t: await getDocText(r.k) })))
    return texts.filter((x) => x.t) as Array<{ r: typeof rows[0]; t: string }>
  }

  const run = async (name: string, usable: Awaited<ReturnType<typeof draw>>) => {
    const user = usable.map((x, i) => `${i}. [${x.r.d}] ${firstWords(x.t, 220)}`).join('\n\n')
    const res = await geminiJson<{ motions: EdmVerdict[] }>({
      system: EDM_SYSTEM, user, schema: EDM_SCHEMA, maxOutputTokens: 8192, label: `edm-test:${name}`, meter, temperature: 0.1,
    })
    if (res.kind !== 'ok') { console.error(`  ✗ ${name} ${res.kind}: ${res.detail}`); process.exitCode = 1; return null }
    const raw = res.value.motions ?? []
    // ⚠ THE CORRELATION IS ARRAY POSITION, NOT THE MODEL'S `index`. The first run of this test
    // attributed the salt motion's proposition to the Scottish SI and the homelessness proposition
    // to the midwifery motion — the model's own index field disagreed with its own output order.
    // Position is used, the disagreement is COUNTED, and a length mismatch voids the sample rather
    // than being silently zipped against the wrong motions (the same contract as gemini-sync's
    // "order correlation needs 1:1").
    const lengthOk = raw.length === usable.length
    const misIndexed = raw.filter((m, i) => m.index !== i).length
    const out = raw.map((m, i) => ({ ...m, index: i }))
    const contestable = out.filter((m) => m.contestable && m.proposition?.trim())
    const general = contestable.filter((m) => m.scope === 'general-policy')
    console.log(`\n  ── SAMPLE ${name} — ${usable.length} motions read ──`)
    console.log(`    1:1 with the input                ${lengthOk ? 'yes' : `NO — ${raw.length} verdicts for ${usable.length} motions; SAMPLE VOID`}`)
    console.log(`    model index ≠ array position      ${String(misIndexed).padStart(3)}  ${misIndexed ? '⚠ the model-supplied index is not usable; position is' : ''}`)
    if (!lengthOk) return null
    console.log(`    contestable, with a proposition   ${String(contestable.length).padStart(3)}  (${(100 * contestable.length / Math.max(1, out.length)).toFixed(1)}%)`)
    console.log(`      of those, GENERAL POLICY        ${String(general.length).padStart(3)}  (${(100 * general.length / Math.max(1, out.length)).toFixed(1)}% of all motions read)`)
    console.log(`      of those, SPECIFIC INSTANCE     ${String(contestable.length - general.length).padStart(3)}  — one named hospital, closure, person or SI:`)
    console.log(`                                           nobody else is ever for or against the SAME claim`)
    console.log(`    not contestable                   ${String(out.length - contestable.length).padStart(3)}`)
    return { out, contestable, general, usable }
  }

  const a = await run('A (health-titled)', await draw(`AND "sectionTitle" ~* '${HEALTH_RE}'`))
  const b = await run('B (unfiltered)', await draw(''))
  if (a) {
    console.log(`\n  the first six GENERAL-POLICY propositions from sample A, so the grain can be judged:`)
    for (const m of a.general.slice(0, 6)) console.log(`    · ${m.proposition}\n      ← ${a.usable[m.index]?.r.t ?? '(?)'} (${a.usable[m.index]?.r.d ?? '?'})`)
    console.log(`\n  and the first six SPECIFIC-INSTANCE ones, which is the grain problem itself:`)
    for (const m of a.contestable.filter((x) => x.scope !== 'general-policy').slice(0, 6)) {
      console.log(`    · ${m.proposition}\n      ← ${a.usable[m.index]?.r.t ?? '(?)'} (${a.usable[m.index]?.r.d ?? '?'})`)
    }
  }
  if (b) {
    console.log(`\n  and six motions sample B judged NOT contestable, so the negative is checkable too:`)
    for (const m of b.out.filter((x) => !x.contestable).slice(0, 6)) console.log(`    · ${b.usable[m.index]?.r.t ?? '(?)'} (${b.usable[m.index]?.r.d ?? '?'})`)
  }
  console.log(`\n  ${meterLine(meter)}`)
}

// ── step: report the vocabulary ─────────────────────────────────────────────────────────────────
async function report(pool: ReturnType<typeof getNeonPool>) {
  const { rows } = await pool.query<{ id: string; text: string; n: string; refs: string[]; is_cross: boolean }>(`
    SELECT id::text, text, n_candidates::text n,
           ARRAY(SELECT jsonb_array_elements_text(inquiry_refs)) refs,
           jsonb_array_length(inquiry_refs) > 1 AS is_cross
    FROM graph_proposition WHERE area=$1 ORDER BY jsonb_array_length(inquiry_refs) DESC, n_candidates DESC, id`, [AREA])
  const { rows: labels } = await pool.query<{ object_ref: string; label: string }>(
    `SELECT DISTINCT inquiry_ref object_ref, inquiry_label label FROM graph_proposition_candidate WHERE area=$1`, [AREA])
  const nameOf = new Map(labels.map((l) => [l.object_ref, l.label]))
  console.log(`\n════ THE VOCABULARY — ${rows.length} propositions for "${AREA}" ════`)
  console.log(`  (${rows.filter((r) => r.is_cross).length} cross-cutting: derived from more than one inquiry, so put to every`)
  console.log(`   submission in the run. The rest are put only to their own inquiry's submissions.)\n`)
  for (const r of rows) {
    console.log(`  #${r.id.padStart(3)} ${r.is_cross ? '↔' : ' '} ${r.text}`)
    console.log(`        from ${r.n} candidate(s) · ${r.refs.map((x) => (nameOf.get(x) ?? x).slice(0, 40)).join(' | ')}`)
  }
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const rows = Array.from({ length: 20 }, (_, i) => ({ section_id: `sec:${i}` }))
  const a = shuffleStable(rows).map((r) => r.section_id).join(',')
  const b = shuffleStable([...rows].reverse()).map((r) => r.section_id).join(',')
  const cases: Array<[string, boolean]> = [
    ['shuffleStable is deterministic regardless of input order', a === b],
    ['shuffleStable is not the identity (it really shuffles)', a !== rows.map((r) => r.section_id).join(',')],
    ['shuffleStable keeps every row', shuffleStable(rows).length === rows.length],
    ['the derive prompt forbids topics', /NOT propositions/.test(DERIVE_SYSTEM) && /a topic or an area/.test(DERIVE_SYSTEM)],
    ['the cluster prompt refuses topic-merging', /Do NOT merge claims that are\n\s*merely on the same topic/.test(CLUSTER_SYSTEM)],
    ['the EDM prompt can answer "not contestable"', /NOT contestable/.test(EDM_SYSTEM)],
    // The index correction, asserted so it cannot be undone by a later edit that "tidies up".
    ['no schema asks the model for an index', !/sourceIndexes|candidateIndexes/.test(JSON.stringify(DERIVE_SCHEMA) + JSON.stringify(CLUSTER_SCHEMA))],
    ['the cluster echo demands verbatim text', /REPEATING THEIR TEXT EXACTLY/.test(CLUSTER_SYSTEM)],
    ['normProp matches across punctuation and case', normProp('NHS  dental-contracts should be renegotiated.') === normProp('nhs dental contracts should be renegotiated')],
    ['normProp does NOT match a paraphrase', normProp('NHS dental contracts should be renegotiated') !== normProp('NHS dentistry contracts ought to be renegotiated')],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    if (flag('edm-test')) await edmTest(pool)
    if (flag('derive')) await derive(pool)
    if (flag('cluster')) await cluster(pool)
    if (flag('report') || (!flag('derive') && !flag('cluster') && !flag('edm-test'))) await report(pool)
  } finally { await endNeonPool() }
}
// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[derive-propositions] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
