/* eslint-disable no-eval, @typescript-eslint/no-explicit-any */
import type { CompilationStatus as _CS, LegislationType as _LT, LegislationTier as _LTier } from '@prisma/client'

// Static '@prisma/client' and '@aws-sdk/client-s3' imports fail under plain `node dist/*.js`
// because Node's module resolution only walks up the directory tree — it can't reach
// scrutinise-web/node_modules/ from v3opt/dist/ (a sibling branch).
// eval('require') bypasses TypeScript's static module graph; the explicit 4-level path
// resolves correctly at runtime: dist/ → v3opt/ → legislation/ → scripts/ → project root.
const _p: any = eval('require')('../../../../scrutinise-web/node_modules/@prisma/client')
const _s: any = eval('require')('../../../../scrutinise-web/node_modules/@aws-sdk/client-s3')

// Enums typed as their mapped-object shape so callers get .PENDING, .UKSI etc.
export const CompilationStatus = _p.CompilationStatus as { [K in _CS]: K }
export const LegislationType   = _p.LegislationType   as { [K in _LT]: K }
export const LegislationTier   = _p.LegislationTier   as { [K in _LTier]: K }
// Namespace and classes: any is acceptable for ingest scripts
export const Prisma            = _p.Prisma            as any
export const S3Client          = _s.S3Client          as any
export const PutObjectCommand  = _s.PutObjectCommand  as any
export const GetObjectCommand  = _s.GetObjectCommand  as any
