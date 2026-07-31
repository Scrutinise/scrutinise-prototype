// ONS Route A — Beta API (api.beta.ons.gov.uk/v1). Structured dataset/edition/
// version/dimension/observation. Good for Census, population, regional, wellbeing
// and some economic datasets — NOT the headline macro series (see ons-cdid.ts).
//
// Each dataset's latest version exposes a bulk CSV download (the "v4" CSV-W shape:
// value column, then a code/label column pair per dimension) — that's what this
// module ingests rather than paging the JSON /observations endpoint one row at a
// time, which would be thousands of HTTP calls for a single dataset.
import { politeFetch } from '../lib/fetch-utils'
import { parseCdidPeriod } from '../lib/period'

const API_ROOT = 'https://api.beta.ons.gov.uk/v1'

export interface OnsBetaDatasetSummary {
  id: string
  title: string
  description: string
  license?: string
  releaseFrequency?: string
  nextRelease?: string
  lastUpdated?: string
  latestVersionHref: string
}

export interface OnsBetaVersionMeta {
  datasetId: string
  edition: string
  versionId: string
  lastUpdated: string
  dimensionNames: string[] // e.g. ['time','geography','aggregate']
  csvDownloadUrl: string
  alerts: string[]
}

export async function listDatasets(limit = 50, offset = 0): Promise<OnsBetaDatasetSummary[]> {
  const res = await politeFetch(`${API_ROOT}/datasets?limit=${limit}&offset=${offset}`, { delayMs: 500 })
  if (!res.ok) throw new Error(`ONS Beta catalogue fetch failed: HTTP ${res.status}`)
  const json = await res.json()
  return (json.items ?? []).map((it: Record<string, unknown>) => {
    const links = it.links as Record<string, { href?: string; id?: string }>
    return {
      id: it.id as string,
      title: it.title as string,
      description: it.description as string,
      license: it.license as string | undefined,
      releaseFrequency: it.release_frequency as string | undefined,
      nextRelease: it.next_release as string | undefined,
      lastUpdated: it.last_updated as string | undefined,
      latestVersionHref: links?.latest_version?.href ?? '',
    }
  })
}

export async function getDataset(id: string): Promise<OnsBetaDatasetSummary> {
  const res = await politeFetch(`${API_ROOT}/datasets/${id}`, { delayMs: 500 })
  if (!res.ok) throw new Error(`ONS Beta dataset fetch failed for ${id}: HTTP ${res.status}`)
  const it = await res.json()
  const links = it.links as Record<string, { href?: string; id?: string }>
  return {
    id: it.id,
    title: it.title,
    description: it.description,
    license: it.license,
    releaseFrequency: it.release_frequency,
    nextRelease: it.next_release,
    lastUpdated: it.last_updated,
    latestVersionHref: links?.latest_version?.href ?? '',
  }
}

export async function getLatestVersionMeta(datasetId: string): Promise<OnsBetaVersionMeta> {
  const ds = await getDataset(datasetId)
  if (!ds.latestVersionHref) throw new Error(`No latest_version link for dataset ${datasetId}`)
  const res = await politeFetch(ds.latestVersionHref, { delayMs: 500 })
  if (!res.ok) throw new Error(`ONS Beta version fetch failed for ${datasetId}: HTTP ${res.status}`)
  const v = await res.json()
  const edition: string = v.edition
  const versionId: string = String(v.id)
  const csvUrl: string | undefined = v.downloads?.csv?.href
  if (!csvUrl) throw new Error(`Dataset ${datasetId} version ${versionId} has no CSV download`)
  const dims = (v.dimensions ?? []) as Array<{ name: string }>
  const alerts = ((v.alerts ?? []) as Array<{ description: string }>).map((a) => a.description)
  return {
    datasetId,
    edition,
    versionId,
    lastUpdated: v.last_updated,
    dimensionNames: dims.map((d) => d.name),
    csvDownloadUrl: csvUrl,
    alerts,
  }
}

export interface OnsBetaObservationRow {
  value: number
  dims: Record<string, { code: string; label: string }> // keyed by dimension name
}

/**
 * Parse the v4 CSV-W bulk download: header is `v4_0,<code1>,<label1>,<code2>,<label2>,...`
 * Column pairs are in the same order as the version's `dimensions` array.
 */
export function parseOnsBetaCsv(text: string, dimensionNames: string[]): OnsBetaObservationRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return []
  const rows: OnsBetaObservationRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    if (cols.length < 1 + dimensionNames.length * 2) continue
    const value = parseFloat(cols[0])
    if (Number.isNaN(value)) continue
    const dims: Record<string, { code: string; label: string }> = {}
    for (let d = 0; d < dimensionNames.length; d++) {
      const code = cols[1 + d * 2]
      const label = cols[2 + d * 2]
      dims[dimensionNames[d]] = { code, label }
    }
    rows.push({ value, dims })
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

/** Best-effort period parse for the 'time' dimension label ONS Beta datasets use (e.g. "Jan-26", "2025 Q1", "2025"). */
export function parseOnsBetaTimeLabel(label: string) {
  const direct = parseCdidPeriod(label)
  if (direct) return direct
  const m = label.trim().match(/^([A-Za-z]{3})-(\d{2})$/)
  if (m) {
    const monthIdx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].findIndex(
      (mo) => mo.toLowerCase() === m[1].toLowerCase(),
    )
    if (monthIdx === -1) return null
    const year = 2000 + parseInt(m[2], 10)
    return { periodType: 'MONTHLY' as const, periodStart: new Date(Date.UTC(year, monthIdx, 1)), periodLabel: label }
  }
  return null
}
