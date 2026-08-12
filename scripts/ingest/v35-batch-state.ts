/** v35-batch-state.ts — ask the FAR END what our embed jobs are doing, rather than inferring from
 *  a quiet log. A Gemini Batch job is slow by design, so "no output for an hour" is indistinguishable
 *  from "hung" locally — and this project has already been burned four times by treating local
 *  silence as evidence about a remote process. */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { GoogleGenAI } from '@google/genai'
async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const out: any[] = []
  for await (const b of await ai.batches.list({ config: { pageSize: 30 } })) out.push(b)
  console.log(`${out.length} batch jobs known to the API (newest first)\n`)
  for (const b of out.slice(0, 14)) {
    console.log(`  ${String(b.state ?? '?').padEnd(22)} ${String(b.displayName ?? b.name ?? '').slice(0, 42).padEnd(42)} created ${b.createTime ?? '?'}`)
    if ((b as any).error) console.log(`      error: ${JSON.stringify((b as any).error).slice(0, 200)}`)
  }
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
