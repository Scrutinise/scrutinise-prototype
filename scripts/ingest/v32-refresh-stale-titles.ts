/**
 * v32-refresh-stale-titles.ts — bring `sectionTitle` in `corpus_fts` back into line with Neon
 * for rows that were indexed BEFORE the metadata-pass title fix.
 *
 * WHY NEITHER EXISTING TOOL DOES THIS
 *   - fts-catchup only APPENDS ids missing from the index; a row already there is never revisited.
 *   - fts-hygiene removes DUPLICATES and ORPHANS; a row whose source exists and is compiled is
 *     neither, and it deliberately does not touch that case.
 *   - the heavy-job merge rebuilds the inverted index over existing fragments and never re-reads
 *     Neon, so it preserves whatever text the fragments hold.
 * So a stale title survives all three, silently. Measured 2026-08-09: 895 committees-reports rows
 * held a title with NO committee name at all, against a Neon row that now carries it — i.e. they
 * were unfindable in the committees stream, the exact §D failure the metadata pass exists to stop.
 *
 * METHOD, mirroring fts-hygiene.deleteDuplicates(): read the full index row (so the body and every
 * other column are carried across untouched), patch sectionTitle from Neon, delete by id, re-add.
 *
 * RECOVERABILITY: unlike orphan deletion this is reversible — every row deleted here has a live
 * `corpus_sections` row and an R2 body behind it, so the worst case is re-running fts-catchup.
 * That is why it does not need the R2 export that fts-hygiene forces before an orphan delete.
 *
 * ⚠ AFTER THIS, THE INDEX MUST BE MERGED (INGEST_PLAYBOOK §20 / CLAUDE.md §17) — a delete plus an
 * append leaves the inverted index describing rows that moved. The chain already runs the merge.
 *
 * Dry run by default. Usage: tsx v32-refresh-stale-titles.ts [--apply] [--corpus=X]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { connectLance, FTS_TABLE } from './search/lance'

const APPLY = process.argv.includes('--apply')
const CORPUS = (() => { const a = process.argv.find(x => x.startsWith('--corpus=')); return a ? a.split('=')[1] : 'committees-reports' })()
const ID_CHUNK = 400

const esc = (s: string) => s.replace(/'/g, "''")
const inList = (ids: string[]) => `id IN (${ids.map(i => `'${esc(i)}'`).join(',')})`
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const p = getNeonPool()
  const { rows: neonRows } = await p.query<{ id: string; sectionTitle: string | null }>(
    `SELECT id, "sectionTitle" FROM corpus_sections
     WHERE corpus=$1 AND status='compiled'`, [CORPUS])
  const neon = new Map(neonRows.map(r => [r.id, r.sectionTitle ?? '']))
  console.log(`[refresh] Neon compiled rows for ${CORPUS}: ${neon.size.toLocaleString()}`)

  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)
  const idx = (await tbl.query().where(`corpus = '${esc(CORPUS)}'`).select(['id', 'sectionTitle']).toArray()) as any[]
  console.log(`[refresh] index rows for ${CORPUS}:      ${idx.length.toLocaleString()}`)

  const stale: string[] = []
  let notInNeon = 0
  for (const r of idx) {
    const want = neon.get(r.id)
    if (want === undefined) { notInNeon++; continue }   // orphan — fts-hygiene's business, not ours
    if (want !== (r.sectionTitle ?? '')) stale.push(r.id)
  }
  console.log(`[refresh] titles stale vs Neon:          ${stale.length.toLocaleString()}`)
  console.log(`[refresh] index rows with no Neon row:   ${notInNeon.toLocaleString()}  (left for fts-hygiene)`)

  if (stale.length === 0) { console.log('[refresh] nothing to do'); await endNeonPool(); return }
  if (!APPLY) {
    console.log(`\n[refresh] DRY RUN — pass --apply to rewrite these ${stale.length} rows`)
    for (const id of stale.slice(0, 3)) {
      const before = (idx.find(r => r.id === id) as any).sectionTitle
      console.log(`   ${id}\n     index: …${String(before).slice(-70)}\n     neon : …${String(neon.get(id)).slice(-70)}`)
    }
    await endNeonPool(); return
  }

  const fields = (await tbl.schema()).fields.map(f => f.name)
  const before = await tbl.countRows()
  let rewritten = 0
  for (const c of chunk(stale, ID_CHUNK)) {
    const rows = (await tbl.query().where(inList(c)).select(fields).toArray()) as Record<string, unknown>[]
    const patched = rows.map(r => {
      const plain: Record<string, unknown> = {}
      for (const f of fields) {
        const v = r[f]
        plain[f] = typeof v === 'bigint' ? Number(v) : v
      }
      plain.sectionTitle = neon.get(r.id as string) ?? plain.sectionTitle
      return plain
    })
    await tbl.delete(inList(c))
    if (patched.length) await tbl.add(patched)
    rewritten += patched.length
    process.stdout.write(`\r   …${rewritten}/${stale.length}`)
  }
  process.stdout.write('\n')

  const after = await tbl.countRows()
  console.log(`[refresh] rows rewritten ${rewritten}`)
  console.log(`[refresh] table rows ${before.toLocaleString()} → ${after.toLocaleString()}  ${before === after ? '✅ conserved' : '❌ COUNT CHANGED — investigate'}`)

  // Re-read and prove the fix landed rather than assuming the write worked.
  const recheck = (await tbl.query().where(inList(stale.slice(0, Math.min(400, stale.length)))).select(['id', 'sectionTitle']).toArray()) as any[]
  const bad = recheck.filter(r => (r.sectionTitle ?? '') !== neon.get(r.id)).length
  console.log(`[refresh] re-read ${recheck.length} of the rewritten rows: ${bad === 0 ? '✅ all match Neon' : `❌ ${bad} still stale`}`)

  await endNeonPool()
}
main().catch(e => { console.error('[refresh] FATAL', e); process.exit(1) })
