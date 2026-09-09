/**
 * setup-caselaw-case-edge-table.ts — BRIEF_GRAPH_5 §2.4. CITED BUT NOT HELD. ADDITIVE ONLY.
 *
 * ── WHY THIS IS A THIRD TABLE AND NOT A COLUMN ON `citation_edge` ────────────
 *
 * `citation_edge` answers *"what else in the statute book points at this?"*. Its `target_uri` is a
 * legislation.gov.uk URI and its `target_act_id` is an instrument gid — every index, every join and
 * every existing query rests on that. A case-to-case edge has a **law report citation** as its
 * target, which is not an instrument and has no gid. Overloading those columns would make
 * `target_act_id` mean two things and quietly break the graph's own question.
 *
 * ⚠⚠ The standing document already names this failure: *"Calling either of them 'the graph' is how
 * a layer gets built twice."* Three tables, three questions:
 *   `citation_edge`            — a document points at a PROVISION
 *   `caselaw_treatment_edge`   — a court did something TO an authority
 *   `caselaw_case_edge`        — a judgment we hold cites a CASE, held or not   ← this one
 *
 * ── ⚠⚠ THE COLUMN THAT MAKES THIS SPRINT WORK: `held_state`, AND IT IS THREE-VALUED ──
 *
 * §2.4: "the target becomes a node with no text and must be visibly marked as one". Two states
 * would be a lie in a measurable band. From the pilot, verbatim:
 *
 *   [2011] 1 WLR 2900   NOT held
 *   [2011] UKSC 50      HELD
 *
 * **Those are the same case** — *Rainy Sky SA v Kookmin Bank* — cited in both forms. So:
 *
 *   'held'      a neutral citation matching a `tna-caselaw` row. We have the judgment.
 *   'not-held'  a law-report citation dated BEFORE our English floor. We do not have it and,
 *               per the permanent boundary (BAILII refused in writing, TNA will not digitise),
 *               we are not going to.
 *   'unknown'   ⚠⚠ a law-report citation dated at or after the floor. We MAY hold this judgment
 *               under its neutral citation with the two unlinked. **Claiming 'not-held' here would
 *               tell a user we lack something we have.** An unknown fact is unknown, not absent.
 *
 * ── AND THE COLUMNS THIS TABLE DOES NOT HAVE ─────────────────────────────────
 *
 * ⚠⚠⚠ There is **no headnote, no summary, no `what_it_decided`, no `description`** sourced from
 * anything but our own documents. BAILII's terms forbid storing search results or HTML versions of
 * judgments and forbid robot access; the register records them as blocked. **Nothing here is
 * fetched from BAILII and no extract of any judgment we do not hold is stored.** What the reader is
 * shown instead is `passage` — the words OUR judgment used when citing it, which is our document
 * and which tells them what the case is being cited *for*. `bailii_url` is DERIVED from the
 * citation alone, never fetched, never verified by request.
 *
 *   npx tsx graph/setup-caselaw-case-edge-table.ts            — apply
 *   npx tsx graph/setup-caselaw-case-edge-table.ts --status   — report only
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export const CASE_EDGE_TABLE = 'caselaw_case_edge'

/** ⚠ Three states. See the header — two would be wrong in a measurable band. */
export const HELD_STATES = ['held', 'not-held', 'unknown'] as const
export type HeldState = (typeof HELD_STATES)[number]

