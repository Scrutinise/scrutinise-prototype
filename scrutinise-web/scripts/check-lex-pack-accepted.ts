// check:lex-pack-accepted — CCh 2145Z point 5 (22 Nov 2026): the Actions Pack and the version snapshot print each draft's ACCEPTED version
// where one exists, else the latest, labelled "not yet accepted". Counts what RAN: ran, passed, controls fired, dead, not run.
//
//   A · the rule, pure (printedVersion) and the printed words (printedVersionWords), with the old rule planted.
//   B · the REAL packDocuments on a scratch copy of 452c5ade with its documents copied (452c5ade itself is never written): the accepted
//       draft, given a newer unaccepted version on the scratch copy only, still prints its ACCEPTED text and says a later one exists;
//       an unaccepted draft prints its latest, marked not accepted.
import { prisma } from '../lib/prisma'
import { printedVersion, packDocuments } from '../lib/lex/action-documents'
import { printedVersionWords } from '../lib/documents/build-actions-pack'

let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
/** `seen` true = the planted case was told apart (the control fired). */
function control(name: string, seen: boolean) { controls++; if (!seen) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

function partA() {
  section('A · the rule')
  const vs = [{ v: 1, body: 'one' }, { v: 2, body: 'two' }, { v: 3, body: 'three' }]
  const a2 = printedVersion(vs, 2)
  ok('accepted at v2, edited to v3: prints v2, and says v3 is later', a2.version?.body === 'two' && a2.accepted && a2.newerV === 3, JSON.stringify(a2))
  const a3 = printedVersion(vs, 3)
  ok('accepted at the latest: prints it, nothing later', a3.version?.body === 'three' && a3.accepted && a3.newerV === null)
  const none = printedVersion(vs, null)
  ok('nothing accepted: prints the latest, marked not accepted', none.version?.body === 'three' && !none.accepted && none.newerV === null)
  const gone = printedVersion(vs, 9)
  ok('an acceptedV with no such version reads as not accepted (never a blank)', gone.version?.body === 'three' && !gone.accepted)
  ok('the words: "accepted version 2" / "version 3, not yet accepted" / an older snapshot\'s "version 3" unchanged',
    printedVersionWords({ v: 2, accepted: true }) === 'accepted version 2' && printedVersionWords({ v: 3, accepted: false }) === 'version 3, not yet accepted' && printedVersionWords({ v: 3 }) === 'version 3')
  const oldRule = <V extends { v: number }>(x: readonly V[]) => x.reduce((m, y) => (y.v > m.v ? y : m))
  control('the OLD rule (latest, whatever was accepted) prints v3 where v2 is accepted; the new one does not', oldRule(vs).body === 'three' && a2.version?.body !== 'three')
}

async function partB() {
  section('B · the real packDocuments, on a scratch copy of 452c5ade with its documents')
  const { scratchCopy, copyDocuments, deleteScratch } = await import('./lib/scratch-copy')
  let scratch: { id: string } | null = null
  try { scratch = await scratchCopy('452c5ade', 'pack-accepted') } catch (e) { skip('the reader', `no scratch copy: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const src = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
    const n = await copyDocuments(src!.id, scratch.id)
    // drafts that HAVE stored versions (a document holding only Lex proposals prints as "no version yet")
    const docs = await prisma.actionDocument.findMany({ where: { ideaId: scratch.id, status: { notIn: ['SUPERSEDED', 'BRIEFED'] } }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' } } }, orderBy: { number: 'asc' } })
    const acc = docs.find((d) => d.acceptedV != null && d.versions.length)
    const unacc = docs.find((d) => d.acceptedV == null && d.versions.length)
    if (!acc || !unacc || !acc.versions.length || !unacc.versions.length) { skip('the reader', `the copy (${n} documents) lacks an accepted and an unaccepted draft with versions`); return }
    const acceptedBody = acc.versions.find((x) => x.v === acc.acceptedV)!.body
    // on the SCRATCH copy only: a newer version the owner has not accepted
    const newerV = Math.max(...acc.versions.map((x) => x.v)) + 1
    await prisma.actionDocumentVersion.create({ data: { documentId: acc.id, role: 'VERSION', v: newerV, author: 'OWNER', body: 'A NEWER, UNACCEPTED VERSION (pack-accepted check)' } as never })
    const pack = [...(await packDocuments(scratch.id)).values()].flat()
    const pa = pack.find((d) => d.d.endsWith(`.${acc.number}`) && d.title === acc.title)
    const pu = pack.find((d) => d.d.endsWith(`.${unacc.number}`) && d.title === unacc.title)
    ok('the accepted draft prints its ACCEPTED text, not the newer one', pa?.body === acceptedBody && pa.accepted === true && pa.v === acc.acceptedV, `${pa?.v} ${pa?.body.slice(0, 60)}`)
    ok('…and says a later, unaccepted version exists', pa?.newerV === newerV, String(pa?.newerV))
    ok('an unaccepted draft prints its latest, marked not accepted', pu?.accepted === false && pu.v === unacc.versions[0].v && pu.body === unacc.versions[0].body, `${pu?.v} ${pu?.accepted}`)
    control('the newer version really is the latest on the copy (the old rule would have printed it)', !!pa && pa.body !== 'A NEWER, UNACCEPTED VERSION (pack-accepted check)')
  } finally {
    console.log(`  (scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}

;(async () => {
  console.log('check:lex-pack-accepted — the accepted draft where one exists, else the latest, labelled')
  partA()
  await partB()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
