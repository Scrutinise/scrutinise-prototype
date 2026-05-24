import * as fs from 'fs'
import type { ManifestVersion } from './r2keys'

export interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: ManifestVersion
  /** LegislationType enum value name, e.g. 'UKSI', 'SSI', 'NISR'. Defaults to 'UKSI' if absent (back-compat with manifest-uksi.json). */
  legislationType?: string
  /** Jurisdiction string stored on LegislationItem, e.g. 'UK', 'Scotland', 'Wales', 'Northern Ireland'. Defaults to 'UK' if absent. */
  jurisdiction?: string
}

export function loadManifest(manifestPath: string): ManifestEntry[] {
  const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, '')
  return JSON.parse(raw) as ManifestEntry[]
}
