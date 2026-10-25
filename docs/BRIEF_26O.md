# BRIEF — LEX 26-O: one guiding policy, one name, and the cost foundations

**Thread:** LEX. **Written:** 2 October 2026.
**Source:** Charlie's decisions 114–119 on `docs/REPORT_26N_FIELDS.md` and `MODEL_REVIEW_2026-09-30.md`.

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
or scope. ⚠ **Schema and migration in one commit**, applied after `whichdb`. ⚠ **Anything that writes
gets one full run on a scratch idea before it is reported done.** CLAUDE.md §25–§28 apply.

**Order:** §1–§3 (names and readers) → §4 (panel) → §5 (cache and dated prices) → §6 (build test,
which depends on §5).

---

## §1 — Decisions 114 and 115: the names

**1a. "Chosen approach" becomes "Guiding Policy"** — the statement. Everywhere: screen, Lex's
vocabulary, Initial Questions' field labels, every document.
**1b. "Guiding-policy summary" becomes "Summary of Guiding Policy."**
**1c. The build summary's heading "The guiding policy" now prints the statement**, not the summary.
**1d.** For consistency, the other two section summaries read **"Summary of Diagnosis"** and **"Summary
of Coherent Actions"** — ⚠ **unless Charlie objects; report their current labels.**

## §2 — Decision 115: the checks test actions against the statement

⚠ **Every kernel check, repair, adversarial and spawn pass currently treats the summary as "THE
GUIDING POLICY"** (`kernelText`). **Charlie's definition: actions are tested against the principle.**

**2a.** `kernelText` uses the **Guiding Policy statement** as "THE GUIDING POLICY"; the summary is
supplied as context, labelled as the summary.
**2b. Re-run the kernel check on Charlie's idea after the switch** and report any verdict that changed.

## §3 — Decision 116: one answer on the idea page

**The idea page gives three answers to "what is the guiding policy".** Make the Policy tab and the
Overview's "Approach" both read the **statement**. **Retire the legacy `Idea.guidingPolicy` read and
stage gate for Lex-built ideas** — ⚠ **keep it for the 29 legacy showcase ideas that depend on it**
(26-J §1c).

**3a. Also from the report, if not already done:** Initial Questions must not say *"(chosen by Lex)"*
of a policy the user chose; the Meeting Pack and Proposal must not say *"none has been committed to"*
when one is chosen.
**3b. Documents' "Alternatives ruled out"** lists the candidates not chosen at settlement, with the
reason *"not chosen"* — it is currently empty after a consolidation.

## §4 — Decision 117: the price-matched panel

**4a. Consolidation drafts:** `claude-opus-5-5`, `gpt-6.1-sol`, `gemini-3.1-pro-preview`, `grok-4.7`.
**Judge:** `claude-opus-5-5`.
**4b.** ⚠ **The Anthropic client forces a tool, which the newer Claude models reject (400).** Change it
— `tool_choice: auto` or structured output — **and report which, and why.**
**4c.** ⚠ **The newer models ignore "one or two sentences"** — Opus 5.5 wrote six. **Add a length flag
on the statement**, in the same *"flagged for review, not a verdict"* form as the compound flag. The
guiding policy now says *ruthlessly brief*.
**4d.** ⚠ **`gemini-3.1-pro-preview` is a preview.** If it errors or disappears, fall back to
`gemini-2.5-pro` **and say so on the card.**
**4e. The "which model was chosen" record restarts** on the new panel — old results are not comparable.
**4f. Report judge agreement** run to run on the new panel. The current judge gave opposite verdicts on
the same draft twice.

## §5 — Decision 118: cache recording and dated prices

**Before any user price is set.**

**5a. Record cached tokens.** Add `tokensCached` and `tokensCacheWrite` to `LlmSpend`; read Gemini
`cachedContentTokenCount`, OpenAI `prompt_tokens_details.cached_tokens`, Anthropic
`cache_read_input_tokens` / `cache_creation_input_tokens`, xAI `input_tokens_details.cached_tokens`.
Price uncached, cached and cache-write separately.
**5b. Dated prices.** ⚠ **Every rate row carries an effective date.** Gemini 3.x Flash doubles on
**1 January 2027**; today's table would silently keep the introductory rate past midnight.
**5c. Report the corrected cost** of the last seven days once cached tokens are counted — **costs are
currently overstated** wherever a provider caches automatically.
**5d. Report — do not build — where explicit caching would save most** (Anthropic `cache_control`,
Gemini `cachedContents`), with the measured or modelled saving.

## §6 — Decision 119: does the newer Flash build better?

**After §5.** Three builds of **scratch copies** of real ideas on `gemini-3.8-flash`, against the same
ideas' existing builds.

**6a. Report, side by side:** real token volume and cost at the **January 2027 rate**, time, kernel-check
pass rate, citation accuracy, findings count.
**6b.** ⚠ **Quality is Charlie's judgement, not a check's.** Present the two kernels side by side,
unlabelled, for him to read.
**6c. Delete the scratch copies afterwards.** Do not touch the originals.

## §7 — Acceptance criteria

- "Guiding Policy" and "Summary of Guiding Policy" on screen, in Lex and in every document.
- Every kernel check judges actions against the statement; changed verdicts on Charlie's idea reported.
- The idea page gives one answer, from the statement; the 29 legacy ideas unaffected.
- Consolidation runs on the price-matched panel, with a length flag and a stated fallback.
- The ledger records and prices cached tokens; every rate has an effective date.
- The Flash comparison is reported with costs at the January 2027 rate, and the kernels laid side by
  side for Charlie.
