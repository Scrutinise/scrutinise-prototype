/**
 * CENTRAL Stage 2e — extend the shipped upload template's "Valid values" sheet.
 *
 *   npx tsx scripts/patch-question-template.ts            (dry run)
 *   npx tsx scripts/patch-question-template.ts --apply
 *
 * Reads `docs/Central_Question_Upload_Template_CCh version.xlsx` — Charlie's
 * file, the one that opens in Excel with no repair prompt — and writes
 * `scrutinise-web/public/central-question-upload-template.xlsx` with the
 * Government departments added to the Topics column.
 *
 * ⚠ THIS IS NOT A GENERATOR AND MUST NOT BECOME ONE. Stage 2d shipped a
 *   SheetJS-*written* workbook and Excel offered to repair it, stripping the
 *   formatting, the example rows and the Context drop-down. So this edits the
 *   real file's XML in place — one worksheet part and the shared-string table —
 *   and copies every other zip entry through byte for byte. Nothing rewrites
 *   `styles.xml`, `theme1.xml`, sheet1, sheet2, or the `x14:dataValidation` in
 *   sheet2's `extLst` that IS the Context drop-down.
 *
 * ⚠ The drop-down's source range is `'Valid values'!$A$2:$A$9` — the eight
 *   contexts in column A. Column A is therefore never touched. Only column C
 *   (Topics) grows, and the footnote moves below the longest column.
 *
 * Run it again after replacing the source file; it is deterministic.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'

const APPLY = process.argv.includes('--apply')
const SRC = resolve(process.cwd(), '../docs/Central_Question_Upload_Template_CCh version.xlsx')
const OUT = resolve(process.cwd(), 'public/central-question-upload-template.xlsx')

/**
 * The 24 UK ministerial departments.
 *
 * Ministerial departments only — deliberately NOT the ~400 agencies, arm's
 * length bodies and non-ministerial departments, which would make the topic
 * list unusable as a drop-down. A Community admin can add any of those as an
 * ordinary topic if they turn out to be needed.
 */
