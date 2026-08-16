/**
 * probe-speech-markup.ts — the §2b sample said person_id is absent from every speech in the 1940s
 * through the 2000s. Whole decades reading exactly 0.0% is far more often a parser than a source,
 * so this dumps the actual <speech> tags per era before that number is reported anywhere.
 *
 * docs/CLAUDE.md §13: do not form a hypothesis about a parse result before inspecting the bytes.
 */
import { fetchPwdataFile } from '../sources/twfy-pwdata'
export {}

const SAMPLES = [
  'debates1995-06-14a', 'debates2001-06-20a', 'debates2005-03-15a', 'debates2008-11-12a',
  'debates2012-06-13a', 'debates2015-06-02b', 'debates2019-10-30a', 'debates2024-07-17b',
  'debates1985-03-04a', 'debates1975-05-06a',
]

async function main() {
  for (const id of SAMPLES) {
    let xml: string | null = null
    try { xml = await fetchPwdataFile('pwdata-debates', id) } catch (e) { console.log(`${id}  FETCH FAILED ${(e as Error).message}`); continue }
    if (!xml) { console.log(`${id}  404 / absent`); continue }
    const tags = xml.match(/<speech\b[^>]*>/g) ?? []
    const attrs = new Map<string, number>()
    for (const t of tags) for (const m of t.matchAll(/\s([a-zA-Z_:-]+)="/g)) attrs.set(m[1], (attrs.get(m[1]) ?? 0) + 1)
    console.log(`\n${id}  ${xml.length} bytes, ${tags.length} <speech>`)
    console.log(`   attributes: ${[...attrs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ')}`)
    // ⚠ member/N and person/N are DIFFERENT ID SPACES — a person holds many memberships — so the
    // value shape matters as much as the attribute name.
    for (const a of ['speakerid', 'person_id']) {
      const vals = [...xml.matchAll(new RegExp(`${a}="([^"]*)"`, 'g'))].map((m) => m[1])
      if (!vals.length) continue
      const shapes = new Map<string, number>()
      for (const v of vals) shapes.set(v.replace(/\d+$/, 'N'), (shapes.get(v.replace(/\d+$/, 'N')) ?? 0) + 1)
      console.log(`   ${a} value shapes: ${[...shapes].map(([k, v]) => `${k} ×${v}`).join(', ')}`)
    }
    for (const t of tags.slice(0, 2)) console.log(`   eg ${t.slice(0, 250)}`)
  }
}
main().catch((e) => { console.error('FATAL', e instanceof Error ? e.message : e); process.exit(1) })
