// ─────────────────────────────────────────────────────────────────────────────
// 25-V §1a/§1c — VERIFY EVERY CITATION ON A PROPOSAL, AND TELL "BLOCKED" FROM "WRONG".
//
// ⚠⚠ A STATUS CODE CANNOT DO THIS, AND THAT IS THE WHOLE POINT. `publications.parliament.uk` and
// `committees.parliament.uk` answer every automated request with 403 — a JS Cloudflare challenge
// that a complete browser header set does not clear (measured 2 Sep 2026) and that the Internet
// Archive has no snapshot of. So a link-checker sees one 403 for a perfect citation and the same
// 403 for one pointing at a page about grouse shooting.
//
// ⚠⚠ THE WAY THROUGH IS NOT TO FETCH THE PAGE. For the committee family — 130 of this proposal's
// citations — Parliament publishes an unauthenticated metadata API that is NOT behind the
// challenge:
//
//     GET https://committees-api.parliament.uk/api/Publications/{publicationId}
//        → { description, publicationStartDate, documents:[{documentId}], additionalContentUrl }
//
// That answers the question a status code cannot: *is this publication the document we say it
// is?* It compares our stored citation against Parliament's own description, and it hands back
// the correct readable URL at the same time.
//
// ⚠ AND IT ALREADY OVERTURNED THE DIAGNOSIS ONCE. The obvious reading of 25-U was that the corpus
// was wrong or the model invented a title. Neither: for the two rows checked by hand the API's
// `description` matched our stored citation WORD FOR WORD, and `documents[0].documentId` matched
// the second component of our own corpus id. The corpus is right. What is wrong is a URL we
// CONSTRUCT — `committees.parliament.uk/publications/{n}/html/` addresses a written-evidence id
// space, not the committee-publication id space our ids come from. Same path, different register.
// So the citation is sound and the hyperlink under it is not, which is a different fix.
//
// Usage:
//   npx tsx --env-file=.env scripts/verify-citations.ts [ideaId] [--limit N] [--json out.json]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'

const IDEA = process.argv[2]?.startsWith('--') || !process.argv[2]
  ? '452c5ade-3153-400a-bf48-3b71aaa52773' : process.argv[2]
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || 0
const JSON_OUT = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null

type Verdict = 'CONFIRMED' | 'WRONG_TARGET' | 'DEAD' | 'UNVERIFIABLE'
/**
 * ⚠⚠ TWO VERDICTS, NOT ONE, AND CONFLATING THEM IS HOW 25-U's SAMPLE READ AS "3 IN 10 WRONG".
 *
 * A committee citation has a CITATION — the document it names — and a LINK — where clicking it
 * lands. Parliament's API settles the first. The second is ours, constructed, and can be wrong
 * while the first is perfect. That is exactly the case here, and the two have different fixes:
 * one would be a corpus repair, the other is a URL builder.
 */
type Link = 'LINK_OK' | 'LINK_WRONG' | 'LINK_UNKNOWN'
interface Row {
  sourceId: string; citation: string; url: string; verdict: Verdict
  detail: string; correctUrl?: string | null; link: Link; linkDetail: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Loose comparison — punctuation and case differ between our store and Parliament's. */
function sameDocument(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  const A = n(a); const B = n(b)
  if (!A || !B) return false
  if (A.includes(B) || B.includes(A)) return true
  // Otherwise: do most of the shorter one's words appear in the longer?
  const [short, long] = A.length <= B.length ? [A, B] : [B, A]
  const words = short.split(' ').filter((w) => w.length > 3)
  if (words.length < 3) return false
  const hit = words.filter((w) => long.includes(w)).length
  return hit / words.length >= 0.8
}

async function committeeApi(pubId: string) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 25_000)
  try {
    const r = await fetch(`https://committees-api.parliament.uk/api/Publications/${pubId}`,
      { headers: { Accept: 'application/json' }, signal: ctl.signal })
    if (r.status === 404) return { missing: true as const }
    if (!r.ok) return { error: `HTTP ${r.status}` as const }
    return { data: await r.json() as {
      description?: string
      documents?: Array<{ documentId?: number }>
      additionalContentUrl?: string | null
      publicationStartDate?: string
    } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  } finally { clearTimeout(t) }
}

