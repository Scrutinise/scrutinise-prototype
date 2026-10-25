# LICENCE REGISTER — Scrutinise corpus

**One file. Every source we need permission for, what state it is in, and what happens next.**

Charlie appends replies as they arrive. CC reads this file and never edits the correspondence rows — it may only add new source rows and correct a licence code, and must say in its report when it does.

**Last updated:** 25 September 2026 — FCA Handbook moved Live actions → Settled (CC, per Charlie's instruction; see that row for the evidence trail)

---

## Live actions

| # | source | with whom | sent | reply | next action | by when |
|---|---|---|---|---|---|---|
| 1 | **Find Case Law (TNA)** | Timothy Cross, Licensing Manager: Academic & Legal | 23 Aug 2026 | 26 Aug 2026 — apply through the online form; Board sits **14 Sept**; apply within 10 days to make that agenda | ✅ **SUBMITTED 30 Aug 2026, 07:00. Case ref `CAS-350145-F8Q4C3`.** Ahead of the 5 Sept deadline, so it makes the 14 Sept Board. TNA say **up to 5 weeks** for a decision. Full submitted record returned by email and checked against the draft: all nine principles, the governance note and all three additional-comment paragraphs went in complete. Contact email submitted as **cl@scrutinise.org**. Two 50-character fields were shortened at the keyboard and both read correctly: Org Other = *"Not-for-profit project - to be incorporated later"*; Benefit Other = *"MPs, others developing proposals for legislation"*. ⚠ **One line to query: the returned record shows `License Holder: No`.** We answered "same person as the main contact", so this is probably their field meaning "a separate licence holder? No" — but it is ambiguous and the licence needs a named responsible person. Worth one clarifying email to `caselawlicence@nationalarchives.gov.uk` quoting the case ref | **Chase if nothing by 6 Oct 2026** |
| 2 | **ICLR** | enquiries@iclr.co.uk | 24 Aug 2026 | — | Awaiting reply. Chase 8 Sept | 8 Sept 2026 |
| 3 | **Find Case Law — historic coverage** | Timothy Cross | 23 Aug 2026 | 26 Aug 2026 — **paper pre-2001 records will NOT be digitised or licensed for digitisation**, and that is separate from Find Case Law. Whether earlier *digital* material may be added to FCL: he is checking with the Case Law team | Await his second reply. Do not chase before 9 Sept | 9 Sept 2026 |

---

## Settled

| source | position | evidence |
|---|---|---|
| **BAILII** | **CLOSED.** "BAILII does not permit the bulk download of, scraping of, or programmatic access to its data." Directed us to The National Archives. Independently confirmed by their published terms (para 6 forbids storing HTML judgments and bulk downloading), by `robots.txt` disallowing every jurisdiction path, and by an Anubis proof-of-work wall. | Ann M. Hale, Executive Director, email 16 June 2026 |
| **SSRN** | **BLOCKED.** Individual author copyright, no open licence. Plan row closed; do not revisit. | V21 probe |
| **Pre-2001 paper records at TNA** | **WILL NOT BE DIGITISED.** No intention to digitise or license digitisation of modern pre-2001 paper holdings (e.g. Assizes records to 1971). Many are closed and cannot be ordered; too risky even for open records. **This closes the paper route permanently — it is not a "not yet".** | Timothy Cross, 26 Aug 2026 |
| **OGL v3.0 / Open Parliament Licence / EU 2011/833** | **CLEAR**, commercial use permitted with attribution. Covers legislation.gov.uk, gov.uk, Hansard, committees, EUR-Lex — the large majority of the corpus by volume. | licence text, verified 12 June 2026 |
| **INGEST_LEX_FIVE additions (CC-Ingest, 18 Oct 2026, added BEFORE the fetch)** | **Managing Public Money** and the **departmental Annual Reports and Accounts**: gov.uk publications, **OGL v3.0**, `govuk-core-docs` / new collection mapped to `OGL3` in `licence-map.ts`; no correspondence needed. **Bills-API amendments**: Open Parliament Licence v3.0, same as `bills-api`. **`nao-reports` dates** change no licence (still `nao-nc`, non-commercial). Third-party content inside any annual report (photographs, charts credited to others) is outside the OGL and is not separately tracked. | licence map; gov.uk publication pages state OGL |
| **FCA Handbook** | **CLEAR**, commercial use permitted with attribution — **superseding the `fca-restricted` posture verified 24 Jun 2026.** The Handbook Team replied by email 25 Sept 2026 (to CC's original request of 26 Aug 2026, itself a re-send after the Firm Supervision Hub redirect of 23 Aug): "we have recently changed how the Handbook data is licenced and accessed. You can now access the data in JSON format for free via public API under the terms on the Open Government Licence (v3)," pointing to the "Public API" left-hand-menu item on the Handbook site. Independently verified 25 Sept 2026: the site's left-hand nav item is labelled **"Handbook API"** (`/handbook-api` — a Swagger-documented API behind a sign-in gate; same feature the reply describes), and the governing **Terms & Conditions** (`https://handbook.fca.org.uk/footer-widget/terms-and-conditions`), clause 25: *"You may use the information on the Site or the API in accordance with the terms of the Open Government Licence v3.0"* (linking `nationalarchives.gov.uk/doc/open-government-licence/version/3/`). Clause 26 (attribution): *"The source of Our material should be acknowledged in all copies, either by appropriate words or by adding the FCA copyright symbol (i.e. © FCA)."` **Scope note: this covers Handbook content only.** `fca-enforcement` (final notices/decision notices) is a separate corpus under a separate, still-unverified FCA copyright posture (`fca.org.uk/legal`, verified 24 Jun 2026) and is **not** affected by this reply — do not extend CLEAR to it without its own check. | Handbook Team (`Handbook.Feedback@fca.org.uk`), email 25 Sept 2026; licence terms independently verified 25 Sept 2026 |

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
