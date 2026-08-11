// ─────────────────────────────────────────────────────────────────────────────
// §19-D Task 5 — the legislation links must open.
//
// Two modes:
//   (default)  pure assertions on the ref→path conversion. No network, no DB.
//   --live     samples real corpus_sections ids from the DB, derives the URL the
//              panel would render, and REQUESTS IT. This is the mode that caught
//              the bug: the conversion looked right for years while the value the
//              panel actually used came from sourceUrl and 404'd.
//
// // A link check that never fetches is a link check that cannot fail.
// ─────────────────────────────────────────────────────────────────────────────

import { legislationUrl, refFromId, refToPath, refToCitation, resolveResultUrl } from '../lib/lex/legislation-url'

let failures = 0
function ok(label: string, cond: boolean, detail = '') {
  if (!cond) failures++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
}

function pure() {
  console.log('\n── ref → path ──')
  ok('section-288AB → section/288AB', refToPath('section-288AB') === 'section/288AB', refToPath('section-288AB'))
  ok('schedule-24-paragraph-7 → schedule/24/paragraph/7',
    refToPath('schedule-24-paragraph-7') === 'schedule/24/paragraph/7', refToPath('schedule-24-paragraph-7'))
  ok('schedule-paragraph-2 → schedule/paragraph/2',
    refToPath('schedule-paragraph-2') === 'schedule/paragraph/2', refToPath('schedule-paragraph-2'))
  ok('regulation-3 → regulation/3', refToPath('regulation-3') === 'regulation/3')
  ok('article-58A → article/58A', refToPath('article-58A') === 'article/58A')
  ok('unknown leaf is dropped, not guessed', refToPath('section-12-gubbins-4') === 'section/12', refToPath('section-12-gubbins-4'))
  ok('a ref that starts unaddressable yields the act', refToPath('nonsense-4') === '')

  console.log('\n── whole-document refs resolve to the act, not a 404 ──')
  ok('full-doc-html is not a provision', refFromId('si-pre-2010:uksi/1950/891:full-doc-html') === '')
  ok('  → act URL', legislationUrl('uksi/1950/891', refFromId('si-pre-2010:uksi/1950/891:full-doc-html'))
    === 'https://www.legislation.gov.uk/uksi/1950/891')

  console.log('\n── the derived URL beats the stored sourceUrl for legislation ──')
  const broken = 'https://www.legislation.gov.uk/ukpga/1995/46/section-288AB' // what corpus_sections holds
  ok('legislation: derived wins',
    resolveResultUrl('PRIMARY_LEGISLATION', 'primary-acts-pre-2000:ukpga/1995/46:section-288AB', broken)
      === 'https://www.legislation.gov.uk/ukpga/1995/46/section/288AB')
  ok('non-legislation: stored url is used as-is',
    resolveResultUrl('DEBATE', 'pwdata-debates:debates1983-03-11a:1', 'https://www.theyworkforyou.com/x.xml')
      === 'https://www.theyworkforyou.com/x.xml')
  ok('committee: stored url is used as-is',
    resolveResultUrl('COMMITTEE', 'committees-reports:publication:13110:1', 'https://committees.parliament.uk/publications/13110/')
      === 'https://committees.parliament.uk/publications/13110/')

  console.log('\n── citations still read as citations ──')
  ok('section-288AB → s.288AB', refToCitation('section-288AB') === 's.288AB', refToCitation('section-288AB'))
  ok('schedule-1-paragraph-7 → sch.1 para.7',
    refToCitation('schedule-1-paragraph-7') === 'sch.1 para.7', refToCitation('schedule-1-paragraph-7'))
}

async function live(sampleSize: number) {
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

  const CORPORA = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'retained-eu']
  const per = Math.max(2, Math.round(sampleSize / CORPORA.length))
  let checked = 0, opened = 0
  const broken: string[] = []

  for (const corpus of CORPORA) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sourceUrl: string | null }>>(
      `SELECT id, "sourceUrl" FROM corpus_sections WHERE corpus = $1 ORDER BY random() LIMIT ${per}`, corpus)
    for (const r of rows) {
      const gid = r.id.split(':')[1]
      const url = legislationUrl(gid, refFromId(r.id))
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' }).catch(() => null)
      const code = res?.status ?? 0
      checked++
      if (code >= 200 && code < 400) opened++
      else broken.push(`${code} ${r.id} → ${url}`)
    }
  }
  await prisma.$disconnect()

  console.log(`\n── live: ${opened}/${checked} derived legislation URLs opened ──`)
  for (const b of broken) console.log('   ', b)
  // The bar: the derived form must open for essentially everything. Below this the
  // conversion is wrong, not merely incomplete, and the panel is shipping 404s again.
  ok(`≥95% of sampled legislation links open`, checked > 0 && opened / checked >= 0.95,
    `${((opened / Math.max(1, checked)) * 100).toFixed(1)}%`)
}

async function main() {
  pure()
  if (process.argv.includes('--live')) {
    const n = parseInt(process.argv[process.argv.indexOf('--live') + 1] ?? '25', 10)
    await live(Number.isFinite(n) ? n : 25)
  } else {
    console.log('\n(run with `--live 25` to fetch real URLs against legislation.gov.uk)')
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main()
