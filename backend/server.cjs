// backend/server.cjs (Modified for mysql2/promise and pool)
require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise"); // Use mysql2/promise
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// const util = require("util"); // No longer needed for query promisify

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Database Connection Pool ---
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  socketPath: process.env.DB_SOCKET_PATH,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup
pool
  .getConnection()
  .then((connection) => {
    console.log("Connected to MySQL database via pool!");
    connection.release();
  })
  .catch((err) => {
    console.error("Error connecting to database pool:", err);
    process.exit(1);
  });

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, userPayload) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res
        .status(403)
        .json({ message: "Token is not valid or expired." });
    }
    req.user = userPayload;
    next();
  });
};

// Helper function for authorization based on role
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(403)
        .json({ message: "Forbidden: Role information missing." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Forbidden: Access denied for role ${req.user.role}.` });
    }
    next();
  };
};

// --- API Endpoints ---

// === User Management ===
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "All fields (username, email, password, role) are required." });
  }
  if (!["student", "instructor"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    // Use pool.query, destructure result for SELECT
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Use pool.query, destructure result for INSERT
    // Assuming password_hash column exists based on original code
    const [result] = await pool.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully.",
      // Use result.insertId from the OkPacket
      user: { id: result.insertId, username, email, role },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Error creating user." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  try {
    // Use pool.query, destructure result for SELECT
    // Assuming password_hash column exists based on original code
    const [users] = await pool.query(
      "SELECT id, username, email, password_hash, role FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const user = users[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const userPayload = { userId: user.id, role: user.role, username: user.username };
    const accessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      token: accessToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error logging in." });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Use pool.query, destructure result for SELECT
    const [users] = await pool.query(
      "SELECT id, username, email, role FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(users[0]);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Error fetching user profile." });
  }
});

app.put("/api/users/:userId", authenticateToken, async (req, res) => {
  const { userId: paramUserId } = req.params;
  const updates = req.body;
  const loggedInUserId = req.user.userId;
  const loggedInUserRole = req.user.role;

  if (loggedInUserId !== parseInt(paramUserId) && loggedInUserRole !== "admin") {
    return res
      .status(403)
      .json({ message: "Forbidden: You can only update your own profile." });
  }

  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }
    // Use pool.query, destructure result for SELECT
    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [updates.email, paramUserId]
    );
    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ message: "Email already in use by another account." });
    }
  }
  if (updates.username && updates.username.trim() === "") {
    return res.status(400).json({ message: "Username cannot be empty." });
  }

  try {
    const allowedUpdates = ["username", "email"];
    const setClauses = [];
    const values = [];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (setClauses.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update." });
    }
    values.push(paramUserId);

    const sql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`;
    // Use pool.query, destructure result for UPDATE
    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "User not found or no changes made." });
    }

    // Use pool.query, destructure result for SELECT
    const [updatedUser] = await pool.query(
      "SELECT id, username, email, role FROM users WHERE id = ?",
      [paramUserId]
    );
    res.json({ message: "User profile updated successfully.", user: updatedUser[0] });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Error updating user profile." });
  }
});

// === Course Management ===
app.post(
  "/api/courses",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const instructorId = req.user.userId;
    const { title, description, imageUrl, lessons = [], category } = req.body;

    if (!title || !description || !category) {
      return res
        .status(400)
        .json({ message: "Title, description, and category are required." });
    }

    // Refactor transaction logic
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Schema: courses table has instructor_id, image_url, enrollment_count, rating
      const [courseResult] = await connection.query(
        "INSERT INTO courses (title, description, instructor_id, image_url, category, rating, enrollment_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [title, description, instructorId, imageUrl || null, category, 0.0, 0]
      );
      const courseId = courseResult.insertId;

      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          // Schema: lessons table has course_id, title, type, content, lesson_order
          if (!lesson.title || !lesson.type || !lesson.content) {
            await connection.rollback(); // Rollback on this connection
            return res.status(400).json({
              message: `Invalid lesson data provided for lesson titled \"${lesson.title || "Untitled"}\". Title, type, and content are required.`,
            });
          }
          await connection.query(
            "INSERT INTO lessons (course_id, title, type, content, lesson_order) VALUES (?, ?, ?, ?, ?)",
            [
              courseId,
              lesson.title,
              lesson.type,
              lesson.content,
              lesson.lesson_order || null,
            ]
          );
        }
      }
      await connection.commit(); // Commit on this connection

      // Fetch created course and lessons using the pool
      const [createdCourse] = await pool.query(
        "SELECT * FROM courses WHERE id = ?",
        [courseId]
      );
      const [createdLessons] = await pool.query(
        "SELECT * FROM lessons WHERE course_id = ?",
        [courseId]
      );
      const [quizResults] = await pool.query(
        "SELECT id FROM quizzes WHERE course_id = ?",
        [courseId]
      );

      res.status(201).json({
        ...createdCourse[0],
        lessons: createdLessons,
        quizIds: quizResults.map((q) => q.id),
      });
    } catch (error) {
      if (connection) await connection.rollback(); // Rollback on error
      console.error("Create course error:", error);
      res.status(500).json({ message: "Error creating course." });
    } finally {
      if (connection) connection.release(); // Release connection back to pool
    }
  }
);

