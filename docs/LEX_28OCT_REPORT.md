# LEX — CCh-Lex 28 Oct (1)–(3): report

*Written 2026-10-28, UTC throughout. Idea 452c5ade = Charlie's "civil service accountability". Every figure below was read from
production (Neon) this morning with plain prisma reads, or measured with the Anthropic token counter; nothing is inferred unless it
says so.*

---

## (3) / 287 — "cut off at the length limit" three times in a row (done first, as asked)

**Cause, confirmed.** Charlie's three turns at 02:55, 02:57 and 02:58 all ended `max_tokens`:

| turn | output tokens | final call | stored reply | tools run | cost |
|---|---|---|---|---|---|
| 02:55 (his request) | 4,612 | stopped at the 4,096 ceiling | only the cut-off note | 10 reads (get_action ×4, read_field ×5, list_actions) | 21.23p |
| 02:57 "carry on" | 4,745 | the same | the same | 12 reads | 13.06p |
| 02:58 "carry on" | 4,851 | the same | the same | 14 reads | 12.92p |
| **total** | | | | | **47.21p** |

In each turn the last model call spent the whole 4,096-token ceiling and produced **no text at all** — so it was writing a tool call
when it ran out (the text would otherwise be in the reply). A tool call that is cut off is never run and never recorded (`LexToolCall`
holds only the reads), so its input cannot be read back; from the request ("a detail box with all those 13 items PLUS …") it was the
Explanation of #59, written as one `set_action_detail` call. ⚠ That last step is inference from the request and the empty text; the
platform did not record the tool name. It now does (below).

**Why "carry on" repeated it:** nothing was saved and the stored reply said only "cut off — ask me to carry on", so the next turn had
nothing to resume from. It re-read the same actions and fields and ran into the same ceiling.

**Built (287):**
- **(a)** the agent turn's output ceiling is **16,000** (was 4,096) — `lib/lex/agent/loop.ts`. Output is billed on what is generated, so
  the higher ceiling costs nothing unless used; the turn's 40p cap still bounds it.
- **(b)** a new tool, **`add_explanation_section(action, heading, text)`**: appends one `## heading` section to the action's Explanation
  and saves it at once; at most 6,000 characters per call. Lex's prompt now says to build anything over ~800 words a section at a time,
  never as one huge `set_action_detail`.
- **(c)** a cut-off now says **what Lex was writing, for which action, and what it had saved before the cut** ("I was cut off at the
  length limit while writing a section of the Explanation for #59. Saved before the cut: the section "Points 1 to 3" in the
  Explanation of #59. The part I was writing when I ran out was not saved. Say "carry on" …"). The same facts are stored on the reply
  (`cut`) and handed to the next turn in the platform record, and the prompt tells Lex to resume from there without redoing what is
  saved.
- `check:lex-287` — results in §Checks.

---

## (1) Formatting — 235 does not hold on real replies

**Is "\n" present in the raw stored content of Charlie's latest reply?** **Yes.** The latest complete reply (28 Oct 02:33:38, 2,946
characters) holds 34 `\n`, no `\r`, no literal backslash-n, no U+2028; its two `## ` headings, five-item numbered list and 15-line table
are each on their own lines, and the chat parser turns them into 2 headings, 1 list and 1 table.

**Where the line breaks were lost:** not between the model and the bubble in general — in **one place, the honesty filter's last resort**.
`stripViolations` (`lib/lex/agent/honesty.ts`), which removes a sentence the platform could not confirm, rebuilt the reply from its
sentences **joined with a space** — and its sentence splitter splits on every line break. So any reply that tripped one violation reached
the chat as one paragraph with `## ` mid-line, and only bold survived (bold is inline). Two of Charlie's 56 stored replies are like that:
**23 Oct 17:06** (8 headings inline, 2 line breaks) and **27 Oct 10:05** (4 headings inline, 2 line breaks); both end with the filter's
own note "Nothing was changed on your idea this turn." The 27 Oct one carries that sentence twice — the model had copied it from earlier
history — and the filter now says it once.

