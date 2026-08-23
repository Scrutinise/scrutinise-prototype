/** peek-raw.ts — print R2 objects by key. Investigation aid for INGEST-LABELS §4. */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { r2Get } from '../shared/r2-client'

const N = (() => { const i = process.argv.indexOf('--chars'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 2500 })()
const keys = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--chars')

;(async () => {
  for (const k of keys) {
    const s = await r2Get(k)
    console.log(`\n===== ${k}  (${s ? s.length : 'NULL'} chars)`)
    console.log(s ? s.slice(0, N) : '(null)')
  }
})()
