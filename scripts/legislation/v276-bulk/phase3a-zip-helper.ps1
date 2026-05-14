<#
  V2.76-B Phase 3A — ZIP P1group extractor helper.
  Reads a JSON request from stdin: { zipPath, entryPath, sectionNumbers }
  Writes a JSON array to stdout: [ { sectionNumber, xml }, ... ]
  sectionNumbers = [] means return ALL P1groups in the entry.
#>
Add-Type -AssemblyName System.IO.Compression.FileSystem

$raw = [Console]::In.ReadToEnd()
$req = $raw | ConvertFrom-Json

$zip   = [System.IO.Compression.ZipFile]::OpenRead($req.zipPath)
$entry = $zip.GetEntry($req.entryPath)

if (-not $entry) {
    $zip.Dispose()
    Write-Output '[]'
    exit 0
}

$reader = [System.IO.StreamReader]::new($entry.Open())
$xml    = $reader.ReadToEnd()
$reader.Dispose()
$zip.Dispose()

$wantAll = ($req.sectionNumbers.Count -eq 0)
$wantSet = [System.Collections.Generic.HashSet[string]]::new()
foreach ($s in $req.sectionNumbers) { $null = $wantSet.Add($s) }

$results = [System.Collections.Generic.List[object]]::new()
$p1regex  = [regex]::new('(?s)<P1group[^>]*>.*?</P1group>')
$pnRegex  = [regex]::new('(?s)<Pnumber[^>]*>(.*?)</Pnumber>')
$tagRegex = [regex]::new('<[^>]+>')

foreach ($m in $p1regex.Matches($xml)) {
    $pnMatch = $pnRegex.Match($m.Value)
    $pnum = ''
    if ($pnMatch.Success) {
        $pnum = $tagRegex.Replace($pnMatch.Groups[1].Value, '').Trim()
    }
    if ($wantAll -or $wantSet.Contains($pnum)) {
        $results.Add([PSCustomObject]@{ sectionNumber = $pnum; xml = $m.Value })
    }
}

$results | ConvertTo-Json -Depth 1 -Compress
