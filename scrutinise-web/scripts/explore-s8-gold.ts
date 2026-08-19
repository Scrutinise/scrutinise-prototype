// ─────────────────────────────────────────────────────────────────────────────
// explore-s8-gold.ts — BRIEF_SEARCH_S8 §5's working tool. Not a check; a lookup.
//
// §5 needs, per candidate question, "the answer key (specific document ids that a correct top-20
// should contain, VERIFIED TO EXIST IN THE CORPUS by reading them back)".
//
// ⚠⚠ THE ANSWER KEY MUST COME FROM THE STORE, NOT FROM THE SEARCH RESULTS. Keying a question on
// whatever retrieval returns for it makes recall 100% by construction and measures nothing. So
// this tool queries `corpus_sections` DIRECTLY by title, never through `runSearch()`, and the
// questions are written against what it finds.
//
// Two modes, matching §5's two required sourcing methods:
//   --sample <corpus>       DOCUMENT-OUTWARD: show notable documents, so a question can be written
//                           from one ("find a notable document, ask the question it answers")
//   --find "<terms>"        OUTSIDE-IN: given a question written from a real public controversy,
//                           find whether the corpus holds anything that answers it — and report
//                           honestly when it does not
//
//   npx tsx --env-file=.env scripts/explore-s8-gold.ts --sample committees-reports
//   npx tsx --env-file=.env scripts/explore-s8-gold.ts --find "sewage storm overflow" --corpus committees-reports
// ─────────────────────────────────────────────────────────────────────────────

import { Client } from 'pg'

