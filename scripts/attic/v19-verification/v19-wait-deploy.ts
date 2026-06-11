import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch {}
const CUTOFF = process.argv[2] // ISO time the push happened
async function check(): Promise<string | null> {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}` },
    body: JSON.stringify({ query: `query { deployments(first: 3, input: { serviceId: "a7f4d75f-d844-4e1c-8edf-2569346b31c9" }) { edges { node { id status createdAt } } } }` }),
  })
  const data = await res.json() as any
  for (const e of data.data?.deployments?.edges ?? []) {
    if (e.node.createdAt > CUTOFF && e.node.status === 'SUCCESS') return e.node.id
    if (e.node.createdAt > CUTOFF && ['FAILED', 'CRASHED'].includes(e.node.status)) throw new Error(`deploy ${e.node.id}: ${e.node.status}`)
  }
  return null
}
async function main() {
  for (let i = 0; i < 60; i++) {
    const id = await check()
    if (id) { console.log(`V19 deploy live: ${id}`); return }
    await new Promise(r => setTimeout(r, 20_000))
  }
  throw new Error('timed out waiting for post-push deployment')
}
main().catch(e => { console.error(e); process.exit(1) })
