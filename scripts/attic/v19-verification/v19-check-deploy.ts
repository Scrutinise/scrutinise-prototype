import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}
async function main() {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}` },
    body: JSON.stringify({ query: `query { deployments(first: 3, input: { serviceId: "a7f4d75f-d844-4e1c-8edf-2569346b31c9" }) { edges { node { id status createdAt } } } }` }),
  })
  console.log(JSON.stringify(await res.json(), null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