export const GOVERNMENT_DEPARTMENTS = [
  'Attorney General’s Office',
  'Cabinet Office',
  'Department for Business and Trade',
  'Department for Culture, Media and Sport',
  'Department for Education',
  'Department for Energy Security and Net Zero',
  'Department for Environment, Food and Rural Affairs',
  'Department for Science, Innovation and Technology',
  'Department for Transport',
  'Department for Work and Pensions',
  'Department of Health and Social Care',
  'Foreign, Commonwealth and Development Office',
  'HM Treasury',
  'Home Office',
  'Ministry of Defence',
  'Ministry of Housing, Communities and Local Government',
  'Ministry of Justice',
  'Northern Ireland Office',
  'Office of the Advocate General for Scotland',
  'Office of the Leader of the House of Commons',
  'Office of the Leader of the House of Lords',
  'Scotland Office',
  'UK Export Finance',
  'Wales Office',
]

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function main() {
  if (!existsSync(SRC)) throw new Error(`Source template not found: ${SRC}`)
  const zip = await JSZip.loadAsync(readFileSync(SRC))

  // ── shared strings ─────────────────────────────────────────────────────────
  const ssPath = 'xl/sharedStrings.xml'
  let ss = await zip.file(ssPath)!.async('string')
  const existing = [...ss.matchAll(/<si>(?:<t[^>]*>([\s\S]*?)<\/t>)<\/si>/g)].map((m) => m[1])
  const indexOf = new Map(existing.map((v, i) => [v, i]))
  let uniqueCount = existing.length

  const newStrings: string[] = []
  function stringIndex(value: string): number {
    const key = esc(value)
    const hit = indexOf.get(key)
    if (hit !== undefined) return hit
    const idx = uniqueCount++
    indexOf.set(key, idx)
    newStrings.push(key)
    return idx
  }

  // ── read the current Valid values sheet ────────────────────────────────────
  const sheetPath = 'xl/worksheets/sheet3.xml'
  const sheet = await zip.file(sheetPath)!.async('string')

  const rowsXml = [...sheet.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
  const cellsByRef = new Map<string, { style: string; si: number }>()
  let footnoteRef = ''
  for (const [, , body] of rowsXml) {
    for (const m of body.matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="s")?>(?:<v>(\d+)<\/v>)?<\/c>/g)) {
      const [, ref, style, v] = m
      if (v === undefined) continue
      cellsByRef.set(ref, { style: style ?? '0', si: Number(v) })
      if (style === '10') footnoteRef = ref
    }
  }

  const colA: number[] = []
  const colB: number[] = []
  const colC: number[] = []
  for (let r = 1; r <= 60; r++) {
    const a = cellsByRef.get(`A${r}`)
    const b = cellsByRef.get(`B${r}`)
    const c = cellsByRef.get(`C${r}`)
    if (a && `A${r}` !== footnoteRef) colA.push(a.si)
    if (b) colB.push(b.si)
    if (c) colC.push(c.si)
  }

  const label = (si: number) => existing[si] ?? '(?)'
  const currentTopics = colC.slice(1).map(label)
  console.log(`source            : ${SRC}`)
  console.log(`contexts (col A)  : ${colA.length - 1} — untouched, the drop-down reads A2:A9`)
  console.log(`topics now        : ${currentTopics.length} — ${currentTopics.join(', ')}`)

  const toAdd = GOVERNMENT_DEPARTMENTS.filter(
    (d) => !currentTopics.some((t) => t.toLowerCase() === esc(d).toLowerCase()),
  )
  console.log(`departments to add: ${toAdd.length}`)
  if (!toAdd.length) console.log('  (nothing to do)')

  // ── rebuild sheetData ──────────────────────────────────────────────────────
  // Column A and B keep their rows exactly. Column C grows. The footnote moves
  // to the row after the longest column so it never lands mid-list.
  const topicSis = [...colC, ...toAdd.map((d) => stringIndex(d))]
  const bodyRows = Math.max(colA.length, colB.length, topicSis.length)
  const footnoteRow = bodyRows + 2

  const cell = (ref: string, style: string, si: number) =>
    `<c r="${ref}" s="${style}" t="s"><v>${si}</v></c>`

  const out: string[] = []
  for (let i = 0; i < bodyRows; i++) {
    const r = i + 1
    const style = i === 0 ? '8' : '9'
    const cells: string[] = []
    if (colA[i] !== undefined) cells.push(cell(`A${r}`, style, colA[i]))
    if (colB[i] !== undefined) cells.push(cell(`B${r}`, style, colB[i]))
    if (topicSis[i] !== undefined) cells.push(cell(`C${r}`, style, topicSis[i]))
    if (cells.length) out.push(`<row r="${r}" spans="1:3">${cells.join('')}</row>`)
  }
  if (footnoteRef) {
    const fn = cellsByRef.get(footnoteRef)!
    out.push(`<row r="${footnoteRow}" spans="1:3">${cell(`A${footnoteRow}`, '10', fn.si)}</row>`)
  }

  const newSheet = sheet
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:C${footnoteRow}"/>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${out.join('')}</sheetData>`)

  // ── append the new shared strings ──────────────────────────────────────────
  if (newStrings.length) {
    // `count` is the number of string CELLS in the workbook; `uniqueCount` is
    // the number of distinct strings. They are not the same number, and setting
    // both to the same value is exactly how a workbook starts asking Excel to
    // repair it. One new cell per new string here, so count grows by the same
    // amount.
    const cellCount =
      Number((ss.match(/ count="(\d+)"/) ?? [])[1] ?? uniqueCount) + newStrings.length
    ss = ss
      .replace(/ count="\d+"/, ` count="${cellCount}"`)
      .replace(/uniqueCount="\d+"/, `uniqueCount="${uniqueCount}"`)
      .replace('</sst>', newStrings.map((s) => `<si><t>${s}</t></si>`).join('') + '</sst>')
  }

  console.log(`topics after      : ${topicSis.length - 1}`)
  console.log(`footnote row      : ${footnoteRow}`)
  console.log(
    `drop-down kept    : ${
      (await zip.file('xl/worksheets/sheet2.xml')!.async('string')).includes('x14:dataValidation') ? 'YES' : 'NO'
    }`,
  )

  if (!APPLY) {
    console.log('\nDRY RUN — pass --apply to write', OUT)
    return
  }

  // Every other entry is copied through untouched. `zip.file(path, content)`
  // replaces in place and leaves the rest of the archive alone.
  // createFolders:false — JSZip otherwise adds `xl/` and `xl/worksheets/`
  // directory entries that are not in the original archive. Excel tolerates
  // them, but the entire point of this item is that Excel never offers to
  // repair the file, so the archive stays byte-for-byte what it was.
  zip.file(sheetPath, newSheet, { createFolders: false })
  zip.file(ssPath, ss, { createFolders: false })
  writeFileSync(
    OUT,
    await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  )
  console.log(`\nwrote ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
