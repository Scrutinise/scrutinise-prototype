import { Pool } from 'pg'

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_4IZxK8mjwbSD@ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 60_000,
})

async function run() {
  console.log('=== PART 1a — Item count by legislationType ===')
  const q1a = await pool.query(`
    SELECT "legislationType", COUNT(*) as item_count
    FROM "LegislationItem"
    GROUP BY "legislationType"
    ORDER BY item_count DESC
  `)
  console.table(q1a.rows)

  console.log('\n=== PART 1b — Section count by legislationType ===')
  const q1b = await pool.query(`
    SELECT li."legislationType", COUNT(ls.id) as section_count
    FROM "LegislationItem" li
    LEFT JOIN "LegislationSection" ls ON ls."legislationItemId" = li.id
    GROUP BY li."legislationType"
    ORDER BY section_count DESC
  `)
  console.table(q1b.rows)

  console.log('\n=== PART 1c — Items with zero sections ===')
  const q1c = await pool.query(`
    SELECT li."legislationType", COUNT(*) as items_with_no_sections
    FROM "LegislationItem" li
    WHERE NOT EXISTS (
      SELECT 1 FROM "LegislationSection" ls WHERE ls."legislationItemId" = li.id
    )
    GROUP BY li."legislationType"
    ORDER BY items_with_no_sections DESC
  `)
  console.table(q1c.rows)

  console.log('\n=== PART 1d — Items with under 3 sections ===')
  const q1d = await pool.query(`
    SELECT sub."legislationType",
      COUNT(CASE WHEN section_count < 3 THEN 1 END) as items_under_3_sections,
      COUNT(*) as total_items
    FROM (
      SELECT li.id, li."legislationType", COUNT(ls.id) as section_count
      FROM "LegislationItem" li
      LEFT JOIN "LegislationSection" ls ON ls."legislationItemId" = li.id
      GROUP BY li.id, li."legislationType"
    ) sub
    GROUP BY sub."legislationType"
    ORDER BY sub."legislationType"
  `)
  console.table(q1d.rows)

  console.log('\n=== PART 1e — Avg sections per doc by type (for section estimates) ===')
  const q1e = await pool.query(`
    SELECT sub."legislationType",
      COUNT(*) as items_with_sections,
      ROUND(AVG(section_count)) as avg_sections_per_doc,
      MAX(section_count) as max_sections
    FROM (
      SELECT li.id, li."legislationType", COUNT(ls.id) as section_count
      FROM "LegislationItem" li
      JOIN "LegislationSection" ls ON ls."legislationItemId" = li.id
      GROUP BY li.id, li."legislationType"
      HAVING COUNT(ls.id) > 0
    ) sub
    GROUP BY sub."legislationType"
    ORDER BY sub."legislationType"
  `)
  console.table(q1e.rows)

  await pool.end()
}

run().catch(e => { console.error(e); process.exit(1) })
