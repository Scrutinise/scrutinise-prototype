/**
 * handread-caselaw.ts — BRIEF_INGEST_CASELAW_TEXT §3, first bullet.
 * "Sample 30 judgments, hand-read the stored text against the source, and report how many are
 * right. A parser's own success count is not evidence."
 *
 * ⚠ AGAINST THE SOURCE, NOT AGAINST OUR OWN COPY OF IT. The obvious version of this script
 * compares the stored body with the AKN in R2 — which is the same file the extractor just read,
 * so it can only ever prove the extractor is consistent with itself. This RE-FETCHES each
 * judgment's `data.xml` from caselaw.nationalarchives.gov.uk and compares against that. Thirty
 * requests, serially, with the ingest User-Agent.
 *
 * For each sampled judgment it prints, for hand-reading:
 *   - the stored title and date
 *   - the first 60 words of the STORED body
 *   - the first 60 words extracted from the FRESHLY FETCHED source
 *   - three machine checks (opening words match / stylesheet absent / party line present)
 * and reports how many of the thirty are right.
 *
 * ⚠ AND THE SAME THREE CHECKS, WATCHED FAILING. `--old-writer` runs them against
 * `rawToText(judgmentXml)` — the exact expression the writer used until today — instead of the
 * stored body. If the checks score 30/30 on the new text and also 30/30 on the old, they are not
 * checks. They score 0/30 on the old.
 *
 * WRITES NOTHING. Run: --n=30 [--old-writer]
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText, checkJudgmentBody } from '../shared/akn-text'
import { rawToText } from '../shared/compile'

const N = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '30', 10)
const UA = 'Scrutinise-Ingest/1.0 (Open Justice; contact: cl@scrutinise.org)'
/** Compare the OLD writer's output instead of the stored body — the negative control. */
const OLD_WRITER = process.argv.includes('--old-writer')

const words = (s: string, k: number) => s.split(/\s+/).slice(0, k).join(' ')

;(async () => {
  const p = namesPool()
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "itemDate"::text AS "itemDate", "sourceUrl", "r2Key", "r2RawKey", "wordCount", notes
       FROM corpus_sections WHERE corpus='tna-caselaw' AND "r2Key" IS NOT NULL
       ORDER BY md5(id || 'handread') LIMIT $1`, [N])).rows

  let right = 0, fetched = 0
  const problems: string[] = []

  for (const [i, r] of rows.entries()) {
    const stored = OLD_WRITER
      ? rawToText((await r2Get((r as { r2RawKey: string }).r2RawKey)) ?? '')   // what the writer used to store
      : await r2Get(r.r2Key)
    let live: string | null = null
    try {
      const res = await fetch(r.sourceUrl, { headers: { 'User-Agent': UA } })
      if (res.ok) { live = await res.text(); fetched++ }
      else problems.push(`${r.id}: source HTTP ${res.status}`)
    } catch (e) { problems.push(`${r.id}: source fetch failed — ${(e as Error).message}`) }

    const fromSource = live ? aknJudgmentText(live)?.text ?? null : null
    const v = checkJudgmentBody(stored)

    // Three checks, each of which can fail on its own.
    const opensSame = !!stored && !!fromSource && words(stored, 25) === words(fromSource, 25)
    const noStylesheet = v.styleChars === 0
    const namesAParty = !!stored && /\sv\.?\s|\bBetween\b|\bR\s+v\b|\bAppellant\b|\bRespondent\b|\bClaimant\b/i.test(stored.slice(0, 4000))
    const ok = opensSame && noStylesheet && namesAParty
    if (ok) right++

    console.log(`\n${'='.repeat(100)}`)
    console.log(`${i + 1}/${rows.length}  ${r.id}`)
    console.log(`  title   ${r.sectionTitle}`)
    console.log(`  date    ${r.itemDate}     wordCount ${Number(r.wordCount).toLocaleString()}     notes ${r.notes}`)
    console.log(`  source  ${r.sourceUrl}`)
    console.log(`\n  STORED  : ${stored ? words(stored, 60) : '(body unreadable)'}`)
    console.log(`\n  SOURCE  : ${fromSource ? words(fromSource, 60) : '(source not fetched)'}`)
    console.log(`\n  checks  opening 25 words match source: ${opensSame ? 'YES' : 'NO'}` +
      `   |  stylesheet absent: ${noStylesheet ? 'YES' : `NO (${v.styleChars} chars)`}` +
      `   |  names a party: ${namesAParty ? 'YES' : 'NO'}   =>  ${ok ? 'RIGHT' : 'WRONG'}`)
  }

  console.log(`\n${'='.repeat(100)}`)
  console.log(`HAND-READ RESULT${OLD_WRITER ? ' (OLD WRITER — the negative control)' : ''}: ${right} of ${rows.length} right, ` +
    `against ${fetched} judgments re-fetched from the National Archives`)
  if (problems.length) { console.log('\nproblems:'); problems.forEach(x => console.log(`  ${x}`)) }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
