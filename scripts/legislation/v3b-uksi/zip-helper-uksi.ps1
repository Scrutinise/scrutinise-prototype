<#
  V.3-B — UKSI ZIP P1group extractor with title extraction and P1 fallback.
  Fork of v276-bulk/phase3a-zip-helper.ps1 with three additions:
    1. Returns legislation title from <dc:title> in CLML metadata
    2. Falls back to bare <P1> elements if no <P1group> found (simple SIs)
    3. Returns { title, p1groups: [{sectionNumber, xml}] } object

  Reads a JSON request from stdin: { zipPath, entryPath }
  Writes a JSON object to stdout: { title, p1groups: [ { sectionNumber, xml }, ... ] }
#>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem

$raw = [Console]::In.ReadToEnd()
$req = $raw | ConvertFrom-Json

$zip   = [System.IO.Compression.ZipFile]::OpenRead($req.zipPath)
$entry = $zip.GetEntry($req.entryPath)

if (-not $entry) {
    $zip.Dispose()
    Write-Output '{"title":"","p1groups":[]}'
    exit 0
}

$reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
$xml    = $reader.ReadToEnd()
$reader.Dispose()
$zip.Dispose()

# ── Title extraction ──────────────────────────────────────────────────────────
# Try Dublin Core title first (standard CLML metadata location), then <Title> fallback
$title = ''
if ($xml -match '(?s)<dc:title[^>]*>(.*?)</dc:title>') {
    $title = $Matches[1]
} elseif ($xml -match '(?s)<Title[^>]*>(.*?)</Title>') {
    $title = $Matches[1]
}
# Strip any residual XML tags from title (markup sometimes present in dc:title)
$title = ([regex]'<[^>]+>').Replace($title, '').Trim()

# ── P1group extraction ────────────────────────────────────────────────────────
$p1groupRegex = [regex]::new('(?s)<P1group[^>]*>.*?</P1group>')
$p1bareRegex  = [regex]::new('(?s)<P1\b[^>]*>.*?</P1>')
$pnRegex      = [regex]::new('(?s)<Pnumber[^>]*>(.*?)</Pnumber>')
$tagRegex     = [regex]::new('<[^>]+>')

$p1groups = [System.Collections.Generic.List[object]]::new()

$p1Matches = $p1groupRegex.Matches($xml)

if ($p1Matches.Count -gt 0) {
    # Standard path: use <P1group> elements
    foreach ($m in $p1Matches) {
        $pnMatch = $pnRegex.Match($m.Value)
        $pnum = ''
        if ($pnMatch.Success) {
            $pnum = $tagRegex.Replace($pnMatch.Groups[1].Value, '').Trim()
        }
        $p1groups.Add([PSCustomObject]@{ sectionNumber = $pnum; xml = $m.Value })
    }
} else {
    # Fallback: try bare <P1> elements (simple SIs without P1group wrapper)
    foreach ($m in $p1bareRegex.Matches($xml)) {
        $pnMatch = $pnRegex.Match($m.Value)
        $pnum = ''
        if ($pnMatch.Success) {
            $pnum = $tagRegex.Replace($pnMatch.Groups[1].Value, '').Trim()
        }
        $p1groups.Add([PSCustomObject]@{ sectionNumber = $pnum; xml = $m.Value })
    }
}

$result = [PSCustomObject]@{ title = $title; p1groups = $p1groups }
$result | ConvertTo-Json -Depth 3 -Compress
