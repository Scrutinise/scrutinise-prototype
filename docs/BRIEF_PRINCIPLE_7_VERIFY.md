# BRIEF — VERIFY AND FIX PRINCIPLE 7 (search-engine discoverability)

**For:** CC (web/surface stream — this touches serving, not ingest)
**Written:** 26 August 2026 · **Deadline: 4 September 2026**, the day before the Find Case Law licence application must be submitted.
**Size:** half a day if the position is already correct; one day if it is not.

---

## Why

Charlie is applying for The National Archives' computational analysis licence. Principle 7 of the nine licence terms is the only one a reviewer can check from outside our building, and it is concrete:

> *"Licence holders must not index the contents of judgments and decisions on search engines… You should consider what you will do to prevent third party services from crawling or scraping either the text of the records or the data you have extracted from the records."*

The draft application states as fact that judgment pages carry `noindex, nofollow` and that `robots.txt` disallows those paths. **Nobody has checked whether that is true.** Two answers in the application depend on it, and a claim that turns out to be false is worse than a weaker true one.

Application question 21 also needs a factual answer: *"Will you make the entire record available online?"*

---

## Rules for this sprint

**Check from outside, not from the repository.** A `robots.txt` in the source tree is not a `robots.txt` being served. A meta tag in a component is not a meta tag in the delivered HTML. Every finding must come from a request made against the live production host and the response quoted in the report. This is the same rule as *a push is not a deploy*, and this project has been caught by it repeatedly.

**Report before fixing.** Part 1 is read-only. If the position is already correct, say so and stop — do not "improve" it.

---

## Part 1 — Establish the facts (read-only)

**1.1 What do we actually display for a judgment?**
Take five judgment pages on production. For each, report: the URL, whether the full judgment body is rendered or an extract, and if an extract, roughly how much (characters, and as a share of the source document). Quote the first and last 200 characters of what is rendered. State whether a link to the judgment on Find Case Law is present and where.

▶ **This answers application Q21.** If extracts with a link: the answer is **No**. If the full body: **Yes**.

**1.2 Is judgment content indexable today?**
For each of the same five URLs, request as a crawler would and report:
- the served `robots.txt` in full, and whether these paths are disallowed
- any `<meta name="robots">` in the delivered HTML — quote it, or say there is none
- any `X-Robots-Tag` response header — quote it, or say there is none
- whether the paths appear in any served sitemap
- whether the page is reachable without authentication (a Clerk gate is itself a control, and if judgment pages are behind login that materially changes the answer — say so plainly)

**1.3 Is any of it already in Google?**
Search `site:scrutinise.org` for judgment paths and for a distinctive phrase from a judgment we hold. Report the count and three example URLs, or zero. ⚠ **If judgment text is already indexed, that is a finding to disclose in the application, not to quietly remove.** Report it to Charlie the same day.

**1.4 Any other route to the text?**
Is judgment text reachable through a public API endpoint, a JSON payload embedded in a page, an RSS or Atom feed, an export, or a share link that bypasses auth? Check the network payloads, not only the rendered page — text hidden from the eye but present in a JSON blob is still served and still crawlable.

**1.5 What stops bulk collection?**
Report what rate limiting, bot detection or WAF exists on the judgment paths today. If none, say none.

---

## Part 2 — Fix only what 1.2–1.5 shows is missing

Apply the narrowest change that makes the application's statement true:

- `X-Robots-Tag: noindex, nofollow` on responses serving judgment content, **and** a `<meta name="robots" content="noindex, nofollow">` in the HTML. Both, because a crawler may see either.
- `robots.txt` `Disallow` on the judgment paths, for `*` and for the named AI crawlers (`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `PerplexityBot`, `Bytespider`, `Amazonbot`, and any others current at the time — enumerate what you set).
- Judgment paths excluded from every sitemap.
- Rate limiting on judgment routes if there is none.

⚠ **`robots.txt` alone is not enough and must not be reported as sufficient.** It is a request, not a control, and a well-behaved crawler that ignores it is not rare. `noindex` is what actually keeps a page out of an index.

⚠ **Do not block our own retrieval.** These controls apply to external crawlers and to the public HTML surface. Internal search over the corpus is the licensed activity we are applying for and must keep working. If a change could affect it, say so before making it.

**Verify each change from outside.** Re-request each of the five URLs after the change and quote the new headers and meta tags. A change that has not been read back off production has not landed.

---

## Part 3 — The evidence pack

Write `docs/PRINCIPLE_7_EVIDENCE.md`, one page, containing:

1. The answer to Q21 in one sentence, with the evidence.
2. The `robots.txt` as served, quoted.
3. The `X-Robots-Tag` and meta robots as served, quoted, for one judgment URL.
4. The AI crawlers named in `robots.txt`.
5. The Google result count for judgment content, with the date checked.
6. Anything still open, named — do not smooth it.

Charlie attaches or paraphrases this in the licence application. **Every sentence in it must be something you read off production, not something you can see in the code.**

---

## Report

Plain English first: what a search engine can see today, what it could see before, what changed. Then Q21's answer. Then anything Charlie must decide. Scoped commit by explicit path; one `commit-surface-principle7.sh` at the end.
