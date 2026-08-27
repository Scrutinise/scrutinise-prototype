-- CENTRAL Stage 2h item 7 — a per-user platform accent.
--
-- Additive and nullable: NULL means "the platform default", which is what every
-- existing row means today and what it will keep meaning. No backfill, so this
-- cannot rewrite anybody's appearance as a side effect of shipping.
--
-- Stores the palette KEY, not a hex value. A hex column is a free-hex feature
-- with extra steps: anything could be written to it by a future route, and the
-- unreadable combinations this palette exists to prevent would arrive that way.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accentColour" TEXT;
