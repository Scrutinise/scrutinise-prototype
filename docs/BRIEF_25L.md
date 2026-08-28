# BRIEF — Sprint 25-L: the re-run dialogue, the resource library, and mobile

**Thread:** LEX. **Written:** 28 August 2026. **Follows 25-K** — do not start until its three stages
are live, since everything here sits inside them.

## §0 — Run mode

**Continuous.** Diagnose, record, proceed — including where a finding contradicts this brief. Batch
the rest into one report. **Stop only for** spend beyond a ceiling or a change of scope. Shell per
CLAUDE.md §22. Walk the signed-in site; the desktop three-column layout cannot be walked from a CC
session — verify by harness and say so.

---

## §1 — The re-run dialogue

25-K gives Stage 1 a re-run control. This makes it worth pressing.

**Once an idea has been built at least once**, the re-run button opens a dialogue rather than firing
immediately. Copy, close to Charlie's wording:

> **You'd like to re-run this idea.** What new information or change of direction would you like to
> see this time? Tell me what was missing, misunderstood or misguided about the last run — the more
> specific you are, the better this run will be.

- **Accepts everything before it starts**: free text, multiple files, multiple URLs, in one place, all
  addable before pressing go.
- **The dialogue's text is an instruction to the build**, not a note. It goes into the drafting and
  smart passes as *"what the user says was wrong with the last attempt"* — ⚠ with an explicit
  instruction to act on it, because 25-F found that material supplied to a pass without an
  instruction is material the pass ignores.
- **State what will happen and what it costs** before go: research reused, or searched again because
  the idea changed.
- ⚠ **Keep the critique.** Store it against the build. *"What was wrong with the last run"* is the
  most direct quality signal the platform will ever get, and it should be visible to us the way
  feedback is (§20.5), separately from whatever it does to the build.

## §2 — Material we cannot read

**Video links.** We cannot watch video and should not pretend otherwise.

- Accept the link, **say plainly what we can and cannot do**: *"I can't watch video. If there's a
  transcript — YouTube usually has one under the video — paste it or upload it and I'll read that."*
- **Record it as a known unknown on the idea**, so the gap is visible rather than silent.
- ⚠ **Log every rejected item with its type** — video, paywalled, unparseable, too large. That log is
  the evidence for whether transcript-fetching is worth building later. **Do not build YouTube
  transcript fetching now**: it is fragile, its terms are unclear, and we have no evidence of demand.

**The same treatment for anything unreadable:** never silently drop it, always say why at the time,
always record it.

## §3 — The right-hand panel becomes a resource library

Currently a flat list of question headings. Charlie's design, and it is right — this is where
everything Lex produces *about the world* belongs, organised and navigable.

**3a. A contents list, and a home button that returns to it.** The panel opens on its contents;
choosing an item shows that item; home returns. ⚠ Without this the panel is a scroll, and a scroll is
where things go to be missed.

**3b. The contents, each with a count and an honest empty state:**

- Relevant legislation
- Linked legislation and case law *(the statutory-consequences pass)*
- **How hard will this be to achieve?** *(the smart pass's barriers, likelihood and what could go
  wrong)*
- **Key people and groups likely to support or oppose** *(§5, beta)*
- Case studies
- Key sources
- What was tried before — and what happened
- Where this mechanism works elsewhere
- What the courts have read into it
- Anything else a pass produces — ⚠ **driven from the passes, not a hardcoded list**, so a new pass
  appears without a code change.

⚠ **An item with nothing in it says why** — *"not asked of your draft"* is different from *"asked and
found nothing"*, and 25-J already draws that distinction correctly. Keep it.

**3c. ⚠ The smart pass's own output has nowhere to live and that is why Charlie could not find it.**
"How hard will this be to pass", the barriers, the likelihood, what is most likely to go wrong, and
what it cut — the best material the platform produces — is currently buried in the build log. Give it
a named place here.

**3d. Tagging, because this is what feeds the reports:**

- **Priority source** — goes in the proposal document.
- **Full source list** — goes in the evidence annex.
- **Set aside**, with a reason, and **restorable**. ⚠ Never deleted: §20.2.1 requires excluded sources
  to remain visible as excluded, because showing what was considered and rejected is a strength.
- Tags are the input to §20-B's document generation. **Wire that, do not leave it decorative.**

## §4 — Panel behaviour

- **All three panels hideable**, individually, with a persistent way to bring each back.
- **Draggable dividers** to resize the proportions; the choice persists per user.
- **Sensible minimums** so a panel cannot be dragged to unusability, and a reset control.

**And the roles, stated on screen because they are currently inferred:**

| panel | what it holds |
|---|---|
| **Left** | Lex, in the context of what is in the middle |
| **Middle** | what *you* are saying — the stage you are working on |
| **Right** | the resources: everything Lex found or worked out about the world |

## §5 — The people and principles graphs, in beta

Surface them with a **BETA** marker and an invitation:

> **Beta.** This is new and incomplete — we are still building it. If it gets something wrong, tell us:
> that is the most useful thing you can do with it right now.

⚠ **Beta means incomplete, not unreliable, and the distinction is load-bearing on a scrutiny
platform.** Coverage may be partial and gaps must be stated — but **every individual claim must still
be true and sourced.** If the graph says a member voted a certain way, that must be right, with the
division behind it. A beta label does not license a wrong fact.

- Feedback on a graph item goes to the existing feedback capture, tagged to the item.
- The coverage statement is computed from what the graph reports, never a written sentence.

## §6 — Mobile

⚠ **Three columns cannot be three columns on a phone. They become three modes**, and the design
follows from that.

- **A bottom tab bar with three tabs** — **Lex · Proposal · Resources** — thumb-reachable and
  universally understood. Not swipe-only: a gesture with no visible control is a feature most users
  never find.
- ⚠ **A badge on Proposal showing decisions waiting** (*"3"*). On a phone the user cannot see the task
  list while doing anything else, so **the task list has to come to them.**
- **Tapping a citation in Lex's answer opens that resource as a sheet** over the current view, and
  dismissing it returns you exactly where you were. Moving between panels must never lose your place.
- **Stage 1 needs no tabs at all** — it is a single column already, which is why it is the right
  default landing on mobile.
- **Resources opens on its contents list** (§3a), which works better on a phone than on a desktop.

**Test on a real phone, not a narrowed desktop window.** Report what could not be verified.

## §7 — Acceptance criteria

- Re-running an already-built idea opens the dialogue; text, files and links can all be added before
  go; the critique reaches the passes **with an instruction to act on it**; it is stored and visible
  to us; cost and reuse are stated first.
- A video link produces a plain explanation and a recorded known unknown; every rejected item is
  logged with its type.
- The right panel opens on a contents list with a home button; items are driven from the passes;
  empty items say which kind of empty they are.
- **The smart pass's barriers, likelihood and risks have a named home** and are reachable in two
  clicks.
- Sources can be tagged priority, listed, or set aside with a reason and restored; **the tags feed
  document generation.**
- All three panels hide and restore; dividers drag; the layout persists; a reset exists.
- Graphs carry the beta marker and its invitation; **no individual claim is unsourced**; feedback on
  an item reaches the feedback store.
- On a phone: three tabs, a decisions badge, citations open as sheets and return to place, Stage 1 is
  a single column. **Verified on a real device.**
