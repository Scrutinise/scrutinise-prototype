import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../../scrutinise-web/.env') })
import { Prisma } from './runtime-deps'
import { getPrisma, disconnectPrisma } from './db'
import { r2KeyExists } from './r2-batch'
import { log } from './log'

export interface VerifyResult {
  total: number
  passed: number
  failed: number
  issues: string[]
  webPassed: number
  webFailed: number
}

function fetchWebSectionCount(actId: string): Promise<number | null> {
  return new Promise(resolve => {
    const url = `https://www.legislation.gov.uk/${actId}/data.xml`
    https.get(url, { timeout: 15_000 }, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        const matches = data.match(/<P1group/g)
        resolve(matches ? matches.length : 0)
      })
    }).on('error', () => resolve(null))
  })
}

export async function verify(samplePercent = 0.5, maxSample = 500, webChecks = 20): Promise<VerifyResult> {
  const result: VerifyResult = { total: 0, passed: 0, failed: 0, issues: [], webPassed: 0, webFailed: 0 }

  const prisma = getPrisma()
  const total = await prisma.legislationItem.count({ where: { legislationType: 'UKSI' } })
  const sampleSize = Math.min(maxSample, Math.max(100, Math.round(total * samplePercent / 100)))
  log(null, 'info', `Verification: sampling ${sampleSize} of ${total} UKSI items`)

  // $queryRaw is literal SQL — schema-qualify the table when PGSCHEMA is set
  // because the adapter's schema option only applies to Prisma-generated queries.
  const schemaPrefix = process.env.PGSCHEMA ? `"${process.env.PGSCHEMA}".` : ''
  const sample = await prisma.$queryRaw<Array<{ id: string; legislationGovUkId: string; sectionCount: number }>>(
    Prisma.sql`
      SELECT id, "legislationGovUkId", "sectionCount"
      FROM ${Prisma.raw(`${schemaPrefix}"LegislationItem"`)}
      WHERE "legislationType" = 'UKSI'
      ORDER BY RANDOM()
      LIMIT ${sampleSize}
    `
  )

  result.total = sample.length

  for (const item of sample) {
    // sectionCount header must match actual section rows
    const actualCount = await prisma.legislationSection.count({ where: { legislationItemId: item.id } })
    if (actualCount !== item.sectionCount) {
      result.failed++
      result.issues.push(`${item.legislationGovUkId}: sectionCount mismatch (header=${item.sectionCount} actual=${actualCount})`)
      continue
    }

    // Spot-check one section's R2 backing blob
    const section = await prisma.legislationSection.findFirst({
      where: { legislationItemId: item.id },
      select: { tnaXmlKey: true, originalXmlKey: true },
    })
    const r2Key = section?.tnaXmlKey ?? section?.originalXmlKey ?? null
    if (r2Key) {
      const exists = await r2KeyExists(r2Key)
      if (!exists) {
        result.failed++
        result.issues.push(`${item.legislationGovUkId}: R2 blob missing: ${r2Key}`)
        continue
      }
    }

    result.passed++
  }

  // Web parity — compare Railway sectionCount against live TNA feed
  log(null, 'info', `Web parity: ${webChecks} items against legislation.gov.uk`)
  for (const item of sample.slice(0, webChecks)) {
    const webCount = await fetchWebSectionCount(item.legislationGovUkId)
    if (webCount === null) continue
    const delta = item.sectionCount > 0
      ? Math.abs(webCount - item.sectionCount) / item.sectionCount
      : webCount > 0 ? 1 : 0
    if (delta > 0.1) {
      result.webFailed++
      result.issues.push(`${item.legislationGovUkId}: web parity >10% (railway=${item.sectionCount} web=${webCount})`)
    } else {
      result.webPassed++
    }
  }

  return result
}

export async function runVerify(): Promise<void> {
  try {
    const result = await verify()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.resolve(__dirname, `../verification-${ts}.log`)

    const lines = [
      `=== V.3-B-opt Verification Report — ${new Date().toISOString()} ===`,
      `Sampled:      ${result.total}`,
      `Passed:       ${result.passed}`,
      `Failed:       ${result.failed}`,
      `Web passed:   ${result.webPassed}`,
      `Web failed:   ${result.webFailed}`,
      '',
      ...result.issues.map(i => `ISSUE: ${i}`),
      '',
      result.failed === 0 && result.webFailed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL',
    ]

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8')
    log(null, result.failed === 0 ? 'info' : 'error', `Verification: ${result.passed}/${result.total} passed — ${reportPath}`)
    if (result.failed > 0 || result.webFailed > 0) process.exit(1)
  } finally {
    await disconnectPrisma()
  }
}

if (require.main === module) {
  runVerify().catch(err => { console.error(err); process.exit(1) })
}
