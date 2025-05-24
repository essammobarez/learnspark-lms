// backend/server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Using bcryptjs for easier installation
const util = require('util');
const { v4: uuidv4 } = require('uuid'); // For generating VARCHAR IDs

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
    process.exit(1); 
  }
  console.log('Connected to MySQL database!');
});

// Promisify connection.query for async/await usage
const query = util.promisify(connection.query).bind(connection);

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
    req.user = userPayload; 
    next(); 
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
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields (username, email, password, role) are required.' });
  }
  if (!['student', 'instructor'].includes(role)) { 
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' }); 
    }

    const hashedPassword = await bcrypt.hash(password, 10); 
    const newUserId = uuidv4(); // Generate VARCHAR ID
    await query('INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [newUserId, username, email, hashedPassword, role]);
    
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully.', 
      user: { id: newUserId, username, email, role } 
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
    const accessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' }); 
    
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
  const userIdFromToken = req.user.userId;
  try {
    const users = await query('SELECT id, username, email, role FROM users WHERE id = ?', [userIdFromToken]);
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
  const updates = req.body; 
  const loggedInUserId = req.user.userId;
  const loggedInUserRole = req.user.role;

  if (loggedInUserId !== paramUserId && loggedInUserRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
  }

  if (updates.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    const existingUser = await query('SELECT id FROM users WHERE email = ? AND id != ?', [updates.email, paramUserId]);
    if (existingUser.length > 0) {
        return res.status(409).json({ message: 'Email already in use by another account.' });
    }
  }
  if (updates.username && updates.username.trim() === '') {
    return res.status(400).json({ message: 'Username cannot be empty.'});
  }

  try {
    const allowedUpdates = ['username', 'email']; 
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
    setClauses.push('updated_at = NOW()'); // Also update updated_at
    values.push(paramUserId); 

    const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await query(sql, values);

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found or no changes made.' });
    }
    
    const updatedUserResult = await query('SELECT id, username, email, role FROM users WHERE id = ?', [paramUserId]);
    res.json({ message: 'User profile updated successfully.', user: updatedUserResult[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user profile.' });
  }
});


// === Course Management ===
app.post('/api/courses', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorIdFromToken = req.user.userId;
  const { title, description, imageUrl, lessons = [], category } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ message: 'Title, description, and category are required.'});
  }
  const newCourseId = uuidv4();

  connection.beginTransaction(async (err) => {
    if (err) { 
        console.error('Transaction Begin Error:', err);
        return res.status(500).json({ message: 'Error starting transaction for course creation.' });
    }
    try {
      await query(
        'INSERT INTO courses (id, title, description, instructor_id, image_url, category, rating, enrollment_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())',
        [newCourseId, title, description, instructorIdFromToken, imageUrl || null, category]
      );

      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          if (!lesson.title || !lesson.type || !lesson.content) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid lesson data for lesson titled "${lesson.title || 'Untitled'}". Title, type, and content are required.`});
          }
          const newLessonId = uuidv4();
          await query('INSERT INTO lessons (id, course_id, title, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())', 
            [newLessonId, newCourseId, lesson.title, lesson.type, lesson.content]);
        }
      }
      await query('COMMIT');
      const createdCourseResult = await query('SELECT c.*, u.username as instructorName FROM courses c JOIN users u ON c.instructor_id = u.id WHERE c.id = ?', [newCourseId]);
      const createdLessons = await query('SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order, id', [newCourseId]);
      res.status(201).json({...createdCourseResult[0], lessons: createdLessons, quizIds: [] });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Create course error (transaction rolled back):', error);
      res.status(500).json({ message: 'Error creating course.' });
    }
  });
});

app.get('/api/courses', async (req, res) => {
  try {
    // Join with users table to get instructorName
    const coursesData = await query(
        `SELECT c.*, u.username as instructorName 
         FROM courses c 
         JOIN users u ON c.instructor_id = u.id 
         ORDER BY c.created_at DESC`
    );
    res.json(coursesData.map(course => ({...course, lessons: [], quizIds: []}))); 
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Error fetching courses.' });
  }
});

app.get('/api/courses/:courseId', async (req, res) => {
  const { courseId } = req.params;
  try {
    const courseResults = await query(
        `SELECT c.*, u.username as instructorName 
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         WHERE c.id = ?`, [courseId]
    );
    if (courseResults.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const course = courseResults[0];
    const lessonsData = await query('SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order, id', [courseId]);
    const quizResults = await query('SELECT id, title FROM quizzes WHERE course_id = ? ORDER BY created_at', [courseId]);
    
    course.lessons = lessonsData;
    course.quizIds = quizResults.map(q => q.id); 

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
      const courseCheck = await query('SELECT instructor_id FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructor_id !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
      }

      await query('UPDATE courses SET title = ?, description = ?, image_url = ?, category = ?, updated_at = NOW() WHERE id = ?',
        [title, description, imageUrl || null, category, courseId]);
      
      await query('DELETE FROM lessons WHERE course_id = ?', [courseId]);
      if (lessons && lessons.length > 0) {
        for (const lesson of lessons) {
          if (!lesson.title || !lesson.type || !lesson.content) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid lesson data for lesson: "${lesson.title || 'Untitled'}".` });
          }
          const newLessonId = uuidv4(); // Generate ID for new lessons
          await query('INSERT INTO lessons (id, course_id, title, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [newLessonId, courseId, lesson.title, lesson.type, lesson.content]);
        }
      }
      await query('COMMIT');
      const updatedCourseResult = await query('SELECT c.*, u.username as instructorName FROM courses c JOIN users u ON c.instructor_id = u.id WHERE c.id = ?', [courseId]);
      const updatedLessons = await query('SELECT * FROM lessons WHERE course_id = ? ORDER BY lesson_order, id', [courseId]);
      res.json({...updatedCourseResult[0], lessons: updatedLessons});
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
      const courseCheck = await query('SELECT instructor_id FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructor_id !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
      }
      
      const quizIdsResult = await query('SELECT id FROM quizzes WHERE course_id = ?', [courseId]);
      for (const row of quizIdsResult) {
        const questionIdsResult = await query('SELECT id FROM quiz_questions WHERE quiz_id = ?', [row.id]);
        for (const qRow of questionIdsResult) {
            await query('DELETE FROM quiz_question_options WHERE question_id = ?', [qRow.id]);
        }
        await query('DELETE FROM quiz_questions WHERE quiz_id = ?', [row.id]);
      }
      await query('DELETE FROM quizzes WHERE course_id = ?', [courseId]);
      await query('DELETE FROM lessons WHERE course_id = ?', [courseId]);
      await query('DELETE FROM user_enrolled_courses WHERE course_id = ?', [courseId]);
      await query('DELETE FROM quiz_attempts WHERE course_id = ?', [courseId]); 
      // Assuming active_quiz_with_sessions has course_id
      await query('DELETE FROM active_quiz_with_sessions WHERE course_id = ?', [courseId]);

      const deleteResult = await query('DELETE FROM courses WHERE id = ?', [courseId]);
      if (deleteResult.affectedRows === 0) {
        await query('ROLLBACK'); 
        return res.status(404).json({ message: 'Course not found during deletion.' });
      }
      
      await query('COMMIT');
      res.status(204).send(); 
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
  const { title, type, content, lesson_order } = req.body; // Added lesson_order

  if (!title || !type || !content) {
    return res.status(400).json({ message: 'Lesson title, type, and content are required.' });
  }
  try {
    const courseCheck = await query('SELECT instructor_id FROM courses WHERE id = ?', [courseId]);
    if (courseCheck.length === 0) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    if (courseCheck[0].instructor_id !== instructorIdFromToken) {
      return res.status(403).json({ message: 'Forbidden: You do not own this course.' });
    }
    const newLessonId = uuidv4();
    await query('INSERT INTO lessons (id, course_id, title, type, content, lesson_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [newLessonId, courseId, title, type, content, lesson_order || null]);
    res.status(201).json({ id: newLessonId, course_id: courseId, title, type, content, lesson_order: lesson_order || null });
  } catch (error) {
    console.error('Add lesson error:', error);
    res.status(500).json({ message: 'Error adding lesson.' });
  }
});


