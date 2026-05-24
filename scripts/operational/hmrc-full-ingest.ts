/**
 * HMRC Internal Manuals — Full Operational Corpus Ingest
 * Sprint V.3-C (Tax Corpus Sprint)
 *
 * Fetches ALL 153 HMRC manuals from gov.uk, stores HTML + extracted text in R2,
 * and writes index rows to Railway (OperationalDocument / OperationalSection).
 *
 * Page discovery uses BFS: starting from each manual's index page, all linked
 * pages within the manual's URL namespace are followed recursively.  This is
 * required because HMRC manuals have 3+ levels of nesting (manual index →
 * chapter contents → sub-chapter contents → leaf pages).
 *
 * Rate-limiting : 1 req / 2 s; exponential backoff on 429/503 (30 s → 10 min).
 * Checkpoint    : scripts/operational/hmrc-full-checkpoint.json
 * Audit log     : scripts/operational/hmrc-full-log.csv
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/operational/hmrc-full-ingest.ts
 *   # Single manual:
 *   npx ts-node --project scripts/tsconfig.json scripts/operational/hmrc-full-ingest.ts --manual=pensions-tax-manual
 *   # Start from (skip manuals before this slug):
 *   npx ts-node --project scripts/tsconfig.json scripts/operational/hmrc-full-ingest.ts --from=company-taxation-manual
 *
 * CC-A coordination: if the v3opt UKSI full ingest is running, stagger this
 * run by 30 minutes to distribute Railway connection pool pressure.
 * This script uses max 3 DB connections; v3opt uses 4 workers × 1 connection.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { DocumentSourceType, OperationalIngestStatus } from '@prisma/client'
import { r2Put } from '../legislation/r2-client'

// ─────────────────────────────────────────────────────────────────────────────
// DB pool (pg directly — avoids Driver Adapter SSL config issues in scripts)
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require(path.join(__dirname, '../../scrutinise-web/node_modules/pg'))
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const USER_AGENT    = 'Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)'
const MIN_DELAY_MS  = 2000          // 1 req / 2 s
const BACKOFF_INIT  = 30_000        // 30 s first backoff
const BACKOFF_MAX   = 600_000       // 10 min cap
const FETCH_TIMEOUT = 30_000        // per-request timeout
const CHECKPOINT_SAVE_INTERVAL = 20 // save checkpoint every N pages ingested
const GOV_UK_BASE   = 'https://www.gov.uk'

const LOG_FILE        = path.join(__dirname, 'hmrc-full-log.csv')
const CHECKPOINT_FILE = path.join(__dirname, 'hmrc-full-checkpoint.json')

// ─────────────────────────────────────────────────────────────────────────────
// Manual definitions — ALL 153 active manuals from gov.uk/government/collections/hmrc-manuals
// Ordered: core tax first (highest Scrutinise policy relevance), then procedural,
// then compliance/enforcement, then excise/customs.
// ─────────────────────────────────────────────────────────────────────────────

interface ManualDef {
  slug: string        // DB sourceSlug (= govUkSlug for HMRC)
  title: string
  description: string
  govUkSlug: string   // slug used in gov.uk URL: /hmrc-internal-manuals/{govUkSlug}
  r2Prefix: string
}

const MANUALS: ManualDef[] = [
  // ── Core income / capital / corporate tax ─────────────────────────────────
  {
    slug: 'employment-income-manual',
    title: 'Employment Income Manual',
    description: 'HMRC guidance on employment income, benefits in kind, and PAYE.',
    govUkSlug: 'employment-income-manual',
    r2Prefix: 'operational/hmrc/employment-income-manual',
  },
  {
    slug: 'capital-gains-manual',
    title: 'Capital Gains Manual',
    description: 'HMRC guidance on capital gains tax, including reliefs and exemptions.',
    govUkSlug: 'capital-gains-manual',
    r2Prefix: 'operational/hmrc/capital-gains-manual',
  },
  {
    slug: 'company-taxation-manual',
    title: 'Company Taxation Manual',
    description: 'HMRC guidance on corporation tax for companies.',
    govUkSlug: 'company-taxation-manual',
    r2Prefix: 'operational/hmrc/company-taxation-manual',
  },
  {
    slug: 'business-income-manual',
    title: 'Business Income Manual',
    description: 'HMRC guidance on calculating trading profits and losses.',
    govUkSlug: 'business-income-manual',
    r2Prefix: 'operational/hmrc/business-income-manual',
  },
  {
    slug: 'pensions-tax-manual',
    title: 'Pensions Tax Manual',
    description: 'HMRC guidance on pension tax rules, limits, and reliefs.',
    govUkSlug: 'pensions-tax-manual',
    r2Prefix: 'operational/hmrc/pensions-tax-manual',
  },
  {
    slug: 'inheritance-tax-manual',
    title: 'Inheritance Tax Manual',
    description: 'HMRC guidance on inheritance tax, exemptions, and reliefs.',
    govUkSlug: 'inheritance-tax-manual',
    r2Prefix: 'operational/hmrc/inheritance-tax-manual',
  },
  {
    slug: 'savings-and-investment-manual',
    title: 'Savings and Investment Manual',
    description: 'HMRC guidance on tax treatment of savings and investments.',
    govUkSlug: 'savings-and-investment-manual',
    r2Prefix: 'operational/hmrc/savings-and-investment-manual',
  },
  {
    slug: 'national-insurance-manual',
    title: 'National Insurance Manual',
    description: 'HMRC guidance on national insurance contributions.',
    govUkSlug: 'national-insurance-manual',
    r2Prefix: 'operational/hmrc/national-insurance-manual',
  },
  {
    slug: 'property-income-manual',
    title: 'Property Income Manual',
    description: 'HMRC guidance on rental income, property businesses, and letting.',
    govUkSlug: 'property-income-manual',
    r2Prefix: 'operational/hmrc/property-income-manual',
  },
  {
    slug: 'corporate-finance-manual',
    title: 'Corporate Finance Manual',
    description: 'HMRC guidance on loan relationships, derivatives, and corporate finance.',
    govUkSlug: 'corporate-finance-manual',
    r2Prefix: 'operational/hmrc/corporate-finance-manual',
  },
  {
    slug: 'corporate-intangibles-research-and-development-manual',
    title: 'Corporate Intangibles Research and Development Manual',
    description: 'HMRC guidance on intangible assets, R&D credits, and IP tax.',
    govUkSlug: 'corporate-intangibles-research-and-development-manual',
    r2Prefix: 'operational/hmrc/corporate-intangibles-research-and-development-manual',
  },
  {
    slug: 'double-taxation-relief',
    title: 'Double Taxation Relief Manual',
    description: 'HMRC guidance on double taxation treaties and relief.',
    govUkSlug: 'double-taxation-relief',
    r2Prefix: 'operational/hmrc/double-taxation-relief',
  },
  {
    slug: 'international-manual',
    title: 'International Manual',
    description: 'HMRC guidance on international tax, transfer pricing, and controlled foreign companies.',
    govUkSlug: 'international-manual',
    r2Prefix: 'operational/hmrc/international-manual',
  },
  {
    slug: 'trusts-settlements-and-estates-manual',
    title: 'Trusts, Settlements and Estates Manual',
    description: 'HMRC guidance on tax treatment of trusts, settlements, and estates.',
    govUkSlug: 'trusts-settlements-and-estates-manual',
    r2Prefix: 'operational/hmrc/trusts-settlements-and-estates-manual',
  },
  {
    slug: 'partnership-manual',
    title: 'Partnership Manual',
    description: 'HMRC guidance on taxation of partnerships.',
    govUkSlug: 'partnership-manual',
    r2Prefix: 'operational/hmrc/partnership-manual',
  },
  {
    slug: 'venture-capital-schemes-manual',
    title: 'Venture Capital Schemes Manual',
    description: 'HMRC guidance on EIS, SEIS, VCT, and other venture capital reliefs.',
    govUkSlug: 'venture-capital-schemes-manual',
    r2Prefix: 'operational/hmrc/venture-capital-schemes-manual',
  },
  {
    slug: 'community-investment-tax-relief-manual',
    title: 'Community Investment Tax Relief Manual',
    description: 'HMRC guidance on CITR scheme.',
    govUkSlug: 'community-investment-tax-relief-manual',
    r2Prefix: 'operational/hmrc/community-investment-tax-relief-manual',
  },
  {
    slug: 'capital-allowances-manual',
    title: 'Capital Allowances Manual',
    description: 'HMRC guidance on capital allowances for plant, machinery, and buildings.',
    govUkSlug: 'capital-allowances-manual',
    r2Prefix: 'operational/hmrc/capital-allowances-manual',
  },
  {
    slug: 'business-leasing-manual',
    title: 'Business Leasing Manual',
    description: 'HMRC guidance on tax treatment of finance and operating leases.',
    govUkSlug: 'business-leasing-manual',
    r2Prefix: 'operational/hmrc/business-leasing-manual',
  },
  {
    slug: 'oil-taxation-manual',
    title: 'Oil Taxation Manual',
    description: 'HMRC guidance on ring fence corporation tax and PRT for oil and gas.',
    govUkSlug: 'oil-taxation-manual',
    r2Prefix: 'operational/hmrc/oil-taxation-manual',
  },
  {
    slug: 'banking-manual',
    title: 'Banking Manual',
    description: 'HMRC guidance on taxation of banks and financial institutions.',
    govUkSlug: 'banking-manual',
    r2Prefix: 'operational/hmrc/banking-manual',
  },
  {
    slug: 'bank-levy-manual',
    title: 'Bank Levy Manual',
    description: 'HMRC guidance on the bank levy.',
    govUkSlug: 'bank-levy-manual',
    r2Prefix: 'operational/hmrc/bank-levy-manual',
  },
  {
    slug: 'general-insurance-manual',
    title: 'General Insurance Manual',
    description: 'HMRC guidance on taxation of general insurance businesses.',
    govUkSlug: 'general-insurance-manual',
    r2Prefix: 'operational/hmrc/general-insurance-manual',
  },
  {
    slug: 'life-assurance',
    title: 'Life Assurance Manual',
    description: 'HMRC guidance on taxation of life assurance companies.',
    govUkSlug: 'life-assurance',
    r2Prefix: 'operational/hmrc/life-assurance',
  },
  {
    slug: 'insurance-policyholder-taxation-manual',
    title: 'Insurance Policyholder Taxation Manual',
    description: 'HMRC guidance on tax treatment of insurance products for policyholders.',
    govUkSlug: 'insurance-policyholder-taxation-manual',
    r2Prefix: 'operational/hmrc/insurance-policyholder-taxation-manual',
  },
  {
    slug: 'investment-funds',
    title: 'Investment Funds Manual',
    description: 'HMRC guidance on taxation of investment funds.',
    govUkSlug: 'investment-funds',
    r2Prefix: 'operational/hmrc/investment-funds',
  },
  {
    slug: 'lloyds-manual',
    title: "Lloyd's Manual",
    description: "HMRC guidance on taxation of Lloyd's of London underwriters.",
    govUkSlug: 'lloyds-manual',
    r2Prefix: 'operational/hmrc/lloyds-manual',
  },
  {
    slug: 'tonnage-tax-manual',
    title: 'Tonnage Tax Manual',
    description: 'HMRC guidance on the shipping tonnage tax regime.',
    govUkSlug: 'tonnage-tax-manual',
    r2Prefix: 'operational/hmrc/tonnage-tax-manual',
  },
  {
    slug: 'digital-services-tax',
    title: 'Digital Services Tax Manual',
    description: 'HMRC guidance on the Digital Services Tax.',
    govUkSlug: 'digital-services-tax',
    r2Prefix: 'operational/hmrc/digital-services-tax',
  },
  {
    slug: 'electricity-generator-levy-manual',
    title: 'Electricity Generator Levy Manual',
    description: 'HMRC guidance on the Electricity Generator Levy.',
    govUkSlug: 'electricity-generator-levy-manual',
    r2Prefix: 'operational/hmrc/electricity-generator-levy-manual',
  },
  {
    slug: 'multinational-top-up-tax-and-domestic-top-up-tax',
    title: 'Multinational Top-up Tax and Domestic Top-up Tax Manual',
    description: 'HMRC guidance on Pillar 2 global minimum tax.',
    govUkSlug: 'multinational-top-up-tax-and-domestic-top-up-tax',
    r2Prefix: 'operational/hmrc/multinational-top-up-tax-and-domestic-top-up-tax',
  },
  {
    slug: 'cryptoassets-manual',
    title: 'Cryptoassets Manual',
    description: 'HMRC guidance on taxation of cryptoassets.',
    govUkSlug: 'cryptoassets-manual',
    r2Prefix: 'operational/hmrc/cryptoassets-manual',
  },
  {
    slug: 'residential-property-developer-tax-manual',
    title: 'Residential Property Developer Tax Manual',
    description: 'HMRC guidance on the Residential Property Developer Tax.',
    govUkSlug: 'residential-property-developer-tax-manual',
    r2Prefix: 'operational/hmrc/residential-property-developer-tax-manual',
  },
  {
    slug: 'uncertain-tax-treatments-by-large-businesses-manual',
    title: 'Uncertain Tax Treatments by Large Businesses Manual',
    description: 'HMRC guidance on notification of uncertain tax treatments.',
    govUkSlug: 'uncertain-tax-treatments-by-large-businesses-manual',
    r2Prefix: 'operational/hmrc/uncertain-tax-treatments-by-large-businesses-manual',
  },
  // ── Employment taxes & NIC ────────────────────────────────────────────────
  {
    slug: 'paye-manual',
    title: 'PAYE Manual',
    description: 'HMRC guidance on PAYE procedures and administration.',
    govUkSlug: 'paye-manual',
    r2Prefix: 'operational/hmrc/paye-manual',
  },
  {
    slug: 'paye-settlement-agreements',
    title: 'PAYE Settlements Agreements Manual',
    description: 'HMRC guidance on PAYE Settlement Agreements.',
    govUkSlug: 'paye-settlement-agreements',
    r2Prefix: 'operational/hmrc/paye-settlement-agreements',
  },
  {
    slug: 'employment-status-manual',
    title: 'Employment Status Manual',
    description: 'HMRC guidance on employment status and IR35.',
    govUkSlug: 'employment-status-manual',
    r2Prefix: 'operational/hmrc/employment-status-manual',
  },
  {
    slug: 'employment-related-securities',
    title: 'Employment Related Securities Manual',
    description: 'HMRC guidance on employment-related securities and share schemes.',
    govUkSlug: 'employment-related-securities',
    r2Prefix: 'operational/hmrc/employment-related-securities',
  },
  {
    slug: 'employee-tax-advantaged-share-scheme-user-manual',
    title: 'Employee Tax Advantaged Share Scheme User Manual',
    description: 'HMRC guidance on SAYE, SIP, CSOP, and EMI schemes.',
    govUkSlug: 'employee-tax-advantaged-share-scheme-user-manual',
    r2Prefix: 'operational/hmrc/employee-tax-advantaged-share-scheme-user-manual',
  },
  {
    slug: 'statutory-payments-manual',
    title: 'Statutory Payments Manual',
    description: 'HMRC guidance on SSP, SMP, SPP, and other statutory payments.',
    govUkSlug: 'statutory-payments-manual',
    r2Prefix: 'operational/hmrc/statutory-payments-manual',
  },
  {
    slug: 'national-minimum-wage-manual',
    title: 'National Minimum Wage Manual',
    description: 'HMRC guidance on National Minimum Wage compliance and enforcement.',
    govUkSlug: 'national-minimum-wage-manual',
    r2Prefix: 'operational/hmrc/national-minimum-wage-manual',
  },
  {
    slug: 'decision-and-appeals-for-national-insurance-contributions-and-statutory-payments',
    title: 'Decisions and Appeals for National Insurance and Statutory Payments',
    description: 'HMRC guidance on NIC and statutory payment decisions and appeals.',
    govUkSlug: 'decision-and-appeals-for-national-insurance-contributions-and-statutory-payments',
    r2Prefix: 'operational/hmrc/decision-and-appeals-for-nic-and-statutory-payments',
  },
  {
    slug: 'collection-of-student-loans-manual',
    title: 'Collection of Student Loans Manual',
    description: 'HMRC guidance on collection of student loans through PAYE.',
    govUkSlug: 'collection-of-student-loans-manual',
    r2Prefix: 'operational/hmrc/collection-of-student-loans-manual',
  },
  {
    slug: 'apprenticeship-levy',
    title: 'Apprenticeship Levy Manual',
    description: 'HMRC guidance on the Apprenticeship Levy.',
    govUkSlug: 'apprenticeship-levy',
    r2Prefix: 'operational/hmrc/apprenticeship-levy',
  },
  // ── VAT & indirect tax ────────────────────────────────────────────────────
  {
    slug: 'insurance-premium-tax',
    title: 'Insurance Premium Tax Manual',
    description: 'HMRC guidance on Insurance Premium Tax.',
    govUkSlug: 'insurance-premium-tax',
    r2Prefix: 'operational/hmrc/insurance-premium-tax',
  },
  {
    slug: 'vat-reverse-charge-for-building-and-construction-services-manual',
    title: 'VAT Reverse Charge for Buildings and Construction Services Manual',
    description: 'HMRC guidance on VAT domestic reverse charge in construction.',
    govUkSlug: 'vat-reverse-charge-for-building-and-construction-services-manual',
    r2Prefix: 'operational/hmrc/vat-reverse-charge-building-construction',
  },
  {
    slug: 'vat-official-gifts-received-in-the-context-of-international-relations',
    title: 'VAT Official Gifts Manual',
    description: 'HMRC guidance on VAT for official gifts in international relations.',
    govUkSlug: 'vat-official-gifts-received-in-the-context-of-international-relations',
    r2Prefix: 'operational/hmrc/vat-official-gifts',
  },
  {
    slug: 'vat-visiting-force-relief',
    title: 'VAT Visiting Force Relief Manual',
    description: 'HMRC guidance on VAT relief for visiting forces.',
    govUkSlug: 'vat-visiting-force-relief',
    r2Prefix: 'operational/hmrc/vat-visiting-force-relief',
  },
  // ── Stamp duties ─────────────────────────────────────────────────────────
  {
    slug: 'stamp-duty-land-tax-manual',
    title: 'Stamp Duty Land Tax Manual',
    description: 'HMRC guidance on Stamp Duty Land Tax.',
    govUkSlug: 'stamp-duty-land-tax-manual',
    r2Prefix: 'operational/hmrc/stamp-duty-land-tax-manual',
  },
  {
    slug: 'stamp-taxes-shares-manual',
    title: 'Stamp Taxes on Shares Manual',
    description: 'HMRC guidance on Stamp Duty and Stamp Duty Reserve Tax on shares.',
    govUkSlug: 'stamp-taxes-shares-manual',
    r2Prefix: 'operational/hmrc/stamp-taxes-shares-manual',
  },
  // ── Self assessment & tax administration ─────────────────────────────────
  {
    slug: 'self-assessment-manual',
    title: 'Self Assessment Manual',
    description: 'HMRC guidance on Self Assessment returns and administration.',
    govUkSlug: 'self-assessment-manual',
    r2Prefix: 'operational/hmrc/self-assessment-manual',
  },
  {
    slug: 'self-assessment-claims-manual',
    title: 'Self Assessment Claims Manual',
    description: 'HMRC guidance on claims within Self Assessment.',
    govUkSlug: 'self-assessment-claims-manual',
    r2Prefix: 'operational/hmrc/self-assessment-claims-manual',
  },
  {
    slug: 'self-assessment-legal-framework',
    title: 'Self Assessment: the Legal Framework',
    description: 'HMRC guidance on the legal framework underpinning Self Assessment.',
    govUkSlug: 'self-assessment-legal-framework',
    r2Prefix: 'operational/hmrc/self-assessment-legal-framework',
  },
  {
    slug: 'cotax-manual',
    title: 'COTAX Manual',
    description: 'HMRC internal guidance on the Corporation Tax Online system.',
    govUkSlug: 'cotax-manual',
    r2Prefix: 'operational/hmrc/cotax-manual',
  },
  {
    slug: 'repayment-claims-manual',
    title: 'Repayment Claims Manual',
    description: 'HMRC guidance on repayment claims and overpayment relief.',
    govUkSlug: 'repayment-claims-manual',
    r2Prefix: 'operational/hmrc/repayment-claims-manual',
  },
  // ── Residence, domicile, international personal tax ──────────────────────
  {
    slug: 'residence-domicile-and-remittance-basis',
    title: 'Residence, Domicile and Remittance Basis Manual',
    description: 'HMRC guidance on UK residence, domicile, and the remittance basis.',
    govUkSlug: 'residence-domicile-and-remittance-basis',
    r2Prefix: 'operational/hmrc/residence-domicile-and-remittance-basis',
  },
  {
    slug: 'residence-and-fig-regime-manual',
    title: 'Residence and FIG Regime Manual',
    description: 'HMRC guidance on the Foreign Income and Gains regime.',
    govUkSlug: 'residence-and-fig-regime-manual',
    r2Prefix: 'operational/hmrc/residence-and-fig-regime-manual',
  },
  {
    slug: 'international-exchange-of-information',
    title: 'International Exchange of Information Manual',
    description: 'HMRC guidance on automatic exchange of information (CRS, FATCA).',
    govUkSlug: 'international-exchange-of-information',
    r2Prefix: 'operational/hmrc/international-exchange-of-information',
  },
  {
    slug: 'scottish-taxpayer-technical-guidance',
    title: 'Scottish Taxpayer Technical Guidance',
    description: 'HMRC guidance on Scottish rates of income tax.',
    govUkSlug: 'scottish-taxpayer-technical-guidance',
    r2Prefix: 'operational/hmrc/scottish-taxpayer-technical-guidance',
  },
  {
    slug: 'welsh-taxpayer-technical-guidance',
    title: 'Welsh Taxpayer Technical Guidance',
    description: 'HMRC guidance on Welsh rates of income tax.',
    govUkSlug: 'welsh-taxpayer-technical-guidance',
    r2Prefix: 'operational/hmrc/welsh-taxpayer-technical-guidance',
  },
  // ── Tax credits & benefits ────────────────────────────────────────────────
  {
    slug: 'tax-credits-technical-manual',
    title: 'Tax Credit Technical Manual',
    description: 'HMRC technical guidance on tax credits legislation and rules.',
    govUkSlug: 'tax-credits-technical-manual',
    r2Prefix: 'operational/hmrc/tax-credits-technical-manual',
  },
  {
    slug: 'tax-credits-manual',
    title: 'Tax Credits Manual',
    description: 'HMRC operational guidance on tax credits administration.',
    govUkSlug: 'tax-credits-manual',
    r2Prefix: 'operational/hmrc/tax-credits-manual',
  },
  {
    slug: 'child-benefit-technical-manual',
    title: 'Child Benefit Technical Manual',
    description: 'HMRC technical guidance on Child Benefit.',
    govUkSlug: 'child-benefit-technical-manual',
    r2Prefix: 'operational/hmrc/child-benefit-technical-manual',
  },
  {
    slug: 'tax-free-childcare-technical-manual',
    title: 'Tax-Free Childcare Technical Manual',
    description: 'HMRC technical guidance on Tax-Free Childcare.',
    govUkSlug: 'tax-free-childcare-technical-manual',
    r2Prefix: 'operational/hmrc/tax-free-childcare-technical-manual',
  },
  {
    slug: 'help-save-technical',
    title: 'Help to Save Technical Manual',
    description: 'HMRC technical guidance on the Help to Save scheme.',
    govUkSlug: 'help-save-technical',
    r2Prefix: 'operational/hmrc/help-save-technical',
  },
  // ── Creative industry reliefs ─────────────────────────────────────────────
  {
    slug: 'creative-industries-expenditure-credit-manual',
    title: 'Creative Industries Expenditure Credit Manual',
    description: 'HMRC guidance on AVEC and creative industry tax reliefs.',
    govUkSlug: 'creative-industries-expenditure-credit-manual',
    r2Prefix: 'operational/hmrc/creative-industries-expenditure-credit-manual',
  },
  {
    slug: 'film-production-company-manual',
    title: 'Film Production Company Manual',
    description: 'HMRC guidance on film production tax relief.',
    govUkSlug: 'film-production-company-manual',
    r2Prefix: 'operational/hmrc/film-production-company-manual',
  },
  {
    slug: 'television-production-company-manual',
    title: 'Television Production Company Manual',
    description: 'HMRC guidance on high-end TV and children\'s TV production tax relief.',
    govUkSlug: 'television-production-company-manual',
    r2Prefix: 'operational/hmrc/television-production-company-manual',
  },
  {
    slug: 'animation-production-company-manual',
    title: 'Animation Production Company Manual',
    description: 'HMRC guidance on animation tax relief.',
    govUkSlug: 'animation-production-company-manual',
    r2Prefix: 'operational/hmrc/animation-production-company-manual',
  },
  {
    slug: 'video-games-development-company-manual',
    title: 'Video Games Development Company Manual',
    description: 'HMRC guidance on video games development tax relief.',
    govUkSlug: 'video-games-development-company-manual',
    r2Prefix: 'operational/hmrc/video-games-development-company-manual',
  },
  {
    slug: 'theatre-tax-relief',
    title: 'Theatre Tax Relief Manual',
    description: 'HMRC guidance on theatre tax relief.',
    govUkSlug: 'theatre-tax-relief',
    r2Prefix: 'operational/hmrc/theatre-tax-relief',
  },
  {
    slug: 'orchestra-tax-relief',
    title: 'Orchestra Tax Relief Manual',
    description: 'HMRC guidance on orchestra tax relief.',
    govUkSlug: 'orchestra-tax-relief',
    r2Prefix: 'operational/hmrc/orchestra-tax-relief',
  },
  {
    slug: 'museums-and-galleries-exhibition-tax-relief',
    title: 'Museums and Galleries Exhibition Tax Relief Manual',
    description: 'HMRC guidance on museums and galleries exhibition tax relief.',
    govUkSlug: 'museums-and-galleries-exhibition-tax-relief',
    r2Prefix: 'operational/hmrc/museums-and-galleries-exhibition-tax-relief',
  },
  // ── Trusts & asset valuation ──────────────────────────────────────────────
  {
    slug: 'shares-and-assets-valuation-manual',
    title: 'Shares and Assets Valuation Manual',
    description: 'HMRC guidance on valuing unquoted shares and assets for tax.',
    govUkSlug: 'shares-and-assets-valuation-manual',
    r2Prefix: 'operational/hmrc/shares-and-assets-valuation-manual',
  },
  {
    slug: 'trust-registration-service-manual',
    title: 'Trust Registration Service Manual',
    description: 'HMRC guidance on the Trust Registration Service.',
    govUkSlug: 'trust-registration-service-manual',
    r2Prefix: 'operational/hmrc/trust-registration-service-manual',
  },
  {
    slug: 'bona-vacantia-manual',
    title: 'Bona Vacantia Guidance',
    description: 'HMRC guidance on Bona Vacantia (property passing to the Crown).',
    govUkSlug: 'bona-vacantia-manual',
    r2Prefix: 'operational/hmrc/bona-vacantia-manual',
  },
  {
    slug: 'securities-guidance',
    title: 'Securities Guidance Manual',
    description: 'HMRC guidance on securities transactions.',
    govUkSlug: 'securities-guidance',
    r2Prefix: 'operational/hmrc/securities-guidance',
  },
  // ── Compliance & enforcement ──────────────────────────────────────────────
  {
    slug: 'compliance-handbook',
    title: 'Compliance Handbook',
    description: 'HMRC internal guidance on compliance, enquiries, and enforcement.',
    govUkSlug: 'compliance-handbook',
    r2Prefix: 'operational/hmrc/compliance-handbook',
  },
  {
    slug: 'compliance-operational-guidance',
    title: 'Compliance Operational Guidance Manual',
    description: 'HMRC operational guidance for compliance caseworkers.',
    govUkSlug: 'compliance-operational-guidance',
    r2Prefix: 'operational/hmrc/compliance-operational-guidance',
  },
  {
    slug: 'enquiry-manual',
    title: 'Enquiry Manual',
    description: 'HMRC guidance on opening and conducting tax enquiries.',
    govUkSlug: 'enquiry-manual',
    r2Prefix: 'operational/hmrc/enquiry-manual',
  },
  {
    slug: 'fraud-civil-investigation',
    title: 'Fraud Civil Investigation Manual',
    description: 'HMRC guidance on civil fraud investigation procedures.',
    govUkSlug: 'fraud-civil-investigation',
    r2Prefix: 'operational/hmrc/fraud-civil-investigation',
  },
  {
    slug: 'avoidance-handling-process',
    title: 'Avoidance Handling Process',
    description: 'HMRC guidance on handling tax avoidance cases.',
    govUkSlug: 'avoidance-handling-process',
    r2Prefix: 'operational/hmrc/avoidance-handling-process',
  },
  {
    slug: 'litigation-and-settlement-strategy',
    title: 'Litigation and Settlement Strategy Manual',
    description: 'HMRC guidance on the Litigation and Settlement Strategy.',
    govUkSlug: 'litigation-and-settlement-strategy',
    r2Prefix: 'operational/hmrc/litigation-and-settlement-strategy',
  },
  {
    slug: 'tax-compliance-risk-management',
    title: 'Tax Compliance Risk Management Manual',
    description: 'HMRC guidance on compliance risk management for large businesses.',
    govUkSlug: 'tax-compliance-risk-management',
    r2Prefix: 'operational/hmrc/tax-compliance-risk-management',
  },
  {
    slug: 'specialist-investigations-operational-guidance',
    title: 'Specialist Investigations Operational Guidance',
    description: 'HMRC guidance for specialist investigators.',
    govUkSlug: 'specialist-investigations-operational-guidance',
    r2Prefix: 'operational/hmrc/specialist-investigations-operational-guidance',
  },
  {
    slug: 'senior-accounting-officers-guidance',
    title: 'Senior Accounting Officer Guidance Manual',
    description: 'HMRC guidance on SAO obligations for large companies.',
    govUkSlug: 'senior-accounting-officers-guidance',
    r2Prefix: 'operational/hmrc/senior-accounting-officers-guidance',
  },
  {
    slug: 'appeals-reviews-and-tribunals-guidance',
    title: 'Appeals, Reviews and Tribunals Manual',
    description: 'HMRC guidance on tax appeals, statutory reviews, and tribunal proceedings.',
    govUkSlug: 'appeals-reviews-and-tribunals-guidance',
    r2Prefix: 'operational/hmrc/appeals-reviews-and-tribunals-guidance',
  },
  {
    slug: 'alternative-dispute-resolution-guidance',
    title: 'Alternative Dispute Resolution Guidance Manual',
    description: 'HMRC guidance on ADR for tax disputes.',
    govUkSlug: 'alternative-dispute-resolution-guidance',
    r2Prefix: 'operational/hmrc/alternative-dispute-resolution-guidance',
  },
  {
    slug: 'admin-law-manual',
    title: 'Admin Law Manual',
    description: 'HMRC guidance on administrative law principles affecting HMRC decisions.',
    govUkSlug: 'admin-law-manual',
    r2Prefix: 'operational/hmrc/admin-law-manual',
  },
  {
    slug: 'other-non-statutory-clearance',
    title: 'Other Non-Statutory Clearance Guidance',
    description: 'HMRC guidance on non-statutory clearance applications.',
    govUkSlug: 'other-non-statutory-clearance',
    r2Prefix: 'operational/hmrc/other-non-statutory-clearance',
  },
  {
    slug: 'construction-industry-scheme-reform',
    title: 'Construction Industry Scheme Reform Manual',
    description: 'HMRC guidance on the Construction Industry Scheme.',
    govUkSlug: 'construction-industry-scheme-reform',
    r2Prefix: 'operational/hmrc/construction-industry-scheme-reform',
  },
  // ── Debt management ───────────────────────────────────────────────────────
  {
    slug: 'debt-management-and-banking',
    title: 'Debt Management and Banking Manual',
    description: 'HMRC guidance on debt collection and enforcement.',
    govUkSlug: 'debt-management-and-banking',
    r2Prefix: 'operational/hmrc/debt-management-and-banking',
  },
  // ── Information & disclosure ──────────────────────────────────────────────
  {
    slug: 'information-disclosure-guide',
    title: 'Information Disclosure Guidance Manual',
    description: 'HMRC guidance on disclosing taxpayer information.',
    govUkSlug: 'information-disclosure-guide',
    r2Prefix: 'operational/hmrc/information-disclosure-guide',
  },
  {
    slug: 'economic-crime-levy',
    title: 'Economic Crime Levy Manual',
    description: 'HMRC guidance on the Economic Crime Levy.',
    govUkSlug: 'economic-crime-levy',
    r2Prefix: 'operational/hmrc/economic-crime-levy',
  },
  {
    slug: 'economic-crime-supervision-handbook',
    title: 'Economic Crime Supervision Handbook Manual',
    description: 'HMRC guidance on anti-money laundering supervision.',
    govUkSlug: 'economic-crime-supervision-handbook',
    r2Prefix: 'operational/hmrc/economic-crime-supervision-handbook',
  },
  // ── Complaints ────────────────────────────────────────────────────────────
  {
    slug: 'complaints-handling-guidance',
    title: 'Complaint Handling Guidance Manual',
    description: 'HMRC guidance on handling customer complaints.',
    govUkSlug: 'complaints-handling-guidance',
    r2Prefix: 'operational/hmrc/complaints-handling-guidance',
  },
  {
    slug: 'complaints-and-remedy-guidance',
    title: 'Complaints and Remedy Guidance Manual',
    description: 'HMRC guidance on complaints and remedy payments.',
    govUkSlug: 'complaints-and-remedy-guidance',
    r2Prefix: 'operational/hmrc/complaints-and-remedy-guidance',
  },
  {
    slug: 'complaints-from-external-customers-about-the-conduct-of-hmrc-staff-guidance',
    title: 'Complaints from External Customers about HMRC Staff Conduct',
    description: 'HMRC guidance on complaints about staff conduct.',
    govUkSlug: 'complaints-from-external-customers-about-the-conduct-of-hmrc-staff-guidance',
    r2Prefix: 'operational/hmrc/complaints-hmrc-staff-conduct',
  },
  // ── Diplomatic / special reliefs ──────────────────────────────────────────
  {
    slug: 'diplomatic-privileges',
    title: 'Diplomatic Privileges Manual',
    description: 'HMRC guidance on tax reliefs for diplomats and international bodies.',
    govUkSlug: 'diplomatic-privileges',
    r2Prefix: 'operational/hmrc/diplomatic-privileges',
  },
  // ── Miscellaneous / operational ───────────────────────────────────────────
  {
    slug: 'labour-provider-operational-guidance',
    title: 'Labour Provider Manual',
    description: 'HMRC guidance on labour provider sector compliance.',
    govUkSlug: 'labour-provider-operational-guidance',
    r2Prefix: 'operational/hmrc/labour-provider-operational-guidance',
  },
  {
    slug: 'shared-workspace-business-manual',
    title: 'Shared Workspace Business Manual',
    description: 'HMRC guidance on the Shared Workspace service.',
    govUkSlug: 'shared-workspace-business-manual',
    r2Prefix: 'operational/hmrc/shared-workspace-business-manual',
  },
  {
    slug: 'technical-teams-operational-guidance',
    title: 'Technical Teams Operational Guidance Manual',
    description: 'HMRC internal guidance for technical teams.',
    govUkSlug: 'technical-teams-operational-guidance',
    r2Prefix: 'operational/hmrc/technical-teams-operational-guidance',
  },
  // ── Customs & excise ─────────────────────────────────────────────────────
  {
    slug: 'aggregates-levy',
    title: 'Aggregates Levy Guidance Manual',
    description: 'HMRC guidance on the Aggregates Levy.',
    govUkSlug: 'aggregates-levy',
    r2Prefix: 'operational/hmrc/aggregates-levy',
  },
  {
    slug: 'air-passenger-duty',
    title: 'Air Passenger Duty Manual',
    description: 'HMRC guidance on Air Passenger Duty.',
    govUkSlug: 'air-passenger-duty',
    r2Prefix: 'operational/hmrc/air-passenger-duty',
  },
  {
    slug: 'air-passenger-duty-risk',
    title: 'Air Passenger Duty Risk Based Control Manual',
    description: 'HMRC risk-based control guidance for Air Passenger Duty.',
    govUkSlug: 'air-passenger-duty-risk',
    r2Prefix: 'operational/hmrc/air-passenger-duty-risk',
  },
  {
    slug: 'alcoholic-ingredients-relief',
    title: 'Alcoholic Ingredients Relief Manual',
    description: 'HMRC guidance on relief for alcoholic ingredients.',
    govUkSlug: 'alcoholic-ingredients-relief',
    r2Prefix: 'operational/hmrc/alcoholic-ingredients-relief',
  },
  {
    slug: 'alcohol-wholesaler-registration-scheme',
    title: 'Alcohol Wholesaler Registration Scheme Manual',
    description: 'HMRC guidance on the AWRS.',
    govUkSlug: 'alcohol-wholesaler-registration-scheme',
    r2Prefix: 'operational/hmrc/alcohol-wholesaler-registration-scheme',
  },
  {
    slug: 'anti-dumping-and-countervailing-duties',
    title: 'Anti-dumping and Countervailing Duties Manual',
    description: 'HMRC guidance on anti-dumping and countervailing duties.',
    govUkSlug: 'anti-dumping-and-countervailing-duties',
    r2Prefix: 'operational/hmrc/anti-dumping-and-countervailing-duties',
  },
  {
    slug: 'ata-cpd-carnets',
    title: 'ATA and CPD Carnets Manual',
    description: 'HMRC guidance on ATA and CPD carnets for temporary import/export.',
    govUkSlug: 'ata-cpd-carnets',
    r2Prefix: 'operational/hmrc/ata-cpd-carnets',
  },
  {
    slug: 'beer-manual',
    title: 'Beer Guidance Manual',
    description: 'HMRC guidance on beer duty.',
    govUkSlug: 'beer-manual',
    r2Prefix: 'operational/hmrc/beer-manual',
  },
  {
    slug: 'biofuels-and-fuel-substitutes-assurance',
    title: 'Biofuels Assurance Manual',
    description: 'HMRC guidance on biofuels and fuel substitutes assurance.',
    govUkSlug: 'biofuels-and-fuel-substitutes-assurance',
    r2Prefix: 'operational/hmrc/biofuels-and-fuel-substitutes-assurance',
  },
  {
    slug: 'cider-guidance',
    title: 'Cider Manual',
    description: 'HMRC guidance on cider and perry duty.',
    govUkSlug: 'cider-guidance',
    r2Prefix: 'operational/hmrc/cider-guidance',
  },
  {
    slug: 'civil-evasion-penalties-for-customs-excise-and-vat',
    title: 'CEP — Civil Evasion Penalties Manual',
    description: 'HMRC guidance on civil evasion penalties for customs, excise, and VAT.',
    govUkSlug: 'civil-evasion-penalties-for-customs-excise-and-vat',
    r2Prefix: 'operational/hmrc/civil-evasion-penalties',
  },
  {
    slug: 'customs-cds-volume-3-tariff-step-by-step-guide',
    title: 'Customs CDS Volume 3 Tariff, Step-By-Step Guide',
    description: 'HMRC step-by-step guide for CDS tariff declarations.',
    govUkSlug: 'customs-cds-volume-3-tariff-step-by-step-guide',
    r2Prefix: 'operational/hmrc/customs-cds-volume-3',
  },
  {
    slug: 'customs-civil-penalties-guidance',
    title: 'Customs Civil Penalties Guidance Manual',
    description: 'HMRC guidance on civil penalties for customs offences.',
    govUkSlug: 'customs-civil-penalties-guidance',
    r2Prefix: 'operational/hmrc/customs-civil-penalties-guidance',
  },
  {
    slug: 'denatured-alcohol',
    title: 'Denatured Alcohol Manual',
    description: 'HMRC guidance on denatured alcohol.',
    govUkSlug: 'denatured-alcohol',
    r2Prefix: 'operational/hmrc/denatured-alcohol',
  },
  {
    slug: 'duty-free-spirits',
    title: 'Duty Free Spirits Manual',
    description: 'HMRC guidance on duty-free spirits.',
    govUkSlug: 'duty-free-spirits',
    r2Prefix: 'operational/hmrc/duty-free-spirits',
  },
  {
    slug: 'excise-assessments-interim-guidance',
    title: 'Excise Assessments Interim Guidance',
    description: 'HMRC interim guidance on excise duty assessments.',
    govUkSlug: 'excise-assessments-interim-guidance',
    r2Prefix: 'operational/hmrc/excise-assessments-interim-guidance',
  },
  {
    slug: 'excise-civil-penalties',
    title: 'Excise Civil Penalties Manual',
    description: 'HMRC guidance on civil penalties for excise offences.',
    govUkSlug: 'excise-civil-penalties',
    r2Prefix: 'operational/hmrc/excise-civil-penalties',
  },
  {
    slug: 'excise-due-diligence-condition',
    title: 'Excise Due Diligence Condition Guidance',
    description: 'HMRC guidance on the excise due diligence condition.',
    govUkSlug: 'excise-due-diligence-condition',
    r2Prefix: 'operational/hmrc/excise-due-diligence-condition',
  },
  {
    slug: 'excise-repayment-overpaid-duty',
    title: 'Excise Repayment of Overpaid Duty Guidance',
    description: 'HMRC guidance on repayment of overpaid excise duty.',
    govUkSlug: 'excise-repayment-overpaid-duty',
    r2Prefix: 'operational/hmrc/excise-repayment-overpaid-duty',
  },
  {
    slug: 'excise-statutory-interest-manual',
    title: 'Excise Statutory Interest Manual',
    description: 'HMRC guidance on statutory interest in excise cases.',
    govUkSlug: 'excise-statutory-interest-manual',
    r2Prefix: 'operational/hmrc/excise-statutory-interest-manual',
  },
  {
    slug: 'gas-for-road-fuel-use',
    title: 'Gas for Road Fuel Use Manual',
    description: 'HMRC guidance on duty on gas used as road fuel.',
    govUkSlug: 'gas-for-road-fuel-use',
    r2Prefix: 'operational/hmrc/gas-for-road-fuel-use',
  },
  {
    slug: 'holding-and-movements-assurance-guidance',
    title: 'Holding and Movement Assurance Guidance',
    description: 'HMRC guidance on excise goods movement assurance.',
    govUkSlug: 'holding-and-movements-assurance-guidance',
    r2Prefix: 'operational/hmrc/holding-and-movements-assurance-guidance',
  },
  {
    slug: 'holding-and-movements-exports-shops',
    title: 'Holding and Movement Export Shops Guidance Manual',
    description: 'HMRC guidance on excise goods export shops.',
    govUkSlug: 'holding-and-movements-exports-shops',
    r2Prefix: 'operational/hmrc/holding-and-movements-exports-shops',
  },
  {
    slug: 'hydrocarbon-oils-strategy',
    title: 'Hydrocarbon Oils Strategy Manual',
    description: 'HMRC guidance on hydrocarbon oils duty strategy.',
    govUkSlug: 'hydrocarbon-oils-strategy',
    r2Prefix: 'operational/hmrc/hydrocarbon-oils-strategy',
  },
  {
    slug: 'import-and-national-clearance-hub-procedures',
    title: 'Import and National Clearance Hub Procedures Manual',
    description: 'HMRC guidance on import clearance hub procedures.',
    govUkSlug: 'import-and-national-clearance-hub-procedures',
    r2Prefix: 'operational/hmrc/import-and-national-clearance-hub-procedures',
  },
  {
    slug: 'oils-technical-manual',
    title: 'Oil Technical Manual',
    description: 'HMRC technical guidance on hydrocarbon oils.',
    govUkSlug: 'oils-technical-manual',
    r2Prefix: 'operational/hmrc/oils-technical-manual',
  },
  {
    slug: 'spirits-production',
    title: 'Spirits Production Manual',
    description: 'HMRC guidance on spirits production duty.',
    govUkSlug: 'spirits-production',
    r2Prefix: 'operational/hmrc/spirits-production',
  },
  {
    slug: 'strategic-goods-and-services-assessment-risk-and-offence-action',
    title: 'Strategic Goods and Services: Assessment of Risk and Offence Action',
    description: 'HMRC guidance on strategic goods and services export controls.',
    govUkSlug: 'strategic-goods-and-services-assessment-risk-and-offence-action',
    r2Prefix: 'operational/hmrc/strategic-goods-and-services',
  },
  {
    slug: 'tobacco-control-of-supply-chains',
    title: 'Tobacco: Anti-smuggling Manual',
    description: 'HMRC guidance on tobacco anti-smuggling controls.',
    govUkSlug: 'tobacco-control-of-supply-chains',
    r2Prefix: 'operational/hmrc/tobacco-control-of-supply-chains',
  },
  {
    slug: 'tobacco-products-duty',
    title: 'Tobacco Products Duty Manual',
    description: 'HMRC guidance on tobacco products duty.',
    govUkSlug: 'tobacco-products-duty',
    r2Prefix: 'operational/hmrc/tobacco-products-duty',
  },
  {
    slug: 'tobacco-products-manufacturing-machinery-licensing-scheme',
    title: 'Tobacco Products Manufacturing Machinery Licensing Scheme',
    description: 'HMRC guidance on the tobacco manufacturing machinery licensing scheme.',
    govUkSlug: 'tobacco-products-manufacturing-machinery-licensing-scheme',
    r2Prefix: 'operational/hmrc/tobacco-manufacturing-machinery',
  },
  {
    slug: 'tobacco-track-and-trace-compliance',
    title: 'Tobacco Track and Trace Compliance',
    description: 'HMRC guidance on tobacco track and trace compliance.',
    govUkSlug: 'tobacco-track-and-trace-compliance',
    r2Prefix: 'operational/hmrc/tobacco-track-and-trace',
  },
  {
    slug: 'wine-manual',
    title: 'Wine Manual',
    description: 'HMRC guidance on wine duty.',
    govUkSlug: 'wine-manual',
    r2Prefix: 'operational/hmrc/wine-manual',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointData {
  completedManuals: string[]                  // slugs fully ingested
  completedPages: Record<string, string[]>    // slug → [pageSlug, ...]
  startedAt: string                           // ISO timestamp of first run
  lastUpdatedAt: string
  totalPagesIngested: number
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) as CheckpointData
  }
  return {
    completedManuals: [],
    completedPages: {},
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    totalPagesIngested: 0,
  }
}

function saveCheckpoint(cp: CheckpointData): void {
  cp.lastUpdatedAt = new Date().toISOString()
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

function initLog(): void {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,method,url,statusCode,durationMs,notes\n')
  }
}

function logRequest(url: string, statusCode: number, durationMs: number, notes = ''): void {
  const ts = new Date().toISOString()
  const line = `${ts},GET,${url},${statusCode},${durationMs},"${notes.replace(/"/g, "'")}"\n`
  fs.appendFileSync(LOG_FILE, line)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limiting
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed)
  lastRequestAt = Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP fetch with exponential backoff
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithBackoff(url: string): Promise<{ html: string; status: number }> {
  let backoff = BACKOFF_INIT
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await throttle()
    const start = Date.now()
    try {
      const { status, body } = await httpGet(url)
      const duration = Date.now() - start
      logRequest(url, status, duration)

      if (status === 200) return { html: body, status }

      if (status === 429 || status === 503) {
        const wait = Math.min(backoff, BACKOFF_MAX)
        console.warn(`  ⚠ ${status} on ${url} — backing off ${wait / 1000}s`)
        logRequest(url, status, duration, `backoff ${wait}ms`)
        await sleep(wait)
        backoff = Math.min(backoff * 2, BACKOFF_MAX)
        continue
      }

      if (status === 404) {
        logRequest(url, 404, duration, '404 page absent')
        return { html: '', status }
      }

      logRequest(url, status, duration, 'unexpected status')
      return { html: '', status }

    } catch (err: any) {
      const duration = Date.now() - start
      const msg = String(err?.message ?? err)
      logRequest(url, 0, duration, `error: ${msg}`)
      const wait = Math.min(backoff, BACKOFF_MAX)
      console.warn(`  ⚠ Fetch error ${url}: ${msg} — backing off ${wait / 1000}s`)
      await sleep(wait)
      backoff = Math.min(backoff * 2, BACKOFF_MAX)
    }
  }
}

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      timeout: FETCH_TIMEOUT,
    }
    https.get(url, options, res => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${GOV_UK_BASE}${res.headers.location}`
        res.destroy()
        return resolve(httpGet(redirect))
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
      res.on('error', reject)
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt check
// ─────────────────────────────────────────────────────────────────────────────

async function checkRobotsTxt(): Promise<void> {
  console.log('Checking robots.txt on gov.uk...')
  const { html, status } = await fetchWithBackoff(`${GOV_UK_BASE}/robots.txt`)
  if (status !== 200) {
    console.warn('  Could not fetch robots.txt — proceeding cautiously')
    return
  }
  const lines = html.split('\n').map(l => l.trim().toLowerCase())
  let inRelevantBlock = false
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      const agent = line.replace('user-agent:', '').trim()
      inRelevantBlock = agent === '*' || agent.includes('scrutinise')
    }
    if (inRelevantBlock && line.startsWith('disallow:')) {
      const disallowed = line.replace('disallow:', '').trim()
      if (disallowed && '/hmrc-internal-manuals/'.startsWith(disallowed)) {
        throw new Error(`robots.txt disallows ${disallowed} — aborting`)
      }
    }
  }
  console.log('  robots.txt OK — /hmrc-internal-manuals/ not disallowed')
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all page links for a given manual from an HTML page.
 * Matches /hmrc-internal-manuals/{govUkSlug}/{pageSlug} links.
 * Excludes 'contents' (the index URL itself) and 'print' variants.
 */
