require("dotenv").config();

const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const DEMO_PASSWORD = "Demo@12345";
const STUDENTS_PER_CLASSROOM = 10;

const schoolDefinitions = [
  {
    key: "oakridge",
    name: "Oakridge High School",
    email: "admin@oakridgehigh.edu",
    teachers: [
      ["Arjun", "Verma"],
      ["Rahul", "Mehta"],
      ["Priya", "Nair"],
      ["Kavita", "Sharma"],
    ],
  },
  {
    key: "sunrise",
    name: "Sunrise Public School",
    email: "admin@sunrisepublic.edu",
    teachers: [
      ["Ananya", "Kapoor"],
      ["Vikram", "Joshi"],
      ["Neha", "Iyer"],
      ["Sanjay", "Patel"],
    ],
  },
  {
    key: "greenvalley",
    name: "Green Valley Academy",
    email: "admin@greenvalley.edu",
    teachers: [
      ["Meera", "Rao"],
      ["Dev", "Malhotra"],
      ["Ishita", "Bose"],
      ["Aman", "Chopra"],
    ],
  },
];

const classroomDefinitions = [
  { grade: "Class 8", section: "A" },
  { grade: "Class 8", section: "B" },
  { grade: "Class 9", section: "A" },
  { grade: "Class 9", section: "B" },
];

const studentFirstNames = [
  "Aarav", "Aanya", "Aditya", "Anika", "Arnav", "Diya", "Ishaan", "Kavya", "Kabir", "Meera",
];

const studentLastNames = [
  "Shah", "Singh", "Rao", "Khan", "Patel", "Das", "Nair", "Joshi", "Iyer", "Gupta",
];

