import { listSentencingCouncilGuidelines } from './sources/gov-scraper'
async function main() {
  let n = 0
  for await (const doc of listSentencingCouncilGuidelines()) n++
  console.log('sentencing-council live universe:', n)
}
main().catch(e => { console.error(e); process.exit(1) })
