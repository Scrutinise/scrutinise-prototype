import path from "path"
try { require("dotenv").config({ path: path.join(__dirname, "../../scrutinise-web/.env") }) } catch {}
import { discoverForCorpus } from "./shared/discovery"
import { bulkUpsertQueueRows, disconnectQueue } from "./shared/queue-client"
async function main() {
  const rows = await discoverForCorpus("tna-caselaw")
  console.log(`tna-caselaw: discovered ${rows.length} new pages`)
  if (rows.length > 0) {
    const inserted = await bulkUpsertQueueRows(rows)
    console.log(`inserted ${inserted} rows: ${rows.slice(0, 5).map(r => r.docId).join(", ")}${rows.length > 5 ? " …" : ""}`)
  }
  await disconnectQueue()
}
main().catch(e => { console.error(e); process.exit(1) })
