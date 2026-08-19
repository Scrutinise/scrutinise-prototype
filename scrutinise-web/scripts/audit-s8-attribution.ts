// ─────────────────────────────────────────────────────────────────────────────
// audit-s8-attribution.ts — BRIEF_SEARCH_S8 §2. The audit that decides the section's scope.
//
// The question §2 asks: for each non-legislation collection served through the evidence
// channel, does the STORED SECTION or its metadata carry speaker / witness / author / court
// as a STRUCTURED FIELD, or is it only folded into the title string, or absent?
//
// ⚠ THREE TRAPS THIS SCRIPT EXISTS TO AVOID, each of which caught the first draft:
//
//  1. READING THE SCHEMA INSTEAD OF THE STORE. `corpus_sections.attribution` and
//     `corpus_sections.speaker` both EXIST. `attribution` is null on ten of the twelve
//     collections that have it. A schema read reports twelve.
//
//  2. READING ONE COLUMN. There are two candidates, not one — and the FTS index carries
//     `speaker` as a first-class field too (`FtsHit.speaker`). A sweep of `attribution`
//     alone reports "no structured attribution anywhere" with a 99%-populated column
//     sitting beside the one it read.
//
//  3. ⚠⚠ `LIMIT n` WITH NO `ORDER BY`. That returns one physical corner of the heap. On
//     `pwdata-debates` — 15M rows spanning 1919 to 2026 — the first draft's corner read
//     0/200 on `speaker` for a collection that is 99% populated from 1990 onward. Every
//     sample below is taken at SEVERAL id offsets and reported per offset, because the
//     spread between them is itself the finding.
//
// ⚠ NO WHOLE-TABLE AGGREGATES. A bare `GROUP BY corpus` over 18.3M rows does not return
// inside a sensible timeout; the first draft was killed for it. Every count is LIMIT-bounded
// and every percentage below is "of the rows sampled", never "of the collection".
//
//   npm run audit:s8-attribution
// ─────────────────────────────────────────────────────────────────────────────

import { Client } from 'pg'

const SAMPLE = 200

/**
 * EVERY non-legislation collection served through the evidence channel, grouped by the display
 * type it reaches a user as (lib/lex/corpus-type-map.ts).
 *
 * ⚠⚠ THE LIST IS TAKEN FROM `docs/corpus_completeness.json`, NOT INVENTED. The first draft of
 * this script guessed corpus names — it probed `caselaw`, `guidance`, `hansard` and `tribunals`,
 * none of which exist, and reported them as "NO COMPILED ROWS" while never sampling
 * `tna-caselaw`, the collection that actually serves every case-law result. The §2 measurement
 * run is what caught it: a retrieved result arrived labelled `tna-caselaw` from a script that had
 * just reported case law unsampled. **A corpus name is a fact to look up, not a word to guess.**
 *
 * Offsets: more than one per collection wherever the ids carry an ordering that means something
 * — a date, a publication number — because that is the axis coverage actually varies along.
 */
