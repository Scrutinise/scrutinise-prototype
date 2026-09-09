# CCW-B18 §2 — predictions, recorded before the M-02 re-run

**2026-09-09 03:36 UTC.** Written before the build was enqueued, so the result can be scored
rather than narrated. Machine clock cross-checked against an HTTP `Date` header before stamping.

---

## What was found, and what is being tested

`kernelText(ideaId)` assembles the string that **all four** of the build's self-critique passes
reason over — `SMART`, `KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL`. It read the canonical
`Idea` columns. A build never writes those: `diagnosisPass`, `approachPass` and `actionsPass`
write through `setProposal`, which puts the text in `IdeaFieldState.proposal` and leaves the
column alone until a human accepts the field.

Measured across every idea in the database with a completed build, 9 September 2026:

| | |
|---|---|
| ideas with a DONE build | 16 |
| with a **complete** kernel in the columns `kernelText` read | **0** |
| with **zero** of the seven kernel columns populated | **15** |
| `rootCause` / `pivotalObstacle` / `summaryDiagnosis` / `chosenApproach` / `summaryGuidingPolicy` / `summaryCoherentActions` populated | **0 of 16 each** |
| the same seven fields present in `IdeaFieldState` | **16 of 16 each** |

So the four critique passes have been marking a title, a list of causes and a list of actions.
The Equality Act's verdict — *"This kernel is not a strategy… It fails to state the problem this
repeal would solve, provides no diagnosis of why that problem exists or persists, and offers no
guiding policy to frame the actions"* — is an accurate reading of an input that was missing all
three. The build had written all three.

⚠ **`SMART` does not merely judge, it rewrites.** M-02 v1 reports *"5 fields rewritten"*. So the
build has been revising a drafted kernel to satisfy a critique of an absent one.

**The change:** `kernelText` now reads the field's current wording — its ACCEPTED value where the
proposer has accepted one, otherwise the standing proposal — through a new shared reader,
`currentFieldValues` in `field-machine.ts`. Nothing else is altered.

The same twelve measures, read cold, before and after:

| | before | after |
|---|---|---|
| kernel string, M-02 | title + 2 causes + 4 actions | **7,453 chars, all seven sections** |
| measures carrying all seven kernel sections | 0 of 12 | **12 of 12** |

---

## The run

**M-02, the Equality Act.** Chosen because its failure is the one CCW-B18 §2 quotes, so its
baseline is on the record: `KERNEL_CHECK` **2 of 9**, `LOGIC_CHECK` *"the chain does NOT hold"*
with two named defects, `SMART` verdict **WEAK**, `ADVERSARIAL` 6 issues.

⚠ **Single variable.** No critique is fed back on this run, the elicitation is untouched, and the
retrieval configuration is forced to the worker's five streams. The only thing that differs from
v1 is what `kernelText` returns. B17 §1 published a cross-measure comparison and had to label it
*"suggestive, not measured"* for exactly this reason; this one is meant to be measured.

## Predictions

| # | Prediction |
|---|---|
| **P-1** | `KERNEL_CHECK` passes **6 or more of 9**, against v1's 2 of 9. |
| **P-2** | Both of `LOGIC_CHECK`'s named defects disappear — *"describes what the PSED is but fails to state why it is a problem"* and *"There is no diagnosis of a pivotal obstacle"*. Each names a field that was simply absent from the input. |
| **P-3** | The `SMART` verdict is better than **WEAK** (and is not `NOT_A_KERNEL`). |
| **P-4** | **No prediction on `ADVERSARIAL`'s issue count.** A hostile clerk given eight times as much text may reasonably find *more* to attack, not less. A prediction in either direction here would be a guess dressed as a hypothesis. |

⚠ **What would refute the diagnosis:** if `KERNEL_CHECK` stays at or near 2 of 9 with the full
kernel in front of it, then the kernels really are weak, the read path was not the cause, and the
36–48 iteration builds CCW-B18 §2 asks for are the right spend after all.
