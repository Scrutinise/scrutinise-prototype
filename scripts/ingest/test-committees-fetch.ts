/**
 * test-committees-fetch.ts
 *
 * ONE-OFF DIAGNOSTIC — run via TEST_COMMITTEES_FETCH=1 env var on a Railway worker.
 * Tests whether Railway worker IPs can access committees.parliament.uk/publications/other-publications/
 * without CF challenges, using the same curl approach as fetchPublicationHtml().
 *
 * Reports: HTTP status, body size, CF challenge detection, publication card count.
 * Tests 5 pages in sequence with 1.5s delay to check session stability.
 */
import { spawnSync } from 'child_process'
import os from 'os'
import path from 'path'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const COOKIE_JAR = path.join(os.tmpdir(), 'test-committees-cookies.txt')

function curlPage(url: string, bin = 'curl'): { status: number; size: number; isChallenge: boolean; cardCount: number; error?: string } {
  const r = spawnSync(bin, [
    '-s', '--max-time', '30',
    '-L',                        // follow any redirects
    '-c', COOKIE_JAR,            // write cookies (session persistence across pages)
    '-b', COOKIE_JAR,            // send existing cookies
    '-A', BROWSER_UA,
    '-H', 'Accept: text/html,application/xhtml+xml',
    '-H', 'Accept-Language: en-GB,en;q=0.9',
    '-w', '\n__HTTP_STATUS_CODE__:%{http_code}',
    url,
  ], { encoding: 'utf8', timeout: 35_000, maxBuffer: 5 * 1024 * 1024 })

  if (r.error) return { status: 0, size: 0, isChallenge: false, cardCount: 0, error: String(r.error) }
  if (r.status !== 0) return { status: 0, size: 0, isChallenge: false, cardCount: 0, error: `curl exit ${r.status}` }

  const stdout = r.stdout as string
  const statusMatch = stdout.match(/__HTTP_STATUS_CODE__:(\d+)/)
  const status = parseInt(statusMatch?.[1] ?? '0', 10)
  const body = stdout.replace(/\n__HTTP_STATUS_CODE__:\d+$/, '')

  const isChallenge = body.includes('challenge-platform') || body.includes('Just a moment') || body.includes('Enable JavaScript and cookies')
  // Count publication card elements (class="publications__row" or class="card-publications")
  const cardCount = (body.match(/class="publications__row"|class="[^"]*card-publications[^"]*"/g) ?? []).length

  return { status, size: body.length, isChallenge, cardCount }
}

export async function runCommitteesTest(): Promise<void> {
  console.log('[test-committees] ═══ START ═══')
  console.log(`[test-committees] Platform: ${process.platform} / Node: ${process.version}`)
  console.log(`[test-committees] Cookie jar: ${COOKIE_JAR}`)

  // Diagnose PATH and curl availability
  const envPath = process.env.PATH ?? '(not set)'
  console.log(`[test-committees] PATH: ${envPath}`)

  // Try to find curl in common locations
  const curlCandidates = ['curl', '/usr/bin/curl', '/usr/local/bin/curl', '/bin/curl']
  let curlBin: string | null = null
  for (const candidate of curlCandidates) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 5000 })
    if (!probe.error && probe.status === 0) {
      curlBin = candidate
      console.log(`[test-committees] curl found at: ${candidate}  ${(probe.stdout as string).split('\n')[0]}`)
      break
    } else {
      console.log(`[test-committees] ${candidate}: ${probe.error?.code ?? `exit ${probe.status}`}`)
    }
  }

  if (!curlBin) {
    // Also try which
    const w = spawnSync('which', ['curl'], { encoding: 'utf8', timeout: 3000 })
    const whichResult = (w.error?.code ?? (w.stdout as string).trim()) || 'not found'
    console.log(`[test-committees] which curl: ${whichResult}`)
    const ls = spawnSync('ls', ['/usr/bin/'], { encoding: 'utf8', timeout: 3000 })
    const bins = (ls.stdout as string).split(/\s+/).filter(b => b.includes('curl') || b.includes('wget') || b.includes('http'))
    console.log(`[test-committees] /usr/bin/ network tools: ${bins.join(', ') || '(none matching)'}`)
    console.log('[test-committees] Cannot proceed — curl not available in worker container')
    return
  }

  const baseUrl = 'https://committees.parliament.uk/publications/other-publications/?page='

  for (let page = 1; page <= 5; page++) {
    const url = baseUrl + page
    const t0 = Date.now()
    const result = curlPage(url, curlBin)
    const ms = Date.now() - t0

    if (result.error) {
      console.log(`[test-committees] p${page}: ERROR ${result.error} (${ms}ms)`)
    } else {
      const challenge = result.isChallenge ? 'CF-CHALLENGE' : 'OK'
      console.log(`[test-committees] p${page}: HTTP ${result.status} | ${result.size}b | ${challenge} | ${result.cardCount} cards | ${ms}ms`)
    }

    if (page < 5) await new Promise(r => setTimeout(r, 1500))
  }

  console.log('[test-committees] ═══ DONE ═══')
}
