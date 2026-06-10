import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { discoverForCorpus } from "./shared/discovery"
import { bulkUpsertQueueRows, disconnectQueue } from "./shared/queue-client"

async function main() {
  let total = 0
  for (const corpus of ["si-2010plus", "primary-acts-2000plus", "regional"]) {
    try {
      const rows = await discoverForCorpus(corpus)
      if (rows.length > 0) {
        const inserted = await bulkUpsertQueueRows(rows)
        console.log(`${corpus}: discovered ${rows.length}, inserted ${inserted}`)
        total += inserted
      } else {
        console.log(`${corpus}: nothing new`)
      }
    } catch (e) { console.error(`${corpus}: discovery error`, e) }
  }
  console.log(`TOTAL inserted: ${total}`)
  await disconnectQueue()
}
main().catch(e => { console.error(e); process.exit(1) })
