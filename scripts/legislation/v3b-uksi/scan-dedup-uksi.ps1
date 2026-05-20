<#
  V.3-B dedup sanity scan across all 61,179 UKSI in manifest-uksi.json.
  Single-pass ZIP read. No DB, no R2, no network.
  Output: scrutinise-docs/v3b_uksi_dedup_scan.md
#>
param()
Add-Type -AssemblyName System.IO.Compression.FileSystem

$DIR           = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO          = Resolve-Path (Join-Path $DIR '../../..')
$ZIP_PATH      = Join-Path $REPO 'scripts\legislation\v276-bulk\best-collection-xml.zip'
$MANIFEST_PATH = Join-Path $DIR 'manifest-uksi.json'
$REPORT_PATH   = Join-Path $REPO 'scrutinise-docs\v3b_uksi_dedup_scan.md'

Write-Host "Loading manifest..." -NoNewline
$manifestText = [System.IO.File]::ReadAllText($MANIFEST_PATH).TrimStart([char]0xFEFF)
$manifest     = $manifestText | ConvertFrom-Json
Write-Host " $($manifest.Count) entries"

$entryMap = @{}
foreach ($m in $manifest) { $entryMap[$m.zipPath] = @{ actId = $m.actId; version = $m.version } }

$p1gRegex = [regex]::new('(?s)<P1group[^>]*>.*?</P1group>')
$p1bRegex = [regex]::new('(?s)<P1\b[^>]*>.*?</P1>')
$pnRegex  = [regex]::new('(?s)<Pnumber[^>]*>(.*?)</Pnumber>')
$tagRegex = [regex]::new('<[^>]+>')

$total = 0; $readErrors = 0; $withRawDupes = 0; $noDupes = 0
$d12 = 0; $d310 = 0; $d1150 = 0; $d50p = 0
$samples          = [System.Collections.Generic.List[hashtable]]::new()
$slipThroughItems = [System.Collections.Generic.List[hashtable]]::new()
$slipThroughTotal = 0
$yearDupes        = @{}
$rcWithDupes = 0; $madeWithDupes = 0

$startTime = [DateTime]::UtcNow
Write-Host "Opening ZIP and scanning..."
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZIP_PATH)

foreach ($entry in $zip.Entries) {
    if (-not $entryMap.ContainsKey($entry.FullName)) { continue }
    $meta  = $entryMap[$entry.FullName]
    $actId = $meta.actId
    $ver   = $meta.version
    $total++
    if ($total % 5000 -eq 0) {
        $el = [Math]::Round(([DateTime]::UtcNow - $startTime).TotalSeconds)
        Write-Host "  $total / $($manifest.Count) elapsed ${el}s"
    }
    try {
        $reader = [System.IO.StreamReader]::new($entry.Open())
        $xml    = $reader.ReadToEnd()
        $reader.Dispose()

        $containers = $p1gRegex.Matches($xml)
        if ($containers.Count -eq 0) { $containers = $p1bRegex.Matches($xml) }

        $pnums = [System.Collections.Generic.List[string]]::new()
        foreach ($m in $containers) {
            $pnm = $pnRegex.Match($m.Value)
            if ($pnm.Success) {
                $raw = $tagRegex.Replace($pnm.Groups[1].Value, '').Trim()
                if ($raw) { $pnums.Add($raw) }
            }
        }

        # Raw-duplicate detection
        $rawSeen  = [System.Collections.Generic.HashSet[string]]::new()
        $rawDupes = [System.Collections.Generic.List[string]]::new()
        foreach ($p in $pnums) { if (-not $rawSeen.Add($p)) { $rawDupes.Add($p) } }
        $rawDupeCount = $rawDupes.Count

        # Slip-through: normalized-identical but raw-distinct
        $normMap   = @{}
        $slipCases = [System.Collections.Generic.List[hashtable]]::new()
        foreach ($p in $pnums) {
            $norm = $p.Trim().TrimEnd('.').ToLower()
            if ($normMap.ContainsKey($norm)) {
                if ($normMap[$norm] -ne $p) { $slipCases.Add(@{ v1 = $normMap[$norm]; v2 = $p; norm = $norm }) }
            } else { $normMap[$norm] = $p }
        }

        if ($rawDupeCount -gt 0) {
            $withRawDupes++
            if     ($rawDupeCount -le 2)  { $d12++   }
            elseif ($rawDupeCount -le 10) { $d310++  }
            elseif ($rawDupeCount -le 50) { $d1150++ }
            else                           { $d50p++  }
            if ($samples.Count -lt 5) {
                $uv = ($rawDupes | Select-Object -Unique | Select-Object -First 6) -join '; '
                $samples.Add(@{ actId = $actId; version = $ver; dupeCount = $rawDupeCount; dupeVals = $uv })
            }
            $yr = $actId.Split('/')[1]
            if (-not $yearDupes.ContainsKey($yr)) { $yearDupes[$yr] = 0 }
            $yearDupes[$yr]++
            if ($ver -eq 'revised-current') { $rcWithDupes++ } else { $madeWithDupes++ }
        } else { $noDupes++ }

        if ($slipCases.Count -gt 0) {
            $slipThroughTotal++
            if ($slipThroughItems.Count -lt 10) { $slipThroughItems.Add(@{ actId = $actId; cases = $slipCases }) }
        }
    } catch {
        $readErrors++
        Write-Host "  ERROR $actId : $_"
    }
}
$zip.Dispose()
$elapsed = [Math]::Round(([DateTime]::UtcNow - $startTime).TotalSeconds)
Write-Host "Scan complete in ${elapsed}s  Total=$total  WithDupes=$withRawDupes  SlipThrough=$slipThroughTotal  Errors=$readErrors"