const COLLECTIONS: Array<{ type: string; label: string; corpus: string; offsets: string[] }> = [
  // ── COMMITTEE ────────────────────────────────────────────────────────────────────────────
  { type: 'COMMITTEE', label: 'committees — written and oral evidence', corpus: 'committees-evidence',
    offsets: ['', 'committees-evidence:oralevidence:5', 'committees-evidence:w', 'committees-evidence:writtenevidence:9'] },
  { type: 'COMMITTEE', label: 'committees — reports', corpus: 'committees-reports',
    offsets: ['', 'committees-reports:publication:3', 'committees-reports:publication:6'] },
  // ── DEBATE ───────────────────────────────────────────────────────────────────────────────
  { type: 'DEBATE', label: 'Commons debates (Hansard)', corpus: 'pwdata-debates',
    offsets: ['pwdata-debates:debates19', 'pwdata-debates:debates195', 'pwdata-debates:debates199',
              'pwdata-debates:debates201', 'pwdata-debates:debates2026'] },
  { type: 'DEBATE', label: 'Lords debates', corpus: 'pwdata-lords', offsets: ['', 'pwdata-lords:lords201'] },
  { type: 'DEBATE', label: 'historic Hansard', corpus: 'historic-hansard', offsets: [''] },
  { type: 'DEBATE', label: 'Westminster Hall', corpus: 'pwdata-westminster', offsets: [''] },
  { type: 'DEBATE', label: 'written answers (pwdata)', corpus: 'pwdata-wrans', offsets: [''] },
  { type: 'DEBATE', label: 'written statements (pwdata)', corpus: 'pwdata-wms', offsets: [''] },
  { type: 'DEBATE', label: 'Lords written answers', corpus: 'pwdata-lordswrans', offsets: [''] },
  { type: 'DEBATE', label: 'Lords written statements', corpus: 'pwdata-lordswms', offsets: [''] },
  { type: 'DEBATE', label: 'written answers (govuk)', corpus: 'written-answers', offsets: [''] },
  { type: 'DEBATE', label: 'written statements (govuk)', corpus: 'written-statements', offsets: [''] },
  { type: 'DEBATE', label: 'Scottish Parliament', corpus: 'scottish-parliament-or', offsets: ['', 'scottish-parliament-or:2'] },
  { type: 'DEBATE', label: 'Senedd', corpus: 'senedd-cofnod', offsets: [''] },
  { type: 'DEBATE', label: 'NI Assembly', corpus: 'niassembly-hansard', offsets: [''] },
  { type: 'DEBATE', label: 'early day motions', corpus: 'early-day-motions', offsets: [''] },
  { type: 'DEBATE', label: 'petitions', corpus: 'petitions', offsets: [''] },
  { type: 'DEBATE', label: 'Commons oral questions (LDA)', corpus: 'lda-commonsoralquestions', offsets: [''] },
  { type: 'DEBATE', label: 'Commons written questions (LDA)', corpus: 'lda-commonswrittenquestions', offsets: [''] },
  { type: 'DEBATE', label: 'Commons divisions (LDA)', corpus: 'lda-commonsdivisions', offsets: [''] },
  // ── CASE_LAW ─────────────────────────────────────────────────────────────────────────────
  { type: 'CASE_LAW', label: 'UK case law (TNA)', corpus: 'tna-caselaw', offsets: ['', 'tna-caselaw:ewca', 'tna-caselaw:uksc'] },
  { type: 'CASE_LAW', label: 'Northern Ireland judgments', corpus: 'ni-judgments', offsets: [''] },
  { type: 'CASE_LAW', label: 'Scottish courts', corpus: 'scottish-courts', offsets: [''] },
  { type: 'CASE_LAW', label: 'employment tribunals', corpus: 'et-decisions', offsets: [''] },
  { type: 'CASE_LAW', label: 'tax tribunals', corpus: 'tax-tribunals', offsets: [''] },
  { type: 'CASE_LAW', label: 'Strasbourg (HUDOC)', corpus: 'echr-hudoc', offsets: [''] },
  // ── GUIDANCE ─────────────────────────────────────────────────────────────────────────────
  { type: 'GUIDANCE', label: 'HMRC manuals', corpus: 'hmrc-manuals', offsets: [''] },
  { type: 'GUIDANCE', label: 'FCA Handbook', corpus: 'fca-handbook', offsets: [''] },
  { type: 'GUIDANCE', label: 'ICO', corpus: 'ico', offsets: [''] },
  { type: 'GUIDANCE', label: 'Ofgem', corpus: 'ofgem', offsets: [''] },
  { type: 'GUIDANCE', label: 'Ofcom', corpus: 'ofcom', offsets: [''] },
  { type: 'GUIDANCE', label: 'CMA cases', corpus: 'cma-cases', offsets: [''] },
  { type: 'GUIDANCE', label: 'CPS guidance', corpus: 'cps-guidance', offsets: [''] },
  { type: 'GUIDANCE', label: 'College of Policing', corpus: 'college-of-policing', offsets: [''] },
  { type: 'GUIDANCE', label: 'Sentencing Council', corpus: 'sentencing-council', offsets: [''] },
  { type: 'GUIDANCE', label: 'planning policy', corpus: 'planning-policy', offsets: [''] },
  { type: 'GUIDANCE', label: 'building regulations', corpus: 'building-regs', offsets: [''] },
  { type: 'GUIDANCE', label: 'NAO reports', corpus: 'nao-reports', offsets: [''] },
  { type: 'GUIDANCE', label: 'inquiry reports', corpus: 'inquiry-reports', offsets: [''] },
  { type: 'GUIDANCE', label: 'inquiry evidence', corpus: 'inquiry-evidence', offsets: [''] },
  { type: 'GUIDANCE', label: 'independent reviews', corpus: 'independent-reviews', offsets: [''] },
  { type: 'GUIDANCE', label: 'Law Commission', corpus: 'lawcom', offsets: [''] },
  { type: 'GUIDANCE', label: 'LGSCO', corpus: 'lgsco', offsets: [''] },
  { type: 'GUIDANCE', label: 'OECD', corpus: 'oecd', offsets: [''] },
  { type: 'GUIDANCE', label: 'Erskine May', corpus: 'erskine-may', offsets: [''] },
  { type: 'GUIDANCE', label: 'govuk core documents', corpus: 'govuk-core-docs', offsets: [''] },
  // ── the S2C6 political four, plus explanatory material ───────────────────────────────────
  { type: 'CONSULTATION', label: 'consultations', corpus: 'consultations', offsets: ['', 'consultations:government_consultations_s'] },
  { type: 'IMPACT_ASSESSMENT', label: 'impact assessments', corpus: 'impact-assessments', offsets: ['', 'impact-assessments:2020'] },
  { type: 'EXPLANATORY_NOTE', label: 'explanatory notes', corpus: 'explanatory-notes', offsets: [''] },
  { type: 'EXPLANATORY_NOTE', label: 'explanatory memoranda', corpus: 'explanatory-memoranda', offsets: [''] },
  { type: 'DIVISION', label: 'divisions — Commons', corpus: 'commons-divisions-votes', offsets: [''] },
  { type: 'DIVISION', label: 'divisions — Lords', corpus: 'lords-divisions-votes', offsets: [''] },
  { type: 'BILL', label: 'bills', corpus: 'bills-api', offsets: [''] },
  { type: 'TREATY', label: 'treaties', corpus: 'uk-treaties', offsets: [''] },
]

