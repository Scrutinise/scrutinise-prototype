# LEX 26-T REPORT — making sense of the set

*Started 2026-10-18. Batched report (BRIEF_26T §0). Updated as each push lands.*

## A. Size and split (reported before building, as §0 asks)

| Sprint | Contents | Why together |
|---|---|---|
| **26-T1** | §2 digest (per heading + whole set; four models + judge; `ActionDigest`; stale marking; gaps become suggestions; proposed conditions) and §3 incentive map ("By who" view, "What changes it", checklist line; annexe text builder shared with T2) | Both read the same per-action slots; the digest is the only new schema. The map is a pure view over step-2 slots (decision 203), so it needs no migration. |
| **26-T2** | §4 Actions Pack (ninth document kind, B.3.6 numbering, Word + PDF) and §5 Background Report, Introductory Summary, "Considered, not taken", team-roles report; §6 comments on an action | All three are documents built from one kernel reader; §6 reuses the notebook reply rules. |
| **§7 housekeeping** | 196/183 five hard-delete paths (~8–10 h), 11d (held for Charlie's second-account test), known-red suites, snapshot tokens before/after, entity list Section 24 | 196/183 placed between T1 and T2; 11d NOT started. |

### What is reused (so the sizes above are honest)

- `lib/lex/gap-check.ts` — the four-model + combine + hold-as-suggestions pattern, one-run-at-a-time marker row, cost summing.
- `lib/lex/guiding-policy-consolidate.ts` — `PREMIUM_DRAFT_MODELS`, `DRAFT_REASONING_EFFORT`, panel fallbacks (decision 117).
- `lib/documents/*` + `app/api/ideas/[id]/document/route.ts` — existing document kinds, stage banner, `[Ref: n]`.
- `lib/lex/action-slots.ts` / `action-record.ts` — Who / Incentive now / What changes it / How / Against slots the map reads.

### Prices

None measured yet. Every button will show "measured (n=…)" or "estimate". Nothing over ~5p is run without asking (decision 121).

## B. Progress

### 26-T1 (18-19 Oct 2026) - built; see the top CHANGE_LOG entry

- **Digest and incentive map:** done as in the CHANGE_LOG. `check:lex-26t1` 98/0, 9 controls, 0 dead, 4 NOT RUN (named in the script).
- **Measured prices (n=1 each):** heading of 8 actions 45.2p / 266 s; whole set 74.3p / 353 s (floor: grok-4.7 timed out at 265 s); judge fixture 2.95p. Both buttons show these and ask first.
- **Decisions for CCh / Charlie:** (1) set digest: Grok's timeout (265 s) sits just under the 300 s route limit; the digest keeps the three that answered and offers "Ask the ones that failed again". Raise the limit, drop Grok's extra headroom, or accept? (2) Glyphs: the map uses the brief's ▲ ▼ ○ —; step 2's own slots use ✓ ✗ ○. (3) A model's proposed condition is written to the conditions panel as a proposal when the judge finishes (not on a further press).
- **Not done in T1:** a real-browser check (`check:lex-26t-browser`); Lex chat tools for the digest; the worker path.
- **Section 7:** 196/183 hard-delete paths, 11d, snapshot token count: not started. 11d stays held for the second-account test.
- **Next:** 26-T2 (Actions Pack, Background Report, Introductory Summary, comments).

### 26-T2 (19 Oct 2026) - built; see the top CHANGE_LOG entry

- **§4 Actions Pack, §5 Background Report / Introductory Summary / Considered not taken, §6 comments:** done as in the CHANGE_LOG. `check:lex-26t2` 72/0, 6 controls, 0 dead, 4 NOT RUN. Live generate -> R2 -> download for all three kinds: 24/0 (`scripts/measure-lex-pack.ts --thread`).
- **What the generator did with a markdown table (asked for in §4d):** it FLATTENED it - `markdownToBlocks` had no table case, so a table became one run-on paragraph with its pipes in it, in Word and in the PDF. Fixed: a `table` block, a real Word table, a ruled grid in the PDF.
- **Numbering choice (CCh to confirm):** "B.3.6" is read as heading B, the action's place *within that heading* in print order, section 6. Eleven fixed sections per action, always printed. Preamble paragraphs are 0.n, a digest is H.D.n, Incentives INC.n, Considered-not-taken NOT.n.
- **Issue -> action link (§5a):** the record has no such link. The report shows an action against an issue only where a note in the record bears on both; otherwise "no action is recorded as meeting it". A real mapping needs either Lex proposing links (a model step, not built) or a new field. **Decision wanted.**
- **Team roles (§5d, report only):** contributor / reviewer are not roles in the code today. The Team tab holds collaborators (`authorizeIdea` = owner or collaborator, no distinction between them); a collaborator's notebook note is UNREVIEWED until the owner puts it in the record, and only the record reaches a document (`putInRecord` is owner-only). That already behaves as a reviewer's *comment*: it is visible to the team, waits for the owner, and is never in a printed document unreviewed. So: **reviewer = a collaborator whose notes stay unreviewed** (no new role needed for the comment thread); **contributor = the owner's co-author, who would need `putInRecord` rights and does not have them.** The Private Scrutiny stage (4) is where a first recorded review would live; nothing in T2 gates on stage. Controls wait for Stage 4, as the brief says.
- **Public share links:** the three new kinds are refused there (they carry digests, notes and who-is-against-what).
- **Section 7:** snapshot - code untouched; measured now 7,929 tokens (Gemini count; ≈8,978 by chars/4) on 452c5ade after Consolidate (58 live). Not comparable with the earlier 15,488, taken with 174 live actions. 196/183 (five hard-delete paths) and 11d: **not started** (11d still waits for the second-account test). Known-red suites: two stale fixtures fixed (26h, 26s2-structure); the data-dependent ones listed in the handoff remain.
- **Not done:** a real-browser check for T1 and T2 (`check:lex-26t-browser`); Lex chat tools for the digest, the pack and threads; saved selections and Word-comment import (the brief defers them).