function dateOnly(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function timestampFor(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

function demoPhoneNumber(index) {
  return `+91${String(9100000000 + index).slice(-10)}`;
}

function demoTeacherEmail(schoolKey, firstName, lastName) {
  return `${firstName}.${lastName}@${schoolKey}.edu`.toLowerCase();
}

async function upsertSchool(client, school, passwordHash) {
  const result = await client.query(
    `INSERT INTO schools (school_name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET school_name = EXCLUDED.school_name,
           password_hash = EXCLUDED.password_hash
     RETURNING school_id`,
    [school.name, school.email, passwordHash],
  );
  return result.rows[0].school_id;
}

async function upsertTeacher(client, schoolId, schoolKey, firstName, lastName, passwordHash) {
  const email = demoTeacherEmail(schoolKey, firstName, lastName);
  const result = await client.query(
    `INSERT INTO teachers (school_id, first_name, last_name, email, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (school_id, email) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           password_hash = EXCLUDED.password_hash,
           is_active = TRUE
     RETURNING teacher_id`,
    [schoolId, firstName, lastName, email, passwordHash],
  );
  return { teacherId: result.rows[0].teacher_id, email };
}

async function upsertClassroom(client, schoolId, teacherId, definition) {
  const className = `${definition.grade} - ${definition.section}`;
  const result = await client.query(
    `INSERT INTO classrooms (school_id, teacher_id, class_name, grade_name, section_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (school_id, class_name) DO UPDATE
       SET class_name = EXCLUDED.class_name,
           grade_name = EXCLUDED.grade_name,
           section_name = EXCLUDED.section_name,
           teacher_id = EXCLUDED.teacher_id
     RETURNING classroom_id`,
    [schoolId, teacherId, className, definition.grade, definition.section],
  );
  return result.rows[0].classroom_id;
}

async function upsertParent(client, phoneNumber) {
  const result = await client.query(
    `INSERT INTO parents (phone_number, phone_verified_at, status)
     VALUES ($1, now(), 'active')
     ON CONFLICT (phone_number) DO UPDATE
       SET phone_verified_at = COALESCE(parents.phone_verified_at, now()),
           status = 'active'
     RETURNING parent_id`,
    [phoneNumber],
  );
  return result.rows[0].parent_id;
}

async function upsertStudent(client, classroomId, rollNumber, firstName, lastName, parentContactUnavailable) {
  const result = await client.query(
    `INSERT INTO students (classroom_id, roll_number, first_name, last_name, is_flagged, parent_contact_unavailable)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (classroom_id, roll_number) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           is_flagged = EXCLUDED.is_flagged,
           parent_contact_unavailable = EXCLUDED.parent_contact_unavailable
     RETURNING student_id`,
    [classroomId, rollNumber, firstName, lastName, rollNumber % 7 === 0, parentContactUnavailable],
  );
  return result.rows[0].student_id;
}

async function linkParent(client, schoolId, studentId, parentId) {
  await client.query(
    `INSERT INTO school_parents (school_id, parent_id, status, invited_at, accepted_at)
     VALUES ($1, $2, 'active', now(), now())
     ON CONFLICT (school_id, parent_id) DO UPDATE
       SET status = 'active',
           accepted_at = COALESCE(school_parents.accepted_at, now()),
           revoked_at = NULL`,
    [schoolId, parentId],
  );

  await client.query(
    `INSERT INTO student_parents
       (student_id, parent_id, relationship, status, parent_accepted_at, school_confirmed_at)
     VALUES ($1, $2, 'Parent', 'verified', now(), now())
     ON CONFLICT (student_id, parent_id) DO UPDATE
       SET relationship = 'Parent',
           status = 'verified',
           parent_accepted_at = COALESCE(student_parents.parent_accepted_at, now()),
           school_confirmed_at = COALESCE(student_parents.school_confirmed_at, now())`,
    [studentId, parentId],
  );
}

async function upsertHbTest(client, studentId, teacherId, testDate, hbLevel) {
  const existing = await client.query(
    "SELECT test_id FROM hb_tests WHERE student_id = $1 AND test_date = $2 ORDER BY test_id LIMIT 1",
    [studentId, testDate],
  );

  if (existing.rows.length > 0) {
    const result = await client.query(
      "UPDATE hb_tests SET hb_level = $1, recorded_by = $2 WHERE test_id = $3 RETURNING test_id",
      [hbLevel, teacherId, existing.rows[0].test_id],
    );
    return result.rows[0].test_id;
  }

  const result = await client.query(
    `INSERT INTO hb_tests (student_id, test_date, hb_level, recorded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING test_id`,
    [studentId, testDate, hbLevel, teacherId],
  );
  return result.rows[0].test_id;
}

async function upsertTabletCourse(client, studentId, testId, startDate, endDate) {
  const result = await client.query(
    `INSERT INTO tablet_courses (student_id, test_id, start_date, end_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, test_id) DO UPDATE
       SET start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date
     RETURNING course_id`,
    [studentId, testId, startDate, endDate],
  );
  return result.rows[0].course_id;
}

async function upsertTabletDose(client, courseId, scheduledDate, status, parentId) {
  const isTaken = status === "taken";
  await client.query(
    `INSERT INTO tablet_doses
       (course_id, scheduled_date, status, taken_at, reported_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_id, scheduled_date) DO UPDATE
       SET status = EXCLUDED.status,
           taken_at = EXCLUDED.taken_at,
           reported_by = EXCLUDED.reported_by`,
    [courseId, scheduledDate, status, isTaken ? timestampFor(-1) : null, isTaken ? parentId : null],
  );
}

async function seedDemoData() {
  const confirmation = process.env.SEED_DEMO_DATA_CONFIRM;
  if (confirmation !== "LOCAL" && confirmation !== "REMOTE") {
    throw new Error("Refusing to seed without SEED_DEMO_DATA_CONFIRM=LOCAL or REMOTE.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (confirmation === "LOCAL" && !localHosts.has(databaseUrl.hostname)) {
    throw new Error("LOCAL seeding only permits localhost database targets. Use REMOTE explicitly for a hosted database.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const client = await pool.connect();
  const summary = {
    schools: 0,
    teachers: 0,
    classrooms: 0,
    students: 0,
    parents: 0,
    hbTests: 0,
    tabletCourses: 0,
    tabletDoses: 0,
    credentials: [],
  };

  try {
    await client.query("BEGIN");

    for (let schoolIndex = 0; schoolIndex < schoolDefinitions.length; schoolIndex += 1) {
      const school = schoolDefinitions[schoolIndex];
      const schoolId = await upsertSchool(client, school, passwordHash);
      summary.schools += 1;
      summary.credentials.push({ school: school.name, email: school.email, password: DEMO_PASSWORD });

      const teachers = [];
      for (const [firstName, lastName] of school.teachers) {
        const teacher = await upsertTeacher(client, schoolId, school.key, firstName, lastName, passwordHash);
        teachers.push(teacher);
        summary.teachers += 1;
        summary.credentials.push({
          school: school.name,
          teacher: `${firstName} ${lastName}`,
          email: teacher.email,
          password: DEMO_PASSWORD,
        });
      }

      for (let classroomIndex = 0; classroomIndex < classroomDefinitions.length; classroomIndex += 1) {
        const classroomId = await upsertClassroom(
          client,
          schoolId,
          teachers[classroomIndex].teacherId,
          classroomDefinitions[classroomIndex],
        );
        summary.classrooms += 1;

        for (let rollNumber = 1; rollNumber <= STUDENTS_PER_CLASSROOM; rollNumber += 1) {
          const globalStudentIndex = schoolIndex * 100 + classroomIndex * STUDENTS_PER_CLASSROOM + rollNumber;
          const firstName = studentFirstNames[(globalStudentIndex - 1) % studentFirstNames.length];
          const lastName = studentLastNames[(globalStudentIndex - 1) % studentLastNames.length];
          const parentContactUnavailable = rollNumber === 10;
          const studentId = await upsertStudent(
            client,
            classroomId,
            rollNumber,
            firstName,
            lastName,
            parentContactUnavailable,
          );
          summary.students += 1;

          const parentId = await upsertParent(client, demoPhoneNumber(globalStudentIndex));
          await linkParent(client, schoolId, studentId, parentId);
          summary.parents += 1;

          await upsertHbTest(
            client,
            studentId,
            teachers[classroomIndex].teacherId,
            dateOnly(-60),
            rollNumber % 6 === 0 ? 8.4 : 11.2,
          );
          const secondHb = await upsertHbTest(
            client,
            studentId,
            teachers[classroomIndex].teacherId,
            dateOnly(-7),
            rollNumber % 6 === 0 ? 9.1 : 11.8,
          );
          summary.hbTests += 2;

          if (rollNumber % 5 === 0) {
            const courseId = await upsertTabletCourse(client, studentId, secondHb, dateOnly(-14), dateOnly(30));
            summary.tabletCourses += 1;
            await upsertTabletDose(client, courseId, dateOnly(-2), "taken", parentId);
            await upsertTabletDose(client, courseId, dateOnly(-1), "scheduled", parentId);
            await upsertTabletDose(client, courseId, dateOnly(3), "scheduled", parentId);
            summary.tabletDoses += 3;
          }

        }
      }
    }

    await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