const say = (s: string) => process.stdout.write(s + '\n')
const pct = (a: number, b: number) => b ? `${((a / b) * 100).toFixed(1)}%` : '—'

interface Slice { n: number; speaker: number; attribution: number; firstId: string; lastId: string
                  egSpeaker: string | null; egAttribution: string | null; egTitle: string | null }

async function slice(c: Client, corpus: string, after: string): Promise<Slice | null> {
  const r = await c.query(
    `SELECT id, "sectionTitle", speaker, attribution FROM corpus_sections
     WHERE corpus = $1 AND id > $2 AND status = 'compiled'
     ORDER BY id LIMIT $3`, [corpus, after, SAMPLE])
  if (!r.rowCount) return null
  const nonEmpty = (v: unknown) => v != null && String(v).trim() !== ''
  const sp = r.rows.filter((x) => nonEmpty(x.speaker))
  const at = r.rows.filter((x) => nonEmpty(x.attribution))
  return {
    n: r.rowCount, speaker: sp.length, attribution: at.length,
    firstId: r.rows[0].id, lastId: r.rows[r.rowCount - 1].id,
    egSpeaker: sp.length ? String(sp[0].speaker) : null,
    egAttribution: at.length ? String(at[0].attribution) : null,
    egTitle: r.rows[0].sectionTitle ?? null,
  }
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()

  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'corpus_sections'`)
  const names = new Set(cols.rows.map((r) => String(r.column_name)))
  say('corpus_sections has a `speaker` column     : ' + names.has('speaker'))
  say('corpus_sections has an `attribution` column: ' + names.has('attribution'))
  say(`\nEvery percentage below is OF THE ROWS SAMPLED at that id offset (n≤${SAMPLE}), never of the collection.\n`)

  const summary: string[] = []
  for (const coll of COLLECTIONS) {
    say(`## ${coll.type} · ${coll.label}  [${coll.corpus}]`)
    let any = false
    let bestSpeaker = 0, worstSpeaker = 101, bestAttr = 0, worstAttr = 101
    for (const off of coll.offsets) {
      const s = await slice(c, coll.corpus, off)
      if (!s) { say(`   offset ${JSON.stringify(off) || "''"} — no compiled rows`); continue }
      any = true
      const sr = (100 * s.speaker) / s.n, ar = (100 * s.attribution) / s.n
      bestSpeaker = Math.max(bestSpeaker, sr); worstSpeaker = Math.min(worstSpeaker, sr)
      bestAttr = Math.max(bestAttr, ar); worstAttr = Math.min(worstAttr, ar)
      say(`   offset ${(JSON.stringify(off)).padEnd(44)} n=${String(s.n).padStart(3)}  speaker ${String(s.speaker).padStart(3)}/${s.n} (${pct(s.speaker, s.n).padStart(6)})  attribution ${String(s.attribution).padStart(3)}/${s.n} (${pct(s.attribution, s.n).padStart(6)})`)
      say(`        ids ${s.firstId}  →  ${s.lastId}`)
      if (s.egSpeaker) say(`        speaker e.g.     ${JSON.stringify(s.egSpeaker)}`)
      if (s.egAttribution) say(`        attribution e.g. ${JSON.stringify(s.egAttribution)}`)
      say(`        sectionTitle e.g. ${JSON.stringify(s.egTitle)}`)
    }
    if (!any) {
      say('   ⚠ NO COMPILED ROWS AT ANY OFFSET — corpus absent or misnamed here')
      summary.push(`${coll.type.padEnd(18)}${coll.corpus.padEnd(30)}NO COMPILED ROWS`)
    } else {
      const range = (lo: number, hi: number) =>
        lo === hi ? `${lo.toFixed(1)}%` : `${lo.toFixed(1)}–${hi.toFixed(1)}%`
      summary.push(`${coll.type.padEnd(18)}${coll.corpus.padEnd(30)}speaker ${range(worstSpeaker, bestSpeaker).padStart(13)}   attribution ${range(worstAttr, bestAttr).padStart(13)}`)
    }
    say('')
  }

  say('\n════ THE TABLE §2 ASKS FOR — collection → where attribution lives → sampled coverage ════')
  say('(ranges span the id offsets sampled; a range is a real spread, not an error bar)\n')
  for (const line of summary) say('  ' + line)

  // "Not on the section row" is not "not held structurally". Name the other candidates.
  const t = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND (table_name ILIKE '%witness%' OR table_name ILIKE '%speaker%' OR table_name ILIKE '%committee%'
            OR table_name ILIKE '%evidence%' OR table_name ILIKE '%member%')
     ORDER BY table_name`)
  say('=== other tables that could hold who-said-it ===')
  for (const r of t.rows) say(`  ${r.table_name}`)

  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
