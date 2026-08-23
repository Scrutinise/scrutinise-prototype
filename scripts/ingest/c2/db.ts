/** db.ts — shared Neon connection for C2. READ-ONLY by default. */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'

export function pool() {
  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL
  if (!url) throw new Error('no NEON_DATABASE_URL')
  return new Pool({ connectionString: url, max: 4 })
}
export const OUT = path.join(__dirname, '../../../docs/census')
