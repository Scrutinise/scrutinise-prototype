import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const API = 'https://backboard.railway.com/graphql/v2'

async function tryIt(label: string, headers: Record<string, string>, query: string) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const body = await res.json() as { data?: unknown; errors?: Array<{ message: string }> }
    console.log(`${label}: HTTP ${res.status} ${body.errors ? `errors=${body.errors.map((e) => e.message).join('; ')}` : 'OK'}`)
    if (body.data) console.log(`   ${JSON.stringify(body.data).slice(0, 300)}`)
  } catch (e) {
    console.log(`${label}: threw ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  const t = process.env.RAILWAY_API_TOKEN
  console.log(`token present: ${!!t}, length ${t?.length ?? 0}`)
  console.log(`RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID ?? '(unset)'}`)

  await tryIt('Project-Access-Token + projectToken', { 'Project-Access-Token': t! },
    '{ projectToken { projectId environmentId } }')
  await tryIt('Bearer + me', { Authorization: `Bearer ${t}` }, '{ me { id email } }')
  await tryIt('Project-Access-Token + me', { 'Project-Access-Token': t! }, '{ me { id email } }')
}

main()
