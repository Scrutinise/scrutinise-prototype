# SCOPE — Relevant people ("friends and foes") for a policy idea

**Written:** 2026-11-19 00:18 UTC · **Read-only scoping.** Nothing built, migrated, committed or paid for.
**Counts measured:** 2026-11-19 00:16–00:18 UTC, SELECT-only against the web app's Neon DB (`scrutinise-web/.env`), by a throwaway script since deleted.

**Marks used on every number:** **[M]** measured tonight by a query (named) · **[I]** inferred from code or docs, not measured · **[U]** unverified (from memory or general knowledge; check before relying on it).

---

## In plain English

For any idea, Charlie wants a list of who matters and which side they are on. **We already hold a strong record for Parliament**: every Commons vote since 2016 and Lords vote since 1999, two million early-day-motion signatures, 160,000 committee evidence appearances, and a tool that turns a written name into "which person or organisation in our records could this be, and how sure are we". **We hold almost nothing about anyone outside Parliament's own records**: journalists, bloggers, podcasters and X accounts are not in the database at all. The web-and-X search that runs when an idea is built *does* name people and organisations, but none of that has ever been saved. 0 of 143 ideas hold one. Most witnesses who are individuals are known only by name, not by a reliable identity. The rest of this note sets out what exists, what is missing for each kind of actor, and three ways a ranking could be built.

---

## a) What we already hold, and how to read it

**Entities and identity** (`graph_entity`, `graph_entity_identity` view; exact COUNT):

| kind | identified | probable | mention-only | total |
|---|---|---|---|---|
| person | **2,603** (key `parl-member-id`) | **788** (key `name-match`; 785 carry a parl id) | **45,072** (`singleton`) | 48,463 |
| organisation | **26,111** (key `parl-cis-id`) | 0 | **14,407** (`singleton`) | 40,518 |

[M] `graph_entity` = 88,981 rows; `graph_alias` = 105,512 rows. External keys held [M, `graph_entity`]: organisations with a Companies House number 4,812, with a charity number 2,405; people with a TheyWorkForYou id **0**. `graph_member_register` 5,234 rows [M]; `graph_identity_signal` 187 rows [M]; `graph_org_register` 8,067 rows [M].
⚠ [M] `graph_member_register` reports 898 rows with `latest_house = 1, is_current = true`. The Commons has 650 seats. If house 1 is the Commons, as it is in Parliament's member data [U], that flag does not mean "sitting MP". Read the column's definition before any use.

**Edges** (`graph_edge_all` view, which joins stored and derived edges; GROUP BY predicate, 2.3 s) [M]:

| predicate | rows | storage / source | notes |
|---|---|---|---|
| `voted` | 2,477,541 | derived from `division_votes` | `division_votes` itself = 2,528,032 rows, 2,735 distinct members [M]. Commons 1,532,957 (2016-03-09 → 2026-07-14), Lords 995,075 (1999-11-24 → 2026-07-21) [M]. `divisions` = 5,645 (Commons 2,361, Lords 3,284) [M]. The ~50k gap between votes and edges is unexplained. It is probably unresolved members [I]. |
| `gave-evidence-to` | 162,733 | stored `graph_edge` | 85,542 distinct subjects; first/last seen 2012-12-07 → 2026-07-21 [M] |
| `signed-motion` | 59,925 | derived view | **Primary sponsor only** (schema-2d2.sql comment) [I]. The full signatures are in `edm_signatory` = 2,126,171 rows [M]; `edm_sponsor` = 60,995 motions, 1989-11-21 → 2026-07-15 [M] |
| `holds-position` | 16,196 | derived view (offices) | |
| `declared-interest` | 1,505 | stored `graph_edge` | 438 subjects, all identified MPs/peers; 2012-12-13 → 2026-07-12 [M] |

**Committee witnesses by identity tier** (`graph_edge` ⋈ `graph_entity_identity`) [M]:
- People: identified 495 edges / 192 people; probable 1,963 / 788; **mention-only 56,410 / 45,072**.
- Organisations: identified 86,339 / 26,111; mention-only 17,526 / 13,379.
- So **~94% of individual witnesses (45,072 of 48,052) are names with no stable key** [M, arithmetic on the above].

`graph_mention` (the one view of every mention, carrying its tier) = 2,717,900 rows [M, COUNT 7.4 s]. Of the `voted` rows, 740,608 sit on *probable* identities and 1,736,933 on *identified* ones [M].

