/**
 * check-25h-verify.ts — planted breaks against the PILOT'S OWN verification
 * function, imported rather than reimplemented.
 *
 * The hand-verification in `pilot-25h-crag.ts` reported 20/20 correct. A check
 * that passes everything is worth nothing until it has been watched to fail, so
 * this feeds it real live text and false claims about it.
 *
 * ⚠ It imports `provisionNamedWithAct` from the pilot. An earlier version of
 * this control re-implemented the logic, and its copy disagreed with the real
 * code — the copy had lost its regex escapes, so it "rejected" a claim the
 * pilot correctly accepted, and for a few minutes it looked as though the data
 * were wrong. A control that is a copy tests the copy.
 *
 *   npx tsx graph/check-25h-verify.ts
 */
import { provisionNamedWithAct, CRAG_NAME_RX } from './pilot-25h-crag'

type Case = { gid: string; path: string; claim: string; expect: boolean; why: string }

const CASES: Case[] = [
  // TRUE claims — the check must accept these, or it rejects everything and
  // "0 wrong" would mean "the check is broken", not "the data is right".
  { gid: 'ukpga/2006/32', path: 'section/52', claim: 'section-3', expect: true, why: 'real: "…by section 3 of the Constitutional Reform and Governance Act 2010" — and it is the SECOND of six mentions' },
  { gid: 'ukpga/2006/32', path: 'section/52', claim: 'part-1', expect: true, why: 'real: "See Part 1 of the …" — the first mention' },
  { gid: 'ukpga/1978/36', path: 'section/2', claim: 'part-1', expect: true, why: 'real: "…within the meaning of Chapter 1 of Part 1 of the …"' },
  { gid: 'ssi/2024/166', path: 'regulation/11', claim: 'section-1-4', expect: true, why: 'real: "…given by section 1(4) of the …"' },

  // FALSE claims about the SAME documents — the check must reject these.
  { gid: 'ukpga/2006/32', path: 'section/52', claim: 'section-99', expect: false, why: 'CRAG has no section 99 and this provision does not name one' },
  { gid: 'ukpga/1978/36', path: 'section/2', claim: 'section-42', expect: false, why: 'a provision number that appears nowhere near the Act name' },
  { gid: 'ukpga/2000/23', path: 'section/81', claim: 'schedule-7', expect: false, why: 'wrong KIND — the reference is to Part 1, not a schedule' },
  { gid: 'ssi/2024/166', path: 'regulation/11', claim: 'part-4', expect: false, why: 'wrong Part — the reference is to section 1(4)' },
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * ⚠ RETRIES, AND PAUSES BETWEEN REQUESTS (added 2026-08-28, GRAPH 4B).
 *
 * This fetched four documents back to back with no retry, and on 28 August it
 * died on `HTTP 500` from legislation.gov.uk — a source-side rate limit, not a
 * missing document: every one of the four returns 200 when requested one at a
 * time. **A check that fails on the source's throughput reports a fault in our
 * data**, and the honest reading of a single 500 is "ask again more slowly".
 * The same fix is in `check-4b-layer2.ts`'s hand-check, which hit this first
 * with eleven of twenty timing out.
 */
async function fetchFlat(gid: string, path: string): Promise<string> {
  const url = `https://www.legislation.gov.uk/${gid}/${path}/data.xml`
  let last = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'scrutinise-citation-audit/25H' },
        signal: AbortSignal.timeout(60_000),
      })
      if (res.ok) {
        const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        await sleep(2500)
        return body
      }
      last = `HTTP ${res.status}`
    } catch (e) { last = (e as Error).message }
    await sleep(10_000 * (attempt + 1))
  }
  throw new Error(`${url}: ${last} after 4 attempts`)
}

async function main() {
  let pass = 0, fail = 0, unfetchable = 0
  const cache = new Map<string, string>()
  for (const c of CASES) {
    const key = `${c.gid}/${c.path}`
    // ⚠⚠ A DOCUMENT THE SOURCE WILL NOT SERVE IS NOT A FAILING CASE.
    // This threw and killed the run on 28 August, on a 500 that moved to a
    // different document on the next attempt — legislation.gov.uk rate limits,
    // and every one of these URLs returns 200 when asked for on its own. A check
    // that dies on someone else's throughput reports a fault in OUR data. It is
    // now counted as unchecked, and the run fails only if too few cases were
    // actually reached to prove anything.
    if (!cache.has(key)) {
      try { cache.set(key, await fetchFlat(c.gid, c.path)) }
      catch (e) {
        unfetchable++
        console.log(`  SKIP  ${key} — ${(e as Error).message}`)
        continue
      }
    }
    const v = provisionNamedWithAct(cache.get(key)!, c.claim, CRAG_NAME_RX)
    const ok = v.ok === c.expect
    if (ok) pass++; else fail++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.expect ? 'accepts' : 'rejects'} ${key} → ${c.claim}` +
      `  (Act named in ${v.occurrences} place(s), verdict ${v.ok})`)
    console.log(`        ${c.why}`)
  }
  const checked = pass + fail
  const accepted = CASES.filter(c => c.expect).length
  console.log(`\n${pass} passed, ${fail} failed, ${unfetchable} not fetchable  ·  ${accepted} true claims and ${CASES.length - accepted} false claims in the suite`)
  if (fail === 0 && accepted === 0) { console.error('⚠ no true claims — a check that rejects everything would pass this suite'); process.exit(1) }
  // ⚠ Skipping is not passing. A run the source starved must not report success:
  // half the suite is the floor, and both a true and a false claim must have
  // been reached, or "0 failed" means "nothing was tested".
  const reachedTrue = CASES.some(c => c.expect && cache.has(`${c.gid}/${c.path}`))
  const reachedFalse = CASES.some(c => !c.expect && cache.has(`${c.gid}/${c.path}`))
  if (checked < Math.ceil(CASES.length / 2) || !reachedTrue || !reachedFalse) {
    console.error(`⚠⚠ only ${checked} of ${CASES.length} cases were reachable (true reached: ${reachedTrue}, false reached: ${reachedFalse}) — too few to prove anything. Re-run.`)
    process.exit(1)
  }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
