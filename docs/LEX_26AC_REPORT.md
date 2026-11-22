# LEX 26-AC — Private Scrutiny: sizing (before any build)

*cc-lex, 22 Nov 2026 21:25 UTC. Worktree `C:\lex26ac`, branch `wip/26ac` from Main `abd282db`. Nothing built yet. Per §0, size first.*

## What exists to reuse (read from the code; the three load-bearing claims re-checked by hand)

| Need | Exists | Fit |
|---|---|---|
| A frozen, numbered copy of the idea | `ProposalVersion` (append-only, numbered per idea, `contentHash`, whole `snapshot` JSON) and `mintVersion` (`lib/documents/proposal-version.ts`) | High: an edition can be a ProposalVersion plus an edition row |
| A reader's page of a frozen copy | `app/proposals/[token]/page.tsx` renders a whole snapshot, set-aside sections included | High as a starting point; it is a share-link page, not a signed-in reviewer page |
| The idea in one page (§2.1) | `buildIntroductorySummary(snapshot)` (`lib/documents/build-background-report.ts`), PURE, no model call, every figure from the record | High: it runs on an edition's snapshot unchanged |
| Options considered and set aside (§2.4) | `notTakenBlocks()` (`lib/documents/pack-sections.ts`) over the snapshot's `actionsPack.ruledOut` / `.setAside` | High |
| Sources (§2.5) | `IdeaSource` registry, `[Ref: n]` parsed from text, `ResearchNote.sourceId`, `ActionDocumentVersion.sources` | Medium: there is NO link table between a section or claim and a source; the source-linking exercise (§3) needs one |
| Contributions with replies, nothing deleted (§5) | `ResearchNote` + `ResearchNoteReply` rules: others' notes arrive UNREVIEWED, set aside with a reason, restore, replies | Medium: no edition number, no five kinds, no owner answer; `sourceId` is required |
| Invitations by email (§4) | `UserInvite` + `/api/ideas/[id]/collaborators` + `/invite/[token]`; Resend via `lib/email.ts`, live in production (`/api/health` mail: true) | Medium: it makes a COLLABORATOR, and the invite lands on the legacy `/prototype/idea/{id}` |
| Read-only Lex (§8) | `READ_ONLY_CATEGORIES` = see/search/explain and the ASK mode filter (`lib/lex/agent/loop.ts`) | Medium: the agent refuses non-owners; one conversation per idea; tools read the LIVE idea, not an edition |
| A spend cap (§8) | `LlmSpend` has userId and ideaId; `checkUserCeiling` exists in `spend-ledger.ts` but nothing calls it | Medium: needs a per user and per idea variant, and the cap stored on the reviewer's grant |
| The printed edition (§7) | DocumentModel → pdf-lib / docx → R2, per-version keys `v{n}` | High, but there is NO per-page footer (edition and date on every page) in either renderer |
| The stage-bar count (§6) | `stageContext()` shows Private Scrutiny as "not yet open"; `ReviewRecord.privateReview` hook unused | High |

## Found on the way (decisions or risks, not mine to settle alone)

1. **⚠ A VIEWER collaborator can write today.** `authorizeIdea()` (`lib/lex/authz.ts`) admits the owner and ANY collaborator and never
   reads `role`, so a VIEWER has an EDITOR's access to every Lex route. This is pre-existing, not 26-AC, but 372 ("reviewers see only the
   scrutiny page") must not be built on that role. **Proposal:** reviewers get their own grant table, never a collaborator row, so no
   existing route admits them at all. The VIEWER hole is reported for CCh separately.
2. **⚠ A new reviewer could not create an account.** `lib/invite-gate.ts` accepts only a platform Invite or an addressed CommunityInvite
   as leave to sign up, so a reviewer invited by email (367) would be refused at sign-up. The gate must accept a reviewer invitation.
   **That file is the platform's sign-up gate** (not Lex's); per the stop rules I ask before touching it.
3. **⚠ The snapshot holds each draft's LATEST version, not its ACCEPTED one** (`packDocuments` in `lib/lex/action-documents.ts` takes
   `orderBy v desc, take 1`). §2.3 wants the accepted draft, or the latest labelled as such. The edition builder will read accepted
   drafts (`acceptedDrafts()` exists) and label the rest; the Actions Pack's own behaviour is left as it is unless CCh says otherwise.
4. **Email:** Resend is wired and live, and invitations go through the existing sender at no new provider, so §4's "stop if none or it
   costs money" does not trigger. (Per-email cost is within the existing Resend plan, which I cannot read: Charlie's account.)
5. **Lex for reviewers reads the EDITION**, not the live idea (368), so it needs its own small read-only tools over the snapshot, not
   the owner's `see` tools.

## Sizing, in §9's order

| Part | Work | Hours | New tables (production schema: SQL reported first) |
|---|---|---|---|
| **(a)** page + editions + Preview as a reviewer | Edition builder over ProposalVersion (accepted drafts; summary; notes; set-aside; sources); create / edit draft / publish; the pre-publish checklist; the reader's page (phone: one panel at a time, Z1's bar); Preview as a reviewer; author's notes (374); Lex parity: create an edition behind a confirm card. The source-linking exercise is priced and asked first; built here as proposals only. | 10–12 | `scrutiny_edition`, `scrutiny_author_note`, `scrutiny_source_link` (proposed or accepted links) |
| **(b)** invitations, access, contributions, blind rounds | Reviewer grant + invite (email through `lib/email.ts`); `/scrutiny/…` access (a reviewer reaches nothing else); five kinds on any section / action / draft / paragraph; replies; set aside and restore; blind rounds; carried forward to edition N+1; the overall three-question form | 10–12 | `scrutiny_reviewer`, `scrutiny_contribution`, `scrutiny_reply`. Plus the sign-up gate (item 2, needs a GO) |
| **(c)** owner's answers, messages, stage count | Accepted (link to the change) / Noted / Declined (reason; joins the next edition's set-aside, credited); direct threads; the stage-bar count | 5–7 | answer columns on `scrutiny_contribution`; `scrutiny_message` |
| **(d)** printed edition | A new document kind from the edition; edition number and date on every page (a footer in both renderers); "with contributions" option | 3–4 | none |
| **(e)** Lex for reviewers | Lift the owner-only gate for reviewers on the edition only; a per-reviewer thread; read-only tools over the snapshot; the cap per reviewer (default 50p) with the counter and the words at the cap; the owner's spend view | 7–9 | thread on `scrutiny_reviewer` or `scrutiny_lex_message`; cap on `scrutiny_reviewer` |
| | **Total** | **35–44** | |

Checks per part as §11, on scratch copies, mutation per behaviour; nothing writes to 452c5ade's content.

## Next

**Stopped here for a GO on two things** (stop rules: unapproved production schema; another stream's file):
1. Part (a)'s three tables. The SQL comes with the GO request (`whichdb` first, then the SQL, then schema + SQL in one commit, before
   any code that reads them).
2. Whether Lex may extend `lib/invite-gate.ts` in part (b), or Central does it.
Then (a) is built and pushed under 365, and it stops for Charlie's phone check before (b).
