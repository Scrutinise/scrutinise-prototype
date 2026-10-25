// THROWAWAY — list Gemini batch jobs and their states; cancel non-terminal orphans with --cancel
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { GoogleGenAI } from '@google/genai'

const TERMINAL = new Set(['JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'])
const DO_CANCEL = process.argv.includes('--cancel')

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const pager = await ai.batches.list({ config: { pageSize: 50 } })
  let n = 0
  const active: Array<{ name: string; display: string; state: string }> = []
  for await (const job of pager) {
    n++
    const j: any = job
    const line = `${j.state}  ${j.displayName ?? '?'}  ${j.name}  created=${j.createTime ?? '?'}`
    if (!TERMINAL.has(j.state ?? '')) { active.push({ name: j.name, display: j.displayName ?? '?', state: j.state }); console.log('ACTIVE →', line) }
    else if (n <= 15) console.log('        ', line)
    if (n >= 60) break
  }
  console.log(`\n${n} jobs seen; ${active.length} non-terminal`)
  if (DO_CANCEL && active.length) {
    for (const a of active) {
      try { await ai.batches.cancel({ name: a.name }); console.log('cancelled:', a.display, a.name) }
      catch (e) { console.log('cancel failed:', a.display, (e as Error).message?.slice(0, 150)) }
    }
  }
}
main().catch((e) => { console.error('list error:', (e as Error).message?.slice(0, 300)); process.exit(1) })
