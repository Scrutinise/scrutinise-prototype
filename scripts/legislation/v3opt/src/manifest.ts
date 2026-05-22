import * as fs from 'fs'
import type { ManifestVersion } from './r2keys'

export interface ManifestEntry {
  actId: string
  zipPath: string
  compressedSize: number
  uncompressedSize: number
  version: ManifestVersion
}

export function loadManifest(manifestPath: string): ManifestEntry[] {
  const raw = fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, '')
  return JSON.parse(raw) as ManifestEntry[]
}
