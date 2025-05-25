import { User, Course, Quiz, Lesson, QuizAttempt, UserRole } from '../types';
import { mockApiService as mockApi } from './mockApiService'; // Import the mock service

// The actual API service now delegates to the mock service.
// In a real application, this file might conditionally use mock or real API calls.
export const apiService = {
  // --- Auth ---
  login: async (email: string, password_unused: string): Promise<{ token: string; user: User }> => {
    return mockApi.login(email, password_unused);
  },

  signup: async (username: string, email: string, password_unused: string, role: UserRole): Promise<{ success: boolean; message: string; user?: User }> => {
    return mockApi.signup(username, email, password_unused, role);
  },

  getCurrentUser: async (): Promise<User | null> => {
    return mockApi.getCurrentUser();
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    return mockApi.getCourses();
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    return mockApi.getCourseById(courseId);
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'instructorName' | 'rating' | 'enrollmentCount'>): Promise<Course> => {
    return mockApi.createCourse(courseData);
  },

  updateCourse: async (courseId: string, courseData: Partial<Omit<Course, 'id' | 'instructorId' | 'instructorName' | 'rating' | 'enrollmentCount'>>): Promise<Course | null> => {
    return mockApi.updateCourse(courseId, courseData);
  },
  
  addLessonToCourse: async (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson | null> => {
    return mockApi.addLessonToCourse(courseId, lessonData);
  },

  // --- Quizzes ---
  getQuizById: async (quizId: string): Promise<Quiz | null> => {
    return mockApi.getQuizById(quizId);
  },

  createQuiz: async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
    return mockApi.createQuiz(quizData);
  },
  
  getQuizzesForCourse: async (courseId: string): Promise<Quiz[]> => {
    return mockApi.getQuizzesForCourse(courseId);
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    return mockApi.enrollInCourse(courseId);
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    return mockApi.getEnrolledCourses();
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    return mockApi.getCreatedCourses();
  },

  // --- Quiz Attempts & Reports ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'>): Promise<QuizAttempt> => {
    return mockApi.submitQuizScore(attemptData);
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    return mockApi.getQuizAttemptsForUser();
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    return mockApi.getQuizzesForInstructor();
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    return mockApi.getQuizAttemptsForInstructorQuizzes();
  },

  // --- QuizWith (Kahoot-style) Game Session Management ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    return mockApi.hostQuizWithSession(quizId);
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    return mockApi.joinQuizWithSession(pin, nickname);
  },
  
  getQuizWithSessionByPin: async (pin: string): Promise<any> => { // Adjust 'any' to a proper type if available for ActiveQuizWithSession
    return mockApi.getQuizWithSessionByPin(pin);
  },
};
