/** Throwaway check of withCommittee(): the damaged-tail repair, the cap, and idempotence. */
import { withCommittee } from './v32-metadata-pass'

const NAME = 'Secondary Legislation Scrutiny Committee'
let fail = 0
function check(label: string, cond: boolean, extra = '') {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  ${extra}` : ''}`)
  if (!cond) fail++
}

// 1. already present → untouched
const a = withCommittee(`Report: Something — ${NAME}`, NAME)
check('name already present is a no-op', !a.changed && a.title === `Report: Something — ${NAME}`)

// 2. short title → appended in full
const b = withCommittee('Report: Something', NAME)
check('short title gets the full name', b.changed && b.title.endsWith(NAME))

// 3. the real damage: 500 chars ending in a cut name
const damaged = ('Report: ' + 'x'.repeat(600)).slice(0, 500 - 5) + ' — Se'
check('fixture is the damaged shape', damaged.length === 500 && !damaged.includes(NAME))
const c = withCommittee(damaged, NAME)
check('repair restores the full name', c.changed && c.title.includes(NAME), `len=${c.title.length}`)
check('repair respects the 500 cap', c.title.length <= 500, `len=${c.title.length}`)
check('repair strips the partial, no " — Se — "', !c.title.includes(' — Se — '), c.title.slice(-70))

// 4. idempotence: running the repair again changes nothing
const d = withCommittee(c.title, NAME)
check('second pass is a no-op', !d.changed && d.title === c.title)

// 5. an over-long title gets the description cut, never the name
const long = 'Report: ' + 'y'.repeat(900)
const e = withCommittee(long, NAME)
check('long title keeps the whole name', e.title.endsWith(NAME) && e.title.length <= 500, `len=${e.title.length}`)
const f = withCommittee(e.title, NAME)
check('and is then stable', !f.changed)

// 6. a name longer than the whole budget keeps the name
const huge = 'Z'.repeat(600)
const g = withCommittee('Report: Something', huge)
check('over-budget name is kept, description dropped', g.title.length <= 500 && g.title.startsWith('Z'))

console.log(fail === 0 ? '\n  ALL PASS' : `\n  ${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
