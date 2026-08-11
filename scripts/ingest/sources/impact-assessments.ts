/**
 * impact-assessments.ts — §B of BRIEF_INGEST_POLITICAL_SOURCES.
 *
 * "The government's own statement, published alongside a Bill or SI, of the
 * problem being solved, the options considered, the option chosen, the expected
 * costs and benefits, and the intended outcomes." — the best single answer to
 * "has anyone tried to fix this before, and what did they think would happen?"
 *
 * ── ROUTE, chosen by the standing priority (bulk → HTML → API) ────────────────
 *
 * BULK WINS, and by a lot. legislation.gov.uk publishes impact assessments as a
 * first-class legislation type, `ukia`, with a per-year Atom feed:
 *
 *     https://www.legislation.gov.uk/ukia/{year}/data.feed?page=N
 *
 * That reuses the TNA pipeline we already run, and — the part that matters —
 * each entry carries the JOIN we would otherwise have had to reconstruct:
 *
 *     <link rel="alternate" href=".../uksi/2008/2924/impacts/2023/199"/>
 *     <ukm:DocumentStage Value="Post Implementation"/>
 *     <ukm:Department Value="Department for Transport"/>
 *     <ukm:Date Value="2023-08-14"/>
 *
 * i.e. WHICH INSTRUMENT the IA belongs to, at what stage, from which
 * department, on what date — structured, not parsed out of prose. 16 of 21
 * sampled carried the instrument link.
 *
 * ⚠ MEASURED COVERAGE, AND ITS HOLES. 1,181 IAs across 2005–2026, but the years
 * are not continuous: 2005(1) 2006(2) 2007(37) — then NOTHING 2008–2016 —
 * 2017(171) 2018(184) 2019(165) 2020(103) 2021(92) 2022(108) 2023(189) — then
 * NOTHING 2024–2025 — 2026(129). The 2008–2016 gap and the 2024–2025 gap are
 * KNOWN UNKNOWNS. They are not asserted to be "no IAs were published"; they are
 * "legislation.gov.uk holds none for those years", which is a different claim,
 * and the gov.uk route below is what covers the difference. Recorded rather
 * than smoothed over, per the standing rule that known unknowns beat silent
 * absences.
 *
 * SECOND ROUTE — gov.uk, 1,932 documents typed `impact_assessment`. ⚠ That type
 * is NOISY: the newest three at time of probing were HS2 air-quality and noise
 * monitoring reports, which are not impact assessments of legislation in the
 * sense this brief means. So gov.uk items are ingested with the document type
 * recorded and are NOT presented as equivalent to a `ukia` deposit.
 *
 * THIRD — Regulatory Policy Committee, 826 documents. An RPC "not fit for
 * purpose" rating on an IA is exactly the contested provenance a user should
 * see, so these are worth having even though they are opinions ABOUT IAs
 * rather than IAs.
 *
 * ── FORMAT: PDF, and it extracts ─────────────────────────────────────────────
 * There is no CLML for `ukia` (data.xml 404s) — the content is a PDF with an
 * HTML wrapper. Extraction was measured on 21 real IAs spread across every year
 * with content BEFORE committing to the route:
 *
 *     20/21 yielded >1k chars; 1 low-yield (likely scanned); 0 fetch failures
 *     mean 120,180 chars per IA; largest 542,498 chars over 233 pages
 *     mean 6.6/9 standard proforma fields present
 *
 * ⚠ The proforma score splits cleanly by stage and this is a fact about the
 * documents, not a defect: "Final"/"Enactment" IAs scored 9/9, while
 * "Post Implementation" reviews (PIRs) scored 3/9 because a PIR uses a
 * different template with different headings. Do not "fix" a PIR's low score.
 *
 * ⚠ At a mean of 120k chars, an IA is a V33-shaped trap: one row per document
 * would put whole documents in single rows, which is precisely what V33 spent a
 * sprint undoing (eur-lex:32007B0143:1 held 760,509 words in one row and was
 * 0.5% embedded). So IAs are SECTIONED on the proforma headings, with a size
 * fallback. See `sectionImpactAssessment`.
 *
 * Licence: OGL v3.0 (legislation.gov.uk and gov.uk both Crown copyright).
 */

const LEG = 'https://www.legislation.gov.uk'
const SEARCH = 'https://www.gov.uk/api/search.json'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

/** Years legislation.gov.uk actually holds `ukia` deposits for. Measured
 *  10 Aug 2026 — see the coverage note above. Re-measure, never extend by
 *  assumption: a year added here that has no feed costs a wasted walk, and a
 *  year missing here is silently dropped content. */
