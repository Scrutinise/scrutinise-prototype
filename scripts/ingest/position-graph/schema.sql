-- schema.sql — the position graph's entity spine and observed edges (BRIEF_GRAPH_2D1 §2).
--
-- DDL OF RECORD. Applied by position-graph/setup.ts, which prints the target host and the last
-- migrations first (docs/CLAUDE.md §16 — two migrations were once applied to the wrong database and
-- reported success). The matching Prisma models exist in schema.prisma for ONE reason: without them
-- `prisma migrate diff` sees tables it does not know about and proposes DROPPING them. Nothing reads
-- these through the Prisma client. Same pattern as prisma/act_metadata.sql.
--
-- WHY RELATIONAL (brief §2, decision already taken): the queries this serves — what has this actor
-- said, who else has taken a position on this, how often do these two agree — are joins and
-- aggregates. A graph database earns its keep on deep multi-hop traversal, which is not needed yet,
-- and it adds an operational dependency and a second thing to back up.
--
-- Everything is dated. The design's rule that a changed position is a FINDING rather than noise
-- depends on edges being time-stamped from the start; retrofitting dates is far harder than
-- carrying them.

-- ── entities ────────────────────────────────────────────────────────────────────────────────────
-- One row per person, organisation or publication. `kind` is closed: an inquiry and a debate are
-- NOT entities here — they are edge objects (see graph_edge.object_kind), because they are events
-- an actor participated in rather than actors that hold positions.
CREATE TABLE IF NOT EXISTS graph_entity (
  id                 BIGSERIAL PRIMARY KEY,
  kind               TEXT NOT NULL CHECK (kind IN ('person', 'organisation', 'publication')),
  -- The form shown to a reader. The FIRST surface seen wins unless a stable key later supplies a
  -- better one; every other spelling lives in graph_alias and none is ever discarded.
  canonical_name     TEXT NOT NULL,
  -- The matching key. Deliberately CONSERVATIVE (see normaliseName in graph-entities.ts): case,
  -- whitespace, punctuation and a leading "the" only. Legal suffixes are NOT stripped — "Smith Ltd"
  -- and "Smith plc" are different companies, and collapsing them is the unrecoverable direction.
  name_norm          TEXT NOT NULL,

  -- Stable external keys. Each is nullable and each is unique WHERE PRESENT.
  companies_house_no TEXT,      -- not populated by this sprint; the column exists so §6's registers land here
  charity_no         TEXT,      -- likewise
  parl_member_id     INTEGER,   -- Parliament member ID (people) — members-api.parliament.uk
  parl_cis_id        INTEGER,   -- committees API organisation id; 0 means "none" at source, stored NULL
  parl_idms_id       TEXT,      -- https://id.parliament.uk/xxxxxxx
  twfy_person_id     TEXT,      -- uk.org.publicwhip/person/NNNNN

  -- HOW identity was established, so a name-matched row can never be mistaken for a keyed one.
  key_source         TEXT NOT NULL CHECK (key_source IN ('parl-member-id', 'parl-cis-id', 'parl-idms-id', 'name-match', 'singleton')),
  -- 1.0 only for a stable key. Name matches carry less, and the number is reported, never hidden.
  confidence         REAL NOT NULL DEFAULT 1.0,
  first_seen         DATE,
  last_seen          DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A stable key identifies exactly one entity. These are the merges we are CONFIDENT in.
CREATE UNIQUE INDEX IF NOT EXISTS graph_entity_member_id_uq ON graph_entity (parl_member_id) WHERE parl_member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS graph_entity_cis_id_uq    ON graph_entity (kind, parl_cis_id) WHERE parl_cis_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS graph_entity_twfy_uq      ON graph_entity (twfy_person_id) WHERE twfy_person_id IS NOT NULL;
-- ⚠ And this one is the name match itself. It is a UNIQUE constraint per kind, which means the
-- normalisation IS the merge rule: two organisations whose conservative normal form is identical
-- become one row. That is a judgement, so it is recorded (key_source='name-match', confidence<1),
-- every raw surface is kept in graph_alias, and graph_merge_log makes it reversible.
CREATE UNIQUE INDEX IF NOT EXISTS graph_entity_name_uq      ON graph_entity (kind, name_norm);

-- ── aliases: every surface form ever seen, with its source ──────────────────────────────────────
-- "Never discard the raw string. The original spelling is evidence."
CREATE TABLE IF NOT EXISTS graph_alias (
  id           BIGSERIAL PRIMARY KEY,
  entity_id    BIGINT NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  surface      TEXT NOT NULL,        -- EXACTLY as it appeared, including the odd casing and the typo
  surface_norm TEXT NOT NULL,
  source       TEXT NOT NULL,        -- committees-written | committees-oral | members-interests | pwdata
  n_seen       INTEGER NOT NULL DEFAULT 1,
  first_seen   DATE,
  last_seen    DATE,
  UNIQUE (entity_id, surface, source)
);
CREATE INDEX IF NOT EXISTS graph_alias_norm_idx ON graph_alias (surface_norm);

-- ── edges: what an actor demonstrably DID ───────────────────────────────────────────────────────
-- This sprint carries the observed set only. No inferred `holds-position` edge exists yet, and the
-- CHECK is what stops one arriving without a decision.
CREATE TABLE IF NOT EXISTS graph_edge (
  id               BIGSERIAL PRIMARY KEY,
  subject_id       BIGINT NOT NULL REFERENCES graph_entity(id) ON DELETE CASCADE,
  predicate        TEXT NOT NULL CHECK (predicate IN ('gave-evidence-to', 'spoke-in', 'declared-interest')),
  -- The object is either another entity (declared-interest: MP → organisation) or an event that is
  -- not an actor (an inquiry, a debate). Both are first-class rather than one being squeezed into
  -- the other, because an inquiry does not hold positions and must not sit in graph_entity.
  object_kind      TEXT NOT NULL CHECK (object_kind IN ('entity', 'inquiry', 'debate')),
  object_entity_id BIGINT REFERENCES graph_entity(id) ON DELETE CASCADE,
  object_ref       TEXT NOT NULL,    -- inquiry id, debate parentDocId, or the entity id as text
  object_label     TEXT,             -- the inquiry / debate title, for reading without a join
  first_seen       DATE,
  last_seen        DATE,
  n_evidence       INTEGER NOT NULL DEFAULT 0,
  -- an entity object must be present exactly when the kind says so, and absent otherwise
  CONSTRAINT graph_edge_object_ck CHECK ((object_kind = 'entity') = (object_entity_id IS NOT NULL)),
  UNIQUE (subject_id, predicate, object_kind, object_ref)
);
CREATE INDEX IF NOT EXISTS graph_edge_subject_idx   ON graph_edge (subject_id, predicate);
CREATE INDEX IF NOT EXISTS graph_edge_object_idx    ON graph_edge (object_kind, object_ref);
CREATE INDEX IF NOT EXISTS graph_edge_predicate_idx ON graph_edge (predicate);

-- ── evidence: every edge can show its working ───────────────────────────────────────────────────
-- "An edge with no evidence row is a claim we cannot show our working for." The FK to
-- corpus_sections is what enforces the brief's scope as well as its integrity: an edge can only
-- exist for material we actually hold, so no edge can be built on a document nobody can open.
CREATE TABLE IF NOT EXISTS graph_evidence (
  id          BIGSERIAL PRIMARY KEY,
  edge_id     BIGINT NOT NULL REFERENCES graph_edge(id) ON DELETE CASCADE,
  section_id  TEXT NOT NULL REFERENCES corpus_sections(id) ON DELETE CASCADE,
  source_url  TEXT,
  extract     TEXT,          -- where the corpus gives one cheaply; never invented
  observed_on DATE,
  UNIQUE (edge_id, section_id)
);
CREATE INDEX IF NOT EXISTS graph_evidence_section_idx ON graph_evidence (section_id);

-- ── merge log: you will get some wrong ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS graph_merge_log (
  id                BIGSERIAL PRIMARY KEY,
  kind              TEXT NOT NULL,
  kept_entity_id    BIGINT,
  merged_surface    TEXT NOT NULL,     -- the surface that was folded into kept_entity_id
  merged_norm       TEXT NOT NULL,
  reason            TEXT NOT NULL,     -- 'name-match' | 'parl-cis-id' | …
  confidence        REAL NOT NULL,
  source            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS graph_merge_log_kept_idx ON graph_merge_log (kept_entity_id);
