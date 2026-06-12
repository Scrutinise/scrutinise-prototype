async function main() {
  const res = await fetch('https://www.judiciaryni.uk/judicial-decisions/2026-nica-29', { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' } })
  const html = await res.text()
  const links = [...html.matchAll(/href="([^"]+\.(?:pdf|docx?))"/gi)].map(m => m[1])
  console.log('file links:', JSON.stringify(links, null, 1))
  for (const l of links.slice(0, 2)) {
    const u = new URL(l, 'https://www.judiciaryni.uk').toString()
    const r2 = await fetch(u, { headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' } })
    const buf = r2.ok ? Buffer.from(await r2.arrayBuffer()) : null
    console.log(u.slice(0, 120), '→', r2.status, buf ? `${buf.length}B ${buf.slice(0,5).toString('ascii')}` : '')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
