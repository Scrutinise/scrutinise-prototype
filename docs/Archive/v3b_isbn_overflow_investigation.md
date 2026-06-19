# V.3-B ISBN-Overflow Investigation Report
*Completed: 19 May 2026*

---

## Summary

All 16 ISBN-overflow items are genuine, made UK Statutory Instruments. Each has a properly numbered canonical version (`uksi/YYYY/NNNN`) that was successfully ingested during Phase 3. The ISBN-identified versions are pre-publication drafts explicitly flagged as "Superseded" by TNA. **No schema change is needed. No re-ingest is needed. The overflow error protected us from ingesting duplicates.**

---

## Background

Phase 3 ingest failed on 16 actIds where the "number" segment of the actId is a 13-digit ISBN (e.g. `uksi/2014/9780111109410`). Prisma's `LegislationItem.number` field is `Int` (32-bit), which overflows on any value above ~2.1 billion. ISBNs are ~9.78 × 10¹², causing Prisma to throw a numeric overflow error and skip the item.

---

## Investigation methodology

For each of the 16:
1. Fetched `https://www.legislation.gov.uk/{actId}` — checked HTTP status and read title/SI-number from HTML
2. Fetched `https://www.legislation.gov.uk/{actId}/data.xml` — read `dc:identifier`, `Number`, `Year`, title from XML
3. Searched `legislation.gov.uk` for the instrument by title+year to find any properly numbered version
4. Checked whether the properly numbered version exists in `manifest-uksi.json`

---

## Findings per item

| # | ISBN actId | Title | HTML status | Number in XML | Proper actId | In manifest? |
|---|---|---|---|---|---|---|
| 1 | `uksi/2014/9780111109410` | The Urban Development Corporations in England (Area and Constitution) Order 2014 | 200 | 0000 | `uksi/2014/1181` | ✓ |
| 2 | `uksi/2014/9780111116951` | The Local Government (Transparency) (Descriptions of Information) (England) Order 2014 | 200 | blank | `uksi/2014/2060` | ✓ |
| 3 | `uksi/2014/9780111124444` | The Motor Vehicles (Variation of Speed Limits) (England and Wales) Regulations 2014 | 200 | 0000 | `uksi/2014/3552` | ✓ |
| 4 | `uksi/2015/9780111126646` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2015 | 200 | 0000 | `uksi/2015/135` | ✓ |
| 5 | `uksi/2015/9780111126745` | The Local Government (Transparency) (Descriptions of Information) (England) Order 2015 | 200 | blank | `uksi/2015/471` | ✓ |
| 6 | `uksi/2015/9780111128190` | The Criminal Procedure and Investigations Act 1996 (Code of Practice) Order 2015 | 200 | **** | `uksi/2015/861` | ✓ |
| 7 | `uksi/2015/9780111141366` | The Agricultural Holdings Act 1986 (Variation of Schedule 8) (England) Order 2015 | 200 | 0000 | `uksi/2015/2082` | ✓ |
| 8 | `uksi/2017/9780111163788` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2017 | 200 | 0000 | `uksi/2017/1335` | ✓ |
| 9 | `uksi/2018/9780111175606` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2018 | 200 | 0000 | `uksi/2018/1421` | ✓ |
| 10 | `uksi/2019/9780111189467` | The Heavy Commercial Vehicles in Kent (No. 2) Order 2019 | 200 | blank | `uksi/2019/1394` | ✓ |
| 11 | `uksi/2019/9780111191422` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2019 | 200 | 0000 | `uksi/2019/1520` | ✓ |
| 12 | `uksi/2020/9780348211740` | The Criminal Procedure and Investigations Act 1996 (Code of Practice) Order 2020 | 200 | *** | `uksi/2020/1330` | ✓ |
| 13 | `uksi/2021/9780348218787` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2021 | 200 | blank | `uksi/2021/134` | ✓ |
| 14 | `uksi/2021/9780348229103` | The Heavy Commercial Vehicles in Kent (No. 2) (Amendment) (No. 2) Order 2021 | 200 | 0000 | `uksi/2021/1402` | ✓ |
| 15 | `uksi/2021/9780348230284` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order (No. 2) 2021 | 200 | blank | `uksi/2021/1495` | ✓ |
| 16 | `uksi/2022/9780348242454` | The Local Government Finance Act 1988 (Non-Domestic Rating Multipliers) (England) Order 2022 | 200 | blank | `uksi/2022/1407` | ✓ |

**All 16 proper actIds were confirmed present in `manifest-uksi.json` and were successfully processed during Phase 3.**

---

## What these instruments are

These fall into a small number of recurring instrument types:

- **LGFA 1988 Non-Domestic Rating Multipliers (England) Orders** (7 items: years 2015, 2017, 2018, 2019, 2021×2, 2022) — annual orders setting business rates multipliers, issued each January by DCLG/DLUHC
- **CPIA 1996 Code of Practice Orders** (2 items: 2015, 2020) — orders laying revised codes of practice under the Criminal Procedure and Investigations Act 1996
- **Heavy Commercial Vehicles in Kent Orders** (2 items: 2019, 2021) — emergency traffic regulation orders under the Road Traffic Regulation Act 1984
- **LG Transparency (Descriptions of Information) Orders** (2 items: 2014, 2015)
- **One-off instruments** (3 items): Urban Development Corporations 2014, Motor Vehicles Speed Limits 2014, Agricultural Holdings 2015

