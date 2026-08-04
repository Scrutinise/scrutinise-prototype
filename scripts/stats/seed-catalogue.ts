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
  console.log(`Seeded ${datasets.length} Phase A StatDataset rows (all ${LICENCE}).`)

  // ---- Phase B — comparative / international ------------------------------
  // Unlike Phase A (uniformly OGL v3.0), each Phase B source carries its OWN licence and its
  // own commercial-use position, so these are seeded with explicit per-dataset values rather
  // than the shared LICENCE constant.
  const phaseB = [
    {
      id: 'wb-wdi-comparative',
      source: 'WORLD_BANK' as const,
      title: 'World Bank — World Development Indicators (curated comparative set)',
      description:
        'Fiscal aggregates (GDP, government expenditure/tax/debt % GDP) plus outcome indicators '
        + '(life expectancy, health and education spend, infant mortality, Gini) across a curated '
        + 'comparator country set. The outcome half is what makes "did their approach work" answerable.',
      cofogRelevant: false,
      licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      licenceUrl: 'https://data.worldbank.org/summary-terms-of-use',
      commercialUseExcluded: false, // CC BY 4.0 — verified at source 2026-08-03
      refreshCadence: 'ANNUAL' as const,
      sourceUrl: 'https://data.worldbank.org/',
    },
    {
      id: 'oecd-cofog-expenditure',
      source: 'OECD' as const,
      title: 'OECD — government expenditure by COFOG function (Government at a Glance, yearly updates)',
      description:
        'General government expenditure disaggregated by COFOG function for OECD members and partners, '
        + 'including OECD\'s own published aggregates (OECD, OECD average country, EU-in-OECD). This is '
        + 'the direct comparative counterpart to the UK PESA data on the same cofogFunctionCode axis.',
      cofogRelevant: true,
      // VERIFIED AT SOURCE 2026-08-03, oecd.org/en/about/terms-conditions.html §3 "Data":
      // "you can extract from, download, copy, adapt, print, distribute, share and embed Data
      //  for any purpose, even for commercial use" (attribution required).
      licence: 'OECD Terms & Conditions §3 (Data) — reuse for any purpose incl. commercial, attribution required',
      licenceUrl: 'https://www.oecd.org/en/about/terms-conditions.html',
      // NOTE: the sprint brief instructed commercialUseExcluded=true on the premise that OECD
      // content is CC-BY-NC pre-2024. Verification at source contradicts that premise (the
      // CC-BY-NC question concerns OECD *written content*, not Data; and even the pre-July-2024
      // written-content clause permits "commercial and non-commercial" use). Set to the verified
      // position; flip this one boolean if Charlie prefers the conservative reading.
      commercialUseExcluded: false,
      refreshCadence: 'ANNUAL' as const,
      sourceUrl: 'https://www.oecd.org/en/data/datasets/government-at-a-glance.html',
    },
    {
      id: 'imf-gfs-cofog',
      source: 'IMF' as const,
      title: 'IMF — Government Finance Statistics: government expenditure by COFOG function',
      description:
        'General government (S13) expenditure by COFOG function, as percent of GDP and percent of total '
        + 'outlays, across the same comparator country set as the World Bank layer. Lands on the same '
        + 'cofogFunctionCode axis as UK PESA and OECD, so the three are directly stackable. Domestic-currency '
        + 'rows are deliberately excluded — 22 countries in 22 currencies cannot be compared without an '
        + 'exchange-rate step this layer does not perform.',
      cofogRelevant: true,
      // VERIFIED AT SOURCE (in a browser — the page 403s every programmatic fetch) 2026-08-04:
      // imf.org/en/about/copyright-and-terms, "The Use of IMF Data", effective 11 Oct 2024.
      // GFS is named explicitly. Publication and redistribution permitted with attribution;
      // "For any potential commercial reuse of IMF Data, please email copyright@imf.org to
      // request permission." Full quotes and the 3 Aug misreading: sources/imf.ts header.
      licence: 'IMF Copyright and Usage — "The Use of IMF Data": reuse/redistribution permitted with attribution; COMMERCIAL reuse requires written permission',
      licenceUrl: 'https://www.imf.org/en/about/copyright-and-terms',
      // The first genuinely non-commercial source in the store. This is not a cautious guess —
      // the terms say commercial reuse needs permission we do not hold.
      commercialUseExcluded: true,
      refreshCadence: 'ANNUAL' as const,
      sourceUrl: 'https://data.imf.org/en/datasets/IMF.STA:GFS_COFOG',
    },
  ]

  for (const d of phaseB) {
    await prisma.statDataset.upsert({
      where: { id: d.id },
      create: { ...d, licenceVerifiedAt: now() },
      update: { ...d, licenceVerifiedAt: now() },
    })
  }
  console.log(`Seeded ${phaseB.length} Phase B StatDataset rows (per-dataset licences).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
