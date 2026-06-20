/**
 * erskine-may.ts — Erskine May: Parliamentary Practice (V29 §3.1).
 *
 * The authoritative treatise on UK parliamentary procedure, published online by
 * the Houses of Parliament under the Open Parliament Licence v3.0 and exposed as
 * a clean JSON API (erskinemay-api.parliament.uk):
 *
 *   GET /api/Part                  → [{ number, title, description, chapters[] }]
 *   GET /api/Chapter/{number}      → { ..., sections[] }  (nested tree:
 *                                     { id, title, titleChain, subSections[] })
 *   GET /api/Section/{id}          → { partTitle, chapterTitle, chapterNumber,
 *                                      parentSectionTitle, contentHtml,
 *                                      footnotes[{number,content}] }
 *
 * Unit of value = one Section node (a numbered paragraph, e.g. "31.4"). We
 * enumerate every section id by walking chapters 1..N and flattening each
 * chapter's section tree, then the worker fetches one Section per row.
 */
const BASE = 'https://erskinemay-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

async function getJson(url: string, attempts = 3): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.status === 404) return null
      if (res.ok) return await res.json()
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

interface SectionNode { id: number; title: string; titleChain: string | null; subSections?: SectionNode[] }

function flatten(nodes: SectionNode[] | undefined, out: number[]): void {
  for (const n of nodes ?? []) {
    if (typeof n.id === 'number') out.push(n.id)
    flatten(n.subSections, out)
  }
}

// Walk chapters 1..N (stop after maxMisses consecutive 404s) → all section ids.
export async function enumerateErskineSections(
  maxMisses = 5,
  onProgress?: (chapters: number, sections: number) => void,
): Promise<number[]> {
  const ids: number[] = []
  let misses = 0
  let chapters = 0
  for (let n = 1; misses < maxMisses; n++) {
    const ch = await getJson(`${BASE}/api/Chapter/${n}`)
    if (!ch) { misses++; continue }
    misses = 0
    chapters++
    flatten(ch.sections, ids)
    onProgress?.(chapters, ids.length)
    await new Promise(r => setTimeout(r, 250))
  }
  // de-dup (a tree can repeat an id in pathological cases)
  return [...new Set(ids)]
}

export interface ErskineSection {
  id: number
  title: string
  text: string
}

// Fetch one Section → searchable text (paragraph body + footnotes), with a
// chapter/section title derived from the detail response.
export async function fetchErskineSection(id: number): Promise<ErskineSection | null> {
  const d = await getJson(`${BASE}/api/Section/${id}`)
  if (!d) return null
  const { rawToText } = await import('../shared/compile')
  const body = d.contentHtml ? rawToText(d.contentHtml) : ''
  const footnotes: string = Array.isArray(d.footnotes) && d.footnotes.length
    ? '\n\nFootnotes:\n' + d.footnotes.map((f: any) => `${f.number}. ${rawToText(f.content ?? '')}`).join('\n')
    : ''
  const text = (body + footnotes).trim()
  if (!text) return null
  const titleParts = [d.chapterTitle, d.parentSectionTitle].filter((x: string) => x && x.trim())
  const title = titleParts.join(': ') || `Erskine May §${id}`
  return { id, title, text }
}
