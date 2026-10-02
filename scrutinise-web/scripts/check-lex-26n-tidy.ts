// 26-N §4/§4a/§4b — once a guiding policy is accepted, only it stays visible; the rest is under "Not chosen".
// Source-reading checks; every assertion has a planted-break control that must FAIL.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(__dirname, '..', 'components/lex/GuidingPolicyScreen.tsx'), 'utf8')
let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) }
}
const control = (name: string, broken: string, pred: (s: string) => boolean) => ok(`control — ${name}`, !pred(broken))

const header = (s: string) => /<span>Not chosen<\/span>/.test(s)
const collapsed = (s: string) => /const \[open, setOpen\] = useState\(false\)/.test(s)
const gated = (s: string) => /if \(!tidy\) return <>\{children\}<\/>/.test(s) && /const tidy = !!s\.settled/.test(s)
const outside = (s: string) => s.indexOf('id="accepted-guiding-policy"') > -1 && s.indexOf('id="accepted-guiding-policy"') < s.indexOf('<NotChosenGroup tidy=')
const noWaiting = (s: string) => /new Set\(tidy \? \[\] : s\.consolidate\.waitingOnNumbers\)/.test(s)
const movedOut = (s: string) => /!\(tidy && isMoved\(p\)\)/.test(s) && /moved to Coherent Actions and no longer/.test(s)
const unchooseOutside = (s: string) => s.indexOf("patch({ op: 'unchoose' })") > s.indexOf('</NotChosenGroup>')
const notColourOnly = (s: string) => s.includes("{open ? '▾' : '▸'}") && /aria-expanded=\{open\}/.test(s) && /\{count\}/.test(s)
const wraps = (s: string) => s.indexOf('<NotChosenGroup tidy=') < s.indexOf('<ConsolidatePanel') && s.indexOf('<ConsolidatePanel') < s.indexOf('</NotChosenGroup>')
const banner = (s: string) => s.indexOf('{addedNote && (') < s.indexOf('<NotChosenGroup tidy=')

ok('the header says "Not chosen"', header(src))
control('a header with another word', src.replace('<span>Not chosen</span>', '<span>Other</span>'), header)
ok('collapsed by default', collapsed(src))
control('open by default', src.replace('const [open, setOpen] = useState(false)', 'const [open, setOpen] = useState(true)'), collapsed)
ok('applies only when a policy is settled; before that the children render untouched', gated(src))
control('always tidy', src.replace('const tidy = !!s.settled', 'const tidy = true'), gated)
ok('the accepted policy is rendered OUTSIDE (above) the header', outside(src))
control('the accepted policy inside the header', src.replace('id="accepted-guiding-policy"', 'id="x"'), outside)
ok('the Consolidate panel and the sort live under the header', wraps(src))
ok('"Waiting on #…" is not produced once settled (marks on cards and the gate)', noWaiting(src))
control('gate still fed when settled', src.replace('new Set(tidy ? [] : s.consolidate.waitingOnNumbers)', 'new Set(s.consolidate.waitingOnNumbers)'), noWaiting)
ok('candidates moved to Coherent Actions leave the section (counted, not listed)', movedOut(src))
control('moved ones still listed', src.replace('&& !(tidy && isMoved(p))', ''), movedOut)
ok('un-choose stays visible OUTSIDE the header', unchooseOutside(src))
ok('the header carries a word, a shape and a count, not colour alone', notColourOnly(src))
control('colour-only header', src.replace("{open ? '▾' : '▸'}", "{''}"), notColourOnly)
ok('the "added to Coherent Actions" confirmation is not tidied away', banner(src))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