function extractManualPageLinks(html: string, govUkSlug: string): Array<{ slug: string; url: string }> {
  const links: Array<{ slug: string; url: string }> = []
  const seen = new Set<string>()
  // Match href="/hmrc-internal-manuals/{slug}/{page}" — page may contain a-z, 0-9, hyphens
  const pattern = new RegExp(
    `href="(/hmrc-internal-manuals/${govUkSlug}/([a-z0-9][a-z0-9_-]*[a-z0-9]|[a-z0-9]))"`,
    'gi'
  )
  let match
  while ((match = pattern.exec(html)) !== null) {
    const [, href, pageSlug] = match
    const normalSlug = pageSlug.toLowerCase()
    if (
      !seen.has(normalSlug) &&
      normalSlug !== 'contents' &&
      !normalSlug.startsWith('print') &&
      !href.includes('?')
    ) {
      seen.add(normalSlug)
      links.push({ slug: normalSlug, url: `${GOV_UK_BASE}${href}` })
    }
  }
  return links
}

/**
 * Extract main body content from a gov.uk HMRC manual page.
 * Targets .govuk-govspeak (manual content), falling back to <main>.
 */
function extractMainContent(html: string): string {
  // govspeak div — the primary manual content container
  const m = html.match(/<div[^>]+class="[^"]*govuk-govspeak[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<div|$)/i)
  if (m) return m[1]
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main) return main[1]
  return html
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Extract page-level title.
 * Prefers <h2 class="govuk-heading-*"> (section heading), then <h1>, then <title>.
 */
