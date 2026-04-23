import 'dotenv/config'
import { prisma } from '../../scrutinise-web/lib/prisma'
import { LegislationTier, LegislationType, CompilationStatus } from '@prisma/client'

// Tier 1 Acts — post-2010 UK Public General Acts
// legislation.gov.uk OData feed for ukpga
const TIER_1_FEED = 'https://www.legislation.gov.uk/ukpga/2010-2025/data.feed?results-count=100'

async function fetchActList(feedUrl: string): Promise<Array<{
  title: string, year: number, number: number, id: string, clmlUrl: string
}>> {
  const res = await fetch(feedUrl)
  const xml = await res.text()
  // Parse Atom feed XML
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  return entries.map(([, entry]) => {
    const title = entry.match(/<title[^>]*>(.*?)<\/title>/)?.[1] ?? ''
    const id = entry.match(/<ukm:DocumentMainType\s+Value="([^"]+)"/)?.[1] ?? ''
    const year = parseInt(entry.match(/<ukm:Year\s+Value="(\d+)"/)?.[1] ?? '0')
    const number = parseInt(entry.match(/<ukm:Number\s+Value="(\d+)"/)?.[1] ?? '0')
    const clmlUrl = entry.match(/<link[^>]*type="application\/xml"[^>]*href="([^"]+)"/)?.[1] ?? ''
    return { title, year, number, id, clmlUrl }
  }).filter(a => a.year > 0 && a.number > 0)
}

// Extract jurisdiction, subjectArea, and policyArea from CLML XML metadata
function extractClmlMetadata(xml: string): {
  jurisdiction: string
  subjectArea: string | null
  policyArea: string | null
} {
  // <dc:coverage> or <ukm:DocumentMainType> indicate jurisdiction
  const coverage = xml.match(/<dc:coverage[^>]*>(.*?)<\/dc:coverage>/)?.[1] ?? ''
  let jurisdiction = 'UK'
  if (/scotland/i.test(coverage)) jurisdiction = 'Scotland'
  else if (/wales/i.test(coverage)) jurisdiction = 'Wales'
  else if (/northern ireland/i.test(coverage)) jurisdiction = 'NI'
  else if (/england/i.test(coverage)) jurisdiction = 'England'

  // <ukm:Subject> elements carry subject classification
  const subjectMatch = xml.match(/<ukm:Subject\s+Value="([^"]+)"/)
  const subjectArea = subjectMatch?.[1] ?? null

  // <dc:subject> may carry policy area
  const policyMatch = xml.match(/<dc:subject[^>]*>(.*?)<\/dc:subject>/)
  const policyArea = policyMatch?.[1] ?? null

  return { jurisdiction, subjectArea, policyArea }
}

// Parse sections from already-fetched CLML XML string
function fetchSectionsFromXml(xml: string): Array<{
  sectionNumber: string, sectionTitle: string, originalText: string
}> {
  // Parse CLML P1group elements (top-level sections)
  const sections = []
  const p1groups = [...xml.matchAll(/<P1group>([\s\S]*?)<\/P1group>/g)]
  for (const [, group] of p1groups) {
    const num = group.match(/<Pnumber[^>]*>(.*?)<\/Pnumber>/)?.[1]?.trim() ?? ''
    const title = group.match(/<Title[^>]*>(.*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, '') ?? ''
    const text = group.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (num) sections.push({ sectionNumber: num, sectionTitle: title, originalText: text })
  }
  return sections
}

// Strip HTML tags from fetched HTML page
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Clean TNA compiled text: strip preamble and amendment footnotes
// Handles both single-line and multi-line text
function cleanTnaCompiledText(raw: string, sectionNumber: string): string {
  const lines = raw.split('\n')

  if (lines.length > 2) {
    // Multi-line path: find start of operative section
    let startIdx = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (/^\d+[A-Z]?\s+[A-Z]/.test(line) ||
          /^Part\s+\d/i.test(line) ||
          /^Chapter\s+\d/i.test(line) ||
          /^\*\*\d/.test(line)) {
        startIdx = i
        break
      }
    }

    // Strip amendment footnotes from tail
    let endIdx = lines.length
    for (let i = lines.length - 1; i >= startIdx; i--) {
      const line = lines[i].trim()
      if (/^Words in s\./i.test(line) ||
          /^S\.\s+\d/i.test(line) ||
          /^Substituted/i.test(line) ||
          /^Inserted/i.test(line) ||
          /^Omitted/i.test(line) ||
          /^Repealed/i.test(line) ||
          /^Modified/i.test(line)) {
        endIdx = i
      } else if (endIdx < lines.length) {
        break
      }
    }

    return lines.slice(startIdx, endIdx).join('\n').trim()
  }

  // Single-line path: look for section heading followed by a subsection marker
  const subsectionMatch = raw.match(/(\d+[A-Z]?\s+[A-Z][a-z][^\n]{0,60}\n?\s*\(\d+\))/)
  if (subsectionMatch && subsectionMatch.index !== undefined) {
    const sliced = raw.slice(subsectionMatch.index).trim()
    return sliced.replace(/\s*(Words in s\.|S\.\s+\d|Substituted by|Inserted by|Omitted by|Repealed by|Modified by).*/i, '').trim()
  }

  // Fallback: find last occurrence of the section number in the text
  const escapedNum = sectionNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const secNumRegex = new RegExp(`(${escapedNum}\\s+[A-Z][a-z])`)
  const matches = [...raw.matchAll(new RegExp(secNumRegex, 'g'))]
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1]
    if (lastMatch.index !== undefined) {
      const sliced = raw.slice(lastMatch.index).trim()
      return sliced.replace(/\s*(Words in s\.|S\.\s+\d|Substituted by|Inserted by|Omitted by|Repealed by|Modified by).*/i, '').trim()
    }
  }

  // Ultimate fallback: return stripped text as-is
  return raw.replace(/\s*(Words in s\.|S\.\s+\d|Substituted by|Inserted by|Omitted by|Repealed by|Modified by).*/i, '').trim()
}

