# BAILII — Data Access Request

**Status:** Draft — for Charlie to send if initial contact doesn't progress
**Contact:** support@bailii.org / info@bailii.org

---

## What Scrutinise is

Scrutinise (scrutinise.org) is a not-for-profit civic engagement platform that enables
citizens, aspiring politicians, and engaged professionals to develop policy ideas into
Parliament-ready legislation. We are a registered non-profit. Our platform is free to use
and funded by grants and voluntary contributions.

Our AI assistant (Lex) helps users research existing legislation, case law, and regulatory
material to build well-evidenced policy ideas. We do not commercialise the underlying data.

## What we need

We would like to ingest the full BAILII judgment corpus into our search index so that Lex
can cite and link to relevant case law when assisting users with policy development.

Specifically, we are requesting one of:

1. **Bulk data access** — a dump or FTP/SFTP feed of judgment text in any structured format
   (HTML, XML, plain text). A one-time snapshot plus periodic updates would be sufficient.

2. **IP whitelist** — whitelisting of our Railway (EU West) worker IP range for polite
   crawling at a rate we agree with BAILII (suggested: 1 request/2 seconds, 8 hours/day max).
   We would respect robots.txt and all crawl instructions.

We are not requesting access to the underlying case management system or any
non-public material.

## What we offer

- **Attribution on every citation**: every case law result shown to a Scrutinise user will
  display BAILII as the authoritative source with a direct link back to the BAILII page.
- **Traffic referral**: Scrutinise will link directly to BAILII for the full judgment text,
  driving users from our platform to yours.
- **Partnership / sponsorship**: as Scrutinise grows, we are open to a formal partnership
  or sponsorship acknowledgement, positioning BAILII as a key civic data partner.
- **Usage report**: we can provide quarterly reports of how BAILII case law is being used
  within our platform, which may be useful for BAILII's own impact reporting.

## Technical details

- Our ingest workers run on Railway (AWS EU West Amsterdam region).
- IP range: Railway's shared EU West IP space (we can provide specific IPs on request).
- Rate limit: we would implement whatever rate limit BAILII specifies.
- User-Agent: `Scrutinise-Ingest/1.0 (civic research; +https://scrutinise.org/about)`
- All fetched content is stored in our private Cloudflare R2 bucket — not re-distributed.
- Contact: cl@scrutinise.org

---

*Scrutinise is committed to open civic data. BAILII's judgment corpus is essential
infrastructure for evidence-based policy work, and we would be proud to partner with you.*
