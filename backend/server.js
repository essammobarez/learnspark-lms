// backend/server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Using bcryptjs for easier installation
const util = require('util');

const app = express();
const port = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // Configure CORS appropriately for production
app.use(express.json()); // To parse JSON request bodies

// --- Database Connection ---
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  socketPath: process.env.DB_SOCKET_PATH // Can be null or undefined if not using socket
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    // For a production app, you might want to exit or implement a retry mechanism
    process.exit(1); // Exit if DB connection fails at start
  }
  console.log('Connected to MySQL database!');
});

// Promisify connection.query for async/await usage
const query = util.promisify(connection.query).bind(connection);

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if there isn't any token

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, userPayload) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res.status(403).json({ message: "Token is not valid or expired." }); // if token is no longer valid
    }
    req.user = userPayload; // Add user payload (e.g., { userId, role }) to request object
    next(); // pass the execution off to whatever request the client intended
  });
};

// Helper function for authorization based on role
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
  // Basic validation
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields (username, email, password, role) are required.' });
  }
  if (!['student', 'instructor'].includes(role)) { // Assuming admin role is not self-signup
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' }); // 409 Conflict
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds = 10
    const result = await query('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)', 
      [username, email, hashedPassword, role]);
    
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully.', 
      user: { id: result.insertId, username, email, role } 
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
    const users = await query('SELECT id, username, email, password_hash, role FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const user = users[0];

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const userPayload = { userId: user.id, role: user.role, username: user.username };
    const accessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' }); // Example: token expires in 1 hour
    // TODO: Implement refresh tokens for a more robust auth system

    res.json({ 
      token: accessToken, 
      user: { id: user.id, username: user.username, email: user.email, role: user.role } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const users = await query('SELECT id, username, email, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Error fetching user profile.' });
  }
});