// === Enrollment ===
app.post('/api/courses/:courseId/enroll', authenticateToken, authorizeRole(['student']), async (req, res) => {
  const { courseId } = req.params;
  const userIdFromToken = req.user.userId;
  try {
    const courseExists = await query('SELECT id FROM courses WHERE id = ?', [courseId]);
    if(courseExists.length === 0) {
        return res.status(404).json({ success: false, message: 'Course not found.' });
    }
    // Using new table name and composite key for check
    const alreadyEnrolled = await query('SELECT course_id FROM user_enrolled_courses WHERE user_id = ? AND course_id = ?', [userIdFromToken, courseId]);
    if (alreadyEnrolled.length > 0) {
      return res.status(409).json({ success: false, message: 'Already enrolled in this course.' });
    }
    await query('INSERT INTO user_enrolled_courses (user_id, course_id, enrolled_at) VALUES (?, ?, NOW())', [userIdFromToken, courseId]);
    await query('UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = ?', [courseId]);
    res.json({ success: true, message: 'Successfully enrolled!' });
  } catch (error) {
    console.error('Enrollment error:', error);
    if (error.code === 'ER_DUP_ENTRY') { 
        return res.status(409).json({ success: false, message: 'Already enrolled (duplicate entry).' });
    }
    res.status(500).json({ success: false, message: 'Error enrolling in course.' });
  }
});

