// ─────────────────────────────────────────────────────────────────────────────
// CCW-B17 — set LEX_VECTOR_STREAMS and LEX_QUERY_ROUTER on the Railway build-worker.
//
//   npx tsx --env-file=.env scripts/b17-set-worker-retrieval.ts            (report only)
//   npx tsx --env-file=.env scripts/b17-set-worker-retrieval.ts --write
//   npx tsx --env-file=.env scripts/b17-set-worker-retrieval.ts --revert   (stop-loss)
//
// ⚠ WHY NOT `sync-worker-retrieval.ts`. That script copies production's value off
// /api/health, and production (44f0fcb) does not yet serve `retrieval.vectorStreams` —
// so it refuses, correctly, and B17 says not to override it. This writes CCW's SPECIFIED
// values instead of a copied reading, which is a different act with a different warrant.
//
// ⚠ THE PREVIOUS VALUES ARE PRINTED AND WRITTEN TO A FILE BEFORE ANY CHANGE, so a revert
// is one command rather than a reconstruction (B17 step 1). Both variables are currently
// ABSENT, and "absent" is a value that has to be restored deliberately: setting a variable
// to the empty string is NOT the same as not having it, and only the second gives
// `LEX_VECTOR_STREAMS` its documented "dense is off" meaning without a stray-space trap.
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const T = process.env.RAILWAY_API_TOKEN
const WRITE = process.argv.includes('--write')
const REVERT = process.argv.includes('--revert')
const PROJECT = '68707c61-5c68-4f37-88fc-c301fd6b90e7'
const ENVIRONMENT = '991f733c-719c-4217-a6d6-1dbe80642bbe' // production
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'     // build-worker
const BACKUP = join(__dirname, '../.b17-worker-vars-before.json')

const TARGET: Record<string, string> = {
  LEX_VECTOR_STREAMS: 'legislation,debates,committees,caselaw',
  LEX_QUERY_ROUTER: '1',
}

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T! },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: any; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map(e => e.message).join('; '))
  return b.data ?? {}
}

const readVars = async (): Promise<Record<string, string>> =>
  (await gql(
    `query($p:String!,$e:String!,$s:String!){ variables(projectId:$p, environmentId:$e, serviceId:$s) }`,
    { p: PROJECT, e: ENVIRONMENT, s: SERVICE },
  )).variables ?? {}

async function main() {
  if (!T) { console.error('RAILWAY_API_TOKEN not set'); process.exit(1) }
  const before = await readVars()
  const show = (v: Record<string, string>) => Object.keys(TARGET)
    .map(k => `  ${k} = ${k in v ? JSON.stringify(v[k]) : 'ABSENT'}`).join('\n')

  console.log('build-worker, the two variables BEFORE:')
  console.log(show(before))

  if (!existsSync(BACKUP)) {
    // ⚠ Written once and never overwritten: a second run after the change would
    // otherwise record the NEW values as the thing to revert to.
    writeFileSync(BACKUP, JSON.stringify(
      Object.fromEntries(Object.keys(TARGET).map(k => [k, k in before ? before[k] : null])), null, 2))
    console.log(`\nprevious values recorded to ${BACKUP} (null = the variable was absent)`)
  } else {
    console.log(`\nprevious values already recorded in ${BACKUP}: ${readFileSync(BACKUP, 'utf8').replace(/\s+/g, ' ')}`)
  }

  if (!WRITE && !REVERT) { console.log('\nreport only — pass --write to set, --revert to restore.'); return }

  if (REVERT) {
    const saved = JSON.parse(readFileSync(BACKUP, 'utf8')) as Record<string, string | null>
    for (const [k, v] of Object.entries(saved)) {
      if (v === null) {
        await gql(`mutation($p:String!,$e:String!,$s:String!,$n:String!){ variableDelete(input:{projectId:$p, environmentId:$e, serviceId:$s, name:$n}) }`,
          { p: PROJECT, e: ENVIRONMENT, s: SERVICE, n: k })
        console.log(`  deleted ${k} (it was absent before)`)
      } else {
        await gql(`mutation($p:String!,$e:String!,$s:String!,$n:String!,$v:String!){ variableUpsert(input:{projectId:$p, environmentId:$e, serviceId:$s, name:$n, value:$v}) }`,
          { p: PROJECT, e: ENVIRONMENT, s: SERVICE, n: k, v })
        console.log(`  restored ${k} = ${JSON.stringify(v)}`)
      }
    }
  } else {
    for (const [k, v] of Object.entries(TARGET)) {
      await gql(`mutation($p:String!,$e:String!,$s:String!,$n:String!,$v:String!){ variableUpsert(input:{projectId:$p, environmentId:$e, serviceId:$s, name:$n, value:$v}) }`,
        { p: PROJECT, e: ENVIRONMENT, s: SERVICE, n: k, v })
      console.log(`  set ${k} = ${JSON.stringify(v)}`)
    }
  }

  // ⚠ READ BACK. A write whose effect is not re-read is an intention, not a change.
  const after = await readVars()
  console.log('\nAFTER, read back from Railway:')
  console.log(show(after))
  const ok = REVERT
    ? Object.entries(JSON.parse(readFileSync(BACKUP, 'utf8')) as Record<string, string | null>)
        .every(([k, v]) => (v === null ? !(k in after) : after[k] === v))
    : Object.entries(TARGET).every(([k, v]) => after[k] === v)
  console.log(ok ? '\n✔ read-back matches what was written.' : '\n⚠⚠ READ-BACK DOES NOT MATCH — do not proceed.')
  if (!ok) process.exit(1)
  console.log('\n⚠ Railway redeploys the service on a variable change. The new value only')
  console.log('  reaches a build once the worker has restarted — confirm from its startup')
  console.log('  banner ([config] … fully-configured) before enqueuing anything.')
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
