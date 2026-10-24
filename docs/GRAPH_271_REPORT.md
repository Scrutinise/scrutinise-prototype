# GRAPH — Decision 271: made-under only where the words name the power (24 Oct 2026)

**Decision 271 (Charlie, 24 Oct):** a made-under row is a dependency only when the enacting words name the provision as the power exercised; a procedural mention is a reference, for review. *Implement in extraction and tell Lex the field to read.*

**State, 2026-10-24 16:04 UTC:** built; `citation_edge` altered and backfilled on Neon (16:00–16:01 UTC); presence CHECK **VALIDATED**. `check-271-enabling-role` 15/0 (211/211 hand labels, 4/4 controls); `check:onward` 23/23, 2,808 assertions, 9/9 controls; `check:idea-law` 26/26, 11/11 controls (E1a/b/c). Reader change **not committed, not deployed**.

## 1. The field Lex reads

| where | field | values |
|---|---|---|
| `citation_edge` (Neon) | `enabling_role` | `power` · `mention` · `unstated` — set on every `detection = 'enabling'` row, NULL on every other (CHECK, validated) |
| | `enabling_role_words` | the phrase the role was read from ("powers conferred", "requirements of", …); NULL for `unstated`; prefixed `[stored words]` on the 1,301 rows read from their stored text (§4) |
| `onwardFrom()` `OneStep` | `kind` | **`made-under` now means `enabling_role = 'power'` only.** Every other enabling row is the new kind **`enacting-mention`**, strength `reference` |
| | `enablingRole`, `enablingRoleWords` | the two columns, on made-under / enacting-mention rows; null on every other kind |
| `statute_onward` rows | `enabling_role`, `enabling_role_reads` | the same, with its plain-words reading |

A caller asking for `kinds: ['made-under']` gets powers only, with no change on its side; `enacting-mention` is in the default kinds and sits under "Provisions that refer to this — for review". An instrument made under the target is never listed again as merely mentioning it.

## 2. The rule (`extract-madeunder-edges.ts` `enablingRole`, one parser for both writers)

Read from the clause the anchor sits in (back to the last sentence end, brackets dropped): the formula that ends nearest the anchor governs; on a tie the longer phrase wins.

- **power** — "in exercise of", "powers conferred/given/vested/exercisable/under", "conferred on", "by virtue of", "in pursuance of" (not "has, in pursuance of"), "powers exercised", "those conferred by", "makes the following … under/pursuant to".
- **mention** — "requirements of", "complied with", "in accordance with", "(as) required by (virtue of)", "pursuant to", "laid before", "approved by resolution", "consult…", "having regard to", "with the consent/approval", "designated for the purposes", "within the meaning of", "as amended by", "whereas", "proposals submitted", "after reference to", "now vested in him" (bound to the one anchor it precedes).
- **unstated** — neither. Not a dependency.

Three structural rules found by reading output, each with its own fixture case:
1. **A power formula inherited across an earlier anchor** reaches this one only if the words since that anchor name a provision ("…powers enabling him, after reference to the Social Security Advisory Committee[anchor]" is a body, not a power).
2. **A fragment that continues the previous anchor's target** in the same sentence takes its role (newer SIs mark every fragment: "sections 5[c] (1)[c] (i)[c]").
3. **Back-references are hits of their own.** "…designated for the purposes of section 2(2) of the ECA 1972[a]. Accordingly … in exercise of the powers conferred by section 2(2) **of that Act**" — and "section 59(1) **of the Act**" (defined at an earlier anchor as (“the Act”)). Anchor [a] stays a mention; the power, which had no row at all, is written with its own provision and `[back-reference]` in its words. 10,518 such rows.

## 3. Validation — against hand labels, not the classifier's own output

`scripts/ingest/graph/decision-271-validation.json`, 211 hits, each labelled by reading the words; `check-271-enabling-role.ts` re-parses each from the bulk file.

| set | how drawn | score when first run, rules frozen | misses |
|---|---|---|---|
| 1–80 | seeded, 1,777-stride | 78/80 | #41, #57 — both powers read as mentions |
| H1–H50 | seeded, 2,311-stride | **47/50** | H18, H25 false powers; H48 power not seen |
| T1–T30 | seeded, 1,501-stride | **27/30** | T3, T5, T18 — all false powers |
| F1–F40 | seeded, 997-stride | **39/40 — the reported figure** | F35 power not seen; **no false power** |
| K1–K11 | CRaG s.20 + regressions | — | — |

