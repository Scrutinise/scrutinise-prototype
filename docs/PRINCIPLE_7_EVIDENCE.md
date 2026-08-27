# PRINCIPLE 7 — EVIDENCE

**For:** The National Archives computational analysis licence application
**Host checked:** `https://www.scrutinise.org` · **Date:** 27 August 2026
**Production commit at verification:** `b093e8955c99a7c401623fe5bda9b6dd212880d9`
(read from `/api/health`, before and after the change)

> Principle 7: *"Licence holders must not index the contents of judgments and decisions on search
> engines… You should consider what you will do to prevent third party services from crawling or
> scraping either the text of the records or the data you have extracted from the records."*

**Every statement below was read off the live site with an anonymous request. Nothing here is taken
from the source code.**

---

## 1. Question 21 — "Will you make the entire record available online?"

> **No.** We publish no judgment page and no judgment text. A judgment reaches a reader only as a
> short extract inside a policy proposal, written by our AI guide from a retrieved passage, beside a
> link to the judgment on Find Case Law. Measured on 26 August 2026, an extract is **252 characters
> at the median and 776 at the longest**, against a median stored case-law section of **~37,575
> characters** — around **0.7% of one section**, and a section is itself only part of a judgment.
> Every one of the **74,896** case-law records we hold carries its
> `caselaw.nationalarchives.gov.uk` source URL, so the reader is always sent to the record itself.

Supporting measurements:

| | measured |
|---|---:|
| `EvidenceItem.body` (the extract a reader sees) | n=135 · min 116 · **median 252** · p90 383 · max 776 characters |
| `Research.snippet` | 4 rows, 23–186 characters; schema cap **500** |
| median `tna-caselaw` section held | **6,262 words ≈ 37,575 characters** |
| case-law records carrying a Find Case Law URL | **74,896 of 74,896 (100%)** |
| idea-level rows carrying judgment text **today** | **0 of 135** EvidenceItem, **0 of 4** Research |

---

## 2. `robots.txt`, as served

`GET https://www.scrutinise.org/robots.txt` → **HTTP 200**, `text/plain`, 3,071 bytes.

```
User-agent: *
Allow: /
Allow: /user/
Disallow: /ideas/
Disallow: /legislation/
Disallow: /legislation-compare/
Disallow: /demo/
Disallow: /general/
Disallow: /admin/
Disallow: /onboarding/
Disallow: /api/
Disallow: /prototype/
Disallow: /settings/
Disallow: /dashboard/
```

followed by one `Disallow: /` block per named AI crawler (§4), and
`Sitemap: https://www.scrutinise.org/sitemap.xml`.

⚠ **A `Disallow` is a request, not a control.** The controls are §3. Both are in place because a
crawler may honour either and ignore the other.

---

## 3. `X-Robots-Tag` and `<meta name="robots">`, as served

`GET https://www.scrutinise.org/ideas/be7d7b70-ba55-4a2a-b5c7-23c14c53b79b`
requested as Googlebot, with no session → **HTTP 200**, 42,856 bytes:

```
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
<meta name="robots" content="noindex, nofollow, nocache"/>
```

Identical on all three publicly reachable proposal pages, and on the public JSON reads that carry
the same content:

| path | X-Robots-Tag as served |
|---|---|
| `/api/ideas/{id}/research` | `noindex, nofollow, noarchive, nosnippet` |
| `/api/legislation/search?q=housing` | `noindex, nofollow, noarchive, nosnippet` |
| `/api/legislation/test-sections` | `noindex, nofollow, noarchive, nosnippet` |

**The sitemap carries no proposal pages:** `GET /sitemap.xml` → 25 entries, **0** under `/ideas/`.

**Control, so this is a targeted rule and not a blanket one:** `GET /` and `GET /about` return
`X-Robots-Tag: (none)` and no meta robots tag. The public marketing pages remain indexable.

---

## 4. AI and bulk-collection crawlers named in `robots.txt`

Each is disallowed from the whole site by name, because a wildcard does not bind an agent that
looks for its own name:

`GPTBot` · `OAI-SearchBot` · `ChatGPT-User` · `ClaudeBot` · `Claude-Web` · `anthropic-ai` ·
`CCBot` · `Google-Extended` · `PerplexityBot` · `Perplexity-User` · `Bytespider` · `Amazonbot` ·
`Applebot-Extended` · `meta-externalagent` · `FacebookBot` · `Diffbot` · `ImagesiftBot` · `omgili` ·
`omgilibot` · `Timpibot` · `cohere-ai` · `cohere-training-data-crawler` · `YouBot` · `AI2Bot` ·
`Kangaroo Bot` · `PetalBot` · `Scrapy` — **27 agents**, enumerated 27 August 2026.

Verified by request: a proposal page fetched with each of the User-Agents `GPTBot/1.0`,
`ClaudeBot/1.0`, `CCBot/2.0`, `Bytespider` and `PerplexityBot/1.0` returns
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.

---

## 5. What is in a search index today

**Checked 27 August 2026. No judgment text is indexed, and none exists on the site to index.**

- Two independent web-search instruments return **only the site's home page** for
  `scrutinise.org`; no proposal page, no user profile page, no judgment text.
- The stronger fact behind that: **no page on the site carries judgment text at all today** —
  0 of 135 evidence rows and 0 of 4 research rows contain a neutral citation, a case-law record id
  or a Find Case Law URL (measured directly, 26–27 August).
- Before 27 August the sitemap listed **0** proposal pages — but only because no proposal has yet
  reached the stage at which the code would have listed one. That code path has now been removed,
  so the absence is by design rather than by timing.

⚠ **The definitive check is Google Search Console, which we cannot read from the build machine.**
Charlie can confirm the indexed-page count there in under a minute; this document should be updated
with that number before the application is submitted.

---

## 6. Still open — stated, not smoothed

1. **Rate limiting is a speed bump, not a control, and must not be described as one.** A 120
   requests-per-minute per-IP limit now applies to `/ideas/`, `/api/ideas/`, `/legislation/` and
   `/api/legislation/`. It was **watched firing**: request 141 of a sequential run returned
   **HTTP 429 with `Retry-After: 60`**. ⚠ It fired at 141 rather than 121 because the counter lives
   in the memory of one edge instance and the run was spread across more than one — **a collector
   that spreads its requests gets a fresh budget from each instance.** Before 27 August there was
   no limit at all: 20 sequential and 10 concurrent anonymous requests all returned 200.
2. **There is no WAF and no bot detection.** The site is served by Vercel with nothing in front of
   it. Cloudflare or Vercel's own bot management would be the next control if TNA wants one.
3. **A `Disallow` on a path stops a well-behaved crawler seeing the `noindex` on it.** That is the
   right order here because nothing is currently indexed. If a proposal page ever does appear in an
   index, its `Disallow` must be lifted temporarily so the crawler can fetch the page, read the
   `noindex`, and drop it.
4. **The extract measurements are of the shape of the system, not of judgment extracts in
   particular** — there are none yet. When the first case-law-sourced extract is written, re-measure
   and update §1's numbers rather than carrying today's forward.
5. **Proposal pages are no longer discoverable through search.** That is a deliberate cost, accepted
   on 27 August: the alternative — indexing only the proposals that carry no judgment extract —
   would rest on a detector, and a detector that silently stops firing would make the sentence in
   §1 untrue with nobody watching.

---

*Produced by the Principle 7 verification sprint, `docs/BRIEF_PRINCIPLE_7_VERIFY.md`. The change
itself is commit `b093e89`; the before-state it replaced is quoted in `docs/CHANGE_LOG.md` under
27 August 2026.*
