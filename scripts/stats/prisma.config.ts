import "dotenv/config";

// Stats layer's own Prisma config — separate DB, separate migration history
// from scrutinise-web/prisma.config.ts. Never point this at the corpus/app DB.
// (Plain object, not the `defineConfig` helper from "prisma/config" — that bare
// specifier isn't worth the extra resolution fuss here; the CLI accepts a plain
// default-exported config object fine.)
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["STATS_DIRECT_URL"] ?? process.env["STATS_DATABASE_URL"],
  },
};
