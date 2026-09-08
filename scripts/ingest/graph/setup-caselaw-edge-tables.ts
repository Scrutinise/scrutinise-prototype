/**
 * setup-caselaw-edge-tables.ts — GRAPH 5 §2 and §3. ADDITIVE ONLY.
 *
 * Two changes, and both are strictly widening:
 *
 *  1. `citation_edge` accepts `source_type = 'caselaw'` and `detection = 'caselaw-markup'`.
 *     ⚠ Both CHECK constraints today accept strictly fewer values than after this runs, so no
 *     existing row can fail either. Nothing is dropped, no column changes type, no data moves.
 *     ⚠⚠ `coverage.ts` has probed `source_type = 'caselaw'` since GRAPH 4A and has returned zero
 *     every time — the layer has been declared NOT BUILT in every coverage block this platform has
 *     ever printed. Widening the constraint is what lets that probe ever be non-zero; the layer
 *     flips to 'searched' from the live count, with no edit to coverage.ts.
 *
 *  2. `caselaw_treatment_edge` is NEW — §3. It is NOT `citation_edge` with an extra column, and
 *     that is a decision rather than an omission:
 *
 *     ⚠⚠ **A CITATION AND A TREATMENT ARE DIFFERENT FACTS AND MUST NOT SHARE A TABLE.** Every row
 *     in `citation_edge` means "this document referred to that provision". A treatment row means
 *     "this court said something about how that authority stands". Putting them in one table with
 *     a nullable `treatment` column would make the commonest query — "what refers to this" — return
 *     a mixture, and the first person to filter it wrong publishes a legal conclusion.
 *
 *     ⚠⚠ AND THE TWO TREATMENT SUBJECTS STAY APART TOO. `subject_type` is 'case' or 'provision',
 *     NOT NULL, and there is no row that is both. §3.2: "keep treatment-of-a-case and
 *     treatment-of-a-provision as separate edge types — they are different questions and
 *     flattening them loses the distinction permanently."
 *
 * ⚠⚠⚠ THE COLUMN THIS TABLE DOES NOT HAVE, AND NEVER WILL: there is no `still_good_law`, no
 * `status`, no `authority_score`. §0 is the most important sentence in the brief — we report the
 * treatment, quote the words, cite the judgment, and let the reader conclude. A boolean here would
 * be a legal conclusion computed by a regular expression, and somebody would act on it.
 *
 *   npx tsx graph/setup-caselaw-edge-tables.ts            — apply
 *   npx tsx graph/setup-caselaw-edge-tables.ts --status   — report only, change nothing
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'

export const TREATMENT_TABLE = 'caselaw_treatment_edge'

/** ⚠ The ten §3.1 names. `considered` and `mentioned` are DELIBERATELY ABSENT — §3.2: they are not
 *  treatments, and an unclassified citation is an honest result. Widening this list is a decision,
 *  not a tidy-up. */
export const TREATMENTS = [
  'followed', 'applied', 'distinguished', 'doubted', 'not-followed',
  'overruled', 'disapproved', 'read-down', 'per-incuriam',
] as const

const WIDEN = `
-- ⚠ ADDITIVE. Drop-then-add in ONE query, so the table is never briefly unguarded.
ALTER TABLE ${CITATION_TABLE} DROP CONSTRAINT IF EXISTS citation_edge_source_type_ck;
ALTER TABLE ${CITATION_TABLE} ADD CONSTRAINT citation_edge_source_type_ck
  CHECK (source_type IN ('primary', 'SI', 'other', 'caselaw'));
ALTER TABLE ${CITATION_TABLE} DROP CONSTRAINT IF EXISTS citation_edge_detection_ck;
ALTER TABLE ${CITATION_TABLE} ADD CONSTRAINT citation_edge_detection_ck
  CHECK (detection IN ('markup', 'text', 'enabling', 'caselaw-markup'));
-- the case-law half is queried BY JUDGMENT as often as by target
CREATE INDEX IF NOT EXISTS citation_edge_source_type ON ${CITATION_TABLE} (source_type);
`

