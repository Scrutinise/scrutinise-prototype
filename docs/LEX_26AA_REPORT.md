# LEX 26-AA — loose ends

Brief: `docs/BRIEF_26AA.md`. Worktree `C:\lex26aa`, branch `wip/26aa`, from Main `239658bb`. Nothing here writes to 452c5ade's content.

## §0 Sizing (19 Nov 2026 00:45 UTC)

| # | Item | Estimate | State |
|---|---|---|---|
| 1 | Hard deletes of user content → archive with restore | 7–9 h | **Waiting**: inventory below; schema and scope questions |
| 2 | Lex `edit_cause` / `add_cause` / `retire_cause` | 3 h | ready |
| 3 | Lex `draft_heading_needs` | 2 h | ready |
| 4 | Re-measure four document kinds' prices (n ≥ 3, cap £1.50) | 2 h, plus model spend under £1.50 | ready |
| 5 | Field-guide coverage: SourceBrowser, AddResearch | 1.5 h | ready |
| 6 | Scripts typecheck's three `scripts/ingest/shared` errors | 0.25 h | **done**: still present; reported to cc-ingest |

About 16 hours in all.

### Item 1 — the inventory (before changing anything, as §1 says)

How it was made: every `.delete(`, `.deleteMany(` and `DELETE FROM` under `app/` and `lib/`, every `export async function DELETE` under
`app/api` (16 handlers), and every raw-SQL and pg-pool path. Line numbers are read from the files. Two claims were re-read by hand: the
legislation-link scoping, and `removeCause`.

**A. User content, hard-deleted today**

| # | Where | What is deleted | Reached from | An archive column today? |
|---|---|---|---|---|
| A1 | `lib/lex/field-machine.ts:995` `removePolicyOption` | `PolicyOption`: a guiding-policy candidate | POST `/policy-options` `{action:'remove'}`; "Delete" in `FieldsPanel.tsx:1234` | No. Its `status` has RULED_OUT, a different act. |
| A2 | `app/api/ideas/[id]/notes/route.ts:199` | `IdeaNote`: a private note | DELETE `/notes?noteId=`; "Delete" in `NotesPanel.tsx:275` | No. Only `hidden`, which collapses a note. |
| A3 | `app/api/ideas/[id]/legislation-link/route.ts:67` | `CoherentActionSection`: a law section linked to an action, with the owner's proposed wording | DELETE `/legislation-link`; no screen calls it | No |
| A4 | `app/api/ideas/[id]/material/route.ts:279`, and the Lex tool `archive_source` (`tools.ts:990`) | the `EvidenceItem` findings of a source the owner archives, **ACCEPTED ones included** | archiving a source. The source itself is soft-archived. | No. Only `status`. |

⚠ **A3 is also an authorization bug.** The handler checks that the caller owns the idea in the URL, then deletes by
`coherentActionSectionId` alone. Anyone who owns any idea can delete another idea's link if they know its id. No screen calls it, so
the exposure is the API only. The fix (scope the row to the idea) belongs with A3's archive. Because it is a security fix, it could also
go ahead on its own.

**B. Outside the Lex stream (Central's files), so not changed here.** The shared-file rule applies (stop rule 5):
- `app/api/communities/[id]/bulletin/[postId]/route.ts:87-89` hard-deletes a bulletin post, its replies and votes. `BulletinPost`
  already has `deletedAt`, and `lib/content-deletion.ts:348 deletePost()` soft-deletes, but this route bypasses both.
- `app/api/communities/[id]/titles/route.ts:146` hard-deletes a `CommunityTitle`. That is community configuration.
- `app/api/ideas/groups/[groupId]/route.ts:45` deletes an `IdeaGroup` on "ungroup". The user loses the group's name, not the ideas.
  This one is My Ideas, so it is arguably Lex's.

**C. Already archived:** causes (`removeCause` sets `archivedAt`); sources (`archivedAt`); the idea itself (`deletedAt`); endorsements
(WITHDRAWN); community questions, answers and resources (`content-deletion.ts`); invites (`revokedAt`); memberships (archived to
`CommunityMembershipArchive`).

**D. Excepted (decision 320):** `CostLine` (`field-machine.ts:1283`, `remove_cost_line`) stays deletable.

**E. System or derived (not user content), left as they are:**
- toggles: worklist ticks, alert subscriptions, and votes and favourites;
- memberships;
- in-flight placeholders: consolidation, and the gap-check RUNNING marker;
- the POSITIONS pass, which is rewritten wholesale;
- duplicate HELD action ideas merged into a survivor;
- a failed turn's user message, so that it can be resent.

### What item 1 needs before it starts (QUESTION to CCh, Needs-Charlie)

1. **A schema change on production.** A1–A4 need archive columns: `archivedAt`, `archivedById` and `archiveReason`, on
   `PolicyOption`, `IdeaNote`, `CoherentActionSection` and `EvidenceItem`. The brief asks for "status + reason + when + by", but no
   approved brief names the change, so it is stop rule 3. The proposal is four nullable columns per table, additive, applied to Neon
   first with whichdb, and committed with the schema in one commit.
2. **Scope.** Is `IdeaGroup` "ungroup" (B, My Ideas) in? Do the Central routes go to Central, or into one agreed commit?
3. **The A3 security fix.** May it go ahead now, on its own (scoping only, no schema)?

Items 2–6 do not depend on item 1's answers. The brief says "in order", so going ahead with them while item 1 waits is also a question
(4).
