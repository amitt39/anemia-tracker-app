#!/usr/bin/env node

require("dotenv").config();

const { Pool } = require("pg");
const CONFIRMATION = "ANEMIA_INVENTORY_CONFIRM";

function assertLocalOptIn() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run schema inventory when NODE_ENV=production.");
  if (!process.argv.includes("--confirm-local") || process.env[CONFIRMATION] !== "LOCAL") {
    throw new Error(`Explicit local opt-in required: use --confirm-local and ${CONFIRMATION}=LOCAL.`);
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; no database fallback is attempted.");
}

async function collectInventory(pool) {
  const [tables, columns, indexes, constraints, migrationTables] = await Promise.all([
    pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`),
    pool.query(`SELECT table_schema, table_name, ordinal_position, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name, ordinal_position`),
    pool.query(`SELECT schemaname AS table_schema, tablename AS table_name, indexname, indexdef FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename, indexname`),
    pool.query(`SELECT table_schema, table_name, constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name, constraint_name`),
    pool.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%migration%' ORDER BY table_schema, table_name`),
  ]);
  return { tables: tables.rows, columns: columns.rows, indexes: indexes.rows, constraints: constraints.rows, migrationTables: migrationTables.rows };
}

function printInventory(inventory) {
  console.log("Schema inventory (read-only catalog inspection)");
  console.log("WARNING: this is an inventory of current database objects, not proof of migration history.");
  console.log(`\nTables (${inventory.tables.length})`);
  for (const row of inventory.tables) console.log(`- ${row.table_schema}.${row.table_name}`);
  console.log(`\nColumns (${inventory.columns.length})`);
  for (const row of inventory.columns) console.log(`- ${row.table_schema}.${row.table_name}.${row.column_name}: ${row.data_type}, ${row.is_nullable === "YES" ? "nullable" : "not null"}`);
  console.log(`\nIndexes (${inventory.indexes.length})`);
  for (const row of inventory.indexes) console.log(`- ${row.table_schema}.${row.table_name}: ${row.indexname} :: ${row.indexdef}`);
  console.log(`\nConstraints (${inventory.constraints.length})`);
  for (const row of inventory.constraints) console.log(`- ${row.table_schema}.${row.table_name}: ${row.constraint_name} (${row.constraint_type})`);
  console.log(`\nMigration-related tables (${inventory.migrationTables.length})`);
  if (inventory.migrationTables.length === 0) console.log("- None found");
  for (const row of inventory.migrationTables) console.log(`- ${row.table_schema}.${row.table_name}`);
}

async function main() {
  assertLocalOptIn();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { printInventory(await collectInventory(pool)); } finally { await pool.end(); }
}

if (require.main === module) main().catch((error) => { console.error(`Schema inventory failed: ${error.message}`); process.exitCode = 1; });

module.exports = { assertLocalOptIn, collectInventory, printInventory };
