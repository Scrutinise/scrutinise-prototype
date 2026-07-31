// One-time (idempotent) catalogue seed: StatCofogFunction reference rows + the
// StatDataset row for each Phase A source. Run once after the DB is provisioned
// and migrated, before the first refresh-scheduler run.
// Usage: npx tsx --tsconfig ../tsconfig.json seed-catalogue.ts   (from scripts/stats/)
import { getStatsPrisma } from './lib/db'
import { COFOG_TOP_LEVEL } from './lib/cofog'

const LICENCE = 'Open Government Licence v3.0'
const now = () => new Date()

async function main() {
  const prisma = getStatsPrisma()

  for (const c of COFOG_TOP_LEVEL) {
    await prisma.statCofogFunction.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, parent: c.parent },
    })
  }
  console.log(`Seeded ${COFOG_TOP_LEVEL.length} top-level COFOG codes.`)

  const datasets = [
    {
      id: 'ons-cdid-headline',
      source: 'ONS' as const,
      title: 'ONS headline economic series (CDID)',
      description: 'GDP, unemployment, CPIH, average earnings — the headline macro series not carried by the Beta API.',
      cofogRelevant: false,
      licenceUrl: 'https://www.ons.gov.uk/help/termsandconditions',
      refreshCadence: 'MONTHLY' as const,
      sourceUrl: 'https://www.ons.gov.uk/economy',
    },
    {
      id: 'ons-beta-wellbeing-quarterly',
      source: 'ONS' as const,
      title: 'ONS quarterly personal well-being estimates',
      description: 'Beta API Route A pilot dataset — life satisfaction, worthwhile, happiness, anxiety.',
      cofogRelevant: false,
      licenceUrl: 'https://www.ons.gov.uk/help/termsandconditions',
      refreshCadence: 'QUARTERLY' as const,
      sourceUrl: 'https://api.beta.ons.gov.uk/v1/datasets/wellbeing-quarterly',
    },
    {
      id: 'obr-psf-databank',
      source: 'OBR' as const,
      title: 'OBR Public Finances Databank',
      description: 'Main tax/spending lines + fiscal aggregates, outturn + forecast, back to 1900.',
      cofogRelevant: false,
      licenceUrl: 'https://obr.uk/data/',
      refreshCadence: 'BIANNUAL' as const,
      sourceUrl: 'https://obr.uk/data/',
    },
    {
      id: 'obr-historical-forecasts',
      source: 'OBR' as const,
      title: 'OBR Historical Official Forecasts Database',
      description: 'Every forecast round since 1970 (incl. pre-OBR Treasury) for the main economic/fiscal aggregates — successive forecast vintages preserved.',
      cofogRelevant: false,
      licenceUrl: 'https://obr.uk/data/',
      refreshCadence: 'BIANNUAL' as const,
      sourceUrl: 'https://obr.uk/data/',
    },
    {
      id: 'pesa-ch5-function',
      source: 'HMT_PESA' as const,
      title: 'PESA Chapter 5 — public expenditure by function',
      description: 'Table 5.2 (COFOG sub-function time series) + Table 5.1 (departmental group x top-level function, latest year).',
      cofogRelevant: true,
      licenceUrl: 'https://www.gov.uk/government/statistics/public-expenditure-statistical-analyses-2025',
      refreshCadence: 'ANNUAL' as const,
      sourceUrl: 'https://www.gov.uk/government/collections/public-expenditure-statistical-analyses-pesa',
    },
    {
      id: 'hmrc-receipts',
      source: 'HMRC' as const,
      title: 'HMRC tax receipts and National Insurance contributions for the UK',
      description: 'Annual receipts by tax line, 2006-07 onwards.',
      cofogRelevant: false,
      licenceUrl: 'https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk',
      refreshCadence: 'MONTHLY' as const,
      sourceUrl: 'https://www.gov.uk/government/statistics/hmrc-tax-and-nics-receipts-for-the-uk',
    },
    {
      id: 'hmrc-tax-gap',
      source: 'HMRC' as const,
      title: 'HMRC measuring tax gaps — percentage tax gap by tax type',
      description: 'Table 1.1: percentage tax gap by tax/type/component, 2005-06 onwards.',
      cofogRelevant: false,
      licenceUrl: 'https://www.gov.uk/government/statistics/measuring-tax-gaps-tables',
      refreshCadence: 'ANNUAL' as const,
      sourceUrl: 'https://www.gov.uk/government/statistics/measuring-tax-gaps-tables',
    },
  ]

  for (const d of datasets) {
    await prisma.statDataset.upsert({
      where: { id: d.id },
      create: { ...d, licence: LICENCE, licenceVerifiedAt: now() },
      update: { ...d, licence: LICENCE, licenceVerifiedAt: now() },
    })
  }
  console.log(`Seeded ${datasets.length} StatDataset rows.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
