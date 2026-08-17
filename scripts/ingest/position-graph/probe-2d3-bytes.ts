/**
 * probe-2d3-bytes.ts — §13: dump the actual bytes before forming a hypothesis about a match failure.
 * Reads only.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, normaliseForMatch } from './text-2d3'

export {}
const sectionId = process.argv[2] ?? 'committees-evidence:oralevidence:10860:174198'
const needle = process.argv[3] ?? 'Barbara Rayment'

async function main() {
  const pool = getNeonPool()
  try {
    const { rows: [c] } = await pool.query<{ k: string; w: number }>(
      `SELECT "r2Key" k, "wordCount" w FROM corpus_sections WHERE id=$1`, [sectionId])
    const doc = await getDocText(c.k)
    console.log(`${sectionId}\n  r2Key=${c.k}  wordCount=${c.w}  chars=${doc?.length}`)
    if (!doc) return
    const at = doc.indexOf(needle)
    console.log(`\n  indexOf(${JSON.stringify(needle)}) = ${at}`)
    const win = at >= 0 ? doc.slice(Math.max(0, at - 60), at + 220) : doc.slice(0, 280)
    console.log(`\n  ---- window ----\n${JSON.stringify(win)}`)
    console.log(`\n  ---- codepoints of that window ----`)
    console.log([...win].slice(0, 120).map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126 ? `<${ch.charCodeAt(0)}>` : ch)).join(''))
    console.log(`\n  ---- normalised window ----\n${JSON.stringify(normaliseForMatch(win).slice(0, 280))}`)
  } finally { await endNeonPool() }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
