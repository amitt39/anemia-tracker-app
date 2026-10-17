#!/usr/bin/env node

require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const readline = require("readline");

const BCRYPT_ROUNDS = 10;

function parseArgs(argv) {
  const args = { confirm: false, schoolId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--confirm") {
      args.confirm = true;
    } else if (value === "--school-id") {
      args.schoolId = argv[index + 1] || "";
      index += 1;
    } else if (value === "--help" || value === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  return args;
}

function usage() {
  return "Usage: node scripts/reset-school-password.js --school-id <positive integer> --confirm";
}

function validateArgs(args, environment = process.env.NODE_ENV) {
  if (environment === "production") {
    throw new Error("This utility is disabled when NODE_ENV=production.");
  }
  if (!/^[1-9]\d*$/.test(args.schoolId)) {
    throw new Error("--school-id must be a positive integer.");
  }
  if (!args.confirm) {
    throw new Error("No changes made. Add --confirm after verifying the target account.");
  }
}

async function resetSchoolPassword({ pool, schoolId, password, hash = bcrypt.hash }) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existing = await pool.query(
    "SELECT school_id FROM schools WHERE school_id = $1",
    [Number(schoolId)],
  );
  if (existing.rows.length === 0) {
    throw new Error("School account was not found. No changes made.");
  }

  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  await pool.query(
    "UPDATE schools SET password_hash = $1 WHERE school_id = $2",
    [passwordHash, Number(schoolId)],
  );
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;
    if (!input.isTTY || !output.isTTY) {
      reject(new Error("Interactive password input requires a terminal; password arguments are not supported."));
      return;
    }
    output.write(question);
    input.setRawMode(true);
    input.resume();
    let password = "";
    function onData(data) {
      const character = data.toString();
      if (character === "\u0003") {
        cleanup();
        reject(new Error("Password entry cancelled."));
      } else if (character === "\r" || character === "\n") {
        cleanup();
        output.write("\n");
        resolve(password);
      } else if (character === "\u007f") {
        password = password.slice(0, -1);
      } else {
        password += character;
      }
    }
    function cleanup() {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
    }
    input.on("data", onData);
  });
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    validateArgs(args);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const password = await askHidden("New password (minimum 8 characters): ");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await resetSchoolPassword({ pool, schoolId: args.schoolId, password });
    console.log("School Admin password updated successfully.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, resetSchoolPassword, usage, validateArgs };
