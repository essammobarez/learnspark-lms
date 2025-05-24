
import { Course, Lesson, Quiz, QuizQuestion, QuizQuestionOption, User, UserRole, QuizAttempt } from './types';

export const APP_NAME = "LearnSpark LMS";

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup', // Added new signup route
  STUDENT_DASHBOARD: '/student/dashboard',
  INSTRUCTOR_DASHBOARD: '/instructor/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard', // Assuming an admin dashboard might be added
  COURSE_LIST: '/courses',
  COURSE_DETAIL: '/courses/:courseId',
  CREATE_COURSE: '/instructor/create-course',
  EDIT_COURSE: '/instructor/courses/:courseId/edit', 
  CREATE_QUIZ: '/instructor/courses/:courseId/create-quiz',
  CREATE_QUIZWITH_GAME: '/instructor/create-quizwith-game', 
  QUIZ: '/courses/:courseId/quiz/:quizId',
  LIVE_SESSION: '/courses/:courseId/live',
  HOST_QUIZ_SESSION: '/courses/:courseId/quizzes/:quizId/host', 
  JOIN_QUIZ_WITH: '/join-quizwith',
  STUDENT_REPORTS: '/student/reports', // New route for student quiz reports
  INSTRUCTOR_REPORTS: '/instructor/reports', // New route for instructor quiz reports
};

// Mock Data
export const MOCK_USERS: User[] = [
  { id: 'user1', username: 'Alice Student', email: 'alice@example.com', role: UserRole.STUDENT, enrolledCourseIds: ['course1'] },
  { id: 'user2', username: 'Bob Instructor', email: 'bob@example.com', role: UserRole.INSTRUCTOR, createdCourseIds: ['course1', 'course2'] },
  { id: 'user3', username: 'Charlie Admin', email: 'charlie@example.com', role: UserRole.ADMIN },
];

export const MOCK_LESSONS_COURSE1: Lesson[] = [
  { id: 'l1c1', title: 'Introduction to React', type: 'video', content: 'https://www.youtube.com/embed/SqcY0GlETPk' },
  { id: 'l2c1', title: 'Components and Props', type: 'document', content: '## Components and Props Explained...' },
];

export const MOCK_LESSONS_COURSE2: Lesson[] = [
  { id: 'l1c2', title: 'Advanced Tailwind CSS', type: 'video', content: 'https://www.youtube.com/embed/SqcY0GlETPk' }, // Placeholder video
  { id: 'l2c2', title: 'Building Responsive Layouts', type: 'presentation', content: '## Responsive Design Principles...' },
];

export const MOCK_QUIZ_QUESTIONS_Q1: QuizQuestion[] = [
  {
    id: 'q1q1',
    text: 'What is JSX?',
    options: [
      { id: 'opt1', text: 'JavaScript XML', isCorrect: true },
      { id: 'opt2', text: 'JavaScript Extension', isCorrect: false },
      { id: 'opt3', text: 'Java Syntax Extension', isCorrect: false },
      { id: 'opt4', text: 'JSON Syntax', isCorrect: false },
    ],
    type: 'mcq',
  },
  {
    id: 'q2q1',
    text: 'Which hook is used for side effects in React?',
    options: [
      { id: 'opt1', text: 'useState', isCorrect: false },
      { id: 'opt2', text: 'useEffect', isCorrect: true },
      { id: 'opt3', text: 'useContext', isCorrect: false },
      { id: 'opt4', text: 'useReducer', isCorrect: false },
    ],
    type: 'mcq',
  },
];

export const MOCK_QUIZZES: Quiz[] = [
  { id: 'quiz1', title: 'React Basics Quiz', courseId: 'course1', questions: MOCK_QUIZ_QUESTIONS_Q1 },
  { id: 'quiz2', title: 'Tailwind Fundamentals Quiz', courseId: 'course2', questions: [] /* Add questions later */ },
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'course1',
    title: 'Ultimate React Bootcamp 2024',
    description: 'Learn React from scratch, from basic concepts to advanced topics. Build real-world projects.',
    instructorId: 'user2',
    instructorName: 'Bob Instructor',
    imageUrl: 'https://picsum.photos/seed/react/600/400',
    lessons: MOCK_LESSONS_COURSE1,
    quizIds: ['quiz1'],
    category: 'Development',
    rating: 4.8,
    enrollmentCount: 12056
  },
  {
    id: 'course2',
    title: 'Mastering Tailwind CSS for Modern UI',
    description: 'A comprehensive guide to Tailwind CSS. Build beautiful, responsive UIs with utility-first CSS.',
    instructorId: 'user2',
    instructorName: 'Bob Instructor',
    imageUrl: 'https://picsum.photos/seed/tailwind/600/400',
    lessons: MOCK_LESSONS_COURSE2,
    quizIds: ['quiz2'],
    category: 'Design',
    rating: 4.9,
    enrollmentCount: 8765
  },
  {
    id: 'course3',
    title: 'Introduction to Data Science with Python',
    description: 'Explore the world of data science. Learn Python libraries like NumPy, Pandas, and Matplotlib.',
    instructorId: 'user2', // Assuming Bob teaches this too for simplicity
    instructorName: 'Bob Instructor',
    imageUrl: 'https://picsum.photos/seed/python/600/400',
    lessons: [],
    quizIds: [],
    category: 'Data Science',
    rating: 4.7,
    enrollmentCount: 9500
  },
];

export const MOCK_QUIZ_ATTEMPTS: QuizAttempt[] = []; // Initialize as empty, will be populated by service

// LocalStorage keys for QuizWith simulation
export const QUIZ_WITH_ACTIVE_PIN_KEY = 'quizWithActivePin';
export const QUIZ_WITH_PLAYER_INFO_KEY = 'quizWithPlayerInfo';
export const QUIZ_ATTEMPTS_LS_KEY = 'quizAttemptsStore'; // Key for storing quiz attempts in localStorage
