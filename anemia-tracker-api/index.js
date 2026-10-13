require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const parentOtpStore = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verify database connection
pool.query("SELECT current_database()", (err, result) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to:", result.rows[0].current_database);
  }
});

// Public health check
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "API is healthy",
  });
});

// JWT authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authorization token required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.school_id = decoded.school_id;
    req.teacher_id = decoded.teacher_id;
    req.auth_role = decoded.role;
    req.parent_id = decoded.role === "parent" ? decoded.parent_id : undefined;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// Authorization guards
function requireSchoolAuth(req, res, next) {
  authMiddleware(req, res, () => {
    if (
      req.auth_role === "parent" ||
      !Number.isInteger(Number(req.school_id)) ||
      Number(req.school_id) <= 0
    ) {
      return res.status(401).json({
        message: "School authentication required",
      });
    }

    next();
  });
}

function requireTeacherAuth(req, res, next) {
  requireSchoolAuth(req, res, () => {
    if (
      !Number.isInteger(Number(req.teacher_id)) ||
      Number(req.teacher_id) <= 0
    ) {
      return res.status(401).json({
        message: "Teacher authentication required",
      });
    }

    next();
  });
}

function requireParentAuth(req, res, next) {
  authMiddleware(req, res, () => {
    if (
      req.auth_role !== "parent" ||
      !Number.isInteger(Number(req.parent_id)) ||
      Number(req.parent_id) <= 0
    ) {
      return res.status(401).json({
        message: "Parent authentication required",
      });
    }

    next();
  });
}

// Example protected route
app.get("/api/protected", requireSchoolAuth, (req, res) => {
  res.status(200).json({
    message: "Authentication successful",
    school_id: req.school_id,
  });
});

app.post("/schools", async (req, res, next) => {
  const { school_name, email, password } = req.body;

  // Validate required fields
  if (
    typeof school_name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    school_name.trim() === "" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res.status(400).json({
      message: "school_name, email, and password are required",
    });
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create school
    await pool.query(
      "INSERT INTO schools (school_name, email, password_hash) VALUES ($1, $2, $3)",
      [school_name.trim(), email.trim(), passwordHash]
    );

    return res.status(201).json({
      message: "School created successfully",
    });
  } catch (error) {
    // Handle duplicate email
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    return next(error);
  }
});

