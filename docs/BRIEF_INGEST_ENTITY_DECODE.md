# BRIEF — THE CORPUS TEXT IS NOT FULLY DECODED, AND SEARCH MAY BE PAYING FOR IT

**Owner:** CC-Ingest, with a measurement for CC-Search in §2
**Stream:** INGEST
**Written:** 17 August 2026
**Source:** found by CC-Graph while diagnosing 2D-3's extract-match rate. Reported, not fixed —
correctly, since it is neither their code nor their stream.

**Where this sits:** ahead of the remaining ingest queue (~23,000 orphaned sections, 117,667 false
`pdf-only` rows, ~288 broken keys), because unlike those it may be **degrading something that is
live right now**.

---

## §0 — What was found, and why it is not a graph problem

2D-3's position extractor could not find 25.9% of the passages the model quoted. Dumping the bytes
rather than hypothesising found the cause: **compiled `committees-evidence` text in R2 contains
literal, undecoded HTML entities.**

Measured over 200 random documents: **24 of them (12.0%) contain at least one, 5,322 occurrences** —
`&#xa0;` (5,212), `&#x2011;` (107), `&#xad;` (3). A document reads
`Barbara&#xa0;Rayment` where it should read `Barbara Rayment`.

The graph repaired it on the read side and the not-found rate fell 25.9% → 2.9%. **That fix is local
to the graph. The entities are still in R2, and still in whatever the search stack indexed.**

⚠ **`&#xa0;` is a non-breaking space, which means it usually sits BETWEEN TWO WORDS.** So the two
words are glued into one token. A user searching for a name, a phrase or a statutory term that
happens to straddle one of these cannot match it — and nothing would report that. It looks exactly
like the document not being relevant.

---

## §1 — Measure the spread before deciding anything

**Per corpus**, over a defensible sample: what proportion of documents contain a literal entity, how
many occurrences, and which entities. 200 documents from one collection is a signal, not a census.

Specifically:

1. **Is it confined to `committees-evidence`, or general?** The obvious suspects are anything that
   came from HTML or from PDF extraction. Legislation came from CLML and may be clean; the political
   sources from V34 may not be.
2. **Which entities appear?** `&#xa0;` glues words together and is the damaging one. `&#xad;` is a
   soft hyphen and may be invisible in rendering but present in the index. Others may be harmless.
3. **Does it reach the user?** A section whose title or snippet carries a raw `&#xa0;` would display
   it. **Check a rendered search result, not just the stored text.**

---

## §2 — The search question, which is the reason this is urgent

**For CC-Search, and it needs the ingest measurement first.** Does an undecoded entity break
retrieval, and by how much?

The test is direct: take a phrase that straddles an entity in a real document, search for it as a
user would, and see whether the document comes back. Then do it for a sample large enough to give a
rate.

⚠ **Do not assume the answer either way.** The FTS tokeniser may already split on `&`, in which case
the damage is smaller than it looks. Or it may not, in which case some proportion of the corpus is
partially unsearchable and every recall figure we have taken is an underestimate. **Both are
plausible and only a measurement distinguishes them.**

⚠ **And this bears on numbers already reported.** If it matters, the gold-set recall figures, the
ABSENT counts and the tier-fusion measurement were all taken over a partially damaged index. That
does not invalidate the *comparisons* — both sides had the same handicap — but it does mean the
absolute numbers are floors.

---

## §3 — Then fix it, at the right layer

Three places it could be repaired, and the choice depends on §1:

1. **At ingest, in the compiler** — decode before writing to R2. Correct at the source, but leaves
   every existing document wrong until reprocessed.
2. **At index build** — decode on the way into the keyword and vector indexes. Fixes retrieval
   without touching R2, and leaves the stored text still wrong for anything reading it directly.
3. **At read** — what the graph did. Fine as a local repair, wrong as a general answer, because
   every future reader has to remember.

**My recommendation, subject to §1: decode at ingest AND rebuild the indexes**, so the stored text
and the searchable text agree. A repair in one and not the other is how two components come to
disagree about what a document says — which is the class of defect this project has spent a
fortnight finding in other forms.

⚠ **Do not decode blindly.** A legislative text may legitimately contain an ampersand-hash sequence
inside quoted material. Decode a named, measured set of entities rather than everything that matches
a pattern, and report what was changed.

---

## §4 — Standing

**Predict the reprocessing cost before running it**, as V35, V36 and 2D-3 all did — and 2D-3's own
prediction held to 1.5% only because it was re-priced after the facts changed.

⚠ **And say plainly whether the numbers already reported are affected.** If they are floors rather
than measurements, the change log should say so where those numbers appear, not only here.