// Fetch TNA compiled HTML for a single section and return cleaned text (or null on 404)
async function fetchTnaCompiledText(
  legislationGovUkId: string,
  sectionNumber: string
): Promise<string | null> {
  const url = `https://www.legislation.gov.uk/${legislationGovUkId}/section/${sectionNumber}`
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/html' },
    })
    if (res.status === 404) {
      console.warn(`    ⚠ s.${sectionNumber} — 404 (not yet compiled by TNA)`)
      return null
    }
    if (!res.ok) {
      console.warn(`    ⚠ s.${sectionNumber} — HTTP ${res.status}`)
      return null
    }
    const html = await res.text()
    const plainText = stripHtml(html)
    return cleanTnaCompiledText(plainText, sectionNumber)
  } catch (err) {
    console.warn(`    ⚠ s.${sectionNumber} — fetch error: ${err}`)
    return null
  }
}

async function ingestAct(act: { title: string, year: number, number: number, id: string, clmlUrl: string }) {
  console.log(`Ingesting: ${act.title} (${act.year})...`)

  // Fetch CLML XML once — used for both section extraction and metadata
  const clmlRes = await fetch(act.clmlUrl)
  const clmlXml = await clmlRes.text()

  // Extract jurisdiction and subject classification from CLML metadata
  const { jurisdiction, subjectArea, policyArea } = extractClmlMetadata(clmlXml)

  const legislationGovUkId = `ukpga/${act.year}/${act.number}`

  // Upsert the LegislationItem
  const item = await prisma.legislationItem.upsert({
    where: { legislationGovUkId },
    create: {
      legislationType: LegislationType.UKPGA,
      tier: LegislationTier.TIER_1,
      title: act.title,
      year: act.year,
      number: act.number,
      jurisdiction,
      subjectArea,
      policyArea,
      legislationGovUkId,
      clmlUrl: act.clmlUrl,
      compilationStatus: CompilationStatus.PENDING,
    },
    update: { clmlUrl: act.clmlUrl, jurisdiction, subjectArea, policyArea },
  })

  // Parse sections from already-fetched CLML XML
  const sections = fetchSectionsFromXml(clmlXml)
  for (const s of sections) {
    await prisma.legislationSection.upsert({
      where: {
        legislationItemId_sectionNumber: {
          legislationItemId: item.id,
          sectionNumber: s.sectionNumber,
        },
      },
      create: {
        legislationItemId: item.id,
        sectionNumber: s.sectionNumber,
        sectionTitle: s.sectionTitle,
        originalText: s.originalText,
        compilationStatus: CompilationStatus.PENDING,
      },
      update: { originalText: s.originalText, sectionTitle: s.sectionTitle },
    })

    // Fetch TNA compiled text for this section (1s delay per section to avoid blocking)
    await new Promise(r => setTimeout(r, 1000))
    const tnaCompiledText = await fetchTnaCompiledText(legislationGovUkId, s.sectionNumber)
    if (tnaCompiledText) {
      await prisma.legislationSection.update({
        where: {
          legislationItemId_sectionNumber: {
            legislationItemId: item.id,
            sectionNumber: s.sectionNumber,
          },
        },
        data: { tnaCompiledText },
      })
      console.log(`    ✓ s.${s.sectionNumber} — TNA compiled text stored`)
    }
  }

  await prisma.legislationItem.update({
    where: { id: item.id },
    data: { sectionCount: sections.length },
  })

  console.log(`  ✓ ${sections.length} sections loaded`)
}

async function main() {
  console.log('Fetching Tier 1 Act list...')
  const acts = await fetchActList(TIER_1_FEED)
  console.log(`Found ${acts.length} Acts`)

  for (const act of acts) { // Start with first 10 for testing
    await ingestAct(act)
    await new Promise(r => setTimeout(r, 500)) // Rate limit
  }

  console.log('Ingestion complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