app.post("/schools/login", async (req, res, next) => {
  const { email, password } = req.body;

  // Validate credentials
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res.status(400).json({
      message: "email and password are required",
    });
  }

  try {
    // Find school
    const result = await pool.query(
      "SELECT school_id, password_hash FROM schools WHERE email = $1",
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Verify password
    const school = result.rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      school.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Issue token
    const token = jwt.sign(
      { school_id: school.school_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      school_id: school.school_id,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/teachers/login", async (req, res, next) => {
  const { school_id, email, password } = req.body;

  // Validate credentials
  if (
    !Number.isInteger(Number(school_id)) ||
    Number(school_id) <= 0 ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res.status(400).json({
      message: "school_id, email, and password are required",
    });
  }

  try {
    // Find teacher
    const result = await pool.query(
      "SELECT teacher_id, school_id, password_hash FROM teachers WHERE school_id = $1 AND email = $2",
      [Number(school_id), email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Verify password
    const teacher = result.rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      teacher.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Issue teacher token
    const token = jwt.sign(
      {
        school_id: teacher.school_id,
        teacher_id: teacher.teacher_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      school_id: teacher.school_id,
      teacher_id: teacher.teacher_id,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/teachers", requireSchoolAuth, async (req, res, next) => {
  const { first_name, last_name, email, password } = req.body;

  // Validate required fields
  if (
    typeof first_name !== "string" ||
    typeof last_name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    first_name.trim() === "" ||
    last_name.trim() === "" ||
    email.trim() === "" ||
    password.trim() === ""
  ) {
    return res.status(400).json({
      message: "first_name, last_name, email, and password are required",
    });
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create teacher
    await pool.query(
      "INSERT INTO teachers (school_id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)",
      [
        req.school_id,
        first_name.trim(),
        last_name.trim(),
        email.trim(),
        passwordHash,
      ]
    );

    return res.status(201).json({
      message: "Teacher created successfully",
    });
  } catch (error) {
    // Handle duplicate email within school
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    return next(error);
  }
});

app.get("/teachers", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch school teachers
    const result = await pool.query(
      "SELECT teacher_id, first_name, last_name, email, created_at FROM teachers WHERE school_id = $1 ORDER BY created_at DESC",
      [req.school_id]
    );

    // Return safe fields
    return res.status(200).json({
      teachers: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/teachers/:teacher_id", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch teacher
    const result = await pool.query(
      "SELECT teacher_id, first_name, last_name, email, created_at FROM teachers WHERE teacher_id = $1 AND school_id = $2",
      [req.params.teacher_id, req.school_id]
    );

    // Handle missing teacher
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Return safe fields
    return res.status(200).json({
      teacher: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.patch("/teachers/:teacher_id", requireSchoolAuth, async (req, res, next) => {
  const allowedFields = ["first_name", "last_name", "email"];
  const updates = [];
  const values = [];

  // Validate update fields
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      const value = req.body[field];

      if (typeof value !== "string" || value.trim() === "") {
        return res.status(400).json({
          message: "Updates must be non-empty strings",
        });
      }

      values.push(value.trim());
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({
      message: "At least one valid field is required",
    });
  }

  try {
    // Update teacher
    values.push(req.params.teacher_id, req.school_id);
    const result = await pool.query(
      `UPDATE teachers SET ${updates.join(", ")} WHERE teacher_id = $${
        values.length - 1
      } AND school_id = $${values.length} RETURNING teacher_id, first_name, last_name, email, created_at`,
      values
    );

    // Handle missing teacher
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    // Return safe fields
    return res.status(200).json({
      teacher: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate email within school
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    return next(error);
  }
});

app.post("/classrooms", requireSchoolAuth, async (req, res, next) => {
  const { class_name, teacher_id } = req.body;

  // Validate required fields
  if (typeof class_name !== "string" || class_name.trim() === "") {
    return res.status(400).json({
      message: "class_name is required",
    });
  }

  // Validate optional teacher
  if (
    teacher_id !== undefined &&
    (!Number.isInteger(Number(teacher_id)) || Number(teacher_id) <= 0)
  ) {
    return res.status(400).json({
      message: "teacher_id must be a valid teacher ID",
    });
  }

  try {
    const assignedTeacherId =
      teacher_id === undefined ? null : Number(teacher_id);

    // Verify teacher ownership
    if (assignedTeacherId !== null) {
      const teacherResult = await pool.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [assignedTeacherId, req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          message: "teacher_id must belong to this school",
        });
      }
    }

    // Create classroom
    const result = await pool.query(
      "INSERT INTO classrooms (school_id, teacher_id, class_name) VALUES ($1, $2, $3) RETURNING classroom_id, school_id, teacher_id, class_name, created_at",
      [req.school_id, assignedTeacherId, class_name.trim()]
    );

    // Return classroom
    return res.status(201).json({
      classroom: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate class name within school
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Class name already exists",
      });
    }

    return next(error);
  }
});

app.get("/classrooms", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch school classrooms
    const result = await pool.query(
      "SELECT classroom_id, class_name, teacher_id, created_at FROM classrooms WHERE school_id = $1 ORDER BY created_at DESC",
      [req.school_id]
    );

    return res.status(200).json({
      classrooms: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/classrooms/:classroom_id", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch classroom
    const result = await pool.query(
      "SELECT classroom_id, class_name, teacher_id, created_at FROM classrooms WHERE classroom_id = $1 AND school_id = $2",
      [req.params.classroom_id, req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Classroom not found",
      });
    }

    return res.status(200).json({
      classroom: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.patch("/classrooms/:classroom_id", requireSchoolAuth, async (req, res, next) => {
  const updates = [];
  const values = [];

  // Validate update fields
  if (Object.prototype.hasOwnProperty.call(req.body, "class_name")) {
    const { class_name } = req.body;

    if (typeof class_name !== "string" || class_name.trim() === "") {
      return res.status(400).json({
        message: "class_name must be a non-empty string",
      });
    }

    values.push(class_name.trim());
    updates.push(`class_name = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "teacher_id")) {
    const { teacher_id } = req.body;

    if (
      teacher_id !== null &&
      (!Number.isInteger(Number(teacher_id)) || Number(teacher_id) <= 0)
    ) {
      return res.status(400).json({
        message: "teacher_id must be null or a valid teacher ID",
      });
    }

    values.push(teacher_id === null ? null : Number(teacher_id));
    updates.push(`teacher_id = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      message: "At least one valid field is required",
    });
  }

  try {
    // Verify classroom ownership
    const classroomResult = await pool.query(
      "SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND school_id = $2",
      [req.params.classroom_id, req.school_id]
    );

    if (classroomResult.rows.length === 0) {
      return res.status(404).json({
        message: "Classroom not found",
      });
    }

    // Verify teacher ownership
    if (
      Object.prototype.hasOwnProperty.call(req.body, "teacher_id") &&
      req.body.teacher_id !== null
    ) {
      const teacherResult = await pool.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [Number(req.body.teacher_id), req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          message: "teacher_id must belong to this school",
        });
      }
    }

    // Update classroom
    values.push(req.params.classroom_id, req.school_id);
    const result = await pool.query(
      `UPDATE classrooms SET ${updates.join(", ")} WHERE classroom_id = $${
        values.length - 1
      } AND school_id = $${values.length} RETURNING classroom_id, class_name, teacher_id, created_at`,
      values
    );

    return res.status(200).json({
      classroom: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate class name within school
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Class name already exists",
      });
    }

    return next(error);
  }
});

app.delete("/classrooms/:classroom_id", requireSchoolAuth, async (req, res, next) => {
  try {
    // Delete classroom
    const result = await pool.query(
      "DELETE FROM classrooms WHERE classroom_id = $1 AND school_id = $2 RETURNING classroom_id",
      [req.params.classroom_id, req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Classroom not found",
      });
    }

    return res.status(200).json({
      message: "Classroom deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/students", requireSchoolAuth, async (req, res, next) => {
  const { classroom_id, roll_number, first_name, last_name } = req.body;

  // Validate required fields
  if (
    !Number.isInteger(Number(classroom_id)) ||
    Number(classroom_id) <= 0 ||
    !Number.isInteger(Number(roll_number)) ||
    Number(roll_number) <= 0 ||
    typeof first_name !== "string" ||
    typeof last_name !== "string" ||
    first_name.trim() === "" ||
    last_name.trim() === ""
  ) {
    return res.status(400).json({
      message:
        "classroom_id, positive roll_number, first_name, and last_name are required",
    });
  }

  try {
    // Verify classroom ownership
    const classroomResult = await pool.query(
      "SELECT classroom_id FROM classrooms WHERE classroom_id = $1 AND school_id = $2",
      [Number(classroom_id), req.school_id]
    );

    if (classroomResult.rows.length === 0) {
      return res.status(404).json({
        message: "Classroom not found",
      });
    }

    // Create student
    const result = await pool.query(
      "INSERT INTO students (classroom_id, roll_number, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING student_id, classroom_id, roll_number, first_name, last_name, is_flagged, created_at",
      [
        Number(classroom_id),
        Number(roll_number),
        first_name.trim(),
        last_name.trim(),
      ]
    );

    return res.status(201).json({
      student: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate roll number in classroom
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Roll number already exists in this classroom",
      });
    }

    return next(error);
  }
});

app.get("/students", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch school students
    const result = await pool.query(
      "SELECT s.student_id, s.classroom_id, s.roll_number, s.first_name, s.last_name, s.is_flagged, s.created_at FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE c.school_id = $1 ORDER BY s.created_at DESC",
      [req.school_id]
    );

    return res.status(200).json({
      students: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/students/:student_id", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch school student
    const result = await pool.query(
      "SELECT s.student_id, s.classroom_id, s.roll_number, s.first_name, s.last_name, s.is_flagged, s.created_at FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
      [req.params.student_id, req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      student: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.patch("/students/:student_id", requireSchoolAuth, async (req, res, next) => {
  const updates = [];
  const values = [];

  // Validate update fields
  if (Object.prototype.hasOwnProperty.call(req.body, "roll_number")) {
    const { roll_number } = req.body;

    if (!Number.isInteger(Number(roll_number)) || Number(roll_number) <= 0) {
      return res.status(400).json({
        message: "roll_number must be a positive integer",
      });
    }

    values.push(Number(roll_number));
    updates.push(`roll_number = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "first_name")) {
    const { first_name } = req.body;

    if (typeof first_name !== "string" || first_name.trim() === "") {
      return res.status(400).json({
        message: "first_name must be a non-empty string",
      });
    }

    values.push(first_name.trim());
    updates.push(`first_name = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "last_name")) {
    const { last_name } = req.body;

    if (typeof last_name !== "string" || last_name.trim() === "") {
      return res.status(400).json({
        message: "last_name must be a non-empty string",
      });
    }

    values.push(last_name.trim());
    updates.push(`last_name = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "is_flagged")) {
    const { is_flagged } = req.body;

    if (typeof is_flagged !== "boolean") {
      return res.status(400).json({
        message: "is_flagged must be a boolean",
      });
    }

    values.push(is_flagged);
    updates.push(`is_flagged = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      message: "At least one valid field is required",
    });
  }

  try {
    // Update school student
    values.push(req.params.student_id, req.school_id);
    const result = await pool.query(
      `UPDATE students s SET ${updates.join(
        ", "
      )} FROM classrooms c WHERE s.classroom_id = c.classroom_id AND s.student_id = $${
        values.length - 1
      } AND c.school_id = $${values.length} RETURNING s.student_id, s.classroom_id, s.roll_number, s.first_name, s.last_name, s.is_flagged, s.created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      student: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate roll number in classroom
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Roll number already exists in this classroom",
      });
    }

    return next(error);
  }
});

app.delete("/students/:student_id", requireSchoolAuth, async (req, res, next) => {
  try {
    // Delete school student
    const result = await pool.query(
      "DELETE FROM students s USING classrooms c WHERE s.classroom_id = c.classroom_id AND s.student_id = $1 AND c.school_id = $2 RETURNING s.student_id",
      [req.params.student_id, req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      message: "Student deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
});

function hashParentOtp(phoneNumber, otp) {
  return crypto
    .createHash("sha256")
    .update(`${phoneNumber}:${otp}:${process.env.JWT_SECRET}`)
    .digest("hex");
}

function isParentOtpMatch(expectedHash, phoneNumber, otp) {
  const actualHash = hashParentOtp(phoneNumber, otp);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(actualHash, "hex")
  );
}

app.post("/parents/login/request-otp", async (req, res, next) => {
  const { phone_number } = req.body;

  // Validate phone number
  if (typeof phone_number !== "string" || phone_number.trim() === "") {
    return res.status(400).json({
      message: "phone_number is required",
    });
  }

  const phoneNumber = phone_number.trim();

  // Block development OTPs in production
  if (process.env.NODE_ENV === "production") {
    return res.status(503).json({
      message: "OTP delivery is not configured",
    });
  }

  try {
    // Find active parent
    const result = await pool.query(
      "SELECT parent_id FROM parents WHERE phone_number = $1 AND status = 'active'",
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Parent not found",
      });
    }

    // Generate development OTP
    const otp = String(crypto.randomInt(100000, 1000000));
    parentOtpStore.set(phoneNumber, {
      parent_id: result.rows[0].parent_id,
      otp_hash: hashParentOtp(phoneNumber, otp),
      expires_at: Date.now() + 5 * 60 * 1000,
      attempts_remaining: 5,
    });

    return res.status(200).json({
      message: "OTP generated",
      otp,
      expires_in_seconds: 300,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/parents/login/verify-otp", async (req, res, next) => {
  const { phone_number, otp } = req.body;

  // Validate OTP input
  if (
    typeof phone_number !== "string" ||
    phone_number.trim() === "" ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({
      message: "phone_number and a valid OTP are required",
    });
  }

  const phoneNumber = phone_number.trim();
  const otpState = parentOtpStore.get(phoneNumber);

  if (!otpState) {
    return res.status(401).json({
      message: "Invalid or expired OTP",
    });
  }

  if (Date.now() > otpState.expires_at) {
    parentOtpStore.delete(phoneNumber);
    return res.status(401).json({
      message: "Invalid or expired OTP",
    });
  }

  if (otpState.attempts_remaining <= 0) {
    parentOtpStore.delete(phoneNumber);
    return res.status(401).json({
      message: "Invalid or expired OTP",
    });
  }

  if (!isParentOtpMatch(otpState.otp_hash, phoneNumber, otp)) {
    otpState.attempts_remaining -= 1;

    if (otpState.attempts_remaining <= 0) {
      parentOtpStore.delete(phoneNumber);
    } else {
      parentOtpStore.set(phoneNumber, otpState);
    }

    return res.status(401).json({
      message: "Invalid or expired OTP",
    });
  }

  try {
    // Verify active parent
    const result = await pool.query(
      "SELECT parent_id FROM parents WHERE parent_id = $1 AND phone_number = $2 AND status = 'active'",
      [otpState.parent_id, phoneNumber]
    );

    if (result.rows.length === 0) {
      parentOtpStore.delete(phoneNumber);
      return res.status(401).json({
        message: "Invalid or expired OTP",
      });
    }

    // Issue parent token
    parentOtpStore.delete(phoneNumber);
    const token = jwt.sign(
      {
        parent_id: result.rows[0].parent_id,
        role: "parent",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      parent_id: result.rows[0].parent_id,
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/parents/me/students", requireParentAuth, async (req, res, next) => {
  try {
    // Fetch verified students linked to the authenticated parent
    const result = await pool.query(
      "SELECT s.student_id, s.first_name, s.last_name, s.roll_number, s.classroom_id, c.class_name, sc.school_name FROM student_parents sp INNER JOIN students s ON sp.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id INNER JOIN schools sc ON c.school_id = sc.school_id WHERE sp.parent_id = $1 AND sp.status = 'verified' ORDER BY sc.school_name ASC, c.class_name ASC, s.roll_number ASC",
      [Number(req.parent_id)]
    );

    return res.status(200).json({
      students: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/parents", requireSchoolAuth, async (req, res, next) => {
  const { phone_number } = req.body;

  // Validate required fields
  if (typeof phone_number !== "string" || phone_number.trim() === "") {
    return res.status(400).json({
      message: "phone_number is required",
    });
  }

  try {
    // Create parent
    const result = await pool.query(
      "INSERT INTO parents (phone_number) VALUES ($1) RETURNING parent_id, phone_number, phone_verified_at, status, created_at",
      [phone_number.trim()]
    );

    return res.status(201).json({
      parent: result.rows[0],
    });
  } catch (error) {
    // Handle duplicate phone number
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Phone number already exists",
      });
    }

    return next(error);
  }
});

app.get("/parents", requireSchoolAuth, async (req, res, next) => {
  try {
    // Fetch school-linked parents
    const result = await pool.query(
      "SELECT DISTINCT p.parent_id, p.phone_number, p.phone_verified_at, p.status, p.created_at FROM parents p INNER JOIN student_parents sp ON p.parent_id = sp.parent_id INNER JOIN students s ON sp.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE c.school_id = $1 ORDER BY p.created_at DESC",
      [req.school_id]
    );

    return res.status(200).json({
      parents: result.rows,
    });
  } catch (error) {
    return next(error);
  }
});

app.post(
  "/students/:student_id/parents",
  requireSchoolAuth,
  async (req, res, next) => {
    const { parent_id, relationship } = req.body;

    // Validate required fields
    if (!Number.isInteger(Number(parent_id)) || Number(parent_id) <= 0) {
      return res.status(400).json({
        message: "parent_id is required",
      });
    }

    if (
      relationship !== undefined &&
      relationship !== null &&
      (typeof relationship !== "string" || relationship.trim() === "")
    ) {
      return res.status(400).json({
        message: "relationship must be a non-empty string",
      });
    }

    try {
      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [req.params.student_id, req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Verify parent exists
      const parentResult = await pool.query(
        "SELECT parent_id FROM parents WHERE parent_id = $1",
        [Number(parent_id)]
      );

      if (parentResult.rows.length === 0) {
        return res.status(400).json({
          message: "parent_id must reference an existing parent",
        });
      }

      // Link parent to student
      const result = await pool.query(
        "INSERT INTO student_parents (student_id, parent_id, relationship, status) VALUES ($1, $2, $3, 'pending') RETURNING student_id, parent_id, relationship, status, created_at",
        [
          req.params.student_id,
          Number(parent_id),
          relationship === undefined || relationship === null
            ? null
            : relationship.trim(),
        ]
      );

      return res.status(201).json({
        student_parent: result.rows[0],
      });
    } catch (error) {
      // Handle duplicate student-parent link
      if (error.code === "23505") {
        return res.status(409).json({
          message: "Parent is already linked to this student",
        });
      }

      return next(error);
    }
  }
);

app.get(
  "/students/:student_id/parents",
  requireSchoolAuth,
  async (req, res, next) => {
    try {
      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [req.params.student_id, req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Fetch linked parents
      const result = await pool.query(
        "SELECT p.parent_id, p.phone_number, p.phone_verified_at, p.status, p.created_at, sp.relationship, sp.status AS link_status, sp.created_at AS linked_at FROM parents p INNER JOIN student_parents sp ON p.parent_id = sp.parent_id WHERE sp.student_id = $1 ORDER BY sp.created_at DESC",
        [req.params.student_id]
      );

      return res.status(200).json({
        parents: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.patch(
  "/students/:student_id/parents/:parent_id",
  requireSchoolAuth,
  async (req, res, next) => {
    const { status } = req.body;

    // Validate link identifiers
    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    if (!Number.isInteger(Number(req.params.parent_id)) || Number(req.params.parent_id) <= 0) {
      return res.status(400).json({
        message: "parent_id must be a valid parent ID",
      });
    }

    if (status !== "verified" && status !== "pending") {
      return res.status(400).json({
        message: "status must be either verified or pending",
      });
    }

    try {
      // Update only links for students owned by this school
      const result = await pool.query(
        "UPDATE student_parents sp SET status = $1 FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE sp.student_id = s.student_id AND sp.student_id = $2 AND sp.parent_id = $3 AND c.school_id = $4 RETURNING sp.student_id, sp.parent_id, sp.relationship, sp.status, sp.created_at",
        [
          status,
          Number(req.params.student_id),
          Number(req.params.parent_id),
          req.school_id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Student-parent link not found",
        });
      }

      return res.status(200).json({
        student_parent: result.rows[0],
      });
    } catch (error) {
      // Handle database constraint errors
      if (error.code === "23503" || error.code === "23514") {
        return res.status(400).json({
          message: "Invalid student-parent link data",
        });
      }

      return next(error);
    }
  }
);

app.post(
  "/students/:student_id/hb-tests",
  requireTeacherAuth,
  async (req, res, next) => {
    const { hb_level, test_date } = req.body;

    // Validate test input
    const hbLevel = Number(hb_level);
    const parsedTestDate = new Date(test_date);

    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    if (
      test_date === undefined ||
      Number.isNaN(parsedTestDate.getTime()) ||
      parsedTestDate.toISOString().slice(0, 10) !== test_date
    ) {
      return res.status(400).json({
        message: "test_date must be a valid date in YYYY-MM-DD format",
      });
    }

    if (Number.isNaN(hbLevel) || hbLevel < 2.0 || hbLevel > 25.0) {
      return res.status(400).json({
        message: "hb_level must be between 2.0 and 25.0",
      });
    }

    if (
      !Number.isInteger(Number(req.teacher_id)) ||
      Number(req.teacher_id) <= 0
    ) {
      return res.status(401).json({
        message: "Authenticated teacher is required to record Hb tests",
      });
    }

    try {
      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [Number(req.params.student_id), req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Verify teacher ownership
      const teacherResult = await pool.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [Number(req.teacher_id), req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          message: "Authenticated teacher must belong to this school",
        });
      }

      // Record Hb test
      const result = await pool.query(
        "INSERT INTO hb_tests (student_id, test_date, hb_level, recorded_by) VALUES ($1, $2, $3, $4) RETURNING test_id, student_id, test_date, hb_level, recorded_by, created_at",
        [
          Number(req.params.student_id),
          test_date,
          hbLevel,
          Number(req.teacher_id),
        ]
      );

      return res.status(201).json({
        hb_test: result.rows[0],
      });
    } catch (error) {
      // Handle database constraint errors
      if (error.code === "23505") {
        return res.status(409).json({
          message: "Hb test already exists",
        });
      }

      if (error.code === "23503" || error.code === "23514") {
        return res.status(400).json({
          message: "Invalid Hb test data",
        });
      }

      return next(error);
    }
  }
);

app.get(
  "/students/:student_id/hb-tests",
  requireSchoolAuth,
  async (req, res, next) => {
    // Validate student ID
    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    try {
      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [Number(req.params.student_id), req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Fetch student Hb tests
      const result = await pool.query(
        "SELECT test_id, student_id, test_date, hb_level, recorded_by, created_at FROM hb_tests WHERE student_id = $1 ORDER BY test_date DESC, created_at DESC",
        [Number(req.params.student_id)]
      );

      return res.status(200).json({
        hb_tests: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.get("/hb-tests/:test_id", requireSchoolAuth, async (req, res, next) => {
  // Validate test ID
  if (!Number.isInteger(Number(req.params.test_id)) || Number(req.params.test_id) <= 0) {
    return res.status(400).json({
      message: "test_id must be a valid Hb test ID",
    });
  }

  try {
    // Fetch school Hb test
    const result = await pool.query(
      "SELECT h.test_id, h.student_id, h.test_date, h.hb_level, h.recorded_by, h.created_at FROM hb_tests h INNER JOIN students s ON h.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE h.test_id = $1 AND c.school_id = $2",
      [Number(req.params.test_id), req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Hb test not found",
      });
    }

    return res.status(200).json({
      hb_test: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.post(
  "/students/:student_id/tablet-courses",
  requireTeacherAuth,
  async (req, res, next) => {
    const { test_id, start_date, end_date } = req.body;

    // Validate course input
    const parsedStartDate = new Date(start_date);
    const parsedEndDate = new Date(end_date);

    if (
      !Number.isInteger(Number(req.teacher_id)) ||
      Number(req.teacher_id) <= 0
    ) {
      return res.status(401).json({
        message: "Authenticated teacher is required to create tablet courses",
      });
    }

    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    if (!Number.isInteger(Number(test_id)) || Number(test_id) <= 0) {
      return res.status(400).json({
        message: "test_id must be a valid Hb test ID",
      });
    }

    if (
      start_date === undefined ||
      Number.isNaN(parsedStartDate.getTime()) ||
      parsedStartDate.toISOString().slice(0, 10) !== start_date
    ) {
      return res.status(400).json({
        message: "start_date must be a valid date in YYYY-MM-DD format",
      });
    }

    if (
      end_date === undefined ||
      Number.isNaN(parsedEndDate.getTime()) ||
      parsedEndDate.toISOString().slice(0, 10) !== end_date
    ) {
      return res.status(400).json({
        message: "end_date must be a valid date in YYYY-MM-DD format",
      });
    }

    if (parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        message: "end_date must be on or after start_date",
      });
    }

    try {
      // Verify teacher ownership
      const teacherResult = await pool.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [Number(req.teacher_id), req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          message: "Authenticated teacher must belong to this school",
        });
      }

      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [Number(req.params.student_id), req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Verify Hb test ownership
      const testResult = await pool.query(
        "SELECT h.test_id FROM hb_tests h INNER JOIN students s ON h.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE h.test_id = $1 AND h.student_id = $2 AND c.school_id = $3",
        [Number(test_id), Number(req.params.student_id), req.school_id]
      );

      if (testResult.rows.length === 0) {
        return res.status(400).json({
          message: "test_id must belong to this student",
        });
      }

      // Create tablet course
      const result = await pool.query(
        "INSERT INTO tablet_courses (student_id, test_id, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING course_id, student_id, test_id, start_date, end_date, created_at",
        [Number(req.params.student_id), Number(test_id), start_date, end_date]
      );

      return res.status(201).json({
        tablet_course: result.rows[0],
      });
    } catch (error) {
      // Handle database constraint errors
      if (error.code === "23503" || error.code === "23514") {
        return res.status(400).json({
          message: "Invalid tablet course data",
        });
      }

      return next(error);
    }
  }
);

app.get(
  "/students/:student_id/tablet-courses",
  requireTeacherAuth,
  async (req, res, next) => {
    // Validate student ID
    if (
      !Number.isInteger(Number(req.teacher_id)) ||
      Number(req.teacher_id) <= 0
    ) {
      return res.status(401).json({
        message: "Authenticated teacher is required to view tablet courses",
      });
    }

    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    try {
      // Verify teacher ownership
      const teacherResult = await pool.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [Number(req.teacher_id), req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          message: "Authenticated teacher must belong to this school",
        });
      }

      // Verify student ownership
      const studentResult = await pool.query(
        "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
        [Number(req.params.student_id), req.school_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      // Fetch tablet courses
      const result = await pool.query(
        "SELECT course_id, student_id, test_id, start_date, end_date, created_at FROM tablet_courses WHERE student_id = $1 ORDER BY start_date DESC, created_at DESC",
        [Number(req.params.student_id)]
      );

      return res.status(200).json({
        tablet_courses: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.get("/tablet-courses/:course_id", requireTeacherAuth, async (req, res, next) => {
  // Validate course ID
  if (
    !Number.isInteger(Number(req.teacher_id)) ||
    Number(req.teacher_id) <= 0
  ) {
    return res.status(401).json({
      message: "Authenticated teacher is required to view tablet courses",
    });
  }

  if (!Number.isInteger(Number(req.params.course_id)) || Number(req.params.course_id) <= 0) {
    return res.status(400).json({
      message: "course_id must be a valid tablet course ID",
    });
  }

  try {
    // Verify teacher ownership
    const teacherResult = await pool.query(
      "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
      [Number(req.teacher_id), req.school_id]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(400).json({
        message: "Authenticated teacher must belong to this school",
      });
    }

    // Fetch school tablet course
    const result = await pool.query(
      "SELECT tc.course_id, tc.student_id, tc.test_id, tc.start_date, tc.end_date, tc.created_at FROM tablet_courses tc INNER JOIN students s ON tc.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE tc.course_id = $1 AND c.school_id = $2",
      [Number(req.params.course_id), req.school_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Tablet course not found",
      });
    }

    return res.status(200).json({
      tablet_course: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

app.post(
  "/tablet-courses/:course_id/tablet-doses",
  requireTeacherAuth,
  async (req, res, next) => {
    const { scheduled_dates } = req.body;

    // Validate course ID
    if (
      !Number.isInteger(Number(req.teacher_id)) ||
      Number(req.teacher_id) <= 0
    ) {
      return res.status(401).json({
        message: "Authenticated teacher is required to create tablet doses",
      });
    }

    if (!Number.isInteger(Number(req.params.course_id)) || Number(req.params.course_id) <= 0) {
      return res.status(400).json({
        message: "course_id must be a valid tablet course ID",
      });
    }

    if (!Array.isArray(scheduled_dates) || scheduled_dates.length === 0) {
      return res.status(400).json({
        message: "scheduled_dates must be a non-empty array of dates",
      });
    }

    const seenDates = new Set();
    for (const scheduledDate of scheduled_dates) {
      if (typeof scheduledDate !== "string") {
        return res.status(400).json({
          message: "scheduled_dates must contain valid dates in YYYY-MM-DD format",
        });
      }

      const parsedDate = new Date(scheduledDate);
      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== scheduledDate
      ) {
        return res.status(400).json({
          message: "scheduled_dates must contain valid dates in YYYY-MM-DD format",
        });
      }

      if (seenDates.has(scheduledDate)) {
        return res.status(400).json({
          message: "scheduled_dates must not contain duplicate dates",
        });
      }

      seenDates.add(scheduledDate);
    }

    let client;
    let transactionOpen = false;

    async function rollbackTransaction() {
      if (transactionOpen) {
        transactionOpen = false;
        await client.query("ROLLBACK");
      }
    }

    try {
      client = await pool.connect();
      await client.query("BEGIN");
      transactionOpen = true;

      // Verify teacher ownership
      const teacherResult = await client.query(
        "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
        [Number(req.teacher_id), req.school_id]
      );

      if (teacherResult.rows.length === 0) {
        await rollbackTransaction();
        return res.status(400).json({
          message: "Authenticated teacher must belong to this school",
        });
      }

      // Fetch school tablet course
      const courseResult = await client.query(
        "SELECT tc.course_id, tc.start_date::text AS start_date, tc.end_date::text AS end_date FROM tablet_courses tc INNER JOIN students s ON tc.student_id = s.student_id INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE tc.course_id = $1 AND c.school_id = $2",
        [Number(req.params.course_id), req.school_id]
      );

      if (courseResult.rows.length === 0) {
        await rollbackTransaction();
        return res.status(404).json({
          message: "Tablet course not found",
        });
      }

      const course = courseResult.rows[0];

      if (
        scheduled_dates.some(
          (scheduledDate) =>
            scheduledDate < course.start_date || scheduledDate > course.end_date
        )
      ) {
        await rollbackTransaction();
        return res.status(400).json({
          message: "scheduled_dates must fall within the tablet course dates",
        });
      }

      const values = [Number(req.params.course_id)];
      const placeholders = scheduled_dates.map((scheduledDate, index) => {
        values.push(scheduledDate);
        return `($1, $${index + 2})`;
      });

      const result = await client.query(
        `INSERT INTO tablet_doses (course_id, scheduled_date) VALUES ${placeholders.join(
          ", "
        )} RETURNING dose_id, course_id, scheduled_date, status, taken_at, reported_by`,
        values
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return res.status(201).json({
        tablet_doses: result.rows,
      });
    } catch (error) {
      try {
        await rollbackTransaction();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError.message);
      }

      if (error.code === "23505") {
        return res.status(409).json({
          message: "Tablet dose already exists for one or more scheduled dates",
        });
      }

      if (error.code === "23503" || error.code === "23514") {
        return res.status(400).json({
          message: "Invalid tablet dose data",
        });
      }

      return next(error);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

app.get(
  "/students/:student_id/tablet-doses",
  authMiddleware,
  async (req, res, next) => {
    // Validate student ID
    if (!Number.isInteger(Number(req.params.student_id)) || Number(req.params.student_id) <= 0) {
      return res.status(400).json({
        message: "student_id must be a valid student ID",
      });
    }

    try {
      if (req.auth_role === "parent") {
        if (
          !Number.isInteger(Number(req.parent_id)) ||
          Number(req.parent_id) <= 0
        ) {
          return res.status(401).json({
            message: "Parent authentication required",
          });
        }

        // Verify verified parent-student link
        const linkResult = await pool.query(
          "SELECT student_id FROM student_parents WHERE student_id = $1 AND parent_id = $2 AND status = 'verified'",
          [Number(req.params.student_id), Number(req.parent_id)]
        );

        if (linkResult.rows.length === 0) {
          return res.status(404).json({
            message: "Student not found",
          });
        }
      } else {
        if (
          !Number.isInteger(Number(req.teacher_id)) ||
          Number(req.teacher_id) <= 0
        ) {
          return res.status(401).json({
            message: "Teacher authentication required",
          });
        }

        // Verify teacher ownership
        const teacherResult = await pool.query(
          "SELECT teacher_id FROM teachers WHERE teacher_id = $1 AND school_id = $2",
          [Number(req.teacher_id), req.school_id]
        );

        if (teacherResult.rows.length === 0) {
          return res.status(400).json({
            message: "Authenticated teacher must belong to this school",
          });
        }

        // Verify student ownership
        const studentResult = await pool.query(
          "SELECT s.student_id FROM students s INNER JOIN classrooms c ON s.classroom_id = c.classroom_id WHERE s.student_id = $1 AND c.school_id = $2",
          [Number(req.params.student_id), req.school_id]
        );

        if (studentResult.rows.length === 0) {
          return res.status(404).json({
            message: "Student not found",
          });
        }
      }

      // Fetch student tablet doses
      const result = await pool.query(
        "SELECT td.dose_id, td.course_id, td.scheduled_date, td.status, td.taken_at, td.reported_by FROM tablet_doses td INNER JOIN tablet_courses tc ON td.course_id = tc.course_id WHERE tc.student_id = $1 ORDER BY td.scheduled_date ASC, td.created_at ASC",
        [Number(req.params.student_id)]
      );

      return res.status(200).json({
        tablet_doses: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

app.patch("/tablet-doses/:dose_id", requireParentAuth, async (req, res, next) => {
  const requestFields = Object.keys(req.body);

  // Validate report action
  if (!Number.isInteger(Number(req.params.dose_id)) || Number(req.params.dose_id) <= 0) {
    return res.status(400).json({
      message: "dose_id must be a valid tablet dose ID",
    });
  }

  if (
    requestFields.length !== 1 ||
    !Object.prototype.hasOwnProperty.call(req.body, "status") ||
    req.body.status !== "taken"
  ) {
    return res.status(400).json({
      message: "Only status: taken is allowed",
    });
  }

  try {
    // Verify parent can report dose
    const doseResult = await pool.query(
      "SELECT td.dose_id, td.status FROM tablet_doses td INNER JOIN tablet_courses tc ON td.course_id = tc.course_id INNER JOIN student_parents sp ON tc.student_id = sp.student_id WHERE td.dose_id = $1 AND sp.parent_id = $2 AND sp.status = 'verified'",
      [Number(req.params.dose_id), Number(req.parent_id)]
    );

    if (doseResult.rows.length === 0) {
      return res.status(404).json({
        message: "Tablet dose not found",
      });
    }

    if (doseResult.rows[0].status !== "scheduled") {
      return res.status(400).json({
        message: "Tablet dose has already been reported",
      });
    }

    // Mark dose as taken
    const result = await pool.query(
      "UPDATE tablet_doses SET status = 'taken', taken_at = now(), reported_by = $1 WHERE dose_id = $2 AND status = 'scheduled' RETURNING dose_id, course_id, scheduled_date, status, taken_at, reported_by",
      [Number(req.parent_id), Number(req.params.dose_id)]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Tablet dose has already been reported",
      });
    }

    return res.status(200).json({
      tablet_dose: result.rows[0],
    });
  } catch (error) {
    // Handle database constraint errors
    if (error.code === "23503" || error.code === "23514") {
      return res.status(400).json({
        message: "Invalid tablet dose data",
      });
    }

    return next(error);
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(500).json({
    message: "Internal server error",
  });
});

// Start server
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
