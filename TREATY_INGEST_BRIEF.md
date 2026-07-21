# MINI-BRIEF — TREATY COVERAGE EXTENSION (for CC)

**Written:** 25 Jun 2026, by CCh. Standalone, runnable now (not a full sprint). Read CLAUDE.md, the playbook (source priority bulk -\> HTML -\> API; licence-at-the-licence-page; honest denominator), and the existing `uk-treaties` source.

## WHY

We hold `uk-treaties` (3,250) + `tax-treaties-dta` (324). The authoritative universe — UK Treaties Online (`treaties.fcdo.gov.uk`) — holds records of **\~15,000 treaties** the UK is or has been party to (1783-present; full text for those in the UK Treaty Series, 1892 onwards). So current coverage is partial (\~1/5). Separately, the **Parliament Treaty Tracker** (`treaties.parliament.uk`, API `api.parliament.uk/uk-treaties`) covers treaties laid before Parliament for scrutiny under the Constitutional Reform and Governance Act 2010 — the legislative-scrutiny view, squarely on-mission. Close both gaps.

## STEP 0 — establish what we already have

First determine what `uk-treaties` (3,250) was actually built from (FCDO UKTO? the Parliament API? a partial pull?) and its date/coverage span. Report it before extending, so we extend rather than duplicate. (Verify-before-asserting.)

## STEP 1 — extend to the full UK Treaties Online universe (FCDO)

-   **Source:** `treaties.fcdo.gov.uk` (UK Treaties Online; appears to run on a Knowvation/Springshare platform). Also check the **data.gov.uk "Treaties Database"** dataset and any bulk/export route first (source priority: bulk -\> HTML -\> API). Full treaty text is PDF for UK Treaty Series entries (in force 1892-2001 direct; post-2001 via the linked command paper).
-   **Licence:** Crown copyright / OGL v3.0 (FCDO Crown material) — **verify at the FCDO/UKTO terms page**, not a footer.
-   **Build/extend:** enumerate the full record set (\~15,000), dedup against what we hold, ingest the metadata + full text where available; classify records without full text (older/records-only) with an availability status and surface honestly (known-unknowns, not silent gaps) per the honest-denominator doctrine.
-   Probe -\> pilot one treaty end-to-end (record + PDF text) -\> predict the universe -\> auto-upgrade. Seed POST-PUSH if a new sourceType; if extending the existing `uk-treaties` corpus, additive re-seed.

## STEP 2 — add the Parliament Treaty Tracker (CRaG-2010 scrutiny treaties)

-   **Source:** `api.parliament.uk/uk-treaties` (clean JSON; same robust pattern as the V28 votes / V29 Parliament APIs). Covers treaties laid before Parliament since 2010, with scrutiny status, command-paper links, and committee involvement.
-   **Licence:** Open Parliament Licence v3.0 — verify.
-   **Build:** new sourceType/corpus (e.g. `parliament-treaties`) OR a structured enrichment on the FCDO treaties — your call on the cleaner model; note the decision. Carry the *scrutiny* metadata (laid date, CRaG status, sponsoring department, any debate/committee links) since that is the on-mission value the FCDO set lacks. Probe -\> pilot -\> auto-upgrade. Seed POST-PUSH.

## ACCEPTANCE

-   Report current `uk-treaties` provenance + span before extending.
-   FCDO: full \~15,000-record universe enumerated; held vs missing reported; missing ingested (text where available, classified where not); licence verified at source.
-   Parliament tracker: built, licence verified, scrutiny metadata carried.
-   licence-map + rate-limits + CHANGE_LOG/handoff updated; corpus-status re-baselined at drain.
-   Cost note: this is metadata + PDFs for \~12k additional items — modest write volume; seed in the normal POST-PUSH order, no special spend approval needed.

## GIT

No git mid-sprint; single commit-all.sh; preview; Main.
