import { namesPool, endNamesPool } from './names-pool'
;(async () => {
  const p = namesPool()
  for (const t of ['Griffiths v The Secretary of State for Work And Pensions','British Telecommunications PLC and Kevin Owen Meier','R (on the application of Miller) v The Prime Minister']) {
    const r = (await p.query(`SELECT id, corpus, notes FROM corpus_sections WHERE "sectionTitle" = $1 LIMIT 2`, [t])).rows
    console.log(`${JSON.stringify(t)}\n  → ${r.map(x => `${x.corpus} | ${x.id} | ${x.notes}`).join('\n  → ') || 'NOT FOUND'}`)
  }
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