const DDL = `
CREATE TABLE IF NOT EXISTS ${CASE_EDGE_TABLE} (
  id                bigserial PRIMARY KEY,
  -- WHO cited it: always a judgment we hold, so the citing side always has text
  judgment_id       text NOT NULL,
  judgment_uri      text NOT NULL,
  court             text,
  judgment_date     date,
  paragraph_num     text,
  -- WHAT was cited. ⚠ The identity is the CITATION, never the name.
  target_citation   text NOT NULL,   -- normalised
  target_raw        text NOT NULL,   -- exactly as the judgment wrote it, unmodified
  target_kind       text NOT NULL,   -- neutral | law-report
  target_year       integer,
  -- ⚠ observed beside the citation in THIS judgment. A weak field: it is whatever words sat in
  -- front of the citation, and the pilot found leading junk ("I was also referred to X"). Stored
  -- so variants can be counted; NEVER used to establish identity.
  target_name       text,
  -- ⚠⚠ THE VISIBLE MARK. An unheld target must never render like a held one.
  held_state        text NOT NULL,
  target_judgment_id text,           -- set only when held_state = 'held'
  -- ⚠⚠ §2.4: shown INSTEAD of a headnote. Our own judgment's words, so we are entitled to them.
  passage           text NOT NULL,
  -- derived from the citation alone. NEVER fetched. NULL when the citation does not determine a path.
  bailii_url        text,
  extracted_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ${CASE_EDGE_TABLE}_held_ck CHECK (held_state IN (${HELD_STATES.map(s => `'${s}'`).join(', ')})),
  CONSTRAINT ${CASE_EDGE_TABLE}_kind_ck CHECK (target_kind IN ('neutral', 'law-report')),
  -- ⚠ a content rule, not a shape one: NOT NULL permits '' (docs/CLAUDE.md §24)
  CONSTRAINT ${CASE_EDGE_TABLE}_evidence_ck CHECK (btrim(passage) <> '' AND btrim(target_citation) <> ''),
  -- ⚠⚠ a held target MUST name the judgment it resolves to, and an unheld one MUST NOT pretend to
  CONSTRAINT ${CASE_EDGE_TABLE}_held_link_ck CHECK (
    (held_state = 'held' AND target_judgment_id IS NOT NULL) OR
    (held_state <> 'held' AND target_judgment_id IS NULL)
  )
);
-- the dominant query is INBOUND: "what cites this authority?"
CREATE INDEX IF NOT EXISTS ${CASE_EDGE_TABLE}_target ON ${CASE_EDGE_TABLE} (target_citation);
CREATE INDEX IF NOT EXISTS ${CASE_EDGE_TABLE}_target_held ON ${CASE_EDGE_TABLE} (target_citation, held_state);
CREATE INDEX IF NOT EXISTS ${CASE_EDGE_TABLE}_judgment ON ${CASE_EDGE_TABLE} (judgment_id);
CREATE INDEX IF NOT EXISTS ${CASE_EDGE_TABLE}_held_state ON ${CASE_EDGE_TABLE} (held_state);
-- ⚠ a re-run must not duplicate: one row per (citing judgment, target, passage)
CREATE UNIQUE INDEX IF NOT EXISTS ${CASE_EDGE_TABLE}_uniq
  ON ${CASE_EDGE_TABLE} (judgment_id, target_citation, md5(passage));
`

async function main() {
  const pool = getNeonPool()
  const host = (process.env.NEON_DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ?? '(unparsed)'
  const { rows: who } = await pool.query(`SELECT current_database() db`)
  console.log(`[g5-case-edge] database=${who[0].db}  endpoint=${host}`)
  if (!/neon\./i.test(host)) {
    console.error(`[g5-case-edge] ⚠⚠ REFUSING: "${host}" is not a Neon endpoint. Nothing changed.`)
    await endNeonPool(); process.exit(1)
  }

  if (!process.argv.includes('--status')) {
    await pool.query(DDL)
    console.log(`[g5-case-edge] ${CASE_EDGE_TABLE} + 5 indexes ensured`)
  }
  const exists = await pool.query(`SELECT to_regclass($1) t`, [CASE_EDGE_TABLE])
  if (!exists.rows[0].t) { console.log('  table does not exist'); await endNeonPool(); return }
  const { rows } = await pool.query(
    `SELECT held_state, target_kind, COUNT(*)::bigint n, COUNT(DISTINCT target_citation)::bigint distinct_targets
       FROM ${CASE_EDGE_TABLE} GROUP BY 1,2 ORDER BY n DESC`)
  const size = await pool.query(`SELECT pg_size_pretty(pg_total_relation_size($1)) sz`, [CASE_EDGE_TABLE])
  console.log(`  size ${size.rows[0].sz}`)
  if (rows.length === 0) console.log('  empty')
  for (const r of rows) {
    console.log(`    ${String(r.held_state).padEnd(10)} ${String(r.target_kind).padEnd(12)} ` +
      `${Number(r.n).toLocaleString().padStart(9)} edges  ${Number(r.distinct_targets).toLocaleString().padStart(8)} distinct targets`)
  }
  await endNeonPool()
}

if (require.main === module) main().catch(e => { console.error('[g5-case-edge] FATAL', e); process.exit(1) })