**Fixed:** the flagged sentences are cut out of the text where they stand (`removeSentences`), so the layout around them survives; a list
item left empty is removed with its sentence. ⚠ The two stored replies stay flattened — the fix cannot restore text that was rewritten.

**The check:** `check:lex-chat-real-reply`. A · Charlie's real stored replies (cold read) through the real filter, with one of their own
sentences flagged: every heading, list item and table must survive; control — the old rebuild must lose them. B (`--live`) · one real
Lex turn on a scratch copy through `handleAgentTurn`, the stored reply read back and rendered by the real ChatPanel in Chromium: the
headings, list items and tables on screen must match what the model's own text held. **18/18, 5 controls fired, 0 dead; the live turn
cost 6.31p.** (Its first call tripped the honesty retry with nothing to flag — `retried: true, violations: 0` — which doubles the cost of
such a turn. Not investigated further.)

---

## (2) Report before building 283 — how history is sent, what a turn costs, why 396.5p

### How the conversation is sent each turn (read from `lib/lex/agent/loop.ts` and `turn.ts`)

- **Stored:** `Idea.aiChatHistory` (JSON), **cut to the last 200 messages on every save** (`KEEP_MESSAGES`, `turn.ts:125`). ⚠ So "full
  history kept" is **not** true today: message 201 drops the oldest. 452c5ade holds 99 messages, the oldest from 17 Oct 20:49 — the
  ledger has turns on this idea from **8 Oct**, so the history before 17 Oct is not in the store (why: not determined).