app.get("/api/courses", async (req, res) => {
  try {
    // Use pool.query, destructure result for SELECT
    // Schema: courses table has created_at
    const [courses] = await pool.query(
      "SELECT * FROM courses ORDER BY created_at DESC"
    );
    res.json(courses.map((course) => ({ ...course, lessons: [], quizIds: [] })));
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: "Error fetching courses." });
  }
});

app.get("/api/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  try {
    // Use pool.query, destructure result for SELECT
    const [courseResults] = await pool.query(
      "SELECT * FROM courses WHERE id = ?",
      [courseId]
    );
    if (courseResults.length === 0) {
      return res.status(404).json({ message: "Course not found." });
    }
    const course = courseResults[0];

    // Schema: lessons table has course_id, lesson_order
    const [lessons] = await pool.query(
      "SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order, id",
      [courseId]
    );

    // Schema: quizzes table has course_id, created_at
    const [quizResults] = await pool.query(
      "SELECT id, title FROM quizzes WHERE course_id = ? ORDER BY created_at",
      [courseId]
    );

    course.lessons = lessons;
    course.quizIds = quizResults.map((q) => q.id);

    res.json(course);
  } catch (error) {
    console.error("Get course by ID error:", error);
    res.status(500).json({ message: "Error fetching course details." });
  }
});

