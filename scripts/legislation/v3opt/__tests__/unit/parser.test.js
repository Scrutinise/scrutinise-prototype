"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const parser_1 = require("../../src/parser");
// ── Fixtures ──────────────────────────────────────────────────────────────────
const SIMPLE_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>The Test Regulations 2021</dc:title></ukm:Metadata>
  <Body>
    <P1group><Pnumber>1</Pnumber><P1><Text>Citation</Text></P1></P1group>
    <P1group><Pnumber>2</Pnumber><P1><Text>Interpretation</Text></P1></P1group>
  </Body>
</Legislation>`;
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
</Legislation>`;
const BARE_P1_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Simple SI 2020</dc:title></ukm:Metadata>
  <Body>
    <P1><Pnumber>1</Pnumber><Text>Only article</Text></P1>
    <P1><Pnumber>2</Pnumber><Text>Second article</Text></P1>
  </Body>
</Legislation>`;
const ZERO_SECTION_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Commencement Order 2021</dc:title></ukm:Metadata>
  <Body/>
</Legislation>`;
const TITLE_FALLBACK_SI = `<?xml version="1.0"?>
<Legislation>
  <Title>Fallback Title 2019</Title>
  <Body>
    <P1group><Pnumber>1</Pnumber><P1><Text>Art 1</Text></P1></P1group>
  </Body>
</Legislation>`;
const TAGGED_TITLE_SI = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Title with <Emphasis>markup</Emphasis> inside</dc:title></ukm:Metadata>
  <Body/>
</Legislation>`;
const PNUMBER_TRAILING_DOT = `<?xml version="1.0"?>
<Legislation>
  <ukm:Metadata><dc:title>Dot SI 2021</dc:title></ukm:Metadata>
  <Body>
    <P1group><Pnumber>3.</Pnumber><P1><Text>Text</Text></P1></P1group>
  </Body>
</Legislation>`;
// ── extractTitle ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)('extractTitle', () => {
    (0, vitest_1.it)('extracts dc:title', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)(SIMPLE_SI)).toBe('The Test Regulations 2021');
    });
    (0, vitest_1.it)('falls back to Title element when no dc:title', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)(TITLE_FALLBACK_SI)).toBe('Fallback Title 2019');
    });
    (0, vitest_1.it)('strips XML tags from title', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)(TAGGED_TITLE_SI)).toBe('Title with markup inside');
    });
    (0, vitest_1.it)('returns empty string when no title element exists', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)('<Legislation><Body/></Legislation>')).toBe('');
    });
    (0, vitest_1.it)('preserves curly Unicode quotes in title', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)(UNICODE_SI)).toContain('“');
        (0, vitest_1.expect)((0, parser_1.extractTitle)(UNICODE_SI)).toContain('”');
    });
    (0, vitest_1.it)('preserves em-dash in title', () => {
        (0, vitest_1.expect)((0, parser_1.extractTitle)(UNICODE_SI)).toContain('—');
    });
});
// ── extractSections ──────────────────────────────────────────────────────────
(0, vitest_1.describe)('extractSections', () => {
    (0, vitest_1.it)('extracts P1group sections', () => {
        const secs = (0, parser_1.extractSections)(SIMPLE_SI);
        (0, vitest_1.expect)(secs).toHaveLength(2);
        (0, vitest_1.expect)(secs[0].sectionNumber).toBe('1');
        (0, vitest_1.expect)(secs[1].sectionNumber).toBe('2');
    });
    (0, vitest_1.it)('falls back to bare P1 when no P1groups found', () => {
        const secs = (0, parser_1.extractSections)(BARE_P1_SI);
        (0, vitest_1.expect)(secs).toHaveLength(2);
        (0, vitest_1.expect)(secs[0].sectionNumber).toBe('1');
    });
    (0, vitest_1.it)('returns empty array for zero-section document', () => {
        (0, vitest_1.expect)((0, parser_1.extractSections)(ZERO_SECTION_SI)).toHaveLength(0);
    });
    (0, vitest_1.it)('section.xml contains the full P1group element', () => {
        const secs = (0, parser_1.extractSections)(SIMPLE_SI);
        (0, vitest_1.expect)(secs[0].xml).toMatch(/^<P1group>/);
        (0, vitest_1.expect)(secs[0].xml).toMatch(/<\/P1group>$/);
    });
    (0, vitest_1.it)('Pnumber with trailing dot is preserved in raw sectionNumber', () => {
        // extractSections returns raw sectionNumber; dedup normalisation happens in worker
        const secs = (0, parser_1.extractSections)(PNUMBER_TRAILING_DOT);
        (0, vitest_1.expect)(secs[0].sectionNumber).toBe('3.');
    });
    (0, vitest_1.it)('preserves Unicode characters in section XML without corruption', () => {
        const secs = (0, parser_1.extractSections)(UNICODE_SI);
        (0, vitest_1.expect)(secs[0].xml).toContain('—'); // em-dash
        (0, vitest_1.expect)(secs[1].xml).toContain('£'); // £
        (0, vitest_1.expect)(secs[2].xml).toContain('é'); // é
        (0, vitest_1.expect)(secs[3].xml).toContain('§'); // §
        (0, vitest_1.expect)(secs[4].xml).toContain('€'); // €
    });
    (0, vitest_1.it)('adversarial: Unicode in all 5 adversarial categories present', () => {
        const secs = (0, parser_1.extractSections)(UNICODE_SI);
        (0, vitest_1.expect)(secs).toHaveLength(5);
        const xmlAll = secs.map(s => s.xml).join('');
        (0, vitest_1.expect)(xmlAll).toContain('—'); // em-dash
        (0, vitest_1.expect)(xmlAll).toContain('£'); // £
        (0, vitest_1.expect)(xmlAll).toContain('é'); // accented
        (0, vitest_1.expect)(xmlAll).toContain('§'); // §
        (0, vitest_1.expect)(xmlAll).toContain('€'); // €
    });
});
// ── parseItem ─────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('parseItem', () => {
    (0, vitest_1.it)('returns title and sections together', () => {
        const r = (0, parser_1.parseItem)(SIMPLE_SI);
        (0, vitest_1.expect)(r.title).toBe('The Test Regulations 2021');
        (0, vitest_1.expect)(r.sections).toHaveLength(2);
    });
    (0, vitest_1.it)('handles zero-section document gracefully', () => {
        const r = (0, parser_1.parseItem)(ZERO_SECTION_SI);
        (0, vitest_1.expect)(r.title).toBe('Commencement Order 2021');
        (0, vitest_1.expect)(r.sections).toHaveLength(0);
    });
});
