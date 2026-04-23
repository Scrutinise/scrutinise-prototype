# Decision Analysis Integration — Design Note

**Status:** Draft for discussion **Date:** 21 April 2026 **Author:** CCh (design), Charlie (product owner) **Scope:** Proposal for integrating Decision Analysis (DA) as an optional deepening alongside the Rumelt Strategic Kernel **Intended scope for implementation:** V2.5 or V3 — not V2. V2 priorities (legislative corpus ingestion, new-user UX, kernel expansion) should not be displaced.

***

## 1. Purpose of this note

This note stress-tests whether Decision Analysis earns a place in Scrutinise before any implementation commitment is made. It sketches:

-   What the usable core of DA actually is
-   Which user groups would reach for it
-   Where it slots into the existing five-stage pipeline
-   What the data model implications are
-   Whether heavy computational tooling (Monte Carlo etc.) is warranted
-   What Lex's role would be
-   Where the design should be challenged

It is deliberately a design note, not a specification. If the idea survives scrutiny, a full spec follows.

***

## 2. What Decision Analysis actually is (the usable core)

The full Stanford/Howard tradition is vast — influence diagrams, multi-attribute utility theory, value-of-information calculations, the whole apparatus. Most of it would be overkill for Scrutinise. The usable core — the part that genuinely helps policy thinking — is smaller:

1.  **Frame the decision.** What are we actually choosing between? Not "should we do X" but "should we do X, or Y, or Z, or nothing at all".
2.  **Clarify objectives.** What are we trying to achieve, and how do we weigh competing goals against each other?
3.  **Name the uncertainties.** What don't we know that would change the answer?
4.  **Structure the logic.** How do the alternatives, uncertainties, and outcomes connect?
5.  **Evaluate.** Under each plausible scenario, which alternative looks best, and by how much?
6.  **Sensitivity-test.** What would have to be true for us to change our mind?

Steps 1–3 and 6 produce the most insight per unit of user effort. Steps 4–5 can be done lightly (qualitative scenarios) or heavily (probability trees, Monte Carlo). That distinction is the key design question and is addressed in Section 6.

### How DA complements Rumelt

Rumelt's Strategic Kernel is a **structure-of-argument** framework: here is the problem (Diagnosis), here is the approach (Guiding Policy), here are the committed moves (Coherent Actions). It forces clarity about *what* you're doing and *why the logic holds together*.

What Rumelt doesn't do well is help a user choose *between* several internally-coherent kernels when they face genuine uncertainty. A user can produce a beautifully coherent kernel built on false assumptions and never be forced to examine those assumptions.

DA is built for exactly that gap. Its core contribution is **making the hidden explicit**: the alternatives considered and rejected, the objectives and their relative weights, the uncertainties that could flip the answer.

The two frameworks are complementary rather than competing. Rumelt gets the user to a coherent position. DA pressure-tests whether that position survives serious scrutiny.

***

## 3. Who would actually use it

This is the question that determines whether DA earns its place. Sketch of likely user groups (subject to refinement once Charlie shares formal segmentation):

| User group                         | Engagement depth | Likely DA usage                                                              |
|------------------------------------|------------------|------------------------------------------------------------------------------|
| Engaged citizens with a bugbear    | Shallow          | None. Would be put off if shown too early.                                   |
| Campaigners and activists          | Medium           | Light use — mainly framing (step 1) and anticipating opponents (step 3)      |
| Policy wonks and think-tankers     | Deep             | Core audience. Will use DA seriously.                                        |
| Academics and researchers          | Deep             | Will use DA and judge the platform on whether it does it well.               |
| MPs, staffers, civil servants      | Variable         | Will value DA as a credibility marker whether they use it personally or not. |
| Hostile critics / opposing lobbies | Adversarial      | DA channels their attack into structured form, which is productive.          |

**Pattern:** DA is for the top third of users by engagement depth. It serves two functions simultaneously — a signal to serious users that the platform takes rigour seriously, and an invitation for them to invest more. The bottom two-thirds shouldn't see it until they've earned their way to it.

This aligns directly with the "dance of the seven veils" design philosophy: DA is a late veil, not a first-page feature.

***

## 4. Where DA slots into the user flow

Current pipeline: **Create → Draft → Develop → Campaign → Parliament**.

DA fits at **Develop**, as an optional deepening rather than a replacement for the kernel.

