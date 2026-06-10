/** diag-v18-parse.ts — offline parsePwdataItems check on downloaded samples (no DB/R2) */
import fs from 'fs'
import path from 'path'
import { parsePwdataItems } from './sources/twfy-pwdata'

const dir = path.join(__dirname, '.v18-samples')
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.xml'))) {
  const raw = fs.readFileSync(path.join(dir, f))
  const head = raw.subarray(0, 200).toString('latin1')
  const latin = /encoding="(iso-?8859|latin|windows-1252)/i.test(head)
  const xml = raw.toString(latin ? 'latin1' : 'utf8')
  const items = parsePwdataItems(xml)
  const withSpeaker = items.filter(i => i.speaker).length
  const withHeading = items.filter(i => i.heading || i.minorHeading).length
  const withUrl = items.filter(i => i.url).length
  const avgChars = items.length ? Math.round(items.reduce((s, i) => s + i.text.length, 0) / items.length) : 0
  console.log(`${f.padEnd(28)} items=${String(items.length).padStart(4)}  speaker=${withSpeaker}  heading=${withHeading}  url=${withUrl}  avgChars=${avgChars}  enc=${latin ? 'latin1' : 'utf8'}`)
  if (items.length > 0) {
    const s = items[Math.floor(items.length / 2)]
    console.log(`   sample [${s.seq}] ${s.speaker ?? '(none)'} | ${(s.heading ?? '') + (s.minorHeading ? ' — ' + s.minorHeading : '')}`)
    console.log(`   ${s.text.slice(0, 160)}`)
  }
}
