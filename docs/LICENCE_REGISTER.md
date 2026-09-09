# LICENCE REGISTER — Scrutinise corpus

**One file. Every source we need permission for, what state it is in, and what happens next.**

Charlie appends replies as they arrive. CC reads this file and never edits the correspondence rows — it may only add new source rows and correct a licence code, and must say in its report when it does.

**Last updated:** 30 August 2026

---

## Live actions

| # | source | with whom | sent | reply | next action | by when |
|---|---|---|---|---|---|---|
| 1 | **Find Case Law (TNA)** | Timothy Cross, Licensing Manager: Academic & Legal | 23 Aug 2026 | 26 Aug 2026 — apply through the online form; Board sits **14 Sept**; apply within 10 days to make that agenda | ✅ **SUBMITTED 30 Aug 2026, 07:00. Case ref `CAS-350145-F8Q4C3`.** Ahead of the 5 Sept deadline, so it makes the 14 Sept Board. TNA say **up to 5 weeks** for a decision. Full submitted record returned by email and checked against the draft: all nine principles, the governance note and all three additional-comment paragraphs went in complete. Contact email submitted as **cl@scrutinise.org**. Two 50-character fields were shortened at the keyboard and both read correctly: Org Other = *"Not-for-profit project - to be incorporated later"*; Benefit Other = *"MPs, others developing proposals for legislation"*. ⚠ **One line to query: the returned record shows `License Holder: No`.** We answered "same person as the main contact", so this is probably their field meaning "a separate licence holder? No" — but it is ambiguous and the licence needs a named responsible person. Worth one clarifying email to `caselawlicence@nationalarchives.gov.uk` quoting the case ref | **Chase if nothing by 6 Oct 2026** |
| 2 | **FCA Handbook** | Firm Supervision Hub → redirected | 23 Aug 2026 | 26 Aug 2026 — redirected to `handbook.feedback@fca.org.uk` | Re-sent to the Handbook team 26 Aug. **Chase if nothing by 9 Sept** | 9 Sept 2026 |
| 3 | **ICLR** | enquiries@iclr.co.uk | 24 Aug 2026 | — | Awaiting reply. Chase 8 Sept | 8 Sept 2026 |
| 4 | **Find Case Law — historic coverage** | Timothy Cross | 23 Aug 2026 | 26 Aug 2026 — **paper pre-2001 records will NOT be digitised or licensed for digitisation**, and that is separate from Find Case Law. Whether earlier *digital* material may be added to FCL: he is checking with the Case Law team | Await his second reply. Do not chase before 9 Sept | 9 Sept 2026 |

---

## Settled

| source | position | evidence |
|---|---|---|
| **BAILII** | **CLOSED.** "BAILII does not permit the bulk download of, scraping of, or programmatic access to its data." Directed us to The National Archives. Independently confirmed by their published terms (para 6 forbids storing HTML judgments and bulk downloading), by `robots.txt` disallowing every jurisdiction path, and by an Anubis proof-of-work wall. | Ann M. Hale, Executive Director, email 16 June 2026 |
| **SSRN** | **BLOCKED.** Individual author copyright, no open licence. Plan row closed; do not revisit. | V21 probe |
| **Pre-2001 paper records at TNA** | **WILL NOT BE DIGITISED.** No intention to digitise or license digitisation of modern pre-2001 paper holdings (e.g. Assizes records to 1971). Many are closed and cannot be ordered; too risky even for open records. **This closes the paper route permanently — it is not a "not yet".** | Timothy Cross, 26 Aug 2026 |
| **OGL v3.0 / Open Parliament Licence / EU 2011/833** | **CLEAR**, commercial use permitted with attribution. Covers legislation.gov.uk, gov.uk, Hansard, committees, EUR-Lex — the large majority of the corpus by volume. | licence text, verified 12 June 2026 |

---

## Restricted — fine now, blocking the day a commercial arm exists

| source | restriction | action needed |
|---|---|---|
| **NAO reports** | Non-commercial re-use free with attribution; commercial needs express permission | Flag rows commercial-excluded. Write before any commercial launch |
| **ECtHR / HUDOC** | Free for private, information or education use; commercial needs prior written permission | As above |
| **OECD** | Pre-July-2024 content CC-BY-**NC**; from July 2024 CC-BY | Date-split the rows and label them. *(Moot until the collection is re-seeded — it currently holds no OECD content at all.)* |
| **IMF** | `commercialUseExcluded = true` | Flag rows |

---

## Unverified — we hold material under terms nobody has read

| source | why unverified | action |
|---|---|---|
| **College of Policing** | Terms page is Cloudflare-blocked; a footer grep is not verification | Write for the APP re-use terms. **Gates the 8,000-section backfill** |
| **NI judgments** | Crown copyright asserted, no open licence stated | Write to Judiciary NI |
| **Tax tribunals** | No licence statement on the HMCTS legacy site | Write to HMCTS |
| **NI Law Commission** | Site SSL certificate dead — cannot reach the terms | Write to DoJ NI. Low priority, 17 sections |
| **Erskine May** | OPL assumed, never checked | Confirm with the Commons Journal Office |
| **Scottish courts** | `pending-verification` since V19 | Verify |
| **PRA Rulebook** | Never checked; expect the FCA's position | Combine with the FCA approach once they reply |
| **Financial Ombudsman Service** | Never checked; potentially 400,000+ decisions | Scope before any crawl |
| **Coroners' PFD reports** | judiciary.uk terms not verified | Combine with the NI judgments letter |

---

## Out of scope — cite by reference, never ingest

Halsbury's · Westlaw UK · LexisNexis All England · HeinOnline · IBFD · OECD Model Tax Commentary · **BSI British Standards** *(⚠ Building Regulations Approved Documents incorporate BSI standards by reference. Answers in that area must say "this refers to BS EN xxxx, which is not in the corpus" rather than stopping silently.)*

---

## How to use this file

- **A reply arrives:** add it to the row's `reply` column with the date and the substance in one sentence, and set the next action and date. Do not summarise it away — the wording of a permission matters later.
- **A new source needs permission:** add a row under *Unverified* before any fetch, not after.
- **A licence changes state:** move the row between sections rather than editing in place, so the history stays legible.
- **Never record an inference as a permission.** "Their site looks open" is not a licence. Unverified is an honest state and it belongs in the middle table.
