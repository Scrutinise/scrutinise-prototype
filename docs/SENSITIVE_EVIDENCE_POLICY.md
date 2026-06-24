# SCRUTINISE — SENSITIVE-EVIDENCE POLICY (§0)

*Governance audit trail for ingesting public-inquiry / review EVIDENCE. Charlie's decision, 24 Jun 2026, after a data-protection discussion. Implemented in V30 §3 (`sources/inquiry-evidence.ts` `classifyEvidence`, enforced at ingest in `process-row.ts` `processInquiryEvidence`). This document is the standing policy — read it before extending evidence ingestion to any new inquiry.*

---

## 1. THE DECISION

Ingest inquiry/review **evidence** (the witness statements, expert reports, disclosed documents and hearing transcripts behind the findings — the inner-workings-of-government layer), **but exclude clearly-sensitive personal categories**:

- survivor / victim **personal testimony** involving abuse,
- individual **medical-record / health-detail** statements,
- statements given under **anonymity or restriction orders**.

**Keep:** final reports, expert reports, official / government / institutional evidence, public-hearing transcripts, statistical / factual exhibits.

## 2. RATIONALE (why "public" ≠ "free to bulk-reindex")

- **"Public" ≠ exempt from UK GDPR.** Bulk re-indexing of special-category data (health, sexual abuse, etc.) is a fresh, accountable processing act under our control — it does not inherit the inquiry's lawful basis just because the inquiry published it.
- **Inquiries publish such material under restriction / anonymisation regimes** (cipher names, redactions, restriction orders) that are calibrated to the inquiry's own context; bulk ingestion outside that context can breach them.
- **Low value, high harm.** The legislative-analysis value of an individual's personal testimony is low (the *findings* and the *institutional/expert* evidence carry the reform signal), while the harm potential — to identifiable, already-harmed people — and the reputational risk to a civic-trust platform are high.

## 3. IMPLEMENTATION — STRUCTURAL, NOT FINE-GRAINED

Exclusion is applied **at the level the inquiry's OWN structure already separates** — a labelled testimony category, a restriction-marked bundle, an anonymised-statements section. **No per-paragraph PII redaction is attempted** (it is unreliable and out of scope).

`classifyEvidence(input) → { decision: 'keep' | 'exclude' | 'flag', reason }` operates on the structural metadata each inquiry's evidence library exposes (evidence type, witness, witness category, phase, document reference prefix):

| Decision | When | Action at ingest |
|---|---|---|
| **exclude** | witness category / witness = human-impact / personal-testimony / survivor / victim / bereaved; OR evidence type = impact statement / medical / health / patient record; OR any restriction / anonymity / cipher marker | No content ingested. A `sensitive-excluded` marker row records the reason — accounted-for, not silently dropped. |
| **flag** | (high-sensitivity inquiries) an individual witness statement whose category is **unlabelled** and which is not clearly institutional/expert — i.e. a bundle that mixes sensitive + valuable material and is **not cleanly separable** | No content ingested. A `sensitive-flagged` marker row + a line in the sprint report for **Charlie's decision** — never ingest-blind, never drop-wholesale. |
| **keep** | institutional / corporate / government / expert / official / transcript / statistical / literature / correspondence | Ingested normally. |

Per-inquiry **sensitivity profile** (`low` | `high`) tunes the `flag` threshold: low-sensitivity inquiries (e.g. Post Office Horizon — corporate/IT failure) keep nearly everything and only drop the explicit human-impact category; high-sensitivity inquiries (Infected Blood, IICSA-type) additionally flag unlabelled individual witness statements.

The classifier is unit-asserted (6/6 cases: exclude on human-impact / medical / anonymised; flag on unlabelled individual statement; keep on institutional + expert).

## 4. LICENCE IS A SEPARATE GATE

§0 is about *sensitivity*, not *licence*. Each inquiry's evidence is **licence-verified at its own licence page** before ingest (licence-at-the-licence-page). Third-party copyright on expert reports is respected — where third-party copyright blocks a document it is classified (`availability_status`) and surfaced honestly, not silently dropped. (Post Office Horizon: OGL v3.0 verified at `/terms-and-conditions`.)

## 5. SCOPE NOTE

This policy governs **evidence**. Inquiry / review **reports** (`inquiry-reports`, `independent-reviews`) are findings published for public consumption and are ingested without the §0 filter (they are the inquiry's own considered, redaction-cleared output).