const DDL = `
CREATE TABLE IF NOT EXISTS ${TREATMENT_TABLE} (
  id                bigserial PRIMARY KEY,
  -- WHO said it
  judgment_id       text NOT NULL,        -- corpus_sections.id of the treating judgment
  judgment_uri      text NOT NULL,        -- the court's own FRBR uri
  -- ⚠⚠ §3.2: "a Supreme Court statement and a first-instance aside are not the same fact, and a
  -- citator that presents them alike is misleading in the direction that matters."
  court             text,                 -- as the document states it; NULL when it does not
  judgment_date     date,
  -- WHAT it is about. ⚠ subject_type is NOT NULL and there is no row that is both.
  subject_type      text NOT NULL,        -- 'case' | 'provision'
  subject_citation  text,                 -- neutral or law-report citation, when subject_type='case'
  subject_uri       text,                 -- legislation.gov.uk uri, when subject_type='provision'
  subject_act_id    text,                 -- normalised gid, via the SHARED identity resolver
  subject_prov_ref  text,
  -- WHAT was said
  treatment         text NOT NULL,
  -- ⚠⚠ EVIDENCE IS NOT OPTIONAL. §2.3 and the citation graph's own schema rule: an edge with no
  -- quotable source is a claim, not a fact. A treatment edge without the sentence is exactly the
  -- thing §0 forbids — an assertion about a case's standing with nothing to check it against.
  sentence          text NOT NULL,        -- the court's words, verbatim
  matched_phrase    text NOT NULL,        -- the literal phrase the pattern fired on
  pattern_id        text NOT NULL,
  paragraph_num     text,                 -- the judge's own numbering, where the document carries it
  extracted_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ${TREATMENT_TABLE}_subject_ck CHECK (subject_type IN ('case', 'provision')),
  CONSTRAINT ${TREATMENT_TABLE}_treatment_ck CHECK (treatment IN (${TREATMENTS.map(t => `'${t}'`).join(', ')})),
  -- ⚠ the evidence columns cannot be blanked: NOT NULL permits '' and this is a CONTENT rule
  -- (docs/CLAUDE.md §24 — a required field is a shape contract, never a content one).
  CONSTRAINT ${TREATMENT_TABLE}_evidence_ck CHECK (btrim(sentence) <> '' AND btrim(matched_phrase) <> ''),
  -- a subject must actually be identified, in the column its type says
  CONSTRAINT ${TREATMENT_TABLE}_subject_named_ck CHECK (
    (subject_type = 'case'      AND btrim(COALESCE(subject_citation, '')) <> '') OR
    (subject_type = 'provision' AND btrim(COALESCE(subject_uri, '')) <> '')
  )
);
CREATE INDEX IF NOT EXISTS ${TREATMENT_TABLE}_subject_act ON ${TREATMENT_TABLE} (subject_act_id);
CREATE INDEX IF NOT EXISTS ${TREATMENT_TABLE}_subject_cite ON ${TREATMENT_TABLE} (subject_citation);
CREATE INDEX IF NOT EXISTS ${TREATMENT_TABLE}_judgment ON ${TREATMENT_TABLE} (judgment_id);
CREATE INDEX IF NOT EXISTS ${TREATMENT_TABLE}_treatment ON ${TREATMENT_TABLE} (subject_type, treatment);
-- ⚠ a re-run must not duplicate: one row per (judgment, subject, treatment, phrase position)
CREATE UNIQUE INDEX IF NOT EXISTS ${TREATMENT_TABLE}_uniq
  ON ${TREATMENT_TABLE} (judgment_id, subject_type, COALESCE(subject_citation, subject_uri), treatment, md5(sentence));
`

async function main() {
  const pool = getNeonPool()
  // ── the whichdb check (docs/CLAUDE.md §16): say which database, before changing it ──
  const { rows: who } = await pool.query(
    `SELECT current_database() db, inet_server_addr()::text host, version() v`)
  const host = (process.env.NEON_DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ?? '(unparsed)'
  console.log(`[g5-setup] database=${who[0].db}  endpoint=${host}`)
  if (!/neon\.tech|neon\./i.test(host)) {
    console.error(`[g5-setup] ⚠⚠ REFUSING: "${host}" is not a Neon endpoint. Nothing was changed.`)
    await endNeonPool(); process.exit(1)
  }

  const statusOnly = process.argv.includes('--status')
  if (!statusOnly) {
    await pool.query(WIDEN)
    console.log(`[g5-setup] ${CITATION_TABLE}: source_type and detection WIDENED (additive)`)
    await pool.query(DDL)
    console.log(`[g5-setup] ${TREATMENT_TABLE} + 5 indexes ensured`)
  }

  for (const [t, col] of [[CITATION_TABLE, 'source_type'], [TREATMENT_TABLE, 'treatment']] as const) {
    const exists = await pool.query(`SELECT to_regclass($1) t`, [t])
    if (!exists.rows[0].t) { console.log(`  ${t}: does not exist`); continue }
    const { rows } = await pool.query(`SELECT ${col}, COUNT(*)::bigint n FROM ${t} GROUP BY 1 ORDER BY n DESC`)
    const size = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size($1)) sz`, [t])
    console.log(`  ${t}  (${size.rows[0].sz})`)
    if (rows.length === 0) console.log(`    empty`)
    for (const r of rows) console.log(`    ${String(r[col]).padEnd(16)} ${Number(r.n).toLocaleString()}`)
  }
  // the widened constraint, read back off the catalogue rather than assumed
  const { rows: cks } = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c' ORDER BY conname`, [CITATION_TABLE])
  console.log(`\n  ${CITATION_TABLE} CHECK constraints, read back:`)
  for (const c of cks) console.log(`    ${c.conname}: ${c.def}`)
  await endNeonPool()
}

if (require.main === module) main().catch(e => { console.error('[g5-setup] FATAL', e); process.exit(1) })
