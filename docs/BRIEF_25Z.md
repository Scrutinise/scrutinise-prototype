# BRIEF — LEX 25-Z: the three panels, restructured

**Thread:** LEX. **Written:** 3 September 2026.
**Source:** Charlie's walkthrough on an iPad, 3 September.

⚠ **The standing rule applies: when he says something is confusing or in the wrong place, that is the
finding. He designed this. Restructure rather than patch.**

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1 is functional and everything else is arrangement. Do §1 first and report it separately** —
it may be a defect, a device problem, or a feature that was never built, and those have different
answers.

⚠ **Nothing here deletes content. Everything below that leaves the middle panel reappears somewhere
else.** If a destination is unclear, ask rather than dropping it.

⚠ **CLAUDE.md §25–§28 apply. Read-back list per 25-T §3 for every string this sprint changes** —
this sprint is almost entirely strings, so that list is the check.

⚠ **A CENTRAL session shares this repository.** Explicit file paths only.

---

## §1 — The research items do not open. Diagnose before fixing.

**Charlie, on an iPad:** in **Who has argued about this**, several entries look interesting, he tries
to click them and nothing happens. **Same in How the courts have read it. Same in What the law says
now.** He wants to read the debate itself.

⚠⚠ **This is the platform's central promise — show the working, every finding traces to its source.
If a user cannot reach the source, the promise is unkept.**

**1a. Establish which of these it is, and report it plainly:**
- there is no detail view and never has been;
- there is one and the item is not wired to it;
- it works on desktop and not under touch — ⚠ **he was on an iPad and says so; treat that as a live
  possibility, not an excuse.**

**1b. Report what content actually sits behind one of those entries** — the full debate passage, an
extract, or a title and a link only.

**1c. Only then build.** A user should be able to open an entry and read the passage it came from,
with its source, its date, and a route to the original.

**1d.** ⚠ **Cold read on a real idea, on a touch viewport as well as a mouse one.** CC cannot test
desktop breakpoints; say what only Charlie's iPad can confirm.

## §2 — The middle panel opens in the wrong place, showing the wrong thing

**2a. A newly opened page has every kernel section collapsed — headings only — and is scrolled to the
top.** ⚠ Today it opens at **Coherent Actions**, expanded. This is the 25-R addendum's rule not
holding; **report why it did not, rather than adding a second rule on top of it.**

**2b. The four kernel sections behave identically.** ⚠ Today The Basic Idea, Diagnosis and Guiding
Policy carry a **Work on this** pill; **Coherent Actions has no pill and is coloured red or orange
instead.** Charlie: *"They should all be the same."*

⚠⚠ **And a standing constraint is being broken: Charlie is colour blind, and no UI state may be
conveyed by colour alone.** Whatever that colouring means, it is invisible to him. **Report what it
was meant to signify** — if it is a real state, it needs a word; if it is decoration, remove it.

**2c. The three blocks below the kernel come out of the middle panel.** ⚠ **They are in boxes, which
makes them look more important than the kernel itself.** Nothing is deleted — each moves:

| leaves the middle panel | goes to |
|---|---|
| **What you have put in the report** | THE RESEARCH, under **Outputs**, titled **"For Report Inclusion"** |
| **What to do next** | ⚠ **nowhere — it already exists** at the top of the WORKING AREA. Remove the duplicate. |
| **Challenges** | THE RESEARCH, under **Outputs**, inside **"How hard will this be to achieve?"** |
| **The Deepening** | ⚠ **nowhere — it is already in the stage header.** Remove the duplicate. |

**2d.** ⚠ **Report anything else currently in that region that this table does not name**, rather than
guessing a destination for it.

## §3 — Wording. Use these exactly.

| where | replace | with |
|---|---|---|
| under **DRAFT STRATEGY** | "Here is the draft strategy I have written for you to review and develop…" | **"Here is your draft strategy to review and develop into your formal proposal. Edit directly, discuss with Lex or ask Lex to improve it for you."** |
| under **WORKING AREA** | "This panel lists the decisions and actions…" | **"Here are your decisions and actions:"** |
| under **THE RESEARCH** | "This panel is where you'll find the background…" | **"The issues, the numbers and the debates behind your strategy"** |
| below the horizontal divider in the left panel | "The Strategy. Work through what Lex drafted…" | ⚠ **delete — no replacement** |
| RHP section heading | "Where the research changed my mind" | **"Notable Research"** |
| above the second paragraph of each such item | "Why I changed my mind" | **"Why notable"** |
| the Lex input box | "Type your reply…" | **"Chat to Lex"** |

⚠ **Every one of these strings goes on the read-back list and is confirmed on the running page.**

## §4 — The Lex chat opens clean

**4a. On load, the previous conversation is off screen.** The user sees the input box and the arrival
line, not a wall of earlier chat.
**4b. Prior chat is reachable** by scrolling up, or by an upward-pointing control labelled
**"prior chat"**.
**4c.** ⚠ **Nothing is deleted or unreachable.** The history is there; it is simply not what greets
the user.

## §5 — Panel headings and the Beta notice

**5a. WORKING AREA, DRAFT STRATEGY and THE RESEARCH become much larger.** They are the primary
navigation of the whole screen and currently read as labels.

**5b. Colour is permitted as decoration only.** ⚠⚠ **Charlie is colour blind. If the three panels are
coloured differently, size, position and the words must still distinguish them completely with the
colour removed.** Test it that way.

**5c. The Beta and search-disclosure text comes out of the panel** — Charlie: *too wordy for here.*
**It becomes a one-time popup, shown the first time the user opens a search-derived item in THE
RESEARCH**, which is the moment it is relevant.

**5d.** ⚠ **The text itself does not change** — it was agreed word for word and is doing honest work:

> **Beta.** This evidence base is assembled by automated search. Some results will be off-topic — a
> word can match in a very different context — and we would rather include too much than miss
> something important. **Refining and focusing the evidence base is the proposer's first task.**

**5e.** ⚠ **Report where the Beta marker still needs to appear** now that this text moves — the header
marker and the marker on generated documents were separate decisions and both stand.

## §6 — Acceptance criteria

- A research entry under *Who has argued about this*, *How the courts have read it* and *What the law
  says now* opens and shows its source passage — confirmed on a touch viewport.
- A freshly opened idea shows all four kernel sections collapsed, scrolled to the top.
- All four kernel sections carry the same controls, and no section conveys any state by colour alone.
- The middle panel contains the kernel and nothing else; each relocated block renders in its new home.
- Every string in §3 is read back off the running page and reported found.
- The Lex panel opens with prior chat off screen and reachable.
- The three panel headings are visibly primary with colour removed.
- The Beta text appears once, on first opening a search-derived item, and nowhere else in the panel.

## §7 — Say what only Charlie's browser can confirm

⚠ **He walked this on an iPad. Say which items you could not test on a touch viewport at all**, rather
than reporting a desktop pass as confirmation.