-   **Create** — untouched. User has a seed idea.
-   **Draft** — Rumelt-lite. User builds Diagnosis, Guiding Policy, Coherent Actions. No DA yet.
-   **Develop** — DA becomes available once the kernel is complete. Lex offers: *"Your Guiding Policy is X. What serious alternatives did you consider and reject? What uncertainties would change your mind?"*
-   **Campaign** — benefits from DA having happened (outputs are more defensible) but doesn't require DA steps.
-   **Parliament** — same. A DA-refined idea reaches Parliament with its assumptions and uncertainties surfaced, which is exactly what Parliamentary scrutiny demands.

### Triggers for surfacing DA

Three candidates, layered:

1.  **Kernel-completion trigger (primary path).** When a user finishes a Strategic Kernel at Develop, Lex asks whether they want to pressure-test it. If yes, DA begins.
2.  **Credibility trigger.** When a user reaches a credibility threshold (say, a defined Thinker-points level), DA becomes visible in their toolkit as "unlocked". Reinforces that it's for serious contributors. Fits the veils philosophy — earned access, not universal access.
3.  **Contested-idea trigger.** When an idea draws sustained critical engagement from other users (disagreement, challenges, alternative proposals), Lex suggests DA as a way to structure or resolve the disagreement. This is the most interesting trigger because it makes DA feel like a response to real argument rather than an academic exercise.

Recommendation: all three, in the order above. Trigger 1 is the default invitation. Trigger 2 gates the deeper features. Trigger 3 is contextual and surfaces DA exactly when it's most useful.

***

## 5. Data model implications

DA adds a parallel structure that references the Strategic Kernel rather than replacing it. None of the existing Rumelt entities are disturbed.

### Proposed new entities

-   `DecisionAnalysis` — top-level container, one-to-one with an `Idea`. Holds metadata: started-at, completion status, confidence rating, share visibility.
-   `Alternative` — a Guiding Policy that was considered and either selected or rejected. Belongs to an `Idea`. Fields: description, status (chosen/rejected/under-consideration), why-rejected, links to the `Objective`(s) it scored worse on. Plural per idea — serious DA considers at least two or three.
-   `Objective` — what the user is trying to achieve. Belongs to an `Idea`. Fields: description, weight (relative importance), direction (maximise/minimise). Introduces multi-attribute thinking; most policy decisions trade off multiple goals.
-   `Uncertainty` — a named unknown that affects the decision. Belongs to an `Idea`. Fields: description, best-estimate, plausible-range, which `Alternative`(s) it affects. The core DA contribution Rumelt lacks.
-   `Scenario` — a specific combination of uncertainty values. Belongs to an `Idea`. Links to multiple `Uncertainty` records with specific values, and records which `Alternative` looks best under that scenario. Enables sensitivity analysis.

### Relationships

```
Idea 1 ─── 1 DecisionAnalysis
Idea 1 ─── * Alternatives
Idea 1 ─── * Objectives
Idea 1 ─── * Uncertainties
Idea 1 ─── * Scenarios
Scenario * ─── * Uncertainty (through scenario_uncertainty_values)
```

### What this enables

-   Users can articulate "here's my policy, here are the two I rejected, here's why, and here are the three things I'm uncertain about that could flip my view".
-   Other users (Thinkers, in credibility terms) can challenge specific `Alternatives` or `Uncertainties` rather than attacking the whole kernel. Disagreement becomes targeted rather than diffuse.
-   Lex can prompt sensitivity questions: *"You've said outcome X depends on uncertainty Y. If Y turned out to be at the low end of your range, would you still prefer this Alternative?"*
-   The credibility system gets natural hooks:
    -   **Thinker points** for well-structured `Uncertainties` that others engage with productively
    -   **Strategist points** for `Alternatives` that are genuinely plausible rather than straw men
    -   **Rallymaster / Rainmaker points** remain tied to Campaign-stage engagement and are unaffected

### Migration impact

None. DA entities are additive. The existing Rumelt kernel continues to function for users who never touch DA. This matters given V2's kernel-expansion workstream is already in flight — the two efforts do not collide.

***

## 6. Monte Carlo and heavier computational tooling — recommendation

**Short answer: no, not for V1, and probably not ever in the form that phrase usually implies.**

### When Monte Carlo is actually useful

-   Well-quantified probability distributions over inputs
-   Complex or non-linear relationships between inputs and outputs
-   Need to know the shape of the output distribution, not just central tendency