app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const { userId: paramUserId } = req.params;
  const updates = req.body; // e.g., { username, email } - handle password updates separately with care
  const loggedInUserId = req.user.userId;
  const loggedInUserRole = req.user.role;

  // Authorization: User can update their own profile, or an admin can update any.
  if (loggedInUserId !== parseInt(paramUserId) && loggedInUserRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
  }

  // Basic validation (expand as needed)
  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
     // Check if new email is already taken by another user
    const existingUser = await query('SELECT id FROM users WHERE email = ? AND id != ?', [updates.email, paramUserId]);
    if (existingUser.length > 0) {
        return res.status(409).json({ message: 'Email already in use by another account.' });
    }
  }
  if (updates.username && updates.username.trim() === '') {
    return res.status(400).json({ message: 'Username cannot be empty.'});
  }


  try {
    // Construct SET clause dynamically based on provided updates
    const allowedUpdates = ['username', 'email']; // Add other updatable fields
    const setClauses = [];
    const values = [];
    for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
            setClauses.push(`${key} = ?`);
            values.push(updates[key]);
        }
    }
    if (setClauses.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }
    values.push(paramUserId); // For WHERE id = ?

    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await query(sql, values);

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found or no changes made.' });
    }
    
    const updatedUser = await query('SELECT id, username, email, role FROM users WHERE id = ?', [paramUserId]);
    res.json({ message: 'User profile updated successfully.', user: updatedUser[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user profile.' });
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

  // Use a transaction to ensure atomicity for course and lessons creation
  connection.beginTransaction(async (err) => {
    if (err) { 
        console.error('Transaction Begin Error:', err);
        return res.status(500).json({ message: 'Error starting transaction for course creation.' });
    }
    try {
      const courseResult = await query(
        'INSERT INTO courses (title, description, instructorId, instructorName, imageUrl, category, rating, enrollmentCount) VALUES (?, ?, ?, ?, ?, 0, 0)',
        [title, description, instructorId, instructorName, imageUrl || null, category]
      );
      const courseId = courseResult.insertId;

      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          if (!lesson.title || !lesson.type || !lesson.content) {
            // Rollback if a lesson is invalid
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid lesson data provided for lesson titled "${lesson.title || 'Untitled'}". Title, type, and content are required.`});
          }
          await query('INSERT INTO lessons (courseId, title, type, content) VALUES (?, ?, ?, ?)', 
            [courseId, lesson.title, lesson.type, lesson.content]);
        }
      }
      await query('COMMIT');
      const createdCourse = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
      // Fetch lessons separately if needed for the response
      const createdLessons = await query('SELECT * FROM lessons WHERE courseId = ?', [courseId]);
      res.status(201).json({...createdCourse[0], lessons: createdLessons, quizIds: [] });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Create course error (transaction rolled back):', error);
      res.status(500).json({ message: 'Error creating course.' });
    }
  });
});

app.get('/api/courses', async (req, res) => {
  try {
    const courses = await query('SELECT * FROM courses ORDER BY createdAt DESC');
    // For a full list, you might not fetch all lessons/quizzes to avoid N+1 queries or large responses.
    // The client can fetch details on demand. Here, we'll return basic course info.
    res.json(courses.map(course => ({...course, lessons: [], quizIds: []}))); // Keep structure consistent
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Error fetching courses.' });
  }
});

app.get('/api/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  try {
    const courseResults = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (courseResults.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const course = courseResults[0];
    const lessons = await query('SELECT * FROM lessons WHERE courseId = ? ORDER BY orderIndex, id', [courseId]);
    const quizResults = await query('SELECT id, title FROM quizzes WHERE courseId = ? ORDER BY createdAt', [courseId]);
    
    course.lessons = lessons;
    course.quizIds = quizResults.map(q => q.id); // Store just IDs, or full quiz titles if preferred
    // To include full quiz objects (careful with response size):
    // course.quizzes = quizResults; 

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

  connection.beginTransaction(async (err) => {
    if (err) { 
        console.error('Transaction Begin Error:', err);
        return res.status(500).json({ message: 'Error starting transaction for course update.' });
    }
    try {
      const courseCheck = await query('SELECT instructorId FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructorId !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
      }

      await query('UPDATE courses SET title = ?, description = ?, imageUrl = ?, category = ? WHERE id = ?',
        [title, description, imageUrl || null, category, courseId]);
      
      // Handle lessons update: simple approach - delete existing and insert new ones.
      // More complex scenarios might involve diffing, updating existing, etc.
      await query('DELETE FROM lessons WHERE courseId = ?', [courseId]);
      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          if (!lesson.title || !lesson.type || !lesson.content) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid lesson data for lesson: "${lesson.title || 'Untitled'}".` });
          }
          await query('INSERT INTO lessons (courseId, title, type, content) VALUES (?, ?, ?, ?)',
            [courseId, lesson.title, lesson.type, lesson.content]);
        }
      }
      await query('COMMIT');
      const updatedCourse = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
      const updatedLessons = await query('SELECT * FROM lessons WHERE courseId = ?', [courseId]);
      res.json({...updatedCourse[0], lessons: updatedLessons});
    } catch (error) {
      await query('ROLLBACK');
      console.error('Update course error (transaction rolled back):', error);
      res.status(500).json({ message: 'Error updating course.' });
    }
  });
});

