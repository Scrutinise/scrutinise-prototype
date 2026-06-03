// TNA document counts — uses link rel="last" from Atom feed (same pattern as tna-caselaw.ts)
// Fallback: opensearch:totalResults if present

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/atom+xml, */*', 'User-Agent': 'Scrutinise-Ingest/1.0' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

function extractTotal(xml: string): number | null {
  // Try opensearch:totalResults first
  const m1 = xml.match(/<[^:>]*:totalResults[^>]*>(\d+)<\//)
    ?? xml.match(/totalResults[^>]*>(\d+)<\//)
  if (m1) return parseInt(m1[1])

  // Fall back to last-page link × per-page count
  const m2 = xml.match(/href="[^"]+[?&]page=([0-9]+)"[^>]*rel="last"/)
    ?? xml.match(/rel="last"[^>]*href="[^"]+[?&]page=([0-9]+)"/)
  if (m2) {
    // Detect per-page count from feed entries
    const entries = (xml.match(/<entry>/g) ?? []).length
    const perPage = entries > 0 ? entries : 20
    return parseInt(m2[1]) * perPage
  }

  return null
}

async function run() {
  // Each entry in: (legType, feedUrl, resultsCount param to request only 1 entry)
  const types: [string, string][] = [
    ['ukpga', 'https://www.legislation.gov.uk/ukpga/data.feed?results-count=1'],
    ['uksi',  'https://www.legislation.gov.uk/uksi/data.feed?results-count=1'],
    ['asp',   'https://www.legislation.gov.uk/asp/data.feed?results-count=1'],
    ['wsi',   'https://www.legislation.gov.uk/wsi/data.feed?results-count=1'],
    ['nisr',  'https://www.legislation.gov.uk/nisr/data.feed?results-count=1'],
    ['nisi',  'https://www.legislation.gov.uk/nisi/data.feed?results-count=1'],
    ['ukcm',  'https://www.legislation.gov.uk/ukcm/data.feed?results-count=1'],
    ['ukla',  'https://www.legislation.gov.uk/ukla/data.feed?results-count=1'],
    ['ukni',  'https://www.legislation.gov.uk/ukni/data.feed?results-count=1'],
    ['asc',   'https://www.legislation.gov.uk/asc/data.feed?results-count=1'],
  ]

  const results: { type: string; total_docs: number | string }[] = []

  for (const [type, url] of types) {
    const xml = await fetchFeed(url)
    if (!xml) {
      results.push({ type, total_docs: 'timeout/error' })
      console.log(`${type}: timeout or error`)
      continue
    }
    const total = extractTotal(xml)
    results.push({ type, total_docs: total ?? 'not in feed' })
    console.log(`${type}: ${total ?? 'not in feed'}`)
    // brief pause to avoid hammering TNA
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n=== TNA TOTALS SUMMARY ===')
  console.table(results)
}

run().catch(e => { console.error(e); process.exit(1) })
