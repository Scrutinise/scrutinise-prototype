import WordExtractor from 'word-extractor'
async function main() {
  const res = await fetch('https://financeandtax.decisions.tribunals.gov.uk/judgmentfiles/j3849/20636.doc', {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
  })
  console.log('HTTP', res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  const extractor = new WordExtractor()
  const doc = await extractor.extract(buf)
  const text = doc.getBody()
  console.log('extracted chars:', text.length)
  console.log(text.slice(0, 400))
}
main().catch(e => { console.error(e); process.exit(1) })
