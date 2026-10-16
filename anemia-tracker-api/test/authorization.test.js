const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
const hasSafeTestDatabase =
  Boolean(testDatabaseUrl) && testDatabaseUrl !== originalDatabaseUrl;

if (hasSafeTestDatabase) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
  process.env.PORT = "0";
}

const skipReason = hasSafeTestDatabase
  ? false
  : "Set TEST_DATABASE_URL to a dedicated test database distinct from DATABASE_URL";

let app;
let pool;
let server;
let baseUrl;
let fixtures;

function authHeader(payload) {
  return {
    Authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

async function insertRow(sql, values) {
  const result = await pool.query(sql, values);
  return result.rows[0];
}

async function createFixtures() {
  const suffix = `${Date.now()}-${process.pid}`;
  const trackedFixtures = {
    classrooms: [],
    students: [],
    parents: [],
    schools: [],
  };
  fixtures = trackedFixtures;

  const schoolA = await insertRow(
    "INSERT INTO schools (school_name, email, password_hash) VALUES ($1, $2, $3) RETURNING school_id",
    [`Test School A ${suffix}`, `school-a-${suffix}@example.test`, "hash"]
  );
  trackedFixtures.schoolA = schoolA;
  trackedFixtures.schools.push(schoolA.school_id);

  const schoolB = await insertRow(
    "INSERT INTO schools (school_name, email, password_hash) VALUES ($1, $2, $3) RETURNING school_id",
    [`Test School B ${suffix}`, `school-b-${suffix}@example.test`, "hash"]
  );
  trackedFixtures.schoolB = schoolB;
  trackedFixtures.schools.push(schoolB.school_id);

  const teacherA = await insertRow(
    "INSERT INTO teachers (school_id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING teacher_id, email",
    [schoolA.school_id, "Test", "Teacher", `teacher-a-${suffix}@example.test`, "hash"]
  );
  trackedFixtures.teacherA = teacherA;

  const teacherB = await insertRow(
    "INSERT INTO teachers (school_id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING teacher_id, email",
    [schoolB.school_id, "Other", "Teacher", `teacher-b-${suffix}@example.test`, "hash"]
  );
  trackedFixtures.teacherB = teacherB;

  const classroomA = await insertRow(
    "INSERT INTO classrooms (school_id, teacher_id, class_name) VALUES ($1, $2, $3) RETURNING classroom_id",
    [schoolA.school_id, teacherA.teacher_id, `Class A ${suffix}`]
  );
  trackedFixtures.classroomNameA = `Class A ${suffix}`;
  trackedFixtures.classrooms.push(classroomA.classroom_id);

  const classroomB = await insertRow(
    "INSERT INTO classrooms (school_id, class_name) VALUES ($1, $2) RETURNING classroom_id",
    [schoolB.school_id, `Class B ${suffix}`]
  );
  trackedFixtures.classrooms.push(classroomB.classroom_id);

  const studentA1 = await insertRow(
    "INSERT INTO students (classroom_id, roll_number, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING student_id",
    [classroomA.classroom_id, 1, "Student", "A1"]
  );
  trackedFixtures.students.push(studentA1.student_id);

  const studentA2 = await insertRow(
    "INSERT INTO students (classroom_id, roll_number, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING student_id",
    [classroomA.classroom_id, 2, "Student", "A2"]
  );
  trackedFixtures.students.push(studentA2.student_id);

  const studentA3 = await insertRow(
    "INSERT INTO students (classroom_id, roll_number, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING student_id",
    [classroomA.classroom_id, 3, "Student", "A3"]
  );
  trackedFixtures.students.push(studentA3.student_id);

  const studentB1 = await insertRow(
    "INSERT INTO students (classroom_id, roll_number, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING student_id",
    [classroomB.classroom_id, 1, "Student", "B1"]
  );
  trackedFixtures.students.push(studentB1.student_id);

  const parentSameSchool = await insertRow(
    "INSERT INTO parents (phone_number) VALUES ($1) RETURNING parent_id",
    [`+910000${suffix.slice(-10)}1`]
  );
  trackedFixtures.parents.push(parentSameSchool.parent_id);

  const parentOtherSchool = await insertRow(
    "INSERT INTO parents (phone_number) VALUES ($1) RETURNING parent_id",
    [`+910000${suffix.slice(-10)}2`]
  );
  trackedFixtures.parents.push(parentOtherSchool.parent_id);

  const parentDoseOwner = await insertRow(
    "INSERT INTO parents (phone_number) VALUES ($1) RETURNING parent_id",
    [`+910000${suffix.slice(-10)}3`]
  );
  trackedFixtures.parents.push(parentDoseOwner.parent_id);

  const otherParent = await insertRow(
    "INSERT INTO parents (phone_number) VALUES ($1) RETURNING parent_id",
    [`+910000${suffix.slice(-10)}4`]
  );
  trackedFixtures.parents.push(otherParent.parent_id);

  await pool.query(
    "INSERT INTO student_parents (student_id, parent_id, relationship, status) VALUES ($1, $2, $3, 'verified')",
    [studentA1.student_id, parentSameSchool.parent_id, "guardian"]
  );
  await pool.query(
    "INSERT INTO student_parents (student_id, parent_id, relationship, status) VALUES ($1, $2, $3, 'verified')",
    [studentB1.student_id, parentOtherSchool.parent_id, "guardian"]
  );
  await pool.query(
    "INSERT INTO student_parents (student_id, parent_id, relationship, status) VALUES ($1, $2, $3, 'verified')",
    [studentA3.student_id, parentDoseOwner.parent_id, "guardian"]
  );

  const hbTest = await insertRow(
    "INSERT INTO hb_tests (student_id, test_date, hb_level, recorded_by) VALUES ($1, $2, $3, $4) RETURNING test_id",
    [studentA3.student_id, "2026-01-01", 11.2, teacherA.teacher_id]
  );
  trackedFixtures.hbTest = hbTest;

  const course = await insertRow(
    "INSERT INTO tablet_courses (student_id, test_id, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING course_id",
    [studentA3.student_id, hbTest.test_id, "2026-01-02", "2026-01-09"]
  );
  trackedFixtures.course = course;

  const dose = await insertRow(
    "INSERT INTO tablet_doses (course_id, scheduled_date) VALUES ($1, $2) RETURNING dose_id",
    [course.course_id, "2026-01-03"]
  );
  trackedFixtures.dose = dose;

  return trackedFixtures;
}

async function cleanupFixtures() {
  if (!fixtures) return;

  if (fixtures.dose) {
    await pool.query("DELETE FROM tablet_doses WHERE dose_id = $1", [
      fixtures.dose.dose_id,
    ]);
  }
  if (fixtures.course) {
    await pool.query("DELETE FROM tablet_courses WHERE course_id = $1", [
      fixtures.course.course_id,
    ]);
  }
  if (fixtures.hbTest) {
    await pool.query("DELETE FROM hb_tests WHERE test_id = $1", [
      fixtures.hbTest.test_id,
    ]);
  }
  if (fixtures.students.length > 0) {
    await pool.query("DELETE FROM student_parents WHERE student_id = ANY($1::int[])", [
      fixtures.students,
    ]);
  }
  if (fixtures.parents.length > 0) {
    await pool.query("DELETE FROM parents WHERE parent_id = ANY($1::int[])", [
      fixtures.parents,
    ]);
  }
  if (fixtures.students.length > 0) {
    await pool.query("DELETE FROM students WHERE student_id = ANY($1::int[])", [
      fixtures.students,
    ]);
  }
  if (fixtures.classrooms.length > 0) {
    await pool.query("DELETE FROM classrooms WHERE classroom_id = ANY($1::int[])", [
      fixtures.classrooms,
    ]);
  }
  if (fixtures.teacherA) {
    await pool.query("DELETE FROM teachers WHERE teacher_id = $1", [
      fixtures.teacherA.teacher_id,
    ]);
  }
  if (fixtures.teacherB) {
    await pool.query("DELETE FROM teachers WHERE teacher_id = $1", [
      fixtures.teacherB.teacher_id,
    ]);
  }
  if (fixtures.schools.length > 0) {
    await pool.query("DELETE FROM schools WHERE school_id = ANY($1::int[])", [
      fixtures.schools,
    ]);
  }
}

before(async () => {
  if (!hasSafeTestDatabase) return;

  ({ app, pool } = require("../index"));
  fixtures = await createFixtures();
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!hasSafeTestDatabase) return;

  if (fixtures) {
    await cleanupFixtures();
  }

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (pool) {
    await pool.end();
  }
});

test(
  "school can access its own profile without exposing password hash",
  { skip: skipReason },
  async () => {
    const response = await request("/schools/me", {
      headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.school.school_id, fixtures.schoolA.school_id);
    assert.equal(response.body.school.school_name.startsWith("Test School A"), true);
    assert.equal(Object.hasOwn(response.body.school, "password_hash"), false);
  }
);

test("school profile rejects missing authentication", { skip: skipReason }, async () => {
  const response = await request("/schools/me");
  assert.equal(response.status, 401);
});

test("school profile rejects invalid and expired tokens", { skip: skipReason }, async () => {
  const invalid = await request("/schools/me", { headers: { Authorization: "Bearer invalid" } });
  assert.equal(invalid.status, 401);

  const expired = await request("/schools/me", {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id, exp: 1 }),
  });
  assert.equal(expired.status, 401);
});