app.put(
  "/api/courses/:courseId",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const { courseId } = req.params;
    const instructorIdFromToken = req.user.userId;
    const { title, description, imageUrl, lessons = [], category } = req.body;

    if (!title || !description || !category) {
      return res
        .status(400)
        .json({ message: "Title, description, and category are required." });
    }

    // Refactor transaction logic
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Schema: courses table has instructor_id
      const [courseCheck] = await connection.query(
        "SELECT instructor_id FROM courses WHERE id = ?",
        [courseId]
      );
      if (courseCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Course not found." });
      }
      if (String(courseCheck[0].instructor_id) !== String(instructorIdFromToken)) {
        await connection.rollback();
        return res
          .status(403)
          .json({ message: "Forbidden: You do not own this course." });
      }

      // Use connection.query for transaction
      // Schema: courses table has image_url
      await connection.query(
        "UPDATE courses SET title = ?, description = ?, image_url = ?, category = ? WHERE id = ?",
        [title, description, imageUrl || null, category, courseId]
      );

      // Handle lessons update (delete and insert)
      // Schema: lessons table has course_id
      await connection.query("DELETE FROM lessons WHERE course_id = ?", [courseId]);
      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          // Schema: lessons table has course_id, title, type, content, lesson_order
          if (!lesson.title || !lesson.type || !lesson.content) {
            await connection.rollback();
            return res.status(400).json({
              message: `Invalid lesson data for lesson: \"${lesson.title || "Untitled"}\".`,
            });
          }
          await connection.query(
            "INSERT INTO lessons (course_id, title, type, content, lesson_order) VALUES (?, ?, ?, ?, ?)",
            [
              courseId,
              lesson.title,
              lesson.type,
              lesson.content,
              lesson.lesson_order || null,
            ]
          );
        }
      }
      await connection.commit();

      // Fetch updated course and lessons using the pool
      const [updatedCourse] = await pool.query(
        "SELECT * FROM courses WHERE id = ?",
        [courseId]
      );
      const [updatedLessons] = await pool.query(
        "SELECT * FROM lessons WHERE course_id = ?",
        [courseId]
      );
      res.json({ ...updatedCourse[0], lessons: updatedLessons });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Update course error:", error);
      res.status(500).json({ message: "Error updating course." });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.delete(
  "/api/courses/:courseId",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const { courseId } = req.params;
    const instructorIdFromToken = req.user.userId;

    // Refactor transaction logic
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Schema: courses table has instructor_id
      const [courseCheck] = await connection.query(
        "SELECT instructor_id FROM courses WHERE id = ?",
        [courseId]
      );
      if (courseCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Course not found." });
      }
      if (String(courseCheck[0].instructor_id) !== String(instructorIdFromToken)) {
        await connection.rollback();
        return res
          .status(403)
          .json({ message: "Forbidden: You do not own this course." });
      }

      // Delete related data first (using connection.query)
      // Schema: quizzes table has course_id
      const [quizIdsResult] = await connection.query(
        "SELECT id FROM quizzes WHERE course_id = ?",
        [courseId]
      );
      for (const row of quizIdsResult) {
        // Schema: quiz_questions table has quiz_id
        const [questionIdsResult] = await connection.query(
          "SELECT id FROM quiz_questions WHERE quiz_id = ?",
          [row.id]
        );
        for (const qRow of questionIdsResult) {
          // Schema: quiz_question_options table has question_id
          await connection.query(
            "DELETE FROM quiz_question_options WHERE question_id = ?",
            [qRow.id]
          );
        }
        await connection.query("DELETE FROM quiz_questions WHERE quiz_id = ?", [
          row.id,
        ]);
      }
      await connection.query("DELETE FROM quizzes WHERE course_id = ?", [courseId]);
      // Schema: lessons table has course_id
      await connection.query("DELETE FROM lessons WHERE course_id = ?", [courseId]);
      // Schema: UserEnrolledCourses table has course_id
      await connection.query("DELETE FROM UserEnrolledCourses WHERE course_id = ?", [
        courseId,
      ]);
      // Schema: QuizAttempts table has course_id
      await connection.query("DELETE FROM QuizAttempts WHERE course_id = ?", [
        courseId,
      ]);

      // Finally, delete the course
      const [deleteResult] = await connection.query(
        "DELETE FROM courses WHERE id = ?",
        [courseId]
      );

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return res
          .status(404)
          .json({ message: "Course not found during deletion." });
      }

      await connection.commit();
      res
        .status(200)
        .json({ message: "Course and all related data deleted successfully." });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Delete course error:", error);
      res.status(500).json({ message: "Error deleting course." });
    } finally {
      if (connection) connection.release();
    }
  }
);

// === Enrollment Management ===
app.post(
  "/api/enrollments",
  authenticateToken,
  authorizeRole(["student"]),
  async (req, res) => {
    const userId = req.user.userId;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required." });
    }

    try {
      // Check if course exists
      const [courses] = await pool.query("SELECT id FROM courses WHERE id = ?", [
        courseId,
      ]);
      if (courses.length === 0) {
        return res.status(404).json({ message: "Course not found." });
      }

      // Check if already enrolled
      // Schema: UserEnrolledCourses table has user_id, course_id
      const [existingEnrollment] = await pool.query(
        "SELECT course_id FROM UserEnrolledCourses WHERE user_id = ? AND course_id = ?",
        [userId, courseId]
      );
      if (existingEnrollment.length > 0) {
        return res.status(409).json({ message: "Already enrolled in this course." });
      }

      // Enroll the user
      // Schema: UserEnrolledCourses table has user_id, course_id, enrolled_at (default)
      await pool.query(
        "INSERT INTO UserEnrolledCourses (user_id, course_id) VALUES (?, ?)",
        [userId, courseId]
      );

      // Increment enrollment count
      // Schema: courses table has enrollment_count
      await pool.query(
        "UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = ?",
        [courseId]
      );

      res
        .status(201)
        .json({ success: true, message: "Successfully enrolled in course." });
    } catch (error) {
      console.error("Enrollment error:", error);
      res.status(500).json({ message: "Error enrolling in course." });
    }
  }
);

