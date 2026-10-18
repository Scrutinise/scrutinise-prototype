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
