require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

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
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// Example protected route
app.get("/api/protected", authMiddleware, (req, res) => {
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

app.post("/teachers", authMiddleware, async (req, res, next) => {
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

app.get("/teachers", authMiddleware, async (req, res, next) => {
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

app.get("/teachers/:teacher_id", authMiddleware, async (req, res, next) => {
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

app.patch("/teachers/:teacher_id", authMiddleware, async (req, res, next) => {
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

app.post("/classrooms", authMiddleware, async (req, res, next) => {
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

app.get("/classrooms", authMiddleware, async (req, res, next) => {
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

app.get("/classrooms/:classroom_id", authMiddleware, async (req, res, next) => {
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

app.patch("/classrooms/:classroom_id", authMiddleware, async (req, res, next) => {
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

app.delete("/classrooms/:classroom_id", authMiddleware, async (req, res, next) => {
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

app.post("/students", authMiddleware, async (req, res, next) => {
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

app.get("/students", authMiddleware, async (req, res, next) => {
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

app.get("/students/:student_id", authMiddleware, async (req, res, next) => {
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

app.patch("/students/:student_id", authMiddleware, async (req, res, next) => {
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

app.delete("/students/:student_id", authMiddleware, async (req, res, next) => {
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

app.post("/parents", authMiddleware, async (req, res, next) => {
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

app.get("/parents", authMiddleware, async (req, res, next) => {
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
  authMiddleware,
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
  authMiddleware,
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