- **Sent to the model:** the **last 20 messages** (user and Lex, text only, each capped at 6,000 characters, plus a one-line platform
  record of what each Lex turn's tools did). Never the tool traffic.
- **Older turns: summarised**, not resent — by Haiku (`claude-haiku-4-5`), incrementally, only when at least 10 messages have aged out
  of the window since the last summary. 452c5ade's summary covers 83 messages (1,365 tokens); 5 summary calls have cost 2.31p in all.
- **Cached:** the system prompt and tools, then the idea snapshot + summary, then the conversation (three cache breakpoints, 5-minute
  cache).

### What one call carries, measured on 452c5ade now (Anthropic token counter)

| part | tokens |
|---|---|
| tool definitions | **18,493** |
| system prompt | 8,776 |
| idea snapshot (57 actions, 30 candidates, 30 challenges …) | 12,669 |
| summary of older turns | 1,365 |
| last 20 messages (the history window) | 7,987 |
| **one call, before any tool result** | **≈ 49,300** |

A turn averages **3 calls** (max 8): every tool round-trip re-sends all of it plus the tool results so far.

### Charlie's first turn against his latest

| | first (8 Oct 02:52) | latest complete (28 Oct 02:33) | latest (28 Oct 02:58, cut off) |
|---|---|---|---|
| calls | 4 | 3 | 3 |
| input, all | 141,552 | 167,119 | 188,638 |
| — read from cache | 103,282 | 108,657 | 155,026 |
| — written to cache | 38,258 | 58,452 | 33,604 |
| output | 3,082 | 2,251 | 4,851 |
| **pence** | **11.62p** | **15.04p** | **12.92p** |

Average per turn by day: 7.4p (8 Oct) → 10–12p (17–23 Oct) → **16–17p (27–28 Oct)**.

### Why the conversation reached 396.5p

The figure on screen is the sum of the per-turn cost stored on each reply in the history. **396.5p is that sum exactly after the
27 Oct 10:05 turn**: 33 turns since 17 Oct 20:58 at about 12p each. It is now **510.0p** (40 turns). The ledger holds more —
**630.1p** for 50 turns on this idea — because the screen sums only what the 200-message store still holds (from 17 Oct) and only
replies that were saved.

**Where the money goes:** writing to the cache. Cache writes cost 12.5× cache reads ($2.50 vs $0.20 per million). On the 02:55 turn
84,864 written tokens were **$0.21 of $0.27 — 79% of the turn**; on the first turn 65%. The cache lasts 5 minutes and Charlie's turns are
mostly further apart than that, so **nearly every turn re-writes the ≈40,000-token prefix** (tools, prompt, snapshot) — about **8p per
turn before anything is said** — and the snapshot changes whenever the idea does. The history window is 8,000 of the ≈49,000 tokens.

### What this means for 283 — said before it is built

283 as written (the last **8 replies** word for word + a running summary, instead of the last 20 messages) takes the window from ≈8,000
tokens to ≈2,400 for the 8 replies plus the user's messages between them — **about 4,000 tokens a call less**. At this turn's mix that
saves roughly **1p a turn (≈6%)**. It does not touch the 40,000-token fixed prefix, which is where the cost is. The levers that would:
- the **1-hour cache** on the prefix breakpoint (a dearer write, but one write per sitting rather than per turn) — measurable on scratch;
- the **tool definitions** (18,493 tokens, the largest single block) — offer fewer per step, or shorten descriptions.

283's other half — the **full history kept and searchable** — is worth doing for its own sake: today the store forgets message 201.
Recommendation: build 283 as asked, measure before/after on scratch (as asked), and measure the 1-hour cache in the same run. **Waiting for
Charlie's approval of this report before building 283.**

### Two faults found on the way (not in the brief)

1. **One turn ran twice and was charged twice.** 28 Oct 02:33: turn `6a06feb5` has two ledger rows (15.04p + 7.19p) and one stored reply.
   The client retried the POST while the first run was still going; the "already answered" guard only looks at the saved history, so
   both runs executed. They were reads that time; **had either run a writing tool it would have acted twice**, and the second save
   overwrote the first. Needs an in-flight lock per `clientTurnId`. Not fixed — proposing it.
2. **The honesty retry fires on read-only answers with nothing to correct** (seen in the live check: `retried: true`, 0 violations
   after) — doubling those turns. Not investigated.

---

## Sizing 282–286, and 286's counts

| item | what it needs | schema | size |
|---|---|---|---|
| 282 reply stamps "Reply N · Wed 28 Oct 26, 02:31 GMT" | a number stored on each reply at save (per idea, never reused), rendered by the chat in the browser's time zone from the stored time. No user time zone is stored anywhere, so "the user's time zone" = the browser's | none if on the JSON; ⚠ best built on 283's table so N is a row, not a position in a list that drops message 201 | ½ day |
| 283 history | a message table (idea, n, role, text, time, meta), backfill of the 99 stored messages, both writers (`handleAgentTurn`, `handleConfirm`) and the 11 other readers of `aiChatHistory`; window = last 8 replies; summary kept by Lex; `read_reply(n)` and `search_conversation(query)` (Postgres text search on the table); before/after measured on scratch | **yes** — new table, applied with its code | 1½–2 days |
| 284 "63" / "#63" finds action 63 first | number match ahead of text, across LIVE, ARCHIVED, merged and ruled-out, each saying where it went ("merged into #207 on …") from `mergedIntoId` / `foldedIntoId` / status | none | ½ day |
| 285 Explanation section | the owner's own text, set out (markdown), above "Parts of this action, quoted"; per-section labelled buttons ("Edit the action", "Edit the explanation", "Edit title"); a resizable box with a drag handle; empty state "No explanation written yet — Write one" | none | 1 day |
| 286 retire three fields | report (below) → move text into the Explanation under "Moved from the old fields on 28 Oct" with a `FieldRevision` of the record first → remove from the screen; nothing deleted | none (columns stay) | ½ day |

**286 — how many actions hold text in each (live ideas, scratch copies excluded):**

| field | actions | ideas | on 452c5ade |
|---|---|---|---|
| Mechanism (`mechanismType`) | 61 | 15 | 6 |
| Target organisation (`targetOrganisation`) | 12 | 1 | 12 |
| Intended wording (`wording`) | **0** | 0 | 0 |
| any of the three | 73 | | |

⚠ Mechanism holds a one-word category (incentives · rules · transparency · market-design · institutional), not prose; moved into an
Explanation it will read as e.g. "Mechanism: institutional". The move writes to **73 actions on 15 ideas, most of them not Charlie's** —
asking before it runs.

---

## 284 and 285 — built 28 Oct afternoon (no schema)

**284 — "63" / "#63" finds action 63 first.** `lib/lex/action-find.ts` (pure). A find-box entry that is only a number (with or without
`#`) shows a card above the list: `#63 <title> — merged into #207 on 12 Oct 2026`, with **Show it in Ruled out and merged away** and
**Go to #207**. It searches the live list, Later phase and the set-aside rows (before, set-aside rows were never searched, so a merged
action could not be found by its own number). A chain is followed ("merged into #71 on 14 Oct 2026; #71 was later merged into #207").
Ruled out reads "ruled out on 20 Oct 2026: <reason>"; parked reads "in Later phase (<reason>)"; a number nobody has says so. Text matches
are listed below the card as before, and a `#63` word no longer matches `#630`.
- ⚠ **The date is the set-aside row's last change** (`updatedAt`, now sent to the screen as `setAsideAt`). No column records the moment of
  a merge. For a row nobody edited after it was set aside, that is the merge date; if one was edited later, the date is the later edit.
