const assert = require("node:assert/strict");
const { test } = require("node:test");

const utility = require("../scripts/reset-school-password");

test("password reset refuses production", () => {
  assert.throws(
    () => utility.validateArgs({ schoolId: "1", confirm: true }, "production"),
    /disabled when NODE_ENV=production/,
  );
});

test("password reset requires an existing school ID and confirmation", () => {
  assert.throws(
    () => utility.validateArgs({ schoolId: "", confirm: false }, "development"),
    /school-id must be a positive integer/,
  );
  assert.throws(
    () => utility.validateArgs({ schoolId: "1", confirm: false }, "development"),
    /Add --confirm/,
  );
});

test("password reset does not update a missing school", async () => {
  const queries = [];
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      return { rows: [] };
    },
  };
  await assert.rejects(
    utility.resetSchoolPassword({ pool, schoolId: "999", password: "new-password" }),
    /School account was not found/,
  );
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /SELECT school_id/);
});