app.get(
  "/api/enrollments/my",
  authenticateToken,
  authorizeRole(["student"]),
  async (req, res) => {
    const userId = req.user.userId;
    try {
      // Schema: Join UserEnrolledCourses and courses on course_id, filter by user_id, order by enrolled_at
      const [enrolledCourses] = await pool.query(
        `SELECT c.*
             FROM UserEnrolledCourses uec
             JOIN courses c ON uec.course_id = c.id
             WHERE uec.user_id = ?
             ORDER BY uec.enrolled_at DESC`,
        [userId]
      );
      res.json(enrolledCourses);
    } catch (error) {
      console.error("Get my enrollments error:", error);
      res.status(500).json({ message: "Error fetching enrolled courses." });
    }
  }
);

// === Quiz Management ===
app.post(
  "/api/quizzes",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const instructorId = req.user.userId;
    const { title, courseId, questions = [] } = req.body;

    if (!title || !courseId) {
      return res
        .status(400)
        .json({ message: "Quiz title and course ID are required." });
    }

    // Refactor transaction logic
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Verify instructor owns the course
      // Schema: courses table has instructor_id
      const [courseCheck] = await connection.query(
        "SELECT instructor_id FROM courses WHERE id = ?",
        [courseId]
      );
      if (courseCheck.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Course not found." });
      }
      if (String(courseCheck[0].instructor_id) !== String(instructorId)) {
        await connection.rollback();
        return res.status(403).json({
          message: "Forbidden: You do not own the course this quiz belongs to.",
        });
      }

      // Create the quiz
      // Schema: quizzes table has title, course_id
      const [quizResult] = await connection.query(
        "INSERT INTO quizzes (title, course_id) VALUES (?, ?)",
        [title, courseId]
      );
      const quizId = quizResult.insertId;

      // Add questions and options
      if (questions && questions.length > 0) {
        for (const question of questions) {
          // Schema: quiz_questions table has quiz_id, text, type, question_order
          if (
            !question.text ||
            !question.type ||
            !question.options ||
            question.options.length === 0
          ) {
            await connection.rollback();
            return res.status(400).json({
              message: `Invalid data for question: \"${question.text || "Untitled"}\". Text, type, and options are required.`,
            });
          }
          const [questionResult] = await connection.query(
            "INSERT INTO quiz_questions (quiz_id, text, type, question_order) VALUES (?, ?, ?, ?)",
            [
              quizId,
              question.text,
              question.type,
              question.question_order || null,
            ]
          );
          const questionId = questionResult.insertId;

          let correctOptionFound = false;
          for (const option of question.options) {
            // Schema: quiz_question_options table has question_id, text, is_correct, option_order
            if (!option.text) {
              await connection.rollback();
              return res.status(400).json({
                message: `Invalid option data for question \"${question.text}\". Option text is required.`,
              });
            }
            const isCorrect = option.isCorrect ? 1 : 0;
            if (isCorrect) correctOptionFound = true;
            await connection.query(
              "INSERT INTO quiz_question_options (question_id, text, is_correct, option_order) VALUES (?, ?, ?, ?)",
              [
                questionId,
                option.text,
                isCorrect,
                option.option_order || null,
              ]
            );
          }
          // Basic validation: Ensure at least one correct option for MCQs
          if (question.type.toLowerCase() === "mcq" && !correctOptionFound) {
            await connection.rollback();
            return res.status(400).json({
              message: `Question \"${question.text}\" must have at least one correct option.`,
            });
          }
        }
      }

      await connection.commit();

      // Fetch the created quiz with questions and options
      const [createdQuiz] = await pool.query("SELECT * FROM quizzes WHERE id = ?", [
        quizId,
      ]);
      const [createdQuestions] = await pool.query(
        "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order, id",
        [quizId]
      );
      for (let q of createdQuestions) {
        const [options] = await pool.query(
          "SELECT * FROM quiz_question_options WHERE question_id = ? ORDER BY option_order, id",
          [q.id]
        );
        q.options = options;
      }

      res.status(201).json({ ...createdQuiz[0], questions: createdQuestions });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Create quiz error:", error);
      res.status(500).json({ message: "Error creating quiz." });
    } finally {
      if (connection) connection.release();
    }
  }
);

