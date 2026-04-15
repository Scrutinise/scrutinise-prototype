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

async function fetchSections(clmlUrl: string): Promise<Array<{
  sectionNumber: string, sectionTitle: string, originalText: string
}>> {
  const res = await fetch(clmlUrl)
  const xml = await res.text()
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

async function ingestAct(act: { title: string, year: number, number: number, id: string, clmlUrl: string }) {
  console.log(`Ingesting: ${act.title} (${act.year})...`)

  // Upsert the LegislationItem
  const item = await prisma.legislationItem.upsert({
    where: { legislationGovUkId: `ukpga/${act.year}/${act.number}` },
    create: {
      legislationType: LegislationType.UKPGA,
      tier: LegislationTier.TIER_1,
      title: act.title,
      year: act.year,
      number: act.number,
      jurisdiction: 'UK',
      legislationGovUkId: `ukpga/${act.year}/${act.number}`,
      clmlUrl: act.clmlUrl,
      compilationStatus: CompilationStatus.PENDING,
    },
    update: { clmlUrl: act.clmlUrl },
  })

  // Fetch and upsert sections using the composite unique key
  const sections = await fetchSections(act.clmlUrl)
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

  for (const act of acts.slice(0, 10)) { // Start with first 10 for testing
    await ingestAct(act)
    await new Promise(r => setTimeout(r, 500)) // Rate limit
  }

  console.log('Ingestion complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
