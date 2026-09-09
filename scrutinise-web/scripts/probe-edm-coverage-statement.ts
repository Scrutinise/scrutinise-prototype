/**
 * probe-edm-coverage-statement.ts — BRIEF_INGEST_EDM_SIGNATURES §3, last bullet: *"Report the effect
 * on the coverage statement, which is generated from live state and must now describe signatures
 * rather than explaining their absence."*
 *
 * ⚠ READ-ONLY. It prints what `getPositionCoverage()` says right now, in the words the surface
 * prints, so the before and the after can be diffed rather than described.
 *
 * ⚠ IT MUST BE RUN BEFORE AND AFTER THE LOAD. The wording in `position-coverage.ts`'s LAYER_WORDS is
 * a STRING and does not change when the data does; the counts and the dates around it do. Reading
 * both together is the only way to see the sentence that has become false.
 *
 * Usage (from scrutinise-web):
 *   tsx --env-file=.env scripts/probe-edm-coverage-statement.ts
 */
import { getPositionCoverage, coverageSentences, describePositionCoverage } from '@/lib/graph/position-coverage'
import { getNeonPool } from '@/lib/pg-pool'

async function main() {
  const c = await getPositionCoverage()
  console.log(`\n════ THE LAYERS, AS THE SURFACE SEES THEM ${'═'.repeat(37)}`)
  console.log(`   ${'signal type'.padEnd(24)}${'status'.padEnd(16)}${'held rows'.padStart(12)}`)
  for (const l of c.layers) {
    console.log(`   ${l.signalType.padEnd(24)}${l.status.padEnd(16)}${l.heldRows.toLocaleString().padStart(12)}`)
    console.log(`      what: ${l.what}`)
    if (l.gloss) console.log(`      gloss: ${l.gloss}`)
  }

  console.log(`\n════ THE RECORD WINDOWS ${'═'.repeat(55)}`)
  for (const w of c.records) {
    console.log(`   ${w.id.padEnd(30)} ${w.rows.toLocaleString().padStart(11)} rows  ${w.earliest} → ${w.latest}  (+${w.yearsAfterEarliest}y)`)
  }
  console.log(`   graph earliest anywhere: ${c.graphEarliest}`)

  console.log(`\n════ THE SENTENCES IT PRINTS ${'═'.repeat(50)}`)
  for (const s of coverageSentences(c)) console.log(`   • ${s}`)

  console.log(`\n════ describePositionCoverage() ${'═'.repeat(47)}`)
  const d = describePositionCoverage(c) as any
  console.log(typeof d === 'string' ? d : JSON.stringify(d, null, 2).slice(0, 4000))

  await getNeonPool().end()
}
main().catch(async (e) => { console.error(e); try { await getNeonPool().end() } catch {} process.exit(1) })
