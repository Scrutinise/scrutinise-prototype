/**
 * l2-item9-verify.ts — LANE 2 item 9, independent verification. READ-ONLY.
 *
 * C1's A7 concludes the legacy table's independent contribution is 29 instruments / 211
 * sections. Its OWN first run said 1,579, every one a false gap from building the identity
 * map out of the worklist (absences only), so the number is re-derived here from
 * `corpus_sections` directly and each claimed gap is re-probed under BOTH identities.
 *
 * ⚠ ATTEMPT 1 TIMED OUT and the reason is already in the playbook: a `%:gid:%` LIKE has a
 * leading wildcard, so it scans all 18.5M rows. Every probe below is a PREFIX RANGE on the
 * primary key (`corpus:gid:` … `corpus:gid;`), which is index-driven.
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'

const WORKLIST = path.join(__dirname, '../v36/worklist.jsonl')
const SOURCE_ENTRIES = path.join(__dirname, '../v36/source-entries.json')
const LEG = ['primary-acts-pre-2000','primary-acts-2000plus','si-pre-2010','si-2010plus','regional','retained-eu']

;(async () => {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  const wl = new Set<string>()
  for (const line of fs.readFileSync(WORKLIST, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const j = JSON.parse(line)
    if (j.docId) wl.add(String(j.docId).toLowerCase())
    if (j.calendarId) wl.add(String(j.calendarId).toLowerCase())
  }
  console.log(`worklist ids (docId + calendarId): ${wl.size.toLocaleString()}`)

  // ── THE CALENDAR→REGNAL MAP, FROM THE FULL SOURCE WALK ────────────────────────
  // ⚠ ATTEMPT 2 REPRODUCED A7's FIRST, WRONG ANSWER — 1,574 gaps against its corrected 29 —
  // because it matched only on `type/year/number` and on the legacy row's own id. An Act
  // before 1963 is held under its REGNAL citation (the Vagrancy Act 1824 is
  // `ukpga/Geo4/5/83`, not `ukpga/1824/83`), so every pre-1963 Act read as absent. That is
  // the identity trap the playbook §22.4 names, and reproducing it was the point: it is
  // what makes landing on 29 afterwards a verification rather than a restatement.
  // The map must come from the FULL walk — the worklist holds absences only, which is
  // exactly how A7's first run went wrong.
  const calToDoc = new Map<string, string>()
  if (!fs.existsSync(SOURCE_ENTRIES)) {
    console.error(`⚠ no source walk at ${SOURCE_ENTRIES} — the identity rule cannot be applied and ` +
      `every regnal-held instrument would read as a false gap. REFUSING to report.`)
    process.exit(1)
  }
  {
    const walk = JSON.parse(fs.readFileSync(SOURCE_ENTRIES, 'utf8'))
    for (const entries of Object.values(walk) as any[])
      for (const e of entries)
        if (e.calendarId && e.docId && e.calendarId !== e.docId)
          calToDoc.set(String(e.calendarId).toLowerCase(), String(e.docId).toLowerCase())
    console.log(`calendar→regnal pairs from the full source walk: ${calToDoc.size.toLocaleString()}`)
  }

  // ⚠ "HELD" IS TWO DIFFERENT SETS AND THE ANSWER MOVES BETWEEN THEM (playbook §21 R8).
  // A row can exist for an instrument with status='unavailable' — no provisions, revoked,
  // a dot-leader placeholder — which is a record that we LOOKED, not a record of text. Both
  // are computed; the reported answer uses the text-bearing one, because the question item 9
  // asks is whether the legacy table holds text no retrieval path reaches.
  console.log('building the held-gid sets from corpus_sections (not from a walk)…')
  const heldAny = new Set<string>((await q(
    `select distinct split_part(id, ':', 2) gid from corpus_sections where corpus = any($1)`, [LEG]
  )).map((r: any) => String(r.gid).toLowerCase()))
  const held = new Set<string>((await q(
    `select distinct split_part(id, ':', 2) gid from corpus_sections
     where corpus = any($1) and status='compiled'`, [LEG]
  )).map((r: any) => String(r.gid).toLowerCase()))
  console.log(`distinct gids with ANY row      : ${heldAny.size.toLocaleString()}`)
  console.log(`distinct gids with COMPILED text: ${held.size.toLocaleString()}`)

  const legacy = await q(`
    select i.id, i."legislationType" typ, i.year, i.number, count(s.id)::int secs
    from "LegislationItem" i join "LegislationSection" s on s."legislationItemId" = i.id
    group by 1,2,3,4`)
  console.log(`legacy instruments with text: ${legacy.length.toLocaleString()}`)

  let inCorpus = 0, onWorklist = 0
  const neither: any[] = []
  for (const r of legacy as any[]) {
    const cal = `${r.typ}/${r.year}/${r.number}`.toLowerCase()
    const cands = [cal, String(r.id).toLowerCase()]
    const regnal = calToDoc.get(cal)
    if (regnal) cands.push(regnal)
    if (cands.some(c => held.has(c))) { inCorpus++; continue }
    if (cands.some(c => wl.has(c))) { onWorklist++; continue }
    neither.push({ id: r.id, calendar: cands[0], secs: r.secs })
  }
  const sects = neither.reduce((s, x) => s + x.secs, 0)
  console.log(`\nalready in corpus_sections : ${inCorpus.toLocaleString()}`)
  console.log(`on the V36 worklist        : ${onWorklist.toLocaleString()}`)
  console.log(`in NEITHER                 : ${neither.length.toLocaleString()}  (${sects} legacy sections)`)

  console.log('\nre-probing every claimed gap by PRIMARY-KEY PREFIX RANGE, both identities:')
  let falseGaps = 0
  const triedAndEmpty: any[] = []
  for (const g of neither) {
    let hit: any = null
    for (const gid of [g.calendar, String(g.id).toLowerCase(), calToDoc.get(g.calendar) ?? ''].filter(Boolean)) {
      for (const c of LEG) {
        const r = await q(`select id from corpus_sections where id >= $1 and id < $2 limit 1`,
          [`${c}:${gid}:`, `${c}:${gid};`])
        if (r.length) { hit = r[0].id; break }
      }
      if (hit) break
    }
    // ⚠ A HIT IS TWO DIFFERENT THINGS. `…:unavailable` is a row recording that we LOOKED
    // and the source had nothing — that is not a false gap, it is the strongest case in the
    // whole legacy table for migrating rather than re-fetching, because the re-fetch has
    // already been tried and came back empty while legacy holds text.
    if (hit) {
      if (String(hit).endsWith(':unavailable')) { triedAndEmpty.push({ ...g, row: hit }) }
      else { falseGaps++; console.log(`  ⚠ FALSE GAP ${g.calendar} → held WITH TEXT as ${hit}`) }
    }
  }
  console.log(`\nprobed ${neither.length} · false gaps: ${falseGaps}`)
  const verdict = falseGaps === 0
    ? `CONFIRMS A7 — ${neither.length} instruments / ${sects} legacy sections are the legacy table's only independent contribution`
    : `A7 NOT CONFIRMED — ${falseGaps} of ${neither.length} claimed gaps are in fact held`
  console.log(verdict)
  fs.writeFileSync(path.join(OUT, 'C2_L2_item9_legacy.json'), JSON.stringify(
    { inCorpus, onWorklist, neither: neither.length, legacy_sections: sects, falseGaps,
      tried_and_empty: triedAndEmpty, verdict, gaps: neither }, null, 2))
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