app.delete('/api/courses/:courseId', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const { courseId } = req.params;
  const instructorIdFromToken = req.user.userId;

  connection.beginTransaction(async (err) => {
    if (err) { return res.status(500).json({ message: 'Error starting transaction for course deletion.' }); }
    try {
      const courseCheck = await query('SELECT instructorId FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructorId !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
      }
      
      // Assuming cascading deletes are set up in DB for quiz_options from quiz_questions, etc.
      // Or delete them explicitly:
      const quizIdsResult = await query('SELECT id FROM quizzes WHERE courseId = ?', [courseId]);
      for (const row of quizIdsResult) {
        const questionIdsResult = await query('SELECT id FROM quiz_questions WHERE quizId = ?', [row.id]);
        for (const qRow of questionIdsResult) {
            await query('DELETE FROM quiz_options WHERE questionId = ?', [qRow.id]);
        }
        await query('DELETE FROM quiz_questions WHERE quizId = ?', [row.id]);
      }
      await query('DELETE FROM quizzes WHERE courseId = ?', [courseId]);
      await query('DELETE FROM lessons WHERE courseId = ?', [courseId]);
      await query('DELETE FROM enrollments WHERE courseId = ?', [courseId]);
      await query('DELETE FROM quiz_attempts WHERE courseId = ?', [courseId]); 
      // Add deletion from quizwith_sessions if a course deletion should also delete its games
      
      const deleteResult = await query('DELETE FROM courses WHERE id = ?', [courseId]);
      if (deleteResult.affectedRows === 0) {
        await query('ROLLBACK'); // Should not happen if previous checks passed
        return res.status(404).json({ message: 'Course not found during deletion.' });
      }
      
      await query('COMMIT');
      res.status(204).send(); // No content
    } catch (error) {
      await query('ROLLBACK');
      console.error('Delete course error:', error);
      res.status(500).json({ message: 'Error deleting course.' });
    }
  });
});

app.post('/api/courses/:courseId/lessons', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const { courseId } = req.params;
  const instructorIdFromToken = req.user.userId;
  const { title, type, content } = req.body;

  if (!title || !type || !content) {
    return res.status(400).json({ message: 'Lesson title, type, and content are required.' });
  }
  try {
    const courseCheck = await query('SELECT instructorId FROM courses WHERE id = ?', [courseId]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    if (courseCheck[0].instructorId !== instructorIdFromToken) {
      return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
    }
    const result = await query('INSERT INTO lessons (courseId, title, type, content) VALUES (?, ?, ?, ?)',
      [courseId, title, type, content]);
    res.status(201).json({ id: result.insertId, courseId, title, type, content });
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
    const courseExists = await query('SELECT id FROM courses WHERE id = ?', [courseId]);
    if(courseExists.length === 0) {
        return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    const alreadyEnrolled = await query('SELECT id FROM enrollments WHERE userId = ? AND courseId = ?', [userId, courseId]);
    if (alreadyEnrolled.length > 0) {
      return res.status(409).json({ success: false, message: 'Already enrolled in this course.' });
    }
    await query('INSERT INTO enrollments (userId, courseId, enrolledAt) VALUES (?, ?, NOW())', [userId, courseId]);
    await query('UPDATE courses SET enrollmentCount = enrollmentCount + 1 WHERE id = ?', [courseId]);
    res.json({ success: true, message: 'Successfully enrolled!' });
  } catch (error) {
    console.error('Enrollment error:', error);
    if (error.code === 'ER_DUP_ENTRY') { // Catch unique constraint violation if any
        return res.status(409).json({ success: false, message: 'Already enrolled (duplicate entry).' });
    }
    res.status(500).json({ success: false, message: 'Error enrolling in course.' });
  }
});

app.get('/api/users/me/enrolled-courses', authenticateToken, authorizeRole(['student']), async (req, res) => {
  const userId = req.user.userId;
  try {
    const courses = await query(
      'SELECT c.* FROM courses c JOIN enrollments e ON c.id = e.courseId WHERE e.userId = ? ORDER BY e.enrolledAt DESC', 
      [userId]
    );
    // Consistent with other course fetching, add empty lessons/quizIds if not fetching full details here
    res.json(courses.map(c => ({...c, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({ message: 'Error fetching enrolled courses.' });
  }
});

app.get('/api/users/me/created-courses', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorId = req.user.userId;
  try {
    const courses = await query('SELECT * FROM courses WHERE instructorId = ? ORDER BY createdAt DESC', [instructorId]);
    res.json(courses.map(c => ({...c, lessons: [], quizIds: []})));
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
  
  connection.beginTransaction(async (err) => {
    if (err) { return res.status(500).json({ message: 'Error starting transaction for quiz creation.' }); }
    try {
      const courseCheck = await query('SELECT instructorId FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructorId !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own the course for this quiz.' });
      }

      const quizResult = await query('INSERT INTO quizzes (title, courseId) VALUES (?, ?)', [title, courseId]);
      const quizId = quizResult.insertId;

      for (const q of questions) {
        if (!q.text || !q.options || !Array.isArray(q.options) || q.options.length < 2 || !q.options.some(opt => opt.isCorrect)) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid question data for: "${q.text || 'Untitled Question'}". Each question needs text, at least 2 options, and one correct answer.`});
        }
        const questionResult = await query('INSERT INTO quiz_questions (quizId, text, type) VALUES (?, ?, ?)', 
          [quizId, q.text, q.type || 'mcq']);
        const questionId = questionResult.insertId;

        for (const opt of q.options) {
          if (opt.text === undefined || opt.isCorrect === undefined) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid option data for question: "${q.text}". Options need text and isCorrect flag.`});
          }
          await query('INSERT INTO quiz_options (questionId, text, isCorrect) VALUES (?, ?, ?)',
            [questionId, opt.text, opt.isCorrect]);
        }
      }
      await query('COMMIT');
      // Fetch the created quiz with its structure to return
      const createdQuiz = await query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
      const createdQuestionsRaw = await query('SELECT * FROM quiz_questions WHERE quizId = ? ORDER BY id', [quizId]);
      const createdQuestions = [];
      for(const qRaw of createdQuestionsRaw) {
        const options = await query('SELECT * FROM quiz_options WHERE questionId = ? ORDER BY id', [qRaw.id]);
        createdQuestions.push({...qRaw, options});
      }
      res.status(201).json({...createdQuiz[0], questions: createdQuestions});
    } catch (error) {
      await query('ROLLBACK');
      console.error('Create quiz error (transaction rolled back):', error);
      res.status(500).json({ message: 'Error creating quiz.' });
    }
  });
});

