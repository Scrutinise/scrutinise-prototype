# v32-finish-backfill.ps1 — Windows driver for the §2 Wayback backfill.
#
# WHY A LOOP OF SHORT RUNS, not one long process. Measured 7 Aug 2026: the Wayback Machine never
# rate-limits this workload (no 429, no 503, ever). What fails is the PROCESS — after ~30-50
# requests Node's keep-alive pool goes stale and every fetch dies with `TypeError: fetch failed`,
# permanently. A fresh process fetching the same URLs succeeds immediately with no pacing. So the
# backfill exits cleanly at --max and this restarts it. Waiting longer cannot reopen a dead socket.
#
# Safe to stop at any point and safe to re-run: the backfill skips publications that already have
# `arc-` sections, and R2 is written before Neon so a kill never leaves a row pointing at a body
# that is not there.
#
# Usage (from scripts/ingest):
#     powershell -ExecutionPolicy Bypass -File v32-finish-backfill.ps1
# Watch it:   Get-Content .\v32-backfill.log -Tail 20 -Wait
# Stop it:    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
#                 Where-Object { $_.CommandLine -like '*v32-backfill*' } |
#                 ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot
$log = Join-Path $PSScriptRoot 'v32-backfill.log'
$env:BACKFILL_CONCURRENCY = '2'

"[driver] started $(Get-Date -Format u)" | Out-File -FilePath $log -Append -Encoding utf8

for ($i = 1; $i -le 400; $i++) {
  & node .\node_modules\tsx\dist\cli.mjs v32-backfill-archive.ts --commit --max 25 *>> $log
  if (Select-String -Path $log -Pattern 'publications considered     0' -Quiet -ErrorAction SilentlyContinue) {
    "[driver] all targets processed at batch $i" | Out-File -FilePath $log -Append -Encoding utf8
    break
  }
  "[driver] batch $i done $(Get-Date -Format HH:mm:ss)" | Out-File -FilePath $log -Append -Encoding utf8
}

@"
[driver] BACKFILL COMPLETE. The index work is NOT optional and is NOT done — run, in order:
   npx tsx v32-metadata-pass.ts --commit
   npx tsx search/fts-hygiene.ts audit --corpus=committees-reports
   npx tsx search/fts-hygiene.ts export --corpus=committees-reports
   npx tsx search/fts-hygiene.ts delete-orphans --corpus=committees-reports --apply
   npx tsx search/fts-catchup.ts --corpus=committees-reports
   npx tsx ../ops/heavy-job/run.ts run fts-index      # 19.8 GB peak - NEVER Railway (CLAUDE.md 17)
   # then redeploy fts-serve, or it keeps serving the pre-merge snapshot
   npx tsx v32-state-check.ts
   npx tsx v32-loop-test.ts
   npx tsx v32-acceptance-live.ts
"@ | Out-File -FilePath $log -Append -Encoding utf8
