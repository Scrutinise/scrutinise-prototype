# v32-retry-misses.ps1 — sweep the retryable §2 misses left by the main backfill.
#
# A `[retryable]` miss is a socket drop, which says NOTHING about whether Wayback holds a
# snapshot; a `[settled]` miss is a genuine absence. `--retry-misses` flips the resume filter to
# re-attempt only the former (v32-backfill-archive.ts:231-237).
#
# ⚠ BOUNDED ON PURPOSE. A retry that drops again is re-recorded as retryable, so this cannot use
# the main driver's "considered 0" break — a permanently unreachable document would loop forever.
# 225 outstanding at --max 25 is ~9 batches; 20 gives headroom for re-drops without spinning.
#
# ⚠ ITS OWN LOG. The main driver greps the WHOLE log for 'publications considered     0', and
# v32-backfill.log already contains that line from the completed run — reusing it would break the
# loop after batch 1 and look like a clean finish.

$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot
$log = Join-Path $PSScriptRoot 'v32-retry-misses.log'
$env:BACKFILL_CONCURRENCY = '2'

"[retry] started $([DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss')) UTC" | Out-File -FilePath $log -Append -Encoding utf8

for ($i = 1; $i -le 20; $i++) {
  & node .\node_modules\tsx\dist\cli.mjs v32-backfill-archive.ts --commit --retry-misses --max 25 *>> $log
  "[retry] batch $i done $([DateTime]::UtcNow.ToString('HH:mm:ss')) UTC" | Out-File -FilePath $log -Append -Encoding utf8
}

"[retry] SWEEP DONE $([DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss')) UTC" | Out-File -FilePath $log -Append -Encoding utf8
