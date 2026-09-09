# BRIEF — LEX 25-T: get the build off the user's tab, and make the merge real

**Thread:** LEX. **Written:** 1 September 2026, late.
**Follows:** 25-S (running).
**Source:** CC's own build-timing measurement of 1 September; Charlie's decisions of 31 August and
1 September.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope. Shell per CLAUDE.md §22.

⚠ **§1 is the last pilot-blocker in the product and everything else in this brief is optional beside
it. Do §1 first and report it before starting §2.**

⚠ **CLAUDE.md §25 and §26 apply — assert rendered data, cold reads.** And note the record: four
defects of one class were found on 1 September, **all four by looking at the page and none by any
check.** §3 is this sprint's attempt at something that would have caught them.

⚠ **A CENTRAL session shares this repository.** Commit by explicit file path only, never `git add -A`.
`package.json` is contended — report a conflict rather than resolving it.

**Must not be disturbed:** everything 25-Q shipped on Stage 1; the collapse behaviour and worklist
entry point from the 25-R addendum; the commentary's position above the causes fields; whatever 25-S
lands.

---

## §1 — The build must survive the user looking away

**CC's own measurement, 1 September:** the Railway build worker **is not deployed**. Seven Railway
services were read and none runs `build:worker`. So builds run as Vercel functions, one invocation
per pass, **driven by the user's browser tab polling every three seconds.**

**Two consequences, both serious:**

- ⚠ **A tester who switches tabs or apps stalls their own build.** Browsers throttle timers in hidden
  tabs. This is the likeliest explanation for the two recorded stalls — 595 s before one build's
  first pass, 369 s before another's — and it is a hypothesis CC raised, not a measurement.
- ⚠ **SMART ran at 285.5 s against Vercel's hard 300 s per-invocation limit** — under fifteen seconds
  of margin, on the pass that produces the best output the platform has. Vercel kills mid-pass with
  no reason given; our own ceiling stops tidily between passes and says why.

### The sequence, and the order is not optional

**1a. Deploy the service that runs `build:worker`.** ⚠ **Prove it is alive with a positive log line
from the worker itself — a counter, a heartbeat, a claim attempt. An absence of errors is not
evidence.**

**1b. Enqueue one job and show the worker picking it up, by job id.** ⚠ Not "the queue is empty
therefore it ran".

**1c. Then, and only then, Charlie flips `LEX_BUILD_DRIVER` to `worker` in Vercel.** CC cannot — the
token authenticates and is then refused by the account's SAML scope. **Report the exact variable
name and the exact value for him to set, and say what else in Vercel needs checking while he is in
there.** ⚠ **If the driver is flipped before 1a and 1b, every build queues and nothing runs it.**

**1d. The acceptance test is one full build with the tab closed.** ⚠ **Nothing else proves this.** A
build that completes with the browser watching proves only what we already have.

**1e. Report what happens to the 300 s limit and to SMART's 285 s once the build is off functions.**
⚠ **Change nothing about `HARD_STOP_MS`, `PASS_BUDGET_MS` or SMART until the worker is running** —
those are margins against a constraint that is about to stop existing, and CC's measurement already
recommended raising neither.

**1f. Auto-restart, bounded.** A build stopped by an external constraint resumes itself rather than
waiting for a person. ⚠ **Two automatic attempts, then it stops and tells the user.** An unbounded
retry is how a stuck build spends money overnight.

**1g. Railway app-sleeping.** The handover records it as settable, surviving redeploy, and having no
effect, cause unknown. ⚠ **A worker that sleeps does not pick up jobs.** Report whether sleeping
applies to this service and what it would do to a queued build.

**1h. "Email me when it's done".** ⚠ **This checkbox is currently a promise the architecture cannot
keep** — it tells the user they may walk away, and walking away stops the build. Until 1d passes, it
is **unticked by default** and the page says the tab must stay open. Once 1d passes, both revert and
the promise becomes true.

## §2 — Lex can produce a merge but cannot create one

25-R established this is a design gap rather than a bug: a merge is not an edit to a field. It
**creates a new numbered policy, supersedes two, and inherits both their causes** — and no existing
edit mechanism can express that. CC correctly declined to invent one.

⚠ **Charlie's decision 30 is read as: build it properly.** It is the interaction he named — *"merge 4
and 8"* — and 25-P built the four verdicts that decide whether a merge is even allowed. Without the
write, the guiding-policy screen is a menu rather than the design tool it was specified to be.

**2a.** ⚠ **Diagnose first and report before building.** State what a write mechanism has to be able
to express — create-one, supersede-two, inherit-causes — and whether the existing one can be extended
or needs a sibling. **Report the choice and the reason; do not build the larger one silently.**

**2b. The merge writes only on the user's acceptance**, as a card showing the two parents and the
proposed merged policy side by side.

**2c. The merged policy takes the lowest unused number.** ⚠ Parents are **superseded, not deleted** —
they keep their numbers, appear in the rejected list with the reason "merged into 9", and can be
restored.

**2d. The merged policy inherits both parents' causes**, and where those causes are different links
of one chain, the chain-link consequence from 25-P §1.8 renders on it.

**2e. Only a MERGE verdict writes.** The other three verdicts — contains, sequence, contradicts — say
so and write nothing.

**2f.** ⚠ **Where Lex still cannot write, it says so plainly and never sends the user on an errand.**
25-R put that rule in every turn; assert it survives this change.

## §3 — The read-back list

⚠ **Two rules have been written about checks in two days and neither caught the next instance of the
class.** This is a different shape: not a rule about how to write a check, but a **list of sentences
that must be visible**.

**3a.** Every user-visible string this sprint adds or changes goes into a list in the report.
**3b.** Each is **read back off the running production page**, one at a time, and reported found or
not found. ⚠ **Not "the component renders" — the sentence, on the page, in the browser.**
**3c.** ⚠ **A string that cannot be reached without a build or a specific state is reported as NOT
CHECKED, with the state it needs.** Not omitted, and not assumed.
**3d.** Report at the end whether this caught anything the checks did not. ⚠ **If it caught nothing
and something visible is later found missing, say so — that is the result that retires the idea.**

## §4 — Acceptance criteria

- A worker log line proves the worker alive, and a job is shown picked up by id.
- Charlie is given the exact variable and value to set, and told what else to check while in Vercel.
- **One full build completes with the tab closed.**
- Sleeping is reported against this service, and auto-restart stops after two attempts.
- "Email me when it's done" matches what the architecture can actually do, in both states.
- A merge writes only on acceptance, takes the lowest unused number, supersedes its parents without
  deleting them, and inherits their causes.
- A non-MERGE verdict writes nothing.
- Lex never instructs the user to go and do something by hand that the product can do.
- The read-back list appears in the report with every string marked found, not found, or not checked.

## §5 — Say what only Charlie's browser can confirm

⚠ **The tab-closed build is the one that matters and CC can run it. Say whether it did.**
