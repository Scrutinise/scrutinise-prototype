/**
 * V.3-B — UKSI manifest builder (TypeScript wrapper around build-manifest-uksi.ps1).
 * Generates manifest-uksi.json from the Best Collection bulk ZIP.
 *
 * Usage: npx ts-node --transpile-only build-manifest-uksi.ts [--zip <path>] [--out <path>]
 *
 * Output format (matches manifest-ukpga.json schema):
 *   { actId, zipPath, compressedSize, uncompressedSize, version }
 *   version: "revised-current" | "made"
 */
import * as fs from 'fs'
import * as path from 'path'
import { spawnSync } from 'child_process'

const DIR     = __dirname
const ZIP_DEFAULT = path.join(DIR, '../v276-bulk/best-collection-xml.zip')
const OUT_DEFAULT = path.join(DIR, 'manifest-uksi.json')

function parseArgs(): { zipPath: string; outPath: string } {
  const args = process.argv.slice(2)
  const zipIdx = args.indexOf('--zip')
  const outIdx = args.indexOf('--out')
  return {
    zipPath: zipIdx >= 0 ? args[zipIdx + 1] : ZIP_DEFAULT,
    outPath: outIdx >= 0 ? args[outIdx + 1] : OUT_DEFAULT,
  }
}

function main() {
  const { zipPath, outPath } = parseArgs()

  if (!fs.existsSync(zipPath)) {
    console.error(`ZIP not found: ${zipPath}`)
    process.exit(1)
  }

  const ps1 = path.join(DIR, 'build-manifest-uksi.ps1')
  console.log(`Running PowerShell manifest builder...`)

  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-File', ps1,
     '-ZipPath', zipPath, '-OutPath', outPath],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 300_000 }
  )

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    console.error(`PowerShell failed with exit code ${result.status}`)
    process.exit(1)
  }

  // Verify and print summary
  const manifest: Array<{ actId: string; version: string }> = JSON.parse(
    fs.readFileSync(outPath, 'utf-8')
  )
  const revised = manifest.filter(m => m.version === 'revised-current').length
  const made    = manifest.filter(m => m.version === 'made').length

  console.log(`\n=== manifest-uksi.json ===`)
  console.log(`Total UKSI entries: ${manifest.length}`)
  console.log(`  revised-current:  ${revised} (${(revised / manifest.length * 100).toFixed(1)}%)`)
  console.log(`  made (enacted):   ${made}    (${(made / manifest.length * 100).toFixed(1)}%)`)
  console.log(`Saved: ${outPath}`)
}

main()
