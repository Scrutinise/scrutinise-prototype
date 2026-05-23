# CLAUDE.md additions — V.3-B retrospective

Two sections to add to `scrutinise-docs/CLAUDE.md`. Insert under the appropriate section heading (likely "Engineering practices" or "Diagnostic protocols" — CC to choose placement).

---

## §X — Parse failure diagnostic protocol

When ingest code or any tool reports a parse failure (JSON, XML, CSV, or any structured format), **do NOT form hypotheses about cause before inspecting the actual bytes**. The diagnostic path is:

1. **Dump the raw input** that the parser is rejecting to a file using Buffer-level capture (no encoding conversion at the capture point).
2. **Inspect the bytes** — first 200 bytes, last 200 bytes, hex + ASCII representation. Use `Get-Content -Encoding Byte` (PowerShell) or `xxd` (bash) or `[System.IO.File]::ReadAllBytes()` (PowerShell .NET).
3. **Attempt independent parse** — if Node JSON.parse fails, try PowerShell `ConvertFrom-Json`. If PowerShell fails, try Node. Different parsers reveal different things.
4. **If the independent parser also fails**, find the exact character offset of the failure. Most parsers report column or position. Inspect ±50 chars around it byte-by-byte.
5. **Only after seeing the actual contamination should hypotheses about cause be formed.**

### Common contamination patterns to look for

- Unescaped `"` or `\` inside string values (often caused by serialiser bugs or encoding round-trips)
- UTF-8 BOM (`ef bb bf` prefix) on files that shouldn't have one
- CLIXML headers when capturing PowerShell stderr/stdout in mixed-output mode
- Control characters (bytes 0x00-0x1F) embedded inside string values
- Curly Unicode quotes (`"` `"`, codepoints 8220/8221) where ASCII was expected, or vice versa
- Mojibake (UTF-8 bytes read as Windows-1252) — look for `Ã` or `â€` sequences
- Best-fit transcoding (curly quotes silently converted to ASCII straight quotes during stdout output)

### Retry logic policy

**Retry is appropriate for genuinely transient failures** (network timeouts, rate limiting, database lock contention). **Retry is NOT appropriate for parse failures.** A parse failure that recurs three times in identical form is deterministic — retrying it wastes time and obscures diagnosis. Ingest scripts should either succeed on first parse or fail loudly with full byte dump for diagnosis.

### Canonical example

See V.3-B Phase 3 sprint (`scrutinise-docs/v3b_phase3_report.md`) for the worked example of this protocol applied to a Windows PowerShell stdout encoding bug. The diagnostic took ~5 hours of debugging because the protocol was followed inconsistently — hypotheses were formed before bytes were inspected. Following the protocol from the start would have isolated the bug in 15-30 minutes.

### Spawned-process testing caveat

CC's test environment can differ from the production code path in subtle ways. Specifically: CC's tool sandbox may use UTF-8 as default stdout encoding while Charlie's Windows PowerShell terminal uses Windows-1252. **For any code that spawns external processes, verification must run in Charlie's actual terminal** — CC's test results for external-process invocations are advisory only.

---

## §Y — Windows PowerShell stdout encoding rule

Windows PowerShell (5.1 and 7+) defaults `[Console]::OutputEncoding` to the system code page — typically Windows-1252 on English-UK installs, OEM code pages on other locales. This means PowerShell scripts that emit non-ASCII characters via stdout will have those characters **silently best-fit mapped to ASCII equivalents** during the stdout write. Curly Unicode quotes (`"` codepoint 8220) become ASCII straight quotes (`"` codepoint 34). Em-dashes (`—`) become hyphens. Accented characters lose their accents.

This corruption is invisible — no error, no warning, no log entry. The downstream consumer (typically a Node process reading the PowerShell stdout) sees corrupted ASCII content and may produce silent data integrity failures, or visible parse failures when the corruption affects JSON-structural characters.

### Mandatory rule

**Every PowerShell script that emits content via stdout MUST set `[Console]::OutputEncoding` to UTF-8 as its first executable line:**

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

Place this line:
- After the header comment block (if present)
- Before any `Add-Type`, function definitions, or content reading
- Before any output statements (`Write-Output`, `Write-Host`, return values)

### Pilot validation requirement

Any ingest pipeline that processes non-ASCII content must include **adversarial test fixtures** in its pilot validation. These must include items containing:

- Curly Unicode quotes (`"` `"` `'` `'`)
- Em-dashes and en-dashes (`—` `–`)
- Accented characters (`é` `ñ` `ø`)
- Currency symbols (`£` `€` `¥`)
- Section symbols (`§`)
- Long content (>10,000 characters) to surface buffer-boundary issues

A pilot that completes with 0 errors but doesn't exercise these patterns has not validated the pipeline against the encoding bug class. The V.3-B pilot completed successfully but did not contain items with curly quotes in body text; this is why the encoding bug only surfaced at item 33,942 of the full ingest.

### Related concerns

- **StreamReader** without explicit encoding defaults to system ANSI code page. Always specify: `[System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)`
- **Out-File** without `-Encoding utf8` writes UTF-16-LE on PowerShell 5.1 and UTF-8-with-BOM on PowerShell 7
- **Get-Content** without `-Encoding utf8` similarly uses system defaults

When in doubt, specify UTF-8 explicitly at every encoding boundary.

### Long-term remediation

The mandatory `[Console]::OutputEncoding` rule is a workaround for a Windows legacy default that bites every cross-language pipeline on Windows. The strategic remediation is to **eliminate PowerShell from ingest pipelines entirely** — write helpers in TypeScript using Node-native libraries (`adm-zip`, `fast-xml-parser`, etc.). This is being addressed in V.3-B-opt (rewrite UKSI pipeline in pure TypeScript). Future ingest sprints (V.3-D, V.3-G, V.4-A) should not introduce new PowerShell helpers.