test("school profile rejects teacher and parent tokens", { skip: skipReason }, async () => {
  const teacher = await request("/schools/me", {
    headers: authHeader({ role: "teacher", school_id: fixtures.schoolA.school_id, teacher_id: fixtures.teacherA.teacher_id }),
  });
  const parent = await request("/schools/me", {
    headers: authHeader({ role: "parent", parent_id: fixtures.parents[0] }),
  });
  assert.equal(teacher.status, 401);
  assert.equal(parent.status, 401);
});

test("school profile returns 404 for a nonexistent authenticated school", { skip: skipReason }, async () => {
  const response = await request("/schools/me", {
    headers: authHeader({ role: "school", school_id: 2147483647 }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "School not found" });
});

test("teacher creation rejects missing required fields", { skip: skipReason }, async () => {
  const response = await request("/teachers", {
    method: "POST",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({ first_name: "Only" }),
  });
  assert.equal(response.status, 400);
});

test("teacher creation rejects duplicate email within a school", { skip: skipReason }, async () => {
  const response = await request("/teachers", {
    method: "POST",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({
      first_name: "Duplicate",
      last_name: "Teacher",
      email: fixtures.teacherA.email,
      password: "Teacher123",
    }),
  });
  assert.equal(response.status, 409);
});

test("teacher list and detail are isolated by school", { skip: skipReason }, async () => {
  const list = await request("/teachers", {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.teachers.some((teacher) => teacher.teacher_id === fixtures.teacherB.teacher_id), false);

  const detail = await request(`/teachers/${fixtures.teacherB.teacher_id}`, {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(detail.status, 404);
});

test("teacher edit is isolated by school", { skip: skipReason }, async () => {
  const response = await request(`/teachers/${fixtures.teacherB.teacher_id}`, {
    method: "PATCH",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({ first_name: "Blocked" }),
  });
  assert.equal(response.status, 404);
});

test("classroom assignment rejects a teacher from another school", { skip: skipReason }, async () => {
  const response = await request(`/classrooms/${fixtures.classrooms[0]}`, {
    method: "PATCH",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({ teacher_id: fixtures.teacherB.teacher_id }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "teacher_id must belong to this school" });
});

test("classroom list, detail, and students are isolated by school", { skip: skipReason }, async () => {
  const list = await request("/classrooms", {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.classrooms.some((item) => item.classroom_id === fixtures.classrooms[1]), false);

  const detail = await request(`/classrooms/${fixtures.classrooms[0]}`, {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.classroom.class_name.startsWith("Class A"), true);

  const students = await request(`/classrooms/${fixtures.classrooms[0]}/students`, {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(students.status, 200);
  assert.equal(students.body.students.length, 3);

  const foreignStudents = await request(`/classrooms/${fixtures.classrooms[1]}/students`, {
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(foreignStudents.status, 404);
});

test("classroom creation rejects duplicates and inactive teacher assignment", { skip: skipReason }, async () => {
  const duplicate = await request("/classrooms", {
    method: "POST",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({ class_name: fixtures.classroomNameA }),
  });
  assert.equal([400, 409].includes(duplicate.status), true);

  await pool.query("UPDATE teachers SET is_active = FALSE WHERE teacher_id = $1", [fixtures.teacherA.teacher_id]);
  const inactive = await request(`/classrooms/${fixtures.classrooms[0]}`, {
    method: "PATCH",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
    body: JSON.stringify({ teacher_id: fixtures.teacherA.teacher_id }),
  });
  assert.equal(inactive.status, 400);
  assert.deepEqual(inactive.body, { message: "Cannot assign an inactive teacher" });
  await pool.query("UPDATE teachers SET is_active = TRUE WHERE teacher_id = $1", [fixtures.teacherA.teacher_id]);
});

test("classroom deletion preserves related records by refusing deletion", { skip: skipReason }, async () => {
  const response = await request(`/classrooms/${fixtures.classrooms[0]}`, {
    method: "DELETE",
    headers: authHeader({ role: "school", school_id: fixtures.schoolA.school_id }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { message: "Cannot delete classroom with related records" });
});

test(
  "same-school parent can be linked to another student in that school",
  { skip: skipReason },
  async () => {
    const response = await request(
      `/students/${fixtures.students[1]}/parents`,
      {
        method: "POST",
        headers: authHeader({
          role: "school",
          school_id: fixtures.schoolA.school_id,
        }),
        body: JSON.stringify({
          parent_id: fixtures.parents[0],
          relationship: "guardian",
        }),
      }
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.student_parent.student_id, fixtures.students[1]);
    assert.equal(response.body.student_parent.parent_id, fixtures.parents[0]);
  }
);

test(
  "parent linked only to another school cannot be attached by parent_id",
  { skip: skipReason },
  async () => {
    const response = await request(
      `/students/${fixtures.students[1]}/parents`,
      {
        method: "POST",
        headers: authHeader({
          role: "school",
          school_id: fixtures.schoolA.school_id,
        }),
        body: JSON.stringify({
          parent_id: fixtures.parents[1],
          relationship: "guardian",
        }),
      }
    );

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Student or parent not found" });
  }
);

test(
  "nonexistent parent IDs get the same generic response",
  { skip: skipReason },
  async () => {
    const response = await request(
      `/students/${fixtures.students[1]}/parents`,
      {
        method: "POST",
        headers: authHeader({
          role: "school",
          school_id: fixtures.schoolA.school_id,
        }),
        body: JSON.stringify({
          parent_id: 2147483647,
          relationship: "guardian",
        }),
      }
    );

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Student or parent not found" });
  }
);

test(
  "duplicate parent-student links still return conflict",
  { skip: skipReason },
  async () => {
    const response = await request(
      `/students/${fixtures.students[0]}/parents`,
      {
        method: "POST",
        headers: authHeader({
          role: "school",
          school_id: fixtures.schoolA.school_id,
        }),
        body: JSON.stringify({
          parent_id: fixtures.parents[0],
          relationship: "guardian",
        }),
      }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, {
      message: "Parent is already linked to this student",
    });
  }
);

test(
  "parent cannot update another parent's tablet dose",
  { skip: skipReason },
  async () => {
    const response = await request(`/tablet-doses/${fixtures.dose.dose_id}`, {
      method: "PATCH",
      headers: authHeader({
        role: "parent",
        parent_id: fixtures.parents[3],
      }),
      body: JSON.stringify({ status: "taken" }),
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Tablet dose not found" });
  }
);

test(
  "eligible scheduled dose belonging to authenticated parent can be updated",
  { skip: skipReason },
  async () => {
    const response = await request(`/tablet-doses/${fixtures.dose.dose_id}`, {
      method: "PATCH",
      headers: authHeader({
        role: "parent",
        parent_id: fixtures.parents[2],
      }),
      body: JSON.stringify({ status: "taken" }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.tablet_dose.dose_id, fixtures.dose.dose_id);
    assert.equal(response.body.tablet_dose.status, "taken");
    assert.equal(response.body.tablet_dose.reported_by, fixtures.parents[2]);
  }
);
