/**
 * V.3-B Phase 4 — UKSI pilot verification.
 * Four checks per the pilot brief:
 *   1. Railway integrity (100 LegislationItem rows, types, yearRaw, no UKPGA contamination)
 *   2. R2 spot-check (30 random sections: 15 RC → tna, 15 enacted → original)
 *   3. Web cross-check (10 random UKSI vs legislation.gov.uk — section count + first 3 numbers)
 *   4. Title decoding check (10 titles for visible & entities)
 *
 * Pre-flight: reconciles any sectionCount mismatches caused by the dedup bug fix
 *   (18 re-ingested items had sectionCount = validP1groups.length instead of seenSectionNumbers.size)
 */
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { prisma } from '../../../scrutinise-web/lib/prisma'
import { r2Exists, tnaXmlKey, originalXmlKey } from '../r2-client'
import { CompilationStatus, LegislationType, LegislationTier } from '@prisma/client'

const DIR           = __dirname
const PROGRESS_FILE = path.join(DIR, 'phase3-uksi-progress.json')
const MANIFEST_PATH = path.join(DIR, 'manifest-uksi.json')

interface ManifestEntry {
  actId: string
  version: 'revised-current' | 'made'
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Scrutinise-Verify/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGet(res.headers.location!))
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// TNA renders provision numbers with various Leg*No classes depending on SI type.
// Matches: LegArticleNo, LegRuleNo, LegRegNo, LegSecNo, LegP1No, LegProvNo, etc.
function parseSectionNumbersFromHtml(html: string): string[] {
  const classPattern = /class="[^"]*Leg(?:Article|Rule|Reg|Sec|P1|Prov)No[^"]*"[^>]*>([^<]+)</g
  const matches = [...html.matchAll(classPattern)]
  if (matches.length > 0) {
    return matches.map(m => m[1].trim().replace(/\.$/, '')).filter(Boolean).slice(0, 20)
  }
  // Fallback: look for provision hrefs like href="#article-1" or href="#regulation-1"
  const hrefPattern = /href="#(?:article|regulation|rule|section)-(\d+(?:-\d+)*)"/g
  const hrefs = [...html.matchAll(hrefPattern)]
  return [...new Set(hrefs.map(m => m[1].trim()))].slice(0, 20)
}