# Build report line by line (avoids here-string/pipe parse issues)
$lines = [System.Collections.Generic.List[string]]::new()
$NL = [System.Environment]::NewLine

function Add-Line { param($l) $lines.Add($l) }

Add-Line "# V.3-B UKSI Dedup Sanity Scan"
Add-Line "**Date:** $(Get-Date -Format 'yyyy-MM-dd')"
Add-Line "**Scope:** All $($manifest.Count) entries in manifest-uksi.json"
Add-Line "**Elapsed:** ${elapsed}s"
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 1. Summary statistics"
Add-Line ""
Add-Line "| Metric | Count |"
Add-Line "|--------|-------|"
Add-Line "| Total UKSI scanned | $total |"
Add-Line "| Read errors | $readErrors |"
Add-Line "| UKSI with zero duplicate Pnumbers | $noDupes |"
Add-Line "| UKSI with 1+ duplicate Pnumber (raw) | $withRawDupes |"
Add-Line "| Slip-through items (normalized-identical, raw-distinct) | $slipThroughTotal |"
Add-Line ""
$dupeRate = [Math]::Round($withRawDupes / $total * 100, 2)
Add-Line "**Duplicate rate:** $dupeRate% of all UKSI have at least one duplicate P1group Pnumber."
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 2. Duplicate distribution"
Add-Line ""
Add-Line "| Bucket (duplicate Pnumber instances per UKSI) | Count of UKSI |"
Add-Line "|-----------------------------------------------|---------------|"
Add-Line "| 1-2 duplicate instances | $d12 |"
Add-Line "| 3-10 duplicate instances | $d310 |"
Add-Line "| 11-50 duplicate instances | $d1150 |"
Add-Line "| 50+ duplicate instances | $d50p |"
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 3. Sample duplicate patterns (first 5 items with duplicates)"
Add-Line ""
foreach ($s in $samples) {
    Add-Line "- **$($s.actId)** ($($s.version)) -- $($s.dupeCount) duplicate instance(s); Pnumbers: ``$($s.dupeVals)``"
}
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 4. Formatting variations check (slip-through risk)"
Add-Line ""
Add-Line "Slip-through definition: two Pnumber strings that are **raw-distinct** (current Set treats as different)"
Add-Line "but **normalized-identical** under: trim whitespace + strip trailing dots + lowercase."
Add-Line ""
if ($slipThroughTotal -eq 0) {
    Add-Line "**No slip-through cases found.** The current ``seenSectionNumbers`` Set (raw string comparison) is sufficient."
    Add-Line "No normalization step is required before Phase 3."
} else {
    Add-Line "**WARNING: $slipThroughTotal slip-through item(s) found.** Review before Phase 3."
    Add-Line ""
    foreach ($item in ($slipThroughItems | Select-Object -First 5)) {
        $caseParts = ($item.cases | Select-Object -First 3 | ForEach-Object { "``$($_.v1)`` vs ``$($_.v2)`` (norm: ``$($_.norm)``)" }) -join ';  '
        Add-Line "- **$($item.actId)**: $caseParts"
    }
}
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 5. Era clustering"
Add-Line ""
Add-Line "### By version"
Add-Line ""
Add-Line "| Version | UKSI with duplicates |"
Add-Line "|---------|----------------------|"
Add-Line "| revised-current | $rcWithDupes |"
Add-Line "| made (enacted) | $madeWithDupes |"
Add-Line ""
Add-Line "### Top 10 years by duplicate item count"
Add-Line ""
Add-Line "| Year | Items with duplicates |"
Add-Line "|------|----------------------|"
$yearTop = $yearDupes.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 10
foreach ($e in $yearTop) { Add-Line "| $($e.Key) | $($e.Value) |" }
Add-Line ""
Add-Line "### By decade"
Add-Line ""
Add-Line "| Decade | Items with duplicates |"
Add-Line "|--------|----------------------|"
$decadeDupes = @{}
foreach ($e in $yearDupes.GetEnumerator()) {
    $dec = [string]([Math]::Floor([int]$e.Key / 10) * 10) + 's'
    if (-not $decadeDupes.ContainsKey($dec)) { $decadeDupes[$dec] = 0 }
    $decadeDupes[$dec] += $e.Value
}
foreach ($e in ($decadeDupes.GetEnumerator() | Sort-Object -Property Key)) { Add-Line "| $($e.Key) | $($e.Value) |" }
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## 6. Recommendation"
Add-Line ""
if ($slipThroughTotal -eq 0) {
    Add-Line "**Proceed with Phase 3 as-is.** No formatting variations detected that would allow logical duplicates"
    Add-Line "to slip through the current Set (raw string comparison). The dedup fix in ``phase3-uksi-ingest.ts``"
    Add-Line "is sufficient for all $total UKSI in the corpus."
} else {
    Add-Line "**Normalization required before Phase 3.** $slipThroughTotal UKSI contain Pnumber values that are"
    Add-Line "raw-distinct but logically identical after normalization. Brief a small fix to ``phase3-uksi-ingest.ts``"
    Add-Line "before proceeding."
    Add-Line ""
    Add-Line "Suggested fix -- normalize before inserting into ``seenSectionNumbers``:"
    Add-Line '```typescript'
    Add-Line 'const normalized = sectionNumber.trim().replace(/\.+$/, "").toLowerCase()'
    Add-Line 'if (seenSectionNumbers.has(normalized)) continue'
    Add-Line 'seenSectionNumbers.add(normalized)'
    Add-Line '```'
}
Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "*Generated by ``scan-dedup-uksi.ps1``*"

$content = $lines -join $NL
[System.IO.File]::WriteAllText($REPORT_PATH, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Report written to: $REPORT_PATH"