function extractTitle(html: string): string {
  const h2 = html.match(/<h2[^>]+class="[^"]*govuk-heading[^"]*"[^>]*>([^<]+)<\/h2>/i)
  if (h2) return h2[1].replace(/\s+/g, ' ').trim()
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1) return h1[1].replace(/\s+/g, ' ').trim()
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (title) return title[1].replace(/\s+/g, ' ').trim()
  return ''
}

/** Infer chapter slug from page slug (e.g. "eim01000" → "eim01", "ch100000" → "ch10") */
function inferChapterSlug(pageSlug: string): string {
  const m = pageSlug.match(/^([a-z]{2,4}\d{2})/)
  return m ? m[1] : pageSlug.slice(0, 5)
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress / ETA helpers
// ─────────────────────────────────────────────────────────────────────────────

let runStartMs: number
let pagesIngestedThisRun = 0

function formatEta(pagesLeft: number): string {
  if (pagesIngestedThisRun === 0) return '?'
  const elapsedS = (Date.now() - runStartMs) / 1000
  const perPage = elapsedS / pagesIngestedThisRun
  const remainingS = pagesLeft * perPage
  const h = Math.floor(remainingS / 3600)
  const m = Math.floor((remainingS % 3600) / 60)
  return `~${h}h${m}m`
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertOperationalDocument(client: any, manual: ManualDef): Promise<string> {
  const res = await client.query(`
    INSERT INTO "OperationalDocument"
      (id, "sourceType", "sourceSlug", "publisherName", title, description,
       "sourceUrl", "r2Prefix", jurisdiction, "ingestStatus", "pageCount",
       "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW(), NOW())
    ON CONFLICT ("sourceType", "sourceSlug") DO UPDATE
      SET title          = EXCLUDED.title,
          description    = EXCLUDED.description,
          "r2Prefix"     = EXCLUDED."r2Prefix",
          "ingestStatus" = $10,
          "updatedAt"    = NOW()
    RETURNING id
  `, [
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    manual.slug,
    'HMRC',
    manual.title,
    manual.description,
    `${GOV_UK_BASE}/hmrc-internal-manuals/${manual.govUkSlug}`,
    manual.r2Prefix,
    'UK',
    OperationalIngestStatus.IN_PROGRESS,
    OperationalIngestStatus.IN_PROGRESS,
  ])
  return res.rows[0].id as string
}

async function upsertOperationalSection(client: any, params: {
  documentId: string
  pageSlug: string
  chapterSlug: string
  pageTitle: string
  sourceUrl: string
  htmlKey: string
  textKey: string
  extractedText: string
  wordCount: number
  orderIndex: number
}): Promise<void> {
  await client.query(`
    INSERT INTO "OperationalSection"
      (id, "operationalDocumentId", "sourceType", "pageSlug", "chapterSlug",
       "pageTitle", "sourceUrl", "htmlKey", "textKey", "extractedText",
       "wordCount", "extractedBy", "orderIndex", "ingestStatus",
       "fetchedAt", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
       NOW(), NOW(), NOW())
    ON CONFLICT ("operationalDocumentId", "pageSlug") DO UPDATE
      SET "pageTitle"     = EXCLUDED."pageTitle",
          "htmlKey"       = EXCLUDED."htmlKey",
          "textKey"       = EXCLUDED."textKey",
          "extractedText" = EXCLUDED."extractedText",
          "wordCount"     = EXCLUDED."wordCount",
          "orderIndex"    = EXCLUDED."orderIndex",
          "ingestStatus"  = EXCLUDED."ingestStatus",
          "fetchedAt"     = NOW(),
          "updatedAt"     = NOW()
  `, [
    params.documentId,
    DocumentSourceType.ADMINISTRATIVE_GUIDANCE,
    params.pageSlug,
    params.chapterSlug,
    params.pageTitle,
    params.sourceUrl,
    params.htmlKey,
    params.textKey,
    params.extractedText,
    params.wordCount,
    'html-direct',
    params.orderIndex,
    OperationalIngestStatus.COMPLETE,
  ])
}

async function markDocumentComplete(client: any, documentId: string, pageCount: number): Promise<void> {
  await client.query(`
    UPDATE "OperationalDocument"
    SET "ingestStatus" = $1, "pageCount" = $2, "lastFetchedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $3
  `, [OperationalIngestStatus.COMPLETE, pageCount, documentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// BFS ingest per manual
// ─────────────────────────────────────────────────────────────────────────────

async function ingestManual(
  manual: ManualDef,
  cp: CheckpointData,
  manualIdx: number,
  totalManuals: number,
): Promise<void> {
  if (cp.completedManuals.includes(manual.slug)) {
    console.log(`  [SKIP ${manualIdx}/${totalManuals}] ${manual.title} — complete`)
    return
  }

  const manualLabel = `[manual ${manualIdx}/${totalManuals}] ${manual.slug}`
  console.log(`\n══ ${manualLabel} ══`)
  console.log(`   ${manual.title}`)

  // Upsert OperationalDocument row
  const dbClient1 = await pool.connect()
  let documentId: string
  try {
    documentId = await upsertOperationalDocument(dbClient1, manual)
    console.log(`   DB doc: ${documentId}`)
  } finally {
    dbClient1.release()
  }

  // BFS state
  if (!cp.completedPages[manual.slug]) cp.completedPages[manual.slug] = []
  const visited = new Set<string>(cp.completedPages[manual.slug])
  const inQueue = new Set<string>()
  const queue: Array<{ slug: string; url: string }> = []

  // Seed BFS from the manual index page
  const indexUrl = `${GOV_UK_BASE}/hmrc-internal-manuals/${manual.govUkSlug}`
  console.log(`   Fetching index: ${indexUrl}`)
  const { html: indexHtml, status: indexStatus } = await fetchWithBackoff(indexUrl)

  if (indexStatus !== 200 || !indexHtml) {
    console.error(`   ✗ Cannot fetch index (${indexStatus}) — skipping manual`)
    return
  }

  const seedLinks = extractManualPageLinks(indexHtml, manual.govUkSlug)
  console.log(`   Index discovered ${seedLinks.length} seed links`)
  for (const link of seedLinks) {
    if (!visited.has(link.slug) && !inQueue.has(link.slug)) {
      queue.push(link)
      inQueue.add(link.slug)
    }
  }

  let ingested = 0
  let skipped = visited.size
  let failed = 0
  let orderIndex = visited.size   // continue ordering from where we left off

  // BFS main loop
  while (queue.length > 0) {
    const { slug: pageSlug, url: pageUrl } = queue.shift()!

    if (visited.has(pageSlug)) {
      skipped++
      continue
    }

    const progress = `[${manualIdx}/${totalManuals}][page ${ingested + skipped + 1}] ${pageSlug}`
    process.stdout.write(`   ${progress} ... `)

    const { html: pageHtml, status: pageStatus } = await fetchWithBackoff(pageUrl)

    if (pageStatus !== 200 || !pageHtml) {
      console.log(`✗ (${pageStatus})`)
      failed++
      // Mark visited so we don't retry in this run; not saved to checkpoint (will retry on re-run)
      visited.add(pageSlug)
      inQueue.delete(pageSlug)
      continue
    }

    // Discover additional links from this page (BFS expansion)
    const newLinks = extractManualPageLinks(pageHtml, manual.govUkSlug)
    let newDiscovered = 0
    for (const link of newLinks) {
      if (!visited.has(link.slug) && !inQueue.has(link.slug)) {
        queue.push(link)
        inQueue.add(link.slug)
        newDiscovered++
      }
    }

    // Extract content
    const chapterSlug    = inferChapterSlug(pageSlug)
    const mainContent    = extractMainContent(pageHtml)
    const plainText      = stripHtml(mainContent)
    const title          = extractTitle(pageHtml)
    const wc             = wordCount(plainText)
    const extractedText  = plainText.slice(0, 1000)   // Railway FTS excerpt

    const htmlKey = `${manual.r2Prefix}/${chapterSlug}/${pageSlug}.html`
    const textKey = `${manual.r2Prefix}/${chapterSlug}/${pageSlug}.text`

    // Write to R2
    await r2Put(htmlKey, pageHtml, 'text/html')
    await r2Put(textKey, plainText, 'text/plain')

    // Write to Railway
    const dbClient2 = await pool.connect()
    try {
      await upsertOperationalSection(dbClient2, {
        documentId,
        pageSlug,
        chapterSlug,
        pageTitle: title,
        sourceUrl: pageUrl,
        htmlKey,
        textKey,
        extractedText,
        wordCount: wc,
        orderIndex,
      })
    } finally {
      dbClient2.release()
    }

    // Update checkpoint state
    cp.completedPages[manual.slug].push(pageSlug)
    visited.add(pageSlug)
    inQueue.delete(pageSlug)
    ingested++
    orderIndex++
    pagesIngestedThisRun++
    cp.totalPagesIngested++

    const queueInfo = queue.length > 0 ? ` Q:${queue.length}` : ''
    const newInfo = newDiscovered > 0 ? ` +${newDiscovered}` : ''
    console.log(`✓ (${wc}w${newInfo}${queueInfo})`)

    // Checkpoint every N pages
    if (ingested % CHECKPOINT_SAVE_INTERVAL === 0) {
      saveCheckpoint(cp)
      const etaInfo = pagesIngestedThisRun > 0 ? ` ETA: ${formatEta(queue.length)}` : ''
      console.log(`   ✦ checkpoint saved — ${ingested} ingested this session${etaInfo}`)
    }
  }

  // Mark document complete in DB
  const totalPages = ingested + (cp.completedPages[manual.slug]?.length ?? 0) - ingested // = original visited count + newly ingested
  const finalPageCount = cp.completedPages[manual.slug].length
  const dbClient3 = await pool.connect()
  try {
    await markDocumentComplete(dbClient3, documentId, finalPageCount)
  } finally {
    dbClient3.release()
  }

  cp.completedManuals.push(manual.slug)
  saveCheckpoint(cp)

  console.log(`   ✓ DONE — ${ingested} new pages ingested, ${skipped} skipped, ${failed} failed`)
  console.log(`     Total pages in DB for this manual: ${finalPageCount}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  runStartMs = Date.now()

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  HMRC Internal Manuals — Full Operational Corpus Ingest      ║')
  console.log('║  V.3-C Tax Corpus Sprint                                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`User-Agent  : ${USER_AGENT}`)
  console.log(`Rate limit  : 1 req / ${MIN_DELAY_MS / 1000}s, backoff 30s → 10min`)
  console.log(`Checkpoint  : ${CHECKPOINT_FILE}`)
  console.log(`Audit log   : ${LOG_FILE}`)
  console.log(`Manuals     : ${MANUALS.length} in list`)
  console.log('')

  initLog()
  await checkRobotsTxt()

  const cp = loadCheckpoint()
  console.log(`Checkpoint  : ${cp.completedManuals.length} manuals complete, ${cp.totalPagesIngested} total pages ingested`)
  console.log('')

  // ── CLI flags ──────────────────────────────────────────────────────────────
  const manualArg = process.argv.find(a => a.startsWith('--manual='))
  const fromArg   = process.argv.find(a => a.startsWith('--from='))
  const targetSlug = manualArg ? manualArg.replace('--manual=', '') : null
  const fromSlug   = fromArg   ? fromArg.replace('--from=', '') : null

  let toIngest: ManualDef[]
  if (targetSlug) {
    toIngest = MANUALS.filter(m => m.slug === targetSlug)
    if (toIngest.length === 0) {
      console.error(`No manual found with slug "${targetSlug}"`)
      console.error('Available slugs:')
      MANUALS.forEach(m => console.error(`  ${m.slug}`))
      process.exit(1)
    }
  } else if (fromSlug) {
    const idx = MANUALS.findIndex(m => m.slug === fromSlug)
    if (idx === -1) {
      console.error(`No manual found with slug "${fromSlug}" for --from`)
      process.exit(1)
    }
    toIngest = MANUALS.slice(idx)
    console.log(`Starting from manual ${idx + 1}/${MANUALS.length}: ${fromSlug}`)
  } else {
    toIngest = MANUALS
  }

  // Process each manual in sequence
  for (let i = 0; i < toIngest.length; i++) {
    const manual = toIngest[i]
    const globalIdx = MANUALS.findIndex(m => m.slug === manual.slug) + 1
    await ingestManual(manual, cp, globalIdx, MANUALS.length)
  }

  const elapsed = Math.round((Date.now() - runStartMs) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  INGEST COMPLETE                                             ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Elapsed          : ${h}h ${m}m ${s}s`)
  console.log(`Manuals complete : ${cp.completedManuals.length} / ${MANUALS.length}`)
  console.log(`Pages ingested   : ${cp.totalPagesIngested}`)
  console.log(`Checkpoint       : ${CHECKPOINT_FILE}`)

  await pool.end()
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.message ?? err)
  process.exit(1)
})
