// backend/server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { Pool } = require('pg'); // Changed from mysql to pg
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection (PostgreSQL with pg Pool) ---
// Using individual parameters for the Pool configuration
const pool = new Pool({
  user: "postgres",
  host: "db.fxchazepzmplfforfcty.supabase.co",
  database: "postgres",
  password: "[Smsm@2103#2103]", // Raw password
  port: 5432,
  ssl: true // Enables SSL with default (rejectUnauthorized: true). Supabase requires SSL.
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client for initial connection test:', err.stack);
    process.exit(1); // Exit if DB connection fails at start
  }
  client.query('SELECT NOW()', (err, result) => {
    release(); // Release client
    if (err) {
      console.error('Error executing initial test query:', err.stack);
      process.exit(1);
    }
    console.log('Connected to PostgreSQL database! Server time:', result.rows[0].now);
  });
});


// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, userPayload) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res.status(403).json({ message: "Token is not valid or expired." });
    }
    req.user = userPayload; // userPayload contains { userId: number, role: string, username: string }
    next();
  });
};

const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: "Forbidden: Role information missing." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: `Forbidden: Access denied for role ${req.user.role}.` });
    }
    next();
  };
};

// --- API Endpoints ---

// === User Management ===
app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields (username, email, password, role) are required.' });
  }
  if (!['student', 'instructor', 'admin'].includes(role)) { // Added admin
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const existingUserResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, hashedPassword, role]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully.', 
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        role: result.rows[0].role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error creating user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const userResult = await pool.query('SELECT id, username, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const userDb = userResult.rows[0]; // Renamed to avoid conflict

    const match = await bcrypt.compare(password, userDb.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const userPayload = { userId: userDb.id, role: userDb.role, username: userDb.username };
    const accessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    res.json({ 
      token: accessToken, 
      user: { id: userDb.id, username: userDb.username, email: userDb.email, role: userDb.role } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const userResult = await pool.query('SELECT id, username, email, role, "createdat" AS "createdAt", "updatedat" AS "updatedAt" FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // Fetch enrolled course IDs
    const enrolledCoursesResult = await pool.query('SELECT "courseid" AS "courseId" FROM enrollments WHERE "userid" = $1', [userId]);
    const createdCoursesResult = await pool.query('SELECT id AS "courseId" FROM courses WHERE "instructorid" = $1', [userId]);

    const user = {
        ...userResult.rows[0],
        enrolledCourseIds: enrolledCoursesResult.rows.map(r => r.courseId),
        createdCourseIds: createdCoursesResult.rows.map(r => r.courseId),
    };
    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Error fetching user profile.' });
  }
});


// === Course Management ===
app.post('/api/courses', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorId = req.user.userId;
  const instructorName = req.user.username; // Assuming username is in token payload
  const { title, description, imageUrl, lessons = [], category } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ message: 'Title, description, and category are required.'});
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const courseResult = await client.query(
      `INSERT INTO courses (title, description, "instructorid", "instructorname", "imageurl", category, rating, "enrollmentcount", "createdat", "updatedat") 
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0, NOW(), NOW()) 
       RETURNING id, title, description, "instructorid" AS "instructorId", "instructorname" AS "instructorName", "imageurl" AS "imageUrl", category, rating, "enrollmentcount" AS "enrollmentCount", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`,
      [title, description, instructorId, instructorName, imageUrl || null, category]
    );
    const course = courseResult.rows[0];

    const createdLessons = [];
    if (lessons && lessons.length > 0) {
      for (const lesson of lessons) {
        if (!lesson.title || !lesson.type || !lesson.content) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Invalid lesson data for lesson: "${lesson.title || 'Untitled'}".`});
        }
        const lessonResult = await client.query(
          `INSERT INTO lessons ("courseid", title, type, content, "orderindex", "createdat", "updatedat") 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
           RETURNING id, "courseid" AS "courseId", title, type, content, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`, 
          [course.id, lesson.title, lesson.type, lesson.content, lesson.orderIndex || 0]
        );
        createdLessons.push(lessonResult.rows[0]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({...course, lessons: createdLessons, quizIds: [] }); // quizIds will be empty for new course
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Error creating course.' });
  } finally {
    client.release();
  }
});

app.get('/api/courses', async (req, res) => {
  try {
    const courseResult = await pool.query(
      `SELECT id, title, description, "instructorid" AS "instructorId", "instructorname" AS "instructorName", "imageurl" AS "imageUrl", category, rating, "enrollmentcount" AS "enrollmentCount", "createdat" AS "createdAt", "updatedat" AS "updatedAt" 
       FROM courses ORDER BY "createdat" DESC`
    );
    // For list view, lessons and quizIds might be omitted or fetched minimally
    res.json(courseResult.rows.map(course => ({...course, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Error fetching courses.' });
  }
});

app.get('/api/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  try {
    const courseResults = await pool.query(
        `SELECT id, title, description, "instructorid" AS "instructorId", "instructorname" AS "instructorName", "imageurl" AS "imageUrl", category, rating, "enrollmentcount" AS "enrollmentCount", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
         FROM courses WHERE id = $1`, [courseId]);
    if (courseResults.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const course = courseResults.rows[0];
    const lessonsResult = await pool.query(
        `SELECT id, "courseid" AS "courseId", title, type, content, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
         FROM lessons WHERE "courseid" = $1 ORDER BY "orderindex", id`, [courseId]);
    const quizResults = await pool.query(
        `SELECT id, title FROM quizzes WHERE "courseid" = $1 ORDER BY "createdat"`, [courseId]);
    
    course.lessons = lessonsResult.rows;
    course.quizIds = quizResults.rows.map(q => q.id); // quizIds is an array of numbers
    res.json(course);
  } catch (error) {
    console.error('Get course by ID error:', error);
    res.status(500).json({ message: 'Error fetching course details.' });
  }
});

app.put('/api/courses/:courseId', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const { courseId } = req.params;
  const instructorIdFromToken = req.user.userId;
  const { title, description, imageUrl, lessons = [], category } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ message: 'Title, description, and category are required.'});
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const courseCheckResult = await client.query('SELECT "instructorid" FROM courses WHERE id = $1', [courseId]);
    if (courseCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Course not found.' });
    }
    if (courseCheckResult.rows[0].instructorid !== instructorIdFromToken) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
    }

    await client.query(
      'UPDATE courses SET title = $1, description = $2, "imageurl" = $3, category = $4, "updatedat" = NOW() WHERE id = $5',
      [title, description, imageUrl || null, category, courseId]
    );
    
    await client.query('DELETE FROM lessons WHERE "courseid" = $1', [courseId]); // Changed courseId to "courseid"
    const updatedLessonsDb = []; // Renamed to avoid conflict
    if (lessons && lessons.length > 0) {
      for (const lesson of lessons) {
        if (!lesson.title || !lesson.type || !lesson.content) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Invalid lesson data for lesson: "${lesson.title || 'Untitled'}".` });
        }
        const lessonResult = await client.query(
          `INSERT INTO lessons ("courseid", title, type, content, "orderindex", "createdat", "updatedat") 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
           RETURNING id, "courseid" AS "courseId", title, type, content, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`,
          [courseId, lesson.title, lesson.type, lesson.content, lesson.orderIndex || 0]
        );
        updatedLessonsDb.push(lessonResult.rows[0]);
      }
    }
    await client.query('COMMIT');
    
    // Fetch the fully updated course to return
    const finalCourseResult = await client.query(
        `SELECT id, title, description, "instructorid" AS "instructorId", "instructorname" AS "instructorName", "imageurl" AS "imageUrl", category, rating, "enrollmentcount" AS "enrollmentCount", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
         FROM courses WHERE id = $1`, [courseId]);
    const finalQuizResults = await client.query('SELECT id FROM quizzes WHERE "courseid" = $1', [courseId]);

    res.json({...finalCourseResult.rows[0], lessons: updatedLessonsDb, quizIds: finalQuizResults.rows.map(q => q.id)});

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Error updating course.' });
  } finally {
    client.release();
  }
});

