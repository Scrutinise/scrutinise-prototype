/**
 * V.3-B — Version-aware R2 key selection for UKSI bulk ingest.
 * Determines the correct R2 key field and path based on the manifest version flag.
 *
 * "revised-current" → tnaXmlKey (TNA's revised current version)
 * "made"            → originalXmlKey (enacted/made version, the only version available)
 */
import { originalXmlKey, tnaXmlKey } from '../r2-client'

export type ManifestVersion = 'revised-current' | 'made'

export interface R2KeyResult {
  key: string
  field: 'tnaXmlKey' | 'originalXmlKey'
}

export function getR2KeyForSection(
  actId: string,
  sectionNumber: string,
  version: ManifestVersion
): R2KeyResult {
  if (version === 'revised-current') {
    return { key: tnaXmlKey(actId, sectionNumber), field: 'tnaXmlKey' }
  }
  return { key: originalXmlKey(actId, sectionNumber), field: 'originalXmlKey' }
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
