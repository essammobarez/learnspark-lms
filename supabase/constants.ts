
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

// LocalStorage keys for QuizWith simulation (client-side player info)
export const QUIZ_WITH_ACTIVE_PIN_KEY = 'quizWithActivePin'; // This will be primarily managed by backend now, but client might peek for UX.
export const QUIZ_WITH_PLAYER_INFO_KEY = 'quizWithPlayerInfo';
