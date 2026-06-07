import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getAllHandbookModules } from './sources/fca-handbook'
import { bulkUpsertQueueRows, disconnectQueue } from './shared/queue-client'

async function main() {
  console.log('[seed-fca-handbook] fetching module list from GetAllHandbook…')
  const modules = await getAllHandbookModules()
  console.log(`[seed-fca-handbook] ${modules.length} modules found`)

  const rows = modules.map(m => ({
    id:         `fca-handbook:${m.entityId}`,
    docId:      m.entityId,
    corpus:     'fca-handbook',
    sourceType: 'fca-handbook',
    priority:   2,
  }))

  await bulkUpsertQueueRows(rows)
  console.log(`[seed-fca-handbook] inserted/skipped ${rows.length} queue rows`)

  // Print summary
  for (const m of modules) {
    console.log(`  ${m.code} (${m.entityId}): ${m.chapterIds.length} chapters`)
  }

  await disconnectQueue()
}

main().catch(err => { console.error(err); process.exit(1) })