- The card is shown in the browser's time zone (the same rule as 282).

**285 — the Explanation section.** In the opened record:
- the statement has its own labelled **Edit the action** beside it (the old bare "Edit" is gone on step 1);
- the Explanation shows the owner's own text **set out** — headings, bold, lists, tables, through the chat's own renderer — above
  "Parts of this action, quoted", with **Edit the explanation** beside it; **Edit title** is as it was;
- the text box and the editor are resizable with a visible drag handle ("═ drag to resize ═"; Up/Down arrows work too);
- empty: **"No explanation written yet — Write one"**;
- "Edit the explanation" changes the owner's text only. The quoted parts below are kept exactly as stored (`withOwnText`), and only
  `commentary` is sent. The Explanation box has left the "Edit the action" form.
- ⚠ **One reading to confirm:** the Explanation section itself still opens closed, like every record section (265, your 24 Oct rule).
  "Always shows" is built as: inside the section, the owner's text is always shown set out, never behind a further click. If you meant
  the section should open by itself, that is a one-line change, but it reverses 265 for this one section, so I have not made it.

**Checks:** check:lex-284 **23/23**, 4 controls fired, 0 dead (Part B types into the real ActionsWorkspace in Chromium);
check:lex-26u **66/66** (9 new 285 assertions in Chromium: the empty state, the labelled buttons, a 120px drag that grows the box, Save
sending only the Explanation with the quoted part kept byte for byte, the text set out above the parts); lex-26v1b **78/78**;
lex-26s-browser **93/93** (1 not run: its `--db` part); lex-26s2 **220/221** (the same ledger row 9900 as this morning); web tsc clean;
check:scripts clean; check-clean-build --fast PASS.

