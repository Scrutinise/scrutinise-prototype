import { XMLParser } from 'fast-xml-parser'

export interface ParsedSection {
  sectionNumber: string
  xml: string
}

export interface ParseResult {
  title: string
  sections: ParsedSection[]
}

// parseTagValue: false — keep all tag content as strings; prevents "3." being parsed as number 3
const pnParser = new XMLParser({ ignoreAttributes: true, parseTagValue: false })

export function parseItem(xmlStr: string): ParseResult {
  return {
    title: extractTitle(xmlStr),
    sections: extractSections(xmlStr),
  }
}

export function extractTitle(xmlStr: string): string {
  const dcMatch = xmlStr.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)
  if (dcMatch) return stripTags(dcMatch[1]).trim()
  const titleMatch = xmlStr.match(/<Title[^>]*>([\s\S]*?)<\/Title>/)
  if (titleMatch) return stripTags(titleMatch[1]).trim()
  return ''
}

export function extractSections(xmlStr: string): ParsedSection[] {
  const p1groupMatches = [...xmlStr.matchAll(/<P1group[\s\S]*?<\/P1group>/g)]
  if (p1groupMatches.length > 0) {
    return p1groupMatches.map(m => ({ sectionNumber: extractPnumber(m[0]), xml: m[0] }))
  }
  return [...xmlStr.matchAll(/<P1\b[\s\S]*?<\/P1>/g)].map(m => ({
    sectionNumber: extractPnumber(m[0]),
    xml: m[0],
  }))
}

function extractPnumber(sectionXml: string): string {
  const match = sectionXml.match(/<Pnumber[^>]*>([\s\S]*?)<\/Pnumber>/)
  if (!match) return ''
  try {
    const parsed = pnParser.parse(`<root>${match[0]}</root>`)
    const pnum = parsed?.root?.Pnumber
    if (pnum !== undefined && pnum !== null) return stripTags(String(pnum)).trim()
  } catch {}
  return stripTags(match[1]).trim()
}

function stripTags(str: string): string {
  return str.replace(/<[^>]+>/g, '')
}
