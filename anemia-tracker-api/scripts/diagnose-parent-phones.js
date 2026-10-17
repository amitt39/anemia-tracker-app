#!/usr/bin/env node

require("dotenv").config();

const { Pool } = require("pg");
const { isValidPhoneNumber } = require("../otp");

async function diagnose(pool) {
  const result = await pool.query("SELECT phone_number FROM parents ORDER BY parent_id");
  let invalid = 0;
  for (const row of result.rows) {
    if (!isValidPhoneNumber(row.phone_number)) invalid += 1;
  }
  return { total: result.rows.length, invalid };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await diagnose(pool);
    console.log(`Parent phone records checked: ${result.total}`);
    console.log(`Records failing the current Indian mobile contract: ${result.invalid}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Diagnostic failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { diagnose };