**Signals and stance** [M, `position_signal_stored` GROUP BY signal_type]: edm_signature 2,065,026 (2,012 actors); witness_appearance 175,290 (85,542 actors); declared_interest 1,723 (438); political_donation 244 (122). Vote signals are not stored. They are computed per request by `position_signal_for()` / `position_signal_vote` [I, positions.ts]. `position_estimate` ≈ 4.3M rows (pg_class.reltuples, **estimate**). `position_donation` = 89,861 rows [M].
**Proposition-level stance from evidence text**: `graph_position` = 37,657 rows over `graph_proposition` = 83 propositions [M]. Of those rows, 21,461 are `no-position`, 13,130 `for`, 2,211 `against` and 744 `balanced`. Capacity is also recorded (own-view / representative / government-line) [M]. This is the only stance read from *what someone said* rather than *what they did*. It covers 83 propositions, not arbitrary ideas.

**How positions are read today** (`lib/graph/positions.ts`, [I] from code): `positionsFor(targets)` takes **concrete targets** (division, EDM, inquiry, organisation, bill, instrument). It does not take a topic. Matching an idea to targets is left to `findTargets` / `findTargetsByPhrases`, which run a title/phrase match over `divisions` and EDM titles. For each actor it aggregates signals (weights and half-life decay in `position-config.ts`, all marked *provisional*). It returns `consistency` (−1…+1), `confidence` (0…1, saturating on net evidence), a fixed-vocabulary `claim`, a per-target breakdown that is never summed, and up to 12 cited grounds with party-at-the-time. **Ranking: confidence desc → signal count desc → name**, printed verbatim (`RANK_KEY_WORDING`). The result also reports ties (`ranking.tiedAtTop`). Actors with no signal are absent, never scored 0. Every row carries its identity tier. Nothing in it measures **influence**.

**`lookupName`** (`lib/graph/name-lookup.ts`, [I]) normalises a written name: it strips honorifics, "MP" and "the". It then matches `graph_alias.surface_norm` and returns every candidate with its kind, identity tier, statement and parl id, ordered by tier. It **never picks one** (`status: none | one | many`). It reaches only entities already in the graph, so a journalist or podcaster returns `none`.

## b) What orientation already returns about people, and whether it is stored

- **v2** (`lib/lex/orientation/v2.ts`, [I]): Gemini web (Tier B) plus Grok `x_search` (Tier C). It returns `vocabulary.people[]` and `vocabulary.organisations[]` as bare strings with no role or stance. It also returns `arguments[]`, each with a `side` (for / against / nuanced) and a `source.label`/`url`. For X the label is the **author handle** plus "(low-credibility source)" where flagged; for web it is the page title. That gives an *attributed stance per author* for X, and per page for the web, not per person. `termsForSearch` passes statutory terms, key terms and **organisations** to the router. **`people` is not used by anything** [I].
- **v1** (`index.ts`, `x-orientation.ts`, [I]): `recency.whoIsTalking[]` is `{who, position, date, tier, source}`. It is the closest existing shape to a friends-and-foes row. `argumentsMined[]` carries author, stance and `timesSeen`.
- **Storage** [M, `"Idea"`]: 143 ideas, **28 hold an `orientation`**, all v1 shape (`ranAt` 2026-08-10 → 2026-09-23). In all 28, `calls`, `argumentsMined` and `whoIsTalking` are **empty arrays** and `failed` is false. **0 ideas hold a v2 orientation.** SEARCH_29_REPORT says v2 sits behind `LEX_ORIENTATION_V2`, default off [I]. So **no person or organisation found by orientation has ever been persisted.** v2 would write it to `Idea.orientation` (build.ts:1809) if the flag were on [I].
  ⚠ **Unreconciled count (added 19 Nov 00:19 UTC by cc-search).** A separate query in the same session (`orientation IS NOT NULL AND "deletedAt" IS NULL`) found only **2** live ideas with a stored orientation (452c5ade, 6dc530ce). SEARCH-29 also recorded "2 of 64". The 28 above most likely includes deleted ideas, or rows holding a JSON `null`. Not settled. The conclusion doesn't change either way: 0 hold v2, and no orientation has stored a person.

## c) Gaps and candidate sources, by actor type

Licence register: `docs/LICENCE_REGISTER.md` records **OGL v3.0 / Open Parliament Licence as CLEAR** (Hansard, committees, verified 12 June 2026). It has **no row** for the Members API, IPSA, Companies House, the Charity Commission, the Electoral Commission, think-tank sites, podcast RSS or X [M, grep].

