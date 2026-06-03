# Parliament — Bulk Hansard Data Access Request

**Status:** Draft — send if TheyWorkForYou API proves insufficient
**Contact:** data@parliament.uk / https://www.parliament.uk/site-information/foi/foi-and-dp/
**Relevant team:** Parliamentary Digital Service (PDS) — data.parliament.uk team

---

## What Scrutinise is

Scrutinise (scrutinise.org) is a not-for-profit civic engagement platform enabling citizens
to develop policy ideas into Parliament-ready legislation. Free to use; non-profit.

Our AI assistant (Lex) helps users research and contextualise existing debates, policy
positions, and ministerial statements when building policy ideas. Access to Hansard is
essential for Lex to answer questions like "what has Parliament said about X policy area?"

## What we need

Access to bulk Hansard XML (or equivalent structured format) covering:

- House of Commons debates: from 1803 to present
- House of Lords debates: from 1803 to present
- Westminster Hall debates: from 1999 to present
- Written Answers and Written Ministerial Statements: from 1997 to present

We are aware that data.parliament.uk provides some structured data. Our specific request:

1. **Bulk XML/JSON download** — historical archive (1803–2020) as a one-time download,
   then API access for ongoing content (2020–present).
2. **OR API access with relaxed rate limits** — our current experience is that
   `api.parliament.uk/v1/hansard` returns HTTP 403 from our Railway (EU West) worker IPs.
   We believe this is a WAF or geo-restriction. We request either:
   a. Whitelisting our IP range, OR
   b. An API key that bypasses the rate limit / WAF restriction.

## What we offer

- Every Hansard citation shown to users links back to the official Parliament website.
- Scrutinise is a civic education platform — using Parliament's data to help citizens
  engage meaningfully with the legislative process is directly aligned with Parliament's
  own public engagement mission.
- We are happy to acknowledge Parliament as a data partner on our website.
- Usage report available quarterly.

## Technical details

- Workers: Railway EU West (Amsterdam) — shared IP space
- Rate limit: whatever Parliament specifies; we default to 1 req/sec
- User-Agent: `Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)`
- Content stored privately in Cloudflare R2 — not redistributed
- Contact: cl@scrutinise.org

## Note on TheyWorkForYou

We are currently also exploring the TheyWorkForYou API (MySociety) as an alternative,
which re-publishes Parliament data under an open licence. However, TheyWorkForYou coverage
starts from 1988 and may not include all debate types. Direct API access from Parliament
would give us the complete historical record and the most authoritative source.

---

*Scrutinise is building the infrastructure for evidence-based civic participation.
Hansard is the foundation of that evidence base.*
