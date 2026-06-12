import { fetchTaxTribunalDecision } from './sources/tax-tribunals'
async function main() {
  for (const id of [3849, 13037, 1]) {
    const d = await fetchTaxTribunalDecision(id)
    console.log(JSON.stringify(d))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