const arg = (n: string) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null }
const has = (n: string) => process.argv.some((x) => x === `--${n}` || x.startsWith(`--${n}=`))
const say = (s: string) => process.stdout.write(s + '\n')

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()

  if (has('sample')) {
    const corpus = arg('sample')!
    const n = parseInt(arg('n') ?? '40', 10)
    const offset = arg('after') ?? ''
    // ⚠ Titles with substance only. A sample dominated by "Summary" or nulls tells you nothing
    // about what a user could ask for, and those are exactly the rows the early drafts surfaced.
    const r = await c.query(
      `SELECT id, "sectionTitle", "itemDate"::text AS d
       FROM corpus_sections
       WHERE corpus = $1 AND status = 'compiled' AND id > $2
         AND "sectionTitle" IS NOT NULL AND length("sectionTitle") > 25
       ORDER BY id LIMIT $3`, [corpus, offset, n])
    say(`\n=== ${corpus}: ${r.rowCount} documents with a substantive title ===\n`)
    for (const row of r.rows) say(`${row.id}\n    ${row.d ?? '(no date)'}  ${row.sectionTitle}\n`)
  }

  if (has('find')) {
    const terms = arg('find')!.split(/\s+/).filter(Boolean)
    const corpus = arg('corpus')
    const n = parseInt(arg('n') ?? '12', 10)
    // Every term must appear in the title. A bounded ILIKE over the title column — deliberately
    // NOT the FTS index, so the key is independent of the thing being measured.
    const where = terms.map((_, i) => `"sectionTitle" ILIKE $${i + (corpus ? 2 : 1)}`).join(' AND ')
    const params: unknown[] = corpus ? [corpus, ...terms.map((t) => `%${t}%`)] : terms.map((t) => `%${t}%`)
    const sql = `SELECT id, corpus, "sectionTitle", "itemDate"::text AS d
                 FROM corpus_sections
                 WHERE status = 'compiled' ${corpus ? 'AND corpus = $1' : ''} AND ${where}
                 LIMIT ${n}`
    const r = await c.query(sql, params)
    say(`\n=== "${terms.join(' ')}"${corpus ? ` in ${corpus}` : ''}: ${r.rowCount} hit(s) ===\n`)
    if (!r.rowCount) say('⚠ NOTHING. Record the question with NO KEY and say the corpus does not hold it —\n  a question the corpus cannot answer is a finding, not a question to quietly drop.\n')
    for (const row of r.rows) say(`${row.id}\n    [${row.corpus}] ${row.d ?? '(no date)'}  ${row.sectionTitle}\n`)
  }

  // ⚠⚠ TWO COLLECTIONS CANNOT BE SEARCHED BY TITLE AT ALL, and that is a §5 finding rather than a
  // tooling gap:
  //
  //   tna-caselaw          `sectionTitle` is NULL on every row sampled. The ID *is* the neutral
  //                        citation (`tna-caselaw:[2003] EWCA Civ 1769:1`) and the case name and
  //                        subject live only in the R2 body. So a case-law answer key cannot be
  //                        built by topic from the database — it has to be a citation named from
  //                        outside and then VERIFIED to exist here. `--cite` does that half.
  //
  //   impact-assessments   `sectionTitle` is the internal heading ("Summary", "Costs and
  //                        benefits") — the S2C6 §1 finding, still true. The subject lives on the
  //                        PARENT instrument, so `--parent` searches `corpus_acts.title` through
  //                        `parentDocId`. 1,566 of 3,000 sampled rows (52%) resolve to a named
  //                        instrument; the rest cannot be keyed this way either.
  if (has('parent')) {
    const terms = arg('parent')!.split(/\s+/).filter(Boolean)
    const where = terms.map((_, i) => `a.title ILIKE $${i + 1}`).join(' AND ')
    const r = await c.query(
      `SELECT s.id, s."sectionTitle", a.title AS parent, s."parentDocId"
       FROM corpus_sections s JOIN corpus_acts a ON a.gid = s."parentDocId"
       WHERE s.corpus = 'impact-assessments' AND s.status = 'compiled' AND ${where}
       LIMIT ${parseInt(arg('n') ?? '10', 10)}`, terms.map((t) => `%${t}%`))
    say(`\n=== impact assessments whose INSTRUMENT title matches "${terms.join(' ')}": ${r.rowCount} ===\n`)
    if (!r.rowCount) say('⚠ NOTHING.\n')
    for (const row of r.rows) say(`${row.id}\n    ${row.parentDocId}  ${row.parent}\n    section: ${row.sectionTitle}\n`)
  }

  if (has('cite')) {
    // Confirm a neutral citation named from outside actually exists in the corpus.
    const cites = arg('cite')!.split('|').map((s) => s.trim()).filter(Boolean)
    say(`\n=== neutral citations, checked against the store ===\n`)
    for (const cite of cites) {
      // ⚠ THE TRAILING `:` IS LOAD-BEARING. A bare `LIKE 'tna-caselaw:[2021] UKSC 1%'` also matches
      // `UKSC 10`, `UKSC 11` and `UKSC 12` — the first draft of this reported three OKs for a
      // citation the corpus does not hold, which would have put an unanswerable question into the
      // gold set with a key that looked verified.
      const r = await c.query(
        `SELECT id FROM corpus_sections WHERE corpus='tna-caselaw' AND status='compiled' AND id LIKE $1 LIMIT 3`,
        [`tna-caselaw:${cite}:%`])
      if (r.rowCount) for (const row of r.rows) say(`  OK      ${row.id}`)
      else say(`  MISSING ${cite}  ⚠ not held — a question keyed on it would be unanswerable`)
    }
  }

  if (has('verify')) {
    // Read back a list of ids and confirm each exists — the last step before a key is written down.
    const ids = arg('verify')!.split(',').map((s) => s.trim()).filter(Boolean)
    const r = await c.query(
      `SELECT id, corpus, "sectionTitle" FROM corpus_sections WHERE id = ANY($1) AND status = 'compiled'`, [ids])
    const found = new Set(r.rows.map((x) => x.id))
    say(`\n=== verify: ${r.rowCount}/${ids.length} exist and are compiled ===\n`)
    for (const row of r.rows) say(`  OK      ${row.id}  [${row.corpus}]  ${String(row.sectionTitle ?? '').slice(0, 80)}`)
    for (const id of ids) if (!found.has(id)) say(`  MISSING ${id}`)
  }

  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