Every miss was fixed after its score was taken and kept as a regression case. **Two labels were changed after a run, and each case says so** (29: a designation, labelled before back-references existed; 16: an incorporation route, marked borderline from the start). The honest accuracy is the last untuned draw: 39/40, no false power. Across all four untuned draws, 6 of 200 hits were false powers before their fixes.

## 4. The backfill (`backfill-271-enabling-role.ts`), 2026-10-24 16:00–16:01 UTC

| | rows |
|---|---|
| stored enabling rows | 191,258 (70,576 instruments) |
| matched by their own key (gid, target_uri, provision, words) and given the re-parsed role | 189,957 — power 139,225 · mention 38,460 · unstated 12,272 |
| **not producible again** — 340 instruments the bulk file on disk does not hold | 1,301 — read from their stored words: power 864 · mention 255 · unstated 182 |
| back-reference power rows inserted | 10,518 |
| **after** | power 150,607 · mention 38,715 · unstated 12,454 — 201,776 rows, every one with a role |

⚠ **The bulk file changed under us.** The rows say `best-collection-xml.zip@2026-08-26`; the only zip on this machine is the 14 May 2026 copy. The 1,301 rows of later instruments were classified from their stored ≤240-character words, marked `[stored words]`. That fallback was measured on the 189,949 rows that did re-parse: same role 92.3%; power where the full parse says not 3,859 (2.0%); not power where it says power 4,988 (2.6%). Expect ~25 false and ~35 missed powers among the 1,301.

⚠ **The identity bridge's file is absent** (`v36/source-entries.json`, gitignored). The backfill read `legislation_identity` instead — the table built from that bridge — for the canonical id and `resolved` of the inserted rows only; matching needed no bridge.

⚠ **`setup-citation-edge-table.ts` would have narrowed a live CHECK.** It still dropped and re-added the detection CHECK without GRAPH 5's `caselaw-markup`; the first apply failed against 1.29M caselaw rows and rolled back whole (verified: constraints intact, no column added). The list now matches the live one.

## 5. CRaG s.20, before and after

| | before 271 | after |
|---|---|---|
| made-under, naming s.20 | 3 (all procedural) | **0** |
| made-under, Act-wide | 8 | 7 — powers under ss.45, 46, 52 |
| enacting-mention | — | 4: ssi/2024/101 "requirements of", uksi/2024/512 "requirements of", uksi/2020/38 "laid before", uksi/2026/216 (Act-wide) |

## 6. Found, not fixed — for Charlie

1. **Provision lists with a bare bracketed item are dropped, so the power is recorded Act-wide.** "section 52(2) **and (4)** of" ends the list at "(4)", so refs are empty — which is why CRaG's s.52 orders show Act-wide in a s.20 walk. In three samples, 1,209 of 4,287 power hits (28%) name a section just before the reference and carry no provision. Pre-existing (`refListDetail`'s `ITEM_RX`), separate from 271. A fix plus an additive backfill of the missing provision rows is the same shape as this one. **Decision: do it?**
2. **78 rows the parser now produces were never stored** (e.g. uksi/2025/1135 → ukpga/2005/4 s.413) — not written by this backfill, which only adds back-references.
3. **Target resolution through a footnote's FIRST citation** sometimes names the amending Act, not the one in the words (H1: the words name the 1975 Act, the row says ukpga/1990/7). Pre-existing; not a role question.
4. `legislation_edges`' 230,681 made-under rows are untouched and still carry no role; nothing in the reader reads them.

## 7. E1 (`check:idea-law`), done in the same session

E1 compared lines with stored rows (27 rows on 24 lines on 452c5ade — a correct reader failed). Split into **E1a** every live row on exactly one line (or reported inconsistent), **E1b** lines = distinct (relation, doc_uri, provision_path) and merged = rows − lines, **E1c** each line carries every row of its key with that row's own source and action id, hand row first — each against plain SQL, each with a control (5 new, all fire). On 452c5ade: 27 rows on 24 lines, 3 merged lines, all 3 carrying both action ids. `check:idea-law` 26/26, 11/11 controls.
