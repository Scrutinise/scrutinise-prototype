/**
 * build-corpus-scope.ts — C3 Lane F4. GENERATE `docs/CORPUS_SCOPE.md`, never hand-write it.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS FOR. Most collections have no publisher index to walk, so "how much of it do we
 * have?" has no answer from the source. The honest substitute is a scope WE declare — what the
 * collection is supposed to contain, from when, and on what authority — so that a reader can tell
 * a deliberate boundary from an accidental gap. Without it every unmeasured collection looks the
 * same as every other, and `UNMEASURED` gets read as `probably fine`.
 *
 * ⚠ IT IS GENERATED, per Lane F3's rule: a document hand-built once becomes a second source of
 * truth within a week. The counts, dates and blocked reasons come from the live database on every
 * run. The DECLARED SCOPE text is the one part a human writes, and it lives in `SCOPE_DECLARATIONS`
 * below — in code, in the repository, reviewable in a diff.
 *
 * ⚠ AN UNDECLARED COLLECTION PRINTS "NOT DECLARED", LOUDLY, AND IS COUNTED. It does not quietly
 * inherit a neighbour's wording, and the count at the top is the backlog.
 *
 * Usage: tsx census/build-corpus-scope.ts
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../c2/db'

const OUT = path.join(__dirname, '../../../docs/CORPUS_SCOPE.md')
const n = (x: number) => x.toLocaleString('en-GB')

/**
 * The declared scope, written by a person. One line per collection: what it is meant to contain,
 * the boundary, and who says so. Everything else on the page is measured.
 */
