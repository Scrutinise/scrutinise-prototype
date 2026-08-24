/**
 * check-b5-regnal.ts — C3 Lane B5's guard. Live, two-sided, and it must be able to fail.
 *
 * TWO SEPARATE CLAIMS, because B5 is two repairs that fail independently:
 *   1. A regnal-filed Act RESOLVES TO ITS TITLE. Before: `ukpga/Geo4/5/83`. After: Vagrancy Act 1824.
 *   2. A CITATION RESOLVES TO THE ID FORM THAT HOLDS SECTIONS. `ukpga/1824/83` carries the title
 *      and 0 sections; `ukpga/Geo4/5/83` carries 20 and no title. Resolving to the titled form
 *      would fetch nothing and present as "we do not hold it" — which is how the first version of
 *      the repoint behaved, and why claim 2 exists separately from claim 1.
 *
 * ⚠ THE CONTROL IS THE POINT: a CALENDAR-filed Act must be unaffected. A repair that also moved
 * modern Acts would be trading one wrong answer for another.
 *
 * Usage: tsx c2/check-b5-regnal.ts
 */
import { pool } from './db'
import { loadActTitles } from '../search/fts-record'
import { loadActIndex } from '../search/citation-resolver'

interface Case { gid: string; title: string; citation: string; regnal: boolean }
const CASES: Case[] = [
  { gid: 'ukpga/Geo4/5/83', title: 'Vagrancy Act 1824', citation: 'vagrancy act 1824', regnal: true },
  { gid: 'ukpga/Vict/24-25/97', title: 'Malicious Damage Act 1861', citation: 'malicious damage act 1861', regnal: true },
  // ── the CONTROL: filed under a calendar year, must be untouched by any of this
  { gid: 'ukpga/1998/42', title: 'Human Rights Act 1998', citation: 'human rights act 1998', regnal: false },
]

async function main() {
  const p = pool()
  const titles = await loadActTitles(p as any)
  const idx = await loadActIndex(p as any)
  let pass = 0, fail = 0
  const ok = (name: string, cond: boolean, detail: string) => {
    cond ? pass++ : fail++
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
    console.log(`      ${detail}`)
  }
  for (const c of CASES) {
    ok(`${c.regnal ? 'regnal' : 'CONTROL (calendar)'} — ${c.gid} has a title`,
      titles.get(c.gid) === c.title, `got: ${titles.get(c.gid) ?? '(none)'}   expected: ${c.title}`)

    const resolved = idx.byTitle.get(c.citation)
    const sections = resolved
      ? (await p.query(`SELECT count(*)::int n FROM corpus_sections WHERE id LIKE $1`, [`%:${resolved}:%`])).rows[0].n
      : 0
    ok(`${c.regnal ? 'regnal' : 'CONTROL (calendar)'} — "${c.citation}" resolves to an id that HOLDS SECTIONS`,
      sections > 0, `resolved to ${resolved ?? '(unresolved)'} → ${sections} sections   (0 would fetch nothing and read as "not held")`)
  }
  // ── the population claim, measured live rather than quoted from the report
  const gids: string[] = (await p.query(
    `SELECT DISTINCT split_part(id,':',2) g FROM corpus_sections WHERE corpus='primary-acts-pre-2000' AND status='compiled'`))
    .rows.map((r: any) => r.g).filter(Boolean)
  const hit = gids.filter((g) => titles.has(g)).length
  const pct = (100 * hit) / gids.length
  ok('pre-2000 instruments resolving to a title is above 95%',
    pct > 95, `${hit} of ${gids.length} = ${pct.toFixed(1)}%   (54.2% before C3 Lane B5)`)

  console.log(`\n${pass} passed, ${fail} failed`)
  await p.end()
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
