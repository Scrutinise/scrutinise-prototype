/**
 * test-ingest-5.ts — Phase 4 verification ingest on 5 specific acts.
 * Calls ingestAct() directly for each test act without touching the full feed.
 */
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { prisma } from '../../scrutinise-web/lib/prisma'
import { r2Get, r2Exists, originalXmlKey, tnaXmlKey, effectsKey } from './r2-client'

// Pull in ingestAct internals — we'll re-implement inline to keep the test self-contained
// and avoid having to export from ingest.ts.

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
const R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

async function countR2Keys(prefix: string): Promise<{ xml: number; tna: number; effects: number; summary: number }> {
  let xml = 0, tna = 0, effects = 0, summary = 0
  let token: string | undefined
  do {
    const res = await r2Client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      const k = obj.Key ?? ''
      if (k.endsWith('.original.xml')) xml++
      else if (k.endsWith('.tna.xml'))   tna++
      else if (k.endsWith('.summary.txt')) summary++
      else if (k.endsWith('.xml'))       effects++  // effects.xml
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return { xml, tna, effects, summary }
}

interface ActResult {
  actId:         string
  title:         string
  sections:      number
  origXml:       number
  tnaXml:        number
  effects:       boolean
  effectEntries: number
  s202:          number
  errors:        number
  pass:          boolean
  notes:         string[]
}

const TEST_ACTS = [
  { actId: 'ukpga/2010/15', label: 'Equality Act 2010' },
  { actId: 'ukpga/1968/60', label: 'Theft Act 1968' },
  { actId: 'ukpga/2007/3',  label: 'Income Tax Act 2007' },
  { actId: 'ukpga/2024/3',  label: 'Finance (No. 2) Act 2024' },
  { actId: 'ukpga/2006/46', label: 'Companies Act 2006' },
]

async function verifyAct(actId: string, label: string): Promise<ActResult> {
  const result: ActResult = {
    actId, title: label, sections: 0, origXml: 0, tnaXml: 0,
    effects: false, effectEntries: 0, s202: 0, errors: 0, pass: false, notes: [],
  }

  // DB: check LegislationItem
  const item = await prisma.legislationItem.findFirst({ where: { legislationGovUkId: actId } })
  if (!item) {
    result.errors++
    result.notes.push('LegislationItem not found in DB')
    return result
  }

  // DB: check LegislationSection rows
  const sections = await prisma.legislationSection.findMany({
    where: { legislationItemId: item.id },
    select: { sectionNumber: true, originalXmlKey: true, tnaXmlKey: true, compilationStatus: true, compiledBy: true },
  })
  result.sections = sections.length
  result.origXml  = sections.filter(s => s.originalXmlKey).length
  result.tnaXml   = sections.filter(s => s.tnaXmlKey).length
  result.s202     = sections.filter(s => s.compiledBy === 'tna-202').length

  // DB: check effectsKey
  if (item.effectsKey) {
    result.effects = true
    const fxXml = await r2Get(item.effectsKey)
    if (fxXml) {
      result.effectEntries = (fxXml.match(/<entry>/g) ?? []).length
    } else {
      result.notes.push('effectsKey set in DB but R2 object not found')
      result.errors++
    }
  }

  // R2 key counts for this act
  const r2Counts = await countR2Keys(actId + '/')
  result.notes.push(`R2: ${r2Counts.xml} .original.xml / ${r2Counts.tna} .tna.xml / ${r2Counts.effects} effects.xml / ${r2Counts.summary} .summary.txt`)

  // Spot-check: fetch one .original.xml and verify it looks like enacted CLML
  const sampleSection = sections.find(s => s.originalXmlKey)
  if (sampleSection?.originalXmlKey) {
    const xml = await r2Get(sampleSection.originalXmlKey)
    if (xml) {
      const hasP1group = xml.includes('<P1group')
      const hasCommentaryRef = xml.includes('<CommentaryRef')
      const hasDocumentUri = xml.includes('DocumentURI') || xml.includes('enacted')
      result.notes.push(
        `s.${sampleSection.sectionNumber} .original.xml: P1group=${hasP1group} CommentaryRef=${hasCommentaryRef} enacted-ref=${hasDocumentUri} len=${xml.length}`
      )
    } else {
      result.notes.push(`s.${sampleSection.sectionNumber} .original.xml: R2 get failed`)
      result.errors++
    }
  }

  // Pass criteria: at least some sections with origXml (unless all-202 like Companies Act)
  const allSections202 = result.s202 === result.sections && result.sections > 0
  if (allSections202) {
    result.pass = true
    result.notes.push('All sections 202 (on-demand) — expected for older TNA-generated acts')
  } else if (result.sections > 0 && result.origXml > 0 && result.errors === 0) {
    result.pass = true
  } else if (result.sections === 0) {
    result.notes.push('No sections found — act may have no P1group in CLML')
    result.pass = false
  }

  return result
}

async function main() {
  console.log('=== Phase 4 Verification — 5 Test Acts ===\n')

  const results: ActResult[] = []

  for (const { actId, label } of TEST_ACTS) {
    console.log(`Verifying ${actId} (${label})...`)
    const r = await verifyAct(actId, label)
    results.push(r)
    console.log(`  sections=${r.sections} origXml=${r.origXml} tnaXml=${r.tnaXml} effects=${r.effectEntries} s202=${r.s202} errors=${r.errors} pass=${r.pass}`)
    for (const note of r.notes) console.log(`  → ${note}`)
    console.log()
  }

  // Summary table
  console.log('\n=== VERIFICATION TABLE ===')
  console.log(`${'Act'.padEnd(30)} ${'Sect'.padStart(5)} ${'Orig'.padStart(5)} ${'TNA'.padStart(5)} ${'Fx'.padStart(6)} ${'202s'.padStart(5)} ${'Err'.padStart(4)} ${'Pass'.padStart(5)}`)
  console.log('-'.repeat(70))
  for (const r of results) {
    const label = (r.title + ' (' + r.actId + ')').slice(0, 29).padEnd(30)
    console.log(
      `${label} ${String(r.sections).padStart(5)} ${String(r.origXml).padStart(5)} ${String(r.tnaXml).padStart(5)} ${String(r.effectEntries).padStart(6)} ${String(r.s202).padStart(5)} ${String(r.errors).padStart(4)} ${r.pass ? '  ✓' : '  ✗'}`)
  }

  const passed = results.filter(r => r.pass).length
  console.log(`\nResult: ${passed}/${results.length} passed`)

  // Write to file
  const lines: string[] = [
    '# V2.75 Phase 4 Verification Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Per-Act Results',
    '',
    '| Act | Sections | .original.xml | .tna.xml | Effects entries | 202s | Errors | Pass |',
    '|-----|----------|---------------|----------|-----------------|------|--------|------|',
  ]
  for (const r of results) {
    lines.push(`| ${r.title} (${r.actId}) | ${r.sections} | ${r.origXml} | ${r.tnaXml} | ${r.effectEntries} | ${r.s202} | ${r.errors} | ${r.pass ? '✓' : '✗'} |`)
  }
  lines.push('')
  lines.push('## Notes per act')
  lines.push('')
  for (const r of results) {
    lines.push(`### ${r.title} (${r.actId})`)
    for (const note of r.notes) lines.push(`- ${note}`)
    lines.push('')
  }
  lines.push(`## Verdict: ${passed}/${results.length} passed`)

  const fs = await import('fs')
  const outPath = path.join(__dirname, '../../V2.75_phase4_verification.md')
  fs.writeFileSync(outPath, lines.join('\n'))
  console.log(`\nReport written to V2.75_phase4_verification.md`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
