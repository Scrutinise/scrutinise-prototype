/**
 * lance.ts — shared LanceDB-on-R2 connection helper + dataset constants
 * (Search S1b). The indexer, query service, and scoring harness all open the
 * same dataset through this so the storage options are configured in one place.
 *
 * LanceDB talks to R2 through the S3-compatible object_store backend. R2 needs:
 *   - aws_endpoint  = the account R2 endpoint (NOT the public bucket URL)
 *   - aws_region    = 'auto'
 *   - the R2 access key / secret (reuse the same CLOUDFLARE_R2_* creds the
 *     ingest r2-client already uses)
 * The dataset lives UNDER the existing corpus bucket so no new bucket/egress
 * config is needed:  s3://{bucket}/_search  →  table "corpus_fts".
 */
import * as lancedb from '@lancedb/lancedb'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

// Table is env-overridable so an isolated canary (FTS_TABLE_NAME=corpus_fts_canary)
// can validate the full load+index path without touching the real corpus_fts build.
// Default unchanged → real build + checkpoint keys are identical to before.
export const FTS_TABLE = process.env.FTS_TABLE_NAME ?? 'corpus_fts'
export const CHECKPOINT_KEY = `_search/${FTS_TABLE}.checkpoint.json`

export function bucket(): string {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'
}

/** s3://{bucket}/_search — the LanceDB "database" (directory of tables). */
export function lanceDbUri(): string {
  return `s3://${bucket()}/_search`
}

export function r2StorageOptions(): Record<string, string> {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKey || !secretKey) {
    throw new Error('R2 creds not set: CLOUDFLARE_R2_ACCOUNT_ID / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY required')
  }
  return {
    aws_access_key_id: accessKey,
    aws_secret_access_key: secretKey,
    aws_endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    aws_region: 'auto',
    // R2 is path-style on the account endpoint; object_store defaults to
    // virtual-hosted when an endpoint is set, so force path-style off.
    aws_virtual_hosted_style_request: 'false',
  }
}

export async function connectLance(): Promise<lancedb.Connection> {
  return lancedb.connect(lanceDbUri(), { storageOptions: r2StorageOptions() })
}

export { lancedb }