export const UKIA_YEARS = [2005, 2006, 2007, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2026]

export interface ImpactAssessment {
  /** e.g. "ukia/2023/199" */
  ukiaId: string
  year: number
  number: number
  title: string
  /** PDF url TAKEN FROM THE FEED. Never constructed — the natural guess
   *  (`ukia2023199_en.pdf`) 404s; the published form is `ukia_20230199_en.pdf`. */
  pdfUrl: string
  htmlUrl: string
  department: string | null
  /** "Final" | "Enactment" | "Post Implementation" | … as published. */
  stage: string | null
  date: string | null
  /** The instrument this IA belongs to, e.g. "uksi/2008/2924" or "ukpga/2017/29".
   *  null where the feed gives no alternate link — a real gap, not an error. */
  instrumentId: string | null
}

async function getText(url: string, accept: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

function attr(xml: string, tag: string): string | null {
  return xml.match(new RegExp(`<${tag} Value="([^"]*)"`, 'i'))?.[1]?.trim() || null
}

export function parseUkiaEntry(entry: string): ImpactAssessment | null {
  const id = entry.match(/<id>([^<]+)<\/id>/i)?.[1]
  const pdfUrl = entry.match(/<link[^>]*type="application\/pdf"[^>]*href="([^"]+)"/i)?.[1]
  if (!id || !pdfUrl) return null
  const m = id.match(/ukia\/(\d{4})\/(\d+)/)
  if (!m) return null
  const instrumentHref = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*\/impacts\/[^"]*)"/i)?.[1] ?? null
  return {
    ukiaId: `ukia/${m[1]}/${m[2]}`,
    year: Number(m[1]),
    number: Number(m[2]),
    title: (entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
    pdfUrl: pdfUrl.replace(/^http:/, 'https:'),
    htmlUrl: `${LEG}/ukia/${m[1]}/${m[2]}`,
    department: attr(entry, 'ukm:Department'),
    stage: attr(entry, 'ukm:DocumentStage'),
    date: attr(entry, 'ukm:Date'),
    // ".../uksi/2008/2924/impacts/2023/199" → "uksi/2008/2924"
    instrumentId: instrumentHref?.match(/\.uk\/([a-z]+\/\d+\/[\w\d]+)\/impacts\//i)?.[1] ?? null,
  }
}

/** Walk one year's Atom feed to exhaustion. Returns [] for a year with no
 *  deposits rather than throwing — an empty year is data. */
export async function listUkiaYear(year: number, delayMs = 350): Promise<ImpactAssessment[]> {
  const out: ImpactAssessment[] = []
  const seen = new Set<string>()
  for (let page = 1; ; page++) {
    const xml = await getText(`${LEG}/ukia/${year}/data.feed?page=${page}`, 'application/atom+xml')
    if (!xml) break
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
    if (entries.length === 0) break
    let added = 0
    for (const e of entries) {
      const ia = parseUkiaEntry(e)
      if (ia && !seen.has(ia.ukiaId)) { seen.add(ia.ukiaId); out.push(ia); added++ }
    }
    // Feeds paginate 20 at a time; a page that adds nothing new means the
    // server is re-serving page 1 (a real failure mode on this host).
    if (added === 0) break
    const total = Number(xml.match(/<openSearch:totalResults>(\d+)</i)?.[1] ?? 0)
    if (total && out.length >= total) break
    await new Promise(r => setTimeout(r, delayMs))
  }
  return out
}

export async function ukiaYearTotal(year: number): Promise<number> {
  const xml = await getText(`${LEG}/ukia/${year}/data.feed?page=1`, 'application/atom+xml')
  return Number(xml?.match(/<openSearch:totalResults>(\d+)</i)?.[1] ?? 0)
}

// ── Sectioning ───────────────────────────────────────────────────────────────
//
// The IA proforma. These are the headings that carry the product value, and
// they are the natural section boundaries. Ordered as they appear in the
// template so a match is anchored rather than scattered.

export const IA_HEADINGS: Array<[string, RegExp]> = [
  ['Problem under consideration',   /what is the problem under consideration[^?]*\??/i],
  ['Policy objectives',             /what are the policy objectives[^?]*\??/i],
  ['Options considered',            /what policy options have been considered[^?]*\??/i],
  ['Preferred option',              /(?:^|\n)[^\n]{0,80}preferred option[^\n]{0,80}/i],
  ['Costs and benefits',            /(?:^|\n)[^\n]{0,60}(?:costs and benefits|net benefit|net cost to business)[^\n]{0,60}/i],
  ['Rationale for intervention',    /rationale for (?:government )?intervention/i],
  ['Risks and assumptions',         /(?:key )?(?:risks and )?assumptions(?: and risks)?/i],
  ['Wider impacts',                 /wider impacts?/i],
  ['Post-implementation review',    /post[- ]implementation review|will the policy be reviewed/i],
  ['RPC opinion',                   /RPC opinion|Regulatory Policy Committee/i],
]

export interface IaSection { n: number; title: string; text: string }

/**
 * Split an extracted IA into sections.
 *
 * Two-stage, and the fallback is not an afterthought: at a mean of 120k chars
 * and a measured max of 542k, an IA that does not match the proforma must STILL
 * be split, or it becomes the next `eur-lex:32007B0143:1` — a whole document in
 * one row, embeddable to 0.5% of itself.
 *
 *   1. Cut on proforma headings where at least three are found in order.
 *   2. Otherwise cut on paragraph boundaries into ~`maxChars` pieces.
 *
 * Either way no section exceeds `maxChars`; a proforma section longer than that
 * is sub-split and keeps its heading with a part number, so the heading is
 * never lost to make the size fit.
 */
export function sectionImpactAssessment(text: string, maxChars = 12_000): IaSection[] {
  const clean = (text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []

  // Stage 1: locate proforma headings by position, keep only forward progress.
  const marks: Array<{ pos: number; title: string }> = []
  for (const [title, re] of IA_HEADINGS) {
    const m = clean.match(re)
    if (m && m.index != null) marks.push({ pos: m.index, title })
  }
  marks.sort((a, b) => a.pos - b.pos)

  let pieces: IaSection[] = []
  if (marks.length >= 3) {
    if (marks[0].pos > 200) marks.unshift({ pos: 0, title: 'Summary' })
    marks.forEach((mk, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].pos : clean.length
      const body = clean.slice(mk.pos, end).trim()
      if (body.length > 40) pieces.push({ n: 0, title: mk.title, text: body })
    })
  } else {
    pieces = [{ n: 0, title: 'Impact assessment', text: clean }]
  }

  // Stage 2: enforce the size ceiling without discarding the heading.
  const out: IaSection[] = []
  for (const p of pieces) {
    if (p.text.length <= maxChars) { out.push(p); continue }
    const paras = p.text.split(/\n\s*\n/)
    let buf = '', part = 1
    const flush = () => {
      if (!buf.trim()) return
      out.push({ n: 0, title: `${p.title} (part ${part++})`, text: buf.trim() })
      buf = ''
    }
    for (const para of paras) {
      if (buf.length + para.length + 2 > maxChars) flush()
      // A single paragraph over the ceiling is hard-split rather than dropped.
      if (para.length > maxChars) {
        for (let i = 0; i < para.length; i += maxChars) {
          buf = para.slice(i, i + maxChars); flush()
        }
      } else buf += (buf ? '\n\n' : '') + para
    }
    flush()
  }
  return out.map((s, i) => ({ ...s, n: i + 1 }))
}

// ── gov.uk routes (secondary, and RPC) ───────────────────────────────────────
export interface GovukDoc { link: string; title: string; documentType: string | null; date: string | null; organisations: string[] }

export async function govukSearchAll(params: string, pageSize = 200, cap = 20_000): Promise<GovukDoc[]> {
  const out: GovukDoc[] = []
  for (let start = 0; start < cap; start += pageSize) {
    const url = `${SEARCH}?${params}&count=${pageSize}&start=${start}&order=public_timestamp` +
      `&fields=link,title,content_store_document_type,public_timestamp,organisations`
    const raw = await getText(url, 'application/json')
    if (!raw) break
    let data: any
    try { data = JSON.parse(raw) } catch { break }
    const results: any[] = data?.results ?? []
    if (!results.length) break
    for (const r of results) {
      out.push({
        link: r.link,
        title: r.title ?? '',
        documentType: r.content_store_document_type ?? null,
        date: r.public_timestamp ? String(r.public_timestamp).slice(0, 10) : null,
        organisations: (r.organisations ?? []).map((o: any) => o.slug ?? o.title ?? String(o)),
      })
    }
    if (results.length < pageSize) break
    await new Promise(r => setTimeout(r, 300))
  }
  return out
}

export const GOVUK_IA_PARAMS = 'filter_content_store_document_type=impact_assessment'
export const GOVUK_RPC_PARAMS = 'filter_organisations=regulatory-policy-committee'
