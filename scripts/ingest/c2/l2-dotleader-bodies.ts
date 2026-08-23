/**
 * l2-dotleader-bodies.ts — READ-ONLY. What does a "dot leader" body ACTUALLY say?
 *
 * The brief calls these "one-word legislation sections" and asks that they be suppressed as a
 * retrieval answer. Their median wordCount is 33, so the premise needs reading, not assuming.
 */
import { pool } from './db'
import { r2Get } from '../shared/r2-client'
;(async () => {
  const p = pool()
  const rows = (await p.query(`
    select r.section_id, r.corpus, r.repealed_by, s."wordCount", s."r2Key", s."sectionTitle"
    from section_repeals r join corpus_sections s on s.id = r.section_id
    where s."r2Key" is not null
    order by md5(r.section_id)
    limit 12`)).rows
  console.log(`sampled ${rows.length} at random (md5 order)\n`)
  let dotOnly = 0, hasProse = 0
  for (const r of rows) {
    const body = await r2Get(r.r2Key)
    const txt = (body ?? '').replace(/\s+/g, ' ').trim()
    // A dot leader is the source's rendering of a removed provision: runs of dots/periods.
    const stripped = txt.replace(/[.…\s]/g, '')
    const isDotOnly = stripped.length < 20
    isDotOnly ? dotOnly++ : hasProse++
    console.log(`--- ${r.section_id}  (wc=${r.wordCount}, repealedBy=${r.repealed_by ?? 'unknown'})`)
    console.log(`    title: ${r.sectionTitle ?? '(none)'}`)
    console.log(`    body : ${txt.slice(0, 220)}${txt.length > 220 ? '…' : ''}`)
    console.log(`    non-dot chars: ${stripped.length}  → ${isDotOnly ? 'SAYS NOTHING' : 'CARRIES TEXT'}`)
  }
  console.log(`\nSUMMARY: says-nothing ${dotOnly}/${rows.length} · carries-text ${hasProse}/${rows.length}`)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
