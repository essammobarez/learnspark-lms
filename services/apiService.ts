# Replace the contents of services/apiService.ts with the real API implementation (no mock usage)
api_service_path = "/mnt/data/learnspark-lms/services/apiService.ts"

real_api_service_code = """
import { User, Course, Quiz, Lesson, QuizAttempt, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiService = {
  // --- Auth ---
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  signup: async (username: string, email: string, password: string, role: UserRole) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role }),
    });
    if (!res.ok) throw new Error('Signup failed');
    return res.json();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { ...getAuthHeaders() },
    });
    if (res.status === 401) return null;
    return res.json();
  },

  // --- Courses ---
  getCourses: async (): Promise<Course[]> => {
    const res = await fetch(`${API_BASE_URL}/api/courses`);
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
  },

  getCourseById: async (courseId: string): Promise<Course | null> => {
    const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}`);
    if (!res.ok) throw new Error('Course not found');
    return res.json();
  },

  createCourse: async (courseData: Partial<Course>): Promise<Course> => {
    const res = await fetch(`${API_BASE_URL}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(courseData),
    });
    if (!res.ok) throw new Error('Failed to create course');
    return res.json();
  },

  updateCourse: async (courseId: string, courseData: Partial<Course>): Promise<Course> => {
    const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(courseData),
    });
    if (!res.ok) throw new Error('Failed to update course');
    return res.json();
  },

  addLessonToCourse: async (courseId: string, lessonData: Omit<Lesson, 'id'>): Promise<Lesson> => {
    const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(lessonData),
    });
    if (!res.ok) throw new Error('Failed to add lesson');
    return res.json();
  },

  // --- Quizzes ---
  getQuizById: async (quizId: string): Promise<Quiz> => {
    const res = await fetch(`${API_BASE_URL}/api/quizzes/${quizId}`);
    if (!res.ok) throw new Error('Quiz not found');
    return res.json();
  },

  createQuiz: async (quizData: Omit<Quiz, 'id'>): Promise<Quiz> => {
    const res = await fetch(`${API_BASE_URL}/api/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(quizData),
    });
    if (!res.ok) throw new Error('Failed to create quiz');
    return res.json();
  },

  getQuizzesForCourse: async (courseId: string): Promise<Quiz[]> => {
    const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}/quizzes`);
    if (!res.ok) throw new Error('Failed to fetch quizzes');
    return res.json();
  },

  // --- Enrollments ---
  enrollInCourse: async (courseId: string): Promise<{ success: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}/enroll`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  getEnrolledCourses: async (): Promise<Course[]> => {
    const res = await fetch(`${API_BASE_URL}/api/users/me/enrolled-courses`, {
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  getCreatedCourses: async (): Promise<Course[]> => {
    const res = await fetch(`${API_BASE_URL}/api/users/me/created-courses`, {
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  // --- Quiz Attempts ---
  submitQuizScore: async (attemptData: Omit<QuizAttempt, 'id' | 'takenAt' | 'percentage' | 'courseTitle'>): Promise<QuizAttempt> => {
    const res = await fetch(`${API_BASE_URL}/api/quiz-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(attemptData),
    });
    return res.json();
  },

  getQuizAttemptsForUser: async (): Promise<QuizAttempt[]> => {
    const res = await fetch(`${API_BASE_URL}/api/users/me/quiz-attempts`, {
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  getQuizzesForInstructor: async (): Promise<Quiz[]> => {
    const res = await fetch(`${API_BASE_URL}/api/instructors/me/quizzes`, {
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  getQuizAttemptsForInstructorQuizzes: async (): Promise<QuizAttempt[]> => {
    const res = await fetch(`${API_BASE_URL}/api/instructors/me/quiz-attempts`, {
      headers: { ...getAuthHeaders() },
    });
    return res.json();
  },

  // --- QuizWith ---
  hostQuizWithSession: async (quizId: string): Promise<{ pin: string; sessionId: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/quizwith/host`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ quizId }),
    });
    return res.json();
  },

  joinQuizWithSession: async (pin: string, nickname: string): Promise<{ success: boolean; message?: string; quizId?: string; courseId?: string; sessionId?: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/quizwith/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, nickname }),
    });
    return res.json();
  },

  getQuizWithSessionByPin: async (pin: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/api/quizwith/sessions/${pin}`);
    return res.json();
  },
};
"""

# Write the refactored apiService.ts
with open(api_service_path, "w") as f:
    f.write(real_api_service_code)

"✅ apiService.ts has been fully converted to use the real backend API."
