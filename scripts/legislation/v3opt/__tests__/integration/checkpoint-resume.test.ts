import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'
import { loadWorkerCheckpoint, saveWorkerCheckpoint } from '../../src/checkpoint'
import { extractTitle, extractSections } from '../../src/parser'
import { parseActId, IsbnDraftError } from '../../src/parseActId'

// Explicit Unicode escapes so charset is unambiguous across all editors/terminals
const LQ = '“'  // " left double quote
const RQ = '”'  // " right double quote
const EM = '—'  // — em-dash
const GBP = '£' // £
const EACC = 'é'// é
const SEC = '§' // §

const TMP = path.join(__dirname, '../../tmp-test-checkpoints')

function mkTestZip(entries: Array<{ path: string; content: string }>): Buffer {
  const zip = new AdmZip()
  for (const e of entries) zip.addFile(e.path, Buffer.from(e.content, 'utf8'))
  return zip.toBuffer()
}

const CLML_UNICODE = [
  '<?xml version="1.0"?>',
  '<Legislation>',
  `  <ukm:Metadata><dc:title>The ${LQ}Smart${RQ} Regulations ${EM} 2021</dc:title></ukm:Metadata>`,
  '  <Body>',
  `    <P1group><Pnumber>1</Pnumber><P1><Text>${GBP}100 fine</Text></P1></P1group>`,
  `    <P1group><Pnumber>2</Pnumber><P1><Text>caf${EACC} ${EM} Paris</Text></P1></P1group>`,
  `    <P1group><Pnumber>3</Pnumber><P1><Text>${SEC} 3 applies</Text></P1></P1group>`,
  '  </Body>',
  '</Legislation>',
].join('\n')

// ── Checkpoint ────────────────────────────────────────────────────────────────

describe('checkpoint', () => {
  beforeEach(() => fs.mkdirSync(TMP, { recursive: true }))
  afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }))

  it('returns empty checkpoint when file does not exist', () => {
    const cp = loadWorkerCheckpoint(TMP, 99)
    expect(cp.completed).toEqual([])
    expect(cp.skipped).toEqual([])
    expect(cp.stats.created).toBe(0)
  })

  it('persists and reloads checkpoint data', () => {
    const cp = loadWorkerCheckpoint(TMP, 0)
    cp.completed.push('uksi/2021/1')
    cp.stats.created = 1
    cp.stats.sectionsCreated = 5
    saveWorkerCheckpoint(TMP, 0, cp)

    const loaded = loadWorkerCheckpoint(TMP, 0)
    expect(loaded.completed).toContain('uksi/2021/1')
    expect(loaded.stats.created).toBe(1)
    expect(loaded.stats.sectionsCreated).toBe(5)
  })

  it('workers use separate checkpoint files — no cross-contamination', () => {
    const cp0 = loadWorkerCheckpoint(TMP, 0)
    cp0.completed.push('uksi/2021/1')
    saveWorkerCheckpoint(TMP, 0, cp0)

    const cp1 = loadWorkerCheckpoint(TMP, 1)
    expect(cp1.completed).not.toContain('uksi/2021/1')
    expect(cp1.stats.created).toBe(0)
  })

  it('checkpoint resume: completed set prevents re-processing', () => {
    const cp = loadWorkerCheckpoint(TMP, 0)
    cp.completed.push('uksi/2021/1', 'uksi/2021/2')
    saveWorkerCheckpoint(TMP, 0, cp)

    const loaded = loadWorkerCheckpoint(TMP, 0)
    const doneSet = new Set([...loaded.completed, ...loaded.skipped])
    expect(doneSet.has('uksi/2021/1')).toBe(true)
    expect(doneSet.has('uksi/2021/3')).toBe(false)
  })
})

// ── adm-zip UTF-8 round-trip ──────────────────────────────────────────────────

describe('adm-zip UTF-8 round-trip', () => {
  it('getData().toString("utf8") preserves Unicode content', () => {
    const zip = new AdmZip(mkTestZip([{ path: 'test.xml', content: CLML_UNICODE }]))
    const entry = zip.getEntry('test.xml')
    expect(entry).toBeTruthy()
    const content = entry!.getData().toString('utf8')
    expect(content).toContain(LQ)    // “ left double quote
    expect(content).toContain(RQ)    // “ right double quote
    expect(content).toContain(EM)    // — em-dash
    expect(content).toContain(GBP)
    expect(content).toContain(EACC)
    expect(content).toContain(SEC)
  })

  it('parser extracts correct title and sections from ZIP-sourced XML', () => {
    const zip = new AdmZip(mkTestZip([{ path: 'uksi/2021/1/data.xml', content: CLML_UNICODE }]))
    const entry = zip.getEntry('uksi/2021/1/data.xml')!
    const xmlStr = entry.getData().toString('utf8')

    const title = extractTitle(xmlStr)
    expect(title).toBe(`The ${LQ}Smart${RQ} Regulations ${EM} 2021`)

    const sections = extractSections(xmlStr)
    expect(sections).toHaveLength(3)
    expect(sections[1].xml).toContain(`caf${EACC}`)
    expect(sections[2].xml).toContain(SEC)
  })

  it('multiple entries in ZIP are independently accessible', () => {
    const zip = new AdmZip(mkTestZip([
      { path: 'entry-a.xml', content: '<root>Alpha</root>' },
      { path: 'entry-b.xml', content: '<root>Beta</root>' },
    ]))
    expect(zip.getEntry('entry-a.xml')!.getData().toString('utf8')).toContain('Alpha')
    expect(zip.getEntry('entry-b.xml')!.getData().toString('utf8')).toContain('Beta')
  })

  it('non-existent entry returns null', () => {
    const zip = new AdmZip(mkTestZip([{ path: 'a.xml', content: '<x/>' }]))
    expect(zip.getEntry('missing.xml')).toBeNull()
  })
})

// ── parseActId + IsbnDraftError ───────────────────────────────────────────────

describe('parseActId in resume context', () => {
  it('ISBN draft identified correctly so checkpoint skips it on re-run', () => {
    expect(() => parseActId('uksi/2021/9780000000000')).toThrow(IsbnDraftError)
  })
})
