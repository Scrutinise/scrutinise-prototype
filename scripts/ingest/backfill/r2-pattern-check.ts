// Diagnostic: list first 20 R2 keys under each corpus prefix to confirm patterns
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { r2List } from '../shared/r2-client'

async function samplePrefix(prefix: string, n = 15) {
  const keys = await r2List(prefix)
  console.log(`\n=== ${prefix} — ${keys.length} keys total ===`)
  for (const k of keys.slice(0, n)) console.log(' ', k)
  if (keys.length > n) console.log(`  ... and ${keys.length - n} more`)
  return keys.length
}

async function run() {
  const counts = await Promise.all([
    samplePrefix('hansard/'),
    samplePrefix('fca-regulators/'),
    samplePrefix('echr-hudoc/'),
    samplePrefix('fca/'),
    samplePrefix('echr/'),
    samplePrefix('hudoc/'),
  ])
  console.log('\n=== SUMMARY ===')
  const prefixes = ['hansard/', 'fca-regulators/', 'echr-hudoc/', 'fca/', 'echr/', 'hudoc/']
  prefixes.forEach((p, i) => console.log(`${p}: ${counts[i]} keys`))
}

run().catch(e => { console.error(e); process.exit(1) })
