/**
 * s3-amendment-target-check.ts — is the "lost" text actually held under the TARGET act?
 *
 * The shortfall triage said 3,856 of 3,857 orphaned legacy sections are real text, which
 * would block the DROP. The ref-format check then showed WHY the two sides disagree, and
 * it is not a naming difference — it is a different MODEL of an amending instrument:
 *
 *   legacy `ukpga/2015/21` holds  357TA, 357UH, 66E, 212ZD   ← sections as INSERTED into
 *                                                              other Acts (CTA 2010 etc)
 *   corpus `ukpga/2015/21` holds  schedule-1-paragraph-N     ← the amending Act's OWN text
 *
 * V36 re-fetched CURRENT-STATE text from TNA, which already has amendments applied. So
 * the inserted provision should be present in the corpus under the TARGET instrument.
 * If it is, the legacy rows are a DUPLICATE of consolidated text held elsewhere and the
 * drop loses nothing. If it is not, they are a genuine loss and the drop stays blocked.
 *
 * This is the query that decides it. Read-only.
 *
 * Usage: tsx s3-amendment-target-check.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

// amending instrument → the target that should now carry the consolidated provision
const CASES = [
  { amending: 'ukpga/2015/21',  target: 'ukpga/2010/4',      refs: ['357TA', '357UH', '357N'],  label: 'Finance Act 2015 → Corporation Tax Act 2010' },
  { amending: 'uksi/2023/572',  target: 'uksi/1998/3132',    refs: ['45.42', '26.18', '45.35'], label: 'CPR amendment SI → Civil Procedure Rules 1998' },
  { amending: 'uksi/2016/990',  target: 'ukpga/2003/41',     refs: ['168', '205', '134'],       label: 'Extradition SI → Extradition Act 2003' },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

async function main() {
  const pool = getNeonPool()
  const targets = CASES.map((c) => c.target)

  const { rows } = await pool.query(
    `SELECT split_part(id, ':', 2) AS gid, id FROM corpus_sections
      WHERE split_part(id, ':', 2) = ANY($1::text[])`, [targets])
  const byTarget = new Map<string, string[]>()
  for (const r of rows) {
    if (!byTarget.has(r.gid)) byTarget.set(r.gid, [])
    byTarget.get(r.gid)!.push(String(r.id).split(':').pop() ?? '')
  }

  for (const c of CASES) {
    const tails = byTarget.get(c.target) ?? []
    console.log(`\n═══ ${c.label}`)
    console.log(`  target ${c.target}: ${tails.length.toLocaleString()} sections in corpus`)
    if (!tails.length) { console.log(`  ⚠ TARGET NOT HELD — cannot resolve this class here`); continue }
    const normTails = tails.map(norm)
    for (const ref of c.refs) {
      const want = norm(ref)
      const hit = normTails.some((t) => t.endsWith(want))
      console.log(`    ${ref.padEnd(8)} ${hit ? '✅ PRESENT under the target' : '❌ absent under the target'}`)
    }
    console.log(`    sample target tails: ${tails.slice(0, 8).join(', ')}`)
  }

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