app.get('/api/quizzes/:quizId', async (req, res) => { // Can be public or protected based on needs
  const { quizId } = req.params;
  try {
    const quizResults = await query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizResults.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    const quiz = quizResults[0];
    const questionsRaw = await query('SELECT * FROM quiz_questions WHERE quizId = ? ORDER BY orderIndex, id', [quizId]);
    const questions = [];
    for (const qRaw of questionsRaw) {
      const options = await query('SELECT id, text, isCorrect FROM quiz_options WHERE questionId = ? ORDER BY id', [qRaw.id]);
      questions.push({ ...qRaw, options });
    }
    quiz.questions = questions;
    res.json(quiz);
  } catch (error) {
    console.error('Get quiz by ID error:', error);
    res.status(500).json({ message: 'Error fetching quiz details.' });
  }
});

app.get('/api/courses/:courseId/quizzes', async (req, res) => { // Can be public or protected
  const { courseId } = req.params;
  try {
    const quizzes = await query('SELECT id, title FROM quizzes WHERE courseId = ? ORDER BY createdAt', [courseId]);
    // For a list, typically just IDs and titles are fine. Full details can be fetched via /api/quizzes/:quizId
    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes for course error:', error);
    res.status(500).json({ message: 'Error fetching quizzes for course.' });
  }
});

