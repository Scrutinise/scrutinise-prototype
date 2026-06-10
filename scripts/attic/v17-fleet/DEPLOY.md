# Corpus Ingest System — Deployment Guide

## Overview

11 Railway services: 10 workers (WORKER_ID 1–10) + 1 scheduler.
All services run in the existing `miraculous-nature` Railway project.

---

## 1. Prisma migration (run once from local machine)

```bash
cd scrutinise-web
npx prisma migrate dev --name add-corpus-sections
npx prisma migrate deploy
```

This creates the `corpus_sections` table in Railway PostgreSQL.

---

## 2. Environment variables

All services share these (already set in Railway project — verify they are present):

| Variable | Source | Required by |
|---|---|---|
| `DATABASE_URL` | Railway PostgreSQL | All workers + scheduler |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare dashboard | All workers + scheduler |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 API token | All workers + scheduler |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token | All workers + scheduler |
| `CLOUDFLARE_R2_BUCKET_NAME` | `scrutinise-legislation` | All workers + scheduler |
| `GEMINI_API_KEY` | Google AI Studio | Workers 1–6 (legislation compilation, primary) |
| `OPENAI_API_KEY` | OpenAI dashboard | All workers (GPT-4o mini, 2nd in fallback chain) |
| `TOGETHER_API_KEY` | Together AI dashboard | All workers (Llama 3.3 70B, 3rd in fallback chain) |
| `ANTHROPIC_API_KEY` | Anthropic console | All workers (Haiku last resort) |
| `RESEND_API_KEY` | Resend dashboard | Scheduler only |

**New per-worker variable (set individually):**

| Service | `WORKER_ID` value |
|---|---|
| ingest-worker-1 | `1` |
| ingest-worker-2 | `2` |
| ... | ... |
| ingest-worker-10 | `10` |

---

## 3. Railway service setup (repeat for each worker)

### Worker services (1–10)

1. In Railway dashboard → **New Service** → **Empty Service**
2. Name: `ingest-worker-N` (replace N with worker number)
3. Settings:
   - **Start command:** `cd scripts/ingest && npx tsx workers/worker-main.ts`
   - **Restart policy:** Always
   - **No public domain** (workers have no HTTP server)
4. Variables tab → Add:
   - `WORKER_ID` = N (the worker number)
   - All shared variables above (or inherit from Railway project variables)
5. Deploy.

### Scheduler service

1. **New Service** → **Empty Service** → Name: `ingest-scheduler`
2. **Start command:** `cd scripts/ingest && npx tsx scheduler.ts`
3. **Cron:** `0 */4 * * *` (every 4 hours)
4. Variables: all shared variables above (no WORKER_ID needed).
5. Deploy.

---

## 4. Priority deployment order

Start Workers 1–4 first (TNA legislation — the core corpus). These are lowest-risk:
- Worker 1: UK Primary Acts pre-2000
- Worker 2: UK Primary Acts 2000+
- Worker 3: UK SIs pre-2010
- Worker 4: UK SIs 2010+

After Workers 1–4 are confirmed running and checkpointing correctly, deploy Workers 5–10.

---

## 5. Verification

### Check status (from any machine with R2 access)

```bash
cd scripts/ingest
npx tsx check-status.ts
```

Expected output within 5 seconds showing all 10 workers and total %.

### Confirm checkpoint is writing to R2

```bash
# Check that checkpoint files exist in R2
# Key pattern: ingest-checkpoint/worker-N.json
```

### Confirm compiled text in R2

```bash
# Pattern: primary-acts-pre-2000/{actId}/sections/{ref}/compiled.txt
# Example: primary-acts-pre-2000/ukpga/1998/42/sections/1/compiled.txt
```

### Confirm corpus_sections table populating

```sql
SELECT corpus, status, COUNT(*) FROM corpus_sections GROUP BY corpus, status ORDER BY corpus;
```

---

## 6. Monitoring

- **4-hourly email** arrives at `cl@scrutinise.org` with progress table
- **Daily CSV** at `ingest-csv/progress-YYYY-MM-DD.csv` in R2 for drill-down
- **Railway logs** per service for error detail
- Run `npx tsx check-status.ts` at any time for live view

---

## 7. Resume behaviour

Workers are safe to stop and restart at any time:
- Checkpoint is written to R2 every 100 sections
- On restart, worker reads checkpoint and resumes from `lastProcessedId`
- Sections already compiled (R2 key exists) are skipped automatically

---

## 8. Rate limits (do not lower these floors)

| Source | Floor | Reason |
|---|---|---|
| TNA legislation.gov.uk | 200ms | TNA public API |
| TNA Find Case Law | 200ms | Same TNA infrastructure |
| BAILII | **1000ms** | Charity on minimal infrastructure |
| Parliament API | 500ms | Fair-use policy |
| FCA Handbook | 500ms | Regulatory infrastructure |
| ECHR HUDOC | 500ms | Council of Europe servers |
| EUR-Lex | 500ms | EU publications server |
| GOV.UK | 300ms | Crown infrastructure |