**Still not built:** 282 (best on 283's table), 283 (waits on your reading of item 2), 286 (waits on your yes to move 73 actions on 15 ideas).

## 28 Oct (4)–(5) — built and run 28 Oct evening

**287 — status, as (4) asked:** built and live since `1171349c` (16,000-token ceiling, `add_action_details_section`, the cut-off record);
`check:lex-287 --live` 15/15 this morning. Nothing of it waits; it does not hold up 283.

**288 — the retired fields (all 15 ideas are yours).** (4)'s instruction ran first: Mechanism and Target organisation copied into the
Explanation of 73 actions, each with a `FieldRevision`. (5) then changed the rule, so that run was **put back from its own revisions**
(another revision first, each time) and (5)'s rule applied:
- **Target organisation → Who where Who is empty, otherwise Action details** under "## Moved from the old fields on 28 Oct". All 12
  actions holding one (all on 452c5ade) already had a Who, so **all 12 went into Action details; 0 into Who.**
- **Mechanism: not moved.** Hidden from the screen; the column keeps its value (gap-check still reads it to classify).
- **Intended wording:** nothing held any.
- Per idea: 452c5ade 18 put back, 12 Target → Action details; the other 14 ideas 4 put back each (Sentencing Council 3), nothing else.
  Read back 73/73; no Explanation still carries a moved Mechanism line; a second run changes nothing.
- Off the screen: the three inputs in "Edit the action", and the card's "Mechanism: … Target: …" line. Lex's `add_action` no longer
  takes them and `list_actions` no longer returns them.
- ⚠ Not changed: the **Proposal** still prints "Mechanism: …" in an action's line and a "Legislative annex" with "Target: …"; for the
  12 on 452c5ade the Target now also appears in Action details, so it prints twice there. The **Meeting Pack** prints the target beside
  each action. Say if those should go too.

**289 — one turn, one run.** The fix is the 292 table's unique (idea, clientTurnId, role): the user's row is written when a turn
**starts**, so a retried POST of the same send cannot start a second run; it waits (up to 270 s) for the first run's reply and returns
it. A run that throws releases its claim; a model failure is stored as a reply, as before. `check:lex-292` B proves it: the same send
twice at once → **one** model run, the same reply to both; control: two different sends → two runs.
**Other doubled turns in the ledger: none.** Two independent searches — a turn id whose tool sequence starts over (44 turns carry tool
records), and a charged turn with no stored reply within 4 minutes of one that has one (every idea's stored history) — both find only
`6a06feb5` (28 Oct 02:33, 15.04p + 7.19p). ⚠ Their reach: turns before tool records carried a turn id, and turns older than an idea's
200-message store, cannot be examined either way.

**290** — Action details opens open: the one exception to 265, asserted in lex-26v1b (every other section still opens closed).

**291** — "Explanation" → **"Action details"**: section title, box label ("Action details — what this action does in full and why; parts,
tables, no limit"), "Edit the action details", "Save the action details", "No action details written yet — Write them", the find box,
Lex's prompt and `add_action_details_section`, the drafting prompt, the Proposal's heading over it, and the checks by name. Action box
only; the column stays `commentary`.

**292 (with 282) — the whole conversation.**
- `LexMessage`: one row per message, **never cut**; `n` is its place in the conversation, `replyNo` Lex's reply number. Schema and SQL
  in one commit, applied to Neon first.
- The JSON history is unchanged and still drives the chat and **the 20-message window** (as (5) said). The table is written beside it by
  both writers (a turn and a confirmation).
- Backfill: an idea is copied in the first time a turn touches it; `scripts/backfill-292-messages.ts` copied the rest after the deploy
  (figures below). Your 452c5ade: every stored message, replies numbered from the oldest kept (17 Oct). ⚠ The turns before 17 Oct are not
  in the JSON (the 200-message cut, and before), so the table cannot have them either.
- `read_reply(n)` returns reply N in full with the message it answered; `search_conversation(query)` searches every message (Postgres
  text search, English stemming, "quoted phrase"), newest first. They replace `read_history`, which read only the JSON.
- **282:** each Lex reply is stamped **"Reply 31 · Wed 28 Oct 26, 02:31 GMT"** in the browser's time zone (BST in summer, the zone's own
  name elsewhere). New replies carry the stamp at once; old ones from their stored time.

**The honesty retry "with 0 violations" — I misread it this morning.** The log's `violations` is counted **after** the corrective retry,
and the retry only fires when the first draft had at least one (`loop.ts`). "retried: true, violations: 0" is a retry that worked. The
doubled cost is real but it is the check doing its job; what was missing is any record of WHAT the first draft said. Now logged
(`firstDraftFlagged`) and stored on the reply (`honestyRetry`), so the next one can be read from the database.

**293** — see the next section.

**The desktop memory question.** Asked of the desktop; I am on the laptop, so this is the laptop's answer and the handover asks you to
run the same two commands there. Laptop: `wsl -l -v` → **WSL is not installed**, so the Claude app's VM is not a WSL distro and a
`.wslconfig` cap cannot apply; it is the app's own Hyper-V VM. **vmmem starts with a Cowork task, not with the app**: the app's processes
started at 00:55; at **01:15:51** the app wrote `claude-code-vm\.sdk-version` and `vm_bundles\claudevm.bundle\.cowork-adopted` and mounted
the VM's disk — the same second vmmem's host process started. It then stays up (4.1 GB at 23:00) until the app is quit.

## 293 — measured on scratch: the 1-hour cache, and offering only the current step's tools

`scripts/measure-293.ts`: a scratch copy of 452c5ade carrying your conversation; two read-only questions ("In two sentences, what is
action #59 for?", "Which of my live actions do not yet say who implements them?"), the second **6 minutes** after the first (most of your
turns are further apart than the 5-minute cache), each arm starting 6 minutes after the last so none reads another's cache.

| arm | turn 1 | turn 2 (6 min later) | what turn 2 did with the cached prefix |
|---|---|---|---|
| A · today (5-minute cache) | 11.51p (3 calls) | **12.96p** (2 calls) | wrote 61,242 tokens again |
| B · 1-hour cache on tools + system prompt | 12.46p (1 call) | **7.76p** (2 calls) | read 72,939 tokens from cache |
| C · 5-minute cache, only step 1's tools | 7.21p (1 call) | **7.14p** (1 call) | wrote 35,502 tokens again — about 10,000 fewer than a full tool list |

⚠ One turn per cell: the model chose different tools in different arms (A1 called get_action three times, B1 answered without a tool),
so a single cell is not a precise price. The cache effect itself is not in doubt: B2 read what A2 had to rewrite.

**What the tools cost (Anthropic token counter, free):** the 71 tools are **19,267 tokens** — the largest block in every call. Step 1's
own action tools 3,818; step 2's 1,645; step 4's 324; the policy-candidate tools 1,708; the kernel-field tools 1,538; the research
notebook 2,799; the 24 used everywhere 7,435.

**Against your real turns** (55 since 1 Oct on live ideas, 12.50p average): 14 came within 5 minutes of the previous one (cache read
either way), **19 came 5–60 minutes after** (each ≈5p cheaper with the 1-hour cache) and **22 after more than an hour or first** (each ≈3p
dearer: a 1-hour write costs 2× input against 1.25×). Net ≈26p over the 55, **≈0.5p a turn**; the typical (median) turn is in the 5–60
minute band, where it saves ≈5p.

**Adopted: (a), the 1-hour cache** on the first breakpoint (tools + system prompt) — `PREFIX_CACHE_TTL = '1h'` in `loop.ts`. The snapshot
and conversation stay at 5 minutes (they change every turn).
**Not adopted: (b)**, and here is why, so you can overrule it.
- **What it saves:** on step 1 it drops ≈8,000 of the 19,267 tool tokens (steps 2 and 4, the policy candidates, the kernel fields, the
  notebook). Measured: a one-call turn that rewrote the prefix wrote 35,502 tokens with step 1's tools against 45,487 with all of them —
  **≈2p on a turn that rewrites the prefix**, ≈0.15p on a call that reads it.
- **Why not now:** (1) with (a) adopted, the prefix is rewritten far less often, so (b)'s saving shrinks to the ≈0.15p-a-call case;
  (2) a different tool list per step is a **different cached prefix per step**, so moving between steps rewrites the 1-hour cache —
  (b) works against (a); (3) the chat does not tell Lex which screen or step you are on (it sends only the stage: idea / strategy /
  deepening), so a step filter would also take, say, the policy tools away while you are on the policy page. Doing it properly needs the
  client to send the screen and step first.
- ⚠ Single turns per cell, and in C the model answered both questions without a tool (one call each) where A and B called one, so the
  totals in the table are not like for like; the per-call write sizes are.

**Spent:** 59.04p (A 24.47p, B 20.22p, C 14.35p), on a scratch copy deleted afterwards, labelled `purpose = measurement` in the ledger.

## The outstanding items from the desktop handover (25 Oct)

- **check:lex-26u: 57/57, 9 controls, 0 dead.** It first crashed on this laptop because the generated Prisma client predated the pull
  (`Unknown argument number`); `prisma generate` fixed it.
- **check:scripts: green** — it had 3 errors: a GRAPH 9 control's lambda typed too narrowly to return `enacting-unresolved`
  (`check-graph-9.ts`, a type-only fix to GRAPH's file), and a fixture missing the three 274 heading fields (`verify-lex-26q-ui.tsx`).
- **entity_list_v5.md:** DocumentReview and `DeepeningIssue.reviewId` added (Charlie's instruction, 28 Oct).
- **GRAPH 9's "appears to confer none" read back live:** production serves `b3d5748`, which contains GRAPH 9's `4d3479c` — the code is
  deployed. ⚠ The string itself has NOT been read off the site: it is drawn only for an instrument whose enacting words name a provision
  that confers no power (GRAPH 9's own CRaG s.20 case has 0), and I have not yet found a live idea whose collision report includes
  one. Not done — it needs that case found first.
- **§8 of LEX_26V2d_REPORT** — Charlie's questions; still his.

## Checks (what RAN, §23.2)

- **check:lex-287 --live: 15/15, 2 controls fired, 0 dead, 0 not run.**
  - B1 · Charlie's own 02:55 words with his history to that point, at the real ceiling: **not cut off** (end_turn, 16.70p, 7,901 output
    tokens). Lex wrote two sections into #59 (6,054 → 12,534 characters). Its first section was 6,305 characters and was refused by the
    6,000 cap (it then split it), which wasted about 1,600 output tokens (≈1p).
  - B2 · a cut forced at a 700-token ceiling: the reply read "I was cut off at the length limit while writing a section of the Explanation
    for #59. Nothing was saved this turn. …", and the cut was stored for the next turn. "carry on" at the real ceiling then wrote all four
    sections into #59 (0 → 4 sections, 18,251 characters, 16.26p), repeated none, and was not cut off.
  - ⚠ The first two runs of this check measured the wrong thing and are recorded as such: a scratch copy with no conversation history made
    Lex (rightly) ask which action "this accountability code action" meant. The copy now carries Charlie's history and summary up to the
    request. Even so, Lex may ask #59-or-#207 first — his screen had an action open; a script has none — so B1 asserts only "not cut off".
- **check:lex-chat-real-reply --live: 18/18, 5 controls fired, 0 dead, 0 not run** (6.31p).
- **check:lex-26u: 57/57**, 9 controls. **check:scripts: 0 errors.** **web tsc: clean.** **check-clean-build.sh --fast: PASS.**
- **Spent on checks today:** ≈162p across six live runs (four of 287, two of the chat check) — all on scratch copies, all deleted and
  re-read gone, all marked `purpose = check` in the ledger.
- **The Lex checks that read the changed files:** lex-26p **116/116** (Part B not run: live) · lex-26v1b **78/78** · lex-235-chat-browser
  **24/24** · lex-25r **52/52** (2 not checked) · lex-26v2d **62/62** · lex-26s2 **220/221**, 4 not run (live parts).
  - ⚠ lex-26s2's one failure is NOT this work: ledger row 9900 (24 Oct 15:40 UTC, `lex.agent.turn`, 13.79p) belongs to an idea that no
    longer exists and carries no `purpose` — a desktop run's scratch turn that was not labelled. Left as it is; labelling it is a ledger
    write and the backfill rule (decision 193) is the stream's to apply.
  - lex-26s2 first went red on "set_action_detail takes 5,000 characters in replace" — my first per-call cap (4,000) broke decision 181.
    The cap is now 8,000 (≈2,000 tokens, far inside the ceiling) and the assertion passes.
  - lex-26v2d first went red on two Issues-tab assertions, twice: a race in the CHECK (it waited for a list already on screen and read
    it before it refetched — green on the desktop, red on the slower laptop). It now waits for the new version's words. 62/62.
  - One lex-26s2 run sat idle (0 CPU) for 20+ minutes and was stopped; the re-run completed normally. Cause not found.
