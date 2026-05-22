import { describe, it, expect } from 'vitest'
import { getR2KeyForSection, decodeEntities } from '../../src/r2keys'

describe('getR2KeyForSection', () => {
  it('revised-current uses tna.xml extension and tnaXmlKey field', () => {
    const r = getR2KeyForSection('uksi/2021/100', '3', 'revised-current')
    expect(r.key).toBe('uksi/2021/100/sections/3.tna.xml')
    expect(r.field).toBe('tnaXmlKey')
  })

  it('made uses original.xml extension and originalXmlKey field', () => {
    const r = getR2KeyForSection('uksi/2021/100', '3', 'made')
    expect(r.key).toBe('uksi/2021/100/sections/3.original.xml')
    expect(r.field).toBe('originalXmlKey')
  })

  it('handles alphanumeric section numbers', () => {
    const r = getR2KeyForSection('uksi/2015/399', '13E', 'made')
    expect(r.key).toBe('uksi/2015/399/sections/13E.original.xml')
  })

  it('actId with slashes is used verbatim in key path', () => {
    const r = getR2KeyForSection('uksi/1990/1234', '1', 'revised-current')
    expect(r.key).toContain('uksi/1990/1234/')
  })
})

describe('decodeEntities', () => {
  it('decodes &amp;', () => expect(decodeEntities('a &amp; b')).toBe('a & b'))
  it('decodes &lt; and &gt;', () => expect(decodeEntities('&lt;tag&gt;')).toBe('<tag>'))
  it('decodes &quot;', () => expect(decodeEntities('&quot;word&quot;')).toBe('"word"'))
  it('decodes &apos;', () => expect(decodeEntities('it&apos;s')).toBe("it's"))
  it('decodes decimal numeric entity (£ = &#163;)', () => expect(decodeEntities('&#163;')).toBe('£'))
  it('decodes hex numeric entity (£ = &#x00A3;)', () => expect(decodeEntities('&#x00A3;')).toBe('£'))
  it('decodes &#8220; (left double quote)', () => expect(decodeEntities('&#8220;')).toBe('“'))
  it('leaves plain ASCII unchanged', () => expect(decodeEntities('plain text 123')).toBe('plain text 123'))
  it('leaves existing Unicode unchanged', () => expect(decodeEntities('café')).toBe('café'))
})