app.post('/api/courses/:courseId/lessons', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const { courseId } = req.params;
  const instructorIdFromToken = req.user.userId;
  const { title, type, content, orderIndex } = req.body;

  if (!title || !type || !content) {
    return res.status(400).json({ message: 'Lesson title, type, and content are required.' });
  }
  try {
    const courseCheckResult = await pool.query('SELECT "instructorid" FROM courses WHERE id = $1', [courseId]);
    if (courseCheckResult.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    if (courseCheckResult.rows[0].instructorid !== instructorIdFromToken) {
      return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
    }
    const result = await pool.query(
      `INSERT INTO lessons ("courseid", title, type, content, "orderindex", "createdat", "updatedat") 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
       RETURNING id, "courseid" AS "courseId", title, type, content, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`,
      [courseId, title, type, content, orderIndex || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add lesson error:', error);
    res.status(500).json({ message: 'Error adding lesson.' });
  }
});


// === Enrollment ===
app.post('/api/courses/:courseId/enroll', authenticateToken, authorizeRole(['student']), async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.userId;
  try {
    const courseExistsResult = await pool.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if(courseExistsResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    await pool.query('INSERT INTO enrollments ("userid", "courseid", "enrolledat") VALUES ($1, $2, NOW())', [userId, courseId]);
    await pool.query('UPDATE courses SET "enrollmentcount" = "enrollmentcount" + 1 WHERE id = $1', [courseId]);
    res.json({ success: true, message: 'Successfully enrolled!' });
  } catch (error) {
    if (error.code === '23505') { 
        return res.status(409).json({ success: false, message: 'Already enrolled in this course.' });
    }
    console.error('Enrollment error:', error);
    res.status(500).json({ success: false, message: 'Error enrolling in course.' });
  }
});

app.get('/api/users/me/enrolled-courses', authenticateToken, authorizeRole(['student', 'admin']), async (req, res) => {
  const userId = req.user.userId;
  try {
    const coursesResult = await pool.query(
      `SELECT c.id, c.title, c.description, c."instructorid" AS "instructorId", c."instructorname" AS "instructorName", c."imageurl" AS "imageUrl", c.category, c.rating, c."enrollmentcount" AS "enrollmentCount", c."createdat" AS "createdAt", c."updatedat" AS "updatedAt"
       FROM courses c JOIN enrollments e ON c.id = e."courseid" WHERE e."userid" = $1 ORDER BY e."enrolledat" DESC`, 
      [userId]
    );
    res.json(coursesResult.rows.map(c => ({...c, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({ message: 'Error fetching enrolled courses.' });
  }
});

app.get('/api/users/me/created-courses', authenticateToken, authorizeRole(['instructor', 'admin']), async (req, res) => {
  const instructorId = req.user.userId;
  try {
    const coursesResult = await pool.query(
        `SELECT id, title, description, "instructorid" AS "instructorId", "instructorname" AS "instructorName", "imageurl" AS "imageUrl", category, rating, "enrollmentcount" AS "enrollmentCount", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
         FROM courses WHERE "instructorid" = $1 ORDER BY "createdat" DESC`, [instructorId]);
    res.json(coursesResult.rows.map(c => ({...c, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get created courses error:', error);
    res.status(500).json({ message: 'Error fetching created courses.' });
  }
});

// === Quiz Management ===
app.post('/api/quizzes', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorIdFromToken = req.user.userId;
  const { title, courseId, questions } = req.body;

  if (!title || !courseId || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'Quiz title, courseId, and at least one question are required.' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const courseCheckResult = await client.query('SELECT "instructorid" FROM courses WHERE id = $1', [courseId]);
    if (courseCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Course not found.' });
    }
    if (courseCheckResult.rows[0].instructorid !== instructorIdFromToken) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Forbidden: You do not own the course for this quiz.' });
    }

    const quizResult = await client.query(
      `INSERT INTO quizzes (title, "courseid", "createdat", "updatedat") VALUES ($1, $2, NOW(), NOW()) 
       RETURNING id, title, "courseid" AS "courseId", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`, 
      [title, courseId]
    );
    const quiz = quizResult.rows[0];
    const createdQuestionsDb = []; // Renamed

    for (const q of questions) {
      if (!q.text || !q.options || !Array.isArray(q.options) || q.options.length < 2 || !q.options.some(opt => opt.isCorrect)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Invalid question data for: "${q.text || 'Untitled Question'}".`});
      }
      const questionResult = await client.query(
        `INSERT INTO quiz_questions ("quizid", text, type, "orderindex", "createdat", "updatedat") VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING id, "quizid" AS "quizId", text, type, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`, 
        [quiz.id, q.text, q.type || 'mcq', q.orderIndex || 0]
      );
      const question = questionResult.rows[0];
      const createdOptionsDb = []; // Renamed

      for (const opt of q.options) {
        if (opt.text === undefined || opt.isCorrect === undefined) { // Check for undefined explicitly
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Invalid option data for question: "${q.text}".`});
        }
        const optionResult = await client.query(
          `INSERT INTO quiz_options ("questionid", text, "iscorrect", "createdat", "updatedat") VALUES ($1, $2, $3, NOW(), NOW()) 
           RETURNING id, "questionid" AS "questionId", text, "iscorrect" AS "isCorrect", "createdat" AS "createdAt", "updatedat" AS "updatedAt"`,
          [question.id, opt.text, opt.isCorrect]
        );
        createdOptionsDb.push(optionResult.rows[0]);
      }
      createdQuestionsDb.push({...question, options: createdOptionsDb});
    }
    await client.query('COMMIT');
    res.status(201).json({...quiz, questions: createdQuestionsDb});
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create quiz error:', error);
    res.status(500).json({ message: 'Error creating quiz.' });
  } finally {
    client.release();
  }
});

app.get('/api/quizzes/:quizId', async (req, res) => {
  const { quizId } = req.params;
  try {
    const quizResults = await pool.query(
        `SELECT id, title, "courseid" AS "courseId", "createdat" AS "createdAt", "updatedat" AS "updatedAt" 
         FROM quizzes WHERE id = $1`, [quizId]);
    if (quizResults.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    const quiz = quizResults.rows[0];
    const questionsRawResult = await pool.query(
        `SELECT id, "quizid" AS "quizId", text, type, "orderindex" AS "orderIndex", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
         FROM quiz_questions WHERE "quizid" = $1 ORDER BY "orderindex", id`, [quizId]);
    const questions = [];
    for (const qRaw of questionsRawResult.rows) {
      const optionsResult = await pool.query(
          `SELECT id, "questionid" AS "questionId", text, "iscorrect" AS "isCorrect", "createdat" AS "createdAt", "updatedat" AS "updatedAt"
           FROM quiz_options WHERE "questionid" = $1 ORDER BY id`, [qRaw.id]);
      questions.push({ ...qRaw, options: optionsResult.rows });
    }
    quiz.questions = questions;
    res.json(quiz);
  } catch (error) {
    console.error('Get quiz by ID error:', error);
    res.status(500).json({ message: 'Error fetching quiz details.' });
  }
});

app.get('/api/courses/:courseId/quizzes', async (req, res) => {
  const { courseId } = req.params;
  try {
    // Fetch full quiz details if needed, or just IDs/titles for a list
    const quizzesResult = await pool.query(
        `SELECT q.id, q.title, q."courseid" AS "courseId", q."createdat" AS "createdAt", q."updatedat" AS "updatedAt"
         FROM quizzes q WHERE q."courseid" = $1 ORDER BY q."createdat"`, [courseId]);
    
    const quizzesWithQuestions = [];
    for (const quiz of quizzesResult.rows) {
        const questionsRawResult = await pool.query(
            `SELECT id, "quizid" AS "quizId", text, type, "orderindex" AS "orderIndex"
             FROM quiz_questions WHERE "quizid" = $1 ORDER BY "orderindex", id`, [quiz.id]);
        const questions = [];
        for (const qRaw of questionsRawResult.rows) {
            const optionsResult = await pool.query(
                `SELECT id, "questionid" AS "questionId", text, "iscorrect" AS "isCorrect"
                 FROM quiz_options WHERE "questionid" = $1 ORDER BY id`, [qRaw.id]);
            questions.push({ ...qRaw, options: optionsResult.rows });
        }
        quizzesWithQuestions.push({...quiz, questions: questions});
    }
    res.json(quizzesWithQuestions);
  } catch (error) {
    console.error('Get quizzes for course error:', error);
    res.status(500).json({ message: 'Error fetching quizzes for course.' });
  }
});


// === Quiz Attempts & Reports ===
app.post('/api/quiz-attempts', authenticateToken, async (req, res) => {
  const { playerNickname, quizId, courseId, score, totalQuestions, isQuizWith } = req.body;
  // userId might be null if it's a QuizWith guest attempt but token is for a logged-in user (e.g. instructor testing)
  // So, rely on req.user if available and !isQuizWith or if isQuizWith and no nickname provided by a logged-in user
  let finalUserId = null;
  if (req.user && req.user.userId) {
      finalUserId = req.user.userId;
  }
  
  if (quizId === undefined || courseId === undefined || score === undefined || totalQuestions === undefined || isQuizWith === undefined) {
    return res.status(400).json({ message: "Missing required fields for quiz attempt." });
  }
  // If it's a QuizWith game and no nickname is provided by a guest (non-logged-in user), it's an error.
  // If a logged-in user is playing QuizWith, nickname might be optional or same as username.
  if (isQuizWith && !playerNickname && !finalUserId) {
      return res.status(400).json({ message: "Nickname required for QuizWith guest attempts if not logged in." });
  }
  // If it's NOT QuizWith, user MUST be logged in.
  if (!isQuizWith && !finalUserId) {
    return res.status(401).json({ message: "User must be logged in to submit regular quiz attempts." });
  }

  // Determine userId for DB: if QuizWith, it could be null for guests. Otherwise, it's the logged-in user.
  const dbUserId = isQuizWith ? (finalUserId || null) : finalUserId;
  const dbPlayerNickname = isQuizWith ? (playerNickname || (req.user ? req.user.username : null)) : null;


  const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

  try {
    const attemptResult = await pool.query(
      `INSERT INTO quiz_attempts ("userid", "playernickname", "quizid", "courseid", score, "totalquestions", percentage, "takenat", "isquizwith") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8) 
       RETURNING id, "takenat" AS "takenAt"`,
      [dbUserId, dbPlayerNickname, quizId, courseId, score, totalQuestions, percentage, isQuizWith]
    );
    const courseDataResult = await pool.query('SELECT title from courses WHERE id = $1', [courseId]);
    const quizDataResult = await pool.query('SELECT title from quizzes WHERE id = $1', [quizId]);

    res.status(201).json({ 
        id: attemptResult.rows[0].id, 
        userId: dbUserId, 
        playerNickname: dbPlayerNickname, 
        quizId, 
        quizTitle: quizDataResult.rows.length ? quizDataResult.rows[0].title : 'N/A',
        courseId, 
        courseTitle: courseDataResult.rows.length ? courseDataResult.rows[0].title : 'N/A',
        score, 
        totalQuestions, 
        percentage, 
        isQuizWith, 
        takenAt: attemptResult.rows[0].takenAt 
    });
  } catch (error) {
    console.error('Submit quiz score error:', error);
    res.status(500).json({ message: 'Error submitting quiz score.' });
  }
});

app.get('/api/users/me/quiz-attempts', authenticateToken, authorizeRole(['student', 'instructor', 'admin']), async (req, res) => {
  const userId = req.user.userId;
  try {
    const attemptsResult = await pool.query(
      `SELECT qa.id, qa."userid" AS "userId", qa."playernickname" AS "playerNickname", 
              qa."quizid" AS "quizId", qa."courseid" AS "courseId", qa.score, qa."totalquestions" AS "totalQuestions", 
              qa.percentage, qa."takenat" AS "takenAt", qa."isquizwith" AS "isQuizWith",
              q.title AS "quizTitle", c.title AS "courseTitle"
       FROM quiz_attempts qa
       JOIN quizzes q ON qa."quizid" = q.id
       JOIN courses c ON qa."courseid" = c.id
       WHERE qa."userid" = $1 AND qa."isquizwith" = false
       ORDER BY qa."takenat" DESC`, 
      [userId]
    );
    res.json(attemptsResult.rows);
  } catch (error) {
    console.error('Get user quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching user quiz attempts.' });
  }
});

app.get('/api/instructors/me/quizzes', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
    const instructorId = req.user.userId;
    try {
        const quizzesResult = await pool.query(
          `SELECT q.id, q.title, q."courseid" AS "courseId", q."createdat" AS "createdAt", q."updatedat" AS "updatedAt" 
           FROM quizzes q 
           JOIN courses c ON q."courseid" = c.id 
           WHERE c."instructorid" = $1 
           ORDER BY q."createdat" DESC`, 
          [instructorId]
        );
        res.json(quizzesResult.rows);
    } catch (error) {
        console.error('Get quizzes for instructor error:', error);
        res.status(500).json({ message: 'Error fetching quizzes for instructor.' });
    }
});

app.get('/api/instructors/me/quiz-attempts', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorId = req.user.userId;
  try {
    const attemptsResult = await pool.query(
      `SELECT qa.id, qa."userid" AS "userId", qa."playernickname" AS "playerNickname", 
              qa."quizid" AS "quizId", qa."courseid" AS "courseId", qa.score, qa."totalquestions" AS "totalQuestions", 
              qa.percentage, qa."takenat" AS "takenAt", qa."isquizwith" AS "isQuizWith",
              q.title AS "quizTitle", c.title AS "courseTitle", 
              u.username AS "studentUsername", u.email AS "studentEmail"
       FROM quiz_attempts qa
       JOIN quizzes q ON qa."quizid" = q.id
       JOIN courses c ON qa."courseid" = c.id
       LEFT JOIN users u ON qa."userid" = u.id 
       WHERE c."instructorid" = $1
       ORDER BY qa."takenat" DESC`,
      [instructorId]
    );
    res.json(attemptsResult.rows);
  } catch (error) {
    console.error('Get instructor quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching instructor quiz attempts for their courses.' });
  }
});


// === QuizWith (Kahoot-style) Functionality ===
app.post('/api/quizwith/host', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const hostUserId = req.user.userId;
  const { quizId } = req.body; // quizId is a number

  if (!quizId) return res.status(400).json({ message: "Quiz ID is required." });

  try {
    const quizCheckResult = await pool.query(
      `SELECT q.id, q.title, c."instructorid" AS "instructorId"
       FROM quizzes q 
       JOIN courses c ON q."courseid" = c.id 
       WHERE q.id = $1`, [quizId]);
       
    if (quizCheckResult.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    if (quizCheckResult.rows[0].instructorId !== hostUserId) {
      return res.status(403).json({ message: 'Forbidden: You do not own the course this quiz belongs to.' });
    }
    const questionsExistResult = await pool.query('SELECT id FROM quiz_questions WHERE "quizid" = $1 LIMIT 1', [quizId]);
    if (questionsExistResult.rows.length === 0) {
      return res.status(400).json({ message: 'Cannot host QuizWith: The selected quiz has no questions.' });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await pool.query(
      `INSERT INTO quizwith_sessions (pin, "quizid", "hostuserid", status, "createdat", "updatedat") 
       VALUES ($1, $2, $3, 'waiting', NOW(), NOW()) 
       RETURNING id AS "sessionId"`,
      [pin, quizId, hostUserId]
    );
    res.json({ pin, sessionId: result.rows[0].sessionId }); // sessionId is a number
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'quizwith_sessions_pin_key') { 
        return res.status(500).json({ message: 'Error hosting QuizWith session due to PIN conflict. Please try again.' });
    }
    console.error('Host QuizWith session error:', error);
    res.status(500).json({ message: 'Error hosting QuizWith session.' });
  }
});

app.post('/api/quizwith/join', async (req, res) => {
  const { pin, nickname } = req.body;
  if (!pin || !nickname) {
    return res.status(400).json({ success: false, message: 'PIN and nickname are required.' });
  }
  try {
    const sessionsResult = await pool.query(
      `SELECT s.id AS "sessionId", s."quizid" AS "quizId", q."courseid" AS "courseId", s.status 
       FROM quizwith_sessions s
       JOIN quizzes q ON s."quizid" = q.id
       WHERE s.pin = $1`, [pin.toUpperCase()]
    );
    if (sessionsResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid PIN.' });
    }
    const session = sessionsResult.rows[0]; // All IDs are numbers now
    if (session.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'This QuizWith session is not currently accepting new players.' });
    }
    
    res.json({ 
      success: true, 
      message: 'Joined successfully!', 
      quizId: session.quizId, 
      courseId: session.courseId, 
      sessionId: session.sessionId 
    });
  } catch (error) {
    console.error('Join QuizWith session error:', error);
    res.status(500).json({ success: false, message: 'Error joining QuizWith session.' });
  }
});

app.get('/api/quizwith/sessions/:pin', async (req, res) => {
  const { pin } = req.params;
  try {
    const sessionsResult = await pool.query(
      `SELECT s.id AS "sessionId", s.pin, s."quizid" AS "quizId", s."hostuserid" AS "hostUserId", 
              s.status, s."createdat" AS "createdAt", s."updatedat" AS "updatedAt",
              q.title AS "quizTitle", q."courseid" AS "courseId"
       FROM quizwith_sessions s 
       JOIN quizzes q ON s."quizid" = q.id 
       WHERE s.pin = $1`, [pin.toUpperCase()]
    );
    if (sessionsResult.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    res.json(sessionsResult.rows[0]);
  } catch (error) {
    console.error('Get QuizWith session error:', error);
    res.status(500).json({ message: 'Error fetching QuizWith session details.' });
  }
});


// --- Server Listening ---
app.listen(port, () => {
  console.log(`LearnSpark LMS backend server listening on port ${port}`);
});