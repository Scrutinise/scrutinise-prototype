# BRIEF — LEX 26-J: the Overview reads the wrong tables

**Thread:** LEX. **Written:** 27 September 2026.
**Source:** CC's diagnosis of 27 September, and Charlie's decisions on it.
**Runs after 26-I.**

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed. Batch the report. **Stop only for** spend
or scope. ⚠ **CLAUDE.md §25–§28 apply.** Run the cold-read instrument.

**§1 is the sprint. §2–§4 in order.**

---

## §1 — Rebuild the Overview against what the editor actually writes

⚠⚠ **The Overview queries the pre-rebuild tables — Diagnosis, GuidingPolicy, RootCause, Evidence,
CoherentAction — while the editor writes scalar Idea columns and three newer tables.** *"Problem"*
displays only by coincidence. **This is the page a user lands on when they click an idea, and it tells
them their work does not exist.**

**1a. Report the full mapping first**: every field the Overview shows, the table it reads today, and
the place the editor actually writes it. ⚠ **Any field with no live source is reported, not guessed.**
**1b. Rebuild the four tabs** — Overview, Diagnosis, Policy, Coherent Actions — to read the live
schema.
**1c.** ⚠ **Report whether the abandoned tables hold anything the live schema does not.** If they do,
say what; if they are empty or superseded, say so — **but do not drop them in this sprint.**
**1d. Cold read on Charlie's idea**: the Overview shows the same 8 of 8 and 7 of 7 the editor shows.

## §2 — The Research tab

**Broken twice**: stage-gated below Stage 2, and pointed at a model that would leave it empty past
the gate.

**2a. Remove the gate.** Research exists from the first build.
**2b. Point it at what holds the sources and documents.** It lists every source and every document
gathered, **with delete** for anything not relevant. ⚠ **Delete archives; it does not destroy.**
**2c.** ⚠ **Report which table user uploads actually live in.** The documents fix in 25-Y read them
from `IdeaUserMaterial`; CC's 27 September note says the upload model `Attachment` has no callers.
**If uploads and generated documents already sit in different tables, the Inbound/Outbound split in §3
may need no new field at all** — check before adding one.

## §3 — Inbound and Outbound

**Charlie's requirement:** the Documents tab splits into **Inbound** — anything the user added — and
**Outbound** — anything the system produced. Both collapsible.

**3a.** ⚠ **Depends on §2c.** If the split is already a table boundary, build the tab on it and stop.
**3b.** If not, **add a provenance field to Document**, populate it at every write site, backfill what
can be inferred from the writer, and **report what cannot be inferred** — an unknown provenance is
shown as unknown, not guessed.

## §4 — The sort preference is per-device

⚠ It lives in the browser, so Charlie's iPad does not know what his desktop chose. **Move it to the
user record.** Report the cost; expect it to be small.

## §5 — The Deepening opens with a re-read

**Charlie's principle, recorded for whoever builds Stage 3:** *the first step of the Deepening is to
re-read the whole thing and make sure you're happy with it — and it carries the coherence test.*
⚠ **Not built here. Recorded so that it is not designed differently later.** The Deepening remains
report-only until Charlie has read the report from 26-F §4.

## §6 — Acceptance criteria

- The Overview shows exactly what the editor shows, field for field, on a real idea.
- Every Overview field has a named live source or is reported as having none.
- The Research tab lists sources and documents from the first build, with archive-not-delete.
- Inbound and Outbound are distinguished — by table or by field — and unknown provenance is shown as
  unknown.
- The sort preference follows the user across devices.
- The Deepening's opening step is recorded in the design notes.
