<#
  V.3-B — Build UKSI manifest from Best Collection bulk ZIP.
  Enumerates all uksi-* entries in the ZIP and outputs manifest-uksi.json
  with the same schema as manifest-ukpga.json:
    { actId, zipPath, compressedSize, uncompressedSize, version }

  Usage:
    powershell -File build-manifest-uksi.ps1 [-ZipPath <path>] [-OutPath <path>]
#>
param(
    [string]$ZipPath = (Join-Path $PSScriptRoot '..\v276-bulk\best-collection-xml.zip'),
    [string]$OutPath = (Join-Path $PSScriptRoot 'manifest-uksi.json')
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path $ZipPath)) {
    Write-Error "ZIP not found: $ZipPath"
    exit 1
}

Write-Host "Opening ZIP: $ZipPath"
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

$results = [System.Collections.Generic.List[object]]::new()
$processed = 0
$skipped   = 0

foreach ($entry in $zip.Entries) {
    # Match: {year}/uksi-{year}-{num}-{version}-data.xml
    if ($entry.FullName -notmatch '^([0-9]+)/uksi-([0-9]+)-([0-9]+)-([a-z]+)-data\.xml$') {
        continue
    }
    if ($entry.Length -eq 0) { $skipped++; continue }

    $yearDir  = $Matches[1]
    $yearSeg  = $Matches[2]
    $numSeg   = $Matches[3]
    $verFlag  = $Matches[4]  # "made" or "revised"

    $actId  = "uksi/$yearSeg/$numSeg"
    $version = if ($verFlag -eq 'revised') { 'revised-current' } else { 'made' }

    $results.Add([PSCustomObject]@{
        actId            = $actId
        zipPath          = $entry.FullName
        compressedSize   = $entry.CompressedLength
        uncompressedSize = $entry.Length
        version          = $version
    })

    $processed++
    if ($processed % 5000 -eq 0) {
        Write-Host "  Processed $processed entries..."
    }
}

$zip.Dispose()

Write-Host "Done. Processed=$processed, Skipped(zero-size)=$skipped"

$json = $results | ConvertTo-Json -Depth 2 -Compress:$false
[System.IO.File]::WriteAllText($OutPath, $json, [System.Text.Encoding]::UTF8)
Write-Host "Saved: $OutPath ($($results.Count) UKSI entries)"