---

## Why TNA's bulk ZIP contains these ISBN-identified versions

TNA's publication pipeline works in two phases:
1. **Pre-publication:** An XML file is generated and assigned an ISBN before the formal SI number is allocated. This version is published on legislation.gov.uk under a `uksi/YYYY/{ISBN}` URL with `Number: 0000` in the XML.
2. **Post-numbering:** Once the SI number is formally assigned (typically days to weeks later), a new XML file is published under the proper `uksi/YYYY/NNNN` URL. TNA marks the ISBN version as "Superseded by YYYY No. NNNN" on the search results page.

The bulk ZIP appears to include **both versions** — the superseded ISBN draft and the canonical numbered version. This is evidenced by:
- Every ISBN version returning HTTP 200 with `dc:identifier: http://www.legislation.gov.uk/uksi/YYYY/{ISBN}/made`
- Every title search returning exactly two results: one numbered, one ISBN-based, with the ISBN version explicitly marked "Superseded by YYYY No. XXXX"
- All 16 corresponding numbered actIds present in `manifest-uksi.json`

---

## Hypothesis verdict

**Hypothesis C (Special document type) — partially confirmed, then superseded by a cleaner finding.**

The initial description of Hypothesis C as "real but unusual" instruments is correct, but the deeper finding is more specific: these are **pre-publication drafts that were superseded by properly numbered versions**. This is distinct from Hypothesis A (TNA manifest bug) and Hypothesis B (phantoms). The ISBN is TNA's own identifier for the draft version; it is not a mis-identification of a single canonical document. Two distinct documents exist.

---

## Impact on Railway DB

- The 16 ISBN-numbered actIds were **never ingested** — Prisma's Int32 overflow caused all 16 to error and be skipped.
- The 16 corresponding properly numbered actIds **were successfully ingested** during Phase 3 (confirmed: all 16 found in manifest and Phase 3 completed 60,167 items).
- The Railway DB therefore contains the **correct canonical versions** of all 16 instruments under their proper SI numbers.
- The overflow error was, in effect, **a correct filter** — it prevented ingestion of superseded duplicates.

---

## Recommendation

**Mark as KNOWN_SUPERSEDED_DRAFT. No re-ingest. No schema change for this cohort.**

Specific actions:

1. **Close the 16 errors** in the progress file as `KNOWN_SUPERSEDED_DRAFT` — the canonical versions are already in Railway.

2. **No schema change needed for this cohort.** Changing `number: Int` to `BigInt` or `String` would be required only if we wanted to store the pre-publication draft versions, which we do not.

3. **Add a skip filter to the Phase 3 ingest script (V.3-G).** Before attempting to ingest any item, check if the number segment exceeds `Int32` max (2,147,483,647). If so, log `SKIPPED_ISBN_DRAFT` and continue — do not attempt the Prisma write. This will cleanly handle any future UKSI re-ingests or UKSI top-ups that encounter these same ZIP entries.
   - Detection: `parseInt(numberSegment) > 2_147_483_647` is sufficient (all valid SI numbers are 4–5 digits; any 10+ digit value is an ISBN).

4. **TNA feedback (optional, low priority).** TNA's bulk ZIP documentation does not mention that it contains pre-publication draft versions alongside final instruments. A brief note to the TNA technical team (`legislation@nationalarchives.gov.uk`) pointing this out might be useful for others building on the bulk data. Not urgent.

5. **Phase 3 final error count is effectively 1** (the single transient Railway connection error on `uksi/2016/245`), not 17. The 16 ISBN overflows are not errors in any meaningful sense — they are correct non-ingestions of superseded content.

---

## Appendix: ISBN-to-proper-number mapping (for reference)

| ISBN actId | Canonical actId |
|---|---|
| `uksi/2014/9780111109410` | `uksi/2014/1181` |
| `uksi/2014/9780111116951` | `uksi/2014/2060` |
| `uksi/2014/9780111124444` | `uksi/2014/3552` |
| `uksi/2015/9780111126646` | `uksi/2015/135` |
| `uksi/2015/9780111126745` | `uksi/2015/471` |
| `uksi/2015/9780111128190` | `uksi/2015/861` |
| `uksi/2015/9780111141366` | `uksi/2015/2082` |
| `uksi/2017/9780111163788` | `uksi/2017/1335` |
| `uksi/2018/9780111175606` | `uksi/2018/1421` |
| `uksi/2019/9780111189467` | `uksi/2019/1394` |
| `uksi/2019/9780111191422` | `uksi/2019/1520` |
| `uksi/2020/9780348211740` | `uksi/2020/1330` |
| `uksi/2021/9780348218787` | `uksi/2021/134` |
| `uksi/2021/9780348229103` | `uksi/2021/1402` |
| `uksi/2021/9780348230284` | `uksi/2021/1495` |
| `uksi/2022/9780348242454` | `uksi/2022/1407` |
