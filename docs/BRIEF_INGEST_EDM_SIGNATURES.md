# BRIEF — INGEST: THE 2.06 MILLION SIGNATURES WE NEVER TOOK

**For:** CC-Ingest
**Written:** 8 September 2026, by CCh-Search
**Executes:** `SURFACE_4_REPORT.md` decision 1 — **Charlie has approved it**
**Format:** audit-then-build. No git during the sprint; one **`commit-ingest-edm-signatures.sh`** at
the end. Scoped commits by explicit path.

---

## §0 — WHAT IS MISSING, AND WHY IT IS THE CHEAPEST LARGE GAIN AVAILABLE

**What a user sees today.** They open an idea, reach *"key people and groups"*, and see **one name**.
Not a shortlist — one. Where the same panel on a division shows 189 to 254 people.

**The cause, measured:**

```
edm_sponsor        60,995 rows over 60,995 motions   = 1.00 per motion
sponsors_count     2,125,547 signatories PUBLISHED   = 34.8 per motion
motions with more than one signatory                   58,193
```

**We hold the member who *tabled* each motion. We hold none of the roughly 2.06 million people who
signed them.**

⚠ **And the design calls this signal the strongest voluntary evidence we have.** Signing an early day
motion is unwhipped, costless to refuse, and entirely deliberate — which is why it is weighted above
a whipped vote and just below a rebellion. **We have never had one.**

**Most ideas match a motion rather than a division**, so this is not an edge case: it is why the
positions surface looks thin on most of Charlie's ideas.

⚠ **It also corrects a wording error.** The coverage statement described this layer as *"signatures
on early day motions"* when it holds sponsorships. **Describing a limit as a result** — SURFACE 4
fixed the wording; this sprint makes the description true.

---

## §1 — AUDIT FIRST

1. **Confirm the source and its shape.** Parliament publishes signatories through its own API. Report
   the endpoint, the fields available per signature, and whether it carries the **date signed** —
   ⚠ **the date matters**: the design's decay applies to when the act happened, never when we
   ingested it, and a signature added two years after a motion was tabled is a different fact from
   one added on day one.
2. **Establish what identifies the signatory.** The member id, or a name? ⚠ **If a name, stop and
   report.** Never merge two identities on similarity — an unresolved name stays unresolved and is
   counted. A wrongly merged one is a person who does not exist holding contradictory views, and
   nothing looks wrong.
3. **Is the sponsor distinguishable from the signatories?** Tabling a motion and signing it are
   different acts and should not be flattened. Report whether the source distinguishes them and how.
4. **Cost it:** requests, rate limit, elapsed time, storage. ⚠ **No model spend is authorised** — this
   is a fetch and an insert.

▶ **Report §1 before the bulk run.** If the source does not carry dates or member ids, this is a
different sprint.

---

## §2 — INGEST, AND WIRE THE SIGNAL

- Store one row per signature: the member, the motion, and the **date signed**.
- Create the signal per the position graph's own schema: `evidence_ids` **never empty**, `observed_at`
  the date signed, `derivation` naming the method and version.
- ⚠ **Keep sponsorship and signature as distinct signal types.** They carry different weights — the
  member who tabled a motion did more than the member who signed it — and merging them would lose
  that permanently.
- ⚠ **Recompute estimates after loading, not during.** The signal layer is immutable and the estimate
  layer is derived; that separation exists precisely so a large load is safe. Every estimate row
  carries the config version that produced it.
- ⚠ **Establish who else reads the estimate table before rebuilding it.** GRAPH 3B truncated it and
  left it half-rebuilt by optimising one access pattern without asking who else read the same object.

---

## §3 — VERIFY THROUGH THE PLATFORM, NOT THE DATABASE

- **Hand-check 30 signatures against Parliament's own page for that motion.** A count of rows
  inserted proves nothing about what is in them.
- **Then open the positions surface on a real idea whose target is a motion** and report what a user
  now sees. **The prediction to record before running: an early day motion goes from 1 actor to
  roughly 35.** ⚠ That is the number to score against, and it is a floor rather than a target — some
  motions have hundreds of signatures.
- ⚠ **Check the ranking sentence still travels.** SURFACE 4 found that correct ordering data had been
  computed and then dropped by two separate assemblers, so five alphabetical names printed as though
  they were the significant people. **With 35 actors instead of 1, that sentence becomes load-bearing
  rather than pedantic.**
- **Report the effect on the coverage statement**, which is generated from live state and must now
  describe signatures rather than explaining their absence.

---

## §4 — WHAT THIS DOES NOT DO

- ⚠ **A signature is a position on the motion, not on a user's proposal.** The design holds positions
  toward **concrete things** and never toward topics; nothing here changes that.
- No new scoring, no new weights. The estimates remain unvalidated and the coverage statement says so.
- No backfill of anything else.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-ingest-edm-signatures.sh`; nothing owned by search, graph
  or lex edited — report the change needed instead.
- Predictions in `CHANGE_LOG.md` before the run; **every guard states what it counted.**
- Bytes before hypotheses: read rows back against the source page.
- ⚠ **Tell CC-Search and CC-Surface when this lands.** It changes what the positions surface shows and
  what the coverage statement says, and either could be mid-measurement.
- **Report `docs/INGEST_EDM_SIGNATURES_REPORT.md`:** the audit, then rows loaded against the 2.06m
  published figure **as a percentage**, with the residual and why. Then the hand-check result. Then
  what a user now sees on a named idea. Then what is NOT done, named. Decisions for Charlie as
  numbered questions with a recommendation and the consequence of each option.
- Change-log and handoff entries labelled **INGEST**.
