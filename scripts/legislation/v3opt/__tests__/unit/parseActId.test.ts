import { describe, it, expect } from 'vitest'
import { parseActId, IsbnDraftError } from '../../src/parseActId'

describe('parseActId', () => {
  it('parses a normal UKSI actId', () => {
    expect(parseActId('uksi/2021/100')).toEqual({ yearStr: '2021', yearInt: 2021, num: 100 })
  })

  it('parses year 1990', () => {
    const r = parseActId('uksi/1990/500')
    expect(r.yearInt).toBe(1990)
    expect(r.yearStr).toBe('1990')
    expect(r.num).toBe(500)
  })

  it('accepts num at Int32 max (2147483647)', () => {
    expect(() => parseActId('uksi/2021/2147483647')).not.toThrow()
    expect(parseActId('uksi/2021/2147483647').num).toBe(2147483647)
  })

  it('throws IsbnDraftError for num one above Int32 max', () => {
    expect(() => parseActId('uksi/2021/2147483648')).toThrow(IsbnDraftError)
  })

  it('throws IsbnDraftError for 13-digit ISBN numbers', () => {
    expect(() => parseActId('uksi/2021/9781234567890')).toThrow(IsbnDraftError)
  })

  it('IsbnDraftError is an Error instance', () => {
    try { parseActId('uksi/2021/9780000000000') }
    catch (e) { expect(e).toBeInstanceOf(Error) }
  })

  it('throws generic Error for non-numeric year', () => {
    expect(() => parseActId('uksi/notanumber/1')).toThrow(Error)
  })

  it('throws for missing segments', () => {
    expect(() => parseActId('uksi/2021')).toThrow()
    expect(() => parseActId('bad')).toThrow()
  })
})
