import type { ManifestEntry } from './manifest'

export function partition(entries: ManifestEntry[], n: number): ManifestEntry[][] {
  const parts: ManifestEntry[][] = Array.from({ length: n }, () => [])
  entries.forEach((entry, i) => parts[i % n].push(entry))
  return parts
}
