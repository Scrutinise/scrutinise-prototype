# §19-B — Sprint 3-B: fixes from pass-1 testing (1 Aug, "VAT on care home renovations" test)

**Context.** Charlie ran the first end-to-end pass. Page 1 works well. Three defects follow, in severity order. Un-promoted preview; usual git discipline; one `commit-all.sh`; do **not** promote. Record new rules in `LEX_PLAYBOOK.md`.

**The headline, named plainly:** in the test, the chat walked into Diagnosis while the middle panel stayed dead — Lex asked Diagnosis questions, nothing was written to any field, and the field cards rendered with no Save buttons. That is the *conversation-diverging-from-state* class of bug — the exact class the rebuild exists to make impossible. Whatever the specific cause, the fix must restore the invariant: **the chat can never be on a different page than the state machine.**

***

## Task 1 — Page 2 breakdown (diagnose first — bytes before hypotheses)

**Symptom (screenshot 3):** user pushed into Diagnosis via chat; Lex asks challenge/affected questions; middle panel shows the Diagnosis fields but inert — no proposed content ever lands, and **no Save/action buttons render** on any Page 2 field card.

**Diagnose before touching code.** Pull the `[lex-diag]` trail for the test idea and answer, in order:

1.  Did `Idea.lexPage` / `stage` ever advance to DIAGNOSIS — or did the user's chat push leave state on Page 1 while Lex conversed ahead? (If so: how did the /lex prompt come to contain Diagnosis framing — did the method layer / conductor message leak Page 2 content while `currentField` was still Page 1/null?)
2.  On a Page-2 chat turn, what `currentField` did /lex build the prompt with? Did Lex emit a proposal with a Page-2 `fieldKey`? Did the route persist it, or discard it (schema mismatch? fieldKey not current?)?
3.  Why do Page-2 field cards render without action buttons — status value the renderer doesn't handle, a field `kind` branch in `FieldsPanel` missing its buttons, or the cards rendering from a page the state says is still locked?

Report the found cause in the CHANGE_LOG entry, then fix. The fix must satisfy:

-   **One code path for stage advance.** The Background-panel CTA and any chat-expressed intent to continue ("let's move on", "continue", "next") must trigger the *same* deterministic server-side stage advance. A chat push while the stage hasn't advanced = the platform advances the stage first, then Lex proceeds. Lex must never conduct Page-2 conversation while state sits on Page 1. `// Invariant: chat page == state page, always. If they can diverge, the bug will recur somewhere else.`
-   Chat answers on Page 2 produce proposals into the correct Page-2 fields (structured slot maps per §19-A A1), boxes render them "proposed by Lex", Save accepts — identical behaviour to Page 1.
-   Every Page-2+ field card exposes the action buttons appropriate to its kind (Save / Save & accept / Skip; add-cause etc. for the loop) in every non-terminal status.

## Task 2 — End-of-Page-1 wrap-up + transition affordance

**Symptom (screenshots 1–2):** after the briefing pointer, the flow just stops — no explanation of what the briefing is for, no lead-on, no visible action; Charlie had to push. (If the right-panel CTA rendered, it was not discoverable — the chat, where the user's attention lives, offered nothing.)

Implement, on Orientation completion + briefing ready, the conductor posts **two bubbles, verbatim**:

>   That completes the first section — the bare bones of your idea are down. I've also put together an initial background briefing in the legislation panel on the right. It's preliminary research: a first look at what's already out there — the law, what Parliament has said, and a few threads worth pulling — to spark ideas for further investigation. We'll refine and deepen it as we go.

>   From here the real work starts. Over the next three sections we'll establish what's actually causing the problem, find the points of leverage for solving it, weigh the alternatives and choose the strongest solution, and build a robust, defensible case for the one you propose. Ready to start the diagnosis?

-   The second bubble carries an **inline "Continue to Diagnosis" action in the chat** (same inline-confirm pattern as Title/Keywords), in addition to the existing right-panel CTA. Both call the same advance path (Task 1).
-   Typed assent ("yes", "let's go", "continue") also triggers the advance — via the platform, per Task 1.

## Task 3 — Signify the stage shift visually

**Symptom (screenshot 2):** entering Diagnosis looks identical to being in Page 1; nothing marks the shift.

-   **Per-stage accent colour** applied on stage entry: active-section border and the middle-panel stage header pick up the stage's accent (choose a restrained 4-colour set consistent with the existing design system; record the mapping in the playbook).
-   Middle panel on entry: the new stage's header moves to the top (existing auto-scroll), completed stages collapsed (existing accordions), and the **new stage's upcoming fields render greyed-out/queued** beneath the active one, so the user sees the shape of what's coming.
-   Chat: a slim stage divider ("— Diagnosis —") where the transition happened.

## Acceptance criteria

-   Replaying the same test: at end of Page 1 the two wrap bubbles appear with a working inline Continue; clicking it (or typing assent, or using the panel CTA) advances the stage — one code path, confirmed in `[lex-diag]`.
-   On Page 2, a chat answer lands as a proposal in the correct field; every field card shows its action buttons; Save advances per save-before-advance.
-   It is impossible to get Lex conversing on a page the state machine hasn't entered — verified by attempting the chat-push route from a fresh idea.
-   The Diagnosis entry is visually unmistakable (accent, header, queued fields, chat divider).
-   Cause of the Task 1 breakdown documented in CHANGE_LOG.

**Out of scope (noted, no action):** search-result relevance (one good parliamentary-debate hit, rest unrelated) — that is pass-2 / search-workstream territory (vector + freshness sprint), not a Lex defect.
