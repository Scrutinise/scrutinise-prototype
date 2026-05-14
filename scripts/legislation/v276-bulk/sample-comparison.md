# V2.76-B Phase 2 — Sample Comparison Report

Generated: 2026-05-14T07:49:22.513Z

## Summary

| Category | Count |
|----------|-------|
| NEW_TO_RAILWAY | 1657 |
| SKIP | 1287 |
| COUNT_DIFF | 1146 |
| PATCH_GAPS | 316 |
| PRINT_ONLY | 20 |
| FULL_INGEST | 1 |
| PRINT_ONLY (full corpus) | 9043 |

### Category definitions
- **SKIP** — fully processed, no gaps, counts match; no Phase 3 action needed
- **PATCH_GAPS** — has sections but some have neither-key (fetch XML key from bulk)
- **FULL_INGEST** — 0 Railway sections, XML exists in bulk (extract all P1groups)
- **COUNT_DIFF** — bulk P1group count ≠ Railway section count (needs investigation)
- **NEW_TO_RAILWAY** — in bulk but no Railway item yet (create item + ingest sections)
- **PRINT_ONLY** — in Railway but no XML in bulk (mark permanently excluded)

## 10-act sample

| Act | Category | Bulk P1groups | DB sections | DB with keys | DB neither | Version |
|-----|----------|--------------|-------------|-------------|------------|---------|
| ukpga/2010/15 | COUNT_DIFF | 278 | 239 | 234 | 5 | revised-current |
| ukpga/2006/46 | FULL_INGEST | 1677 | 0 | 0 | 0 | revised-current |
| ukpga/2007/3 | COUNT_DIFF | 1784 | 1776 | 1750 | 26 | revised-current |
| ukpga/1968/60 | COUNT_DIFF | 55 | 40 | 40 | 0 | revised-current |
| ukpga/2024/3 | COUNT_DIFF | 484 | 269 | 39 | 230 | revised-current |
| ukpga/1998/42 | COUNT_DIFF | 29 | 23 | 23 | 0 | revised-current |
| ukpga/2020/1 | PATCH_GAPS | 74 | 74 | 43 | 31 | revised-current |
| ukpga/2023/55 | COUNT_DIFF | 630 | 440 | 256 | 184 | revised-current |
| ukpga/1985/51 | COUNT_DIFF | 105 | 102 | 100 | 2 | revised-current |
| ukpga/2015/21 | PATCH_GAPS | 162 | 162 | 6 | 156 | revised-current |
| ukpga/2009/22 | PATCH_GAPS | 443 | 443 | 336 | 107 | revised-current |
| ukpga/2017/21 | PATCH_GAPS | 103 | 103 | 27 | 76 | revised-current |

## Top PATCH_GAPS acts (by neither-key count)

| Act | Title | Neither-key sections | Bulk P1groups | Total DB sections |
|-----|-------|---------------------|--------------|------------------|
| ukpga/2015/21 | Corporation Tax (Northern Ireland) Act 2015 | 156 | 162 | 162 |
| ukpga/2009/22 | Apprenticeships, Skills, Children and Learning Act | 107 | 443 | 443 |
| ukpga/2017/21 | Bus Services Act 2017 | 76 | 103 | 103 |
| ukpga/1997/48 | Crime and Punishment (Scotland) Act 1997 | 56 | 112 | 112 |
| ukpga/2010/24 | Digital Economy Act 2010 | 44 | 92 | 92 |
| ukpga/2021/1 | Pension Schemes Act 2021 | 39 | 171 | 171 |
| ukpga/2014/4 | Transparency of Lobbying, Non-Party Campaigning an | 33 | 82 | 82 |
| ukpga/2020/1 | European Union (Withdrawal Agreement) Act 2020 | 31 | 74 | 74 |
| ukpga/2021/17 | Domestic Abuse Act 2021 | 29 | 122 | 122 |
| ukpga/2005/22 | Finance (No. 2) Act 2005 | 26 | 98 | 98 |

## NEW_TO_RAILWAY sample (first 10)

| Act | Bulk P1groups | Version |
|-----|--------------|---------|
| ukpga/Geo3/41/52 | -1 | revised-current |
| ukpga/Geo3/41/63 | -1 | revised-current |
| ukpga/Geo3/41/79 | -1 | revised-current |
| ukpga/Geo3/41/90 | -1 | revised-current |
| ukpga/Geo3/42/85 | -1 | revised-current |
| ukpga/Geo3/43/108 | -1 | revised-current |
| ukpga/Geo3/43/139 | -1 | revised-current |
| ukpga/Geo3/43/140 | -1 | revised-current |
| ukpga/Geo3/43/141 | -1 | revised-current |
| ukpga/Geo3/44/102 | -1 | revised-current |

## Phase 3 action plan

- **FULL_INGEST** (1 act): Extract P1groups from bulk XML, write to R2, create Railway LegislationSection rows
- **PATCH_GAPS** (316 acts): For each neither-key section, find matching P1group in bulk XML, write to R2, update Railway key fields
- **NEW_TO_RAILWAY** (1657 acts): Create LegislationItem + LegislationSection rows from bulk XML — requires schema decision
- **PRINT_ONLY** (9043 acts): Set compilationStatus = 'PRINT_ONLY' (or new field) — no R2 writes
- **COUNT_DIFF** (1146 acts): Manual investigation before Phase 3
- **SKIP** (1287 acts): No action
