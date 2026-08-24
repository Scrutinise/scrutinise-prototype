/**
 * b5-citation-gap.ts — C3 LANE B5. WHY DOES A USER SEE `ukpga/Geo4/5/83` WHERE A TITLE SHOULD BE?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER SEES. A search result for a pre-2000 Act comes back headed `ukpga/Geo4/5/83`
 * instead of *Vagrancy Act 1824*. The brief reports **14.0%** of pre-2000 legislation identifiers
 * resolving to a title. This measures it rather than repeating it, and — more importantly —
 * measures whether the proposed fix would actually close the gap.
 *
 * ── THE REGNAL-YEAR TRAP ────────────────────────────────────────────────────────────────────────
 * legislation.gov.uk files pre-1963 Acts by REGNAL year — the year of the monarch's reign — not by
 * calendar year. The Vagrancy Act 1824 is `ukpga/Geo4/5/83`: the 83rd Act of the 5th year of
 * George IV. The same Act also has a calendar-year identifier, `ukpga/1824/83`. Whether a title
 * lookup succeeds depends on which of the two forms the title index happens to be keyed by, and
 * the two indexes in play were built from different tables.
 *
 * ⚠ THE FIX MUST NOT BE "MERGE ON SIMILARITY". Two 19th-century Acts can share a normalised title;
 * `citation-resolver.ts` already records 173 normalised titles carrying more than one gid. The
 * regnal↔calendar pairing used here comes from the PUBLISHER'S OWN enumeration
 * (`v36/source-entries.json`, which carries `docId` and `calendarId` on every entry) — an
 * identity the source asserts, not one we inferred from two strings looking alike.
 *
 * ⚠ AND IT REPORTS THE RESIDUE. A fix that closes 14% → 60% is worth having and is not a solved
 * problem; the run prints what is still unresolved and why, so nobody reads a partial repair as a
 * complete one.
 *
 * READ-ONLY. Measures; writes one JSON.
 *
 * Usage: tsx c2/b5-citation-gap.ts
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'

const ENUM_PATH = path.join(__dirname, '..', 'v36', 'source-entries.json')
const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']
const n = (x: number) => x.toLocaleString('en-GB')
/** `{corpus}:{gid}:{ref}` — the gid is everything between the first and last colon-delimited part. */
const gidOf = (id: string) => { const p = id.split(':'); return p.length >= 3 ? p.slice(1, -1).join(':') : null }
const isRegnal = (gid: string) => /^[a-z]+\/[A-Za-z]/.test(gid)

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  console.log('=== B5 — how many legislation identifiers resolve to a title today? ===\n')

  // ── the two title indexes actually used at query time
  const acts = await q(`SELECT gid, title FROM corpus_acts WHERE gid IS NOT NULL AND title IS NOT NULL`)
  const items = await q(`SELECT "legislationGovUkId" gid, title FROM "LegislationItem"
                          WHERE "legislationGovUkId" IS NOT NULL AND title IS NOT NULL`)
  const titles = new Map<string, string>()
  for (const r of acts) titles.set(r.gid, r.title)
  let addedByItems = 0
  for (const r of items) if (!titles.has(r.gid)) { titles.set(r.gid, r.title); addedByItems++ }
  console.log(`corpus_acts titled gids            ${n(acts.length)}`)
  console.log(`LegislationItem adds              +${n(addedByItems)}   (loadActTitles reads this one; citation-resolver reads corpus_acts)`)
  console.log(`union                              ${n(titles.size)}\n`)

  // ── the regnal↔calendar map, from the publisher's enumeration
  if (!fs.existsSync(ENUM_PATH)) { console.error(`no ${ENUM_PATH}`); process.exit(1) }
  const store: Record<string, Array<{ docId: string; calendarId: string | null }>> = JSON.parse(fs.readFileSync(ENUM_PATH, 'utf8'))
  const alt = new Map<string, string>()
  let pairs = 0
  for (const list of Object.values(store)) {
    for (const e of list) {
      if (!e.calendarId || e.calendarId === e.docId) continue
      alt.set(e.docId, e.calendarId); alt.set(e.calendarId, e.docId); pairs++
    }
  }
  console.log(`regnal↔calendar pairs from the publisher's own walk: ${n(pairs)}\n`)

  const out: any[] = []
  for (const corpus of LEG) {
    const gids: string[] = (await q(
      `SELECT DISTINCT split_part(id, ':', 2) g FROM corpus_sections
        WHERE corpus = $1 AND status='compiled'`, [corpus])).map((r: any) => r.g).filter(Boolean)
    let direct = 0, viaAlt = 0, none = 0, regnalCount = 0
    const unresolvedRegnal: string[] = []
    const unresolvedCalendar: string[] = []
    for (const g of gids) {
      if (isRegnal(g)) regnalCount++
      if (titles.has(g)) { direct++; continue }
      const a = alt.get(g)
      if (a && titles.has(a)) { viaAlt++; continue }
      none++
      ;(isRegnal(g) ? unresolvedRegnal : unresolvedCalendar).push(g)
    }
    const t = gids.length
    const row = { corpus, instruments: t, regnalIds: regnalCount, direct, viaAlt, unresolved: none,
      beforePct: t ? (100 * direct) / t : 0, afterPct: t ? (100 * (direct + viaAlt)) / t : 0,
      sampleUnresolvedRegnal: unresolvedRegnal.slice(0, 5), sampleUnresolvedCalendar: unresolvedCalendar.slice(0, 5) }
    out.push(row)
    console.log(`── ${corpus}`)
    console.log(`   distinct instruments        ${n(t)}   (${n(regnalCount)} filed under a REGNAL id)`)
    console.log(`   resolve TODAY               ${n(direct)}  = ${row.beforePct.toFixed(1)}%`)
    console.log(`   + via the other id form     ${n(viaAlt)}  → ${row.afterPct.toFixed(1)}%   ${viaAlt ? `(+${(row.afterPct - row.beforePct).toFixed(1)}pp)` : '(no gain)'}`)
    console.log(`   still unresolved            ${n(none)}   ${none ? `— ${n(unresolvedRegnal.length)} regnal, ${n(unresolvedCalendar.length)} calendar` : ''}`)
    if (row.sampleUnresolvedRegnal.length) console.log(`     e.g. ${row.sampleUnresolvedRegnal.join(', ')}`)
    console.log('')
  }

  const T = out.reduce((s, r) => s + r.instruments, 0)
  const D = out.reduce((s, r) => s + r.direct, 0)
  const V = out.reduce((s, r) => s + r.viaAlt, 0)
  console.log('─'.repeat(78))
  console.log(`ALL SIX: ${n(D)} of ${n(T)} resolve today = ${((100 * D) / T).toFixed(1)}%`)
  console.log(`         trying BOTH id forms → ${n(D + V)} = ${((100 * (D + V)) / T).toFixed(1)}%   (+${n(V)} instruments)`)
  console.log(`         ⚠ ${n(T - D - V)} still unresolved — the publisher enumeration has no title for them either.`)

  // ── the pre-2000 slice the brief's 14.0% is about
  const pre = out.find((r) => r.corpus === 'primary-acts-pre-2000')
  console.log(`\nprimary-acts-pre-2000 alone (the brief's 14.0%): ${pre.beforePct.toFixed(1)}% → ${pre.afterPct.toFixed(1)}%`)

  fs.writeFileSync(path.join(OUT, 'C3_b5_citation_gap.json'),
    JSON.stringify({ generated: new Date().toISOString(), titledGids: titles.size, regnalPairs: pairs, byCorpus: out }, null, 2))
  console.log(`\ndocs/census/C3_b5_citation_gap.json`)
  await p.end()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