// === Quiz Attempts & Reports ===
app.post('/api/quiz-attempts', authenticateToken, async (req, res) => { // Or allow anonymous based on QuizWith
  const { playerNickname, quizId, courseId, score, totalQuestions, isQuizWith } = req.body;
  const userId = req.user ? req.user.userId : null; // Get userId if authenticated

  if (quizId === undefined || courseId === undefined || score === undefined || totalQuestions === undefined || isQuizWith === undefined) {
    return res.status(400).json({ message: "Missing required fields for quiz attempt." });
  }
  if (!userId && !playerNickname && isQuizWith) {
    return res.status(400).json({ message: "Nickname required for QuizWith guest attempts." });
  }
  if (!userId && !isQuizWith) { // Regular quiz attempt must be by a logged-in user
    return res.status(401).json({ message: "User must be logged in to submit regular quiz attempts." });
  }

  const finalUserId = isQuizWith ? (userId || null) : userId; // If QuizWith, user might be logged in or guest. If regular, must be logged in.
  const finalNickname = isQuizWith ? playerNickname : null;
  const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

  try {
    const result = await query(
      'INSERT INTO quiz_attempts (userId, playerNickname, quizId, courseId, score, totalQuestions, percentage, takenAt, isQuizWith) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
      [finalUserId, finalNickname, quizId, courseId, score, totalQuestions, percentage, isQuizWith]
    );
    // Fetch course and quiz titles for the response if needed, or rely on client having them
    const courseData = await query('SELECT title from courses WHERE id = ?', [courseId]);
    const quizData = await query('SELECT title from quizzes WHERE id = ?', [quizId]);

    res.status(201).json({ 
        id: result.insertId, 
        userId: finalUserId, 
        playerNickname: finalNickname, 
        quizId, 
        quizTitle: quizData.length ? quizData[0].title : 'N/A',
        courseId, 
        courseTitle: courseData.length ? courseData[0].title : 'N/A',
        score, 
        totalQuestions, 
        percentage, 
        isQuizWith, 
        takenAt: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Submit quiz score error:', error);
    res.status(500).json({ message: 'Error submitting quiz score.' });
  }
});

app.get('/api/users/me/quiz-attempts', authenticateToken, authorizeRole(['student', 'instructor', 'admin']), async (req, res) => {
  const userId = req.user.userId;
  try {
    const attempts = await query(
      `SELECT qa.*, q.title as quizTitle, c.title as courseTitle 
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN courses c ON qa.courseId = c.id
       WHERE qa.userId = ? 
       ORDER BY qa.takenAt DESC`, 
      [userId]
    );
    res.json(attempts);
  } catch (error) {
    console.error('Get user quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching user quiz attempts.' });
  }
});

app.get('/api/instructors/me/quizzes', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
    const instructorId = req.user.userId;
    try {
        const quizzes = await query(
          `SELECT q.* FROM quizzes q 
           JOIN courses c ON q.courseId = c.id 
           WHERE c.instructorId = ? 
           ORDER BY q.createdAt DESC`, 
          [instructorId]
        );
        res.json(quizzes);
    } catch (error) {
        console.error('Get quizzes for instructor error:', error);
        res.status(500).json({ message: 'Error fetching quizzes for instructor.' });
    }
});

app.get('/api/instructors/me/quiz-attempts', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorId = req.user.userId;
  try {
    const attempts = await query(
      `SELECT qa.*, q.title as quizTitle, c.title as courseTitle, u.username as studentUsername, u.email as studentEmail
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quizId = q.id
       JOIN courses c ON qa.courseId = c.id
       LEFT JOIN users u ON qa.userId = u.id 
       WHERE c.instructorId = ?
       ORDER BY qa.takenAt DESC`,
      [instructorId]
    );
    res.json(attempts);
  } catch (error) {
    console.error('Get instructor quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching instructor quiz attempts for their courses.' });
  }
});