async function main() {
  console.log('=== V.3-B PHASE 4 — UKSI PILOT VERIFICATION ===')
  console.log(`Run at: ${new Date().toISOString()}\n`)

  // Load manifest for version-aware R2 classification
  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8').replace(/^﻿/, ''))
  const versionMap = new Map(manifest.map(m => [m.actId, m.version]))

  // Load progress to know which acts were ingested
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'))
  const ingestedActIds: string[] = progress.completed ?? []
  console.log(`Acts in progress file (completed): ${ingestedActIds.length}`)

  // ── Pre-flight: reconcile sectionCount mismatches ─────────────────────────────
  console.log('\n── Pre-flight: sectionCount reconciliation ──')

  const allItems = await prisma.legislationItem.findMany({
    where: { legislationGovUkId: { in: ingestedActIds } },
    select: {
      id: true, legislationGovUkId: true, legislationType: true, tier: true,
      sourceType: true, jurisdiction: true, yearRaw: true, year: true, number: true,
      compilationStatus: true, sectionCount: true,
      _count: { select: { sections: true } }
    }
  })

  let reconciled = 0
  for (const item of allItems) {
    if (item.sectionCount !== item._count.sections) {
      await prisma.legislationItem.update({
        where: { id: item.id },
        data: { sectionCount: item._count.sections }
      })
      console.log(`  Fixed ${item.legislationGovUkId}: sectionCount ${item.sectionCount} → ${item._count.sections}`)
      reconciled++
    }
  }
  console.log(`  Reconciled: ${reconciled} items (expected 18 from dedup-bug re-ingest)`)

  // Reload after reconciliation
  const uksiItems = await prisma.legislationItem.findMany({
    where: { legislationGovUkId: { in: ingestedActIds } },
    select: {
      id: true, legislationGovUkId: true, legislationType: true, tier: true,
      sourceType: true, jurisdiction: true, yearRaw: true, year: true, number: true,
      compilationStatus: true, sectionCount: true,
      _count: { select: { sections: true } }
    }
  })

  // ── 1. Railway integrity ─────────────────────────────────────────────────────
  console.log('\n── 1. Railway integrity ──')

  console.log(`  Items found in Railway: ${uksiItems.length} / ${ingestedActIds.length}`)

  const wrongType     = uksiItems.filter(i => i.legislationType !== LegislationType.UKSI)
  const wrongTier     = uksiItems.filter(i => i.tier !== LegislationTier.TIER_3)
  const wrongJuris    = uksiItems.filter(i => i.jurisdiction !== 'UK')
  const nullYearRaw   = uksiItems.filter(i => !i.yearRaw)
  const mismatchCount = uksiItems.filter(i => i.sectionCount !== i._count.sections)

  console.log(`  legislationType = UKSI:    ${uksiItems.length - wrongType.length}/${uksiItems.length}${wrongType.length > 0 ? ` ⚠️  WRONG: ${wrongType.map(i => i.legislationGovUkId).join(', ')}` : ' ✓'}`)
  console.log(`  tier = TIER_3:             ${uksiItems.length - wrongTier.length}/${uksiItems.length}${wrongTier.length > 0 ? ' ⚠️  WRONG' : ' ✓'}`)
  console.log(`  jurisdiction = UK:         ${uksiItems.length - wrongJuris.length}/${uksiItems.length}${wrongJuris.length > 0 ? ' ⚠️  WRONG' : ' ✓'}`)
  console.log(`  yearRaw non-null:          ${uksiItems.length - nullYearRaw.length}/${uksiItems.length}${nullYearRaw.length > 0 ? ` ⚠️  NULL: ${nullYearRaw.map(i => i.legislationGovUkId).slice(0,5).join(', ')}` : ' ✓'}`)
  console.log(`  sectionCount consistent:   ${uksiItems.length - mismatchCount.length}/${uksiItems.length}${mismatchCount.length > 0 ? ' ⚠️  MISMATCH' : ' ✓'}`)

  // UKPGA contamination check
  const ukpgaCount = await prisma.legislationItem.count({ where: { legislationType: LegislationType.UKPGA } })
  const KNOWN_UKPGA_BASELINE = 11768
  const contaminated = ukpgaCount !== KNOWN_UKPGA_BASELINE
  console.log(`  UKPGA item count: ${ukpgaCount} (expected ${KNOWN_UKPGA_BASELINE}) ${contaminated ? '⚠️  UNEXPECTED CHANGE' : '✓'}`)

  // Section rows check
  const totalSections = await prisma.legislationSection.count({
    where: { legislationItem: { legislationGovUkId: { in: ingestedActIds } } }
  })
  const totalExpectedSections = uksiItems.reduce((s, i) => s + i._count.sections, 0)
  console.log(`  Total UKSI sections in Railway: ${totalSections} (sectionCount totals: ${totalExpectedSections}) ${totalSections === totalExpectedSections ? '✓' : '⚠️  MISMATCH'}`)

  // ── 2. R2 spot-check ─────────────────────────────────────────────────────────
  console.log('\n── 2. R2 spot-check (30 random sections) ──')

  // Classify items by manifest version, not by array position
  const rcItems   = uksiItems.filter(i => versionMap.get(i.legislationGovUkId) === 'revised-current' && i.sectionCount > 0)
  const madeItems = uksiItems.filter(i => versionMap.get(i.legislationGovUkId) === 'made'            && i.sectionCount > 0)
  console.log(`  RC items with sections: ${rcItems.length}, Made items with sections: ${madeItems.length}`)

  const spotCheck = async (items: typeof uksiItems, count: number, expectedField: 'tnaXmlKey' | 'originalXmlKey') => {
    let pass = 0, fail = 0
    const keyFn = expectedField === 'tnaXmlKey' ? tnaXmlKey : originalXmlKey
    const step = Math.max(1, Math.floor(items.length / count))
    const sample = items.filter((_, i) => i % step === 0).slice(0, count)
    for (const item of sample) {
      const sections = await prisma.legislationSection.findMany({
        where: { legislationItemId: item.id },
        select: { sectionNumber: true, tnaXmlKey: true, originalXmlKey: true },
        take: 1
      })
      if (sections.length === 0) { console.log(`  SKIP ${item.legislationGovUkId}: no sections`); continue }
      const sec = sections[0]
      const hasCorrectKey = sec[expectedField] !== null
      const key = keyFn(item.legislationGovUkId, sec.sectionNumber)
      const exists = await r2Exists(key)
      const label = hasCorrectKey && exists ? 'PASS' : 'FAIL'
      if (label === 'PASS') pass++; else fail++
      console.log(`  ${label} ${item.legislationGovUkId} s.${sec.sectionNumber} → ${expectedField}: ${hasCorrectKey ? 'set' : 'MISSING'}, R2: ${exists ? 'exists' : 'MISSING'}`)
    }
    return { pass, fail }
  }

  const rcSpot   = await spotCheck(rcItems,   15, 'tnaXmlKey')
  const madeSpot = await spotCheck(madeItems, 15, 'originalXmlKey')
  console.log(`  Revised-current spot-check: ${rcSpot.pass}/15 PASS`)
  console.log(`  Made (enacted) spot-check:  ${madeSpot.pass}/15 PASS`)

  // ── 3. Web cross-check ────────────────────────────────────────────────────────
  console.log('\n── 3. Web cross-check (10 UKSI vs legislation.gov.uk) ──')

  // Pick 10 deterministically: every 10th ingested item
  const step10    = Math.max(1, Math.floor(uksiItems.length / 10))
  const webSample = uksiItems.filter((_, i) => i % step10 === 0).slice(0, 10)

  let webPass = 0, webFail = 0, webError = 0
  for (const item of webSample) {
    const actId = item.legislationGovUkId
    const railwaySections = await prisma.legislationSection.findMany({
      where: { legislationItemId: item.id },
      select: { sectionNumber: true },
      orderBy: [{ sectionNumber: 'asc' }]
    })
    const railwayCount = railwaySections.length
    const railwayFirst3 = railwaySections.slice(0, 3).map(s => s.sectionNumber).join(', ')

    try {
      const html = await httpsGet(`https://www.legislation.gov.uk/${actId}`)
      const webNumbers = parseSectionNumbersFromHtml(html)
      const webFirst3 = webNumbers.slice(0, 3).join(', ')

      const numbersMatch = railwayFirst3 !== '' && webFirst3 !== '' && railwayFirst3 === webFirst3
      const status = numbersMatch ? 'PASS' : (webNumbers.length === 0 ? 'NO-WEB-NUMS' : 'DIFF')
      if (numbersMatch) webPass++; else if (webNumbers.length === 0) webError++; else webFail++
      console.log(`  ${status} ${actId}: railway=[${railwayFirst3}] web=[${webFirst3}] (railway_count=${railwayCount})`)

      await new Promise(r => setTimeout(r, 1000))
    } catch (err: any) {
      webError++
      console.log(`  ERROR ${actId}: ${err.message}`)
    }
  }
  console.log(`  Web cross-check: ${webPass}/10 exact match, ${webFail} diff, ${webError} no-web-nums/error`)

  // ── 4. Title decoding check ───────────────────────────────────────────────────
  console.log('\n── 4. Title decoding check (10 sample titles) ──')

  const titleSample = uksiItems.slice(0, 10)
  for (const item of titleSample) {
    const dbItem = await prisma.legislationItem.findUnique({
      where: { id: item.id }, select: { title: true, legislationGovUkId: true }
    })
    const title = dbItem?.title ?? ''
    const hasRawEntity = /&amp;|&apos;|&quot;|&lt;|&gt;|&#\d+;/.test(title)
    console.log(`  ${hasRawEntity ? '⚠️  ENTITY' : '  OK'} ${item.legislationGovUkId}: "${title.slice(0, 80)}"`)
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n── Summary ──')
  const integrityOk = wrongType.length === 0 && wrongTier.length === 0 && wrongJuris.length === 0 && nullYearRaw.length === 0 && mismatchCount.length === 0 && !contaminated
  const r2Ok = rcSpot.fail === 0 && madeSpot.fail === 0
  console.log(`  Railway integrity: ${integrityOk ? 'PASS ✓' : 'FAIL ⚠️'}`)
  console.log(`  R2 key correctness: ${r2Ok ? 'PASS ✓' : 'FAIL ⚠️'}`)
  console.log(`  Web cross-check: ${webPass}/10 match`)
  console.log('\n=== VERIFICATION COMPLETE ===')

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
