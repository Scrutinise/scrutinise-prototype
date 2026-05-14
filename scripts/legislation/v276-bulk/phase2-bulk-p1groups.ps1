<#
  V2.76-B Phase 2 — Count P1group elements for in-both acts directly from ZIP.
  Reads phase2-db-counts.json for actIds, manifest-ukpga.json for zipPaths.
  Outputs phase2-bulk-p1groups.json: { actId: p1groupCount }
#>

$here       = $PSScriptRoot
$zipPath    = Join-Path $here 'best-collection-xml.zip'
$manifestPath = Join-Path $here 'manifest-ukpga.json'
$dbCountsPath = Join-Path $here 'phase2-db-counts.json'
$outPath    = Join-Path $here 'phase2-bulk-p1groups.json'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$manifest   = Get-Content $manifestPath | ConvertFrom-Json
$dbCounts   = Get-Content $dbCountsPath | ConvertFrom-Json
$actIdSet   = [System.Collections.Generic.HashSet[string]]::new()
($dbCounts | Get-Member -MemberType NoteProperty).Name | ForEach-Object { $null = $actIdSet.Add($_) }

Write-Host "Acts to process from ZIP: $($actIdSet.Count)"

# Build zipPath lookup: actId → zipPath
$zipPathMap = @{}
foreach ($entry in $manifest) {
    if ($actIdSet.Contains($entry.actId)) {
        $zipPathMap[$entry.actId] = $entry.zipPath
    }
}

Write-Host "Mapped zipPaths: $($zipPathMap.Count)"

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$results = @{}
$processed = 0
$notFound  = 0

foreach ($actId in $actIdSet) {
    $zp = $zipPathMap[$actId]
    if (-not $zp) { $results[$actId] = -1; $notFound++; continue }

    $entry = $zip.GetEntry($zp)
    if (-not $entry) { $results[$actId] = -1; $notFound++; continue }

    $reader = [System.IO.StreamReader]::new($entry.Open())
    $xml = $reader.ReadToEnd()
    $reader.Dispose()

    # Count <P1group occurrences (each = one numbered section)
    $p1count = ([regex]::Matches($xml, '<P1group')).Count
    if ($p1count -eq 0) {
        # Fallback: count <P1 standalone tags (old enacted acts)
        $p1count = ([regex]::Matches($xml, '<P1\b')).Count
    }
    $results[$actId] = $p1count

    $processed++
    if ($processed % 200 -eq 0) {
        Write-Host "  Processed $processed / $($actIdSet.Count)..."
    }
}

$zip.Dispose()

Write-Host "Done. Processed: $processed, Not found in ZIP: $notFound"
$results | ConvertTo-Json -Depth 1 | Set-Content $outPath -Encoding UTF8
Write-Host "Saved: $outPath"
