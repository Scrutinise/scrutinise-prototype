# Charlie's to-do list — Search, Graphs and cost-benefit

*Kept by CCh-Search. Last updated 19 Nov 2026, 23:52 GMT. Tick items off by changing [ ] to [x]; CCh-Search
re-reads this file and updates it.*

## Decisions waiting for you (each has a recommendation)

- [ ] **D-h2. Keep "temperature 0" or roll it back?** Pushed live on 19 Nov; run 2 of its test is being run on Railway.
      CCh-Search will recommend once it is in. Rollback = two Vercel variables (CC's report gives them).
- [ ] **D-c. Friends and foes — naming (revised after your 19 Nov question):** name everyone who has spoken in public —
      MPs, officials, organisations, journalists, public accounts, oral witnesses, written-evidence authors. For people who
      wrote to a committee as private citizens about their own lives: their name, their argument and a link to the
      published submission, but no profile built around them and no personal details (health, money, family).
      *Recommend: yes.*
- [ ] **D-d. Friends and foes — two new database tables**, approved when built. *Recommend: yes in principle.*
- [ ] **D-e. Friends and foes — data protection:** a short check with a data-protection adviser before the list reaches
      any user (not before the internal pilot). *Recommend: yes.*
- [ ] **D-f. Search indexes on Railway storage** (~$40/month estimated + a sprint of work). *Recommend: not now.*
- [ ] **D-g. Old test tables on R2** (36 GB, ~50p/month, nothing uses them): delete or keep. *Recommend: delete, low priority.*

## Done

- [x] Router fix for bill papers switched on in Vercel (19 Nov). Confirmed live: 10 of 10 bill questions found.
- [x] Search's commits pushed (19 Nov, 21:13 UTC), including the automatic restart and temperature 0.
- [x] £5 Search budget approved for 19 Nov.

## Things only you can do

- [ ] **Railway → Ops service → Variables → `RAILWAY_API_TOKEN`:** replace it with a full project token (the same kind
      the local scripts use). Today's Ops token cannot read Railway's restart history, so the new automatic restart of a
      slow search service may fail; if it does, you get an email saying so.

- [ ] **Reduce the accountability idea's actions** (452c5ade; 58 live now). *Your stated next step, urgent.*
- [ ] **Then a cost-benefit test on it:** cost 5–10 key actions (low/high, price year, one-off or yearly, source) and add
      2–3 benefit lines. Ask Lex to propose cost lines for you to accept, rather than typing 58 by hand.
- [ ] **At the desktop (tomorrow):** open the Ingest session; ask it to find its unpushed CBA-1 work and push it to the
      branch `wip/ingest-cba1x` (option 1, chosen). If nothing is found, decide again (option 3: redo).
- [ ] **PSSRU licence check** — see the note at the foot of this file.
- [ ] **Neon API key:** console.neon.tech → profile → Account settings → API keys → Create (`CC-cost-report`); add
      `NEON_API_KEY=…` to `scrutinise-web/.env` on the machine CC-Search runs on.
- [ ] **Vercel taskbar shortcut on the desktop:** Chrome → vercel.com → ⋮ → Cast, save and share → Install page as app →
      right-click the taskbar icon → Pin to taskbar.
- [ ] **MPs' and peers' portraits:** read Parliament's licence for official portraits before Search uses any
      (CC cannot reach parliament.uk from the laptop).

## Homework (gold questions) — in this folder

- [ ] `1_committees_rekey_S17.md` — ten questions, ACCEPT / AMEND / REJECT each (~30 min).
- [ ] `2_debates_rekey_S13.md` — eleven rows, fill each VERDICT line (~30 min).
- [ ] `3_costing_questions_S18.md` — eight questions, ACCEPT / AMEND / REJECT (~20 min).
- [ ] `4_impact_assessments_S18_decision.md` — one decision, D-1 near the foot (~5 min).
- [ ] **Treaty questions** — 5–8 to be written; no file yet. Ask CCh-Search to draft them with you.
- [ ] `graph7_idea_law_rows_452c5ade.txt` — the 20 laws for your accountability idea: read, edit, then run the command at
      the top of the file (or ask the Graphs/Search session to run it).

## Waiting on other streams (no action from you; listed so they are not lost)

- Lex: stop showing PSSRU figures until the licence is confirmed (open since 4 Nov).
- Lex: set its search timeout back from 120 s to 75 s once the automatic restart is live.
- Lex: wire web orientation (stage 1, and later stage 3) into builds when Search says it is ready.
- Ingest: refresh the "what amended what" record (last refreshed 5 July); fetch structured bill amendments; fix the seven
  collections in the search index with no database rows.

---

### PSSRU — what it is, and how to check the licence

**What it is.** PSSRU is the Personal Social Services Research Unit at the University of Kent. With the Centre for Health
Economics at the University of York it publishes *Unit Costs of Health and Social Care* each year: standard costs such as
an hour of a social worker's time or a GP appointment. Our cost-benefit engine holds 9 figures from it as benchmarks.

**Why it is flagged.** Our licence register marks it "all rights reserved, presumed": nobody has confirmed we may show
its figures to users. The York repository copy of the 2022 edition carries the repository's general statement, "protected
by copyright, with all rights reserved unless indicated otherwise", and no open licence was found in what was read.

**How to check (about 15 minutes):**
1. Find the edition we use (ask CC: "which PSSRU edition and year do the 9 rows come from?").
2. Open that edition's own copyright page (the first few pages of the PDF) and its record on the Kent Academic
   Repository (kar.kent.ac.uk) or White Rose (eprints.whiterose.ac.uk). Look for a licence line, e.g. "CC BY" or
   "CC BY-NC-ND". Recent editions may carry an open licence; older ones often do not.
3. If an open licence is stated, note it (and whether "non-commercial" applies — Scrutinise is not-for-profit, which
   usually fits, but check any charging plans).
4. If none is stated, email the Unit Costs team at PSSRU (Kent) asking permission to display the figures, with
   attribution, in a not-for-profit civic tool. Keep the reply; CC records it in the licence register.

Until then the 9 rows stay hidden from users.
