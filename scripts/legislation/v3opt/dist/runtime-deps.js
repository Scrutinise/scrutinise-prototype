"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetObjectCommand = exports.PutObjectCommand = exports.S3Client = exports.Prisma = exports.LegislationTier = exports.LegislationType = exports.CompilationStatus = void 0;
// Static '@prisma/client' and '@aws-sdk/client-s3' imports fail under plain `node dist/*.js`
// because Node's module resolution only walks up the directory tree — it can't reach
// scrutinise-web/node_modules/ from v3opt/dist/ (a sibling branch).
// eval('require') bypasses TypeScript's static module graph; the explicit 4-level path
// resolves correctly at runtime: dist/ → v3opt/ → legislation/ → scripts/ → project root.
const _p = eval('require')('../../../../scrutinise-web/node_modules/@prisma/client');
const _s = eval('require')('../../../../scrutinise-web/node_modules/@aws-sdk/client-s3');
// Enums typed as their mapped-object shape so callers get .PENDING, .UKSI etc.
exports.CompilationStatus = _p.CompilationStatus;
exports.LegislationType = _p.LegislationType;
exports.LegislationTier = _p.LegislationTier;
// Namespace and classes: any is acceptable for ingest scripts
exports.Prisma = _p.Prisma;
exports.S3Client = _s.S3Client;
exports.PutObjectCommand = _s.PutObjectCommand;
exports.GetObjectCommand = _s.GetObjectCommand;