app.get('/api/users/me/enrolled-courses', authenticateToken, authorizeRole(['student']), async (req, res) => {
  const userIdFromToken = req.user.userId;
  try {
    const coursesData = await query(
      `SELECT c.*, u.username as instructorName 
       FROM courses c 
       JOIN user_enrolled_courses uec ON c.id = uec.course_id 
       JOIN users u ON c.instructor_id = u.id
       WHERE uec.user_id = ? ORDER BY uec.enrolled_at DESC`, 
      [userIdFromToken]
    );
    res.json(coursesData.map(c => ({...c, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({ message: 'Error fetching enrolled courses.' });
  }
});

app.get('/api/users/me/created-courses', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorIdFromToken = req.user.userId;
  try {
    const coursesData = await query(
        `SELECT c.*, u.username as instructorName 
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         WHERE c.instructor_id = ? ORDER BY c.created_at DESC`, [instructorIdFromToken]
    );
    res.json(coursesData.map(c => ({...c, lessons: [], quizIds: []})));
  } catch (error) {
    console.error('Get created courses error:', error);
    res.status(500).json({ message: 'Error fetching created courses.' });
  }
});


// === Quiz Management ===
app.post('/api/quizzes', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorIdFromToken = req.user.userId;
  const { title, courseId, questions } = req.body; // DDL uses course_id

  if (!title || !courseId || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'Quiz title, course_id, and at least one question are required.' });
  }
  const newQuizId = uuidv4();
  
  connection.beginTransaction(async (err) => {
    if (err) { return res.status(500).json({ message: 'Error starting transaction for quiz creation.' }); }
    try {
      const courseCheck = await query('SELECT instructor_id FROM courses WHERE id = ?', [courseId]);
      if (courseCheck.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ message: 'Course not found.' });
      }
      if (courseCheck[0].instructor_id !== instructorIdFromToken) {
        await query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: You do not own the course for this quiz.' });
      }

      await query('INSERT INTO quizzes (id, title, course_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [newQuizId, title, courseId]);

      for (const q of questions) {
        if (!q.text || !q.options || !Array.isArray(q.options) || q.options.length < 2 || !q.options.some(opt => opt.isCorrect)) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid question data for: "${q.text || 'Untitled Question'}". Each question needs text, at least 2 options, and one correct answer.`});
        }
        const newQuestionId = uuidv4();
        await query('INSERT INTO quiz_questions (id, quiz_id, text, type, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())', 
          [newQuestionId, newQuizId, q.text, q.type || 'mcq']);

        for (const opt of q.options) {
          if (opt.text === undefined || opt.isCorrect === undefined) {
            await query('ROLLBACK');
            return res.status(400).json({ message: `Invalid option data for question: "${q.text}". Options need text and is_correct flag.`});
          }
          const newOptionId = uuidv4();
          await query('INSERT INTO quiz_question_options (id, question_id, text, is_correct, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [newOptionId, newQuestionId, opt.text, opt.isCorrect ? 1 : 0]); // Store boolean as tinyint
        }
      }
      await query('COMMIT');
      
      const createdQuizResult = await query('SELECT * FROM quizzes WHERE id = ?', [newQuizId]);
      const createdQuestionsRaw = await query('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order, id', [newQuizId]);
      const createdQuestions = [];
      for(const qRaw of createdQuestionsRaw) {
        const options = await query('SELECT id, text, is_correct FROM quiz_question_options WHERE question_id = ? ORDER BY option_order, id', [qRaw.id]);
        createdQuestions.push({...qRaw, options: options.map(o => ({...o, isCorrect: !!o.is_correct})) }); // Convert tinyint back to boolean
      }
      res.status(201).json({...createdQuizResult[0], questions: createdQuestions});
    } catch (error) {
      await query('ROLLBACK');
      console.error('Create quiz error (transaction rolled back):', error);
      res.status(500).json({ message: 'Error creating quiz.' });
    }
  });
});

app.get('/api/quizzes/:quizId', async (req, res) => { 
  const { quizId } = req.params;
  try {
    const quizResults = await query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizResults.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    const quiz = quizResults[0];
    const questionsRaw = await query('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order, id', [quizId]);
    const questions = [];
    for (const qRaw of questionsRaw) {
      const options = await query('SELECT id, text, is_correct FROM quiz_question_options WHERE question_id = ? ORDER BY option_order, id', [qRaw.id]);
      questions.push({ ...qRaw, options: options.map(o => ({...o, isCorrect: !!o.is_correct})) }); // Convert tinyint to boolean
    }
    quiz.questions = questions;
    res.json(quiz);
  } catch (error) {
    console.error('Get quiz by ID error:', error);
    res.status(500).json({ message: 'Error fetching quiz details.' });
  }
});

app.get('/api/courses/:courseId/quizzes', async (req, res) => { 
  const { courseId } = req.params; // DDL uses course_id
  try {
    const quizzes = await query('SELECT id, title FROM quizzes WHERE course_id = ? ORDER BY created_at', [courseId]);
    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes for course error:', error);
    res.status(500).json({ message: 'Error fetching quizzes for course.' });
  }
});

// === Quiz Attempts & Reports ===
app.post('/api/quiz-attempts', authenticateToken, async (req, res) => { 
  const { playerNickname, quizId, courseId, score, totalQuestions, isQuizWith } = req.body; // DDL uses quiz_id, course_id
  const userIdFromToken = req.user ? req.user.userId : null; 

  if (quizId === undefined || courseId === undefined || score === undefined || totalQuestions === undefined || isQuizWith === undefined) {
    return res.status(400).json({ message: "Missing required fields for quiz attempt." });
  }
  if (!userIdFromToken && !playerNickname && isQuizWith) {
    return res.status(400).json({ message: "Nickname required for QuizWith guest attempts." });
  }
  if (!userIdFromToken && !isQuizWith) { 
    return res.status(401).json({ message: "User must be logged in to submit regular quiz attempts." });
  }

  const finalUserId = isQuizWith ? (userIdFromToken || null) : userIdFromToken; 
  const finalNickname = isQuizWith ? playerNickname : null;
  const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

  try {
    const courseData = await query('SELECT title from courses WHERE id = ?', [courseId]);
    const quizData = await query('SELECT title from quizzes WHERE id = ?', [quizId]);
    const courseTitle = courseData.length ? courseData[0].title : 'N/A';
    const quizTitle = quizData.length ? quizData[0].title : 'N/A';

    const newAttemptId = uuidv4();
    await query(
      'INSERT INTO quiz_attempts (id, user_id, player_nickname, quiz_id, course_id, score, total_questions, percentage, taken_at, is_quiz_with, quiz_title, course_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)',
      [newAttemptId, finalUserId, finalNickname, quizId, courseId, score, totalQuestions, percentage, isQuizWith ? 1:0, quizTitle, courseTitle]
    );
    
    res.status(201).json({ 
        id: newAttemptId, 
        user_id: finalUserId, 
        player_nickname: finalNickname, 
        quiz_id: quizId, 
        quizTitle: quizTitle,
        course_id: courseId, 
        courseTitle: courseTitle,
        score, 
        total_questions: totalQuestions, 
        percentage, 
        is_quiz_with: isQuizWith, 
        taken_at: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Submit quiz score error:', error);
    res.status(500).json({ message: 'Error submitting quiz score.' });
  }
});

app.get('/api/users/me/quiz-attempts', authenticateToken, authorizeRole(['student', 'instructor', 'admin']), async (req, res) => {
  const userIdFromToken = req.user.userId;
  try {
    const attempts = await query(
      `SELECT qa.* 
       FROM quiz_attempts qa
       WHERE qa.user_id = ? 
       ORDER BY qa.taken_at DESC`, 
      [userIdFromToken]
    );
    res.json(attempts.map(a => ({...a, is_quiz_with: !!a.is_quiz_with}))); // Ensure boolean
  } catch (error) {
    console.error('Get user quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching user quiz attempts.' });
  }
});

app.get('/api/instructors/me/quizzes', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
    const instructorIdFromToken = req.user.userId;
    try {
        const quizzesData = await query(
          `SELECT q.* FROM quizzes q 
           JOIN courses c ON q.course_id = c.id 
           WHERE c.instructor_id = ? 
           ORDER BY q.created_at DESC`, 
          [instructorIdFromToken]
        );
        res.json(quizzesData);
    } catch (error) {
        console.error('Get quizzes for instructor error:', error);
        res.status(500).json({ message: 'Error fetching quizzes for instructor.' });
    }
});

app.get('/api/instructors/me/quiz-attempts', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const instructorIdFromToken = req.user.userId;
  try {
    const attempts = await query(
      `SELECT qa.*, u.username as studentUsername, u.email as studentEmail
       FROM quiz_attempts qa
       JOIN courses c ON qa.course_id = c.id
       LEFT JOIN users u ON qa.user_id = u.id 
       WHERE c.instructor_id = ?
       ORDER BY qa.taken_at DESC`,
      [instructorIdFromToken]
    );
    res.json(attempts.map(a => ({...a, is_quiz_with: !!a.is_quiz_with}))); // Ensure boolean
  } catch (error) {
    console.error('Get instructor quiz attempts error:', error);
    res.status(500).json({ message: 'Error fetching instructor quiz attempts for their courses.' });
  }
});


// === QuizWith (Kahoot-style) Functionality ===
app.post('/api/quizwith/host', authenticateToken, authorizeRole(['instructor']), async (req, res) => {
  const hostUserIdFromToken = req.user.userId;
  const { quizId } = req.body; // DDL uses quiz_id

  if (!quizId) return res.status(400).json({ message: "Quiz ID is required." });

  try {
    const quizCheck = await query(
      `SELECT q.id, q.title as quiz_title, q.course_id, c.instructor_id 
       FROM quizzes q 
       JOIN courses c ON q.course_id = c.id 
       WHERE q.id = ?`, [quizId]);
       
    if (quizCheck.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    if (quizCheck[0].instructor_id !== hostUserIdFromToken) {
      return res.status(403).json({ message: 'Forbidden: You do not own the course this quiz belongs to.' });
    }
    const questionsExist = await query('SELECT id FROM quiz_questions WHERE quiz_id = ? LIMIT 1', [quizId]);
    if (questionsExist.length === 0) {
      return res.status(400).json({ message: 'Cannot host QuizWith: The selected quiz has no questions.' });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    // Using new table name active_quiz_with_sessions
    await query(
      'INSERT INTO active_quiz_with_sessions (pin, quiz_id, host_user_id, status, course_id, quiz_title, created_at, updated_at) VALUES (?, ?, ?, \'waiting\', ?, ?, NOW(), NOW())',
      [pin, quizId, hostUserIdFromToken, quizCheck[0].course_id, quizCheck[0].quiz_title]
    );
    // sessionId is not part of active_quiz_with_sessions DDL as pin is PRI. If client needs a session identifier other than PIN, backend needs to generate it.
    // For now, PIN is the primary identifier.
    res.json({ pin, sessionId: pin }); // Returning PIN as sessionId for consistency if client expects it.
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes("'pin'")) { 
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
    // Using new table name
    const sessions = await query(
      `SELECT pin, quiz_id, course_id, status 
       FROM active_quiz_with_sessions
       WHERE pin = ?`, [pin.toUpperCase()]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid PIN.' });
    }
    const session = sessions[0];
    if (session.status !== 'waiting') { 
      return res.status(400).json({ success: false, message: 'This QuizWith session is not currently accepting new players.' });
    }
    
    // TODO (unchanged): Add player to the session (e.g., in a quizwith_players table).
    // const playerResult = await query('INSERT INTO quizwith_players (sessionId, nickname, joinedAt) VALUES (?, ?, NOW())', [session.pin, nickname]); // Assuming pin acts as sessionId for players table
    
    res.json({ 
      success: true, 
      message: 'Joined successfully!', 
      quizId: session.quiz_id, 
      courseId: session.course_id, 
      sessionId: session.pin // Returning pin as sessionId
    });
  } catch (error) {
    console.error('Join QuizWith session error:', error);
    res.status(500).json({ success: false, message: 'Error joining QuizWith session.' });
  }
});

app.get('/api/quizwith/sessions/:pin', async (req, res) => { 
  const { pin } = req.params;
  try {
    // Using new table name and column names
    const sessions = await query(
      `SELECT * 
       FROM active_quiz_with_sessions
       WHERE pin = ?`, [pin.toUpperCase()]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    // TODO (unchanged): Optionally, fetch player list for the session:
    // const players = await query('SELECT nickname FROM quizwith_players WHERE sessionId = ?', [sessions[0].pin]); // Assuming pin as sessionId reference
    // sessions[0].players = players;
    res.json(sessions[0]);
  } catch (error) {
    console.error('Get QuizWith session error:', error);
    res.status(500).json({ message: 'Error fetching QuizWith session details.' });
  }
});

// TODO (unchanged): Add endpoints for QuizWith game progression (e.g., start quiz, next question, show leaderboard)
// These would likely involve WebSockets for real-time communication.

// --- Live Video Sessions (Placeholders) ---
app.post('/api/live-sessions/:courseId/start', authenticateToken, authorizeRole(['instructor']), (req, res) => {
    const { courseId } = req.params; // DDL uses course_id
    console.log(`Instructor ${req.user.userId} trying to start live session for course ${courseId}`);
    res.json({ sessionId: `live-${courseId}-${Date.now()}`, message: "Live session initiated (placeholder)." });
});

app.post('/api/live-sessions/:sessionId/join', authenticateToken, (req, res) => {
    const { sessionId } = req.params;
    console.log(`User ${req.user.userId} trying to join live session ${sessionId}`);
    res.json({ success: true, message: "Joined live session (placeholder)." });
});


// --- Server Listening ---
app.listen(port, () => {
  console.log(`LearnSpark LMS backend server listening on port ${port}`);
});
