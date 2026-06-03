// Find what's actually in R2 by sampling known corpus prefixes
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { r2List } from '../shared/r2-client'

async function countPrefix(prefix: string): Promise<number> {
  // Don't list all keys — just get first 5 to confirm pattern, then estimate
  const sample: string[] = []
  const { getClient, getBucket } = require('../shared/r2-client') as {
    getClient?: never
    getBucket: () => string
  }
  // Use the exported r2List but stop early by checking count
  const keys = await r2List(prefix)
  if (keys.length > 0) {
    console.log(`  ${prefix}: ${keys.length} keys`)
    for (const k of keys.slice(0, 3)) console.log(`    ${k}`)
  } else {
    console.log(`  ${prefix}: 0 keys`)
  }
  return keys.length
}

async function run() {
  console.log('Checking R2 corpus prefixes...')
  const prefixes = [
    'si-pre-2010/', 'si-2010plus/', 'primary-acts-2000plus/', 'primary-acts-pre-2000/',
    'regional/', 'retained-eu/', 'tna-caselaw/', 'caselaw/',
    'hansard/', 'fca-regulators/', 'echr-hudoc/',
    'hmrc-codes-guidance/', 'hmrc-tiins/', 'oecd/', 'written-answers/', 'written-statements/',
    'ingest-checkpoint/', 'ingest-csv/',
  ]
  for (const p of prefixes) {
    await countPrefix(p)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
