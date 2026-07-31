// Shared polite-fetch helper. The ONS CDID CSV endpoint 429s under rapid-fire
// requests (hit this during source probing on 30 Jul 2026) — every CDID pull
// must be spaced out and retry once on 429/5xx rather than failing the whole run.

const UA = 'Scrutinise/1.0 (statistics layer; +https://scrutinise.org)'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function politeFetch(
  url: string,
  opts: { delayMs?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<Response> {
  const { delayMs = 1500, retries = 2, headers = {} } = opts
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(delayMs * 2 ** attempt)
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } })
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} on ${url}`)
        continue
      }
      await sleep(delayMs) // space out the NEXT call regardless of this one's outcome
      return res
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`politeFetch failed for ${url}`)
}