Almost no policy idea on Scrutinise will meet these conditions. Policy uncertainties are usually qualitative ("will this change public behaviour?"), not parameterised distributions. The tiny minority of users capable of meaningful Monte Carlo already have better tools than anything we'd build in-browser.

### Recommended tooling ladder

In rough order of sophistication:

1.  **Qualitative scenarios — build this.** User names 2–4 scenarios in plain English ("optimistic", "central", "pessimistic" or user-defined equivalents), describes what each assumes about the uncertainties, and records which `Alternative` looks best under each. Low tech, high insight. This is where most real-world DA lives, including inside government.
2.  **Ordinal objective weighting — build this.** User assigns rough importance weights to `Objectives` (e.g. 1–5 scale). System can show whether the preferred `Alternative` is robust across different weightings. No probability theory required.
3.  **Tornado sensitivity diagrams — nice to have later.** For each `Uncertainty`, visualise how much the answer changes when it's pushed to its high/low bound. Easy to compute, visually powerful, no Monte Carlo needed.
4.  **Full Monte Carlo — don't build.** Users who genuinely need this should use R or Python. Scrutinise should let them *upload* or *link to* an external analysis as evidence, but not host the computation. Trying to be a numerical computation platform means competing with spreadsheets — a losing position.

### The credibility argument

Building light, well-designed qualitative DA is **more impressive** than building clunky quantitative DA. The best decision analysts in government and consulting do the majority of their work in structured qualitative form. Emulating that well is a distinctive position and fits the aspirational-quality framing. Trying to be a Monte Carlo tool would be competing with Excel and Crystal Ball and losing to both.

***

## 7. Lex's role

Lex would need a DA sub-prompt, invoked when a user enters the DA flow at Develop. Its responsibilities:

-   Help the user name genuine `Alternatives` (not straw men). Push back when alternatives look too weak to be real contenders.
-   Clarify `Objectives` and prompt for honest weighting.
-   Surface `Uncertainties` the user hasn't articulated — especially ones where the user's confidence seems higher than the evidence warrants.
-   Build `Scenarios` that meaningfully differ from each other.
-   Run sensitivity challenges: *"If this uncertainty went the other way, would you still recommend this policy?"*

Style: Socratic. Asking the questions, not giving the answers. Same ethos as current Lex, different toolkit.

The existing LexInsight system pays dividends here. Well-written DA insights (approved rules) raise Lex's quality across the whole DA flow without prompt rewrites. Worth noting: the 50-rule cap already flagged in V2 may need revisiting once DA insights start accumulating. Could argue for a separate rule pool per flow (Draft-Lex, Develop-Lex, DA-Lex) rather than one shared cap.

***

## 8. Open questions and places to push back

Three places where this proposal should be challenged before it becomes a spec:

1.  **Is DA actually a differentiator, or a feature that's intellectually pleasing but commercially marginal?** Belief: it's a differentiator for the top-third audience and a credibility signal for everyone else. Needs validation against the competitive landscape and funder/advocacy expectations.
2.  **Is "Develop" the right placement, or should DA frame the whole platform?** There's an argument for pushing DA earlier — making it the *defining* lens of Scrutinise rather than an add-on at stage three. That would be a bigger commitment and a different product. The current proposal is conservative.
3.  **Is the cognitive-load cost worth the credibility gain?** Four new entities deepen the platform but risk making it intimidating. The veils philosophy says we can hide DA until earned, but even hidden features have maintenance, documentation, and testing cost.

***

## 9. Recommended next steps

1.  Charlie shares the user-group segmentation with expected first-visit expectations per group.
2.  This note is reviewed against that segmentation — does DA actually serve the groups we're prioritising, and does it sit at the right veil?
3.  If yes, this design note is upgraded to a full specification alongside the V2 Sprint plan, scoped as **V2.5 or V3** so it doesn't displace the legislative corpus ingestion or UX workstreams.
4.  If no, this note is archived with a note on why it was deferred or rejected. Either outcome is valid.

***

## Appendix A — Decision Analysis resources for reference

For future reading or linking from the platform:

-   Ron Howard and Ali Abbas, *Foundations of Decision Analysis* — the canonical Stanford treatment
-   Douglas Hubbard, *How to Measure Anything* — accessible treatment of uncertainty quantification
-   Carl Spetzler et al., *Decision Quality* — practitioner-oriented, closest to the framing used in this note
-   HM Treasury Green Book — UK government's own appraisal and evaluation guidance; a natural reference point given Scrutinise's Parliamentary focus

***

*End of design note.*
