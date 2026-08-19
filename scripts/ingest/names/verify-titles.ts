/**
 * verify-titles.ts — §1.4's hand-read, with a mechanical SCREEN in front of it.
 *
 * ⚠ THE SCREEN IS NOT THE VERIFICATION. It checks whether the distinctive party words in the
 * stored title actually occur in the judgment's own opening — a title naming parties the document
 * never mentions is wrong, and that is checkable by machine. A title that PASSES the screen still
 * has to be read; the screen only says where to look hardest. §1.4 asks for 30 hand-read, and
 * every row below was read.
 */
import { namesPool, endNamesPool } from './names-pool'
import { r2Get } from '../shared/r2-client'
import { firstWords } from '../shared/caselaw-name'

const STOP = new Set(['the','and','of','for','v','ors','anor','others','another','ltd','limited','plc','inc','re','in','matter','on','application','r','a','an','to','by','&','no','rev'])

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w))
}

;(async () => {
  const p = namesPool()
  const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '30', 10)
  const rows = (await p.query(
    `SELECT id, "sectionTitle", "r2Key", notes FROM corpus_sections
      WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL
      ORDER BY md5(id || 'verify-salt') LIMIT $1`, [n])).rows
  // ⚠ NEGATIVE CONTROL — the check watched failing before it is trusted to pass. Each title is
  // paired with the NEXT row's judgment text. If the screen still says "all party words present"
  // under that shuffle, it is matching on boilerplate ("Royal Courts of Justice", "Before") and
  // its 30/30 means nothing. A screen that cannot fail is not a screen.
  const shuffle = process.argv.includes('--negative-control')
  let full = 0, partial = 0, none = 0
  const flagged: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const src = shuffle ? rows[(i + 1) % rows.length] : r
    const compiled = src.r2Key ? await r2Get(src.r2Key) : null
    const head = compiled ? firstWords(compiled, 400).toLowerCase() : ''
    const t = tokens(r.sectionTitle)
    const hit = t.filter(w => head.includes(w))
    const rate = t.length ? hit.length / t.length : 0
    const verdict = rate >= 0.99 ? 'ALL party words present' : rate >= 0.5 ? 'MOST present' : 'FEW/NONE present'
    if (rate >= 0.99) full++; else if (rate >= 0.5) partial++; else { none++; flagged.push(r.id) }
    console.log(`[${String(i + 1).padStart(2)}] ${verdict.padEnd(24)} ${hit.length}/${t.length}  ${r.sectionTitle.slice(0, 84)}`)
    if (rate < 0.5) console.log(`     ⚠ id ${r.id}\n     ⚠ opening: ${head.slice(0, 300)}`)
  }
  console.log(`\nSCREEN over ${rows.length}: all party words found in the judgment's own opening ${full}, most ${partial}, few/none ${none}`)
  if (flagged.length) console.log(`flagged for closest reading: ${flagged.join(', ')}`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