// === QuizWith (Kahoot-style) Functionality ===
app.post('/api/quizwith/host', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const hostUserId = req.user.userId;
  const { quizId } = req.body;

  if (!quizId) return res.status(400).json({ message: "Quiz ID is required." });

  try {
    const quizCheck = await query(
      `SELECT q.id, q.title, c.instructorId 
       FROM quizzes q 
       JOIN courses c ON q.courseId = c.id 
       WHERE q.id = ?`, [quizId]);
       
    if (quizCheck.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    if (quizCheck[0].instructorId !== hostUserId) {
      return res.status(403).json({ message: 'Forbidden: You do not own the course this quiz belongs to.' });
    }
    const questionsExist = await query('SELECT id FROM quiz_questions WHERE quizId = ? LIMIT 1', [quizId]);
    if (questionsExist.length === 0) {
      return res.status(400).json({ message: 'Cannot host QuizWith: The selected quiz has no questions.' });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    // Check for PIN collision, though unlikely with 6 digits. Retry if needed for production.
    const result = await query(
      'INSERT INTO quizwith_sessions (pin, quizId, hostUserId, status, createdAt) VALUES (?, ?, ?, \'waiting\', NOW())',
      [pin, quizId, hostUserId]
    );
    res.json({ pin, sessionId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes("'pin'")) { // Handle rare PIN collision
        return res.status(500).json({ message: 'Error hosting QuizWith session due to PIN conflict. Please try again.' });
    }
    console.error('Host QuizWith session error:', error);
    res.status(500).json({ message: 'Error hosting QuizWith session.' });
  }
});

app.post('/api/quizwith/join', async (req, res) => { // No token needed for guests to join
  const { pin, nickname } = req.body;
  if (!pin || !nickname) {
    return res.status(400).json({ success: false, message: 'PIN and nickname are required.' });
  }
  try {
    const sessions = await query(
      `SELECT s.id as sessionId, s.quizId, q.courseId, s.status 
       FROM quizwith_sessions s
       JOIN quizzes q ON s.quizId = q.id
       WHERE s.pin = ?`, [pin.toUpperCase()] // Assuming PINs are stored/compared case-insensitively or consistently
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid PIN.' });
    }
    const session = sessions[0];
    if (session.status !== 'waiting') { // Could also allow joining 'active' sessions if logic supports it
      return res.status(400).json({ success: false, message: 'This QuizWith session is not currently accepting new players.' });
    }

    // TODO: Add player to the session (e.g., in a quizwith_players table).
    // For now, we just acknowledge they can join.
    // const playerResult = await query('INSERT INTO quizwith_players (sessionId, nickname, joinedAt) VALUES (?, ?, NOW())', [session.sessionId, nickname]);
    
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

app.get('/api/quizwith/sessions/:pin', async (req, res) => { // Can be public for players to check status
  const { pin } = req.params;
  try {
    const sessions = await query(
      `SELECT s.*, q.title as quizTitle 
       FROM quizwith_sessions s 
       JOIN quizzes q ON s.quizId = q.id 
       WHERE s.pin = ?`, [pin.toUpperCase()]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    // TODO: Optionally, fetch player list for the session:
    // const players = await query('SELECT nickname FROM quizwith_players WHERE sessionId = ?', [sessions[0].id]);
    // sessions[0].players = players;
    res.json(sessions[0]);
  } catch (error) {
    console.error('Get QuizWith session error:', error);
    res.status(500).json({ message: 'Error fetching QuizWith session details.' });
  }
});

// TODO: Add endpoints for QuizWith game progression (e.g., start quiz, next question, show leaderboard)
// These would likely involve WebSockets for real-time communication.

// --- Live Video Sessions (Placeholders) ---
app.post('/api/live-sessions/:courseId/start', authenticateToken, authorizeRole(['instructor']), (req, res) => {
    const { courseId } = req.params;
    //const instructorId = req.user.userId;
    // TODO: Logic to create/manage a live session room (e.g., using a third-party service or custom WebRTC signaling)
    console.log(`Instructor ${req.user.userId} trying to start live session for course ${courseId}`);
    res.json({ sessionId: `live-${courseId}-${Date.now()}`, message: "Live session initiated (placeholder)." });
});

app.post('/api/live-sessions/:sessionId/join', authenticateToken, (req, res) => {
    const { sessionId } = req.params;
    //const userId = req.user.userId;
    // TODO: Logic for a user to join a session, handle WebRTC signaling.
    console.log(`User ${req.user.userId} trying to join live session ${sessionId}`);
    res.json({ success: true, message: "Joined live session (placeholder)." });
});


// --- Server Listening ---
app.listen(port, () => {
  console.log(`LearnSpark LMS backend server listening on port ${port}`);
});
