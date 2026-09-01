# BRIEF — Sprint 25-R: three shipped features that render nothing

**Thread:** LEX. **Written:** 1 September 2026, afternoon.
**Source:** Charlie's browser walk of production at 13:00–13:41 today, on **two** ideas — the walkthrough
idea and a brand-new one created from scratch. Production has been serving `a1e2a1c` since 12:17, so
every screenshot below is of current code.

## §0 — Run mode

**Diagnose first. Do not fix anything in §1–§3 until all three are reported.** ⚠ Three sprints in a
row have shipped a feature that passed its checks and displayed nothing to the user. The point of
this sprint is to find out why that keeps happening, not to patch three symptoms.

Continuous otherwise: record in the CHANGE_LOG, proceed, batch the report. **Stop only for** spend or
scope.

⚠ **For each of §1–§3, write a check that goes RED against production as it stands today, and show
it red, before writing any fix.** CLAUDE.md §25 was added last sprint and says a check must assert
the data present in the rendered output. It was added by the same thread whose next two sprints
shipped features that render nothing. A rule nobody applies is not a rule.

**Must not be disturbed:** everything 25-Q shipped on Stage 1, which Charlie has confirmed working —
the "Re-run finished · Go to the Strategy" banner, the "Anything else you want me to take into
account this time?" box, the file-and-link block at the top, the pill hint, and the allowance
wording. Also confirmed working: the smart pass's "This changed the proposal's position, and nothing
was weighed against it" line, and "See it as others would" at the foot of a finished build.

---

## §1 — The commentary is generated, costs money, and appears nowhere

**Evidence, from the Stage 1 document of a new idea built today:**

> Describing the terrain — *Reading the causes as a SET rather than one at a time: what the evidence
> says, where the sources disagree, how complex this is, and how the pieces relate.*
> **Described the terrain across 4 causes — 2 points where the sources disagree**
> read by gemini-2.5-pro · 5,116 in / 2,269 out — **2.3p**

So the pass ran, spent 2.3p, called the most expensive model in the build, and produced 2,269 tokens
of output that found two points of conflict. ⚠ **Charlie cannot find it anywhere in the product, and
it is not in the generated document either — only this one-line summary of it.**

**1a. Establish where the commentary text is written**, and whether anything reads it. Report the
storage location, the read path if there is one, and the render site if there is one.
**1b. Report which of the three it is:** written and never read; read and never rendered; or rendered
somewhere Charlie would not think to look. ⚠ **These have completely different fixes and CC should
not guess between them.**
**1c. Only then**: it renders at the top of the causes section, before any choice is offered — which
is what 25-O §5 specified and what Charlie's walkthrough asked for.

⚠ **This is the third instance of one class**: `resumable` sat in the API payload rendered by
nothing; priority sources were written under one key and read under another; now this. **Say in the
report whether these three share a root cause or are three coincidences.**

## §2 — The guiding policy shows none of what 25-P built

**On both ideas, the candidates render as a plain list of paragraphs labelled CANDIDATE.** No
numbers. No sort into policies, coherent actions and restated goals. No reasoning shown. No
relationship between them. No merge control.

25-P reported all of this as built, checked (`check:lex-25p` 72/0/24) and live. Charlie sees none of
it, on an idea created after 25-P shipped.

**2a. Establish whether the sort and the numbering ran on this build at all** — is the data absent,
or present and unrendered?
**2b.** If present, report the render path and where it breaks.
**2c.** If absent, report what the build should have done and did not. ⚠ 25-P itself found that the
causal link was set on **zero of eighteen rows** and that the sort now assigns it as Lex's
judgement — check whether that assignment is actually running in a build, or only in the code path
the checks exercise.
**2d.** Report whether the candidates shown are produced by the same code 25-P modified, or by an
older path that 25-P never touched. ⚠ **This is the likeliest single explanation and should be ruled
in or out first.**

## §3 — Lex still tells the user to do it themselves

Charlie asked Lex, in the chat, to combine two candidate guiding policies. Lex produced a good merged
policy — and then said, in substance, that if he wanted it in his proposal he should navigate back to
The Strategy stage, find the Guiding Policy section, and add or amend it there.

That is the exact failure 25-Q §1 was written to fix, and 25-Q reported it fixed: *"Lex now offers a
rewrite as a card showing what the box says now beside what would replace it."* No card appeared.

**3a. Establish why the offer did not fire.** 25-Q's own diagnosis said the write is gated on the
current field, and reported `currentField` measured as `policyOptions` on Charlie's idea. Report
what `currentField` actually was at the moment of this exchange.
**3b. Report whether a *merge of two candidates* is a case the offer handles at all**, as distinct
from a rewrite of one field. ⚠ A merge changes a list, not a value. **If the offer only covers
single-value fields, say so plainly — that is a design gap, not a bug, and it is Charlie's decision
what to do about it.**
**3c.** ⚠ **Lex must never instruct the user to go and do by hand something the product can do.**
Wherever Lex cannot write, it should say it cannot write and why — not send the user on an errand.

## §4 — The systemic question, and it is the point of the sprint

Three features. Three passing check suites. Three things the user cannot see.

**4a.** Report, for §1, §2 and §3, **which specific assertion passed while the feature was invisible**,
and what that assertion was actually looking at.
**4b.** 25-P measured that **876 of 1,060 assertions — 83% — cannot see a lookup that misses.**
Report whether the checks covering these three features are inside that 83%.
**4c.** Propose what would have caught all three. ⚠ Not a rule — **a mechanism**. A rule was added
last sprint and did not survive contact with the next two sprints.

## §5 — Acceptance criteria

- For each of §1, §2 and §3: a check that was **shown red against production before any fix**, and
  green after.
- The commentary renders at the top of the causes section on a real built idea.
- The guiding policy renders numbered, sorted, with Lex's reasoning shown, on a real built idea.
- Lex either writes a merge into the panel, or says it cannot and why — and never tells the user to
  navigate somewhere and do it themselves.
- The report states whether the three defects share a root cause.
- The report names which assertions passed while each feature was invisible.

## §6 — Say what only Charlie's browser can confirm

⚠ **And do not report any of §1–§3 as fixed on a render assertion alone.** These three were all
reported as working once already.