| actor | what we hold | gap | candidate sources (licence) |
|---|---|---|---|
| **MPs** | Votes since 2016, EDMs, declared interests (438 people), offices, donations | Speeches are not linked as stance signals; no influence measure (role, committee chair, majority); no social handles | Members API: posts, committees, contact incl. some social links (OPL **[U]** on the API specifically); Hansard speeches already in corpus (OPL, register); IPSA expenses (OGL **[U]**); TheyWorkForYou ids (0 held; mySociety data licence **[U]**) |
| **Peers** | Votes since 1999, signatures n/a, interests | Same as MPs. Lords interests coverage unmeasured | Members API and the Lords register of interests (OPL **[U]**) |
| **Witnesses** | 162,733 appearances | 45,072 individuals mention-only; affiliation at the time not linked; stance only on 83 propositions | Committee evidence pages already ingested (OPL); `graph_position` extension to idea-specific propositions; Companies House officers (OGL **[U]**) for affiliation |
| **Think tanks** | Some appear as identified witness orgs; 4,812 orgs with CH number, 2,405 with charity number | No list of think tanks; no publications or funding transparency | Charity Commission register (OGL **[U]**); Companies House (OGL **[U]**); think-tank sites (each its own copyright: **per-site terms, unverified**); Who Funds You? ratings (terms **[U]**) |
| **Journalists** | Nothing | No entity kind for them | Publisher bylines via web search (copyright; quote/link only **[U]**); orientation v2 web sources (labels only) |
| **Bloggers** | Nothing | Same | Web search / RSS feeds (author copyright; metadata and link use **[U]**) |
| **Podcasters** | Nothing | Same | Podcast RSS feeds and directory APIs. Show metadata is usually fine to index; episode audio/transcripts are not ours **[U]** |
| **X accounts** | Nothing persisted; handles appear transiently in orientation | No storage; no stable id (handle only); no reach measure | Grok `x_search` (already paid per build); X API developer terms restrict storage and redistribution of content and require deletion sync **[U, not checked]** |

## d) Design options for ranking friends and foes for one idea (no recommendation)

**Option 1: Parliamentary record only, from what is built.** Idea → concrete targets (`findTargetsByPhrases`) → `positionsFor` → split the actors by consistency sign. "Influence" is a fixed set of facts read from data already held: office held, committee membership, house. *Needs:* a target-matching step good enough for one idea (owned by **Search**), and an influence column from `holds-position` (**Graph**). *Cost:* no new data, no model calls; query time per idea is unmeasured. *Limits:* MPs and peers only; witnesses only through appearance (no direction) unless the idea maps to one of the 83 propositions.

**Option 2: Option 1 plus persisted orientation actors.** Turn on and store v2 (or v1 `whoIsTalking`). Pass each person, organisation and X author through `lookupName`, which puts each one into one of two groups: those that match the graph join the Option 1 list, and those that do not stay as "named in web/X, identity unverified" (Tier B/C, quarantined as orientation already is). Stance comes from the argument's `side`; recency from its date. *Needs:* the flag on, a small store for orientation actors per idea (an entity-list change, so Charlie's call), and the never-merge rule kept. *Cost:* the Gemini + Grok spend already incurred per build, plus nothing new per lookup. *Owners:* **Lex/Search** (orientation), **Graph** (lookup). *Limits:* one run's sample. X stance per handle, not per person. Run-to-run variation (SEARCH-30 documented 21 vs 6 arguments).

**Option 3: A standing actor register beyond Parliament.** New entity kinds (journalist, think tank, podcast, X account) seeded from registries and feeds (Charity Commission, Companies House, RSS, curated lists). Stance is extracted per idea from their own published text in the way `graph_position` does it for witnesses. Influence comes from external measures such as follower counts and audience, each with its licence. *Needs:* licence work on every new source (rows in LICENCE_REGISTER first), ingest (**Ingest**), entity resolution (**Graph**), and a per-idea extraction model run (**Search**). *Cost:* ingest storage plus model calls per idea × actor. Unmeasured, and the largest of the three by a wide margin [I]. *Limits:* X API storage terms may prevent keeping posts at all **[U]**.

Common to all three: the identity tier must stay visible on every row (positions.ts already enforces this). "No signal" must stay absent, never neutral. Every weight is provisional until the design §8 validation set measures it.
