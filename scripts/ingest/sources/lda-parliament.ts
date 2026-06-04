// lda.data.parliament.uk — Linked Data API, no authentication required.
// Max 500 records/page, pagination via _page param (0-indexed).
// Confirmed working datasets (3 Jun 2026 V6 diagnostic):
//   commonsoralquestions  — 69,852 records
//   lordswrittenquestions — 103,137 records
//   commonswrittenquestions — 618,599 records
//   commonsdivisions      — 5,553 records
//   lordsdivisions        — 2,089 records

export interface LdaItem {
  id: string
  text: string
  sourceUrl: string
}

// Transient HTTP codes that warrant retry with backoff (Cloudflare/origin timeout/overload)
const TRANSIENT_STATUS = new Set([524, 502, 503, 504])

export async function fetchLdaPage(
  slug: string,
  page: number,
  pageSize = 500,
  maxRetries = 3,
): Promise<{ items: LdaItem[]; totalResults: number }> {
  const url =
    `https://lda.data.parliament.uk/${slug}.json?_pageSize=${pageSize}&_page=${page}`

  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt))
    const res = await fetch(url, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0' } })
    if (res.status === 524 && pageSize > 100) {
      // Large page timed out — retry once with a smaller page size.
      // Note: page*100 is a different offset than page*500, so this fetches
      // a different (smaller) slice. Accepts partial coverage over zero.
      console.warn(`[lda] 524 on ${slug} page ${page} (size ${pageSize}) — retrying with pageSize 100`)
      return fetchLdaPage(slug, page, 100, maxRetries)
    }
    if (TRANSIENT_STATUS.has(res.status)) {
      lastError = new Error(`LDA ${slug} page ${page}: HTTP ${res.status}`)
      continue
    }
    if (!res.ok) throw new Error(`LDA ${slug} page ${page}: HTTP ${res.status}`)
    const data = await res.json()
    const rawItems: unknown[] = data.result?.items ?? []
    return {
      items: rawItems.map(item => ldaRawToItem(item as Record<string, unknown>, slug)),
      totalResults: (data.result?.totalResults as number) ?? 0,
    }
  }
  throw lastError ?? new Error(`LDA ${slug} page ${page}: all retries exhausted`)
}

function ldaRawToItem(item: Record<string, unknown>, slug: string): LdaItem {
  const about = (item._about as string) ?? ''
  const id = about.split('/').pop() ?? about
  const sourceUrl = about.startsWith('http')
    ? about
    : `https://lda.data.parliament.uk/${slug}/${id}`
  return { id, text: ldaItemToText(item, slug), sourceUrl }
}

export function ldaItemToText(item: Record<string, unknown>, slug: string): string {
  const parts: string[] = []

  if (slug.includes('questions')) {
    const dateRaw = (item.dateTabled as { _value?: string })?._value ??
                   (item.AnswerDate as { _value?: string })?._value ?? ''
    const bodyArr = item.AnsweringBody
    const body = Array.isArray(bodyArr)
      ? ((bodyArr[0] as { _value?: string })?._value ?? '')
      : ((bodyArr as { _value?: string })?._value ?? '')
    const memberRaw = item.tablingMember as { label?: { _value?: string } } | undefined
    const member = memberRaw?.label?._value ?? ''
    const question = (item.questionText as string) ?? ''
    const answerRaw = item.answerText ?? (item.answer as { _value?: string; label?: string })
    const answer =
      typeof answerRaw === 'string' ? answerRaw
      : (answerRaw as { _value?: string })?._value ?? (answerRaw as { label?: string })?.label ?? ''

    if (dateRaw) parts.push(`Date: ${dateRaw}`)
    if (body)    parts.push(`To: ${body}`)
    if (member)  parts.push(`From: ${member}`)
    if (question) parts.push(`Question: ${question}`)
    if (answer)  parts.push(`Answer: ${answer}`)
  } else if (slug.includes('divisions')) {
    const title = (item.title as string) ?? ''
    const date  = (item.date as { _value?: string })?._value ?? ''
    const uin   = (item.uin as string) ?? ''
    if (title) parts.push(title)
    if (date)  parts.push(`Date: ${date}`)
    if (uin)   parts.push(`UIN: ${uin}`)
  } else {
    return JSON.stringify(item)
  }

  return parts.filter(Boolean).join('\n')
}
