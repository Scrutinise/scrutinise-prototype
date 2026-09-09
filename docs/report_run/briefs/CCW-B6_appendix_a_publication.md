# CC BRIEF B6 — Publish Appendix A and return a link that works

**Track:** corpus · **Owner:** CC-Graph · **Run:** Wednesday 2 Sep (not Thursday)
**Output location:** `docs/report_run/`. Standing rules: `CLAUDE.md`. No git mid-run.

---

## 1. Why this exists

Appendix A of the report is the full reference lists — roughly 3,200 rows across three measures.
It is not printed; nobody reads 3,200 rows on paper. What is printed is a short link, and what that
link proves is that **the rows exist and can be checked by anyone who doubts the counts**. That is
the appendix's entire job, and a dead link does that job in reverse.

The reader is being handed a paper document with no hyperlinks in it. The link is his only route to
the evidence.

---

## 2. Why R2 and not a route on scrutinise.org

R2 is independent of the Vercel deployment. A route on the app introduces a deploy dependency on
print morning for no benefit — and this repo's own history has production failing to build for ten
hours on a day nobody expected it. Publish to the bucket; leave the app out of it.

---

## 3. What to do

1. **Assemble the payload** from `docs/report_run/`: the three `{ws_id}_inbound.csv` files, the
   three `{ws_id}_inbound.json` files, `scoping_remaining.csv`, `register_resolved.csv`, and the
   coverage blocks. One `.zip` plus the individual CSVs alongside it, so a reader can take one file
   or all of them.
2. **Publish to the public R2 bucket** under a stable, short, guessable-but-not-secret prefix —
   propose the exact key before you write it and put it in the output file.
3. ⚠ **Include a one-page `README.txt` inside the payload** stating the generation timestamp, what
   each file contains, and — verbatim from the run — that `markup`, `text` and `enabling` are three
   different strengths of evidence and are never summed. Somebody will open this without the report
   beside them.
4. **Return the URL** and confirm it resolves **unauthenticated** — fetch it with no credentials
   present and report the HTTP status and the byte count.

⚠ **A signed URL is not acceptable here.** `CLAUDE.md` §7 rule 10 requires signed 24-hour URLs for
*private* R2 files; this is a deliberate publication of non-personal, non-confidential corpus data,
and a 24-hour link on a document somebody keeps is a link that is dead when he opens it. If the
bucket in use cannot serve public objects, **stop and report that** rather than falling back to a
signed URL.

---

## 4. Output contract

`docs/report_run/appendix_a_publication.md`:

- the exact object key(s) written
- the public URL, as it will be printed
- the unauthenticated fetch result: HTTP status, content length, content type
- total payload size and the row count of each file, each with its denominator
- anything that had to be excluded, and why

---

## 5. ⚠ One check that is Charlie's, not yours

The URL must be opened **from a phone, on mobile data, off the home network**, before it is printed.
A URL that resolves from the machine that published it has proved almost nothing. Flag this in your
output as an outstanding action for Charlie with the URL ready to tap.

## 6. Done means

- [ ] payload published; exact keys recorded
- [ ] URL fetched with no credentials and the status recorded
- [ ] `README.txt` inside the payload carries the timestamp and the never-sum rule
- [ ] no signed URL used, or the blocker reported instead
- [ ] Charlie's phone check flagged as outstanding, with the URL