const SCOPE_DECLARATIONS: Record<string, string> = {
  'pwdata-debates': 'Every Commons sitting-day debate ParlParse publishes, 1919-02-04 to date. ⚠ Abuts `historic-hansard`, which ends 1918-11-21 — measured, they do NOT overlap.',
  'pwdata-lords': 'Every Lords sitting-day debate ParlParse publishes, 1999-11-17 to date. Abuts `historic-hansard` Lords, which ends 1999-11-11.',
  'historic-hansard': 'The digitised Hansard bound volumes: Commons to 1918-11-21, Lords to 1999-11-11. A closed archive — it does not grow.',
  'pwdata-wrans': 'Commons written answers, one section per answer, from ParlParse. Supersedes `written-answers` and `lda-commonswrittenquestions`.',
  'pwdata-lordswrans': 'Lords written answers, one per section. Supersedes `lda-lordswrittenquestions`.',
  'pwdata-wms': 'Commons written ministerial statements, one per section. Supersedes `written-statements`.',
  'committees-reports': 'Select committee reports published through the Committees API, both Houses, for the sessions the API exposes.',
  'committees-evidence': 'Written and oral evidence submitted to select committees, through the same API.',
  'senedd-cofnod': 'Senedd plenary Cofnod y Trafodion. ⚠ Bilingual: ~95% of a 40-row sample has a WELSH body, so an English query can only match the English heading. A Welsh devolved question is not answerable in English today.',
  'scottish-parliament-or': 'Scottish Parliament Official Report, 1999 to date.',
  'niassembly-hansard': 'Northern Ireland Assembly Hansard, for the sittings the Assembly publishes.',
  'tna-caselaw': 'Find Case Law (The National Archives). ⚠ COVERAGE BEGINS 2003, not 2001 — 29 items are dated 2001–02 against 74,657 from 2003 on. TNA does not publish UKHL at all, so the House of Lords 1996–2009 is absent entirely.',
  'scottish-courts': 'Scottish Courts and Tribunals judgments, 1999-02-06 to date.',
  'ni-judgments': 'Northern Ireland judgments, 1984-09 to date.',
  'echr-hudoc': 'European Court of Human Rights, HUDOC, 1956 to date.',
  'et-decisions': 'Employment tribunal decisions published on gov.uk, 2017 to date for England and Wales. **Scottish employment tribunal decisions before 2013 are not published and are not held.** ⚠ Measured over the WHOLE population of 503 landing pages with nothing behind them (not a sample): 51 carry a judgment PDF, 452 do not, none is a dead link. Of the 452, 332 use the six-digit pre-2013 Scottish case numbering and a further 93 use a 41xx Scottish office number — 425 of 452 (94%) are Scottish. Against that, 0 of the 51 WITH a judgment are six-digit or pre-2013. gov.uk lists those decisions by title and attaches no judgment, ever. ⚠ 27 seven-digit English rows have no attachment either and that is NOT explained by this boundary — see OI-22.',
  'erskine-may': 'Erskine May, the parliamentary procedure text, as published online.',
  'uk-treaties': 'UK treaty series as published by the FCDO. ⚠ UNREACHABLE BY ANY QUERY today — see docs/OPEN_ITEMS.md OI-3.',
  'tax-treaties-dta': 'Double taxation agreements. ⚠ UNREACHABLE BY ANY QUERY today — see OI-3.',
  'cps-guidance': 'Crown Prosecution Service legal guidance, as published.',
  'ots-reports': 'Publications of the Office of Tax Simplification. The OTS was abolished in 2023, so the universe is CLOSED AND FINITE: **222 documents**, by the publisher\'s own `filter_organisations` field, re-confirmed live on 2026-08-26. ⚠ THE DATA DOES NOT HONOUR THAT SCOPE YET: the 497 rows held are the first 500 results of a free-text gov.uk relevance search over 348,062, and **421 of the 497 were published by somebody else** (same verdicts on two runs two days apart). 76 are genuine and all 76 are inside the 222. ⚠⚠ AND 222 DOCUMENTS IS NOT 222 REPORTS: every row in this collection has `format = null` and a median of 399 words, because what is stored is the gov.uk LANDING PAGE — 143 of the 222 (64.4%) keep their substance in a PDF attachment nobody fetches, the same shape as `building-regs`. Quote it as \'222 OTS documents, landing pages held\'. See OI-1 and OI-24.',
  'oecd': '⚠ CONTAINS NONE OF ITS OWN SUBJECT. 505 of 505 rows are gov.uk URLs with no OECD content. Staged for deletion in docs/C3_EXECUTE.sh.',
  'building-regs': 'The Approved Documents to the Building Regulations. ⚠ 21 rows, all gov.uk landing pages with no document behind them — the PDF fetch was never written. Approved Documents also incorporate BSI standards by reference, and BSI standards are sold, not published, so they can never be in the corpus.',
}

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  const targets = await q(
    `SELECT t.corpus_key, t.display_label, t.est_sections, t.est_is_confirmed, t.blocked, t.blocked_reason, t.retired,
            coalesce(c.n, 0)::int compiled, c.first_date, c.last_date
       FROM corpus_targets t
       LEFT JOIN (SELECT corpus, count(*)::int n,
                         min("itemDate")::text first_date, max("itemDate")::text last_date
                    FROM corpus_sections WHERE status='compiled' GROUP BY corpus) c
         ON c.corpus = t.corpus_key
      ORDER BY coalesce(c.n,0) DESC`)

  const live = targets.filter((t: any) => !t.retired)
  const declared = live.filter((t: any) => SCOPE_DECLARATIONS[t.corpus_key])
  const undeclared = live.filter((t: any) => !SCOPE_DECLARATIONS[t.corpus_key] && t.compiled > 0)

  const L: string[] = []
  L.push('# SCRUTINISE — DECLARED CORPUS SCOPE')
  L.push('')
  L.push('*Generated by `scripts/ingest/census/build-corpus-scope.ts`. **Do not hand-edit** — the*')
  L.push('*counts come from the live database on every run, and the declared-scope wording lives in*')
  L.push('*`SCOPE_DECLARATIONS` in that file, where a change shows up in a diff.*')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against Neon.*`)
  L.push('')
  L.push('## Why this file exists')
  L.push('')
  L.push('Most collections have **no publisher index to walk**, so "how much of it do we hold?" has no')
  L.push('answer from the source. The honest substitute is a scope *we* declare: what the collection is')
  L.push('meant to contain, from when, and on what authority. Without it, every unmeasured collection')
  L.push('looks like every other one, and `UNMEASURED` gets read as `probably fine`.')
  L.push('')
  L.push('⚠ **A declared scope is our claim, not the publisher\'s.** It is weaker evidence than a walk and')
  L.push('is never to be quoted as coverage. It exists so that a *deliberate* boundary can be told apart')
  L.push('from an *accidental* gap.')
  L.push('')
  L.push(`## State: ${n(declared.length)} declared · ${n(undeclared.length)} NOT DECLARED · ${n(live.length)} live collections`)
  L.push('')
  L.push('The second number is the backlog. It is printed first so it cannot be skimmed past.')
  L.push('')
  L.push('## Declared')
  L.push('')
  L.push('| collection | sections held | earliest | latest | declared scope |')
  L.push('|---|---:|---|---|---|')
  for (const t of declared) {
    const esc = (s: any) => String(s ?? '').replace(/\|/g, '\\|')
    L.push(`| \`${t.corpus_key}\` | ${n(t.compiled)} | ${t.first_date ?? '—'} | ${t.last_date ?? '—'} | ${esc(SCOPE_DECLARATIONS[t.corpus_key])} |`)
  }
  L.push('')
  L.push('## NOT DECLARED — collections holding text with no scope statement')
  L.push('')
  L.push('⚠ Every row here is a collection a user can be served from, whose intended boundary nobody has')
  L.push('written down. None of them inherits a neighbour\'s wording.')
  L.push('')
  L.push('| collection | sections held | earliest | latest | blocked |')
  L.push('|---|---:|---|---|---|')
  for (const t of undeclared) {
    L.push(`| \`${t.corpus_key}\` | ${n(t.compiled)} | ${t.first_date ?? '—'} | ${t.last_date ?? '—'} | ${t.blocked ? String(t.blocked_reason ?? 'yes').slice(0, 60) : '—'} |`)
  }
  L.push('')
  L.push('## What a declaration must contain')
  L.push('')
  L.push('1. **What the collection is meant to hold** — in the publisher\'s terms, not ours.')
  L.push('2. **The boundary**, with a date where one exists, and *why* the boundary is there.')
  L.push('3. **What is knowably absent**, where we know it. `tna-caselaw` not publishing UKHL is a fact')
  L.push('   about the source and belongs here; "we have not finished ingesting" does not — that is a')
  L.push('   work item and belongs in `OPEN_ITEMS.md`.')
  L.push('')
  fs.writeFileSync(OUT, L.join('\n'))
  console.log(`${path.relative(process.cwd(), OUT)}`)
  console.log(`  declared ${n(declared.length)} · NOT DECLARED ${n(undeclared.length)} · live ${n(live.length)}`)
  await p.end()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