app.get("/api/quizzes/:quizId", async (req, res) => {
  const { quizId } = req.params;
  try {
    // Fetch quiz details
    const [quizzes] = await pool.query("SELECT * FROM quizzes WHERE id = ?", [
      quizId,
    ]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: "Quiz not found." });
    }
    const quiz = quizzes[0];

    // Fetch questions
    // Schema: quiz_questions table has quiz_id, question_order
    const [questions] = await pool.query(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order, id",
      [quizId]
    );

    // Fetch options for each question (excluding is_correct for students)
    for (let question of questions) {
      // Schema: quiz_question_options table has question_id, option_order
      const [options] = await pool.query(
        "SELECT id, question_id, text, option_order FROM quiz_question_options WHERE question_id = ? ORDER BY option_order, id",
        [question.id]
      );
      question.options = options;
    }

    quiz.questions = questions;
    res.json(quiz);
  } catch (error) {
    console.error("Get quiz by ID error:", error);
    res.status(500).json({ message: "Error fetching quiz details." });
  }
});

// TODO: Add PUT /api/quizzes/:quizId endpoint
// TODO: Add DELETE /api/quizzes/:quizId endpoint

// === Quiz Attempt Management ===
app.post("/api/quiz-attempts", authenticateToken, async (req, res) => {
  // Allow anonymous if isQuizWith is true
  const userId = req.user ? req.user.userId : null;
  const { quizId, courseId, answers, isQuizWith, playerNickname } = req.body;

  if (!quizId || !courseId || !answers) {
    return res
      .status(400)
      .json({ message: "Quiz ID, Course ID, and answers are required." });
  }
  if (isQuizWith && !playerNickname) {
    return res
      .status(400)
      .json({ message: "Player nickname is required for live quiz sessions." });
  }
  if (!isQuizWith && !userId) {
    // Re-check authenticateToken logic if anonymous access is needed here
    return res
      .status(401)
      .json({ message: "User authentication required for standard quiz attempts." });
  }

  try {
    // Fetch quiz and course titles
    // Schema: quizzes table has course_id, title
    const [quizzes] = await pool.query(
      "SELECT course_id, title FROM quizzes WHERE id = ?",
      [quizId]
    );
    if (quizzes.length === 0 || String(quizzes[0].course_id) !== String(courseId)) {
      return res
        .status(404)
        .json({ message: "Quiz not found or does not belong to the specified course." });
    }
    const quizTitle = quizzes[0].title;

    const [courses] = await pool.query("SELECT title FROM courses WHERE id = ?", [
      courseId,
    ]);
    const courseTitle = courses.length > 0 ? courses[0].title : null;

    // Fetch questions to calculate score
    // Schema: quiz_questions table has quiz_id
    const [questions] = await pool.query(
      "SELECT id FROM quiz_questions WHERE quiz_id = ?",
      [quizId]
    );
    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for this quiz." });
    }

    let score = 0;
    const totalQuestions = questions.length;

    for (const question of questions) {
      const submittedOptionId = answers[question.id];
      if (submittedOptionId) {
        // Schema: quiz_question_options table has question_id, is_correct
        const [correctOptions] = await pool.query(
          "SELECT id FROM quiz_question_options WHERE question_id = ? AND is_correct = 1",
          [question.id]
        );
        if (
          correctOptions.length > 0 &&
          String(correctOptions[0].id) === String(submittedOptionId)
        ) {
          score++;
        }
      }
    }

    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

    // Save the attempt
    // Schema: QuizAttempts table columns
    const [attemptResult] = await pool.query(
      `INSERT INTO QuizAttempts
             (quiz_id, course_id, user_id, score, total_questions, percentage, is_quiz_with, player_nickname, quiz_title, course_title)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // Use correct table name
      [
        quizId,
        courseId,
        userId,
        score,
        totalQuestions,
        percentage.toFixed(2),
        isQuizWith ? 1 : 0,
        playerNickname || null,
        quizTitle,
        courseTitle,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Quiz attempt submitted successfully.",
      attemptId: attemptResult.insertId,
      score,
      totalQuestions,
      percentage: percentage.toFixed(2),
    });
  } catch (error) {
    console.error("Submit quiz attempt error:", error);
    res.status(500).json({ message: "Error submitting quiz attempt." });
  }
});

app.get(
  "/api/quiz-attempts/my",
  authenticateToken,
  authorizeRole(["student"]),
  async (req, res) => {
    const userId = req.user.userId;
    try {
      // Schema: QuizAttempts table has user_id, taken_at
      const [attempts] = await pool.query(
        "SELECT * FROM QuizAttempts WHERE user_id = ? ORDER BY taken_at DESC",
        [userId]
      );
      res.json(attempts);
    } catch (error) {
      console.error("Get my quiz attempts error:", error);
      res.status(500).json({ message: "Error fetching quiz attempts." });
    }
  }
);

app.get(
  "/api/quiz-attempts/instructor",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const instructorId = req.user.userId;
    const { courseId, quizId } = req.query; // Optional filters

    try {
      // Schema: Join QuizAttempts and courses, filter by instructor_id
      let sql = `
            SELECT qa.*
            FROM QuizAttempts qa
            JOIN courses c ON qa.course_id = c.id
            WHERE c.instructor_id = ?
        `;
      const params = [instructorId];

      if (courseId) {
        sql += " AND qa.course_id = ?";
        params.push(courseId);
      }
      if (quizId) {
        sql += " AND qa.quiz_id = ?";
        params.push(quizId);
      }
      sql += " ORDER BY qa.taken_at DESC"; // Schema: QuizAttempts has taken_at

      const [attempts] = await pool.query(sql, params);
      res.json(attempts);
    } catch (error) {
      console.error("Get instructor quiz attempts error:", error);
      res.status(500).json({ message: "Error fetching quiz attempts for instructor." });
    }
  }
);

// === Live Quiz Session (ActiveQuizWithSessions) ===
app.post(
  "/api/live-quiz/host",
  authenticateToken,
  authorizeRole(["instructor"]),
  async (req, res) => {
    const hostUserId = req.user.userId;
    const { quizId } = req.body;

    if (!quizId) {
      return res.status(400).json({ message: "Quiz ID is required." });
    }

    try {
      // Fetch quiz details and verify ownership via course
      // Schema: Join quizzes and courses, filter by quiz id
      const [quizzes] = await pool.query(
        "SELECT q.title, q.course_id, c.instructor_id FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ?",
        [quizId]
      );
      if (quizzes.length === 0) {
        return res.status(404).json({ message: "Quiz not found." });
      }
      // Schema: courses table has instructor_id
      if (String(quizzes[0].instructor_id) !== String(hostUserId)) {
        return res
          .status(403)
          .json({ message: "Forbidden: You do not own the course for this quiz." });
      }
      const quizTitle = quizzes[0].title;
      const courseId = quizzes[0].course_id; // Schema: quizzes table has course_id

      // Generate a unique PIN
      const pin = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Schema: ActiveQuizWithSessions table columns
      const [result] = await pool.query(
        "INSERT INTO ActiveQuizWithSessions (pin, quiz_id, course_id, host_user_id, status, quiz_title) VALUES (?, ?, ?, ?, ?, ?)",
        [pin, quizId, courseId, hostUserId, "waiting", quizTitle]
      );

      res.status(201).json({
        success: true,
        message: "Live quiz session hosted successfully.",
        pin: pin,
        // sessionId: result.insertId // pin is likely the identifier needed
      });
    } catch (error) {
      console.error("Host live quiz error:", error);
      res.status(500).json({ message: "Error hosting live quiz session." });
    }
  }
);

app.get("/api/live-quiz/session/:pin", async (req, res) => {
  const { pin } = req.params;
  try {
    // Schema: ActiveQuizWithSessions table
    const [sessions] = await pool.query(
      "SELECT * FROM ActiveQuizWithSessions WHERE pin = ?",
      [pin]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ message: "Live quiz session not found." });
    }
    res.json(sessions[0]);
  } catch (error) {
    console.error("Get live quiz session error:", error);
    res.status(500).json({ message: "Error fetching live quiz session details." });
  }
});

// TODO: Add endpoints to manage session state (start quiz, next question, end quiz)
// TODO: Add endpoint for players to join
// TODO: Add endpoint for players to submit answers during a live session

// --- Server Start ---
app.listen(port, () => {
  console.log(`LearnSpark LMS backend server listening on port ${port}`);
});

