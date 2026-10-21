#!/usr/bin/env node

require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const readline = require("readline");

function parseArgs(argv) {
  const args = { confirm: false, teacherId: "" };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--confirm") args.confirm = true;
    else if (argv[i] === "--teacher-id") {
      args.teacherId = argv[++i] || "";
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }

  return args;
}

function validateArgs(args, environment = process.env.NODE_ENV) {
  if (environment === "production") {
    throw new Error("Disabled in production.");
  }
  if (!/^[1-9]\d*$/.test(args.teacherId)) {
    throw new Error("--teacher-id must be a positive integer.");
  }
  if (!args.confirm) {
    throw new Error("No changes made. Add --confirm after verifying the teacher.");
  }
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY || !output.isTTY) {
      reject(new Error("Run this utility in an interactive terminal."));
      return;
    }

    output.write(question);
    input.setRawMode(true);
    input.resume();
    let password = "";

    function cleanup() {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
    }

    function onData(data) {
      for (const character of data.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        } else if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(password);
          return;
        } else if (character === "\u007f") {
          password = password.slice(0, -1);
        } else {
          password += character;
        }
      }
    }

    input.on("data", onData);
  });
}

async function main() {
  let args;

  try {
    args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node scripts/reset-teacher-password.js --teacher-id <id> --confirm");
      return;
    }
    validateArgs(args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const password = await askHidden("New password (minimum 8 characters): ");
  if (password.length < 8) {
    console.error("Password must be at least 8 characters. No changes made.");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      "SELECT teacher_id, email FROM teachers WHERE teacher_id = $1 AND is_active = TRUE",
      [Number(args.teacherId)]
    );

    if (result.rows.length === 0) {
      throw new Error("Active teacher not found. No changes made.");
    }

    console.log(`Target teacher: ${result.rows[0].email} (ID ${result.rows[0].teacher_id})`);
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE teachers SET password_hash = $1 WHERE teacher_id = $2",
      [passwordHash, Number(args.teacherId)]
    );

    console.log("Teacher password updated successfully.");
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