async function plainFetch(url: string) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 25_000)
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Scrutinise-citation-check/1.0)' },
    })
    const ct = r.headers.get('content-type') ?? ''
    let title: string | null = null
    if (r.ok && ct.includes('html')) {
      const body = (await r.text()).slice(0, 30000)
      title = body.match(/<title[^>]*>([\s\S]{0,240}?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? null
    }
    return { status: r.status, title, contentType: ct.split(';')[0] }
  } catch (e) {
    return { status: 0, title: null, contentType: '', error: e instanceof Error ? e.message : String(e) }
  } finally { clearTimeout(t) }
}

async function main() {
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId: IDEA, url: { not: null } },
    select: { sourceId: true, citation: true, title: true, url: true, sourceType: true },
  })
  // One verdict per distinct source, not per finding — a source cited nine times is one citation
  // to check and nine findings that rest on it.
  const bySource = new Map<string, typeof rows[number]>()
  for (const r of rows) if (r.sourceId && !bySource.has(r.sourceId)) bySource.set(r.sourceId, r)
  let list = [...bySource.values()]
  if (LIMIT) list = list.slice(0, LIMIT)

  console.log(`\n── verifying ${list.length} distinct sources (${rows.length} findings rest on them) ──\n`)

  const out: Row[] = []
  for (const [i, r] of list.entries()) {
    const sourceId = r.sourceId!
    const url = r.url!
    const claim = r.citation || r.title
    let verdict: Verdict = 'UNVERIFIABLE'
    let detail = ''
    let correctUrl: string | null | undefined
    let link: Link = 'LINK_UNKNOWN'
    let linkDetail = ''

    // ⚠ THE DOCUMENT COMPONENT IS NOT ALWAYS NUMERIC. A first version required `(\d+):(\d+)` and
    // silently dropped 39 of 183 sources into the 403 bucket, where they read as "blocked" —
    // the very confusion this script exists to end. Ids like
    // `committees-reports:publication:24925:arc-0002` carry an archive document key.
    const cm = sourceId.match(/^committees-reports:publication:(\d+):(\S+)/)
    if (cm) {
      const [, pubId, docId] = cm
      const res = await committeeApi(pubId)
      if ('missing' in res) { verdict = 'DEAD'; detail = `the API has no publication ${pubId}` }
      else if ('error' in res) { verdict = 'UNVERIFIABLE'; detail = `API ${res.error}` }
      else {
        const d = res.data.description ?? ''
        correctUrl = res.data.additionalContentUrl ?? null
        const docOk = (res.data.documents ?? []).some((x) => String(x.documentId) === docId.split('-')[0])
        if (sameDocument(claim, d)) {
          verdict = 'CONFIRMED'
          detail = `Parliament's own description matches${docOk ? '; documentId matches too' : '; ⚠ documentId does NOT match'}`
        } else {
          verdict = 'WRONG_TARGET'
          detail = `we cite "${claim.slice(0, 70)}…"; publication ${pubId} is "${d.slice(0, 70)}…"`
        }

        // ══ ⚠⚠ THE LINK, JUDGED SEPARATELY FROM THE CITATION ════════════════════════════════
        //
        // `committees.parliament.uk/publications/{n}/html/` is a WRITTEN-EVIDENCE address space.
        // Measured 2 Sep 2026: publication 6912 is the Greensill interim report, and
        // /publications/6912/html/ serves "Written Evidence Submitted by Professor Sir Michael
        // Ferguson (RFA0008)" on research funding; /publications/72615/html/ — 72615 being that
        // publication's own documentId — serves "GRO0117 - Evidence on Grouse Shooting". Neither
        // id space is the one our corpus ids come from.
        //
        // ⚠ SO A CONSTRUCTED `/publications/N/html/` URL IS WRONG UNLESS PROVED OTHERWISE, and
        // "it returns 200" proves nothing: it returns 200 for somebody else's document. Where
        // Parliament gives an `additionalContentUrl` that is the readable address and ours is
        // not it, the link is wrong and the right one is known.
        const constructed = /committees\.parliament\.uk\/(publications|writtenevidence|oralevidence)\/\d+\/html\/?$/i.test(url)
        if (!constructed) { link = 'LINK_OK'; linkDetail = 'not a constructed committee URL' }
        else if (correctUrl) {
          link = 'LINK_WRONG'
          linkDetail = `points into the written-evidence id space; Parliament's own address is ${correctUrl}`
        } else {
          link = 'LINK_WRONG'
          linkDetail = 'points into the written-evidence id space; Parliament publishes no HTML address for this publication (PDF only)'
        }
      }
      await sleep(150)
    } else {
      const res = await plainFetch(url)
      if (res.status === 403) {
        verdict = 'UNVERIFIABLE'
        detail = '403 — Cloudflare challenge; a status code cannot tell blocked from wrong here'
      } else if (res.status === 404 || res.status === 410) {
        verdict = 'DEAD'; detail = `HTTP ${res.status}`
      } else if (res.status >= 200 && res.status < 300) {
        if (res.title && !sameDocument(claim, res.title)) {
          verdict = 'UNVERIFIABLE'
          detail = `resolves; page title "${res.title.slice(0, 70)}" does not obviously match the citation`
        } else { verdict = 'CONFIRMED'; detail = res.title ? 'page title matches' : `resolves (${res.contentType})` }
      } else {
        verdict = 'UNVERIFIABLE'; detail = `HTTP ${res.status}${'error' in res ? ` ${res.error}` : ''}`
      }
      link = verdict === 'CONFIRMED' ? 'LINK_OK' : 'LINK_UNKNOWN'
      linkDetail = verdict === 'CONFIRMED' ? 'the link is what was fetched' : 'not established'
      await sleep(120)
    }

    out.push({ sourceId, citation: claim, url, verdict, detail, correctUrl, link, linkDetail })
    const mark = verdict === 'CONFIRMED' ? (link === 'LINK_WRONG' ? '⚠' : '✓')
      : verdict === 'UNVERIFIABLE' ? '?' : '✗'
    console.log(`${mark} ${String(i + 1).padStart(3)}. ${verdict.padEnd(13)} ${detail}`)
    if (link === 'LINK_WRONG') console.log(`         LINK_WRONG — ${linkDetail}`)
    if (verdict !== 'CONFIRMED' || link === 'LINK_WRONG') console.log(`         ${url}`)
  }

  const tally = (v: Verdict) => out.filter((o) => o.verdict === v).length
  console.log(`\n── ${out.length} distinct sources ──`)
  console.log(`  CONFIRMED    ${tally('CONFIRMED')}`)
  console.log(`  WRONG_TARGET ${tally('WRONG_TARGET')}   ⚠ the citation names a document the link does not lead to`)
  console.log(`  DEAD         ${tally('DEAD')}`)
  console.log(`  UNVERIFIABLE ${tally('UNVERIFIABLE')}   ⚠ NOT a pass. Reported as unchecked, never as fine.`)

  const linkWrong = out.filter((o) => o.link === 'LINK_WRONG').length
  const linkKnown = out.filter((o) => o.link !== 'LINK_UNKNOWN').length
  console.log(`\n── and the LINKS, judged separately ──`)
  console.log(`  LINK_WRONG   ${linkWrong} of ${linkKnown} established`
    + `   ⚠ the citation is right and the hyperlink under it lands somewhere else`)
  const fixable = out.filter((o) => o.link === 'LINK_WRONG' && o.correctUrl).length
  console.log(`  of those, ${fixable} have a known correct address from Parliament's own API`)

  const wrongOrDead = tally('WRONG_TARGET') + tally('DEAD')
  const decided = out.length - tally('UNVERIFIABLE')
  console.log(`\n  rate among sources that could be decided: ${wrongOrDead}/${decided}`
    + `${decided ? ` = ${(wrongOrDead / decided * 100).toFixed(1)}%` : ''}`)

  if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(out, null, 2), 'utf8'); console.log(`\n  written to ${JSON_OUT}`) }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
