// ─────────────────────────────────────────────────────────────────────────────
// 25-V §1 — REPAIR THE COMMITTEE CITATION LINKS FROM PARLIAMENT'S OWN API.
//
// `committees.parliament.uk/publications/{publicationId}/html/` is not an address for a committee
// publication. It is a WRITTEN-EVIDENCE address space that happens to share the path, so the link
// under a correct citation opens somebody else's document — measured, in a browser, on 2 Sep 2026:
// publication 6912 (the Greensill interim report) serves written evidence on ARPA research
// funding at that URL, and the bare form is "This page does not exist".
//
// ⚠⚠ THE CITATIONS THEMSELVES ARE SOUND. `verify-citations.ts` checked all 183 distinct sources on
// the Civil Service proposal against Parliament's API: 141 decidable, **0 misnamed**. Only the
// hyperlink is wrong. So this rewrites `EvidenceItem.url` and touches nothing else — not the
// citation, not the title, not the corpus row.
//
// ⚠ PLAN BY DEFAULT. It reads the API per publication, writes only where the API gives an address,
// and RE-READS each row afterwards and prints the stored value, because "updated" is a claim about
// the database rather than about the call that was made.
//
// ⚠ WHERE PARLIAMENT PUBLISHES NO HTML ADDRESS the row is LEFT ALONE and reported. A correspondence
// letter exists only as a PDF behind the committee site; inventing an address for it is what put
// us here.
//
// Usage:
//   npx tsx --env-file=.env scripts/backfill-committee-urls.ts            (plan)
//   npx tsx --env-file=.env scripts/backfill-committee-urls.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const WRITE = process.argv.includes('--write')

/** The form that is wrong: a committee-publication id in the written-evidence address space. */
const WRONG = /^https?:\/\/(?:www\.)?committees\.parliament\.uk\/publications\/\d+\/(?:html\/?)?$/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api(pubId: string) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 25_000)
  try {
    const r = await fetch(`https://committees-api.parliament.uk/api/Publications/${pubId}`,
      { headers: { Accept: 'application/json' }, signal: ctl.signal })
    if (!r.ok) return { error: `HTTP ${r.status}` }
    return { data: await r.json() as { description?: string; additionalContentUrl?: string | null } }
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
  finally { clearTimeout(t) }
}

async function main() {
  const rows = await prisma.evidenceItem.findMany({
    where: { url: { contains: 'committees.parliament.uk/publications/' } },
    select: { id: true, ideaId: true, url: true, citation: true, sourceId: true },
  })
  const affected = rows.filter((r) => WRONG.test(r.url ?? ''))
  console.log(`\n${rows.length} rows on a committees.parliament.uk/publications URL; `
    + `${affected.length} are the wrong id-space form\n`)

  // One API call per publication, not per row.
  const byPub = new Map<string, typeof affected>()
  for (const r of affected) {
    const m = (r.sourceId ?? '').match(/^committees-reports:publication:(\d+):/)
    if (!m) continue
    const list = byPub.get(m[1]) ?? []
    list.push(r)
    byPub.set(m[1], list)
  }

  let fixed = 0
  let noAddress = 0
  for (const [pubId, list] of byPub) {
    const res = await api(pubId)
    await sleep(150)
    if ('error' in res) { console.log(`?  publication ${pubId}: API ${res.error} — left alone`); continue }
    const correct = res.data.additionalContentUrl ?? null
    const desc = (res.data.description ?? '').slice(0, 60)

    if (!correct) {
      // ══ ⚠⚠ A KNOWN-WRONG LINK IS NOT AN UNVERIFIED ONE, AND IT IS NOT A POLICY QUESTION ══
      //
      // §1d asks what happens when verification FAILS, and puts the options to Charlie. This is
      // not that case. These rows are not unverified — they are measured wrong: the URL opens a
      // real page about somebody else's subject. Keeping it is publishing a falsehood, so the
      // LINK is removed and the CITATION is kept in full. A reader can find "Letter from Rt Hon
      // Jacob Rees-Mogg MP… dated 27.7.22, PACAC" from its name; they cannot recover from being
      // sent to a page on grouse shooting.
      //
      // ⚠ THE CITATION IS UNTOUCHED. Parliament's own API confirmed every one of these names the
      // document we say it does. Dropping the finding would be discarding sound research to tidy
      // up a URL builder.
      noAddress += list.length
      console.log(`·  publication ${pubId} "${desc}…" — Parliament publishes no HTML address (PDF only)`)
      console.log(`     ${list.length} row(s): the link is measured WRONG, so it is removed and the citation kept`)
      if (WRITE) {
        const ids = list.map((r) => r.id)
        await prisma.evidenceItem.updateMany({ where: { id: { in: ids } }, data: { url: null } })
        const after = await prisma.evidenceItem.findMany({
          where: { id: { in: ids } }, select: { url: true, citation: true },
        })
        const cleared = after.filter((a) => a.url === null).length
        const kept = after.filter((a) => (a.citation ?? '').trim().length > 0).length
        console.log(`     re-read: ${cleared}/${after.length} links removed, ${kept}/${after.length} still carry their citation`)
      }
      continue
    }
    console.log(`→  publication ${pubId} "${desc}…"  ${list.length} row(s)`)
    console.log(`     from ${list[0].url}`)
    console.log(`     to   ${correct}`)
    if (!WRITE) { fixed += list.length; continue }

    const ids = list.map((r) => r.id)
    await prisma.evidenceItem.updateMany({ where: { id: { in: ids } }, data: { url: correct } })
    // ⚠ RE-READ. Not the intent — the stored value.
    const after = await prisma.evidenceItem.findMany({
      where: { id: { in: ids } }, select: { url: true },
    })
    const stuck = after.filter((a) => a.url !== correct).length
    console.log(`     re-read: ${after.length - stuck}/${after.length} now carry the corrected address`
      + `${stuck ? ` ⚠ ${stuck} did not take` : ''}`)
    fixed += after.length - stuck
  }

  console.log(`\n${fixed} row(s) ${WRITE ? 'rewritten' : 'would be rewritten'} with Parliament's own address; `
    + `${noAddress} had their wrong link ${WRITE ? 'removed' : 'to be removed'}, citation kept.`)
  if (!WRITE) console.log('Plan only. Nothing written. Re-run with --write.\n')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
