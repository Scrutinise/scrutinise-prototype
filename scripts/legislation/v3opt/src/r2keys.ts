export type ManifestVersion = 'revised-current' | 'made'

export interface R2KeyResult {
  key: string
  field: 'tnaXmlKey' | 'originalXmlKey'
}

export function getR2KeyForSection(
  actId: string,
  sectionNumber: string,
  version: ManifestVersion,
): R2KeyResult {
  if (version === 'revised-current') {
    return { key: `${actId}/sections/${sectionNumber}.tna.xml`, field: 'tnaXmlKey' }
  }
  return { key: `${actId}/sections/${sectionNumber}.original.xml`, field: 'originalXmlKey' }
}

export function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}
