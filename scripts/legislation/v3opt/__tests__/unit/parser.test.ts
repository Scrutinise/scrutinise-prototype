import { describe, it, expect } from 'vitest'
import { parseItem, extractTitle, extractSections } from '../../src/parser'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SIMPLE_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>The Test Regulations 2021</dc:title></ukm:Metadata>
  <Body>
    <P1group><Pnumber>1</Pnumber><P1><Text>Citation</Text></P1></P1group>
    <P1group><Pnumber>2</Pnumber><P1><Text>Interpretation</Text></P1></P1group>
  </Body>
</Legislation>`

const UNICODE_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>The “Test” Regulations — 2021</dc:title></ukm:Metadata>
  <Body>
    <P1group><Pnumber>1</Pnumber><P1><Text>Em—dash</Text></P1></P1group>
    <P1group><Pnumber>2</Pnumber><P1><Text>Pound £ sign</Text></P1></P1group>
    <P1group><Pnumber>3</Pnumber><P1><Text>é ñ ø</Text></P1></P1group>
    <P1group><Pnumber>4</Pnumber><P1><Text>Section § symbol</Text></P1></P1group>
    <P1group><Pnumber>5</Pnumber><P1><Text>€ Euro</Text></P1></P1group>
  </Body>
</Legislation>`

const BARE_P1_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Simple SI 2020</dc:title></ukm:Metadata>
  <Body>
    <P1><Pnumber>1</Pnumber><Text>Only article</Text></P1>
    <P1><Pnumber>2</Pnumber><Text>Second article</Text></P1>
  </Body>
</Legislation>`

const ZERO_SECTION_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Commencement Order 2021</dc:title></ukm:Metadata>
  <Body/>
</Legislation>`

const TITLE_FALLBACK_SI = `<?xml version="1.0"?>
<Legislation>
  <Title>Fallback Title 2019</Title>
  <Body>
    <P1group><Pnumber>1</Pnumber><P1><Text>Art 1</Text></P1></P1group>
  </Body>
</Legislation>`

const TAGGED_TITLE_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Title with <Emphasis>markup</Emphasis> inside</dc:title></ukm:Metadata>
  <Body/>
</Legislation>`

const PNUMBER_TRAILING_DOT = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Dot SI 2021</dc:title></ukm:Metadata>
  <Body>
    <P1group><Pnumber>3.</Pnumber><P1><Text>Text</Text></P1></P1group>
  </Body>
</Legislation>`

// ── extractTitle ──────────────────────────────────────────────────────────────

describe('extractTitle', () => {
  it('extracts dc:title', () => {
    expect(extractTitle(SIMPLE_SI)).toBe('The Test Regulations 2021')
  })

  it('falls back to Title element when no dc:title', () => {
    expect(extractTitle(TITLE_FALLBACK_SI)).toBe('Fallback Title 2019')
  })

  it('strips XML tags from title', () => {
    expect(extractTitle(TAGGED_TITLE_SI)).toBe('Title with markup inside')
  })

  it('returns empty string when no title element exists', () => {
    expect(extractTitle('<Legislation><Body/></Legislation>')).toBe('')
  })

  it('preserves curly Unicode quotes in title', () => {
    expect(extractTitle(UNICODE_SI)).toContain('“')
    expect(extractTitle(UNICODE_SI)).toContain('”')
  })

  it('preserves em-dash in title', () => {
    expect(extractTitle(UNICODE_SI)).toContain('—')
  })
})

// ── extractSections ──────────────────────────────────────────────────────────

describe('extractSections', () => {
  it('extracts P1group sections', () => {
    const secs = extractSections(SIMPLE_SI)
    expect(secs).toHaveLength(2)
    expect(secs[0].sectionNumber).toBe('1')
    expect(secs[1].sectionNumber).toBe('2')
  })

  it('falls back to bare P1 when no P1groups found', () => {
    const secs = extractSections(BARE_P1_SI)
    expect(secs).toHaveLength(2)
    expect(secs[0].sectionNumber).toBe('1')
  })

  it('returns empty array for zero-section document', () => {
    expect(extractSections(ZERO_SECTION_SI)).toHaveLength(0)
  })

  it('section.xml contains the full P1group element', () => {
    const secs = extractSections(SIMPLE_SI)
    expect(secs[0].xml).toMatch(/^<P1group>/)
    expect(secs[0].xml).toMatch(/<\/P1group>$/)
  })

  it('Pnumber with trailing dot is preserved in raw sectionNumber', () => {
    // extractSections returns raw sectionNumber; dedup normalisation happens in worker
    const secs = extractSections(PNUMBER_TRAILING_DOT)
    expect(secs[0].sectionNumber).toBe('3.')
  })

  it('preserves Unicode characters in section XML without corruption', () => {
    const secs = extractSections(UNICODE_SI)
    expect(secs[0].xml).toContain('—')  // em-dash
    expect(secs[1].xml).toContain('£')  // £
    expect(secs[2].xml).toContain('é')  // é
    expect(secs[3].xml).toContain('§')  // §
    expect(secs[4].xml).toContain('€')  // €
  })

  it('adversarial: Unicode in all 5 adversarial categories present', () => {
    const secs = extractSections(UNICODE_SI)
    expect(secs).toHaveLength(5)
    const xmlAll = secs.map(s => s.xml).join('')
    expect(xmlAll).toContain('—')  // em-dash
    expect(xmlAll).toContain('£')  // £
    expect(xmlAll).toContain('é')  // accented
    expect(xmlAll).toContain('§')  // §
    expect(xmlAll).toContain('€')  // €
  })
})

// ── parseItem ─────────────────────────────────────────────────────────────────

describe('parseItem', () => {
  it('returns title and sections together', () => {
    const r = parseItem(SIMPLE_SI)
    expect(r.title).toBe('The Test Regulations 2021')
    expect(r.sections).toHaveLength(2)
  })

  it('handles zero-section document gracefully', () => {
    const r = parseItem(ZERO_SECTION_SI)
    expect(r.title).toBe('Commencement Order 2021')
    expect(r.sections).toHaveLength(0)
  })
})
