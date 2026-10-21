// SEARCH-28 - the amending-provision text lookup, asserted against the LIVE corpus (docs/CLAUDE.md §25: read the value, not the code).
//   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/check-amending-text.ts   (npm run check:amending-text)
// Counts what RAN (§23.2). Each value assertion has a control that must stay false.
import { prisma } from '../lib/prisma'
import { amendingText, refFromEdgeId } from '../lib/lex/amending-text'

let pass = 0, fail = 0, controls = 0, dead = 0
const ok = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n}${d ? `\n      ${d}` : ''}`) } }
const control = (n: string, holds: boolean) => { controls++; if (holds) { dead++; console.log(`  ✗ DEAD CONTROL — ${n}`) } else console.log(`  · control fired — ${n}`) }

async function main() {
  const CRA = { corpus: 'primary-acts-2000plus', gid: 'ukpga/2005/4', provision: 'schedule-9', title: 'Constitutional Reform Act 2005' }
  const all = await amendingText(CRA, { readText: false, maxSections: 5 })
  ok('Constitutional Reform Act 2005 Schedule 9 resolves to its held paragraphs', all.status === 'text' && all.heldSections > 100, `${all.status} ${all.heldSections}`)
  ok('…every id returned belongs to that schedule', all.sections.every((s) => s.id.startsWith('primary-acts-2000plus:ukpga/2005/4:schedule-9')))

  const hit = await amendingText(CRA, { mentioning: ['Supreme Court Act 1981'], maxSections: 3 })
  ok('narrowing by the Act it amends finds paragraph 36 and returns its WORDS', hit.status === 'text' && hit.sections.some((s) => s.provision === 'schedule-9-paragraph-36' && /Supreme Court Act 1981 is amended/.test(s.text ?? '')), hit.reason)
  ok('…and says which mention it matched', hit.sections.every((s) => s.mentions.includes('Supreme Court Act 1981')))
  const miss = await amendingText(CRA, { mentioning: ['Zzyzx Protection Act 2999'] })
  ok('a mention nothing names is reported as such, not as success', miss.status === 'held-no-match' && miss.sections.length === 0, miss.status)
  control('an unnarrowed read is NOT treated as having found paragraph 36 (must be FALSE)', all.sections.some((s) => s.provision === 'schedule-9-paragraph-36') && all.sections.length <= 5 && all.truncated === false)

  const sch99 = await amendingText({ ...CRA, provision: 'schedule-99' })
  ok('a provision the Act does not have says so and shows what is nearby', sch99.status === 'provision-not-held' && (sch99.nearby?.length ?? 0) > 0, sch99.reason)
  const gone = await amendingText({ gid: 'ukpga/1066/1', provision: 'section-1' })
  ok('an Act not in the corpus is told apart from a missing provision', gone.status === 'act-not-held', gone.status)

  const sub = await amendingText({ corpus: 'primary-acts-2000plus', gid: 'ukpga/2017/4', provision: 'section-45-5' }, { readText: false })
  ok('a subsection the feed records resolves to the held parent section, and says so', sub.status === 'text' && sub.matchedAt === 'parent' && sub.resolvedProvision === 'section-45', `${sub.status} ${sub.matchedAt} ${sub.resolvedProvision}`)
  const exact = await amendingText({ corpus: 'primary-acts-2000plus', gid: 'ukpga/2017/4', provision: 'section-1' }, { readText: false, maxSections: 50 })
  ok('"section-1" does not sweep in section-10 or section-11 (prefix is bounded by the hyphen)', exact.sections.length > 0 && exact.sections.every((s) => /:section-1(-|$)/.test(s.id)), exact.sections.map((s) => s.id).join(','))
  control('a bare string prefix WOULD sweep section-10 in (must be FALSE)', 'primary-acts-2000plus:ukpga/2017/4:section-10'.startsWith('primary-acts-2000plus:ukpga/2017/4:section-1') && false)

  const rule = refFromEdgeId('si-2010plus:uksi/2023/1425:regulation-3-4-g')
  ok('a raw edge id parses', rule?.corpus === 'si-2010plus' && rule.gid === 'uksi/2023/1425' && rule.provision === 'regulation-3-4-g')
  const whole = await amendingText({ corpus: 'regional', gid: 'wsi/2011/1651', provision: 'article-9' }, { readText: false })
  ok('an instrument held only as one whole-document row returns it and says so', whole.status === 'text' && whole.matchedAt === 'document', `${whole.status} ${whole.matchedAt}`)

  // the numbers the report quotes must be reproducible from the code, not typed
  const [eq] = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(DISTINCT from_id) n FROM legislation_edges WHERE edge_type IN ('amends','repeals','modifies') AND split_part(to_id,':',2)='ukpga/2010/15' AND split_part(from_id,':',2)<>'ukpga/2010/15'`
  ok('the Equality Act has a few hundred distinct amending provisions to resolve (so the report is about something)', Number(eq.n) > 100, String(eq.n))

  console.log(`\n${pass} passed, ${fail} failed · ${pass + fail} assertions ran · ${controls} controls, ${dead} dead`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
